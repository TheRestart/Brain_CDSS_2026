import { useState, useEffect, useCallback } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import { InferenceResult } from '@/components/InferenceResult'
import SegMRIViewer, { type SegmentationData, type CompareResult } from '@/components/ai/SegMRIViewer'
import { aiApi, getPatientAIHistory, type AIInferenceRequest } from '@/services/ai.api'
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
import './M1DetailPage.css'

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api'

// 채널별 색상
const CHANNEL_COLORS: Record<string, string> = {
  T1: '#3b82f6',    // 파랑
  T1C: '#ef4444',   // 빨강
  T2: '#10b981',    // 초록
  FLAIR: '#f59e0b', // 주황
}

interface M1Result {
  grade?: {
    predicted_class: string
    probability: number
    probabilities?: Record<string, number>
  }
  idh?: {
    predicted_class: string
    mutant_probability?: number
  }
  mgmt?: {
    predicted_class: string
    methylated_probability?: number
  }
  survival?: {
    risk_score: number
    risk_category: string
  }
  os_days?: {
    predicted_days: number
    predicted_months: number
  }
  processing_time_ms?: number
}

// MRI 썸네일 채널 정보
interface MRIThumbnail {
  channel: 'T1' | 'T1C' | 'T2' | 'FLAIR'
  url: string
  description: string
}

interface InferenceDetail {
  id: number
  job_id: string
  model_type: string
  status: string
  mode: string
  patient: number | null  // 환자 ID (비교 기능용)
  patient_name: string
  patient_number: string
  mri_ocs: number | null
  result_data: M1Result | null
  error_message: string | null
  created_at: string
  completed_at: string | null
  mri_thumbnails?: MRIThumbnail[] | null
}

// 검토 상태 라벨
const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '반려됨',
}

export default function M1DetailPage() {
  const { jobId } = useParams<{ jobId: string }>()
  const navigate = useNavigate()
  const { markAsCached } = useThumbnailCache()
  const toast = useToast()

  // State
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [inferenceDetail, setInferenceDetail] = useState<InferenceDetail | null>(null)

  // 세그멘테이션 뷰어
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null)
  const [loadingSegmentation, setLoadingSegmentation] = useState(false)
  const [segmentationError, setSegmentationError] = useState<string>('')

  // PDF 미리보기 모달
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false)

  // 동일 환자의 다른 M1 결과 (비교 기능용)
  const [otherM1Results, setOtherM1Results] = useState<AIInferenceRequest[]>([])
  const [loadingOtherResults, setLoadingOtherResults] = useState(false)

  // 검토 기능 (useAIRequestDetail 훅 사용)
  const { request: aiRequest, review } = useAIRequestDetail(jobId ?? null)
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved')
  const [reviewComment, setReviewComment] = useState('')

  // 검토 가능 여부
  const canReview = aiRequest?.has_result && aiRequest?.result?.review_status === 'pending'

  // 검토 제출
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

  // 동일 환자의 다른 M1 결과 조회
  useEffect(() => {
    const loadOtherResults = async () => {
      if (!inferenceDetail?.patient) return

      setLoadingOtherResults(true)
      try {
        const history = await getPatientAIHistory(inferenceDetail.patient, 'M1')
        // 현재 결과를 제외한 다른 결과만 필터링
        const others = history.filter(
          (item) => item.request_id !== inferenceDetail.job_id
        )
        setOtherM1Results(others)
      } catch (err) {
        console.error('Failed to load other M1 results:', err)
      } finally {
        setLoadingOtherResults(false)
      }
    }

    loadOtherResults()
  }, [inferenceDetail?.patient, inferenceDetail?.job_id])

  const loadInferenceDetail = async (id: string) => {
    try {
      setLoading(true)
      setError('')
      const data = await aiApi.getInferenceDetail(id)
      setInferenceDetail(data)

      // 완료된 경우 세그멘테이션 데이터 로드
      if (data.status === 'COMPLETED') {
        loadSegmentationData(id)
      }
    } catch (err: any) {
      console.error('Failed to load inference detail:', err)
      setError(err.response?.data?.error || '추론 결과를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadSegmentationData = async (jobIdToLoad: string) => {
    try {
      setLoadingSegmentation(true)
      setSegmentationError('')
      setSegmentationData(null)

      const data = await aiApi.getSegmentationData(jobIdToLoad)

      const segData: SegmentationData = {
        mri: data.mri,
        groundTruth: data.groundTruth || data.prediction,
        prediction: data.prediction,
        shape: data.shape as [number, number, number],
        mri_channels: data.mri_channels,
      }

      setSegmentationData(segData)
    } catch (err: any) {
      console.error('Failed to load segmentation data:', err)
      setSegmentationError(
        err.response?.data?.error || '세그멘테이션 데이터를 불러오는데 실패했습니다.'
      )
    } finally {
      setLoadingSegmentation(false)
    }
  }

  // Compare 데이터 로드 (GT vs Prediction)
  const loadCompareData = async (): Promise<CompareResult | null> => {
    if (!jobId) return null

    try {
      const data = await aiApi.getSegmentationCompareData(jobId)

      if (!data.has_ground_truth || data.orthanc_seg_status !== 'loaded') {
        alert(
          data.orthanc_seg_status === 'no_ocs'
            ? 'OCS 연결 정보가 없어 GT 비교를 할 수 없습니다.'
            : 'Ground Truth SEG 데이터를 찾을 수 없습니다.'
        )
        return null
      }

      return {
        groundTruth: data.ground_truth!,
        diceScores: data.comparison_metrics
          ? {
              wt: data.comparison_metrics.dice_wt,
              tc: data.comparison_metrics.dice_tc,
              et: data.comparison_metrics.dice_et,
            }
          : undefined,
      }
    } catch (err) {
      console.error('Compare data load failed:', err)
      alert('GT 비교 데이터 로드에 실패했습니다.')
      return null
    }
  }

  const handleBack = () => {
    navigate('/ai/m1')
  }

  const handleDelete = async () => {
    if (!jobId || !window.confirm('이 추론 결과를 삭제하시겠습니까?')) {
      return
    }

    try {
      await aiApi.deleteInference(jobId)
      navigate('/ai/m1')
    } catch (err: any) {
      console.error('Failed to delete inference:', err)
      alert(err.response?.data?.error || '삭제에 실패했습니다.')
    }
  }

  // 이미지 URL을 Base64로 변환하는 헬퍼 함수
  const fetchImageAsBase64 = async (url: string): Promise<string | null> => {
    try {
      console.log('[M1 PDF] 썸네일 이미지 로딩:', url)
      const response = await fetch(url, { credentials: 'include' })
      if (!response.ok) {
        console.warn(`[M1 PDF] 이미지 로드 실패 (HTTP ${response.status}):`, url)
        return null
      }
      const blob = await response.blob()
      return new Promise((resolve) => {
        const reader = new FileReader()
        reader.onloadend = () => {
          console.log('[M1 PDF] 이미지 Base64 변환 완료:', url.slice(-30))
          resolve(reader.result as string)
        }
        reader.onerror = () => {
          console.error('[M1 PDF] FileReader 오류:', url)
          resolve(null)
        }
        reader.readAsDataURL(blob)
      })
    } catch (e) {
      console.error('[M1 PDF] 이미지 fetch 실패:', url, e)
      return null
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

    console.log('[M1 PDF] PDF 출력 시작, Job ID:', inferenceDetail.job_id)

    try {
      const { generateM1ReportPDF } = await import('@/utils/exportUtils')

      // MRI 썸네일을 Base64로 변환 (CORS 문제 방지)
      let mriThumbnails: Array<{ channel: string; url: string; description?: string }> | undefined
      let thumbnailLoadErrors: string[] = []

      if (inferenceDetail.mri_thumbnails && inferenceDetail.mri_thumbnails.length > 0) {
        console.log('[M1 PDF] MRI 썸네일 로딩 시작, 개수:', inferenceDetail.mri_thumbnails.length)

        const thumbnailPromises = inferenceDetail.mri_thumbnails.map(async (thumb) => {
          const fullUrl = `${API_BASE_URL}${thumb.url.startsWith('/api/') ? thumb.url.slice(4) : thumb.url}`
          const base64 = await fetchImageAsBase64(fullUrl)
          if (base64) {
            return {
              channel: thumb.channel,
              url: base64,
              description: thumb.description,
            }
          }
          thumbnailLoadErrors.push(thumb.channel)
          return null
        })

        const results = await Promise.all(thumbnailPromises)
        const validThumbnails = results.filter((t): t is NonNullable<typeof t> => t !== null)

        console.log(`[M1 PDF] 썸네일 로딩 완료: ${validThumbnails.length}/${inferenceDetail.mri_thumbnails.length}개 성공`)

        if (thumbnailLoadErrors.length > 0) {
          console.warn('[M1 PDF] 썸네일 로딩 실패 채널:', thumbnailLoadErrors.join(', '))
        }

        if (validThumbnails.length > 0) {
          mriThumbnails = validThumbnails
        }
      } else {
        console.log('[M1 PDF] MRI 썸네일 데이터 없음')
      }

      console.log('[M1 PDF] PDF 생성 중...')

      await generateM1ReportPDF({
        jobId: inferenceDetail.job_id,
        patientName: inferenceDetail.patient_name,
        patientNumber: inferenceDetail.patient_number,
        createdAt: new Date(inferenceDetail.created_at).toLocaleString('ko-KR'),
        completedAt: inferenceDetail.completed_at ? new Date(inferenceDetail.completed_at).toLocaleString('ko-KR') : undefined,
        grade: inferenceDetail.result_data.grade,
        idh: inferenceDetail.result_data.idh,
        mgmt: inferenceDetail.result_data.mgmt,
        survival: inferenceDetail.result_data.survival,
        os_days: inferenceDetail.result_data.os_days,
        processing_time_ms: inferenceDetail.result_data.processing_time_ms,
        mri_thumbnails: mriThumbnails,
      }, watermarkConfig)

      console.log('[M1 PDF] PDF 출력 완료')

      // 썸네일 일부 실패 시 사용자에게 알림
      if (thumbnailLoadErrors.length > 0) {
        alert(`PDF가 생성되었습니다.\n(일부 MRI 이미지 로딩 실패: ${thumbnailLoadErrors.join(', ')})`)
      }
    } catch (err: any) {
      const errorMsg = err?.message || String(err)
      console.error('[M1 PDF] PDF 출력 실패:', errorMsg, err)
      alert(`PDF 출력에 실패했습니다.\n\n오류: ${errorMsg}`)
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
      <div className="m1-detail-page">
        <div className="loading-container">
          <div className="spinner" />
          <p className="loading-text">데이터 로딩 중...</p>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="m1-detail-page">
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
      <div className="m1-detail-page">
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
    <div className="m1-detail-page">
      {/* Header */}
      <div className="page-header">
        <div className="header-left">
          <div>
            <h2 className="page-title">M1 분석 결과 상세</h2>
            <p className="page-subtitle">Job ID: {jobId}</p>
          </div>
        </div>
        <div className="header-actions">
          {canReview && (
            <button onClick={() => setShowReviewModal(true)} className="btn-review">
              결과 검토
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
              {aiRequest?.result && (
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
                <dd>{inferenceDetail.mri_ocs || '-'}</dd>
              </div>
            </dl>
          </div>
          {inferenceDetail.result_data?.processing_time_ms && (
            <div className="info-card">
              <h4 className="card-title">처리 정보</h4>
              <dl className="info-list">
                <div className="info-item">
                  <dt>처리 시간</dt>
                  <dd className="processing-time">
                    {(inferenceDetail.result_data.processing_time_ms / 1000).toFixed(2)}초
                  </dd>
                </div>
                <div className="info-item">
                  <dt>모델 버전</dt>
                  <dd>M1-v2.1.0</dd>
                </div>
              </dl>
            </div>
          )}
        </div>
      </div>

      {/* MRI Thumbnails */}
      {inferenceDetail.status === 'COMPLETED' && (
        <div className="section">
          <h3 className="section-title">MRI 이미지 미리보기</h3>
          <div className="mri-thumbnails-container">
            {/* MRI Channel Thumbnails */}
            {inferenceDetail.mri_thumbnails?.map((thumb) => (
              <div key={thumb.channel} className="mri-thumbnail-card">
                <div className="thumbnail-wrapper">
                  <img
                    src={`${API_BASE_URL}${thumb.url.startsWith('/api/') ? thumb.url.slice(4) : thumb.url}`}
                    alt={thumb.channel}
                    className="thumbnail-image"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement
                      target.style.display = 'none'
                      target.parentElement?.classList.add('thumbnail-error')
                    }}
                  />
                </div>
                <div className="thumbnail-label" style={{ backgroundColor: CHANNEL_COLORS[thumb.channel] }}>
                  {thumb.channel}
                </div>
                <span className="thumbnail-description">{thumb.description}</span>
              </div>
            ))}

            {/* No MRI thumbnails available */}
            {!inferenceDetail.mri_thumbnails?.length && (
              <div className="no-thumbnails-message">
                원본 MRI OCS 연결 정보가 없습니다.
              </div>
            )}
          </div>
        </div>
      )}

      {/* Inference Result */}
      {inferenceDetail.status === 'COMPLETED' && inferenceDetail.result_data && (
        <div className="section">
          <h3 className="section-title">예측 결과</h3>
          <InferenceResult
            result={inferenceDetail.result_data}
            status="completed"
            error=""
            jobId={jobId || ''}
          />
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

      {/* Segmentation Viewer */}
      {inferenceDetail.status === 'COMPLETED' && (
        <div className="section">
          <h3 className="section-title">세그멘테이션 뷰어</h3>

          {loadingSegmentation ? (
            <div className="loading-container">
              <div className="spinner" />
              <p className="loading-text">세그멘테이션 데이터 로딩 중...</p>
            </div>
          ) : segmentationError ? (
            <div className="error-container">
              <h4 className="error-title">세그멘테이션 로드 실패</h4>
              <p className="error-message">{segmentationError}</p>
            </div>
          ) : segmentationData ? (
            <div className="viewer-container">
              <SegMRIViewer
                data={segmentationData}
                title={`세그멘테이션 결과`}
                initialViewMode="axial"
                initialDisplayMode="pred_only"
                maxCanvasSize={600}
                enableCompareTab={false}  // GT 전처리 미구현으로 비활성화 (docs/GT_SEG_비교기능_분석보고서.md 참고)
                onCompareRequest={loadCompareData}
              />
            </div>
          ) : (
            <div className="empty-state">
              세그멘테이션 데이터가 없습니다.
            </div>
          )}
        </div>
      )}

      {/* 이전 분석 결과 비교 섹션 */}
      {inferenceDetail.status === 'COMPLETED' && (
        <div className="section previous-results-section">
          <h3 className="section-title">
            이전 분석 결과 비교
            {otherM1Results.length > 0 && (
              <span className="results-count">({otherM1Results.length}건)</span>
            )}
          </h3>

          {loadingOtherResults ? (
            <div className="loading-container small">
              <div className="spinner small" />
              <p className="loading-text">이전 분석 이력 조회 중...</p>
            </div>
          ) : otherM1Results.length === 0 ? (
            <div className="empty-state">
              <p>동일 환자의 이전 M1 분석 결과가 없습니다.</p>
              <p className="empty-hint">
                같은 환자에 대해 여러 번 M1 분석을 수행하면 이곳에서 시간에 따른 변화를 비교할 수 있습니다.
              </p>
            </div>
          ) : (
            <div className="previous-results-content">
              {/* 비교 안내 메시지 */}
              <div className="compare-notice">
                <span className="compare-notice-icon">📊</span>
                <p>
                  동일 환자의 M1 분석 결과 <strong>{otherM1Results.length + 1}건</strong>이 있습니다.
                  아래 표에서 이전 결과와 비교하거나, 상세 비교 페이지에서 종양 볼륨 변화를 확인할 수 있습니다.
                </p>
              </div>

              {/* 이전 결과 목록 */}
              <div className="previous-results-list">
                <h4 className="subsection-title">이전 분석 이력</h4>
                <table className="results-table">
                  <thead>
                    <tr>
                      <th>분석일</th>
                      <th>종양 등급</th>
                      <th>IDH</th>
                      <th>MGMT</th>
                      <th>생존 예후</th>
                      <th>상세</th>
                    </tr>
                  </thead>
                  <tbody>
                    {/* 현재 결과 (강조 표시) */}
                    <tr className="current-result">
                      <td>
                        {inferenceDetail.completed_at
                          ? new Date(inferenceDetail.completed_at).toLocaleDateString('ko-KR')
                          : '-'}
                        <span className="current-badge">현재</span>
                      </td>
                      <td>
                        <span className={`grade-badge grade-${inferenceDetail.result_data?.grade?.predicted_class?.toLowerCase()}`}>
                          {inferenceDetail.result_data?.grade?.predicted_class || '-'}
                        </span>
                      </td>
                      <td>{inferenceDetail.result_data?.idh?.predicted_class || '-'}</td>
                      <td>{inferenceDetail.result_data?.mgmt?.predicted_class || '-'}</td>
                      <td>{inferenceDetail.result_data?.survival?.risk_category || '-'}</td>
                      <td>-</td>
                    </tr>
                    {/* 이전 결과들 */}
                    {otherM1Results.map((result) => {
                      const resultData = result.result?.result_data as M1Result | null
                      return (
                        <tr key={result.request_id}>
                          <td>
                            {result.completed_at
                              ? new Date(result.completed_at).toLocaleDateString('ko-KR')
                              : '-'}
                          </td>
                          <td>
                            <span className={`grade-badge grade-${resultData?.grade?.predicted_class?.toLowerCase()}`}>
                              {resultData?.grade?.predicted_class || '-'}
                            </span>
                          </td>
                          <td>{resultData?.idh?.predicted_class || '-'}</td>
                          <td>{resultData?.mgmt?.predicted_class || '-'}</td>
                          <td>{resultData?.survival?.risk_category || '-'}</td>
                          <td>
                            <Link
                              to={`/ai/m1/${result.request_id}`}
                              className="link-btn"
                            >
                              보기
                            </Link>
                          </td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="M1 MRI 분석 PDF 미리보기"
      >
        {inferenceDetail && inferenceDetail.result_data && (
          <DocumentPreview
            title="M1 MRI AI 분석 보고서"
            subtitle="뇌종양 MRI 영상 AI 진단 결과"
            infoGrid={[
              { label: 'Job ID', value: inferenceDetail.job_id },
              { label: '환자번호', value: inferenceDetail.patient_number },
              { label: '환자명', value: inferenceDetail.patient_name },
              { label: '요청일시', value: new Date(inferenceDetail.created_at).toLocaleString('ko-KR') },
              { label: '완료일시', value: inferenceDetail.completed_at ? new Date(inferenceDetail.completed_at).toLocaleString('ko-KR') : undefined },
              { label: '처리시간', value: inferenceDetail.result_data.processing_time_ms ? `${(inferenceDetail.result_data.processing_time_ms / 1000).toFixed(2)}초` : undefined },
            ]}
            sections={[
              {
                type: 'result-boxes',
                title: 'AI 분석 결과',
                items: [
                  ...(inferenceDetail.result_data.grade ? [{
                    title: '종양 등급 (Grade)',
                    value: inferenceDetail.result_data.grade.predicted_class,
                    subText: `신뢰도: ${formatConfidence(inferenceDetail.result_data.grade.probability)}`,
                    variant: getGradeVariant(inferenceDetail.result_data.grade.predicted_class),
                  }] : []),
                  ...(inferenceDetail.result_data.idh ? [{
                    title: 'IDH 돌연변이',
                    value: inferenceDetail.result_data.idh.predicted_class,
                    subText: inferenceDetail.result_data.idh.mutant_probability !== undefined
                      ? `신뢰도: ${formatConfidence(inferenceDetail.result_data.idh.mutant_probability)}`
                      : undefined,
                    variant: 'default' as const,
                  }] : []),
                  ...(inferenceDetail.result_data.mgmt ? [{
                    title: 'MGMT 프로모터 메틸화',
                    value: inferenceDetail.result_data.mgmt.predicted_class,
                    subText: inferenceDetail.result_data.mgmt.methylated_probability !== undefined
                      ? `신뢰도: ${formatConfidence(inferenceDetail.result_data.mgmt.methylated_probability)}`
                      : undefined,
                    variant: 'default' as const,
                  }] : []),
                  ...(inferenceDetail.result_data.survival ? [{
                    title: '생존 예후',
                    value: `${inferenceDetail.result_data.survival.risk_category}${inferenceDetail.result_data.os_days ? ` (예상 생존기간: ${inferenceDetail.result_data.os_days.predicted_days}일)` : ''}`,
                    subText: `위험 점수: ${inferenceDetail.result_data.survival.risk_score.toFixed(2)}`,
                    variant: 'default' as const,
                  }] : []),
                ],
              },
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

      {/* 검토 모달 */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>결과 검토</h3>

            <div className="review-options">
              <button
                className={`review-option ${reviewStatus === 'approved' ? 'selected' : ''}`}
                onClick={() => setReviewStatus('approved')}
              >
                <span className="icon icon-approve">&#10003;</span>
                <span>승인</span>
              </button>
              <button
                className={`review-option ${reviewStatus === 'rejected' ? 'selected' : ''}`}
                onClick={() => setReviewStatus('rejected')}
              >
                <span className="icon icon-reject">&#10007;</span>
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
              <button
                className="btn-secondary"
                onClick={() => setShowReviewModal(false)}
              >
                취소
              </button>
              <button className="btn-primary" onClick={handleReviewSubmit}>
                제출
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Toast 컨테이너 */}
      <toast.ToastContainer position="top-right" />
    </div>
  )
}
