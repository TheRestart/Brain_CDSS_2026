import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAIInference } from '@/context/AIInferenceContext'
import { ocsApi, aiApi } from '@/services/ai.api'
import './MMInferencePage.css'

interface PatientOption {
  patient_number: string
  patient_name: string
  ocs_count: number
}

interface OCSItem {
  id: number
  ocs_id: string
  patient_name: string
  patient_number: string
  job_role: string
  job_type: string
  ocs_status: string
  confirmed_at: string
}

interface MMResult {
  patient_id?: string
  job_id?: string
  ocs_id?: number

  risk_group?: {
    predicted_class: string
    probabilities: Record<string, number>
  }

  survival?: {
    hazard_ratio: number
    risk_score: number
    survival_probability_6m?: number
    survival_probability_12m?: number
    model_cindex?: number
  }

  os_days?: {
    predicted_days: number
    predicted_months: number
    confidence_interval?: { lower: number; upper: number }
  }

  recurrence?: {
    predicted_class: string
    recurrence_probability: number
  }

  tmz_response?: {
    predicted_class: string
    responder_probability: number
  }

  recommendation?: string
  processing_time_ms?: number
  model_version?: string
  modalities_used?: string[]
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
  gene_ocs: number | null
  protein_ocs: number | null
  result_data: MMResult | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

type MMTabType = 'summary' | 'survival' | 'predictions'

export default function MMInferencePage() {
  const navigate = useNavigate()

  // AI Inference Context
  const { requestInference, isFastAPIAvailable, lastMessage, isConnected } = useAIInference()

  // State
  const [_loading, setLoading] = useState(true)
  const [inferenceStatus, setInferenceStatus] = useState<string>('')
  const [inferenceResult, setInferenceResult] = useState<MMResult | null>(null)
  const [error, setError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [isCached, setIsCached] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<MMTabType>('summary')

  // Patient selection
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [isResearch, setIsResearch] = useState<boolean>(false)

  // Modality OCS lists
  const [mriOcsList, setMriOcsList] = useState<OCSItem[]>([])
  const [geneOcsList, setGeneOcsList] = useState<OCSItem[]>([])
  const [proteinOcsList, setProteinOcsList] = useState<OCSItem[]>([])

  // Selected OCS
  const [selectedMriOcs, setSelectedMriOcs] = useState<number | null>(null)
  const [selectedGeneOcs, setSelectedGeneOcs] = useState<number | null>(null)
  const [selectedProteinOcs, setSelectedProteinOcs] = useState<number | null>(null)

  // Inference history
  const [inferenceHistory, setInferenceHistory] = useState<InferenceRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Load initial data
  useEffect(() => {
    loadAllOcsData()
    loadInferenceHistory()
  }, [])

  // WebSocket message handling
  useEffect(() => {
    if (lastMessage?.type === 'AI_INFERENCE_RESULT') {
      console.log('Received MM inference result:', lastMessage)

      if (lastMessage.job_id === jobId) {
        if (lastMessage.status === 'COMPLETED') {
          setInferenceStatus('completed')
          if (lastMessage.result) {
            setInferenceResult(lastMessage.result as MMResult)
          }
          setError('')
          loadInferenceHistory()
        } else if (lastMessage.status === 'FAILED') {
          setInferenceStatus('failed')
          setError(lastMessage.error || '추론 실패')
        }
      }
    }
  }, [lastMessage, jobId])

  const loadAllOcsData = async () => {
    try {
      setLoading(true)

      const [mriResponse, geneResponse, proteinResponse] = await Promise.all([
        ocsApi.getMriOcsList(),
        ocsApi.getRnaSeqOcsList(),
        ocsApi.getBiomarkerOcsList(),
      ])

      const mriData = mriResponse.results || mriResponse || []
      const geneData = geneResponse.results || geneResponse || []
      const proteinData = proteinResponse.results || proteinResponse || []

      // Extract patients
      const patientMap = new Map<string, PatientOption>()
      const allData = [...mriData, ...geneData, ...proteinData]
      allData.forEach((item: any) => {
        if (item.patient?.patient_number) {
          const existing = patientMap.get(item.patient.patient_number)
          if (existing) {
            existing.ocs_count++
          } else {
            patientMap.set(item.patient.patient_number, {
              patient_number: item.patient.patient_number,
              patient_name: item.patient.name || '',
              ocs_count: 1,
            })
          }
        }
      })
      setPatients(Array.from(patientMap.values()))

      // Map OCS items
      const mapOcsItem = (item: any): OCSItem => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role || '',
        job_type: item.job_type || '',
        ocs_status: item.ocs_status || '',
        confirmed_at: item.confirmed_at || '',
      })

      setMriOcsList(mriData.map(mapOcsItem))
      setGeneOcsList(geneData.map(mapOcsItem))
      setProteinOcsList(proteinData.map(mapOcsItem))
    } catch (err) {
      console.error('Failed to load OCS data:', err)
      setError('OCS 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // Filter OCS by patient
  const filteredMriOcsList = useMemo(() => {
    if (isResearch || !selectedPatient) return mriOcsList
    return mriOcsList.filter(ocs => ocs.patient_number === selectedPatient)
  }, [mriOcsList, selectedPatient, isResearch])

  const filteredGeneOcsList = useMemo(() => {
    if (isResearch || !selectedPatient) return geneOcsList
    return geneOcsList.filter(ocs => ocs.patient_number === selectedPatient)
  }, [geneOcsList, selectedPatient, isResearch])

  const filteredProteinOcsList = useMemo(() => {
    if (isResearch || !selectedPatient) return proteinOcsList
    return proteinOcsList.filter(ocs => ocs.patient_number === selectedPatient)
  }, [proteinOcsList, selectedPatient, isResearch])

  const handlePatientChange = (patientNumber: string) => {
    setSelectedPatient(patientNumber)
    setSelectedMriOcs(null)
    setSelectedGeneOcs(null)
    setSelectedProteinOcs(null)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
  }

  const loadInferenceHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await aiApi.getInferenceList('MM')
      setInferenceHistory(data || [])
    } catch (err) {
      console.error('Failed to load MM inference history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  const handleRequestInference = async () => {
    const selectedCount = [selectedMriOcs, selectedGeneOcs, selectedProteinOcs].filter(Boolean).length

    if (selectedCount < 1) {
      setError('최소 1개 이상의 모달리티를 선택해주세요.')
      return
    }

    try {
      setInferenceStatus('requesting')
      setError('')
      setInferenceResult(null)
      setIsCached(false)

      const job = await requestInference('MM', {
        mri_ocs_id: selectedMriOcs,
        gene_ocs_id: selectedGeneOcs,
        protein_ocs_id: selectedProteinOcs,
        mode: 'manual',
        is_research: isResearch
      })

      if (!job) {
        setInferenceStatus('failed')
        setError('AI 서버 연결 실패. 서버 상태를 확인해주세요.')
        return
      }

      setJobId(job.job_id)

      if (job.cached && job.result) {
        console.log('Using cached MM inference result:', job)
        setIsCached(true)
        setInferenceStatus('completed')
        setInferenceResult(job.result as MMResult)
      } else {
        setInferenceStatus('processing')
        console.log('MM Inference request sent:', job)
      }
    } catch (err: any) {
      setInferenceStatus('failed')
      const errorMessage =
        err.response?.data?.detail ||
        err.response?.data?.error ||
        err.response?.data?.message ||
        err.message ||
        '추론 요청에 실패했습니다.'
      setError(errorMessage)
      console.error('MM Inference error:', err.response?.data || err)
    }
  }

  const handleViewDetail = (record: InferenceRecord) => {
    navigate(`/ai/mm/${record.job_id}`)
  }

  const handleSelectHistory = (record: InferenceRecord) => {
    setJobId(record.job_id)
    setInferenceStatus(record.status.toLowerCase())
    setInferenceResult(record.result_data)
    setError(record.error_message || '')
    setIsCached(false)
  }

  const handleDeleteInference = async (record: InferenceRecord) => {
    if (!window.confirm(`${record.job_id} 추론 결과를 삭제하시겠습니까?`)) {
      return
    }

    try {
      await aiApi.deleteInference(record.job_id)
      if (record.job_id === jobId) {
        setJobId('')
        setInferenceResult(null)
        setInferenceStatus('')
        setError('')
      }
      loadInferenceHistory()
    } catch (err: any) {
      console.error('Failed to delete inference:', err)
      alert(err.response?.data?.error || '삭제에 실패했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      COMPLETED: { className: 'mm-status-badge mm-status-completed', label: '완료' },
      PROCESSING: { className: 'mm-status-badge mm-status-processing', label: '처리중' },
      PENDING: { className: 'mm-status-badge mm-status-pending', label: '대기' },
      FAILED: { className: 'mm-status-badge mm-status-failed', label: '실패' },
    }
    const { className, label } = statusMap[status] || { className: 'mm-status-badge mm-status-pending', label: status }
    return <span className={className}>{label}</span>
  }

  const selectedModalitiesCount = [selectedMriOcs, selectedGeneOcs, selectedProteinOcs].filter(Boolean).length

  // Risk color helper
  const getRiskColor = (riskClass: string) => {
    switch (riskClass.toLowerCase()) {
      case 'low':
        return '#22c55e'
      case 'medium':
        return '#f59e0b'
      case 'high':
        return '#ef4444'
      default:
        return '#94a3b8'
    }
  }

  const formatPercent = (value: number) => `${(value * 100).toFixed(1)}%`

  // Result Viewer Component
  const renderResultViewer = () => {
    // Loading state
    if (inferenceStatus === 'requesting' || inferenceStatus === 'processing') {
      return (
        <div className="mm-result-viewer">
          <div className="mm-result-header">
            <h3>MM Multimodal 분석 결과</h3>
            <span className="mm-model-badge">Multimodal</span>
          </div>
          <div className="mm-result-content">
            <div className="mm-loading">
              <div className="mm-spinner"></div>
              <span>MM 추론 진행 중...</span>
              {jobId && <span className="mm-job-info">Job: {jobId}</span>}
            </div>
          </div>
        </div>
      )
    }

    // Error state
    if (inferenceStatus === 'failed' && error) {
      return (
        <div className="mm-result-viewer">
          <div className="mm-result-header">
            <h3>MM Multimodal 분석 결과</h3>
            <span className="mm-model-badge">Multimodal</span>
          </div>
          <div className="mm-result-content">
            <div className="mm-error">
              <span className="mm-error-icon">!</span>
              {error}
            </div>
          </div>
        </div>
      )
    }

    // Empty state
    if (!inferenceResult) {
      return (
        <div className="mm-result-viewer">
          <div className="mm-result-header">
            <h3>MM Multimodal 분석 결과</h3>
            <span className="mm-model-badge">Multimodal</span>
          </div>
          <div className="mm-result-content">
            <div className="mm-empty">
              <span className="mm-empty-icon">🔬</span>
              <span>모달리티를 선택하고 MM 추론을 요청하면 결과가 표시됩니다.</span>
            </div>
          </div>
        </div>
      )
    }

    const { modalities_used, risk_group, survival, os_days, recurrence, tmz_response, recommendation } = inferenceResult

    return (
      <div className="mm-result-viewer">
        {/* Header */}
        <div className="mm-result-header">
          <h3>MM Multimodal 분석 결과</h3>
          {jobId && <span className="mm-job-id">Job: {jobId}</span>}
          {isCached && <span className="mm-cached-badge">캐시됨</span>}
        </div>

        {/* Tab Navigation */}
        <div className="mm-result-tabs">
          <button
            className={activeTab === 'summary' ? 'active' : ''}
            onClick={() => setActiveTab('summary')}
          >
            요약
          </button>
          <button
            className={activeTab === 'survival' ? 'active' : ''}
            onClick={() => setActiveTab('survival')}
          >
            생존 분석
          </button>
          <button
            className={activeTab === 'predictions' ? 'active' : ''}
            onClick={() => setActiveTab('predictions')}
          >
            예측 결과
          </button>
        </div>

        {/* Tab Content */}
        <div className="mm-result-content">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="mm-tab-summary">
              {/* Used Modalities */}
              {modalities_used && modalities_used.length > 0 && (
                <div className="mm-modalities-used">
                  <h4>분석에 사용된 모달리티</h4>
                  <div className="mm-modality-badges-large">
                    {modalities_used.map((mod, i) => (
                      <span key={i} className={`mm-modality-badge-large ${mod.toLowerCase()}`}>
                        {mod === 'mri' && '🧠 '}
                        {mod === 'gene' && '🧬 '}
                        {mod === 'protein' && '🔬 '}
                        {mod.toUpperCase()}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              {/* Risk Group */}
              {risk_group && (
                <div className="mm-risk-group-section">
                  <h4>위험군 분류</h4>
                  <div className="mm-risk-display">
                    <div
                      className="mm-risk-badge-xlarge"
                      style={{ backgroundColor: getRiskColor(risk_group.predicted_class) }}
                    >
                      {risk_group.predicted_class}
                    </div>
                    <div className="mm-risk-probabilities">
                      {Object.entries(risk_group.probabilities).map(([key, value]) => (
                        <div key={key} className="mm-prob-bar">
                          <span className="mm-prob-label">{key}</span>
                          <div className="mm-prob-track">
                            <div
                              className="mm-prob-fill"
                              style={{ width: formatPercent(value), backgroundColor: getRiskColor(key) }}
                            />
                          </div>
                          <span className="mm-prob-value">{formatPercent(value)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="mm-summary-cards">
                {os_days && (
                  <div className="mm-summary-card survival">
                    <div className="mm-card-icon">📅</div>
                    <div className="mm-card-content">
                      <span className="mm-card-label">예측 생존 기간</span>
                      <span className="mm-card-value">{os_days.predicted_months.toFixed(1)}개월</span>
                      <span className="mm-card-confidence">({os_days.predicted_days}일)</span>
                    </div>
                  </div>
                )}

                {survival?.survival_probability_12m !== undefined && (
                  <div className="mm-summary-card survival-rate">
                    <div className="mm-card-icon">📈</div>
                    <div className="mm-card-content">
                      <span className="mm-card-label">12개월 생존율</span>
                      <span className="mm-card-value">{formatPercent(survival.survival_probability_12m)}</span>
                    </div>
                  </div>
                )}

                {recurrence && (
                  <div className="mm-summary-card recurrence">
                    <div className="mm-card-icon">🔄</div>
                    <div className="mm-card-content">
                      <span className="mm-card-label">재발 예측</span>
                      <span className="mm-card-value">
                        {recurrence.predicted_class === 'Recurrence' ? '재발 가능' : '재발 없음'}
                      </span>
                      <span className="mm-card-confidence">{formatPercent(recurrence.recurrence_probability)}</span>
                    </div>
                  </div>
                )}

                {tmz_response && (
                  <div className="mm-summary-card tmz">
                    <div className="mm-card-icon">💊</div>
                    <div className="mm-card-content">
                      <span className="mm-card-label">TMZ 반응</span>
                      <span className="mm-card-value">
                        {tmz_response.predicted_class === 'Responder' ? '반응군' : '비반응군'}
                      </span>
                      <span className="mm-card-confidence">{formatPercent(tmz_response.responder_probability)}</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Recommendation */}
              {recommendation && (
                <div className="mm-recommendation">
                  <h4>권고사항</h4>
                  <p>{recommendation}</p>
                </div>
              )}

              {/* Meta Info */}
              <div className="mm-meta-info">
                <span>처리 시간: {inferenceResult.processing_time_ms?.toFixed(1) || 0}ms</span>
                <span>모델 버전: {inferenceResult.model_version || 'MM-v2.0'}</span>
              </div>
            </div>
          )}

          {/* Survival Tab */}
          {activeTab === 'survival' && (
            <div className="mm-tab-survival">
              {/* OS Days */}
              {os_days && (
                <div className="mm-survival-section">
                  <h4>예상 생존 기간</h4>
                  <div className="mm-os-display">
                    <div className="mm-os-main">
                      <div className="mm-os-value">{os_days.predicted_months.toFixed(1)}</div>
                      <div className="mm-os-unit">개월</div>
                    </div>
                    <div className="mm-os-detail">({os_days.predicted_days}일)</div>
                  </div>
                  {os_days.confidence_interval && (
                    <div className="mm-os-ci">
                      95% CI: {os_days.confidence_interval.lower.toFixed(1)} - {os_days.confidence_interval.upper.toFixed(1)}개월
                    </div>
                  )}
                </div>
              )}

              {/* Cox PH Analysis */}
              {survival && (
                <div className="mm-survival-section">
                  <h4>생존 분석 (Cox PH)</h4>
                  <div className="mm-stats-grid">
                    <div className="mm-stat-item">
                      <div className="mm-stat-label">위험비 (Hazard Ratio)</div>
                      <div className="mm-stat-value">{survival.hazard_ratio.toFixed(3)}</div>
                    </div>
                    <div className="mm-stat-item">
                      <div className="mm-stat-label">위험 점수</div>
                      <div className="mm-stat-value">{survival.risk_score.toFixed(3)}</div>
                    </div>
                    {survival.survival_probability_6m !== undefined && (
                      <div className="mm-stat-item highlight">
                        <div className="mm-stat-label">6개월 생존율</div>
                        <div className="mm-stat-value">{formatPercent(survival.survival_probability_6m)}</div>
                      </div>
                    )}
                    {survival.survival_probability_12m !== undefined && (
                      <div className="mm-stat-item highlight">
                        <div className="mm-stat-label">12개월 생존율</div>
                        <div className="mm-stat-value">{formatPercent(survival.survival_probability_12m)}</div>
                      </div>
                    )}
                    {survival.model_cindex !== undefined && (
                      <div className="mm-stat-item">
                        <div className="mm-stat-label">Model C-Index</div>
                        <div className="mm-stat-value">{survival.model_cindex.toFixed(4)}</div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Predictions Tab */}
          {activeTab === 'predictions' && (
            <div className="mm-tab-predictions">
              {/* Recurrence */}
              {recurrence && (
                <div className="mm-prediction-section">
                  <h4>재발 예측</h4>
                  <div className="mm-prediction-display">
                    <div className={`mm-prediction-class ${recurrence.predicted_class.toLowerCase().replace('_', '-')}`}>
                      {recurrence.predicted_class === 'Recurrence' ? '재발 위험' : '재발 없음'}
                    </div>
                    <div className="mm-prediction-prob">
                      <div className="mm-prob-circle">
                        <svg viewBox="0 0 100 100">
                          <circle
                            cx="50" cy="50" r="45"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="8"
                          />
                          <circle
                            cx="50" cy="50" r="45"
                            fill="none"
                            stroke={recurrence.recurrence_probability > 0.5 ? '#f59e0b' : '#22c55e'}
                            strokeWidth="8"
                            strokeDasharray={`${recurrence.recurrence_probability * 283} 283`}
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <div className="mm-prob-text">
                          {formatPercent(recurrence.recurrence_probability)}
                        </div>
                      </div>
                      <div className="mm-prob-circle-label">재발 확률</div>
                    </div>
                  </div>
                </div>
              )}

              {/* TMZ Response */}
              {tmz_response && (
                <div className="mm-prediction-section">
                  <h4>TMZ 치료 반응 예측</h4>
                  <div className="mm-prediction-display">
                    <div className={`mm-prediction-class ${tmz_response.predicted_class.toLowerCase().replace('_', '-')}`}>
                      {tmz_response.predicted_class === 'Responder' ? '반응군' : '비반응군'}
                    </div>
                    <div className="mm-prediction-prob">
                      <div className="mm-prob-circle">
                        <svg viewBox="0 0 100 100">
                          <circle
                            cx="50" cy="50" r="45"
                            fill="none"
                            stroke="#e2e8f0"
                            strokeWidth="8"
                          />
                          <circle
                            cx="50" cy="50" r="45"
                            fill="none"
                            stroke={tmz_response.responder_probability > 0.5 ? '#22c55e' : '#ef4444'}
                            strokeWidth="8"
                            strokeDasharray={`${tmz_response.responder_probability * 283} 283`}
                            transform="rotate(-90 50 50)"
                          />
                        </svg>
                        <div className="mm-prob-text">
                          {formatPercent(tmz_response.responder_probability)}
                        </div>
                      </div>
                      <div className="mm-prob-circle-label">반응 확률</div>
                    </div>
                  </div>
                </div>
              )}

              {/* Risk Group Detail */}
              {risk_group && (
                <div className="mm-prediction-section">
                  <h4>위험군 분류 상세</h4>
                  <div className="mm-risk-detail">
                    <div className="mm-risk-current">
                      <span className="mm-risk-current-label">현재 위험군:</span>
                      <span
                        className="mm-risk-current-value"
                        style={{ backgroundColor: getRiskColor(risk_group.predicted_class) }}
                      >
                        {risk_group.predicted_class}
                      </span>
                    </div>
                    <div className="mm-risk-bars">
                      {Object.entries(risk_group.probabilities)
                        .sort((a, b) => b[1] - a[1])
                        .map(([key, value]) => (
                          <div key={key} className="mm-risk-bar-item">
                            <div className="mm-risk-bar-label">{key}</div>
                            <div className="mm-risk-bar-track">
                              <div
                                className="mm-risk-bar-fill"
                                style={{ width: formatPercent(value), backgroundColor: getRiskColor(key) }}
                              />
                            </div>
                            <div className="mm-risk-bar-value">{formatPercent(value)}</div>
                          </div>
                        ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mm-inference-page">
      {/* Header */}
      <div className="mm-page-header">
        <div className="mm-header-content">
          <h2 className="mm-page-title">MM Multimodal 분석</h2>
          <p className="mm-page-subtitle">
            MRI, Gene, Protein 데이터를 융합하여 종합적인 예후 예측을 수행합니다.
          </p>
        </div>
        <div className="mm-connection-status">
          <span className={`mm-status-dot ${isFastAPIAvailable ? 'connected' : 'disconnected'}`} />
          <span className="mm-status-text">
            {isFastAPIAvailable ? 'AI 서버 연결됨' : 'AI 서버 OFF'}
          </span>
          <span className={`mm-status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="mm-status-text">
            {isConnected ? 'WebSocket 연결됨' : 'WebSocket 연결 안됨'}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="mm-main-grid">
        {/* Left Panel */}
        <div className="mm-left-panel">
          {/* Patient Selection */}
          <div className="mm-section mm-patient-section">
            <div className="mm-section-header">
              <h3 className="mm-section-title">환자 선택</h3>
              <label className="mm-research-toggle">
                <input
                  type="checkbox"
                  checked={isResearch}
                  onChange={(e) => setIsResearch(e.target.checked)}
                />
                <span className="mm-toggle-label">연구용</span>
                <span className="mm-toggle-hint">(다른 환자 데이터 조합 가능)</span>
              </label>
            </div>
            <select
              value={selectedPatient}
              onChange={(e) => handlePatientChange(e.target.value)}
              className="mm-patient-select"
              disabled={isResearch}
            >
              <option value="">{isResearch ? '연구용 모드: 모든 환자 데이터 선택 가능' : '환자를 선택하세요'}</option>
              {patients.map((patient) => (
                <option key={patient.patient_number} value={patient.patient_number}>
                  {patient.patient_number} - {patient.patient_name} ({patient.ocs_count}건)
                </option>
              ))}
            </select>
            {isResearch && (
              <p className="mm-research-notice">
                연구용 모드: 서로 다른 환자의 MRI, Gene, Protein 데이터를 조합하여 분석할 수 있습니다.
              </p>
            )}
          </div>

          {/* Modality Selection */}
          {(selectedPatient || isResearch) && (
            <div className="mm-section mm-modality-section">
              <div className="mm-section-header">
                <h3 className="mm-section-title">모달리티 선택</h3>
                <span className="mm-modality-count">
                  {selectedModalitiesCount}개 선택됨
                  {selectedModalitiesCount < 2 && <span className="mm-modality-hint"> (2개 이상 권장)</span>}
                </span>
              </div>

              <div className="mm-modality-grid">
                {/* MRI */}
                <div className={`mm-modality-card mri ${selectedMriOcs ? 'selected' : ''}`}>
                  <div className="mm-modality-card-header">
                    <span className="mm-modality-icon">🧠</span>
                    <span className="mm-modality-title">MRI</span>
                    {selectedMriOcs && <span className="mm-selected-indicator">✓</span>}
                  </div>
                  <select
                    value={selectedMriOcs || ''}
                    onChange={(e) => setSelectedMriOcs(e.target.value ? Number(e.target.value) : null)}
                    className="mm-modality-select"
                  >
                    <option value="">선택 안함</option>
                    {filteredMriOcsList.map((ocs) => (
                      <option key={ocs.id} value={ocs.id}>
                        {ocs.ocs_id} {isResearch && ocs.patient_name ? `(${ocs.patient_name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mm-modality-count-text">{filteredMriOcsList.length}건 가능</p>
                </div>

                {/* Gene */}
                <div className={`mm-modality-card gene ${selectedGeneOcs ? 'selected' : ''}`}>
                  <div className="mm-modality-card-header">
                    <span className="mm-modality-icon">🧬</span>
                    <span className="mm-modality-title">Gene</span>
                    {selectedGeneOcs && <span className="mm-selected-indicator">✓</span>}
                  </div>
                  <select
                    value={selectedGeneOcs || ''}
                    onChange={(e) => setSelectedGeneOcs(e.target.value ? Number(e.target.value) : null)}
                    className="mm-modality-select"
                  >
                    <option value="">선택 안함</option>
                    {filteredGeneOcsList.map((ocs) => (
                      <option key={ocs.id} value={ocs.id}>
                        {ocs.ocs_id} {isResearch && ocs.patient_name ? `(${ocs.patient_name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mm-modality-count-text">{filteredGeneOcsList.length}건 가능</p>
                </div>

                {/* Protein */}
                <div className={`mm-modality-card protein ${selectedProteinOcs ? 'selected' : ''}`}>
                  <div className="mm-modality-card-header">
                    <span className="mm-modality-icon">🔬</span>
                    <span className="mm-modality-title">Protein</span>
                    {selectedProteinOcs && <span className="mm-selected-indicator">✓</span>}
                  </div>
                  <select
                    value={selectedProteinOcs || ''}
                    onChange={(e) => setSelectedProteinOcs(e.target.value ? Number(e.target.value) : null)}
                    className="mm-modality-select"
                  >
                    <option value="">선택 안함</option>
                    {filteredProteinOcsList.map((ocs) => (
                      <option key={ocs.id} value={ocs.id}>
                        {ocs.ocs_id} {isResearch && ocs.patient_name ? `(${ocs.patient_name})` : ''}
                      </option>
                    ))}
                  </select>
                  <p className="mm-modality-count-text">{filteredProteinOcsList.length}건 가능</p>
                </div>
              </div>

              {/* Inference Button */}
              <button
                onClick={handleRequestInference}
                disabled={
                  selectedModalitiesCount < 1 ||
                  inferenceStatus === 'requesting' ||
                  inferenceStatus === 'processing'
                }
                className={`mm-btn-inference ${
                  selectedModalitiesCount < 1 ||
                  inferenceStatus === 'requesting' ||
                  inferenceStatus === 'processing'
                    ? 'disabled'
                    : ''
                }`}
              >
                {(inferenceStatus === 'requesting' || inferenceStatus === 'processing') && jobId
                  ? 'MM 추론 진행 중...'
                  : `MM 추론 요청 (${selectedModalitiesCount}개 모달리티)`}
              </button>
            </div>
          )}
        </div>

        {/* Right Panel - Result Viewer */}
        <div className="mm-right-panel">
          {renderResultViewer()}
        </div>
      </div>

      {/* Inference History */}
      <div className="mm-section mm-history-section">
        <div className="mm-section-header">
          <h3 className="mm-section-title">
            추론 이력 ({inferenceHistory.length}건)
          </h3>
          <button onClick={loadInferenceHistory} className="mm-btn-refresh">
            새로고침
          </button>
        </div>

        <div className="mm-history-table-container">
          {loadingHistory ? (
            <div className="mm-loading">
              <div className="mm-spinner"></div>
            </div>
          ) : inferenceHistory.length > 0 ? (
            <table className="mm-history-table">
              <thead>
                <tr>
                  <th>Job ID</th>
                  <th>환자</th>
                  <th>모달리티</th>
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
                    <td>
                      <div className="mm-modality-badges-small">
                        {record.mri_ocs && <span className="mm-modality-badge-small mri">MRI</span>}
                        {record.gene_ocs && <span className="mm-modality-badge-small gene">Gene</span>}
                        {record.protein_ocs && <span className="mm-modality-badge-small protein">Protein</span>}
                      </div>
                    </td>
                    <td>{getStatusBadge(record.status)}</td>
                    <td>
                      {record.status === 'COMPLETED' && record.result_data?.risk_group ? (
                        <span
                          className="mm-result-preview"
                          style={{
                            backgroundColor: getRiskColor(record.result_data.risk_group.predicted_class),
                          }}
                        >
                          {record.result_data.risk_group.predicted_class}
                        </span>
                      ) : record.status === 'FAILED' ? (
                        <span className="mm-result-error">
                          {record.error_message || 'Error'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {record.status === 'COMPLETED' && record.result_data?.processing_time_ms ? (
                        <span className="mm-processing-time">
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
                      <div className="mm-action-buttons">
                        {record.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => handleSelectHistory(record)}
                              className="mm-btn-action mm-btn-view"
                            >
                              보기
                            </button>
                            <button
                              onClick={() => handleViewDetail(record)}
                              className="mm-btn-action mm-btn-detail"
                            >
                              상세
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteInference(record)}
                          className="mm-btn-action mm-btn-delete"
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
            <div className="mm-empty">
              <span>추론 이력이 없습니다.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
