/**
 * AICompareListPage
 * 환자별 AI 분석 이력 조회 및 비교 대상 선택
 * 담당자 A: AI 결과 비교 기능
 */

import { useState, useEffect } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { getPatientAIHistory, type AIInferenceRequest } from '@/services/ai.api'
import './AICompareListPage.css'

interface PatientInfo {
  id: number
  name: string
  number: string
}

export default function AICompareListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const patientIdParam = searchParams.get('patientId')

  const [patientId, setPatientId] = useState<string>(patientIdParam || '')
  const [selectedJobs, setSelectedJobs] = useState<string[]>([])
  const [patientInfo, setPatientInfo] = useState<PatientInfo | null>(null)

  // 환자 AI 이력 조회
  const {
    data: history,
    isLoading,
    refetch,
  } = useQuery({
    queryKey: ['patient-ai-history', patientId],
    queryFn: () => getPatientAIHistory(Number(patientId), 'M1'),
    enabled: !!patientId && !isNaN(Number(patientId)),
  })

  // 환자 정보 설정
  useEffect(() => {
    if (history && history.length > 0) {
      const first = history[0]
      setPatientInfo({
        id: first.patient,
        name: first.patient_name,
        number: first.patient_number,
      })
    }
  }, [history])

  // 검색 핸들러
  const handleSearch = () => {
    if (patientId) {
      refetch()
      setSelectedJobs([])
    }
  }

  // 결과 선택 토글
  const handleSelectJob = (jobId: string) => {
    setSelectedJobs((prev) => {
      if (prev.includes(jobId)) {
        return prev.filter((id) => id !== jobId)
      }
      // 최대 2개 선택
      if (prev.length >= 2) {
        return [prev[1], jobId]
      }
      return [...prev, jobId]
    })
  }

  // 비교 시작
  const handleCompare = () => {
    if (selectedJobs.length === 2) {
      navigate(`/ai/compare/${selectedJobs[0]}/${selectedJobs[1]}`)
    }
  }

  // 상세 보기
  const handleViewDetail = (jobId: string) => {
    navigate(`/ai/m1/${jobId}`)
  }

  // 날짜 포맷
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    })
  }

  // 상태 배지
  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { className: string; label: string }> = {
      COMPLETED: { className: 'status-badge--completed', label: '완료' },
      PROCESSING: { className: 'status-badge--processing', label: '처리중' },
      PENDING: { className: 'status-badge--pending', label: '대기' },
      FAILED: { className: 'status-badge--failed', label: '실패' },
    }
    const { className, label } = statusMap[status] || {
      className: 'status-badge--pending',
      label: status,
    }
    return <span className={`ai-compare-list__status-badge ${className}`}>{label}</span>
  }

  // 종양 부피 추출
  const getVolumes = (request: AIInferenceRequest) => {
    const result = request.result?.result_data as Record<string, any> | undefined
    const seg = result?.segmentation
    if (!seg) return null
    return {
      wt: seg.wt_volume || 0,
      tc: seg.tc_volume || 0,
      et: seg.et_volume || 0,
    }
  }

  return (
    <div className="page ai-compare-list-page">
      <div className="ai-compare-list__header">
        <h1 className="ai-compare-list__title">AI 분석 결과 비교</h1>
        <p className="ai-compare-list__subtitle">
          동일 환자의 MRI 분석 결과를 비교하여 종양 변화를 추적합니다.
        </p>
      </div>

      {/* 환자 검색 */}
      <div className="ai-compare-list__search-section">
        <div className="ai-compare-list__search-box">
          <label className="ai-compare-list__search-label">환자 ID</label>
          <div className="ai-compare-list__search-input-group">
            <input
              type="text"
              className="ai-compare-list__search-input"
              placeholder="환자 ID 입력"
              value={patientId}
              onChange={(e) => setPatientId(e.target.value)}
              onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            />
            <button className="ai-compare-list__search-btn" onClick={handleSearch}>
              <span className="material-icons">search</span>
              검색
            </button>
          </div>
        </div>

        {/* 환자 정보 */}
        {patientInfo && (
          <div className="ai-compare-list__patient-info">
            <span className="ai-compare-list__patient-name">{patientInfo.name}</span>
            <span className="ai-compare-list__patient-number">{patientInfo.number}</span>
          </div>
        )}
      </div>

      {/* 선택된 항목 및 비교 버튼 */}
      {selectedJobs.length > 0 && (
        <div className="ai-compare-list__selection-bar">
          <span className="ai-compare-list__selection-count">
            {selectedJobs.length}개 선택됨 {selectedJobs.length === 2 && '(비교 가능)'}
          </span>
          <button
            className="ai-compare-list__compare-btn"
            onClick={handleCompare}
            disabled={selectedJobs.length !== 2}
          >
            <span className="material-icons">compare</span>
            비교하기
          </button>
        </div>
      )}

      {/* 결과 목록 */}
      <div className="ai-compare-list__content">
        {isLoading ? (
          <div className="ai-compare-list__loading">
            <div className="ai-compare-list__spinner" />
            <span>분석 이력 조회 중...</span>
          </div>
        ) : !history || history.length === 0 ? (
          <div className="ai-compare-list__empty">
            <span className="material-icons">search_off</span>
            <span>
              {patientId
                ? '해당 환자의 M1 분석 결과가 없습니다.'
                : '환자 ID를 입력하여 검색해주세요.'}
            </span>
          </div>
        ) : (
          <div className="ai-compare-list__table-wrapper">
            <table className="ai-compare-list__table">
              <thead>
                <tr>
                  <th className="ai-compare-list__th-select">선택</th>
                  <th>분석 일시</th>
                  <th>상태</th>
                  <th>WT (ml)</th>
                  <th>TC (ml)</th>
                  <th>ET (ml)</th>
                  <th>Grade</th>
                  <th>액션</th>
                </tr>
              </thead>
              <tbody>
                {history
                  .filter((r) => r.status === 'COMPLETED')
                  .sort(
                    (a, b) =>
                      new Date(a.requested_at).getTime() - new Date(b.requested_at).getTime()
                  )
                  .map((request, index) => {
                    const volumes = getVolumes(request)
                    const grade = (request.result?.result_data as any)?.grade?.predicted_class
                    const isSelected = selectedJobs.includes(request.request_id)

                    return (
                      <tr
                        key={request.request_id}
                        className={`ai-compare-list__row ${isSelected ? 'ai-compare-list__row--selected' : ''}`}
                      >
                        <td className="ai-compare-list__td-select">
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => handleSelectJob(request.request_id)}
                            className="ai-compare-list__checkbox"
                          />
                          <span className="ai-compare-list__order">{index + 1}</span>
                        </td>
                        <td>{formatDate(request.requested_at)}</td>
                        <td>{getStatusBadge(request.status)}</td>
                        <td>{volumes?.wt.toFixed(2) || '-'}</td>
                        <td>{volumes?.tc.toFixed(2) || '-'}</td>
                        <td>{volumes?.et.toFixed(2) || '-'}</td>
                        <td>
                          {grade && (
                            <span className={`ai-compare-list__grade grade-${grade}`}>{grade}</span>
                          )}
                        </td>
                        <td>
                          <button
                            className="ai-compare-list__view-btn"
                            onClick={() => handleViewDetail(request.request_id)}
                          >
                            상세
                          </button>
                        </td>
                      </tr>
                    )
                  })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* 안내 */}
      <div className="ai-compare-list__guide">
        <h4>사용 방법</h4>
        <ol>
          <li>환자 ID를 입력하여 해당 환자의 M1 분석 이력을 조회합니다.</li>
          <li>비교할 2개의 분석 결과를 선택합니다.</li>
          <li>"비교하기" 버튼을 클릭하여 상세 비교 페이지로 이동합니다.</li>
        </ol>
      </div>
    </div>
  )
}
