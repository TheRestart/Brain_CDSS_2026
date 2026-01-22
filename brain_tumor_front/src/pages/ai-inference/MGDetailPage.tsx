import { useState, useEffect, useMemo, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MGResultViewer from '@/components/MGResultViewer'
import { SurvivalChart } from '@/components/ai/SurvivalChart'
import { GeneBarChart } from '@/components/ai/GeneBarChart'
import { GeneHeatmap } from '@/components/ai/GeneHeatmap'
import { aiApi } from '@/services/ai.api'
import { useAIRequestDetail } from '@/hooks'
import { useThumbnailCache } from '@/context/ThumbnailCacheContext'
import { useToast } from '@/components/common'
import PdfPreviewModal from '@/components/PdfPreviewModal'
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api'
import {
  DocumentPreview,
  formatConfidence,
  getRiskVariant,
} from '@/components/pdf-preview'
import './MGDetailPage.css'

// 검토 상태 라벨
const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '반려됨',
}

interface MGResult {
  patient_id?: string
  survival_risk?: {
    risk_score: number
    risk_percentile?: number
    risk_category?: string
    model_cindex?: number
  }
  survival_time?: {
    predicted_days: number
    predicted_months: number
    confidence_interval?: { lower: number; upper: number }
  }
  grade?: {
    predicted_class: string
    probability: number
    lgg_probability?: number
    hgg_probability?: number
    probabilities?: Record<string, number>
  }
  recurrence?: {
    predicted_class: string
    probability: number
    recurrence_probability?: number
  }
  tmz_response?: {
    predicted_class: string
    probability: number
    responder_probability?: number
  }
  xai?: {
    attention_weights?: number[]
    top_genes?: Array<{
      rank: number
      gene: string
      attention_score: number
      expression_zscore: number
    }>
    gene_importance_summary?: {
      total_genes: number
      attention_mean: number
      attention_std: number
      attention_max: number
      attention_min: number
    }
  }
  processing_time_ms?: number
  input_genes_count?: number
  model_version?: string
}

interface InferenceDetail {
  id: number
  job_id: string
  model_type: string
  status: string
  mode: string
  patient_name: string
  patient_number: string
  gene_ocs: number | null
  result_data: MGResult | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export default function MGDetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { markAsCached } = useThumbnailCache()
  const toast = useToast()

  // AI Request Detail Hook (for review functionality)
  const { request: aiRequest, review } = useAIRequestDetail(jobId ?? null)

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [inferenceDetail, setInferenceDetail] = useState<InferenceDetail | null>(null)
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)

  // Review modal state
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved')
  const [reviewComment, setReviewComment] = useState('')

  // Can review check
  const canReview = aiRequest?.has_result && aiRequest?.result?.review_status === 'pending'

  // Review submit handler
  const handleReviewSubmit = useCallback(async () => {
    try {
      await review(reviewStatus, reviewComment || undefined)
      toast.success(`결과가 ${reviewStatus === 'approved' ? '승인' : '반려'}되었습니다.`)
      setShowReviewModal(false)
      setReviewComment('')
    } catch (err) {
      toast.error('검토 처리에 실패했습니다.')
    }
  }, [review, reviewStatus, reviewComment, toast])

  // 생존 곡선 데이터 생성 (샘플 데이터 - 실제 API 연동 시 교체)
  const survivalChartData = useMemo(() => {
    if (!inferenceDetail?.result_data?.survival_risk) return []

    // Kaplan-Meier 스타일 생존 곡선 샘플 데이터
    const timePoints = [0, 6, 12, 18, 24, 30, 36, 42, 48, 54, 60]
    return timePoints.map(time => ({
      time,
      low: Math.max(0, 1 - (time / 100) * 0.8),
      medium: Math.max(0, 1 - (time / 80) * 0.9),
      high: Math.max(0, 1 - (time / 60) * 1.0),
    }))
  }, [inferenceDetail?.result_data?.survival_risk])

  // 환자 위험군 결정
  const patientRiskGroup = useMemo((): 'high' | 'medium' | 'low' | undefined => {
    const riskScore = inferenceDetail?.result_data?.survival_risk?.risk_score
    if (riskScore === undefined) return undefined
    if (riskScore < 0.33) return 'low'
    if (riskScore < 0.66) return 'medium'
    return 'high'
  }, [inferenceDetail?.result_data?.survival_risk?.risk_score])

  // 유전자 중요도 데이터 변환
  const geneBarChartData = useMemo(() => {
    const topGenes = inferenceDetail?.result_data?.xai?.top_genes
    if (!topGenes) return []

    return topGenes.slice(0, 15).map(gene => ({
      name: gene.gene,
      importance: gene.attention_score,
      direction: gene.expression_zscore >= 0 ? 'up' as const : 'down' as const,
      expressionZscore: gene.expression_zscore,
    }))
  }, [inferenceDetail?.result_data?.xai?.top_genes])

  // 히트맵 데이터 생성 (샘플 데이터 - 실제 API 연동 시 교체)
  const heatmapData = useMemo(() => {
    const topGenes = inferenceDetail?.result_data?.xai?.top_genes
    if (!topGenes || topGenes.length === 0) return { genes: [], samples: [], values: [] }

    const genes = topGenes.slice(0, 20).map(g => g.gene)
    const samples = ['Sample1', 'Sample2', 'Sample3', 'Sample4', 'Sample5', 'Patient']

    // 시드 기반 pseudo-random 생성 (일관된 데모 데이터)
    const seededRandom = (seed: number) => {
      const x = Math.sin(seed * 9999) * 10000
      return x - Math.floor(x)
    }

    // 샘플 발현량 데이터 생성 (실제 데이터로 교체 필요)
    const values = genes.map((_, gIdx) =>
      samples.map((_, sIdx) => {
        if (sIdx === samples.length - 1) {
          // 환자 데이터는 실제 z-score 사용
          return topGenes[gIdx]?.expression_zscore / 3 || 0
        }
        // 다른 샘플은 시드 기반 데모 데이터 (일관성 유지)
        return (seededRandom(gIdx * 100 + sIdx) - 0.5) * 2
      })
    )

    return { genes, samples, values }
  }, [inferenceDetail?.result_data?.xai?.top_genes])

  // 데이터 로드
  useEffect(() => {
    if (jobId) {
      loadInferenceDetail(jobId)
      // 보고서 방문 시 캐시에 등록 (목록 페이지에서 썸네일 표시용)
      markAsCached(`ai_${jobId}`)
    }
  }, [jobId, markAsCached])

  const loadInferenceDetail = async (id: string) => {
    try {
      setLoading(true)
      setError('')
      const data = await aiApi.getInferenceDetail(id)
      setInferenceDetail(data)
    } catch (err: any) {
      console.error('Failed to load inference detail:', err)
      setError(err.response?.data?.error || '추론 결과를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleBack = () => {
    navigate('/ai/mg')
  }

  const handleDelete = async () => {
    if (!jobId || !window.confirm('이 추론 결과를 삭제하시겠습니까?')) {
      return
    }

    try {
      await aiApi.deleteInference(jobId)
      navigate('/ai/mg')
    } catch (err: any) {
      console.error('Failed to delete inference:', err)
      alert(err.response?.data?.error || '삭제에 실패했습니다.')
    }
  }

  // PDF 미리보기 열기
  const handleOpenPdfPreview = () => {
    setPdfPreviewOpen(true)
  }

  // PDF 출력 (워터마크 설정 적용)
  const handleExportPDF = async (watermarkConfig: PdfWatermarkConfig) => {
    if (!inferenceDetail || !inferenceDetail.result_data) {
      alert('출력할 데이터가 없습니다.')
      return
    }

    try {
      const { generateMGReportPDF } = await import('@/utils/exportUtils')
      await generateMGReportPDF({
        jobId: inferenceDetail.job_id,
        patientName: inferenceDetail.patient_name,
        patientNumber: inferenceDetail.patient_number,
        createdAt: new Date(inferenceDetail.created_at).toLocaleString('ko-KR'),
        completedAt: inferenceDetail.completed_at ? new Date(inferenceDetail.completed_at).toLocaleString('ko-KR') : undefined,
        grade: inferenceDetail.result_data.grade,
        survival_risk: inferenceDetail.result_data.survival_risk,
        survival_time: inferenceDetail.result_data.survival_time,
        recurrence: inferenceDetail.result_data.recurrence,
        tmz_response: inferenceDetail.result_data.tmz_response,
        top_genes: inferenceDetail.result_data.xai?.top_genes,
        processing_time_ms: inferenceDetail.result_data.processing_time_ms,
        input_genes_count: inferenceDetail.result_data.input_genes_count,
      }, watermarkConfig)
    } catch (err) {
      console.error('PDF 출력 실패:', err)
      alert('PDF 출력에 실패했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      COMPLETED: { className: 'status-badge status-completed', label: '완료' },
      PROCESSING: { className: 'status-badge status-processing', label: '처리중' },
      PENDING: { className: 'status-badge status-pending', label: '대기' },
      FAILED: { className: 'status-badge status-failed', label: '실패' },
    }
    const { className, label } = statusMap[status] || { className: 'status-badge status-pending', label: status }
    return <span className={className}>{label}</span>
  }

  if (loading) {
    return (
      <div className="mg-detail-page">
        <div className="loading-container">
          <div className="spinner mg" />
          <p className="loading-text">데이터 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mg-detail-page">
        <div className="error-container">
          <h4 className="error-title">오류 발생</h4>
          <p className="error-message">{error}</p>
          <button onClick={handleBack} className="btn-back">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (!inferenceDetail) {
    return (
      <div className="mg-detail-page">
        <div className="error-container">
          <h4 className="error-title">결과를 찾을 수 없습니다</h4>
          <button onClick={handleBack} className="btn-back">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="mg-detail-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button onClick={handleBack} className="btn-back-icon">
            ← 뒤로
          </button>
          <div>
            <h2 className="page-title">MG 분석 결과 상세</h2>
            <p className="page-subtitle">Job ID: {jobId}</p>
          </div>
        </div>
        <div className="header-actions">
          {canReview && (
            <button onClick={() => setShowReviewModal(true)} className="btn-review">
              검토하기
            </button>
          )}
          {inferenceDetail.status === 'COMPLETED' && (
            <button onClick={handleOpenPdfPreview} className="btn-pdf">
              PDF 출력
            </button>
          )}
          <button onClick={handleDelete} className="btn-delete">
            삭제
          </button>
        </div>
      </div>

      {/* Job Info */}
      <div className="info-section">
        <div className="info-grid">
          <div className="info-card">
            <h4 className="card-title">요청 정보</h4>
            <dl className="info-list">
              <div className="info-item">
                <dt>Job ID</dt>
                <dd>{inferenceDetail.job_id}</dd>
              </div>
              <div className="info-item">
                <dt>상태</dt>
                <dd>{getStatusBadge(inferenceDetail.status)}</dd>
              </div>
              <div className="info-item">
                <dt>모드</dt>
                <dd>{inferenceDetail.mode === 'auto' ? '자동' : '수동'}</dd>
              </div>
              <div className="info-item">
                <dt>요청일</dt>
                <dd>{new Date(inferenceDetail.created_at).toLocaleString('ko-KR')}</dd>
              </div>
              {inferenceDetail.completed_at && (
                <div className="info-item">
                  <dt>완료일</dt>
                  <dd>{new Date(inferenceDetail.completed_at).toLocaleString('ko-KR')}</dd>
                </div>
              )}
              {aiRequest?.has_result && aiRequest?.result && (
                <div className="info-item">
                  <dt>검토 상태</dt>
                  <dd>
                    <span className={`review-badge review-${aiRequest.result.review_status}`}>
                      {REVIEW_STATUS_LABELS[aiRequest.result.review_status] || aiRequest.result.review_status}
                    </span>
                  </dd>
                </div>
              )}
            </dl>
          </div>
          <div className="info-card">
            <h4 className="card-title">환자 정보</h4>
            <dl className="info-list">
              <div className="info-item">
                <dt>환자명</dt>
                <dd>{inferenceDetail.patient_name || '-'}</dd>
              </div>
              <div className="info-item">
                <dt>환자번호</dt>
                <dd>{inferenceDetail.patient_number || '-'}</dd>
              </div>
              <div className="info-item">
                <dt>OCS ID</dt>
                <dd>{inferenceDetail.gene_ocs || '-'}</dd>
              </div>
            </dl>
          </div>
          {inferenceDetail.result_data && (
            <div className="info-card">
              <h4 className="card-title">처리 정보</h4>
              <dl className="info-list">
                {inferenceDetail.result_data.processing_time_ms && (
                  <div className="info-item">
                    <dt>처리 시간</dt>
                    <dd className="processing-time mg">
                      {(inferenceDetail.result_data.processing_time_ms / 1000).toFixed(2)}초
                    </dd>
                  </div>
                )}
                {inferenceDetail.result_data.input_genes_count && (
                  <div className="info-item">
                    <dt>입력 유전자 수</dt>
                    <dd>{inferenceDetail.result_data.input_genes_count.toLocaleString()}개</dd>
                  </div>
                )}
                {inferenceDetail.result_data.model_version && (
                  <div className="info-item">
                    <dt>모델 버전</dt>
                    <dd>{inferenceDetail.result_data.model_version}</dd>
                  </div>
                )}
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* MG Result Viewer */}
      {inferenceDetail.status === 'COMPLETED' && inferenceDetail.result_data && (
        <div className="section">
          <h3 className="section-title">분석 결과</h3>
          <MGResultViewer result={inferenceDetail.result_data} />
        </div>
      )}

      {/* 시각화 섹션 - 생존 곡선 + 유전자 중요도 */}
      {inferenceDetail.status === 'COMPLETED' && inferenceDetail.result_data && (
        <div className="section">
          <h3 className="section-title">시각화 분석</h3>
          <div className="visualization-grid">
            {/* 생존 곡선 차트 */}
            {survivalChartData.length > 0 && (
              <SurvivalChart
                data={survivalChartData}
                patientRiskGroup={patientRiskGroup}
                patientSurvivalMonths={inferenceDetail.result_data.survival_time?.predicted_months}
                medianSurvival={{ high: 14, medium: 28, low: 48 }}
                height={320}
              />
            )}

            {/* 유전자 중요도 바 차트 */}
            {geneBarChartData.length > 0 && (
              <GeneBarChart
                data={geneBarChartData}
                maxGenes={10}
                title="Top 10 유전자 중요도 (Attention)"
                showDirection={true}
              />
            )}
          </div>
        </div>
      )}

      {/* 유전자 히트맵 & Top Genes - 가로 배치 */}
      {inferenceDetail.status === 'COMPLETED' && (
        <div className="gene-analysis-row">
          {/* 유전자 히트맵 */}
          {heatmapData.genes.length > 0 && (
            <div className="section gene-heatmap-section">
              <h3 className="section-title">유전자 발현 히트맵</h3>
              <GeneHeatmap
                genes={heatmapData.genes}
                samples={heatmapData.samples}
                values={heatmapData.values}
                cellSize={22}
                maxGenes={20}
                maxSamples={10}
              />
            </div>
          )}

          {/* XAI Top Genes */}
          {inferenceDetail.result_data?.xai?.top_genes && (
            <div className="section top-genes-section">
              <h3 className="section-title">주요 유전자 (Top Genes)</h3>
              <div className="top-genes-card">
                <table className="top-genes-table">
                  <thead>
                    <tr>
                      <th>순위</th>
                      <th>유전자</th>
                      <th>Attention Score</th>
                      <th>Expression Z-Score</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inferenceDetail.result_data.xai.top_genes.slice(0, 20).map((gene) => (
                      <tr key={gene.rank}>
                        <td>{gene.rank}</td>
                        <td className="gene-name">{gene.gene}</td>
                        <td>
                          <div className="score-bar-container">
                            <div
                              className="score-bar attention"
                              style={{ width: `${gene.attention_score * 100}%` }}
                            />
                            <span className="score-value">{gene.attention_score.toFixed(4)}</span>
                          </div>
                        </td>
                        <td>
                          <span className={`zscore ${gene.expression_zscore > 0 ? 'positive' : 'negative'}`}>
                            {gene.expression_zscore > 0 ? '+' : ''}{gene.expression_zscore.toFixed(2)}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Error Message */}
      {inferenceDetail.status === 'FAILED' && inferenceDetail.error_message && (
        <div className="section">
          <h3 className="section-title">오류 정보</h3>
          <div className="error-container">
            <p className="error-message">{inferenceDetail.error_message}</p>
          </div>
        </div>
      )}

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="MG 유전자 분석 PDF 미리보기"
      >
        {inferenceDetail && inferenceDetail.result_data && (
          <DocumentPreview
            title="MG 유전자 AI 분석 보고서"
            subtitle="RNA-seq 기반 뇌종양 유전자 분석 결과"
            infoGrid={[
              { label: 'Job ID', value: inferenceDetail.job_id },
              { label: '환자번호', value: inferenceDetail.patient_number },
              { label: '환자명', value: inferenceDetail.patient_name },
              { label: '요청일시', value: new Date(inferenceDetail.created_at).toLocaleString('ko-KR') },
              { label: '완료일시', value: inferenceDetail.completed_at ? new Date(inferenceDetail.completed_at).toLocaleString('ko-KR') : undefined },
              { label: '입력 유전자 수', value: inferenceDetail.result_data.input_genes_count ? `${inferenceDetail.result_data.input_genes_count}개` : undefined },
            ]}
            sections={[
              {
                type: 'result-boxes',
                title: 'AI 분석 결과',
                items: [
                  ...(inferenceDetail.result_data.survival_risk ? [{
                    title: '생존 위험도',
                    value: inferenceDetail.result_data.survival_risk.risk_category || '-',
                    subText: `위험 점수: ${inferenceDetail.result_data.survival_risk.risk_score.toFixed(3)}${inferenceDetail.result_data.survival_risk.risk_percentile ? ` (상위 ${inferenceDetail.result_data.survival_risk.risk_percentile}%)` : ''}`,
                    variant: getRiskVariant(inferenceDetail.result_data.survival_risk.risk_category),
                  }] : []),
                  ...(inferenceDetail.result_data.survival_time ? [{
                    title: '예상 생존 기간',
                    value: `${inferenceDetail.result_data.survival_time.predicted_months} 개월`,
                    subText: inferenceDetail.result_data.survival_time.confidence_interval ? `95% 신뢰구간: ${inferenceDetail.result_data.survival_time.confidence_interval.lower} - ${inferenceDetail.result_data.survival_time.confidence_interval.upper} 개월` : undefined,
                    variant: 'default' as const,
                  }] : []),
                  ...(inferenceDetail.result_data.grade ? [{
                    title: '종양 등급 예측',
                    value: inferenceDetail.result_data.grade.predicted_class,
                    subText: `신뢰도: ${formatConfidence(inferenceDetail.result_data.grade.probability)}`,
                    variant: 'default' as const,
                  }] : []),
                  ...(inferenceDetail.result_data.recurrence ? [{
                    title: '재발 위험도',
                    value: inferenceDetail.result_data.recurrence.predicted_class || '-',
                    subText: `재발 확률: ${formatConfidence(inferenceDetail.result_data.recurrence.probability)}`,
                    variant: getRiskVariant(inferenceDetail.result_data.recurrence.predicted_class),
                  }] : []),
                  ...(inferenceDetail.result_data.tmz_response ? [{
                    title: 'Temozolomide 반응 예측',
                    value: inferenceDetail.result_data.tmz_response.predicted_class,
                    subText: `신뢰도: ${formatConfidence(inferenceDetail.result_data.tmz_response.probability)}`,
                    variant: 'default' as const,
                  }] : []),
                ],
              },
              ...(inferenceDetail.result_data.xai?.top_genes && inferenceDetail.result_data.xai.top_genes.length > 0 ? [{
                type: 'table' as const,
                title: `주요 유전자 (Top ${Math.min(10, inferenceDetail.result_data.xai.top_genes.length)})`,
                columns: ['순위', '유전자명', '중요도'],
                rows: inferenceDetail.result_data.xai.top_genes.slice(0, 10).map((gene: any, idx: number) => ({
                  '순위': idx + 1,
                  '유전자명': gene.gene,
                  '중요도': gene.attention_score.toFixed(4),
                })),
              }] : []),
              {
                type: 'text',
                title: '주의 사항',
                content: '본 AI 분석 결과는 의료진의 진단을 보조하기 위한 참고 자료입니다. 최종 진단 및 치료 결정은 반드시 전문 의료진의 판단에 따라 이루어져야 합니다.',
                variant: 'warning',
              },
            ]}
          />
        )}
      </PdfPreviewModal>

      {/* Review Modal */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content review-modal" onClick={(e) => e.stopPropagation()}>
            <h3>결과 검토</h3>
            <div className="review-options">
              <button
                className={`review-option ${reviewStatus === 'approved' ? 'selected' : ''}`}
                onClick={() => setReviewStatus('approved')}
              >
                <span className="icon icon-approve">✓</span>
                <span>승인</span>
              </button>
              <button
                className={`review-option ${reviewStatus === 'rejected' ? 'selected' : ''}`}
                onClick={() => setReviewStatus('rejected')}
              >
                <span className="icon icon-reject">✗</span>
                <span>반려</span>
              </button>
            </div>
            <div className="review-comment-input">
              <label>검토 의견 (선택)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="검토 의견을 입력하세요..."
                rows={3}
              />
            </div>
            <div className="modal-actions">
              <button className="btn btn-secondary" onClick={() => setShowReviewModal(false)}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleReviewSubmit}>
                제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast Container */}
      <toast.ToastContainer position="top-right" />
    </div>
  )
}
