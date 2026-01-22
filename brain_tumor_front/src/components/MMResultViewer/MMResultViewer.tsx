/**
 * MM Result Viewer Component (Light Mode)
 * Multimodal 분석 결과 상세 표시 컴포넌트
 */

import React from 'react'
import './MMResultViewer.css'

interface MMResult {
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
  result: MMResult
  onClose?: () => void
}

const MMResultViewer: React.FC<MMResultViewerProps> = ({ result, onClose }) => {
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
      <div className="result-header">
        <h2>멀티모달 분석 결과</h2>
        {result.patient_id && (
          <div className="patient-id">환자 ID: {result.patient_id}</div>
        )}
        {onClose && (
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        )}
      </div>

      <div className="result-body">
        {/* Modalities Used */}
        {result.modalities_used && result.modalities_used.length > 0 && (
          <div className="section modalities-section">
            <h3>사용된 모달리티</h3>
            <div className="modality-tags">
              {result.modalities_used.map((mod, i) => (
                <span key={i} className={`modality-tag ${mod.toLowerCase()}`}>
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
          <div className="section risk-section">
            <h3>위험군 분류</h3>
            <div className="risk-display">
              <div
                className="risk-badge"
                style={{
                  backgroundColor: getRiskColor(result.risk_group.predicted_class),
                  color: '#fff'
                }}
              >
                {result.risk_group.predicted_class}
              </div>
              <div className="risk-probabilities">
                {Object.entries(result.risk_group.probabilities).map(([key, value]) => (
                  <div key={key} className="prob-bar-container">
                    <div className="prob-label">{key}</div>
                    <div className="prob-bar-wrapper">
                      <div
                        className="prob-bar"
                        style={{
                          width: formatPercent(value),
                          backgroundColor: getRiskColor(key)
                        }}
                      />
                    </div>
                    <div className="prob-value">{formatPercent(value)}</div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {/* Survival Analysis */}
        {result.survival && (
          <div className="section survival-section">
            <h3>생존 분석 (Cox PH)</h3>
            <div className="stats-grid">
              <div className="stat-item">
                <div className="stat-label">위험비 (Hazard Ratio)</div>
                <div className="stat-value">{result.survival.hazard_ratio.toFixed(3)}</div>
              </div>
              <div className="stat-item">
                <div className="stat-label">위험 점수</div>
                <div className="stat-value">{result.survival.risk_score.toFixed(3)}</div>
              </div>
              {result.survival.survival_probability_6m !== undefined && (
                <div className="stat-item">
                  <div className="stat-label">6개월 생존율</div>
                  <div className="stat-value highlight">
                    {formatPercent(result.survival.survival_probability_6m)}
                  </div>
                </div>
              )}
              {result.survival.survival_probability_12m !== undefined && (
                <div className="stat-item">
                  <div className="stat-label">12개월 생존율</div>
                  <div className="stat-value highlight">
                    {formatPercent(result.survival.survival_probability_12m)}
                  </div>
                </div>
              )}
              {result.survival.model_cindex !== undefined && (
                <div className="stat-item cindex">
                  <div className="stat-label">Model C-Index</div>
                  <div className="stat-value cindex-value">
                    {result.survival.model_cindex.toFixed(4)}
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* OS Days Prediction */}
        {result.os_days && (
          <div className="section os-section">
            <h3>예상 생존 기간</h3>
            <div className="os-display">
              <div className="os-main">
                <div className="os-value">{result.os_days.predicted_months.toFixed(1)}</div>
                <div className="os-unit">개월</div>
              </div>
              <div className="os-detail">
                ({result.os_days.predicted_days}일)
              </div>
              {result.os_days.confidence_interval && (
                <div className="os-ci">
                  95% CI: {result.os_days.confidence_interval.lower.toFixed(1)} - {result.os_days.confidence_interval.upper.toFixed(1)} 개월
                </div>
              )}
            </div>
          </div>
        )}

        {/* Recurrence Prediction */}
        {result.recurrence && (
          <div className="section recurrence-section">
            <h3>재발 예측</h3>
            <div className="prediction-display">
              <div className={`prediction-class ${result.recurrence.predicted_class.toLowerCase().replace('_', '-')}`}>
                {result.recurrence.predicted_class === 'Recurrence' ? '재발 위험' : '재발 없음'}
              </div>
              <div className="prediction-prob">
                <div className="prob-circle">
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
                  <div className="prob-text">
                    {formatPercent(result.recurrence.recurrence_probability)}
                  </div>
                </div>
                <div className="prob-label">재발 확률</div>
              </div>
            </div>
          </div>
        )}

        {/* TMZ Response Prediction */}
        {result.tmz_response && (
          <div className="section tmz-section">
            <h3>TMZ 치료 반응 예측</h3>
            <div className="prediction-display">
              <div className={`prediction-class ${result.tmz_response.predicted_class.toLowerCase().replace('_', '-')}`}>
                {result.tmz_response.predicted_class === 'Responder' ? '반응군' : '비반응군'}
              </div>
              <div className="prediction-prob">
                <div className="prob-circle">
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
                  <div className="prob-text">
                    {formatPercent(result.tmz_response.responder_probability)}
                  </div>
                </div>
                <div className="prob-label">반응 확률</div>
              </div>
            </div>
          </div>
        )}

        {/* Recommendation */}
        {result.recommendation && (
          <div className="section recommendation-section">
            <h3>권고사항</h3>
            <div className="recommendation-text">
              {result.recommendation}
            </div>
          </div>
        )}

        {/* Metadata */}
        <div className="section metadata-section">
          <div className="metadata-item">
            <span className="meta-label">처리 시간:</span>
            <span className="meta-value">{result.processing_time_ms?.toFixed(1) || 0}ms</span>
          </div>
          <div className="metadata-item">
            <span className="meta-label">모델 버전:</span>
            <span className="meta-value">{result.model_version || 'MM-v2.0'}</span>
          </div>
        </div>
      </div>
    </div>
  )
}

export default MMResultViewer
