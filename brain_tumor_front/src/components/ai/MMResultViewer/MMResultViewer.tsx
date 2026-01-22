/**
 * MM Result Viewer Component
 * Multimodal 분석 결과 상세 표시 컴포넌트
 */

import React from 'react'
import './MMResultViewer.css'

export interface MMResult {
  patient_id?: string
  job_id?: string
  ocs_id?: number

  // Risk Group
  risk_group?: {
    predicted_class: string
    probabilities: { [key: string]: number }
  }

  // Survival (Cox PH)
  survival?: {
    hazard_ratio: number
    risk_score: number
    survival_probability_6m?: number
    survival_probability_12m?: number
    model_cindex?: number
  }

  // OS Days prediction
  os_days?: {
    predicted_days: number
    predicted_months: number
    confidence_interval?: { lower: number; upper: number }
  }

  // Recurrence
  recurrence?: {
    predicted_class: string
    recurrence_probability: number
  }

  // TMZ Response
  tmz_response?: {
    predicted_class: string
    responder_probability: number
  }

  // Meta
  recommendation?: string
  processing_time_ms?: number
  model_version?: string
  modalities_used?: string[]
}

interface MMResultViewerProps {
  result?: MMResult | null
  title?: string
  loading?: boolean
  error?: string | null
  onClose?: () => void
}

const MMResultViewer: React.FC<MMResultViewerProps> = ({
  result,
  title = 'MM 멀티모달 분석 결과',
  loading,
  error,
  onClose
}) => {
  // 로딩 상태
  if (loading) {
    return (
      <div className="mm-result-viewer">
        <div className="mm-result-header">
          <h2>{title}</h2>
          <span className="mm-model-badge">Multimodal</span>
        </div>
        <div className="mm-result-body">
          <div className="mm-loading">
            <div className="mm-spinner"></div>
            <span>MM 추론 진행 중...</span>
          </div>
        </div>
      </div>
    )
  }

  // 에러 상태
  if (error) {
    return (
      <div className="mm-result-viewer">
        <div className="mm-result-header">
          <h2>{title}</h2>
          <span className="mm-model-badge">Multimodal</span>
        </div>
        <div className="mm-result-body">
          <div className="mm-error">
            <span className="mm-error-icon">!</span>
            {error}
          </div>
        </div>
      </div>
    )
  }

  // 결과 없음
  if (!result) {
    return (
      <div className="mm-result-viewer">
        <div className="mm-result-header">
          <h2>{title}</h2>
          <span className="mm-model-badge">Multimodal</span>
        </div>
        <div className="mm-result-body">
          <div className="mm-empty">
            <span className="mm-empty-icon">🔬</span>
            <span>MRI, Gene, Protein 데이터를 선택하고 MM 추론을 요청하면 결과가 표시됩니다.</span>
          </div>
        </div>
      </div>
    )
  }

  // Risk group color mapping
  const getRiskColor = (riskClass: string) => {
    switch (riskClass.toLowerCase()) {
      case 'low':
        return '#4caf50'
      case 'medium':
        return '#ff9800'
      case 'high':
        return '#f44336'
      default:
        return '#9e9e9e'
    }
  }

  // Format probability as percentage
  const formatPercent = (value: number) => {
    return `${(value * 100).toFixed(1)}%`
  }

  return (
    <div className="mm-result-viewer">
      <div className="mm-result-header">
        <h2>{title}</h2>
        {result.patient_id && (
          <div className="mm-patient-id">환자 ID: {result.patient_id}</div>
        )}
        {onClose && (
          <button className="mm-close-btn" onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <div className="mm-result-body">
        {/* Modalities Used */}
        {result.modalities_used && result.modalities_used.length > 0 && (
          <div className="mm-section mm-modalities-section">
            <h3>사용된 모달리티</h3>
            <div className="mm-modality-tags">
              {result.modalities_used.map((mod, i) => (
                <span key={i} className={`mm-modality-tag ${mod.toLowerCase()}`}>
                  {mod === 'mri' && '🧠'}
                  {mod === 'gene' && '🧬'}
                  {mod === 'protein' && '🔬'}
                  {mod === 'clinical' && '📋'}
                  {mod}
                </span>
              ))}
            </div>
          </div>
        )}

        {/* Risk Group */}
        {result.risk_group && (
          <div className="mm-section mm-risk-section">
            <h3>위험군 분류</h3>
            <div className="mm-risk-display">
              <div
                className="mm-risk-badge"
                style={{
                  backgroundColor: getRiskColor(result.risk_group.predicted_class),
                  color: '#fff'
                }}
              >
                {result.risk_group.predicted_class}
              </div>
              <div className="mm-risk-probabilities">
                {Object.entries(result.risk_group.probabilities).map(([key, value]) => (
                  <div key={key} className="mm-prob-bar-container">
                    <div className="mm-prob-label">{key}</div>
                    <div className="mm-prob-bar-wrapper">
                      <div
                        className="mm-prob-bar"
                        style={{
                          width: formatPercent(value),
                          backgroundColor: getRiskColor(key)
                        }}
                      />
                    </div>
                    <div className="mm-prob-value">{formatPercent(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Survival Analysis */}
        {result.survival && (
          <div className="mm-section mm-survival-section">
            <h3>생존 분석 (Cox PH)</h3>
            <div className="mm-stats-grid">
              <div className="mm-stat-item">
                <div className="mm-stat-label">위험비 (Hazard Ratio)</div>
                <div className="mm-stat-value">{result.survival.hazard_ratio.toFixed(3)}</div>
              </div>
              <div className="mm-stat-item">
                <div className="mm-stat-label">위험 점수</div>
                <div className="mm-stat-value">{result.survival.risk_score.toFixed(3)}</div>
              </div>
              {result.survival.survival_probability_6m !== undefined && (
                <div className="mm-stat-item">
                  <div className="mm-stat-label">6개월 생존율</div>
                  <div className="mm-stat-value mm-highlight">
                    {formatPercent(result.survival.survival_probability_6m)}
                  </div>
                </div>
              )}
              {result.survival.survival_probability_12m !== undefined && (
                <div className="mm-stat-item">
                  <div className="mm-stat-label">12개월 생존율</div>
                  <div className="mm-stat-value mm-highlight">
                    {formatPercent(result.survival.survival_probability_12m)}
                  </div>
                </div>
              )}
              {result.survival.model_cindex !== undefined && (
                <div className="mm-stat-item mm-cindex">
                  <div className="mm-stat-label">Model C-Index</div>
                  <div className="mm-stat-value mm-cindex-value">
                    {result.survival.model_cindex.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OS Days Prediction */}
        {result.os_days && (
          <div className="mm-section mm-os-section">
            <h3>예상 생존 기간</h3>
            <div className="mm-os-display">
              <div className="mm-os-main">
                <div className="mm-os-value">{result.os_days.predicted_months.toFixed(1)}</div>
                <div className="mm-os-unit">개월</div>
              </div>
              <div className="mm-os-detail">
                ({result.os_days.predicted_days}일)
              </div>
              {result.os_days.confidence_interval && (
                <div className="mm-os-ci">
                  95% CI: {result.os_days.confidence_interval.lower.toFixed(1)} - {result.os_days.confidence_interval.upper.toFixed(1)} 개월
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recurrence Prediction */}
        {result.recurrence && (
          <div className="mm-section mm-recurrence-section">
            <h3>재발 예측</h3>
            <div className="mm-prediction-display">
              <div className={`mm-prediction-class ${result.recurrence.predicted_class.toLowerCase().replace('_', '-')}`}>
                {result.recurrence.predicted_class === 'Recurrence' ? '재발 위험' : '재발 없음'}
              </div>
              <div className="mm-prediction-prob">
                <div className="mm-prob-circle">
                  <svg viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="#e0e0e0"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke={result.recurrence.recurrence_probability > 0.5 ? '#ff9800' : '#4caf50'}
                      strokeWidth="8"
                      strokeDasharray={`${result.recurrence.recurrence_probability * 283} 283`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="mm-prob-text">
                    {formatPercent(result.recurrence.recurrence_probability)}
                  </div>
                </div>
                <div className="mm-prob-label">재발 확률</div>
              </div>
            </div>
          </div>
        )}

        {/* TMZ Response Prediction */}
        {result.tmz_response && (
          <div className="mm-section mm-tmz-section">
            <h3>TMZ 치료 반응 예측</h3>
            <div className="mm-prediction-display">
              <div className={`mm-prediction-class ${result.tmz_response.predicted_class.toLowerCase().replace('_', '-')}`}>
                {result.tmz_response.predicted_class === 'Responder' ? '반응군' : '비반응군'}
              </div>
              <div className="mm-prediction-prob">
                <div className="mm-prob-circle">
                  <svg viewBox="0 0 100 100">
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke="#e0e0e0"
                      strokeWidth="8"
                    />
                    <circle
                      cx="50" cy="50" r="45"
                      fill="none"
                      stroke={result.tmz_response.responder_probability > 0.5 ? '#4caf50' : '#f44336'}
                      strokeWidth="8"
                      strokeDasharray={`${result.tmz_response.responder_probability * 283} 283`}
                      transform="rotate(-90 50 50)"
                    />
                  </svg>
                  <div className="mm-prob-text">
                    {formatPercent(result.tmz_response.responder_probability)}
                  </div>
                </div>
                <div className="mm-prob-label">반응 확률</div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {result.recommendation && (
          <div className="mm-section mm-recommendation-section">
            <h3>권고사항</h3>
            <div className="mm-recommendation-text">
              {result.recommendation}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="mm-section mm-metadata-section">
          <div className="mm-metadata-item">
            <span className="mm-meta-label">처리 시간:</span>
            <span className="mm-meta-value">{result.processing_time_ms?.toFixed(1) || 0}ms</span>
          </div>
          <div className="mm-metadata-item">
            <span className="mm-meta-label">모델 버전:</span>
            <span className="mm-meta-value">{result.model_version || 'MM-v2.0'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MMResultViewer
