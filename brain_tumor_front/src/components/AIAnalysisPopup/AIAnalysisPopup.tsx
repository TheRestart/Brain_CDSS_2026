/**
 * AI 분석 팝업 컴포넌트
 * - M1: MRI 영상 분석
 * - MG: Gene Expression 분석
 * - MM: 멀티모달 분석
 *
 * 전역 AIInferenceContext를 사용하여 페이지 이동 시에도 작업 상태 유지
 */
import { useState, useEffect } from 'react'
import { api } from '@/services/api'
import { useAIInference, useAIJob } from '@/context/AIInferenceContext'
import './AIAnalysisPopup.css'

// ============================================================================
// Types
// ============================================================================
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

type TabType = 'm1' | 'mg' | 'mm'

interface AIAnalysisPopupProps {
  isOpen: boolean
  onClose: () => void
  initialTab?: TabType
  patientId?: number  // 환자 ID가 있으면 해당 환자의 OCS만 필터링
}

// ============================================================================
// Main Component
// ============================================================================
export default function AIAnalysisPopup({ isOpen, onClose, initialTab = 'm1', patientId }: AIAnalysisPopupProps) {
  const [activeTab, setActiveTab] = useState<TabType>(initialTab)

  // initialTab 변경 시 activeTab 업데이트
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab)
    }
  }, [isOpen, initialTab])

  // ESC 키로 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose()
    }
    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden'
    }
    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="ai-popup-overlay" onClick={onClose}>
      <div className="ai-popup-container" onClick={e => e.stopPropagation()}>
        {/* Header */}
        <header className="ai-popup-header">
          <div>
            <h1 className="ai-popup-title">Brain Tumor CDSS</h1>
            <p className="ai-popup-subtitle">AI 기반 뇌종양 분석 시스템</p>
          </div>
          <button className="ai-popup-close" onClick={onClose}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>
        </header>

        {/* Tabs */}
        <nav className="ai-popup-tabs">
          <button
            className={`ai-popup-tab ${activeTab === 'm1' ? 'active' : ''}`}
            onClick={() => setActiveTab('m1')}
          >
            <span>🧠</span> M1 MRI 분석
          </button>
          <button
            className={`ai-popup-tab ${activeTab === 'mg' ? 'active' : ''}`}
            onClick={() => setActiveTab('mg')}
          >
            <span>🧬</span> MG Gene Analysis
          </button>
          <button
            className={`ai-popup-tab ${activeTab === 'mm' ? 'active' : ''}`}
            onClick={() => setActiveTab('mm')}
          >
            <span>🔬</span> MM 멀티모달
          </button>
        </nav>

        {/* Content */}
        <main className="ai-popup-content">
          {activeTab === 'm1' && <M1Panel patientId={patientId} />}
          {activeTab === 'mg' && <MGPanel patientId={patientId} />}
          {activeTab === 'mm' && <MMPanel patientId={patientId} />}
        </main>
      </div>
    </div>
  )
}

// ============================================================================
// M1 Panel - MRI 분석
// ============================================================================
function M1Panel({ patientId }: { patientId?: number }) {
  const { requestInference, isFastAPIAvailable } = useAIInference()
  const [ocsList, setOcsList] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 현재 작업 구독
  const { job } = useAIJob(currentJobId)
  const inferring = job?.status === 'PENDING' || job?.status === 'PROCESSING'
  const result = job?.status === 'COMPLETED' ? job.result : null

  useEffect(() => {
    loadOcsList()
  }, [patientId])

  const loadOcsList = async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = {
        job_role: 'RIS',
        job_type: 'MRI',
        ocs_status: 'CONFIRMED',
        page_size: 50
      }
      // patientId가 있으면 해당 환자의 OCS만 조회
      if (patientId) {
        params.patient_id = patientId
      }
      const res = await api.get('/ocs/', { params })
      const data = res.data.results || res.data || []
      setOcsList(data.map((item: any) => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role,
        job_type: item.job_type,
        ocs_status: item.ocs_status,
        confirmed_at: item.confirmed_at || ''
      })))
    } catch (err) {
      console.error('Failed to load OCS:', err)
      setError('OCS 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleInference = async () => {
    if (!selectedId) return
    setError('')
    setCurrentJobId(null)

    const job = await requestInference('M1', { ocs_id: selectedId, mode: 'manual' })
    if (job) {
      setCurrentJobId(job.job_id)
    }
  }

  return (
    <div className="ai-panel">
      <h2>M1 MRI 분석</h2>
      <p className="ai-panel-desc">MRI 영상에서 Grade, IDH, MGMT, 생존 예측을 수행합니다.</p>

      {/* FastAPI 서버 상태 경고 */}
      {!isFastAPIAvailable && (
        <div className="ai-server-warning">
          ⚠️ FastAPI(추론 모델 서버)가 OFF 상태입니다
        </div>
      )}

      {/* OCS 테이블 */}
      <div className="ai-panel-section">
        <h3>RIS MRI 목록 ({ocsList.length}건)</h3>
        {loading ? (
          <div className="ai-loading">로딩 중...</div>
        ) : (
          <div className="ai-table-wrap">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>선택</th>
                  <th>OCS ID</th>
                  <th>환자명</th>
                  <th>환자번호</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {ocsList.map(ocs => (
                  <tr
                    key={ocs.id}
                    className={selectedId === ocs.id ? 'selected' : ''}
                    onClick={() => setSelectedId(ocs.id)}
                  >
                    <td>
                      <input
                        type="radio"
                        checked={selectedId === ocs.id}
                        onChange={() => setSelectedId(ocs.id)}
                      />
                    </td>
                    <td>{ocs.ocs_id}</td>
                    <td>{ocs.patient_name}</td>
                    <td>{ocs.patient_number}</td>
                    <td><span className="status-badge confirmed">{ocs.ocs_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 추론 버튼 */}
      <div className="ai-panel-actions">
        <button
          className="ai-btn primary"
          onClick={handleInference}
          disabled={!selectedId || inferring || !isFastAPIAvailable}
        >
          {inferring && currentJobId
            ? `'${currentJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
            : 'M1 추론 요청'}
        </button>
        {currentJobId && (
          <span className="ai-job-id">Job: {currentJobId}</span>
        )}
      </div>

      {/* 에러 */}
      {error && <div className="ai-error">{error}</div>}
      {job?.error && <div className="ai-error">{job.error}</div>}

      {/* 결과 */}
      {result && (
        <div className="ai-result">
          <h3>추론 결과 {job?.cached && <span className="ai-cached-badge">캐시</span>}</h3>
          <div className="ai-result-grid">
            {result.grade && (
              <div className="ai-result-card">
                <div className="ai-result-label">Grade</div>
                <div className="ai-result-value">{result.grade.predicted_class}</div>
                <div className="ai-result-sub">{(result.grade.probability * 100).toFixed(1)}%</div>
              </div>
            )}
            {result.idh && (
              <div className="ai-result-card">
                <div className="ai-result-label">IDH</div>
                <div className="ai-result-value">{result.idh.predicted_class}</div>
              </div>
            )}
            {result.mgmt && (
              <div className="ai-result-card">
                <div className="ai-result-label">MGMT</div>
                <div className="ai-result-value">{result.mgmt.predicted_class}</div>
              </div>
            )}
            {result.survival && (
              <div className="ai-result-card">
                <div className="ai-result-label">생존 위험</div>
                <div className="ai-result-value">{result.survival.risk_category}</div>
                <div className="ai-result-sub">Score: {result.survival.risk_score.toFixed(3)}</div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MG Panel - Gene 분석
// ============================================================================
function MGPanel({ patientId }: { patientId?: number }) {
  const { requestInference, isFastAPIAvailable } = useAIInference()
  const [ocsList, setOcsList] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 현재 작업 구독
  const { job } = useAIJob(currentJobId)
  const inferring = job?.status === 'PENDING' || job?.status === 'PROCESSING'
  const result = job?.status === 'COMPLETED' ? job.result : null

  useEffect(() => {
    loadOcsList()
  }, [patientId])

  const loadOcsList = async () => {
    try {
      setLoading(true)
      const params: Record<string, any> = {
        job_role: 'LIS',
        job_type: 'RNA_SEQ',
        ocs_status: 'CONFIRMED',
        page_size: 50
      }
      if (patientId) {
        params.patient_id = patientId
      }
      const res = await api.get('/ocs/', { params })
      const data = res.data.results || res.data || []
      setOcsList(data.map((item: any) => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role,
        job_type: item.job_type,
        ocs_status: item.ocs_status,
        confirmed_at: item.confirmed_at || ''
      })))
    } catch (err) {
      console.error('Failed to load OCS:', err)
      setError('OCS 목록을 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const handleInference = async () => {
    if (!selectedId) return
    setError('')
    setCurrentJobId(null)

    const job = await requestInference('MG', { ocs_id: selectedId, mode: 'manual' })
    if (job) {
      setCurrentJobId(job.job_id)
    }
  }

  return (
    <div className="ai-panel">
      <h2>MG Gene Analysis</h2>
      <p className="ai-panel-desc">유전자 발현 데이터를 분석합니다.</p>

      {/* FastAPI 서버 상태 경고 */}
      {!isFastAPIAvailable && (
        <div className="ai-server-warning">
          ⚠️ FastAPI(추론 모델 서버)가 OFF 상태입니다
        </div>
      )}

      <div className="ai-panel-section">
        <h3>LIS RNA_SEQ 목록 ({ocsList.length}건)</h3>
        {loading ? (
          <div className="ai-loading">로딩 중...</div>
        ) : (
          <div className="ai-table-wrap">
            <table className="ai-table">
              <thead>
                <tr>
                  <th>선택</th>
                  <th>OCS ID</th>
                  <th>환자명</th>
                  <th>환자번호</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {ocsList.map(ocs => (
                  <tr
                    key={ocs.id}
                    className={selectedId === ocs.id ? 'selected' : ''}
                    onClick={() => setSelectedId(ocs.id)}
                  >
                    <td>
                      <input
                        type="radio"
                        checked={selectedId === ocs.id}
                        onChange={() => setSelectedId(ocs.id)}
                      />
                    </td>
                    <td>{ocs.ocs_id}</td>
                    <td>{ocs.patient_name}</td>
                    <td>{ocs.patient_number}</td>
                    <td><span className="status-badge confirmed">{ocs.ocs_status}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ai-panel-actions">
        <button
          className="ai-btn primary purple"
          onClick={handleInference}
          disabled={!selectedId || inferring || !isFastAPIAvailable}
        >
          {inferring && currentJobId
            ? `'${currentJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
            : 'MG 추론 요청'}
        </button>
        {currentJobId && (
          <span className="ai-job-id">Job: {currentJobId}</span>
        )}
      </div>

      {error && <div className="ai-error">{error}</div>}
      {job?.error && <div className="ai-error">{job.error}</div>}

      {result && (
        <div className="ai-result">
          <h3>추론 결과 {job?.cached && <span className="ai-cached-badge">캐시</span>}</h3>
          <pre className="ai-result-json">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MM Panel - 멀티모달 분석
// ============================================================================
function MMPanel({ patientId }: { patientId?: number }) {
  const { requestInference, isFastAPIAvailable } = useAIInference()
  const [mriList, setMriList] = useState<OCSItem[]>([])
  const [geneList, setGeneList] = useState<OCSItem[]>([])
  const [proteinList, setProteinList] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMri, setSelectedMri] = useState<number | null>(null)
  const [selectedGene, setSelectedGene] = useState<number | null>(null)
  const [selectedProtein, setSelectedProtein] = useState<number | null>(null)
  const [currentJobId, setCurrentJobId] = useState<string | null>(null)
  const [error, setError] = useState('')

  // 현재 작업 구독
  const { job } = useAIJob(currentJobId)
  const inferring = job?.status === 'PENDING' || job?.status === 'PROCESSING'
  const result = job?.status === 'COMPLETED' ? job.result : null

  useEffect(() => {
    loadData()
  }, [patientId])

  const loadData = async () => {
    try {
      setLoading(true)
      const baseParams = { ocs_status: 'CONFIRMED', page_size: 50 }
      const patientFilter = patientId ? { patient_id: patientId } : {}

      const [mriRes, geneRes, proteinRes] = await Promise.all([
        api.get('/ocs/', { params: { ...baseParams, ...patientFilter, job_role: 'RIS', job_type: 'MRI' } }),
        api.get('/ocs/', { params: { ...baseParams, ...patientFilter, job_role: 'LIS', job_type: 'RNA_SEQ' } }),
        api.get('/ocs/', { params: { ...baseParams, ...patientFilter, job_role: 'LIS', job_type: 'BIOMARKER' } })
      ])

      const mapOcs = (data: any) => (data.results || data || []).map((item: any) => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role,
        job_type: item.job_type,
        ocs_status: item.ocs_status,
        confirmed_at: item.confirmed_at || ''
      }))

      setMriList(mapOcs(mriRes.data))
      setGeneList(mapOcs(geneRes.data))
      setProteinList(mapOcs(proteinRes.data))
    } catch (err) {
      setError('데이터 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  const handleInference = async () => {
    if (!selectedMri && !selectedGene) {
      setError('MRI 또는 Gene 데이터를 선택해주세요.')
      return
    }
    setError('')
    setCurrentJobId(null)

    const job = await requestInference('MM', {
      mri_ocs_id: selectedMri,
      gene_ocs_id: selectedGene,
      protein_ocs_id: selectedProtein,
      mode: 'manual'
    })
    if (job) {
      setCurrentJobId(job.job_id)
    }
  }

  return (
    <div className="ai-panel">
      <h2>MM 멀티모달 분석</h2>
      <p className="ai-panel-desc">MRI + 유전자 데이터를 통합 분석합니다.</p>

      {/* FastAPI 서버 상태 경고 */}
      {!isFastAPIAvailable && (
        <div className="ai-server-warning">
          ⚠️ FastAPI(추론 모델 서버)가 OFF 상태입니다
        </div>
      )}

      {loading ? (
        <div className="ai-loading">로딩 중...</div>
      ) : (
        <div className="ai-mm-grid">
          {/* MRI 선택 */}
          <div className="ai-panel-section">
            <h3>MRI 데이터 ({mriList.length}건)</h3>
            <div className="ai-table-wrap small">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>OCS ID</th>
                    <th>환자명</th>
                  </tr>
                </thead>
                <tbody>
                  {mriList.map(ocs => (
                    <tr
                      key={ocs.id}
                      className={selectedMri === ocs.id ? 'selected' : ''}
                      onClick={() => setSelectedMri(ocs.id)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="mri"
                          checked={selectedMri === ocs.id}
                          onChange={() => setSelectedMri(ocs.id)}
                        />
                      </td>
                      <td>{ocs.ocs_id}</td>
                      <td>{ocs.patient_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Gene 선택 */}
          <div className="ai-panel-section">
            <h3>Gene 데이터 ({geneList.length}건)</h3>
            <div className="ai-table-wrap small">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>OCS ID</th>
                    <th>환자명</th>
                  </tr>
                </thead>
                <tbody>
                  {geneList.map(ocs => (
                    <tr
                      key={ocs.id}
                      className={selectedGene === ocs.id ? 'selected' : ''}
                      onClick={() => setSelectedGene(ocs.id)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="gene"
                          checked={selectedGene === ocs.id}
                          onChange={() => setSelectedGene(ocs.id)}
                        />
                      </td>
                      <td>{ocs.ocs_id}</td>
                      <td>{ocs.patient_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Protein/Biomarker 선택 */}
          <div className="ai-panel-section">
            <h3>Protein 데이터 ({proteinList.length}건)</h3>
            <div className="ai-table-wrap small">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th>선택</th>
                    <th>OCS ID</th>
                    <th>환자명</th>
                  </tr>
                </thead>
                <tbody>
                  {proteinList.map(ocs => (
                    <tr
                      key={ocs.id}
                      className={selectedProtein === ocs.id ? 'selected' : ''}
                      onClick={() => setSelectedProtein(ocs.id)}
                    >
                      <td>
                        <input
                          type="radio"
                          name="protein"
                          checked={selectedProtein === ocs.id}
                          onChange={() => setSelectedProtein(ocs.id)}
                        />
                      </td>
                      <td>{ocs.ocs_id}</td>
                      <td>{ocs.patient_name}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      <div className="ai-panel-actions">
        <button
          className="ai-btn primary orange"
          onClick={handleInference}
          disabled={(!selectedMri && !selectedGene) || inferring || !isFastAPIAvailable}
        >
          {inferring && currentJobId
            ? `'${currentJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
            : 'MM 추론 요청'}
        </button>
        {currentJobId && (
          <span className="ai-job-id">Job: {currentJobId}</span>
        )}
      </div>

      {error && <div className="ai-error">{error}</div>}
      {job?.error && <div className="ai-error">{job.error}</div>}

      {result && (
        <div className="ai-result">
          <h3>추론 결과 {job?.cached && <span className="ai-cached-badge">캐시</span>}</h3>
          <pre className="ai-result-json">{JSON.stringify(result, null, 2)}</pre>
        </div>
      )}
    </div>
  )
}
