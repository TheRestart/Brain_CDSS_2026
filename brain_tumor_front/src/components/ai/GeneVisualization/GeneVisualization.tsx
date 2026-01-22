/**
 * Gene Visualization Component
 * Gene Expression 데이터 시각화 (서버에서 처리된 데이터 사용)
 */

import React from 'react'
import './GeneVisualization.css'

interface GeneStats {
  count: number
  min: number
  max: number
  mean: number
  std: number
  median: number
  q1: number
  q3: number
}

interface TopGene {
  gene: string
  value: number
  rawValue: number
}

interface DistributionBin {
  range: string
  count: number
  percent: number
}

// API 응답 데이터 타입
export interface GeneExpressionData {
  ocs_id: number
  patient_id: string | null
  gene_count: number
  stats: GeneStats
  distribution: DistributionBin[]
  topGenes: TopGene[]
}

interface GeneVisualizationProps {
  data?: GeneExpressionData | null
  patientId?: string
  loading?: boolean
  error?: string | null
}

const GeneVisualization: React.FC<GeneVisualizationProps> = ({
  data,
  patientId,
  loading,
  error
}) => {
  if (loading) {
    return (
      <div className="gene-viz">
        <div className="gene-viz-header">
          <h3>유전자 발현 분석</h3>
          <span className="model-badge">Gene Expression</span>
        </div>
        <div className="gene-viz-content">
          <div className="gene-viz-loading">
            <div className="spinner"></div>
            <span>데이터 로딩 중...</span>
          </div>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="gene-viz">
        <div className="gene-viz-header">
          <h3>유전자 발현 분석</h3>
          <span className="model-badge">Gene Expression</span>
        </div>
        <div className="gene-viz-content">
          <div className="gene-viz-error">
            <span className="error-icon">!</span>
            {error}
          </div>
        </div>
      </div>
    )
  }

  if (!data || !data.stats) {
    return (
      <div className="gene-viz">
        <div className="gene-viz-header">
          <h3>유전자 발현 분석</h3>
          <span className="model-badge">Gene Expression</span>
        </div>
        <div className="gene-viz-content">
          <div className="gene-viz-empty">
            <span className="empty-icon">DNA</span>
            <span>OCS를 선택하면 유전자 발현 데이터가 표시됩니다.</span>
          </div>
        </div>
      </div>
    )
  }

  const { stats, distribution, topGenes } = data
  const displayPatientId = patientId || data.patient_id

  return (
    <div className="gene-viz">
      <div className="gene-viz-header">
        <h3>유전자 발현 분석</h3>
        <span className="model-badge">Gene Expression</span>
      </div>

      <div className="gene-viz-content">
        {displayPatientId && (
          <div className="gene-viz-patient">
            <span className="patient-label">환자 ID:</span>
            <span className="patient-value">{displayPatientId}</span>
          </div>
        )}

        {/* 통계 정보 */}
        <div className="gene-stats-section">
          <h4>통계 정보 <span className="preprocess-badge">log2 + z-score</span></h4>
          <div className="gene-stats-grid">
            <div className="stat-item">
              <span className="stat-label">유전자 수</span>
              <span className="stat-value">{stats.count.toLocaleString()}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">평균 (z)</span>
              <span className="stat-value">{stats.mean.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">표준편차</span>
              <span className="stat-value">{stats.std.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">중앙값</span>
              <span className="stat-value">{stats.median.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">최소값</span>
              <span className="stat-value">{stats.min.toFixed(2)}</span>
            </div>
            <div className="stat-item">
              <span className="stat-label">최대값</span>
              <span className="stat-value">{stats.max.toFixed(2)}</span>
            </div>
          </div>
        </div>

        {/* 발현 분포 히스토그램 */}
        {distribution && distribution.length > 0 && (
          <div className="gene-distribution-section">
            <h4>발현 분포</h4>
            <div className="histogram">
              {distribution.map((bin, i) => (
                <div key={i} className="histogram-bar-container">
                  <div
                    className="histogram-bar"
                    style={{ height: `${bin.percent}%` }}
                    title={`${bin.range}: ${bin.count}개`}
                  />
                  <span className="histogram-label">{bin.count}</span>
                </div>
              ))}
            </div>
            <div className="histogram-range">
              <span>{stats.min.toFixed(1)}</span>
              <span>{stats.max.toFixed(1)}</span>
            </div>
          </div>
        )}

        {/* Top 발현 유전자 */}
        {topGenes && topGenes.length > 0 && (
          <div className="top-genes-section">
            <h4>Top 10 발현 유전자</h4>
            <div className="top-genes-list">
              {topGenes.map((g, i) => (
                <div key={i} className="top-gene-item">
                  <span className="gene-rank">#{i + 1}</span>
                  <span className="gene-name" title={`Raw: ${g.rawValue?.toFixed(2) || 'N/A'}`}>
                    {g.gene}
                  </span>
                  <div className="gene-bar-track">
                    <div
                      className="gene-bar-fill"
                      style={{ width: `${Math.min((g.value / (stats?.max || 1)) * 100, 100)}%` }}
                    />
                  </div>
                  <span className="gene-value">
                    {g.value >= 0 ? '+' : ''}{g.value.toFixed(2)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default GeneVisualization
