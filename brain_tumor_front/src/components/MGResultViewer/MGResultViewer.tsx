/**
 * MG Result Viewer Component
 * Gene Expression 분석 결과 및 시각화 표시
 */

import React, { useState } from 'react'
import './MGResultViewer.css'

// XAI Types
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
  deg_encoded_features?: number[]
  expression_stats?: {
    mean: number
    std: number
    min: number
    max: number
    nonzero_count: number
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

interface MGResultViewerProps {
  result: MGResult
  title?: string
}

type TabType = 'summary' | 'survival' | 'predictions' | 'visualizations' | 'xai'

const MGResultViewer: React.FC<MGResultViewerProps> = ({
  result,
  title = 'MG 분석 결과',
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('summary')

  // Risk Score 카테고리
  const getRiskCategory = (score: number): string => {
    if (score < 0.33) return 'Low'
    if (score < 0.66) return 'Medium'
    return 'High'
  }

  // Risk 카테고리 색상 클래스
  const getRiskColorClass = (score: number) => {
    if (score < 0.33) return 'risk-low'
    if (score < 0.66) return 'risk-medium'
    return 'risk-high'
  }

  // 확률을 퍼센트로 변환
  const toPercent = (value: number) => Math.round(value * 100)

  const survivalRisk = result.survival_risk
  const survivalTime = result.survival_time
  const grade = result.grade
  const recurrence = result.recurrence
  const tmzResponse = result.tmz_response

  return (
    <div className="mg-result-viewer">
      {/* 헤더 */}
      <div className="result-header">
        <h3>{title}</h3>
        {result.patient_id && (
          <span className="patient-id">환자: {result.patient_id}</span>
        )}
        {result.input_genes_count && (
          <span className="gene-count">분석 유전자: {result.input_genes_count}개</span>
        )}
      </div>

      {/* 탭 네비게이션 */}
      <div className="result-tabs">
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
        {result.visualizations && (
          <button
            className={activeTab === 'visualizations' ? 'active' : ''}
            onClick={() => setActiveTab('visualizations')}
          >
            시각화
          </button>
        )}
        {result.xai && (
          <button
            className={activeTab === 'xai' ? 'active' : ''}
            onClick={() => setActiveTab('xai')}
          >
            XAI 분석
          </button>
        )}
      </div>

      {/* 탭 콘텐츠 */}
      <div className="result-content">
        {/* 요약 탭 */}
        {activeTab === 'summary' && (
          <div className="tab-summary">
            {/* 위험도 게이지 */}
            {survivalRisk && (
              <div className="risk-gauge-section">
                <h4>생존 위험도</h4>
                <div className="risk-gauge">
                  <div
                    className={`risk-indicator ${getRiskColorClass(survivalRisk.risk_score)}`}
                    style={{ left: `${Math.max(0, Math.min(survivalRisk.risk_score * 100, 100))}%` }}
                  />
                </div>
                <div className="risk-scale">
                  <span>Low</span>
                  <span>Medium</span>
                  <span>High</span>
                </div>
                <div className="risk-value">
                  <span className={`risk-category ${getRiskColorClass(survivalRisk.risk_score)}`}>
                    {getRiskCategory(survivalRisk.risk_score)}
                  </span>
                  <span className="risk-score">Score: {survivalRisk.risk_score.toFixed(3)}</span>
                  {survivalRisk.risk_percentile !== undefined && (
                    <span className="risk-percentile">상위 {Math.abs(survivalRisk.risk_percentile).toFixed(1)}%</span>
                  )}
                  {survivalRisk.model_cindex !== undefined && (
                    <span className="model-cindex">C-Index: {survivalRisk.model_cindex.toFixed(4)}</span>
                  )}
                </div>
              </div>
            )}

            {/* 주요 결과 카드 */}
            <div className="summary-cards">
              {grade && (
                <div className="summary-card grade">
                  <div className="card-icon">🧬</div>
                  <div className="card-content">
                    <span className="card-label">종양 등급</span>
                    <span className="card-value">{grade.predicted_class}</span>
                    <span className="card-confidence">{toPercent(grade.probability)}% 신뢰도</span>
                  </div>
                </div>
              )}

              {survivalTime && (
                <div className="summary-card survival">
                  <div className="card-icon">📅</div>
                  <div className="card-content">
                    <span className="card-label">예측 생존 기간</span>
                    <span className="card-value">{survivalTime.predicted_months.toFixed(1)}개월</span>
                    <span className="card-confidence">({survivalTime.predicted_days}일)</span>
                  </div>
                </div>
              )}

              {recurrence && (
                <div className="summary-card recurrence">
                  <div className="card-icon">🔄</div>
                  <div className="card-content">
                    <span className="card-label">재발 예측</span>
                    <span className="card-value">
                      {recurrence.predicted_class === 'Recurrence' ? '재발 가능' : '재발 없음'}
                    </span>
                    <span className="card-confidence">{toPercent(recurrence.probability)}% 확률</span>
                  </div>
                </div>
              )}

              {tmzResponse && (
                <div className="summary-card tmz">
                  <div className="card-icon">💊</div>
                  <div className="card-content">
                    <span className="card-label">TMZ 반응</span>
                    <span className="card-value">
                      {tmzResponse.predicted_class === 'Responder' || tmzResponse.predicted_class === 'Likely Responsive' ? '반응 예상' : '비반응 예상'}
                    </span>
                    <span className="card-confidence">{toPercent(tmzResponse.probability)}% 확률</span>
                  </div>
                </div>
              )}
            </div>

            {/* 메타 정보 */}
            <div className="meta-info">
              <span>분석 유전자: {result.input_genes_count || '-'}개</span>
              <span>처리 시간: {result.processing_time_ms?.toFixed(1) || 0}ms</span>
              <span>모델 버전: {result.model_version || '-'}</span>
            </div>
          </div>
        )}

        {/* 생존 분석 탭 */}
        {activeTab === 'survival' && (
          <div className="tab-survival">
            {survivalRisk && (
              <div className="survival-detail">
                <h4>생존 위험도 상세</h4>
                <div className="detail-grid">
                  <div className="detail-item">
                    <span className="detail-label">Risk Score</span>
                    <span className="detail-value">{survivalRisk.risk_score.toFixed(4)}</span>
                  </div>
                  {survivalRisk.risk_percentile !== undefined && (
                    <div className="detail-item">
                      <span className="detail-label">백분위</span>
                      <span className="detail-value">상위 {Math.abs(survivalRisk.risk_percentile).toFixed(1)}%</span>
                    </div>
                  )}
                  <div className="detail-item">
                    <span className="detail-label">위험 카테고리</span>
                    <span className={`detail-value category ${getRiskColorClass(survivalRisk.risk_score)}`}>
                      {getRiskCategory(survivalRisk.risk_score)}
                    </span>
                  </div>
                </div>
              </div>
            )}

            {survivalTime && (
              <div className="survival-time-detail">
                <h4>예측 생존 기간</h4>
                <div className="time-display">
                  <div className="time-main">
                    <span className="time-value">{survivalTime.predicted_months.toFixed(1)}</span>
                    <span className="time-unit">개월</span>
                  </div>
                  {survivalTime.confidence_interval && (
                    <div className="time-range">
                      신뢰 구간: {survivalTime.confidence_interval.lower.toFixed(1)} ~ {survivalTime.confidence_interval.upper.toFixed(1)}개월
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* 생존 곡선 시각화 */}
            {result.visualizations?.survival_chart && (
              <div className="visualization-section">
                <h4>생존 곡선</h4>
                <img
                  src={`data:image/png;base64,${result.visualizations.survival_chart}`}
                  alt="Survival Curve"
                  className="visualization-image"
                />
              </div>
            )}
          </div>
        )}

        {/* 예측 결과 탭 */}
        {activeTab === 'predictions' && (
          <div className="tab-predictions">
            {/* Grade */}
            {grade && (
              <div className="prediction-section">
                <h4>종양 등급 (Grade)</h4>
                <div className="prediction-result">
                  <span className="prediction-label">예측 결과:</span>
                  <span className={`prediction-value ${grade.predicted_class.toLowerCase().replace(' ', '-')}`}>
                    {grade.predicted_class}
                  </span>
                </div>
                <div className="probability-bars">
                  <div className="prob-bar">
                    <span className="prob-label">LGG</span>
                    <div className="prob-track">
                      <div
                        className="prob-fill lgg"
                        style={{ width: `${toPercent(grade.lgg_probability || 0)}%` }}
                      />
                    </div>
                    <span className="prob-value">{toPercent(grade.lgg_probability || 0)}%</span>
                  </div>
                  <div className="prob-bar">
                    <span className="prob-label">HGG</span>
                    <div className="prob-track">
                      <div
                        className="prob-fill hgg"
                        style={{ width: `${toPercent(grade.hgg_probability || 0)}%` }}
                      />
                    </div>
                    <span className="prob-value">{toPercent(grade.hgg_probability || 0)}%</span>
                  </div>
                </div>
              </div>
            )}

            {/* Recurrence */}
            {recurrence && (
              <div className="prediction-section">
                <h4>재발 예측 (Recurrence)</h4>
                <div className="prediction-result">
                  <span className="prediction-label">예측 결과:</span>
                  <span className={`prediction-value ${recurrence.predicted_class === 'Recurrence' ? 'positive' : 'negative'}`}>
                    {recurrence.predicted_class === 'Recurrence' ? '재발 가능성 있음' : '재발 가능성 낮음'}
                  </span>
                </div>
                <div className="single-prob-bar">
                  <span>재발 확률:</span>
                  <div className="prob-track">
                    <div
                      className="prob-fill recurrence"
                      style={{ width: `${toPercent(recurrence.recurrence_probability || 0)}%` }}
                    />
                  </div>
                  <span>{toPercent(recurrence.recurrence_probability || 0)}%</span>
                </div>
              </div>
            )}

            {/* TMZ Response */}
            {tmzResponse && (
              <div className="prediction-section">
                <h4>TMZ 치료 반응</h4>
                <div className="prediction-result">
                  <span className="prediction-label">예측 결과:</span>
                  <span className={`prediction-value ${tmzResponse.predicted_class === 'Responder' || tmzResponse.predicted_class === 'Likely Responsive' ? 'negative' : 'positive'}`}>
                    {tmzResponse.predicted_class === 'Responder' || tmzResponse.predicted_class === 'Likely Responsive' ? '반응 예상' : '비반응 예상'}
                  </span>
                </div>
                <div className="single-prob-bar">
                  <span>반응 확률:</span>
                  <div className="prob-track">
                    <div
                      className="prob-fill tmz"
                      style={{ width: `${toPercent(tmzResponse.responder_probability || 0)}%` }}
                    />
                  </div>
                  <span>{toPercent(tmzResponse.responder_probability || 0)}%</span>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 시각화 탭 */}
        {activeTab === 'visualizations' && result.visualizations && (
          <div className="tab-visualizations">
            {result.visualizations.grade_chart && (
              <div className="viz-section">
                <h4>Grade 차트</h4>
                <img
                  src={`data:image/png;base64,${result.visualizations.grade_chart}`}
                  alt="Grade Chart"
                  className="visualization-image"
                />
              </div>
            )}

            {result.visualizations.risk_gauge && (
              <div className="viz-section">
                <h4>Risk Gauge</h4>
                <img
                  src={`data:image/png;base64,${result.visualizations.risk_gauge}`}
                  alt="Risk Gauge"
                  className="visualization-image"
                />
              </div>
            )}

            {result.visualizations.recurrence_chart && (
              <div className="viz-section">
                <h4>재발 차트</h4>
                <img
                  src={`data:image/png;base64,${result.visualizations.recurrence_chart}`}
                  alt="Recurrence Chart"
                  className="visualization-image"
                />
              </div>
            )}

            {!result.visualizations.grade_chart &&
             !result.visualizations.risk_gauge &&
             !result.visualizations.recurrence_chart && (
              <div className="no-viz">
                <p>시각화 데이터가 없습니다.</p>
              </div>
            )}
          </div>
        )}

        {/* XAI 분석 탭 */}
        {activeTab === 'xai' && result.xai && (
          <div className="tab-xai">
            {/* Top Genes */}
            {result.xai.top_genes && result.xai.top_genes.length > 0 && (
              <div className="xai-section">
                <h4>Top Important Genes (Attention 기반)</h4>
                <div className="top-genes-table">
                  <div className="table-header">
                    <span className="col-rank">순위</span>
                    <span className="col-gene">유전자</span>
                    <span className="col-attention">Attention</span>
                    <span className="col-zscore">Z-Score</span>
                  </div>
                  {result.xai.top_genes.map((gene, idx) => (
                    <div key={idx} className="table-row">
                      <span className="col-rank">#{gene.rank}</span>
                      <span className="col-gene">{gene.gene}</span>
                      <span className="col-attention">
                        <div className="attention-bar-track">
                          <div
                            className="attention-bar-fill"
                            style={{
                              width: `${Math.min(gene.attention_score * 100, 100)}%`,
                            }}
                          />
                        </div>
                        <span>{gene.attention_score.toFixed(4)}</span>
                      </span>
                      <span className={`col-zscore ${gene.expression_zscore >= 0 ? 'positive' : 'negative'}`}>
                        {gene.expression_zscore >= 0 ? '+' : ''}
                        {gene.expression_zscore.toFixed(2)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* DEG Cluster Scores */}
            {result.xai.deg_cluster_scores && (
              <div className="xai-section">
                <h4>DEG Cluster Scores</h4>
                <div className="deg-clusters">
                  {Object.entries(result.xai.deg_cluster_scores).map(([cluster, info]) => (
                    <div key={cluster} className="deg-cluster-item">
                      <div className="cluster-name">{cluster}</div>
                      <div className="cluster-score">
                        <div className="score-bar-track">
                          <div
                            className={`score-bar-fill ${info.score >= 0 ? 'positive' : 'negative'}`}
                            style={{
                              width: `${Math.min(Math.abs(info.score) * 10, 100)}%`,
                              marginLeft: info.score < 0 ? 'auto' : '0',
                            }}
                          />
                        </div>
                        <span className={info.score >= 0 ? 'positive' : 'negative'}>
                          {info.score >= 0 ? '+' : ''}{info.score.toFixed(2)}
                        </span>
                      </div>
                      <div className="cluster-counts">
                        <span className="up-count">Up: {info.up_genes_count}</span>
                        <span className="down-count">Down: {info.down_genes_count}</span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Gene Importance Summary */}
            {result.xai.gene_importance_summary && (
              <div className="xai-section">
                <h4>Gene Importance 요약</h4>
                <div className="importance-stats">
                  <div className="stat-item">
                    <span className="stat-label">Total Genes</span>
                    <span className="stat-value">{result.xai.gene_importance_summary.total_genes}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Attention 평균</span>
                    <span className="stat-value">{result.xai.gene_importance_summary.attention_mean.toFixed(4)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Attention 표준편차</span>
                    <span className="stat-value">{result.xai.gene_importance_summary.attention_std.toFixed(4)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Attention Max</span>
                    <span className="stat-value">{result.xai.gene_importance_summary.attention_max.toFixed(4)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Expression Stats */}
            {result.xai.expression_stats && (
              <div className="xai-section">
                <h4>Expression 통계</h4>
                <div className="expression-stats">
                  <div className="stat-item">
                    <span className="stat-label">평균</span>
                    <span className="stat-value">{result.xai.expression_stats.mean.toFixed(3)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">표준편차</span>
                    <span className="stat-value">{result.xai.expression_stats.std.toFixed(3)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">최소값</span>
                    <span className="stat-value">{result.xai.expression_stats.min.toFixed(3)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">최대값</span>
                    <span className="stat-value">{result.xai.expression_stats.max.toFixed(3)}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Positive Count</span>
                    <span className="stat-value">{result.xai.expression_stats.positive_count}</span>
                  </div>
                  <div className="stat-item">
                    <span className="stat-label">Negative Count</span>
                    <span className="stat-value">{result.xai.expression_stats.negative_count}</span>
                  </div>
                </div>
              </div>
            )}

            {/* XAI Visualizations */}
            {result.visualizations && (
              <div className="xai-visualizations">
                {result.visualizations.top_genes_chart && (
                  <div className="viz-section">
                    <h4>Top Important Genes 차트</h4>
                    <img
                      src={`data:image/png;base64,${result.visualizations.top_genes_chart}`}
                      alt="Top Genes Chart"
                      className="visualization-image"
                    />
                  </div>
                )}

                {result.visualizations.deg_cluster_chart && (
                  <div className="viz-section">
                    <h4>DEG Cluster Scores 차트</h4>
                    <img
                      src={`data:image/png;base64,${result.visualizations.deg_cluster_chart}`}
                      alt="DEG Cluster Chart"
                      className="visualization-image"
                    />
                  </div>
                )}

                {result.visualizations.attention_distribution_chart && (
                  <div className="viz-section">
                    <h4>Attention 분포</h4>
                    <img
                      src={`data:image/png;base64,${result.visualizations.attention_distribution_chart}`}
                      alt="Attention Distribution"
                      className="visualization-image"
                    />
                  </div>
                )}

                {result.visualizations.expression_profile_chart && (
                  <div className="viz-section">
                    <h4>Expression Profile</h4>
                    <img
                      src={`data:image/png;base64,${result.visualizations.expression_profile_chart}`}
                      alt="Expression Profile"
                      className="visualization-image"
                    />
                  </div>
                )}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

export default MGResultViewer
