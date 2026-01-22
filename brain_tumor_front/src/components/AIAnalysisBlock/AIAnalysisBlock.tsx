/**
 * AI 분석 블록 컴포넌트
 * - 대시보드에 인라인으로 표시되는 AI 분석 UI
 * - M1/MG/MM 탭 전환
 * - WebSocket 실시간 알림 연동
 * - 전역 AIInferenceContext 사용으로 FastAPI 상태 감지
 */
import { useState, useEffect, useRef, useMemo } from 'react'
import { api } from '@/services/api'
import { useAIInference } from '@/context/AIInferenceContext'
import SegMRIViewer, { type SegmentationData } from '@/components/ai/SegMRIViewer/SegMRIViewer'
import GeneVisualization, { type GeneExpressionData } from '@/components/ai/GeneVisualization/GeneVisualization'
import MGResultViewer, { type MGResult } from '@/components/ai/MGResultViewer/MGResultViewer'
import MMResultViewer, { type MMResult } from '@/components/ai/MMResultViewer/MMResultViewer'
import './AIAnalysisBlock.css'

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
}

interface InferenceResult {
  grade?: { predicted_class: string; probability: number }
  idh?: { predicted_class: string }
  mgmt?: { predicted_class: string }
  survival?: { risk_score: number; risk_category: string }
  processing_time_ms?: number
  segmentation?: {
    wt_volume: number
    tc_volume: number
    et_volume: number
    ncr_volume: number
    ed_volume: number
  }
}

type TabType = 'm1' | 'mg' | 'mm'

// ============================================================================
// Main Component
// ============================================================================
export default function AIAnalysisBlock() {
  const [activeTab, setActiveTab] = useState<TabType>('m1')
  const [isResearch, setIsResearch] = useState<boolean>(false)

  return (
    <div className="ai-block">
      {/* Header */}
      <div className="ai-block-header">
        <div className="ai-block-title-wrap">
          <h3 className="ai-block-title">AI 뇌종양 분석</h3>
          <span className="ai-block-subtitle">Brain Tumor CDSS</span>
        </div>
        <div className="ai-block-header-right">
          {/* 연구용 모드 토글 */}
          <label className="ai-research-toggle">
            <input
              type="checkbox"
              checked={isResearch}
              onChange={(e) => setIsResearch(e.target.checked)}
            />
            <span className="toggle-label">연구용</span>
          </label>
          <div className="ai-block-tabs">
            <button
              className={`ai-block-tab ${activeTab === 'm1' ? 'active' : ''}`}
              onClick={() => setActiveTab('m1')}
            >
              🧠 M1 MRI
            </button>
            <button
              className={`ai-block-tab ${activeTab === 'mg' ? 'active' : ''}`}
              onClick={() => setActiveTab('mg')}
            >
              🧬 MG Gene
            </button>
            <button
              className={`ai-block-tab ${activeTab === 'mm' ? 'active' : ''}`}
              onClick={() => setActiveTab('mm')}
            >
              🔬 MM 멀티모달
            </button>
          </div>
        </div>
      </div>

      {/* 연구용 모드 안내 */}
      {isResearch && (
        <div className="ai-research-notice">
          연구용 모드: 전체 OCS 목록을 조회합니다. 서로 다른 환자의 데이터를 조합할 수 있습니다.
        </div>
      )}

      {/* Content */}
      <div className="ai-block-content">
        {activeTab === 'm1' && <M1Panel isResearch={isResearch} />}
        {activeTab === 'mg' && <MGPanel isResearch={isResearch} />}
        {activeTab === 'mm' && <MMPanel isResearch={isResearch} />}
      </div>
    </div>
  )
}

// ============================================================================
// M1 Panel
// ============================================================================
interface PanelProps {
  isResearch: boolean
}

function M1Panel({ isResearch: _isResearch }: PanelProps) {
  const [ocsList, setOcsList] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [inferring, setInferring] = useState(false)
  const [result, setResult] = useState<InferenceResult | null>(null)
  const [error, setError] = useState('')
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const abortRef = useRef(false)

  // 세그멘테이션 뷰어 관련 상태
  const [segData, setSegData] = useState<SegmentationData | null>(null)
  const [segLoading, setSegLoading] = useState(false)
  const [segError, setSegError] = useState('')

  const { lastMessage, requestInference } = useAIInference()

  useEffect(() => {
    loadOcsList()
    return () => { abortRef.current = true }
  }, [])


  // WebSocket 메시지 수신 시 결과 반영
  useEffect(() => {
    if (!lastMessage || !lastJobId) return
    if (lastMessage.job_id !== lastJobId) return

    if (lastMessage.status === 'COMPLETED' && lastMessage.result) {
      setResult(lastMessage.result as InferenceResult)
      setInferring(false)
      abortRef.current = true
    } else if (lastMessage.status === 'FAILED') {
      setError(lastMessage.error || '추론 실패')
      setInferring(false)
      abortRef.current = true
    }
  }, [lastMessage, lastJobId])

  const loadOcsList = async () => {
    try {
      setLoading(true)
      const res = await api.get('/ocs/', {
        params: { job_role: 'RIS', job_type: 'MRI', ocs_status: 'CONFIRMED', page_size: 50 }
      })
      const data = res.data.results || res.data || []
      setOcsList(data.map((item: any) => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role,
        job_type: item.job_type,
        ocs_status: item.ocs_status
      })))
    } catch {
      setError('OCS 목록 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  const pollResult = async (jobId: string, maxAttempts = 20, errorRetries = 3) => {
    abortRef.current = false
    let errorCount = 0
    for (let i = 0; i < maxAttempts; i++) {
      if (abortRef.current) return
      try {
        const detail = await api.get(`/ai/inferences/${jobId}/`)
        errorCount = 0
        if (detail.data.status === 'COMPLETED') {
          setResult(detail.data.result_data)
          setInferring(false)
          return
        } else if (detail.data.status === 'FAILED') {
          setError(detail.data.error_message || '추론 실패')
          setInferring(false)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch {
        errorCount++
        if (errorCount >= errorRetries) {
          setError('결과 조회 실패. 재시도 버튼을 눌러주세요.')
          setInferring(false)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    if (!abortRef.current) {
      setError('추론 시간 초과. 재시도 버튼을 눌러주세요.')
      setInferring(false)
    }
  }

  const handleInference = async () => {
    if (!selectedId) return
    try {
      setInferring(true)
      setError('')
      setResult(null)
      setLastJobId(null)
      abortRef.current = false

      // 전역 context의 requestInference 사용 (FastAPI 상태 감지 포함)
      const job = await requestInference('M1', { ocs_id: selectedId, mode: 'manual' })

      if (!job) {
        // requestInference가 null을 반환하면 에러 발생 (FastAPI OFF 등)
        // 알림은 전역 context에서 이미 처리됨
        setInferring(false)
        return
      }

      // job_id 항상 설정 (캐시/신규 모두 세그멘테이션 로드에 필요)
      setLastJobId(job.job_id)

      if (job.cached && job.result) {
        setResult(job.result)
        setInferring(false)
      } else {
        pollResult(job.job_id)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '추론 요청 실패')
      setInferring(false)
    }
  }

  const handleRetry = () => {
    if (lastJobId) {
      setError('')
      setInferring(true)
      abortRef.current = false
      pollResult(lastJobId)
    } else {
      handleInference()
    }
  }

  // 세그멘테이션 데이터 로드 함수
  const loadSegmentationData = async (jobId: string) => {
    setSegLoading(true)
    setSegError('')
    setSegData(null)

    try {
      // enc=binary로 base64 인코딩된 데이터 요청 (더 효율적)
      const res = await api.get(`/ai/inferences/${jobId}/segmentation/`, {
        params: { enc: 'binary' }
      })

      const data = res.data
      console.log('[M1Panel] Segmentation data loaded:', {
        shape: data.shape,
        encoding: data.encoding,
        hasMri: !!data.mri,
        hasPrediction: !!data.prediction
      })

      // base64 디코딩하여 3D 배열로 변환 (Django API는 모든 데이터를 float32로 인코딩)
      const decodeBase64ToArray = (b64: string, shape: number[], roundToInt = false): number[][][] => {
        const binary = atob(b64)
        const bytes = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) {
          bytes[i] = binary.charCodeAt(i)
        }

        // Django API는 모든 배열을 float32로 인코딩함
        const flatArray = new Float32Array(bytes.buffer)

        // 3D 배열로 변환 [X][Y][Z]
        const [X, Y, Z] = shape
        const result: number[][][] = []
        for (let x = 0; x < X; x++) {
          const plane: number[][] = []
          for (let y = 0; y < Y; y++) {
            const row: number[] = []
            for (let z = 0; z < Z; z++) {
              let val = flatArray[x * Y * Z + y * Z + z]
              // 세그멘테이션 마스크는 정수 레이블(0,1,2,3)이므로 반올림
              if (roundToInt) val = Math.round(val)
              row.push(val)
            }
            plane.push(row)
          }
          result.push(plane)
        }
        return result
      }

      // MRI 데이터 (float32)
      let mriVolume: number[][][] = []
      if (data.mri && data.encoding === 'base64') {
        mriVolume = decodeBase64ToArray(data.mri, data.shape, false)
      } else if (data.mri && Array.isArray(data.mri)) {
        mriVolume = data.mri
      }

      // Prediction 데이터 (float32로 인코딩된 정수 레이블 -> 정수로 변환)
      let predVolume: number[][][] = []
      if (data.prediction && data.encoding === 'base64') {
        predVolume = decodeBase64ToArray(data.prediction, data.shape, true)
      } else if (data.prediction && Array.isArray(data.prediction)) {
        predVolume = data.prediction
      }

      // 디버그: prediction 데이터의 고유 값 확인
      const uniqueLabels = new Set<number>()
      if (predVolume.length > 0) {
        const midX = Math.floor(predVolume.length / 2)
        for (let y = 0; y < predVolume[midX].length; y++) {
          for (let z = 0; z < predVolume[midX][y].length; z++) {
            uniqueLabels.add(predVolume[midX][y][z])
          }
        }
      }
      console.log('[M1Panel] Prediction unique labels in middle slice:', Array.from(uniqueLabels))

      // SegmentationData 구성
      const segmentationData: SegmentationData = {
        mri: mriVolume,
        groundTruth: [], // GT는 없음 (추론 결과만)
        prediction: predVolume,
        shape: data.shape as [number, number, number],
      }

      // MRI 채널 데이터가 있으면 추가 (MRI는 float 값이므로 roundToInt=false)
      if (data.mri_channels) {
        segmentationData.mri_channels = {}
        for (const ch of ['t1', 't1ce', 't2', 'flair']) {
          if (data.mri_channels[ch]) {
            if (data.encoding === 'base64') {
              segmentationData.mri_channels[ch as keyof typeof segmentationData.mri_channels] =
                decodeBase64ToArray(data.mri_channels[ch], data.shape, false)
            } else {
              segmentationData.mri_channels[ch as keyof typeof segmentationData.mri_channels] =
                data.mri_channels[ch]
            }
          }
        }
      }

      setSegData(segmentationData)
      console.log('[M1Panel] SegmentationData ready:', {
        mriShape: segmentationData.mri.length,
        predShape: segmentationData.prediction.length,
        hasChannels: !!segmentationData.mri_channels
      })
    } catch (err: any) {
      console.error('[M1Panel] Failed to load segmentation:', err)
      setSegError(err.response?.data?.detail || '세그멘테이션 데이터 로드 실패')
    } finally {
      setSegLoading(false)
    }
  }

  // M1 결과가 있고 job_id가 있으면 세그멘테이션 데이터 로드
  // (M1 추론은 항상 m1_segmentation.npz 파일을 생성함)
  useEffect(() => {
    if (result && lastJobId) {
      loadSegmentationData(lastJobId)
    } else {
      setSegData(null)
    }
  }, [result, lastJobId])

  return (
    <div className="ai-panel">
      <p className="ai-panel-desc">MRI 영상 → Grade, IDH, MGMT, 생존 예측</p>

      <div className="ai-panel-body">
        {/* OCS 선택 */}
        <div className="ai-panel-left">
          <div className="ai-section-title">RIS MRI 목록 ({ocsList.length})</div>
          {loading ? (
            <div className="ai-loading">로딩 중...</div>
          ) : ocsList.length === 0 ? (
            <div className="ai-empty">확정된 MRI 데이터가 없습니다</div>
          ) : (
            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>OCS ID</th>
                    <th>환자명</th>
                    <th>환자번호</th>
                  </tr>
                </thead>
                <tbody>
                  {ocsList.map(ocs => (
                    <tr
                      key={ocs.id}
                      className={selectedId === ocs.id ? 'selected' : ''}
                      onClick={() => { setSelectedId(ocs.id); setResult(null); }}
                    >
                      <td>
                        <input type="radio" checked={selectedId === ocs.id} readOnly />
                      </td>
                      <td>{ocs.ocs_id}</td>
                      <td>{ocs.patient_name}</td>
                      <td>{ocs.patient_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            className="ai-btn primary"
            onClick={handleInference}
            disabled={!selectedId || inferring}
          >
            {inferring && lastJobId
              ? `'${lastJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
              : 'M1 추론 요청'}
          </button>
        </div>

        {/* 결과 */}
        <div className="ai-panel-right">
          <div className="ai-section-title">추론 결과</div>
          {error && (
            <div className="ai-error">
              {error}
              <button className="ai-btn-retry" onClick={handleRetry} disabled={inferring}>
                재시도
              </button>
            </div>
          )}
          {result ? (
            <div className="ai-result-grid">
              {result.grade && (
                <div className="ai-result-card blue">
                  <div className="ai-result-label">Grade</div>
                  <div className="ai-result-value">{result.grade.predicted_class}</div>
                  <div className="ai-result-sub">{(result.grade.probability * 100).toFixed(1)}%</div>
                </div>
              )}
              {result.idh && (
                <div className="ai-result-card green">
                  <div className="ai-result-label">IDH</div>
                  <div className="ai-result-value">{result.idh.predicted_class}</div>
                </div>
              )}
              {result.mgmt && (
                <div className="ai-result-card purple">
                  <div className="ai-result-label">MGMT</div>
                  <div className="ai-result-value">{result.mgmt.predicted_class}</div>
                </div>
              )}
              {result.survival && (
                <div className="ai-result-card orange">
                  <div className="ai-result-label">생존 위험</div>
                  <div className="ai-result-value">{result.survival.risk_category}</div>
                  <div className="ai-result-sub">{result.survival.risk_score.toFixed(3)}</div>
                </div>
              )}
            </div>
          ) : (
            <div className="ai-no-result">OCS를 선택하고 추론을 요청하세요</div>
          )}
        </div>
      </div>

      {/* 세그멘테이션 뷰어 섹션 */}
      {(segLoading || segData || segError) && (
        <div className="ai-segmentation-section">
          <div className="ai-section-title">세그멘테이션 결과</div>
          {segLoading && (
            <div className="ai-loading">세그멘테이션 데이터 로딩 중...</div>
          )}
          {segError && (
            <div className="ai-error">{segError}</div>
          )}
          {segData && (
            <SegMRIViewer
              data={segData}
              title="M1 세그멘테이션 결과"
              diceScores={result?.segmentation ? {
                wt: result.segmentation.wt_volume,
                tc: result.segmentation.tc_volume,
                et: result.segmentation.et_volume,
              } : undefined}
              initialViewMode="axial"
              initialDisplayMode="overlay"
            />
          )}
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MG Panel
// ============================================================================
function MGPanel({ isResearch: _isResearch }: PanelProps) {
  const [ocsList, setOcsList] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedId, setSelectedId] = useState<number | null>(null)
  const [inferring, setInferring] = useState(false)
  const [result, setResult] = useState<MGResult | null>(null)
  const [error, setError] = useState('')
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const abortRef = useRef(false)

  // Gene Expression 데이터 상태
  const [geneData, setGeneData] = useState<GeneExpressionData | null>(null)
  const [geneLoading, setGeneLoading] = useState(false)
  const [geneError, setGeneError] = useState('')

  const { lastMessage, requestInference } = useAIInference()

  useEffect(() => {
    loadOcsList()
    return () => { abortRef.current = true }
  }, [])

  // WebSocket 메시지 수신 시 결과 반영
  useEffect(() => {
    if (!lastMessage || !lastJobId) return
    if (lastMessage.job_id !== lastJobId) return

    if (lastMessage.status === 'COMPLETED' && lastMessage.result) {
      setResult(lastMessage.result)
      setInferring(false)
      abortRef.current = true
    } else if (lastMessage.status === 'FAILED') {
      setError(lastMessage.error || '추론 실패')
      setInferring(false)
      abortRef.current = true
    }
  }, [lastMessage, lastJobId])

  const loadOcsList = async () => {
    try {
      setLoading(true)
      const res = await api.get('/ocs/', {
        params: { job_role: 'LIS', job_type: 'RNA_SEQ', ocs_status: 'CONFIRMED', page_size: 50 }
      })
      const data = res.data.results || res.data || []
      setOcsList(data.map((item: any) => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role,
        job_type: item.job_type,
        ocs_status: item.ocs_status
      })))
    } catch {
      setError('OCS 목록 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  const pollResult = async (jobId: string, maxAttempts = 20, errorRetries = 3) => {
    abortRef.current = false
    let errorCount = 0
    for (let i = 0; i < maxAttempts; i++) {
      if (abortRef.current) return
      try {
        const detail = await api.get(`/ai/inferences/${jobId}/`)
        errorCount = 0
        if (detail.data.status === 'COMPLETED') {
          setResult(detail.data.result_data)
          setInferring(false)
          return
        } else if (detail.data.status === 'FAILED') {
          setError(detail.data.error_message || '추론 실패')
          setInferring(false)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch {
        errorCount++
        if (errorCount >= errorRetries) {
          setError('결과 조회 실패. 재시도 버튼을 눌러주세요.')
          setInferring(false)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    if (!abortRef.current) {
      setError('추론 시간 초과. 재시도 버튼을 눌러주세요.')
      setInferring(false)
    }
  }

  const handleInference = async () => {
    if (!selectedId) return
    try {
      setInferring(true)
      setError('')
      setResult(null)
      setLastJobId(null)
      abortRef.current = false

      // 전역 context의 requestInference 사용 (FastAPI 상태 감지 포함)
      const job = await requestInference('MG', { ocs_id: selectedId, mode: 'manual' })

      if (!job) {
        // requestInference가 null을 반환하면 에러 발생 (FastAPI OFF 등)
        // 알림은 전역 context에서 이미 처리됨
        setInferring(false)
        return
      }

      if (job.cached && job.result) {
        setResult(job.result)
        setInferring(false)
      } else {
        setLastJobId(job.job_id)
        pollResult(job.job_id)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '추론 요청 실패')
      setInferring(false)
    }
  }

  const handleRetry = () => {
    if (lastJobId) {
      setError('')
      setInferring(true)
      abortRef.current = false
      pollResult(lastJobId)
    } else {
      handleInference()
    }
  }

  // Gene Expression 데이터 로드 함수
  const loadGeneExpressionData = async (ocsId: number) => {
    setGeneLoading(true)
    setGeneError('')
    setGeneData(null)

    try {
      const res = await api.get(`/ai/mg/gene-expression/${ocsId}/`)
      setGeneData(res.data)
      console.log('[MGPanel] Gene expression data loaded:', res.data)
    } catch (err: any) {
      console.error('[MGPanel] Failed to load gene expression:', err)
      setGeneError(err.response?.data?.detail || '유전자 발현 데이터 로드 실패')
    } finally {
      setGeneLoading(false)
    }
  }

  // OCS 선택 시 Gene Expression 데이터 로드
  useEffect(() => {
    if (selectedId) {
      loadGeneExpressionData(selectedId)
    } else {
      setGeneData(null)
      setGeneError('')
    }
  }, [selectedId])

  return (
    <div className="ai-panel">
      <p className="ai-panel-desc">유전자 발현 데이터 분석</p>

      <div className="ai-panel-body">
        <div className="ai-panel-left">
          <div className="ai-section-title">LIS RNA_SEQ 목록 ({ocsList.length})</div>
          {loading ? (
            <div className="ai-loading">로딩 중...</div>
          ) : ocsList.length === 0 ? (
            <div className="ai-empty">확정된 RNA_SEQ 데이터가 없습니다</div>
          ) : (
            <div className="ai-table-container">
              <table className="ai-table">
                <thead>
                  <tr>
                    <th></th>
                    <th>OCS ID</th>
                    <th>환자명</th>
                    <th>환자번호</th>
                  </tr>
                </thead>
                <tbody>
                  {ocsList.map(ocs => (
                    <tr
                      key={ocs.id}
                      className={selectedId === ocs.id ? 'selected' : ''}
                      onClick={() => { setSelectedId(ocs.id); setResult(null); }}
                    >
                      <td>
                        <input type="radio" checked={selectedId === ocs.id} readOnly />
                      </td>
                      <td>{ocs.ocs_id}</td>
                      <td>{ocs.patient_name}</td>
                      <td>{ocs.patient_number}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <button
            className="ai-btn primary purple"
            onClick={handleInference}
            disabled={!selectedId || inferring}
          >
            {inferring && lastJobId
              ? `'${lastJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
              : 'MG 추론 요청'}
          </button>
        </div>

        <div className="ai-panel-right">
          <div className="ai-section-title">추론 결과</div>
          {error && (
            <div className="ai-error">
              {error}
              <button className="ai-btn-retry" onClick={handleRetry} disabled={inferring}>
                재시도
              </button>
            </div>
          )}
          {!result && !error && (
            <div className="ai-no-result">OCS를 선택하고 추론을 요청하세요</div>
          )}
        </div>
      </div>

      {/* MG 결과 뷰어 섹션 */}
      {(geneLoading || geneData || geneError || result) && (
        <div className="ai-mg-viewers-section">
          <div className="ai-mg-viewers-grid">
            {/* 왼쪽: Gene Visualization */}
            <div className="ai-mg-viewer-left">
              <GeneVisualization
                data={geneData}
                patientId={ocsList.find(o => o.id === selectedId)?.patient_number}
                loading={geneLoading}
                error={geneError || undefined}
              />
            </div>

            {/* 오른쪽: MG Result Viewer */}
            <div className="ai-mg-viewer-right">
              <MGResultViewer
                result={result}
                loading={inferring}
                error={error || undefined}
              />
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

// ============================================================================
// MM Panel (MRI + Gene + Protein 3개 필수)
// ============================================================================
function MMPanel({ isResearch }: PanelProps) {
  const [mriList, setMriList] = useState<OCSItem[]>([])
  const [geneList, setGeneList] = useState<OCSItem[]>([])
  const [proteinList, setProteinList] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedMri, setSelectedMri] = useState<number | null>(null)
  const [selectedGene, setSelectedGene] = useState<number | null>(null)
  const [selectedProtein, setSelectedProtein] = useState<number | null>(null)
  const [inferring, setInferring] = useState(false)
  const [result, setResult] = useState<MMResult | null>(null)
  const [error, setError] = useState('')
  const [lastJobId, setLastJobId] = useState<string | null>(null)
  const abortRef = useRef(false)

  const { lastMessage, requestInference } = useAIInference()

  useEffect(() => {
    loadData()
    return () => { abortRef.current = true }
  }, [])

  // 선택된 MRI OCS의 환자 정보 (기준 환자)
  const selectedPatientNumber = mriList.find(o => o.id === selectedMri)?.patient_number || null

  // 진료용 모드: MRI 선택 시 해당 환자의 Gene/Protein 데이터만 필터링
  // 연구용 모드: 전체 목록 표시
  const filteredGeneList = useMemo(() => {
    if (isResearch || !selectedPatientNumber) return geneList
    return geneList.filter(o => o.patient_number === selectedPatientNumber)
  }, [geneList, selectedPatientNumber, isResearch])

  const filteredProteinList = useMemo(() => {
    if (isResearch || !selectedPatientNumber) return proteinList
    return proteinList.filter(o => o.patient_number === selectedPatientNumber)
  }, [proteinList, selectedPatientNumber, isResearch])

  // MRI 선택 변경 시 Gene/Protein 선택 초기화 (진료용 모드에서만)
  useEffect(() => {
    if (!isResearch && selectedMri) {
      // 새로 선택한 MRI의 환자와 현재 선택된 Gene/Protein 환자가 다르면 초기화
      const mriPatient = mriList.find(o => o.id === selectedMri)?.patient_number
      const genePatient = geneList.find(o => o.id === selectedGene)?.patient_number
      const proteinPatient = proteinList.find(o => o.id === selectedProtein)?.patient_number

      if (genePatient && genePatient !== mriPatient) {
        setSelectedGene(null)
      }
      if (proteinPatient && proteinPatient !== mriPatient) {
        setSelectedProtein(null)
      }
    }
  }, [selectedMri, isResearch, mriList, geneList, proteinList, selectedGene, selectedProtein])

  // WebSocket 메시지 수신 시 결과 반영
  useEffect(() => {
    if (!lastMessage || !lastJobId) return
    if (lastMessage.job_id !== lastJobId) return

    if (lastMessage.status === 'COMPLETED' && lastMessage.result) {
      setResult(lastMessage.result as MMResult)
      setInferring(false)
      abortRef.current = true
    } else if (lastMessage.status === 'FAILED') {
      setError(lastMessage.error || '추론 실패')
      setInferring(false)
      abortRef.current = true
    }
  }, [lastMessage, lastJobId])

  const loadData = async () => {
    try {
      setLoading(true)
      const [mriRes, geneRes, proteinRes] = await Promise.all([
        api.get('/ocs/', { params: { job_role: 'RIS', job_type: 'MRI', ocs_status: 'CONFIRMED', page_size: 50 } }),
        api.get('/ocs/', { params: { job_role: 'LIS', job_type: 'RNA_SEQ', ocs_status: 'CONFIRMED', page_size: 50 } }),
        api.get('/ocs/', { params: { job_role: 'LIS', job_type: 'BIOMARKER', ocs_status: 'CONFIRMED', page_size: 50 } })
      ])
      const mapOcs = (data: any) => (data.results || data || []).map((item: any) => ({
        id: item.id,
        ocs_id: item.ocs_id,
        patient_name: item.patient?.name || '',
        patient_number: item.patient?.patient_number || '',
        job_role: item.job_role,
        job_type: item.job_type,
        ocs_status: item.ocs_status
      }))
      setMriList(mapOcs(mriRes.data))
      setGeneList(mapOcs(geneRes.data))
      setProteinList(mapOcs(proteinRes.data))
    } catch {
      setError('데이터 로딩 실패')
    } finally {
      setLoading(false)
    }
  }

  const pollResult = async (jobId: string, maxAttempts = 20, errorRetries = 3) => {
    abortRef.current = false
    let errorCount = 0
    for (let i = 0; i < maxAttempts; i++) {
      if (abortRef.current) return
      try {
        const detail = await api.get(`/ai/inferences/${jobId}/`)
        errorCount = 0
        if (detail.data.status === 'COMPLETED') {
          setResult(detail.data.result_data)
          setInferring(false)
          return
        } else if (detail.data.status === 'FAILED') {
          setError(detail.data.error_message || '추론 실패')
          setInferring(false)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 3000))
      } catch {
        errorCount++
        if (errorCount >= errorRetries) {
          setError('결과 조회 실패. 재시도 버튼을 눌러주세요.')
          setInferring(false)
          return
        }
        await new Promise(resolve => setTimeout(resolve, 2000))
      }
    }
    if (!abortRef.current) {
      setError('추론 시간 초과. 재시도 버튼을 눌러주세요.')
      setInferring(false)
    }
  }

  const canInfer = selectedMri && selectedGene && selectedProtein

  const handleInference = async () => {
    if (!selectedMri || !selectedGene || !selectedProtein) {
      setError('MRI, Gene, Protein 데이터를 모두 선택하세요')
      return
    }
    try {
      setInferring(true)
      setError('')
      setResult(null)
      setLastJobId(null)
      abortRef.current = false

      // 전역 context의 requestInference 사용 (FastAPI 상태 감지 포함)
      const job = await requestInference('MM', {
        mri_ocs_id: selectedMri,
        gene_ocs_id: selectedGene,
        protein_ocs_id: selectedProtein,
        mode: 'manual'
      })

      if (!job) {
        // requestInference가 null을 반환하면 에러 발생 (FastAPI OFF 등)
        // 알림은 전역 context에서 이미 처리됨
        setInferring(false)
        return
      }

      if (job.cached && job.result) {
        setResult(job.result)
        setInferring(false)
      } else {
        setLastJobId(job.job_id)
        pollResult(job.job_id)
      }
    } catch (err: any) {
      setError(err.response?.data?.error || '추론 요청 실패')
      setInferring(false)
    }
  }

  const handleRetry = () => {
    if (lastJobId) {
      setError('')
      setInferring(true)
      abortRef.current = false
      pollResult(lastJobId)
    } else {
      handleInference()
    }
  }

  const getMissingDataText = () => {
    const missing = []
    if (!selectedMri) missing.push('MRI')
    if (!selectedGene) missing.push('Gene')
    if (!selectedProtein) missing.push('Protein')
    return missing.length > 0 ? `${missing.join(', ')} 선택 필요` : ''
  }

  return (
    <div className="ai-panel">
      <p className="ai-panel-desc">MRI + 유전자 + 단백질 통합 분석 (3개 모두 필수)</p>

      {loading ? (
        <div className="ai-loading">로딩 중...</div>
      ) : (
        <div className="ai-panel-body mm">
          {/* MRI 선택 */}
          <div className="ai-panel-col">
            <div className="ai-section-title">
              MRI ({mriList.length})
              {selectedMri && <span className="ai-selected-badge">✓</span>}
            </div>
            {mriList.length === 0 ? (
              <div className="ai-empty small">MRI 데이터 없음</div>
            ) : (
              <div className="ai-table-container small">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th></th>
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
                        <td><input type="radio" name="mri" checked={selectedMri === ocs.id} readOnly /></td>
                        <td>{ocs.ocs_id}</td>
                        <td>{ocs.patient_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Gene 선택 */}
          <div className="ai-panel-col">
            <div className="ai-section-title">
              Gene ({filteredGeneList.length}{!isResearch && selectedPatientNumber ? ` / ${geneList.length}` : ''})
              {selectedGene && <span className="ai-selected-badge">✓</span>}
            </div>
            {!selectedMri && !isResearch ? (
              <div className="ai-empty small">MRI를 먼저 선택하세요</div>
            ) : filteredGeneList.length === 0 ? (
              <div className="ai-empty small">
                {!isResearch && selectedPatientNumber
                  ? `${selectedPatientNumber} 환자의 Gene 데이터 없음`
                  : 'Gene 데이터 없음'}
              </div>
            ) : (
              <div className="ai-table-container small">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>OCS ID</th>
                      <th>환자명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredGeneList.map(ocs => (
                      <tr
                        key={ocs.id}
                        className={selectedGene === ocs.id ? 'selected' : ''}
                        onClick={() => setSelectedGene(ocs.id)}
                      >
                        <td><input type="radio" name="gene" checked={selectedGene === ocs.id} readOnly /></td>
                        <td>{ocs.ocs_id}</td>
                        <td>{ocs.patient_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Protein 선택 */}
          <div className="ai-panel-col">
            <div className="ai-section-title">
              Protein ({filteredProteinList.length}{!isResearch && selectedPatientNumber ? ` / ${proteinList.length}` : ''})
              {selectedProtein && <span className="ai-selected-badge">✓</span>}
            </div>
            {!selectedMri && !isResearch ? (
              <div className="ai-empty small">MRI를 먼저 선택하세요</div>
            ) : filteredProteinList.length === 0 ? (
              <div className="ai-empty small">
                {!isResearch && selectedPatientNumber
                  ? `${selectedPatientNumber} 환자의 Protein 데이터 없음`
                  : 'Protein 데이터 없음'}
              </div>
            ) : (
              <div className="ai-table-container small">
                <table className="ai-table">
                  <thead>
                    <tr>
                      <th></th>
                      <th>OCS ID</th>
                      <th>환자명</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredProteinList.map(ocs => (
                      <tr
                        key={ocs.id}
                        className={selectedProtein === ocs.id ? 'selected' : ''}
                        onClick={() => setSelectedProtein(ocs.id)}
                      >
                        <td><input type="radio" name="protein" checked={selectedProtein === ocs.id} readOnly /></td>
                        <td>{ocs.ocs_id}</td>
                        <td>{ocs.patient_name}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* 결과 */}
          <div className="ai-panel-col result">
            <div className="ai-section-title">결과</div>
            <button
              className="ai-btn primary orange"
              onClick={handleInference}
              disabled={!canInfer || inferring}
            >
              {inferring && lastJobId
                ? `'${lastJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
                : 'MM 추론'}
            </button>
            {!canInfer && !error && (
              <div className="ai-warning">{getMissingDataText()}</div>
            )}
            {error && (
              <div className="ai-error">
                {error}
                <button className="ai-btn-retry" onClick={handleRetry} disabled={inferring}>
                  재시도
                </button>
              </div>
            )}
            {!result && !error && (
              <div className="ai-no-result">3개 데이터 선택 후 추론 요청</div>
            )}
          </div>
        </div>
      )}

      {/* MM 결과 뷰어 섹션 */}
      {(inferring || result || error) && (
        <div className="ai-mm-viewer-section">
          <MMResultViewer
            result={result}
            loading={inferring}
            error={error || undefined}
          />
        </div>
      )}
    </div>
  )
}
