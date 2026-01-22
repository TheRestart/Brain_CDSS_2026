import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import MMResultViewer from '@/components/MMResultViewer'
import {
  ModalityRadarChart,
  AttentionMapViewer,
  SurvivalChart,
  GeneBarChart,
  TumorTrendChart,
} from '@/components/ai'
import { aiApi } from '@/services/ai.api'
import { useAIRequestDetail } from '@/hooks'
import { useThumbnailCache } from '@/context/ThumbnailCacheContext'
import { useToast } from '@/components/common'
import PdfPreviewModal from '@/components/PdfPreviewModal'
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api'
import {
  DocumentPreview,
  formatConfidence,
  getGradeVariant,
} from '@/components/pdf-preview'
import './MMDetailPage.css'

// 검토 상태 라벨
const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '반려됨',
}

interface MMResult {
  patient_id?: string
  // 멀티모달 통합 결과
  integrated_prediction?: {
    grade: {
      predicted_class: string
      probability: number
      probabilities?: Record<string, number>
    }
    survival_risk?: {
      risk_score: number
      risk_category?: string
      risk_percentile?: number
    }
    survival_time?: {
      predicted_days: number
      predicted_months: number
      confidence_interval?: { lower: number; upper: number }
    }
  }
  // 모달리티별 기여도
  modality_contributions?: {
    mri?: { weight: number; confidence: number }
    gene?: { weight: number; confidence: number }
    protein?: { weight: number; confidence: number }
  }
  // 개별 모달리티 결과
  mri_result?: {
    grade?: { predicted_class: string; probability: number }
    segmentation_available?: boolean
  }
  gene_result?: {
    grade?: { predicted_class: string; probability: number }
    top_genes_count?: number
  }
  protein_result?: {
    grade?: { predicted_class: string; probability: number }
    markers_analyzed?: number
  }
  // XAI
  xai?: {
    integrated_attention?: {
      mri_regions?: Array<{ region: string; attention: number }>
      top_genes?: Array<{ gene: string; attention: number }>
      key_proteins?: Array<{ protein: string; attention: number }>
    }
    cross_modal_correlations?: Array<{
      modality_pair: string
      correlation: number
      significance: number
    }>
  }
  // 생존 곡선 데이터 (B 컴포넌트 통합용)
  survival_curve?: {
    data: Array<{ time: number; high: number; medium: number; low: number }>
    patient_risk_group?: 'high' | 'medium' | 'low'
    median_survival?: { high: number; medium: number; low: number }
  }
  // 유전자 중요도 데이터 (B 컴포넌트 통합용)
  gene_importance?: Array<{
    name: string
    importance: number
    direction?: 'up' | 'down'
    expressionZscore?: number
  }>
  // 종양 부피 이력 데이터 (A 컴포넌트 통합용)
  tumor_history?: Array<{
    date: string
    wt: number
    tc: number
    et: number
    jobId?: string
  }>
  processing_time_ms?: number
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
  mri_ocs: number | null
  gene_ocs: number | null
  protein_ocs: number | null
  result_data: MMResult | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export default function MMDetailPage() {
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
    navigate('/ai/mm')
  }

  const handleDelete = async () => {
    if (!jobId || !window.confirm('이 추론 결과를 삭제하시겠습니까?')) {
      return
    }

    try {
      await aiApi.deleteInference(jobId)
      navigate('/ai/mm')
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
      const { generateMMReportPDF } = await import('@/utils/exportUtils')
      await generateMMReportPDF({
        jobId: inferenceDetail.job_id,
        patientName: inferenceDetail.patient_name,
        patientNumber: inferenceDetail.patient_number,
        createdAt: new Date(inferenceDetail.created_at).toLocaleString('ko-KR'),
        completedAt: inferenceDetail.completed_at ? new Date(inferenceDetail.completed_at).toLocaleString('ko-KR') : undefined,
        modalities: {
          mri: !!inferenceDetail.mri_ocs,
          gene: !!inferenceDetail.gene_ocs,
          protein: !!inferenceDetail.protein_ocs,
        },
        integrated_prediction: inferenceDetail.result_data.integrated_prediction,
        modality_contributions: inferenceDetail.result_data.modality_contributions,
        processing_time_ms: inferenceDetail.result_data.processing_time_ms,
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

  const getModalityCount = () => {
    if (!inferenceDetail) return 0
    let count = 0
    if (inferenceDetail.mri_ocs) count++
    if (inferenceDetail.gene_ocs) count++
    if (inferenceDetail.protein_ocs) count++
    return count
  }

  const getModalityBadges = () => {
    if (!inferenceDetail) return null
    return (
      <div className="modality-badges">
        {inferenceDetail.mri_ocs && <span className="modality-badge mri">MRI</span>}
        {inferenceDetail.gene_ocs && <span className="modality-badge gene">Gene</span>}
        {inferenceDetail.protein_ocs && <span className="modality-badge protein">Protein</span>}
      </div>
    )
  }

  if (loading) {
    return (
      <div className="mm-detail-page">
        <div className="loading-container">
          <div className="spinner mm" />
          <p className="loading-text">데이터 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="mm-detail-page">
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
      <div className="mm-detail-page">
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
    <div className="mm-detail-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <button onClick={handleBack} className="btn-back-icon">
            ← 뒤로
          </button>
          <div>
            <h2 className="page-title">MM 분석 결과 상세</h2>
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
            </dl>
          </div>

          <div className="info-card">
            <h4 className="card-title">멀티모달 정보</h4>
            <dl className="info-list">
              <div className="info-item">
                <dt>사용 모달리티</dt>
                <dd>{getModalityBadges()}</dd>
              </div>
              <div className="info-item">
                <dt>모달리티 수</dt>
                <dd>{getModalityCount()}개</dd>
              </div>
              {inferenceDetail.mri_ocs && (
                <div className="info-item">
                  <dt>MRI OCS</dt>
                  <dd>{inferenceDetail.mri_ocs}</dd>
                </div>
              )}
              {inferenceDetail.gene_ocs && (
                <div className="info-item">
                  <dt>Gene OCS</dt>
                  <dd>{inferenceDetail.gene_ocs}</dd>
                </div>
              )}
              {inferenceDetail.protein_ocs && (
                <div className="info-item">
                  <dt>Protein OCS</dt>
                  <dd>{inferenceDetail.protein_ocs}</dd>
                </div>
              )}
            </dl>
          </div>

          {inferenceDetail.result_data && (
            <div className="info-card">
              <h4 className="card-title">처리 정보</h4>
              <dl className="info-list">
                {inferenceDetail.result_data.processing_time_ms && (
                  <div className="info-item">
                    <dt>처리 시간</dt>
                    <dd className="processing-time mm">
                      {(inferenceDetail.result_data.processing_time_ms / 1000).toFixed(2)}초
                    </dd>
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

      {/* MM Result Viewer */}
      {inferenceDetail.status === 'COMPLETED' && inferenceDetail.result_data && (
        <div className="section">
          <h3 className="section-title">통합 분석 결과</h3>
          <MMResultViewer result={inferenceDetail.result_data} />
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

      {/* Modality Contributions */}
      {inferenceDetail.result_data?.modality_contributions && (
        <div className="section">
          <h3 className="section-title">모달리티 기여도</h3>
          <div className="contributions-layout">
            {/* Radar Chart */}
            <div className="contributions-radar">
              <ModalityRadarChart
                data={inferenceDetail.result_data.modality_contributions}
                title="기여도 레이더"
              />
            </div>

            {/* Bar Chart (기존) */}
            <div className="contributions-card">
              <h4 className="contributions-card__title">상세 기여도</h4>
              <div className="contributions-grid">
                {inferenceDetail.result_data.modality_contributions.mri && (
                  <div className="contribution-item mri">
                    <div className="contribution-header">
                      <span className="modality-icon">🧠</span>
                      <span className="modality-name">MRI</span>
                    </div>
                    <div className="contribution-bar-container">
                      <div
                        className="contribution-bar mri"
                        style={{ width: `${inferenceDetail.result_data.modality_contributions.mri.weight * 100}%` }}
                      />
                    </div>
                    <div className="contribution-values">
                      <span>가중치: {(inferenceDetail.result_data.modality_contributions.mri.weight * 100).toFixed(1)}%</span>
                      <span>신뢰도: {(inferenceDetail.result_data.modality_contributions.mri.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
                {inferenceDetail.result_data.modality_contributions.gene && (
                  <div className="contribution-item gene">
                    <div className="contribution-header">
                      <span className="modality-icon">🧬</span>
                      <span className="modality-name">Gene</span>
                    </div>
                    <div className="contribution-bar-container">
                      <div
                        className="contribution-bar gene"
                        style={{ width: `${inferenceDetail.result_data.modality_contributions.gene.weight * 100}%` }}
                      />
                    </div>
                    <div className="contribution-values">
                      <span>가중치: {(inferenceDetail.result_data.modality_contributions.gene.weight * 100).toFixed(1)}%</span>
                      <span>신뢰도: {(inferenceDetail.result_data.modality_contributions.gene.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
                {inferenceDetail.result_data.modality_contributions.protein && (
                  <div className="contribution-item protein">
                    <div className="contribution-header">
                      <span className="modality-icon">🔬</span>
                      <span className="modality-name">Protein</span>
                    </div>
                    <div className="contribution-bar-container">
                      <div
                        className="contribution-bar protein"
                        style={{ width: `${inferenceDetail.result_data.modality_contributions.protein.weight * 100}%` }}
                      />
                    </div>
                    <div className="contribution-values">
                      <span>가중치: {(inferenceDetail.result_data.modality_contributions.protein.weight * 100).toFixed(1)}%</span>
                      <span>신뢰도: {(inferenceDetail.result_data.modality_contributions.protein.confidence * 100).toFixed(1)}%</span>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* XAI: Attention Map Viewer */}
      {inferenceDetail.result_data?.xai && (
        <div className="section">
          <h3 className="section-title">XAI 분석 (Explainable AI)</h3>
          <AttentionMapViewer
            integratedAttention={inferenceDetail.result_data.xai.integrated_attention}
            crossModalCorrelations={inferenceDetail.result_data.xai.cross_modal_correlations}
          />
        </div>
      )}

      {/* Survival & Gene Analysis (B 컴포넌트 통합) */}
      {(inferenceDetail.result_data?.survival_curve || inferenceDetail.result_data?.gene_importance) && (
        <div className="section">
          <h3 className="section-title">생존 및 유전자 분석</h3>
          <div className="mm-analysis-grid">
            {/* 생존 곡선 */}
            {inferenceDetail.result_data.survival_curve && (
              <div className="mm-analysis-card">
                <SurvivalChart
                  data={inferenceDetail.result_data.survival_curve.data}
                  patientRiskGroup={inferenceDetail.result_data.survival_curve.patient_risk_group}
                  patientSurvivalMonths={inferenceDetail.result_data.integrated_prediction?.survival_time?.predicted_months}
                  medianSurvival={inferenceDetail.result_data.survival_curve.median_survival}
                  height={300}
                />
              </div>
            )}

            {/* 유전자 중요도 */}
            {inferenceDetail.result_data.gene_importance && inferenceDetail.result_data.gene_importance.length > 0 && (
              <div className="mm-analysis-card">
                <GeneBarChart
                  data={inferenceDetail.result_data.gene_importance}
                  maxGenes={10}
                  title="주요 유전자 기여도"
                  showDirection={true}
                />
              </div>
            )}
          </div>
        </div>
      )}

      {/* Tumor Volume Trend (A 컴포넌트 통합) */}
      {inferenceDetail.result_data?.tumor_history && inferenceDetail.result_data.tumor_history.length > 0 && (
        <div className="section">
          <h3 className="section-title">종양 부피 변화</h3>
          <div className="mm-tumor-trend-card">
            <TumorTrendChart
              data={inferenceDetail.result_data.tumor_history}
              showTitle={false}
              height={280}
            />
          </div>
        </div>
      )}

      {/* Individual Modality Results */}
      {inferenceDetail.result_data && (
        <div className="section">
          <h3 className="section-title">개별 모달리티 결과</h3>
          <div className="individual-results-grid">
            {inferenceDetail.result_data.mri_result && (
              <div className="individual-result-card mri">
                <div className="result-header">
                  <span className="result-icon">🧠</span>
                  <h4>MRI 분석</h4>
                </div>
                {inferenceDetail.result_data.mri_result.grade && (
                  <div className="result-content">
                    <div className="result-item">
                      <span className="label">Grade 예측:</span>
                      <span className="value">{inferenceDetail.result_data.mri_result.grade.predicted_class}</span>
                    </div>
                    <div className="result-item">
                      <span className="label">확률:</span>
                      <span className="value">{(inferenceDetail.result_data.mri_result.grade.probability * 100).toFixed(1)}%</span>
                    </div>
                    {inferenceDetail.result_data.mri_result.segmentation_available && (
                      <div className="result-item">
                        <span className="label">세그멘테이션:</span>
                        <span className="value available">가능</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {inferenceDetail.result_data.gene_result && (
              <div className="individual-result-card gene">
                <div className="result-header">
                  <span className="result-icon">🧬</span>
                  <h4>Gene 분석</h4>
                </div>
                {inferenceDetail.result_data.gene_result.grade && (
                  <div className="result-content">
                    <div className="result-item">
                      <span className="label">Grade 예측:</span>
                      <span className="value">{inferenceDetail.result_data.gene_result.grade.predicted_class}</span>
                    </div>
                    <div className="result-item">
                      <span className="label">확률:</span>
                      <span className="value">{(inferenceDetail.result_data.gene_result.grade.probability * 100).toFixed(1)}%</span>
                    </div>
                    {inferenceDetail.result_data.gene_result.top_genes_count && (
                      <div className="result-item">
                        <span className="label">주요 유전자:</span>
                        <span className="value">{inferenceDetail.result_data.gene_result.top_genes_count}개</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            {inferenceDetail.result_data.protein_result && (
              <div className="individual-result-card protein">
                <div className="result-header">
                  <span className="result-icon">🔬</span>
                  <h4>Protein 분석</h4>
                </div>
                {inferenceDetail.result_data.protein_result.grade && (
                  <div className="result-content">
                    <div className="result-item">
                      <span className="label">Grade 예측:</span>
                      <span className="value">{inferenceDetail.result_data.protein_result.grade.predicted_class}</span>
                    </div>
                    <div className="result-item">
                      <span className="label">확률:</span>
                      <span className="value">{(inferenceDetail.result_data.protein_result.grade.probability * 100).toFixed(1)}%</span>
                    </div>
                    {inferenceDetail.result_data.protein_result.markers_analyzed && (
                      <div className="result-item">
                        <span className="label">분석 마커:</span>
                        <span className="value">{inferenceDetail.result_data.protein_result.markers_analyzed}개</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="MM 멀티모달 분석 PDF 미리보기"
      >
        {inferenceDetail && inferenceDetail.result_data && (() => {
          const result = inferenceDetail.result_data;
          const integrated = result.integrated_prediction;
          const modalities = {
            mri: !!inferenceDetail.mri_ocs,
            gene: !!inferenceDetail.gene_ocs,
            protein: !!inferenceDetail.protein_ocs,
          };
          const modalityLabels = [
            modalities.mri && 'MRI',
            modalities.gene && 'Gene',
            modalities.protein && 'Protein',
          ].filter(Boolean).join(', ');

          return (
            <DocumentPreview
              title="멀티모달 (MM) 분석 보고서"
              subtitle={`Job ID: ${inferenceDetail.job_id}`}
              infoGrid={[
                { label: '환자번호', value: inferenceDetail.patient_number || '-' },
                { label: '환자명', value: inferenceDetail.patient_name || '-' },
                { label: '분석 모달리티', value: modalityLabels },
                { label: '요청일시', value: new Date(inferenceDetail.created_at).toLocaleString('ko-KR') },
                { label: '완료일시', value: inferenceDetail.completed_at ? new Date(inferenceDetail.completed_at).toLocaleString('ko-KR') : '-' },
                { label: '처리시간', value: result.processing_time_ms ? `${(result.processing_time_ms / 1000).toFixed(2)}초` : '-' },
              ]}
              sections={[
                // 통합 예측 결과
                ...(integrated ? [{
                  type: 'result-boxes' as const,
                  title: '통합 예측 결과',
                  items: [
                    {
                      title: 'Grade 예측',
                      value: integrated.grade?.predicted_class || '-',
                      subText: `신뢰도: ${formatConfidence(integrated.grade?.probability)}`,
                      variant: getGradeVariant(integrated.grade?.predicted_class),
                    },
                    ...(integrated.survival_risk ? [{
                      title: '생존 위험도',
                      value: integrated.survival_risk.risk_category || `Score: ${integrated.survival_risk.risk_score?.toFixed(2)}`,
                      subText: integrated.survival_risk.risk_percentile
                        ? `상위 ${integrated.survival_risk.risk_percentile}%`
                        : undefined,
                      variant: (['high', 'High'].includes(integrated.survival_risk.risk_category || '')
                        ? 'danger'
                        : ['medium', 'Medium', 'intermediate', 'Intermediate'].includes(integrated.survival_risk.risk_category || '')
                          ? 'warning'
                          : 'default') as 'default' | 'warning' | 'danger',
                    }] : []),
                    ...(integrated.survival_time ? [{
                      title: '예측 생존 기간',
                      value: `${integrated.survival_time.predicted_months?.toFixed(1) || '-'} 개월`,
                      subText: integrated.survival_time.confidence_interval
                        ? `(${integrated.survival_time.confidence_interval.lower} - ${integrated.survival_time.confidence_interval.upper}개월)`
                        : undefined,
                    }] : []),
                  ],
                }] : []),
                // 모달리티 기여도
                ...(result.modality_contributions ? [{
                  type: 'table' as const,
                  title: '모달리티 기여도',
                  columns: ['모달리티', '가중치', '신뢰도'],
                  rows: [
                    ...(result.modality_contributions.mri ? [{
                      '모달리티': 'MRI',
                      '가중치': `${(result.modality_contributions.mri.weight * 100).toFixed(1)}%`,
                      '신뢰도': `${(result.modality_contributions.mri.confidence * 100).toFixed(1)}%`,
                    }] : []),
                    ...(result.modality_contributions.gene ? [{
                      '모달리티': 'Gene',
                      '가중치': `${(result.modality_contributions.gene.weight * 100).toFixed(1)}%`,
                      '신뢰도': `${(result.modality_contributions.gene.confidence * 100).toFixed(1)}%`,
                    }] : []),
                    ...(result.modality_contributions.protein ? [{
                      '모달리티': 'Protein',
                      '가중치': `${(result.modality_contributions.protein.weight * 100).toFixed(1)}%`,
                      '신뢰도': `${(result.modality_contributions.protein.confidence * 100).toFixed(1)}%`,
                    }] : []),
                  ],
                }] : []),
                // 개별 모달리티 결과
                ...((result.mri_result || result.gene_result || result.protein_result) ? [{
                  type: 'table' as const,
                  title: '개별 모달리티 결과',
                  columns: ['모달리티', 'Grade 예측', '확률', '비고'],
                  rows: [
                    ...(result.mri_result?.grade ? [{
                      '모달리티': 'MRI',
                      'Grade 예측': result.mri_result.grade.predicted_class,
                      '확률': `${(result.mri_result.grade.probability * 100).toFixed(1)}%`,
                      '비고': result.mri_result.segmentation_available ? '세그멘테이션 가능' : '-',
                    }] : []),
                    ...(result.gene_result?.grade ? [{
                      '모달리티': 'Gene',
                      'Grade 예측': result.gene_result.grade.predicted_class,
                      '확률': `${(result.gene_result.grade.probability * 100).toFixed(1)}%`,
                      '비고': result.gene_result.top_genes_count ? `주요 유전자 ${result.gene_result.top_genes_count}개` : '-',
                    }] : []),
                    ...(result.protein_result?.grade ? [{
                      '모달리티': 'Protein',
                      'Grade 예측': result.protein_result.grade.predicted_class,
                      '확률': `${(result.protein_result.grade.probability * 100).toFixed(1)}%`,
                      '비고': result.protein_result.markers_analyzed ? `분석 마커 ${result.protein_result.markers_analyzed}개` : '-',
                    }] : []),
                  ],
                }] : []),
              ]}
              signature={{ label: '분석 담당', name: 'AI System' }}
            />
          );
        })()}
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
