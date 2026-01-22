import { useState, useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { OCSTable, type OCSItem } from '@/components/OCSTable'
import SegMRIViewer, { type SegmentationData } from '@/components/ai/SegMRIViewer'
import { useAIInference } from '@/context/AIInferenceContext'
import { ocsApi, aiApi } from '@/services/ai.api'
import './M1InferencePage.css'

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

interface InferenceRecord {
  id: number
  job_id: string
  model_type: string
  status: string
  mode: string
  patient_name: string
  patient_number: string
  mri_ocs: number | null
  result_data: M1Result | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

type TabType = 'summary' | 'details' | 'segmentation'

export default function M1InferencePage() {
  const navigate = useNavigate()

  // AI Inference Context (전역 알림 및 FastAPI 상태 감지)
  const { requestInference, isFastAPIAvailable, lastMessage, isConnected } = useAIInference()

  // State
  const [ocsData, setOcsData] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOcs, setSelectedOcs] = useState<OCSItem | null>(null)
  const [inferenceStatus, setInferenceStatus] = useState<string>('')
  const [inferenceResult, setInferenceResult] = useState<M1Result | null>(null)
  const [error, setError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [isCached, setIsCached] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // 추론 이력
  const [inferenceHistory, setInferenceHistory] = useState<InferenceRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // 세그멘테이션 뷰어
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null)
  const [loadingSegmentation, setLoadingSegmentation] = useState(false)
  const [segmentationError, setSegmentationError] = useState<string>('')

  // OCS 데이터 로드
  useEffect(() => {
    loadOcsData()
    loadInferenceHistory()
  }, [])

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage?.type === 'AI_INFERENCE_RESULT') {
      console.log('Received inference result:', lastMessage)

      if (lastMessage.job_id === jobId) {
        if (lastMessage.status === 'COMPLETED') {
          setInferenceStatus('completed')
          if (lastMessage.result) {
            setInferenceResult(lastMessage.result as M1Result)
          }
          setError('')
          // 이력 새로고침
          loadInferenceHistory()
          // 세그멘테이션 데이터 로드
          loadSegmentationData(jobId)
        } else if (lastMessage.status === 'FAILED') {
          setInferenceStatus('failed')
          setError(lastMessage.error || '추론 실패')
        }
      }
    }
  }, [lastMessage, jobId])

  const loadOcsData = async () => {
    try {
      setLoading(true)
      const response = await ocsApi.getAllOcsList()
      const rawData = response.results || response || []

      // API 응답을 OCSItem 형태로 변환 (RIS + MRI + CONFIRMED만 필터링)
      const mappedData: OCSItem[] = rawData
        .filter((item: any) => item.job_role === 'RIS' && item.job_type === 'MRI' && item.ocs_status === 'CONFIRMED')
        .map((item: any) => ({
          id: item.id,
          ocs_id: item.ocs_id,
          patient_name: item.patient?.name || '',
          patient_number: item.patient?.patient_number || '',
          job_role: item.job_role || '',
          job_type: item.job_type || '',
          ocs_status: item.ocs_status || '',
          confirmed_at: item.confirmed_at || '',
          ocs_result: item.ocs_result || null,
          attachments: item.attachments || {},
          worker_result: item.worker_result || {},
        }))

      setOcsData(mappedData)
    } catch (err) {
      console.error('Failed to load OCS data:', err)
      setError('OCS 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadInferenceHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await aiApi.getInferenceList('M1')
      setInferenceHistory(data || [])
    } catch (err) {
      console.error('Failed to load inference history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // 세그멘테이션 데이터 로드
  const loadSegmentationData = async (jobIdToLoad: string) => {
    try {
      setLoadingSegmentation(true)
      setSegmentationError('')
      setSegmentationData(null)

      const data = await aiApi.getSegmentationData(jobIdToLoad)

      // API 응답을 SegmentationData 형식으로 변환
      const segData: SegmentationData = {
        mri: data.mri,
        groundTruth: data.groundTruth || data.prediction,  // GT가 없으면 prediction 사용
        prediction: data.prediction,
        shape: data.shape as [number, number, number],
        mri_channels: data.mri_channels,  // T1, T1CE, T2, FLAIR 4채널
      }

      setSegmentationData(segData)
      console.log('Segmentation data loaded:', segData.shape, 'channels:', data.mri_channels ? Object.keys(data.mri_channels) : 'none')
    } catch (err: any) {
      console.error('Failed to load segmentation data:', err)
      setSegmentationError(
        err.response?.data?.error || '세그멘테이션 데이터를 불러오는데 실패했습니다.'
      )
    } finally {
      setLoadingSegmentation(false)
    }
  }

  const handleSelectOcs = (ocs: OCSItem) => {
    setSelectedOcs(ocs)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
    setIsCached(false)
    setSegmentationData(null)
    setSegmentationError('')
  }

  const handleRequestInference = async () => {
    if (!selectedOcs) {
      setError('OCS를 선택해주세요.')
      return
    }

    // DICOM study_uid 검증 (백엔드에서 필수)
    const studyUid = selectedOcs.worker_result?.dicom?.study_uid
    if (!studyUid) {
      setError('DICOM study_uid 정보가 없습니다. OCS 데이터를 확인해주세요.')
      return
    }

    try {
      setInferenceStatus('requesting')
      setError('')
      setInferenceResult(null)
      setIsCached(false)

      console.log('[M1] 추론 요청:', { ocs_id: selectedOcs.id, study_uid: studyUid })

      // 전역 context의 requestInference 사용 (FastAPI 상태 감지 및 토스트 알림 포함)
      const job = await requestInference('M1', { ocs_id: selectedOcs.id, mode: 'manual' })

      if (!job) {
        // requestInference가 null을 반환하면 에러 발생 (FastAPI OFF 등)
        // 알림은 전역 context에서 이미 처리됨
        setInferenceStatus('failed')
        setError('AI 서버 연결 실패. 토스트 알림을 확인해주세요.')
        return
      }

      setJobId(job.job_id)

      // 캐시된 결과인 경우 바로 표시
      if (job.cached && job.result) {
        console.log('Using cached inference result:', job)
        setIsCached(true)
        setInferenceStatus('completed')
        setInferenceResult(job.result as M1Result)
        // 세그멘테이션 데이터 로드
        loadSegmentationData(job.job_id)
      } else {
        // 새 추론 요청 - WebSocket으로 결과 대기
        setInferenceStatus('processing')
        console.log('Inference request sent:', job)
      }
    } catch (err: any) {
      setInferenceStatus('failed')
      setError(
        err.response?.data?.error ||
          err.message ||
          '추론 요청에 실패했습니다.'
      )
    }
  }

  const handleViewDetail = (record: InferenceRecord) => {
    navigate(`/ai/m1/${record.job_id}`)
  }

  const handleSelectHistory = (record: InferenceRecord) => {
    setJobId(record.job_id)
    setInferenceStatus(record.status.toLowerCase())
    setInferenceResult(record.result_data)
    setError(record.error_message || '')
    setIsCached(false)

    // 완료된 추론 결과인 경우 세그멘테이션 데이터 로드
    if (record.status === 'COMPLETED') {
      loadSegmentationData(record.job_id)
    } else {
      setSegmentationData(null)
      setSegmentationError('')
    }
  }

  // 추론 이력 삭제
  const handleDeleteInference = async (record: InferenceRecord) => {
    if (!window.confirm(`${record.job_id} 추론 결과를 삭제하시겠습니까?`)) {
      return
    }

    try {
      await aiApi.deleteInference(record.job_id)
      // 현재 선택된 결과가 삭제되는 경우 초기화
      if (record.job_id === jobId) {
        setJobId('')
        setInferenceResult(null)
        setInferenceStatus('')
        setError('')
        setSegmentationData(null)
        setSegmentationError('')
      }
      // 이력 새로고침
      loadInferenceHistory()
    } catch (err: any) {
      console.error('Failed to delete inference:', err)
      alert(err.response?.data?.error || '삭제에 실패했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      COMPLETED: { className: 'm1-status-badge m1-status-completed', label: '완료' },
      PROCESSING: { className: 'm1-status-badge m1-status-processing', label: '처리중' },
      PENDING: { className: 'm1-status-badge m1-status-pending', label: '대기' },
      FAILED: { className: 'm1-status-badge m1-status-failed', label: '실패' },
    }
    const { className, label } = statusMap[status] || { className: 'm1-status-badge m1-status-pending', label: status }
    return <span className={className}>{label}</span>
  }

  // Risk 카테고리 색상 클래스
  const getRiskColorClass = (category: string) => {
    switch (category?.toLowerCase()) {
      case 'low': return 'm1-risk-low'
      case 'medium': return 'm1-risk-medium'
      case 'high': return 'm1-risk-high'
      default: return ''
    }
  }

  // 확률을 퍼센트로 변환
  const toPercent = (value: number) => Math.round(value * 100)

  // 결과 뷰어 컴포넌트
  const renderResultViewer = () => {
    // 로딩 상태
    if (inferenceStatus === 'requesting' || inferenceStatus === 'processing') {
      return (
        <div className="m1-result-viewer">
          <div className="m1-result-header">
            <h3>M1 MRI 분석 결과</h3>
            <span className="m1-model-badge">MRI Analysis</span>
          </div>
          <div className="m1-result-content">
            <div className="m1-loading">
              <div className="m1-spinner"></div>
              <span>M1 추론 진행 중...</span>
              {jobId && <span className="m1-job-info">Job: {jobId}</span>}
            </div>
          </div>
        </div>
      )
    }

    // 에러 상태
    if (inferenceStatus === 'failed' && error) {
      return (
        <div className="m1-result-viewer">
          <div className="m1-result-header">
            <h3>M1 MRI 분석 결과</h3>
            <span className="m1-model-badge">MRI Analysis</span>
          </div>
          <div className="m1-result-content">
            <div className="m1-error">
              <span className="m1-error-icon">!</span>
              {error}
            </div>
          </div>
        </div>
      )
    }

    // 결과 없음
    if (!inferenceResult) {
      return (
        <div className="m1-result-viewer">
          <div className="m1-result-header">
            <h3>M1 MRI 분석 결과</h3>
            <span className="m1-model-badge">MRI Analysis</span>
          </div>
          <div className="m1-result-content">
            <div className="m1-empty">
              <span className="m1-empty-icon">🧠</span>
              <span>OCS를 선택하고 M1 추론을 요청하면 결과가 표시됩니다.</span>
            </div>
          </div>
        </div>
      )
    }

    const { grade, idh, mgmt, survival, os_days } = inferenceResult

    return (
      <div className="m1-result-viewer">
        {/* 헤더 */}
        <div className="m1-result-header">
          <h3>M1 MRI 분석 결과</h3>
          {jobId && (
            <span className="m1-job-id">Job: {jobId}</span>
          )}
          {isCached && (
            <span className="m1-cached-badge">캐시됨</span>
          )}
        </div>

        {/* 탭 네비게이션 */}
        <div className="m1-result-tabs">
          <button
            className={activeTab === 'summary' ? 'active' : ''}
            onClick={() => setActiveTab('summary')}
          >
            요약
          </button>
          <button
            className={activeTab === 'details' ? 'active' : ''}
            onClick={() => setActiveTab('details')}
          >
            상세 분석
          </button>
          <button
            className={activeTab === 'segmentation' ? 'active' : ''}
            onClick={() => setActiveTab('segmentation')}
          >
            세그멘테이션
          </button>
        </div>

        {/* 탭 콘텐츠 */}
        <div className="m1-result-content">
          {/* 요약 탭 */}
          {activeTab === 'summary' && (
            <div className="m1-tab-summary">
              {/* 위험도 게이지 */}
              {survival && (
                <div className="m1-risk-gauge-section">
                  <h4>생존 위험도</h4>
                  <div className="m1-risk-gauge">
                    <div
                      className={`m1-risk-indicator ${getRiskColorClass(survival.risk_category)}`}
                      style={{ left: `${Math.max(0, Math.min(survival.risk_score * 100, 100))}%` }}
                    />
                  </div>
                  <div className="m1-risk-scale">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                  <div className="m1-risk-value">
                    <span className={`m1-risk-category ${getRiskColorClass(survival.risk_category)}`}>
                      {survival.risk_category}
                    </span>
                    <span className="m1-risk-score">Score: {survival.risk_score.toFixed(3)}</span>
                  </div>
                </div>
              )}

              {/* 주요 결과 카드 */}
              <div className="m1-summary-cards">
                {grade && (
                  <div className="m1-summary-card grade">
                    <div className="m1-card-icon">🧬</div>
                    <div className="m1-card-content">
                      <span className="m1-card-label">종양 등급</span>
                      <span className="m1-card-value">{grade.predicted_class}</span>
                      <span className="m1-card-confidence">{toPercent(grade.probability)}% 신뢰도</span>
                    </div>
                  </div>
                )}

                {idh && (
                  <div className="m1-summary-card idh">
                    <div className="m1-card-icon">🔬</div>
                    <div className="m1-card-content">
                      <span className="m1-card-label">IDH 상태</span>
                      <span className="m1-card-value">{idh.predicted_class}</span>
                      {idh.mutant_probability !== undefined && (
                        <span className="m1-card-confidence">{toPercent(idh.mutant_probability)}% 돌연변이 확률</span>
                      )}
                    </div>
                  </div>
                )}

                {mgmt && (
                  <div className="m1-summary-card mgmt">
                    <div className="m1-card-icon">💊</div>
                    <div className="m1-card-content">
                      <span className="m1-card-label">MGMT 상태</span>
                      <span className="m1-card-value">{mgmt.predicted_class}</span>
                      {mgmt.methylated_probability !== undefined && (
                        <span className="m1-card-confidence">{toPercent(mgmt.methylated_probability)}% 메틸화 확률</span>
                      )}
                    </div>
                  </div>
                )}

                {os_days && (
                  <div className="m1-summary-card survival">
                    <div className="m1-card-icon">📅</div>
                    <div className="m1-card-content">
                      <span className="m1-card-label">예측 생존 기간</span>
                      <span className="m1-card-value">{os_days.predicted_months.toFixed(1)}개월</span>
                      <span className="m1-card-confidence">({os_days.predicted_days}일)</span>
                    </div>
                  </div>
                )}
              </div>

              {/* 메타 정보 */}
              <div className="m1-meta-info">
                <span>처리 시간: {inferenceResult.processing_time_ms?.toFixed(1) || 0}ms</span>
              </div>
            </div>
          )}

          {/* 상세 분석 탭 */}
          {activeTab === 'details' && (
            <div className="m1-tab-details">
              {/* Grade */}
              {grade && (
                <div className="m1-detail-section">
                  <h4>종양 등급 (Grade)</h4>
                  <div className="m1-detail-result">
                    <span className="m1-detail-label">예측 결과:</span>
                    <span className={`m1-detail-value ${grade.predicted_class.toLowerCase().replace(' ', '-')}`}>
                      {grade.predicted_class}
                    </span>
                  </div>
                  {grade.probabilities && (
                    <div className="m1-probability-bars">
                      {Object.entries(grade.probabilities).map(([key, value]) => (
                        <div key={key} className="m1-prob-bar">
                          <span className="m1-prob-label">{key}</span>
                          <div className="m1-prob-track">
                            <div
                              className="m1-prob-fill"
                              style={{ width: `${toPercent(value)}%` }}
                            />
                          </div>
                          <span className="m1-prob-value">{toPercent(value)}%</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* IDH */}
              {idh && (
                <div className="m1-detail-section">
                  <h4>IDH 돌연변이 상태</h4>
                  <div className="m1-detail-result">
                    <span className="m1-detail-label">예측 결과:</span>
                    <span className={`m1-detail-value ${idh.predicted_class === 'Mutant' ? 'positive' : 'negative'}`}>
                      {idh.predicted_class}
                    </span>
                  </div>
                  {idh.mutant_probability !== undefined && (
                    <div className="m1-single-prob-bar">
                      <span>돌연변이 확률:</span>
                      <div className="m1-prob-track">
                        <div
                          className="m1-prob-fill idh"
                          style={{ width: `${toPercent(idh.mutant_probability)}%` }}
                        />
                      </div>
                      <span>{toPercent(idh.mutant_probability)}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* MGMT */}
              {mgmt && (
                <div className="m1-detail-section">
                  <h4>MGMT 프로모터 메틸화</h4>
                  <div className="m1-detail-result">
                    <span className="m1-detail-label">예측 결과:</span>
                    <span className={`m1-detail-value ${mgmt.predicted_class === 'Methylated' ? 'positive' : 'negative'}`}>
                      {mgmt.predicted_class}
                    </span>
                  </div>
                  {mgmt.methylated_probability !== undefined && (
                    <div className="m1-single-prob-bar">
                      <span>메틸화 확률:</span>
                      <div className="m1-prob-track">
                        <div
                          className="m1-prob-fill mgmt"
                          style={{ width: `${toPercent(mgmt.methylated_probability)}%` }}
                        />
                      </div>
                      <span>{toPercent(mgmt.methylated_probability)}%</span>
                    </div>
                  )}
                </div>
              )}

              {/* Survival */}
              {survival && os_days && (
                <div className="m1-detail-section">
                  <h4>생존 분석</h4>
                  <div className="m1-survival-display">
                    <div className="m1-survival-main">
                      <div className="m1-survival-value">{os_days.predicted_months.toFixed(1)}</div>
                      <div className="m1-survival-unit">개월</div>
                    </div>
                    <div className="m1-survival-detail">
                      ({os_days.predicted_days}일)
                    </div>
                  </div>
                  <div className="m1-survival-risk">
                    <span>위험 카테고리:</span>
                    <span className={`m1-risk-tag ${getRiskColorClass(survival.risk_category)}`}>
                      {survival.risk_category}
                    </span>
                    <span>Risk Score: {survival.risk_score.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 세그멘테이션 탭 */}
          {activeTab === 'segmentation' && (
            <div className="m1-tab-segmentation">
              {loadingSegmentation ? (
                <div className="m1-loading">
                  <div className="m1-spinner"></div>
                  <span>세그멘테이션 데이터 로딩 중...</span>
                </div>
              ) : segmentationError ? (
                <div className="m1-error">
                  <span className="m1-error-icon">!</span>
                  {segmentationError}
                </div>
              ) : segmentationData ? (
                <div className="m1-viewer-container">
                  <SegMRIViewer
                    data={segmentationData}
                    title={`세그멘테이션 결과 (Job: ${jobId})`}
                    initialViewMode="axial"
                    initialDisplayMode="pred_only"
                    maxCanvasSize={500}
                  />
                </div>
              ) : (
                <div className="m1-empty">
                  <span className="m1-empty-icon">🖼️</span>
                  <span>세그멘테이션 데이터가 없습니다.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="m1-inference-page">
      {/* Header */}
      <div className="m1-page-header">
        <div className="m1-header-content">
          <h2 className="m1-page-title">M1 MRI 분석</h2>
          <p className="m1-page-subtitle">
            MRI 영상을 분석하여 Grade, IDH, MGMT, 생존 예측을 수행합니다.
          </p>
        </div>
        <div className="m1-connection-status">
          <span className={`m1-status-dot ${isFastAPIAvailable ? 'connected' : 'disconnected'}`} />
          <span className="m1-status-text">
            {isFastAPIAvailable ? 'AI 서버 연결됨' : 'AI 서버 OFF'}
          </span>
          <span className={`m1-status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="m1-status-text">
            {isConnected ? 'WebSocket 연결됨' : 'WebSocket 연결 안됨'}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="m1-main-grid">
        {/* Left: OCS Selection */}
        <div className="m1-left-panel">
          {/* OCS Table */}
          <div className="m1-section m1-ocs-section">
            <div className="m1-section-header">
              <h3 className="m1-section-title">
                RIS MRI 목록 ({ocsData.length}건)
              </h3>
              <button onClick={loadOcsData} className="m1-btn-refresh">
                새로고침
              </button>
            </div>

            <OCSTable
              data={ocsData}
              selectedId={selectedOcs?.id || null}
              onSelect={handleSelectOcs}
              loading={loading}
            />
          </div>

          {/* Selected OCS Info & Inference Button */}
          {selectedOcs && (
            <div className="m1-section m1-selected-section">
              <h3 className="m1-section-title">선택된 OCS</h3>
              <div className="m1-selected-info">
                <div className="m1-info-row">
                  <span className="m1-info-label">OCS ID</span>
                  <span className="m1-info-value">{selectedOcs.ocs_id}</span>
                </div>
                <div className="m1-info-row">
                  <span className="m1-info-label">환자</span>
                  <span className="m1-info-value">
                    {selectedOcs.patient_name} ({selectedOcs.patient_number})
                  </span>
                </div>
                <div className="m1-info-row">
                  <span className="m1-info-label">검사유형</span>
                  <span className="m1-info-value">{selectedOcs.job_type}</span>
                </div>
                <div className="m1-info-row">
                  <span className="m1-info-label">Study UID</span>
                  <span className="m1-info-value truncate">
                    {selectedOcs.worker_result?.dicom?.study_uid || '-'}
                  </span>
                </div>
                <div className="m1-info-row">
                  <span className="m1-info-label">Series 수</span>
                  <span className="m1-info-value">
                    {selectedOcs.worker_result?.dicom?.series?.length || 0}개
                  </span>
                </div>
              </div>
              <button
                onClick={handleRequestInference}
                disabled={
                  inferenceStatus === 'requesting' ||
                  inferenceStatus === 'processing'
                }
                className={`m1-btn-inference ${
                  inferenceStatus === 'requesting' ||
                  inferenceStatus === 'processing'
                    ? 'disabled'
                    : ''
                }`}
              >
                {(inferenceStatus === 'requesting' || inferenceStatus === 'processing') && jobId
                  ? 'M1 추론 진행 중...'
                  : 'M1 추론 요청'}
              </button>
            </div>
          )}
        </div>

        {/* Right: Result Viewer */}
        <div className="m1-right-panel">
          {renderResultViewer()}
        </div>
      </div>

      {/* Inference History */}
      <div className="m1-section m1-history-section">
        <div className="m1-section-header">
          <h3 className="m1-section-title">
            추론 이력 ({inferenceHistory.length}건)
          </h3>
          <button onClick={loadInferenceHistory} className="m1-btn-refresh">
            새로고침
          </button>
        </div>

        <div className="m1-history-table-container">
          {loadingHistory ? (
            <div className="m1-loading">
              <div className="m1-spinner"></div>
            </div>
          ) : inferenceHistory.length > 0 ? (
            <table className="m1-history-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>환자</th>
                  <th>상태</th>
                  <th>결과</th>
                  <th>처리시간</th>
                  <th>생성일시</th>
                  <th>작업</th>
                </tr>
              </thead>
              <tbody>
                {inferenceHistory.map((record) => (
                  <tr
                    key={record.id}
                    className={record.job_id === jobId ? 'selected' : ''}
                  >
                    <td>{record.job_id}</td>
                    <td>
                      {record.patient_name} ({record.patient_number})
                    </td>
                    <td>{getStatusBadge(record.status)}</td>
                    <td>
                      {record.status === 'COMPLETED' && record.result_data?.grade ? (
                        <span className="m1-result-preview">
                          Grade: {record.result_data.grade.predicted_class}
                        </span>
                      ) : record.status === 'FAILED' ? (
                        <span className="m1-result-error">
                          {record.error_message || 'Error'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {record.status === 'COMPLETED' && record.result_data?.processing_time_ms ? (
                        <span className="m1-processing-time">
                          {(record.result_data.processing_time_ms / 1000).toFixed(2)}초
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {new Date(record.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td>
                      <div className="m1-action-buttons">
                        {record.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => handleSelectHistory(record)}
                              className="m1-btn-action m1-btn-view"
                            >
                              보기
                            </button>
                            <button
                              onClick={() => handleViewDetail(record)}
                              className="m1-btn-action m1-btn-detail"
                            >
                              상세
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteInference(record)}
                          className="m1-btn-action m1-btn-delete"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="m1-empty">
              <span>추론 이력이 없습니다.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
