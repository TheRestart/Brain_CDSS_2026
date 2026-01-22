import { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { OCSTable, type OCSItem } from '@/components/OCSTable'
import GeneVisualization from '@/components/GeneVisualization'
import type { GeneExpressionData } from '@/components/GeneVisualization/GeneVisualization'
import { useAIInference } from '@/context/AIInferenceContext'
import { ocsApi, aiApi } from '@/services/ai.api'
import './MGInferencePage.css'

interface PatientOption {
  patient_number: string
  patient_name: string
}

interface TopGeneInfo {
  rank: number
  gene: string
  attention_score: number
  expression_zscore: number
}

interface DEGClusterInfo {
  score: number
  up_genes_count: number
  down_genes_count: number
}

interface XAIResult {
  attention_weights?: number[]
  top_genes?: TopGeneInfo[]
  gene_importance_summary?: {
    total_genes: number
    attention_mean: number
    attention_std: number
    attention_max: number
    attention_min: number
  }
  deg_cluster_scores?: Record<string, DEGClusterInfo>
  expression_stats?: {
    mean: number
    std: number
    min: number
    max: number
    positive_count: number
    negative_count: number
  }
}

interface Visualizations {
  grade_chart?: string
  risk_gauge?: string
  survival_chart?: string
  recurrence_chart?: string
  top_genes_chart?: string
  deg_cluster_chart?: string
  attention_distribution_chart?: string
  expression_profile_chart?: string
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
  xai?: XAIResult
  visualizations?: Visualizations
  processing_time_ms?: number
  input_genes_count?: number
  model_version?: string
}

interface InferenceRecord {
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

type MGTabType = 'summary' | 'details' | 'genes' | 'visualizations'

export default function MGInferencePage() {
  const navigate = useNavigate()

  // AI Inference Context
  const { requestInference, isFastAPIAvailable, lastMessage, isConnected } = useAIInference()

  // State
  const [ocsData, setOcsData] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOcs, setSelectedOcs] = useState<OCSItem | null>(null)
  const [inferenceStatus, setInferenceStatus] = useState<string>('')
  const [inferenceResult, setInferenceResult] = useState<MGResult | null>(null)
  const [error, setError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [isCached, setIsCached] = useState<boolean>(false)
  const [activeTab, setActiveTab] = useState<MGTabType>('summary')

  // Patient selection
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string>('')
  const [isResearch, setIsResearch] = useState<boolean>(false)

  // Gene Expression visualization
  const [geneExpData, setGeneExpData] = useState<GeneExpressionData | null>(null)
  const [loadingGeneExp, setLoadingGeneExp] = useState(false)
  const [geneExpError, setGeneExpError] = useState<string>('')

  // Inference history
  const [inferenceHistory, setInferenceHistory] = useState<InferenceRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // Load OCS data
  useEffect(() => {
    loadOcsData()
    loadInferenceHistory()
  }, [])

  // WebSocket message handling
  useEffect(() => {
    if (lastMessage?.type === 'AI_INFERENCE_RESULT') {
      console.log('Received MG inference result:', lastMessage)

      if (lastMessage.job_id === jobId) {
        if (lastMessage.status === 'COMPLETED') {
          setInferenceStatus('completed')
          if (lastMessage.result) {
            setInferenceResult(lastMessage.result as MGResult)
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

  const loadOcsData = async () => {
    try {
      setLoading(true)
      const response = await ocsApi.getRnaSeqOcsList()
      const rawData = response.results || response || []

      // Extract patient list
      const patientMap = new Map<string, PatientOption>()
      rawData.forEach((item: any) => {
        if (item.patient?.patient_number) {
          patientMap.set(item.patient.patient_number, {
            patient_number: item.patient.patient_number,
            patient_name: item.patient.name || '',
          })
        }
      })
      setPatients(Array.from(patientMap.values()))

      // Map data
      const mappedData: OCSItem[] = rawData.map((item: any) => ({
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

  // Filter OCS by patient
  const filteredOcsData = useMemo(() => {
    if (isResearch || !selectedPatient) return ocsData
    return ocsData.filter(ocs => ocs.patient_number === selectedPatient)
  }, [ocsData, selectedPatient, isResearch])

  const handlePatientChange = (patientNumber: string) => {
    setSelectedPatient(patientNumber)
    setSelectedOcs(null)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
    setGeneExpData(null)
  }

  const loadInferenceHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await aiApi.getInferenceList('MG')
      setInferenceHistory(data || [])
    } catch (err) {
      console.error('Failed to load MG inference history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Load Gene Expression data
  const loadGeneExpressionData = async (ocsId: number) => {
    try {
      setLoadingGeneExp(true)
      setGeneExpError('')
      const data = await aiApi.getGeneExpressionData(ocsId)
      setGeneExpData(data)
    } catch (err: any) {
      console.error('Failed to load gene expression data:', err)
      setGeneExpError(err.response?.data?.error || '유전자 발현 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoadingGeneExp(false)
    }
  }

  const handleSelectOcs = (ocs: OCSItem) => {
    setSelectedOcs(ocs)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
    setIsCached(false)
    loadGeneExpressionData(ocs.id)
  }

  const handleRequestInference = async () => {
    if (!selectedOcs) {
      setError('OCS를 선택해주세요.')
      return
    }

    try {
      setInferenceStatus('requesting')
      setError('')
      setInferenceResult(null)
      setIsCached(false)

      const job = await requestInference('MG', { ocs_id: selectedOcs.id, mode: 'manual' })

      if (!job) {
        setInferenceStatus('failed')
        setError('AI 서버 연결 실패. 서버 상태를 확인해주세요.')
        return
      }

      setJobId(job.job_id)

      if (job.cached && job.result) {
        console.log('Using cached MG inference result:', job)
        setIsCached(true)
        setInferenceStatus('completed')
        setInferenceResult(job.result as MGResult)
      } else {
        setInferenceStatus('processing')
        console.log('MG Inference request sent:', job)
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
      console.error('MG Inference error:', err.response?.data || err)
    }
  }

  const handleViewDetail = (record: InferenceRecord) => {
    navigate(`/ai/mg/${record.job_id}`)
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
      COMPLETED: { className: 'mg-status-badge mg-status-completed', label: '완료' },
      PROCESSING: { className: 'mg-status-badge mg-status-processing', label: '처리중' },
      PENDING: { className: 'mg-status-badge mg-status-pending', label: '대기' },
      FAILED: { className: 'mg-status-badge mg-status-failed', label: '실패' },
    }
    const { className, label } = statusMap[status] || { className: 'mg-status-badge mg-status-pending', label: status }
    return <span className={className}>{label}</span>
  }

  // Risk category helpers
  const getRiskCategory = (score: number): string => {
    if (score < 0.33) return 'Low'
    if (score < 0.66) return 'Medium'
    return 'High'
  }

  const getRiskColorClass = (score: number) => {
    if (score < 0.33) return 'mg-risk-low'
    if (score < 0.66) return 'mg-risk-medium'
    return 'mg-risk-high'
  }

  const toPercent = (value: number) => Math.round(value * 100)

  // Result Viewer Component
  const renderResultViewer = () => {
    // Loading state
    if (inferenceStatus === 'requesting' || inferenceStatus === 'processing') {
      return (
        <div className="mg-result-viewer">
          <div className="mg-result-header">
            <h3>MG Gene Expression 분석 결과</h3>
            <span className="mg-model-badge">Gene Analysis</span>
          </div>
          <div className="mg-result-content">
            <div className="mg-loading">
              <div className="mg-spinner"></div>
              <span>MG 추론 진행 중...</span>
              {jobId && <span className="mg-job-info">Job: {jobId}</span>}
            </div>
          </div>
        </div>
      )
    }

    // Error state
    if (inferenceStatus === 'failed' && error) {
      return (
        <div className="mg-result-viewer">
          <div className="mg-result-header">
            <h3>MG Gene Expression 분석 결과</h3>
            <span className="mg-model-badge">Gene Analysis</span>
          </div>
          <div className="mg-result-content">
            <div className="mg-error">
              <span className="mg-error-icon">!</span>
              {error}
            </div>
          </div>
        </div>
      )
    }

    // Empty state
    if (!inferenceResult) {
      return (
        <div className="mg-result-viewer">
          <div className="mg-result-header">
            <h3>MG Gene Expression 분석 결과</h3>
            <span className="mg-model-badge">Gene Analysis</span>
          </div>
          <div className="mg-result-content">
            <div className="mg-empty">
              <span className="mg-empty-icon">🧬</span>
              <span>OCS를 선택하고 MG 추론을 요청하면 결과가 표시됩니다.</span>
            </div>
          </div>
        </div>
      )
    }

    const { survival_risk, survival_time, grade, recurrence, tmz_response, xai, visualizations } = inferenceResult

    return (
      <div className="mg-result-viewer">
        {/* Header */}
        <div className="mg-result-header">
          <h3>MG Gene Expression 분석 결과</h3>
          {jobId && (
            <span className="mg-job-id">Job: {jobId}</span>
          )}
          {isCached && (
            <span className="mg-cached-badge">캐시됨</span>
          )}
        </div>

        {/* Tab Navigation */}
        <div className="mg-result-tabs">
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
          {xai && (
            <button
              className={activeTab === 'genes' ? 'active' : ''}
              onClick={() => setActiveTab('genes')}
            >
              유전자 분석
            </button>
          )}
          {visualizations && (
            <button
              className={activeTab === 'visualizations' ? 'active' : ''}
              onClick={() => setActiveTab('visualizations')}
            >
              시각화
            </button>
          )}
        </div>

        {/* Tab Content */}
        <div className="mg-result-content">
          {/* Summary Tab */}
          {activeTab === 'summary' && (
            <div className="mg-tab-summary">
              {/* Risk Gauge */}
              {survival_risk && (
                <div className="mg-risk-gauge-section">
                  <h4>생존 위험도</h4>
                  <div className="mg-risk-gauge">
                    <div
                      className={`mg-risk-indicator ${getRiskColorClass(survival_risk.risk_score)}`}
                      style={{ left: `${Math.max(0, Math.min(survival_risk.risk_score * 100, 100))}%` }}
                    />
                  </div>
                  <div className="mg-risk-scale">
                    <span>Low</span>
                    <span>Medium</span>
                    <span>High</span>
                  </div>
                  <div className="mg-risk-value">
                    <span className={`mg-risk-category ${getRiskColorClass(survival_risk.risk_score)}`}>
                      {getRiskCategory(survival_risk.risk_score)}
                    </span>
                    <span className="mg-risk-score">Score: {survival_risk.risk_score.toFixed(3)}</span>
                  </div>
                </div>
              )}

              {/* Summary Cards */}
              <div className="mg-summary-cards">
                {grade && (
                  <div className="mg-summary-card grade">
                    <div className="mg-card-icon">🧬</div>
                    <div className="mg-card-content">
                      <span className="mg-card-label">종양 등급</span>
                      <span className="mg-card-value">{grade.predicted_class}</span>
                      <span className="mg-card-confidence">{toPercent(grade.probability)}% 신뢰도</span>
                    </div>
                  </div>
                )}

                {survival_time && (
                  <div className="mg-summary-card survival">
                    <div className="mg-card-icon">📅</div>
                    <div className="mg-card-content">
                      <span className="mg-card-label">예측 생존 기간</span>
                      <span className="mg-card-value">{survival_time.predicted_months.toFixed(1)}개월</span>
                      <span className="mg-card-confidence">({survival_time.predicted_days}일)</span>
                    </div>
                  </div>
                )}

                {recurrence && (
                  <div className="mg-summary-card recurrence">
                    <div className="mg-card-icon">🔄</div>
                    <div className="mg-card-content">
                      <span className="mg-card-label">재발 예측</span>
                      <span className="mg-card-value">
                        {recurrence.predicted_class === 'Recurrence' ? '재발 가능' : '재발 없음'}
                      </span>
                      <span className="mg-card-confidence">{toPercent(recurrence.probability)}% 확률</span>
                    </div>
                  </div>
                )}

                {tmz_response && (
                  <div className="mg-summary-card tmz">
                    <div className="mg-card-icon">💊</div>
                    <div className="mg-card-content">
                      <span className="mg-card-label">TMZ 반응</span>
                      <span className="mg-card-value">
                        {tmz_response.predicted_class === 'Responder' || tmz_response.predicted_class === 'Likely Responsive' ? '반응 예상' : '비반응 예상'}
                      </span>
                      <span className="mg-card-confidence">{toPercent(tmz_response.probability)}% 확률</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Meta Info */}
              <div className="mg-meta-info">
                <span>분석 유전자: {inferenceResult.input_genes_count || '-'}개</span>
                <span>처리 시간: {inferenceResult.processing_time_ms?.toFixed(1) || 0}ms</span>
              </div>
            </div>
          )}

          {/* Details Tab */}
          {activeTab === 'details' && (
            <div className="mg-tab-details">
              {/* Grade */}
              {grade && (
                <div className="mg-detail-section">
                  <h4>종양 등급 (Grade)</h4>
                  <div className="mg-detail-result">
                    <span className="mg-detail-label">예측 결과:</span>
                    <span className={`mg-detail-value ${grade.predicted_class.toLowerCase().replace(' ', '-')}`}>
                      {grade.predicted_class}
                    </span>
                  </div>
                  <div className="mg-probability-bars">
                    <div className="mg-prob-bar">
                      <span className="mg-prob-label">LGG</span>
                      <div className="mg-prob-track">
                        <div
                          className="mg-prob-fill lgg"
                          style={{ width: `${toPercent(grade.lgg_probability || 0)}%` }}
                        />
                      </div>
                      <span className="mg-prob-value">{toPercent(grade.lgg_probability || 0)}%</span>
                    </div>
                    <div className="mg-prob-bar">
                      <span className="mg-prob-label">HGG</span>
                      <div className="mg-prob-track">
                        <div
                          className="mg-prob-fill hgg"
                          style={{ width: `${toPercent(grade.hgg_probability || 0)}%` }}
                        />
                      </div>
                      <span className="mg-prob-value">{toPercent(grade.hgg_probability || 0)}%</span>
                    </div>
                  </div>
                </div>
              )}

              {/* Recurrence */}
              {recurrence && (
                <div className="mg-detail-section">
                  <h4>재발 예측 (Recurrence)</h4>
                  <div className="mg-detail-result">
                    <span className="mg-detail-label">예측 결과:</span>
                    <span className={`mg-detail-value ${recurrence.predicted_class === 'Recurrence' ? 'positive' : 'negative'}`}>
                      {recurrence.predicted_class === 'Recurrence' ? '재발 가능성 있음' : '재발 가능성 낮음'}
                    </span>
                  </div>
                  <div className="mg-single-prob-bar">
                    <span>재발 확률:</span>
                    <div className="mg-prob-track">
                      <div
                        className="mg-prob-fill recurrence"
                        style={{ width: `${toPercent(recurrence.recurrence_probability || 0)}%` }}
                      />
                    </div>
                    <span>{toPercent(recurrence.recurrence_probability || 0)}%</span>
                  </div>
                </div>
              )}

              {/* TMZ Response */}
              {tmz_response && (
                <div className="mg-detail-section">
                  <h4>TMZ 치료 반응</h4>
                  <div className="mg-detail-result">
                    <span className="mg-detail-label">예측 결과:</span>
                    <span className={`mg-detail-value ${tmz_response.predicted_class === 'Responder' || tmz_response.predicted_class === 'Likely Responsive' ? 'negative' : 'positive'}`}>
                      {tmz_response.predicted_class === 'Responder' || tmz_response.predicted_class === 'Likely Responsive' ? '반응 예상' : '비반응 예상'}
                    </span>
                  </div>
                  <div className="mg-single-prob-bar">
                    <span>반응 확률:</span>
                    <div className="mg-prob-track">
                      <div
                        className="mg-prob-fill tmz"
                        style={{ width: `${toPercent(tmz_response.responder_probability || 0)}%` }}
                      />
                    </div>
                    <span>{toPercent(tmz_response.responder_probability || 0)}%</span>
                  </div>
                </div>
              )}

              {/* Survival */}
              {survival_risk && survival_time && (
                <div className="mg-detail-section">
                  <h4>생존 분석</h4>
                  <div className="mg-survival-display">
                    <div className="mg-survival-main">
                      <div className="mg-survival-value">{survival_time.predicted_months.toFixed(1)}</div>
                      <div className="mg-survival-unit">개월</div>
                    </div>
                    <div className="mg-survival-detail">
                      ({survival_time.predicted_days}일)
                    </div>
                  </div>
                  {survival_time.confidence_interval && (
                    <div className="mg-confidence-interval">
                      신뢰 구간: {survival_time.confidence_interval.lower.toFixed(1)} ~ {survival_time.confidence_interval.upper.toFixed(1)}개월
                    </div>
                  )}
                  <div className="mg-survival-risk">
                    <span>위험 카테고리:</span>
                    <span className={`mg-risk-tag ${getRiskColorClass(survival_risk.risk_score)}`}>
                      {getRiskCategory(survival_risk.risk_score)}
                    </span>
                    <span>Risk Score: {survival_risk.risk_score.toFixed(4)}</span>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Genes Tab (XAI) */}
          {activeTab === 'genes' && xai && (
            <div className="mg-tab-genes">
              {/* Top Genes */}
              {xai.top_genes && xai.top_genes.length > 0 && (
                <div className="mg-xai-section">
                  <h4>Top Important Genes (Attention 기반)</h4>
                  <div className="mg-top-genes-table">
                    <div className="mg-table-header">
                      <span className="mg-col-rank">순위</span>
                      <span className="mg-col-gene">유전자</span>
                      <span className="mg-col-attention">Attention</span>
                      <span className="mg-col-zscore">Z-Score</span>
                    </div>
                    {xai.top_genes.map((gene, idx) => (
                      <div key={idx} className="mg-table-row">
                        <span className="mg-col-rank">#{gene.rank}</span>
                        <span className="mg-col-gene">{gene.gene}</span>
                        <span className="mg-col-attention">
                          <div className="mg-attention-bar-track">
                            <div
                              className="mg-attention-bar-fill"
                              style={{ width: `${Math.min(gene.attention_score * 100, 100)}%` }}
                            />
                          </div>
                          <span>{gene.attention_score.toFixed(4)}</span>
                        </span>
                        <span className={`mg-col-zscore ${gene.expression_zscore >= 0 ? 'positive' : 'negative'}`}>
                          {gene.expression_zscore >= 0 ? '+' : ''}
                          {gene.expression_zscore.toFixed(2)}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* DEG Cluster Scores */}
              {xai.deg_cluster_scores && (
                <div className="mg-xai-section">
                  <h4>DEG Cluster Scores</h4>
                  <div className="mg-deg-clusters">
                    {Object.entries(xai.deg_cluster_scores).map(([cluster, info]) => (
                      <div key={cluster} className="mg-deg-cluster-item">
                        <div className="mg-cluster-name">{cluster}</div>
                        <div className="mg-cluster-score">
                          <div className="mg-score-bar-track">
                            <div
                              className={`mg-score-bar-fill ${info.score >= 0 ? 'positive' : 'negative'}`}
                              style={{ width: `${Math.min(Math.abs(info.score) * 10, 100)}%` }}
                            />
                          </div>
                          <span className={info.score >= 0 ? 'positive' : 'negative'}>
                            {info.score >= 0 ? '+' : ''}{info.score.toFixed(2)}
                          </span>
                        </div>
                        <div className="mg-cluster-counts">
                          <span className="mg-up-count">Up: {info.up_genes_count}</span>
                          <span className="mg-down-count">Down: {info.down_genes_count}</span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Gene Importance Summary */}
              {xai.gene_importance_summary && (
                <div className="mg-xai-section">
                  <h4>Gene Importance 요약</h4>
                  <div className="mg-importance-stats">
                    <div className="mg-stat-item">
                      <span className="mg-stat-label">Total Genes</span>
                      <span className="mg-stat-value">{xai.gene_importance_summary.total_genes}</span>
                    </div>
                    <div className="mg-stat-item">
                      <span className="mg-stat-label">Attention 평균</span>
                      <span className="mg-stat-value">{xai.gene_importance_summary.attention_mean.toFixed(4)}</span>
                    </div>
                    <div className="mg-stat-item">
                      <span className="mg-stat-label">Attention 표준편차</span>
                      <span className="mg-stat-value">{xai.gene_importance_summary.attention_std.toFixed(4)}</span>
                    </div>
                    <div className="mg-stat-item">
                      <span className="mg-stat-label">Attention Max</span>
                      <span className="mg-stat-value">{xai.gene_importance_summary.attention_max.toFixed(4)}</span>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Visualizations Tab */}
          {activeTab === 'visualizations' && visualizations && (
            <div className="mg-tab-visualizations">
              {visualizations.grade_chart && (
                <div className="mg-viz-section">
                  <h4>Grade 차트</h4>
                  <img
                    src={`data:image/png;base64,${visualizations.grade_chart}`}
                    alt="Grade Chart"
                    className="mg-visualization-image"
                  />
                </div>
              )}
              {visualizations.survival_chart && (
                <div className="mg-viz-section">
                  <h4>생존 곡선</h4>
                  <img
                    src={`data:image/png;base64,${visualizations.survival_chart}`}
                    alt="Survival Chart"
                    className="mg-visualization-image"
                  />
                </div>
              )}
              {visualizations.top_genes_chart && (
                <div className="mg-viz-section">
                  <h4>Top Genes 차트</h4>
                  <img
                    src={`data:image/png;base64,${visualizations.top_genes_chart}`}
                    alt="Top Genes Chart"
                    className="mg-visualization-image"
                  />
                </div>
              )}
              {!visualizations.grade_chart && !visualizations.survival_chart && !visualizations.top_genes_chart && (
                <div className="mg-empty">
                  <span className="mg-empty-icon">📊</span>
                  <span>시각화 데이터가 없습니다.</span>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="mg-inference-page">
      {/* Header */}
      <div className="mg-page-header">
        <div className="mg-header-content">
          <h2 className="mg-page-title">MG Gene Expression 분석</h2>
          <p className="mg-page-subtitle">
            RNA-seq 유전자 발현 데이터를 분석하여 생존 예측, Grade, 재발, TMZ 반응을 예측합니다.
          </p>
        </div>
        <div className="mg-connection-status">
          <span className={`mg-status-dot ${isFastAPIAvailable ? 'connected' : 'disconnected'}`} />
          <span className="mg-status-text">
            {isFastAPIAvailable ? 'AI 서버 연결됨' : 'AI 서버 OFF'}
          </span>
          <span className={`mg-status-dot ${isConnected ? 'connected' : 'disconnected'}`} />
          <span className="mg-status-text">
            {isConnected ? 'WebSocket 연결됨' : 'WebSocket 연결 안됨'}
          </span>
        </div>
      </div>

      {/* Main Content Grid */}
      <div className="mg-main-grid">
        {/* Left Panel */}
        <div className="mg-left-panel">
          {/* Patient Selection */}
          <div className="mg-section mg-patient-section">
            <div className="mg-section-header">
              <h3 className="mg-section-title">환자 선택</h3>
              <label className="mg-research-toggle">
                <input
                  type="checkbox"
                  checked={isResearch}
                  onChange={(e) => setIsResearch(e.target.checked)}
                />
                <span className="mg-toggle-label">연구용</span>
                <span className="mg-toggle-hint">(모든 환자 데이터 표시)</span>
              </label>
            </div>
            <select
              value={selectedPatient}
              onChange={(e) => handlePatientChange(e.target.value)}
              className="mg-patient-select"
              disabled={isResearch}
            >
              <option value="">{isResearch ? '연구용 모드: 모든 환자 데이터 표시' : '환자를 선택하세요'}</option>
              {patients.map((patient) => (
                <option key={patient.patient_number} value={patient.patient_number}>
                  {patient.patient_number} - {patient.patient_name}
                </option>
              ))}
            </select>
            {isResearch && (
              <p className="mg-research-notice">
                연구용 모드: 모든 환자의 RNA-seq 데이터를 조회할 수 있습니다.
              </p>
            )}
          </div>

          {/* OCS Table */}
          {(selectedPatient || isResearch) && (
            <div className="mg-section mg-ocs-section">
              <div className="mg-section-header">
                <h3 className="mg-section-title">
                  LIS RNA_SEQ 목록 ({filteredOcsData.length}건)
                </h3>
                <button onClick={loadOcsData} className="mg-btn-refresh">
                  새로고침
                </button>
              </div>

              <OCSTable
                data={filteredOcsData}
                selectedId={selectedOcs?.id || null}
                onSelect={handleSelectOcs}
                loading={loading}
              />
            </div>
          )}

          {/* Selected OCS Info */}
          {selectedOcs && (
            <div className="mg-section mg-selected-section">
              <h3 className="mg-section-title">선택된 OCS</h3>
              <div className="mg-selected-info">
                <div className="mg-info-row">
                  <span className="mg-info-label">OCS ID</span>
                  <span className="mg-info-value">{selectedOcs.ocs_id}</span>
                </div>
                <div className="mg-info-row">
                  <span className="mg-info-label">환자</span>
                  <span className="mg-info-value">
                    {selectedOcs.patient_name} ({selectedOcs.patient_number})
                  </span>
                </div>
                <div className="mg-info-row">
                  <span className="mg-info-label">검사유형</span>
                  <span className="mg-info-value">{selectedOcs.job_type}</span>
                </div>
                <div className="mg-info-row">
                  <span className="mg-info-label">파일경로</span>
                  <span className="mg-info-value truncate">
                    {selectedOcs.worker_result?.file_path || '-'}
                  </span>
                </div>
              </div>
              <button
                onClick={handleRequestInference}
                disabled={
                  inferenceStatus === 'requesting' ||
                  inferenceStatus === 'processing'
                }
                className={`mg-btn-inference ${
                  inferenceStatus === 'requesting' ||
                  inferenceStatus === 'processing'
                    ? 'disabled'
                    : ''
                }`}
              >
                {(inferenceStatus === 'requesting' || inferenceStatus === 'processing') && jobId
                  ? 'MG 추론 진행 중...'
                  : 'MG 추론 요청'}
              </button>
            </div>
          )}

          {/* Gene Expression Visualization */}
          {selectedOcs && (
            <GeneVisualization
              data={geneExpData}
              patientId={selectedOcs.patient_number}
              loading={loadingGeneExp}
              error={geneExpError}
            />
          )}
        </div>

        {/* Right Panel - Result Viewer */}
        <div className="mg-right-panel">
          {renderResultViewer()}
        </div>
      </div>

      {/* Inference History */}
      <div className="mg-section mg-history-section">
        <div className="mg-section-header">
          <h3 className="mg-section-title">
            추론 이력 ({inferenceHistory.length}건)
          </h3>
          <button onClick={loadInferenceHistory} className="mg-btn-refresh">
            새로고침
          </button>
        </div>

        <div className="mg-history-table-container">
          {loadingHistory ? (
            <div className="mg-loading">
              <div className="mg-spinner"></div>
            </div>
          ) : inferenceHistory.length > 0 ? (
            <table className="mg-history-table">
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
                        <span className="mg-result-preview">
                          Grade: {record.result_data.grade.predicted_class}
                        </span>
                      ) : record.status === 'FAILED' ? (
                        <span className="mg-result-error">
                          {record.error_message || 'Error'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td>
                      {record.status === 'COMPLETED' && record.result_data?.processing_time_ms ? (
                        <span className="mg-processing-time">
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
                      <div className="mg-action-buttons">
                        {record.status === 'COMPLETED' && (
                          <>
                            <button
                              onClick={() => handleSelectHistory(record)}
                              className="mg-btn-action mg-btn-view"
                            >
                              보기
                            </button>
                            <button
                              onClick={() => handleViewDetail(record)}
                              className="mg-btn-action mg-btn-detail"
                            >
                              상세
                            </button>
                          </>
                        )}
                        <button
                          onClick={() => handleDeleteInference(record)}
                          className="mg-btn-action mg-btn-delete"
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
            <div className="mg-empty">
              <span>추론 이력이 없습니다.</span>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
