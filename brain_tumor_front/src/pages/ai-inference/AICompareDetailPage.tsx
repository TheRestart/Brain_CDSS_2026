/**
 * AICompareDetailPage
 * 두 AI 분석 결과 상세 비교 페이지
 * 담당자 A: AI 결과 비교 기능
 */

import { useState, useEffect, useMemo } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { aiApi } from '@/services/ai.api'
import { TumorTrendChart, type TumorData } from '@/components/ai/TumorTrendChart'
import AICompareViewer from '@/components/ai/AICompareViewer'
import './AICompareDetailPage.css'

interface InferenceDetail {
  id: number
  job_id: string
  model_type: string
  status: string
  patient_name: string
  patient_number: string
  result_data: {
    segmentation?: {
      wt_volume?: number
      tc_volume?: number
      et_volume?: number
    }
    grade?: {
      predicted_class?: string
      probability?: number
    }
  } | null
  created_at: string
  completed_at: string | null
}

export default function AICompareDetailPage() {
  const { jobId1, jobId2 } = useParams<{ jobId1: string; jobId2: string }>()
  const navigate = useNavigate()

  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [job1, setJob1] = useState<InferenceDetail | null>(null)
  const [job2, setJob2] = useState<InferenceDetail | null>(null)
  const [viewMode, setViewMode] = useState<'side' | 'overlay'>('side')

  // 데이터 로드
  useEffect(() => {
    if (jobId1 && jobId2) {
      loadCompareData()
    }
  }, [jobId1, jobId2])

  const loadCompareData = async () => {
    try {
      setLoading(true)
      setError('')

      const [data1, data2] = await Promise.all([
        aiApi.getInferenceDetail(jobId1!),
        aiApi.getInferenceDetail(jobId2!),
      ])

      // 시간순 정렬 (이전 → 현재)
      if (new Date(data1.created_at) > new Date(data2.created_at)) {
        setJob1(data2)
        setJob2(data1)
      } else {
        setJob1(data1)
        setJob2(data2)
      }
    } catch (err: any) {
      console.error('Failed to load compare data:', err)
      setError(err.response?.data?.error || '비교 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 종양 부피 데이터 생성
  const tumorData: TumorData[] = useMemo(() => {
    const data: TumorData[] = []

    if (job1?.result_data?.segmentation) {
      data.push({
        date: new Date(job1.created_at).toLocaleDateString('ko-KR'),
        wt: job1.result_data.segmentation.wt_volume || 0,
        tc: job1.result_data.segmentation.tc_volume || 0,
        et: job1.result_data.segmentation.et_volume || 0,
        jobId: job1.job_id,
      })
    }

    if (job2?.result_data?.segmentation) {
      data.push({
        date: new Date(job2.created_at).toLocaleDateString('ko-KR'),
        wt: job2.result_data.segmentation.wt_volume || 0,
        tc: job2.result_data.segmentation.tc_volume || 0,
        et: job2.result_data.segmentation.et_volume || 0,
        jobId: job2.job_id,
      })
    }

    return data
  }, [job1, job2])

  // 변화량 계산
  const changes = useMemo(() => {
    if (!job1?.result_data?.segmentation || !job2?.result_data?.segmentation) {
      return null
    }

    const seg1 = job1.result_data.segmentation
    const seg2 = job2.result_data.segmentation

    const calcChange = (before: number, after: number) => {
      const diff = after - before
      const percent = before > 0 ? (diff / before) * 100 : 0
      return { diff, percent }
    }

    return {
      wt: calcChange(seg1.wt_volume || 0, seg2.wt_volume || 0),
      tc: calcChange(seg1.tc_volume || 0, seg2.tc_volume || 0),
      et: calcChange(seg1.et_volume || 0, seg2.et_volume || 0),
      days: Math.floor(
        (new Date(job2.created_at).getTime() - new Date(job1.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      ),
    }
  }, [job1, job2])

  const handleBack = () => {
    navigate('/ai/compare')
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  if (loading) {
    return (
      <div className="ai-compare-detail-page">
        <div className="ai-compare-detail__loading">
          <div className="ai-compare-detail__spinner" />
          <span>비교 데이터 로딩 중...</span>
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ai-compare-detail-page">
        <div className="ai-compare-detail__error">
          <span className="material-icons">error_outline</span>
          <p>{error}</p>
          <button onClick={handleBack} className="ai-compare-detail__back-btn">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  if (!job1 || !job2) {
    return (
      <div className="ai-compare-detail-page">
        <div className="ai-compare-detail__error">
          <span className="material-icons">search_off</span>
          <p>비교할 데이터를 찾을 수 없습니다.</p>
          <button onClick={handleBack} className="ai-compare-detail__back-btn">
            목록으로 돌아가기
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="page ai-compare-detail-page">
      {/* 헤더 */}
      <div className="ai-compare-detail__header">
        <div className="ai-compare-detail__header-left">
          <button onClick={handleBack} className="ai-compare-detail__back-icon">
            <span className="material-icons">arrow_back</span>
          </button>
          <div>
            <h1 className="ai-compare-detail__title">AI 분석 결과 비교</h1>
            <p className="ai-compare-detail__subtitle">
              {job1.patient_name} ({job1.patient_number})
            </p>
          </div>
        </div>
        <div className="ai-compare-detail__header-right">
          <div className="ai-compare-detail__view-toggle">
            <button
              className={`ai-compare-detail__toggle-btn ${viewMode === 'side' ? 'active' : ''}`}
              onClick={() => setViewMode('side')}
            >
              <span className="material-icons">view_column</span>
              나란히
            </button>
            <button
              className={`ai-compare-detail__toggle-btn ${viewMode === 'overlay' ? 'active' : ''}`}
              onClick={() => setViewMode('overlay')}
            >
              <span className="material-icons">layers</span>
              오버레이
            </button>
          </div>
        </div>
      </div>

      {/* 기간 정보 */}
      {changes && (
        <div className="ai-compare-detail__period">
          <div className="ai-compare-detail__period-item">
            <span className="ai-compare-detail__period-label">이전 분석</span>
            <span className="ai-compare-detail__period-value">{formatDate(job1.created_at)}</span>
          </div>
          <div className="ai-compare-detail__period-arrow">
            <span className="material-icons">arrow_forward</span>
            <span className="ai-compare-detail__period-days">{changes.days}일</span>
          </div>
          <div className="ai-compare-detail__period-item">
            <span className="ai-compare-detail__period-label">현재 분석</span>
            <span className="ai-compare-detail__period-value">{formatDate(job2.created_at)}</span>
          </div>
        </div>
      )}

      {/* 종양 부피 비교 차트 */}
      <div className="ai-compare-detail__section">
        <h3 className="ai-compare-detail__section-title">종양 부피 변화</h3>
        <div className="ai-compare-detail__chart-card">
          <TumorTrendChart data={tumorData} showTitle={false} />
        </div>
      </div>

      {/* 변화 요약 */}
      {changes && (
        <div className="ai-compare-detail__section">
          <h3 className="ai-compare-detail__section-title">변화 요약</h3>
          <div className="ai-compare-detail__changes-grid">
            <ChangeCard
              label="전체 종양 (WT)"
              color="#ff6b6b"
              diff={changes.wt.diff}
              percent={changes.wt.percent}
            />
            <ChangeCard
              label="종양 핵심 (TC)"
              color="#4ecdc4"
              diff={changes.tc.diff}
              percent={changes.tc.percent}
            />
            <ChangeCard
              label="조영 증강 (ET)"
              color="#45b7d1"
              diff={changes.et.diff}
              percent={changes.et.percent}
            />
          </div>
        </div>
      )}

      {/* Grade 비교 */}
      <div className="ai-compare-detail__section">
        <h3 className="ai-compare-detail__section-title">등급 비교</h3>
        <div className="ai-compare-detail__grade-compare">
          <div className="ai-compare-detail__grade-item">
            <span className="ai-compare-detail__grade-label">이전</span>
            <span
              className={`ai-compare-detail__grade-value grade-${job1.result_data?.grade?.predicted_class || ''}`}
            >
              {job1.result_data?.grade?.predicted_class || '-'}
            </span>
          </div>
          <span className="ai-compare-detail__grade-arrow">→</span>
          <div className="ai-compare-detail__grade-item">
            <span className="ai-compare-detail__grade-label">현재</span>
            <span
              className={`ai-compare-detail__grade-value grade-${job2.result_data?.grade?.predicted_class || ''}`}
            >
              {job2.result_data?.grade?.predicted_class || '-'}
            </span>
          </div>
          {job1.result_data?.grade?.predicted_class !==
            job2.result_data?.grade?.predicted_class && (
            <span className="ai-compare-detail__grade-changed">등급 변화 감지</span>
          )}
        </div>
      </div>

      {/* 뷰어 비교 (Split View) */}
      <div className="ai-compare-detail__section">
        <h3 className="ai-compare-detail__section-title">세그멘테이션 비교</h3>
        <AICompareViewer job1={job1} job2={job2} viewMode={viewMode} />
      </div>
    </div>
  )
}

// 변화 카드 컴포넌트
interface ChangeCardProps {
  label: string
  color: string
  diff: number
  percent: number
}

function ChangeCard({ label, color, diff, percent }: ChangeCardProps) {
  const isIncrease = diff > 0
  const isDecrease = diff < 0

  return (
    <div className="ai-compare-detail__change-card" style={{ borderLeftColor: color }}>
      <span className="ai-compare-detail__change-label">{label}</span>
      <div className="ai-compare-detail__change-values">
        <span
          className={`ai-compare-detail__change-diff ${isIncrease ? 'increase' : ''} ${isDecrease ? 'decrease' : ''}`}
        >
          {isIncrease ? '+' : ''}
          {diff.toFixed(2)} ml
        </span>
        <span
          className={`ai-compare-detail__change-percent ${isIncrease ? 'increase' : ''} ${isDecrease ? 'decrease' : ''}`}
        >
          ({isIncrease ? '+' : ''}
          {percent.toFixed(1)}%)
        </span>
      </div>
      <div className="ai-compare-detail__change-icon">
        {isIncrease && <span className="material-icons increase">trending_up</span>}
        {isDecrease && <span className="material-icons decrease">trending_down</span>}
        {!isIncrease && !isDecrease && <span className="material-icons">trending_flat</span>}
      </div>
    </div>
  )
}
