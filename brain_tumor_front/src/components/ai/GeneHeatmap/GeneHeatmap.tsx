/**
 * GeneHeatmap Component
 * CSS Grid 기반 유전자 발현량 히트맵
 * 담당자 B: MG 유전자 분석 시각화
 */

import React, { useState, useMemo } from 'react'
import './GeneHeatmap.css'

// 히트맵 셀 데이터
interface HeatmapCell {
  gene: string
  sample: string
  value: number // 정규화된 값 (-1 ~ 1)
}

// 컴포넌트 Props
interface GeneHeatmapProps {
  // 유전자 이름 배열 (행)
  genes: string[]
  // 샘플 이름 배열 (열)
  samples: string[]
  // 발현량 행렬 [gene][sample]
  values: number[][]
  // 셀 크기 (px)
  cellSize?: number
  // 로딩 상태
  loading?: boolean
  // 타이틀 표시 여부
  showTitle?: boolean
  // 유전자 레이블 표시 여부
  showGeneLabels?: boolean
  // 샘플 레이블 표시 여부
  showSampleLabels?: boolean
  // 최대 표시 유전자 수
  maxGenes?: number
  // 최대 표시 샘플 수
  maxSamples?: number
}

// 값에 따른 색상 계산 (파랑 → 흰색 → 빨강)
const getColor = (value: number): string => {
  // 값 범위 클램핑 (-1 ~ 1)
  const clampedValue = Math.max(-1, Math.min(1, value))

  if (clampedValue < 0) {
    // 음수: 파랑 계열 (저발현)
    const intensity = Math.abs(clampedValue)
    const r = Math.round(255 - intensity * 190)
    const g = Math.round(255 - intensity * 170)
    const b = 255
    return `rgb(${r}, ${g}, ${b})`
  } else if (clampedValue > 0) {
    // 양수: 빨강 계열 (고발현)
    const intensity = clampedValue
    const r = 255
    const g = Math.round(255 - intensity * 170)
    const b = Math.round(255 - intensity * 190)
    return `rgb(${r}, ${g}, ${b})`
  }
  // 0: 흰색
  return 'rgb(255, 255, 255)'
}

const GeneHeatmap: React.FC<GeneHeatmapProps> = ({
  genes,
  samples,
  values,
  cellSize = 20,
  loading = false,
  showTitle = true,
  showGeneLabels = true,
  showSampleLabels = true,
  maxGenes = 30,
  maxSamples = 20,
}) => {
  const [hoveredCell, setHoveredCell] = useState<HeatmapCell | null>(null)
  const [tooltipPos, setTooltipPos] = useState({ x: 0, y: 0 })

  // 데이터 제한
  const displayGenes = useMemo(() => genes.slice(0, maxGenes), [genes, maxGenes])
  const displaySamples = useMemo(() => samples.slice(0, maxSamples), [samples, maxSamples])
  const displayValues = useMemo(
    () => values.slice(0, maxGenes).map(row => row.slice(0, maxSamples)),
    [values, maxGenes, maxSamples]
  )

  // 마우스 호버 핸들러
  const handleMouseEnter = (
    e: React.MouseEvent,
    gene: string,
    sample: string,
    value: number
  ) => {
    setHoveredCell({ gene, sample, value })
    setTooltipPos({ x: e.clientX, y: e.clientY })
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (hoveredCell) {
      setTooltipPos({ x: e.clientX, y: e.clientY })
    }
  }

  const handleMouseLeave = () => {
    setHoveredCell(null)
  }

  // 로딩 상태
  if (loading) {
    return (
      <div className="gene-heatmap gene-heatmap--loading">
        <div className="gene-heatmap__spinner" />
        <span>히트맵 로딩 중...</span>
      </div>
    )
  }

  // 데이터 없음
  if (!genes.length || !samples.length || !values.length) {
    return (
      <div className="gene-heatmap gene-heatmap--empty">
        <span className="gene-heatmap__empty-icon">🧬</span>
        <span>히트맵 데이터가 없습니다.</span>
      </div>
    )
  }

  return (
    <div className="gene-heatmap">
      {showTitle && (
        <div className="gene-heatmap__header">
          <h4 className="gene-heatmap__title">유전자 발현 히트맵</h4>
          <span className="gene-heatmap__info">
            {displayGenes.length} genes × {displaySamples.length} samples
          </span>
        </div>
      )}

      <div className="gene-heatmap__wrapper">
        {/* 샘플 레이블 (상단) */}
        {showSampleLabels && (
          <div
            className="gene-heatmap__sample-labels"
            style={{
              marginLeft: showGeneLabels ? '80px' : '0',
              gridTemplateColumns: `repeat(${displaySamples.length}, ${cellSize}px)`,
            }}
          >
            {displaySamples.map((sample, idx) => (
              <div
                key={idx}
                className="gene-heatmap__sample-label"
                title={sample}
              >
                {sample.length > 5 ? `${sample.slice(0, 5)}..` : sample}
              </div>
            ))}
          </div>
        )}

        <div className="gene-heatmap__content">
          {/* 유전자 레이블 (좌측) */}
          {showGeneLabels && (
            <div className="gene-heatmap__gene-labels">
              {displayGenes.map((gene, idx) => (
                <div
                  key={idx}
                  className="gene-heatmap__gene-label"
                  style={{ height: `${cellSize}px` }}
                  title={gene}
                >
                  {gene.length > 8 ? `${gene.slice(0, 8)}..` : gene}
                </div>
              ))}
            </div>
          )}

          {/* 히트맵 그리드 */}
          <div
            className="gene-heatmap__grid"
            style={{
              gridTemplateColumns: `repeat(${displaySamples.length}, ${cellSize}px)`,
              gridTemplateRows: `repeat(${displayGenes.length}, ${cellSize}px)`,
            }}
            onMouseMove={handleMouseMove}
          >
            {displayValues.map((row, geneIdx) =>
              row.map((value, sampleIdx) => (
                <div
                  key={`${geneIdx}-${sampleIdx}`}
                  className="gene-heatmap__cell"
                  style={{ backgroundColor: getColor(value) }}
                  onMouseEnter={(e) =>
                    handleMouseEnter(
                      e,
                      displayGenes[geneIdx],
                      displaySamples[sampleIdx],
                      value
                    )
                  }
                  onMouseLeave={handleMouseLeave}
                />
              ))
            )}
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="gene-heatmap__legend">
        <span className="gene-heatmap__legend-label">저발현</span>
        <div className="gene-heatmap__legend-bar" />
        <span className="gene-heatmap__legend-label">고발현</span>
      </div>

      {/* 툴팁 */}
      {hoveredCell && (
        <div
          className="gene-heatmap__tooltip"
          style={{
            left: tooltipPos.x + 15,
            top: tooltipPos.y + 15,
          }}
        >
          <div className="gene-heatmap__tooltip-row">
            <span className="gene-heatmap__tooltip-label">유전자:</span>
            <span className="gene-heatmap__tooltip-value">{hoveredCell.gene}</span>
          </div>
          <div className="gene-heatmap__tooltip-row">
            <span className="gene-heatmap__tooltip-label">샘플:</span>
            <span className="gene-heatmap__tooltip-value">{hoveredCell.sample}</span>
          </div>
          <div className="gene-heatmap__tooltip-row">
            <span className="gene-heatmap__tooltip-label">발현량:</span>
            <span
              className={`gene-heatmap__tooltip-value ${
                hoveredCell.value >= 0 ? 'positive' : 'negative'
              }`}
            >
              {hoveredCell.value >= 0 ? '+' : ''}
              {hoveredCell.value.toFixed(3)}
            </span>
          </div>
        </div>
      )}

      {/* 데이터 제한 알림 */}
      {(genes.length > maxGenes || samples.length > maxSamples) && (
        <div className="gene-heatmap__truncated">
          표시 제한: {genes.length > maxGenes ? `유전자 ${maxGenes}/${genes.length}개` : ''}
          {genes.length > maxGenes && samples.length > maxSamples ? ', ' : ''}
          {samples.length > maxSamples ? `샘플 ${maxSamples}/${samples.length}개` : ''}
        </div>
      )}
    </div>
  )
}

export default GeneHeatmap
