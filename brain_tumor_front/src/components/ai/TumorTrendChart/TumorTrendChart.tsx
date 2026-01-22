/**
 * TumorTrendChart Component
 * 종양 부피 변화 시각화 (조건부 렌더링)
 * 담당자 A: AI 결과 비교 기능
 *
 * - 결과 1개: 현재 부피만 표시
 * - 결과 2개: 비교 카드 + 증감률
 * - 결과 3개+: Line Chart
 */

import React from 'react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts'
import './TumorTrendChart.css'

// 종양 데이터 인터페이스
export interface TumorData {
  date: string
  wt: number // Whole Tumor (ml)
  tc: number // Tumor Core (ml)
  et: number // Enhancing Tumor (ml)
  jobId?: string
}

interface TumorTrendChartProps {
  data: TumorData[]
  loading?: boolean
  showTitle?: boolean
  height?: number
}

// 단일 부피 표시 (결과 1개)
const SingleVolumeDisplay: React.FC<{ data: TumorData }> = ({ data }) => {
  return (
    <div className="tumor-trend-chart__single">
      <h4 className="tumor-trend-chart__single-title">현재 종양 부피</h4>
      <div className="tumor-trend-chart__single-grid">
        <div className="tumor-trend-chart__volume-card tumor-trend-chart__volume-card--wt">
          <span className="tumor-trend-chart__volume-label">전체 종양 (WT)</span>
          <span className="tumor-trend-chart__volume-value">{data.wt.toFixed(2)} ml</span>
        </div>
        <div className="tumor-trend-chart__volume-card tumor-trend-chart__volume-card--tc">
          <span className="tumor-trend-chart__volume-label">종양 핵심 (TC)</span>
          <span className="tumor-trend-chart__volume-value">{data.tc.toFixed(2)} ml</span>
        </div>
        <div className="tumor-trend-chart__volume-card tumor-trend-chart__volume-card--et">
          <span className="tumor-trend-chart__volume-label">조영 증강 (ET)</span>
          <span className="tumor-trend-chart__volume-value">{data.et.toFixed(2)} ml</span>
        </div>
      </div>
      <p className="tumor-trend-chart__single-date">측정일: {data.date}</p>
    </div>
  )
}

// 비교 카드 (결과 2개)
const CompareVolumeCard: React.FC<{ before: TumorData; after: TumorData }> = ({
  before,
  after,
}) => {
  const calcChange = (prev: number, curr: number) => {
    if (prev === 0) return { diff: curr, percent: 100 }
    const diff = curr - prev
    const percent = (diff / prev) * 100
    return { diff, percent }
  }

  const wtChange = calcChange(before.wt, after.wt)
  const tcChange = calcChange(before.tc, after.tc)
  const etChange = calcChange(before.et, after.et)

  const renderChange = (change: { diff: number; percent: number }) => {
    const isIncrease = change.diff > 0
    const isDecrease = change.diff < 0
    return (
      <span
        className={`tumor-trend-chart__change ${isIncrease ? 'increase' : ''} ${isDecrease ? 'decrease' : ''}`}
      >
        {isIncrease ? '▲' : isDecrease ? '▼' : '−'}
        {Math.abs(change.diff).toFixed(2)} ml ({change.percent >= 0 ? '+' : ''}
        {change.percent.toFixed(1)}%)
      </span>
    )
  }

  return (
    <div className="tumor-trend-chart__compare">
      <h4 className="tumor-trend-chart__compare-title">종양 부피 변화</h4>
      <div className="tumor-trend-chart__compare-header">
        <span></span>
        <span className="tumor-trend-chart__compare-date">{before.date}</span>
        <span></span>
        <span className="tumor-trend-chart__compare-date">{after.date}</span>
        <span>변화량</span>
      </div>
      <div className="tumor-trend-chart__compare-grid">
        {/* WT */}
        <div className="tumor-trend-chart__compare-row">
          <span className="tumor-trend-chart__compare-label tumor-trend-chart__compare-label--wt">
            WT
          </span>
          <span className="tumor-trend-chart__compare-value">{before.wt.toFixed(2)} ml</span>
          <span className="tumor-trend-chart__compare-arrow">→</span>
          <span className="tumor-trend-chart__compare-value">{after.wt.toFixed(2)} ml</span>
          {renderChange(wtChange)}
        </div>
        {/* TC */}
        <div className="tumor-trend-chart__compare-row">
          <span className="tumor-trend-chart__compare-label tumor-trend-chart__compare-label--tc">
            TC
          </span>
          <span className="tumor-trend-chart__compare-value">{before.tc.toFixed(2)} ml</span>
          <span className="tumor-trend-chart__compare-arrow">→</span>
          <span className="tumor-trend-chart__compare-value">{after.tc.toFixed(2)} ml</span>
          {renderChange(tcChange)}
        </div>
        {/* ET */}
        <div className="tumor-trend-chart__compare-row">
          <span className="tumor-trend-chart__compare-label tumor-trend-chart__compare-label--et">
            ET
          </span>
          <span className="tumor-trend-chart__compare-value">{before.et.toFixed(2)} ml</span>
          <span className="tumor-trend-chart__compare-arrow">→</span>
          <span className="tumor-trend-chart__compare-value">{after.et.toFixed(2)} ml</span>
          {renderChange(etChange)}
        </div>
      </div>
    </div>
  )
}

// 커스텀 툴팁
const CustomTooltip = ({ active, payload, label }: any) => {
  if (!active || !payload || !payload.length) return null

  return (
    <div className="tumor-trend-chart__tooltip">
      <p className="tumor-trend-chart__tooltip-date">{label}</p>
      {payload.map((entry: any, index: number) => (
        <p key={index} className="tumor-trend-chart__tooltip-item" style={{ color: entry.color }}>
          {entry.name}: {entry.value.toFixed(2)} ml
        </p>
      ))}
    </div>
  )
}

const TumorTrendChart: React.FC<TumorTrendChartProps> = ({
  data,
  loading = false,
  showTitle = true,
  height = 300,
}) => {
  // 로딩 상태
  if (loading) {
    return (
      <div className="tumor-trend-chart tumor-trend-chart--loading">
        <div className="tumor-trend-chart__spinner" />
        <span>종양 데이터 로딩 중...</span>
      </div>
    )
  }

  // 데이터 없음
  if (!data || data.length === 0) {
    return (
      <div className="tumor-trend-chart tumor-trend-chart--empty">
        <span className="material-icons">show_chart</span>
        <span>종양 부피 데이터가 없습니다.</span>
      </div>
    )
  }

  // 조건부 렌더링
  // 결과 1개: 현재 부피만 표시
  if (data.length === 1) {
    return (
      <div className="tumor-trend-chart">
        {showTitle && <h4 className="tumor-trend-chart__title">종양 부피</h4>}
        <SingleVolumeDisplay data={data[0]} />
      </div>
    )
  }

  // 결과 2개: 비교 카드
  if (data.length === 2) {
    return (
      <div className="tumor-trend-chart">
        {showTitle && <h4 className="tumor-trend-chart__title">종양 부피 비교</h4>}
        <CompareVolumeCard before={data[0]} after={data[1]} />
      </div>
    )
  }

  // 결과 3개 이상: Line Chart
  return (
    <div className="tumor-trend-chart">
      {showTitle && <h4 className="tumor-trend-chart__title">종양 부피 추이</h4>}
      <div className="tumor-trend-chart__chart">
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 10, right: 30, left: 10, bottom: 10 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
            <XAxis
              dataKey="date"
              tick={{ fontSize: 11 }}
              tickLine={{ stroke: '#ccc' }}
              axisLine={{ stroke: '#ccc' }}
            />
            <YAxis
              unit=" ml"
              tick={{ fontSize: 11 }}
              tickLine={{ stroke: '#ccc' }}
              axisLine={{ stroke: '#ccc' }}
              width={60}
            />
            <Tooltip content={<CustomTooltip />} />
            <Legend
              wrapperStyle={{ paddingTop: '10px' }}
              formatter={(value) => {
                const labels: Record<string, string> = {
                  wt: '전체 종양 (WT)',
                  tc: '종양 핵심 (TC)',
                  et: '조영 증강 (ET)',
                }
                return labels[value] || value
              }}
            />
            <Line
              type="monotone"
              dataKey="wt"
              stroke="#ff6b6b"
              strokeWidth={2}
              dot={{ fill: '#ff6b6b', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="wt"
            />
            <Line
              type="monotone"
              dataKey="tc"
              stroke="#4ecdc4"
              strokeWidth={2}
              dot={{ fill: '#4ecdc4', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="tc"
            />
            <Line
              type="monotone"
              dataKey="et"
              stroke="#45b7d1"
              strokeWidth={2}
              dot={{ fill: '#45b7d1', strokeWidth: 2, r: 4 }}
              activeDot={{ r: 6 }}
              name="et"
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
      {/* 요약 정보 */}
      <div className="tumor-trend-chart__summary">
        <span className="tumor-trend-chart__summary-item">
          측정 횟수: <strong>{data.length}회</strong>
        </span>
        <span className="tumor-trend-chart__summary-item">
          기간: {data[0].date} ~ {data[data.length - 1].date}
        </span>
      </div>
    </div>
  )
}

export default TumorTrendChart
