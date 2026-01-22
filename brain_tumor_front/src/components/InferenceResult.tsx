import { useState, useEffect } from 'react'
import { aiApi } from '../services/ai.api'
import './InferenceResult.css'

interface GradeResult {
  predicted_class: string
  predicted_value?: number
  probability: number
  probabilities?: Record<string, number>
}

interface BinaryResult {
  predicted_class: string
  mutant_probability?: number
  methylated_probability?: number
}

interface SurvivalResult {
  risk_score: number
  risk_category: string
}

interface OsDaysResult {
  predicted_days: number
  predicted_months: number
}

interface M1Result {
  grade?: GradeResult
  idh?: BinaryResult
  mgmt?: BinaryResult
  survival?: SurvivalResult
  os_days?: OsDaysResult
  processing_time_ms?: number
  visualization_paths?: string[]
}

interface FileInfo {
  name: string
  size: number
  modified: number
  download_url: string
}

interface InferenceResultProps {
  result: M1Result | null
  status?: string
  error?: string
  jobId?: string
}

// 결과 카드 컴포넌트
interface ResultCardProps {
  title: string
  value: string
  subValue?: string
  colorClass?: string
}

function ResultCard({ title, value, subValue, colorClass = 'card-blue' }: ResultCardProps) {
  return (
    <div className={`result-card ${colorClass}`}>
      <div className="result-card-title">{title}</div>
      <div className="result-card-value">{value}</div>
      {subValue && <div className="result-card-subvalue">{subValue}</div>}
    </div>
  )
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function InferenceResult({ result, status, error, jobId }: InferenceResultProps) {
  const [files, setFiles] = useState<FileInfo[]>([])
  const [loadingFiles, setLoadingFiles] = useState(false)
  const [showDetails, setShowDetails] = useState(false)
  const [showRawJson, setShowRawJson] = useState(false)

  // 파일 목록 로드
  useEffect(() => {
    if (jobId && status === 'completed') {
      loadFiles()
    }
  }, [jobId, status])

  const loadFiles = async () => {
    if (!jobId) return
    try {
      setLoadingFiles(true)
      const response = await aiApi.getInferenceFiles(jobId)
      setFiles(response.files || [])
    } catch (err) {
      console.error('Failed to load files:', err)
    } finally {
      setLoadingFiles(false)
    }
  }

  const handleDownload = (file: FileInfo) => {
    const url = file.download_url
    const link = document.createElement('a')
    link.href = url
    link.download = file.name
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  if (error) {
    return (
      <div className="inference-error">
        <h3>추론 실패</h3>
        <p>{error}</p>
      </div>
    )
  }

  if (status === 'processing' || status === 'PROCESSING') {
    return (
      <div className="inference-processing">
        <div className="spinner-small" />
        <p>M1 모델 추론 중...</p>
      </div>
    )
  }

  if (!result) {
    return (
      <div className="inference-empty">
        추론 결과가 없습니다. OCS를 선택하고 추론을 요청하세요.
      </div>
    )
  }

  // 카드 색상 클래스 결정
  const getIDHColorClass = () => {
    return result.idh?.predicted_class === 'Mutant' ? 'card-orange' : 'card-teal'
  }

  const getMGMTColorClass = () => {
    return result.mgmt?.predicted_class === 'Methylated' ? 'card-green' : 'card-red'
  }

  const getSurvivalColorClass = () => {
    if (!result.survival) return 'card-gray'
    switch (result.survival.risk_category) {
      case 'High': return 'card-red'
      case 'Medium': return 'card-yellow'
      default: return 'card-green'
    }
  }

  return (
    <div className="inference-result">
      {/* 결과 카드 그리드 */}
      <div className="result-cards-grid">
        {result.grade && (
          <ResultCard
            title="Grade"
            value={result.grade.predicted_class}
            subValue={`${(result.grade.probability * 100).toFixed(1)}%`}
            colorClass="card-blue"
          />
        )}

        {result.idh && (
          <ResultCard
            title="IDH"
            value={result.idh.predicted_class}
            subValue={`${((1 - (result.idh.mutant_probability || 0)) * 100).toFixed(1)}%`}
            colorClass={getIDHColorClass()}
          />
        )}

        {result.mgmt && (
          <ResultCard
            title="MGMT"
            value={result.mgmt.predicted_class === 'Methylated' ? 'Methylated' : 'Unmethyl.'}
            subValue={`${((result.mgmt.methylated_probability || 0) * 100).toFixed(1)}%`}
            colorClass={getMGMTColorClass()}
          />
        )}

        {result.survival && (
          <ResultCard
            title="Survival"
            value={result.survival.risk_category}
            subValue={`${result.survival.risk_score.toFixed(3)}`}
            colorClass={getSurvivalColorClass()}
          />
        )}

        {result.os_days && (
          <ResultCard
            title="OS Days"
            value={`${result.os_days.predicted_months.toFixed(1)}개월`}
            subValue={`${result.os_days.predicted_days}일`}
            colorClass="card-purple"
          />
        )}
      </div>

      {/* 처리 시간 */}
      {result.processing_time_ms && (
        <div className="processing-time-simple">
          처리 시간: {(result.processing_time_ms / 1000).toFixed(2)}초
        </div>
      )}

      {/* 더보기 버튼 */}
      <button
        onClick={() => setShowDetails(!showDetails)}
        className="details-toggle-btn"
      >
        {showDetails ? '▲ 접기' : '▼ 더보기'}
      </button>

      {/* 상세 섹션 */}
      {showDetails && (
        <div className="details-section">
          {/* Grade 상세 확률 */}
          {result.grade?.probabilities && (
            <div className="details-subsection">
              <div className="details-subsection-title">Grade 상세 확률</div>
              <div className="probability-bars">
                {Object.entries(result.grade.probabilities).map(([grade, prob]) => (
                  <div key={grade} className="probability-row">
                    <span className="probability-label">{grade}</span>
                    <div className="probability-bar-bg">
                      <div
                        className="probability-bar-fill"
                        style={{ width: `${prob * 100}%` }}
                      />
                    </div>
                    <span className="probability-value">{(prob * 100).toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* IDH/MGMT 상세 */}
          <div className="details-subsection">
            <div className="details-subsection-title">분자 마커 상세</div>
            <div className="marker-details">
              {result.idh && (
                <div className="marker-row">
                  <span className="marker-label">IDH Mutant 확률</span>
                  <span className="marker-value">
                    {((result.idh.mutant_probability || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
              {result.mgmt && (
                <div className="marker-row">
                  <span className="marker-label">MGMT Methylated 확률</span>
                  <span className="marker-value">
                    {((result.mgmt.methylated_probability || 0) * 100).toFixed(1)}%
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* 파일 다운로드 */}
          {jobId && status === 'completed' && (
            <div className="details-subsection">
              <div className="details-subsection-title">
                결과 파일
                <button onClick={loadFiles} className="refresh-btn">새로고침</button>
              </div>

              {loadingFiles ? (
                <div className="files-loading">
                  <div className="spinner-tiny" />
                </div>
              ) : files.length > 0 ? (
                <div className="file-list-compact">
                  {files.map((file) => (
                    <div key={file.name} className="file-item-compact">
                      <div className="file-info">
                        <span className="file-name">{file.name}</span>
                        <span className="file-size">({formatFileSize(file.size)})</span>
                      </div>
                      <button
                        onClick={() => handleDownload(file)}
                        className="download-btn"
                      >
                        다운로드
                      </button>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="no-files">파일이 없습니다.</p>
              )}
            </div>
          )}

          {/* Raw JSON */}
          <div className="details-subsection">
            <button
              onClick={() => setShowRawJson(!showRawJson)}
              className="raw-json-toggle"
            >
              <span className={`toggle-arrow ${showRawJson ? 'open' : ''}`}>▶</span>
              Raw JSON 데이터
            </button>
            {showRawJson && (
              <pre className="raw-json-content">
                {JSON.stringify(result, null, 2)}
              </pre>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
