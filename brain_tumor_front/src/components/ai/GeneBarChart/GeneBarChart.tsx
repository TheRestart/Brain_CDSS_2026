/**
 * GeneBarChart Component
 * 유전자 중요도 수평 바 차트
 * 담당자 B: MG 유전자 분석 시각화
 */

import React from 'react'
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  LabelList,
} from 'recharts'
import './GeneBarChart.css'

// 유전자 데이터 인터페이스
interface GeneData {
  name: string
  importance: number
  direction?: 'up' | 'down'
  expressionZscore?: number
}

// 컴포넌트 Props
interface GeneBarChartProps {
  // 유전자 데이터 배열
  data: GeneData[]
  // 표시할 최대 유전자 수
  maxGenes?: number
  // 차트 높이 (자동 계산 시 사용)
  height?: number
  // 로딩 상태
  loading?: boolean
  // 타이틀 표시 여부
  showTitle?: boolean
  // 타이틀 텍스트
  title?: string
  // 방향 표시 여부
  showDirection?: boolean
}

// 커스텀 툴팁
const CustomTooltip = ({ active, payload }: any) => {
  if (!active || !payload || !payload.length) return null

  const data = payload[0].payload
  return (
    <div className="gene-bar-chart__tooltip">
      <p className="gene-bar-chart__tooltip-gene">{data.name}</p>
      <p className="gene-bar-chart__tooltip-item">
        중요도: <strong>{(data.importance * 100).toFixed(2)}%</strong>
      </p>
      {data.direction && (
        <p className={`gene-bar-chart__tooltip-direction gene-bar-chart__tooltip-direction--${data.direction}`}>
          발현: {data.direction === 'up' ? '상향 조절' : '하향 조절'}
        </p>
      )}
      {data.expressionZscore !== undefined && (
        <p className="gene-bar-chart__tooltip-item">
          Z-Score: {data.expressionZscore >= 0 ? '+' : ''}{data.expressionZscore.toFixed(2)}
        </p>
      )}
    </div>
  )
}

const GeneBarChart: React.FC<GeneBarChartProps> = ({
  data,
  maxGenes = 10,
  height,
  loading = false,
  showTitle = true,
  title = 'Top 유전자 중요도',
  showDirection = true,
}) => {
  // 로딩 상태
  if (loading) {
    return (
      <div className="gene-bar-chart gene-bar-chart--loading">
        <div className="gene-bar-chart__spinner" />
        <span>유전자 중요도 로딩 중...</span>
      </div>
    )
  }

  // 데이터 없음
  if (!data || data.length === 0) {
    return (
      <div className="gene-bar-chart gene-bar-chart--empty">
        <span className="gene-bar-chart__empty-icon">🧬</span>
        <span>유전자 중요도 데이터가 없습니다.</span>
      </div>
    )
  }

  // 상위 N개 유전자만 표시 (중요도 순 정렬)
  const sortedData = [...data]
    .sort((a, b) => b.importance - a.importance)
    .slice(0, maxGenes)
    .reverse() // 바 차트는 아래에서 위로 표시되므로 역순

  // 차트 높이 계산 (유전자 당 40px + 여백)
  const chartHeight = height || Math.max(sortedData.length * 40 + 60, 200)

  // 바 색상 결정
  const getBarColor = (entry: GeneData): string => {
    if (!showDirection || !entry.direction) {
      return '#1976d2' // 기본 파란색
    }
    return entry.direction === 'up' ? '#ef5350' : '#42a5f5' // 상향: 빨강, 하향: 파랑
  }

  return (
    <div className="gene-bar-chart">
      {showTitle && (
        <div className="gene-bar-chart__header">
          <h4 className="gene-bar-chart__title">{title}</h4>
          {showDirection && (
            <div className="gene-bar-chart__legend">
              <span className="gene-bar-chart__legend-item gene-bar-chart__legend-item--up">
                <span className="gene-bar-chart__legend-dot" />
                상향 조절
              </span>
              <span className="gene-bar-chart__legend-item gene-bar-chart__legend-item--down">
                <span className="gene-bar-chart__legend-dot" />
                하향 조절
              </span>
            </div>
          )}
        </div>
      )}

      <div className="gene-bar-chart__container">
        <ResponsiveContainer width="100%" height={chartHeight}>
          <BarChart
            data={sortedData}
            layout="vertical"
            margin={{ top: 10, right: 60, left: 80, bottom: 10 }}
          >
            <XAxis
              type="number"
              domain={[0, 'auto']}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              tick={{ fontSize: 11 }}
              axisLine={{ stroke: '#e0e0e0' }}
              tickLine={{ stroke: '#e0e0e0' }}
            />
            <YAxis
              type="category"
              dataKey="name"
              tick={{ fontSize: 12, fontWeight: 500 }}
              axisLine={false}
              tickLine={false}
              width={75}
            />
            <Tooltip content={<CustomTooltip />} cursor={{ fill: 'rgba(0, 0, 0, 0.05)' }} />
            <Bar
              dataKey="importance"
              radius={[0, 4, 4, 0]}
              maxBarSize={24}
            >
              {sortedData.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={getBarColor(entry)} />
              ))}
              <LabelList
                dataKey="importance"
                position="right"
                formatter={(v) => `${(Number(v) * 100).toFixed(1)}%`}
                style={{ fontSize: 11, fill: '#666' }}
              />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* 통계 요약 */}
      <div className="gene-bar-chart__summary">
        <span className="gene-bar-chart__summary-item">
          표시 유전자: <strong>{sortedData.length}개</strong>
        </span>
        {data.length > maxGenes && (
          <span className="gene-bar-chart__summary-item">
            전체: {data.length}개 중 상위 {maxGenes}개
          </span>
        )}
      </div>
    </div>
  )
}

export default GeneBarChart
