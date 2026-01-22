/**
 * SurvivalChart Component
 * Kaplan-Meier 스타일 생존 곡선 차트
 * 담당자 B: MG 유전자 분석 시각화
 */

import React from 'react'
import {
  Line,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  ResponsiveContainer,
  ReferenceLine,
  ComposedChart,
} from 'recharts'
import './SurvivalChart.css'

// 생존 곡선 데이터 포인트
interface SurvivalDataPoint {
  time: number
  high: number
  medium: number
  low: number
}

// 컴포넌트 Props
interface SurvivalChartProps {
  // 생존 곡선 데이터 (시간별 생존 확률)
  data: SurvivalDataPoint[]
  // 환자의 위험군
  patientRiskGroup?: 'high' | 'medium' | 'low'
  // 환자의 예측 생존 개월 수
  patientSurvivalMonths?: number
  // 중앙 생존 기간 (각 위험군별)
  medianSurvival?: {
    high: number
    medium: number
    low: number
  }
  // 신뢰 구간 데이터 (선택)
  confidenceInterval?: {
    upper: number[]
    lower: number[]
  }
  // 차트 높이
  height?: number
  // 로딩 상태
  loading?: boolean
  // 타이틀 표시 여부
  showTitle?: boolean
}

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="survival-chart__tooltip">
      <p className="survival-chart__tooltip-label">{label}개월</p>
      {payload.map((entry: any, index: number) => (
        <p
          key={index}
          className="survival-chart__tooltip-item"
          style={{ color: entry.color }}
        >
          {entry.name}: {(entry.value * 100).toFixed(1)}%
        </p>
      ))}
    </div>
  )
}

// 커스텀 범례
const CustomLegend = ({ payload }: any) => {
  if (!payload) return null

  const labels: Record<string, string> = {
    low: '저위험군',
    medium: '중위험군',
    high: '고위험군',
  }

  return (
    <div className="survival-chart__legend">
      {payload.map((entry: any, index: number) => (
        <div key={index} className="survival-chart__legend-item">
          <span
            className="survival-chart__legend-color"
            style={{ backgroundColor: entry.color }}
          />
          <span className="survival-chart__legend-label">
            {labels[entry.dataKey] || entry.value}
          </span>
        </div>
      ))}
    </div>
  )
}

const SurvivalChart: React.FC<SurvivalChartProps> = ({
  data,
  patientRiskGroup,
  patientSurvivalMonths,
  medianSurvival,
  height = 350,
  loading = false,
  showTitle = true,
}) => {
  // 로딩 상태
  if (loading) {
    return (
      <div className="survival-chart survival-chart--loading">
        <div className="survival-chart__spinner" />
        <span>생존 곡선 로딩 중...</span>
      </div>
    )
  }

  // 데이터 없음
  if (!data || data.length === 0) {
    return (
      <div className="survival-chart survival-chart--empty">
        <span className="survival-chart__empty-icon">📊</span>
        <span>생존 곡선 데이터가 없습니다.</span>
      </div>
    )
  }

  // 위험군 색상
  const colors = {
    low: '#4caf50',    // 녹색
    medium: '#ff9800', // 주황색
    high: '#f44336',   // 빨강색
  }

  // 환자 위험군 한글 표시
  const riskGroupLabels: Record<string, string> = {
    high: '고위험군',
    medium: '중위험군',
    low: '저위험군',
  }

  return (
    <div className="survival-chart">
      {showTitle && (
        <div className="survival-chart__header">
          <h4 className="survival-chart__title">생존 곡선 (Kaplan-Meier)</h4>
          {patientRiskGroup && (
            <span
              className={`survival-chart__patient-risk survival-chart__patient-risk--${patientRiskGroup}`}
            >
              환자 위험군: {riskGroupLabels[patientRiskGroup]}
            </span>
          )}
        </div>
      )}

      <div className="survival-chart__container">
        <ResponsiveContainer width="100%" height={height}>
          <ComposedChart data={data} margin={{ top: 20, right: 30, left: 20, bottom: 30 }}>
            <XAxis
              dataKey="time"
              label={{
                value: '시간 (개월)',
                position: 'insideBottom',
                offset: -10,
                style: { fontSize: 12, fill: '#666' },
              }}
              tick={{ fontSize: 11 }}
              tickLine={{ stroke: '#ccc' }}
              axisLine={{ stroke: '#ccc' }}
            />
            <YAxis
              domain={[0, 1]}
              tickFormatter={(v) => `${(v * 100).toFixed(0)}%`}
              label={{
                value: '생존 확률',
                angle: -90,
                position: 'insideLeft',
                style: { fontSize: 12, fill: '#666', textAnchor: 'middle' },
              }}
              tick={{ fontSize: 11 }}
              tickLine={{ stroke: '#ccc' }}
              axisLine={{ stroke: '#ccc' }}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend content={<CustomLegend />} />

            {/* 위험군별 곡선 - step 스타일로 Kaplan-Meier 표현 */}
            <Line
              type="stepAfter"
              dataKey="low"
              stroke={colors.low}
              name="저위험군"
              strokeWidth={patientRiskGroup === 'low' ? 3 : 2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="stepAfter"
              dataKey="medium"
              stroke={colors.medium}
              name="중위험군"
              strokeWidth={patientRiskGroup === 'medium' ? 3 : 2}
              dot={false}
              activeDot={{ r: 4 }}
            />
            <Line
              type="stepAfter"
              dataKey="high"
              stroke={colors.high}
              name="고위험군"
              strokeWidth={patientRiskGroup === 'high' ? 3 : 2}
              dot={false}
              activeDot={{ r: 4 }}
            />

            {/* 환자 위치 표시 (수직선) */}
            {patientSurvivalMonths !== undefined && (
              <ReferenceLine
                x={patientSurvivalMonths}
                stroke="#1976d2"
                strokeDasharray="5 5"
                strokeWidth={2}
                label={{
                  value: `환자: ${patientSurvivalMonths}개월`,
                  position: 'top',
                  fill: '#1976d2',
                  fontSize: 11,
                }}
              />
            )}

            {/* 50% 생존 확률 기준선 */}
            <ReferenceLine
              y={0.5}
              stroke="#999"
              strokeDasharray="3 3"
              label={{
                value: '50%',
                position: 'right',
                fill: '#999',
                fontSize: 10,
              }}
            />
          </ComposedChart>
        </ResponsiveContainer>
      </div>

      {/* 중앙 생존 기간 표시 */}
      {medianSurvival && (
        <div className="survival-chart__median">
          <h5 className="survival-chart__median-title">중앙 생존 기간 (Median Survival)</h5>
          <div className="survival-chart__median-grid">
            <div className="survival-chart__median-item survival-chart__median-item--low">
              <span className="survival-chart__median-label">저위험군</span>
              <span className="survival-chart__median-value">{medianSurvival.low}개월</span>
            </div>
            <div className="survival-chart__median-item survival-chart__median-item--medium">
              <span className="survival-chart__median-label">중위험군</span>
              <span className="survival-chart__median-value">{medianSurvival.medium}개월</span>
            </div>
            <div className="survival-chart__median-item survival-chart__median-item--high">
              <span className="survival-chart__median-label">고위험군</span>
              <span className="survival-chart__median-value">{medianSurvival.high}개월</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default SurvivalChart
