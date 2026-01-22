/**
 * LIS 전체 검사 현황 대시보드
 * - 현황 요약: 전체 검사 건수, Pending/진행중/완료 건수
 * - 진행 상황 분포 그래프
 * - 지연 검사 알림: 일정 시간 초과한 검사 목록
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOCSList } from '@/services/ocs.api';
import type { OCSListItem } from '@/types/ocs';
import { useOCSEventCallback } from '@/context/OCSNotificationContext';
import './LISProcessStatusPage.css';

// 상태별 설정
const STATUS_CONFIG: Record<string, { label: string; color: string }> = {
  ORDERED: { label: 'Pending', color: '#f39c12' },
  ACCEPTED: { label: 'Pending', color: '#f39c12' },
  IN_PROGRESS: { label: '진행중', color: '#3498db' },
  RESULT_READY: { label: '진행중', color: '#3498db' },
  CONFIRMED: { label: '완료', color: '#27ae60' },
  CANCELLED: { label: '취소', color: '#95a5a6' },
};

// 지연 기준 (분)
const DELAY_THRESHOLD_MINUTES = 60;

// 날짜 포맷
const formatDateTime = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 경과 시간 계산
const getElapsedMinutes = (dateStr: string): number => {
  const date = new Date(dateStr);
  const now = new Date();
  return Math.floor((now.getTime() - date.getTime()) / (1000 * 60));
};

// 경과 시간 표시
const formatElapsedTime = (minutes: number): string => {
  if (minutes < 60) return `${minutes}분`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}시간 ${mins}분` : `${hours}시간`;
};

export default function LISProcessStatusPage() {
  const navigate = useNavigate();

  // 상태
  const [ocsItems, setOcsItems] = useState<OCSListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [dateRange, setDateRange] = useState<string>('all');

  // 데이터 로드 (useOCSEventCallback보다 먼저 정의해야 함)
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const response = await getOCSList({
        job_role: 'LIS',
        page_size: 200, // 전체 조회
      });
      setOcsItems(response.results || []);
    } catch (error) {
      console.error('Failed to load LIS data:', error);
    } finally {
      setLoading(false);
    }
  }, []);

  // WebSocket 이벤트 콜백 (전역 Context 사용)
  // DB 트랜잭션 완료를 위해 300ms 딜레이 추가
  useOCSEventCallback({
    autoRefresh: () => setTimeout(() => loadData(), 300),
  });

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 기간 필터링
  const filteredItems = useMemo(() => {
    if (dateRange === 'all') return ocsItems;

    const now = new Date();
    const cutoff = new Date();

    switch (dateRange) {
      case '1week':
        cutoff.setDate(now.getDate() - 7);
        break;
      case '1month':
        cutoff.setMonth(now.getMonth() - 1);
        break;
      case '6months':
        cutoff.setMonth(now.getMonth() - 6);
        break;
    }

    return ocsItems.filter(item => new Date(item.created_at) >= cutoff);
  }, [ocsItems, dateRange]);

  // 통계 계산 (6개 상태)
  const stats = useMemo(() => {
    const result = {
      total: filteredItems.length,
      ordered: 0,
      accepted: 0,
      inProgress: 0,
      resultReady: 0,
      confirmed: 0,
      cancelled: 0,
    };

    filteredItems.forEach((item) => {
      switch (item.ocs_status) {
        case 'ORDERED':
          result.ordered++;
          break;
        case 'ACCEPTED':
          result.accepted++;
          break;
        case 'IN_PROGRESS':
          result.inProgress++;
          break;
        case 'RESULT_READY':
          result.resultReady++;
          break;
        case 'CONFIRMED':
          result.confirmed++;
          break;
        case 'CANCELLED':
          result.cancelled++;
          break;
      }
    });

    return result;
  }, [filteredItems]);

  // 지연된 항목
  const delayedItems = useMemo(() => {
    return filteredItems
      .filter((item) => {
        if (item.ocs_status === 'CONFIRMED' || item.ocs_status === 'CANCELLED') {
          return false;
        }
        const elapsed = getElapsedMinutes(item.created_at);
        return elapsed > DELAY_THRESHOLD_MINUTES;
      })
      .sort((a, b) => {
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      })
      .slice(0, 10);
  }, [filteredItems]);

  // 진행률 퍼센트
  const getPercentage = (value: number): number => {
    if (stats.total === 0) return 0;
    return Math.round((value / stats.total) * 100);
  };

  // 행 클릭
  const handleRowClick = (item: OCSListItem) => {
    navigate(`/ocs/lis/${item.id}`);
  };

  return (
    <div className="page lis-process-status-page">
      {/* Toast 알림은 AppLayout에서 전역 렌더링 */}

      {/* 헤더 */}
      <header className="page-header">
        {/* <h2>전체 검사 현황</h2> */}
        <span className="subtitle">검사실 검사 진행 상황을 모니터링합니다</span>
        <div className="header-controls">
          <select
            className="date-range-filter"
            value={dateRange}
            onChange={(e) => setDateRange(e.target.value)}
          >
            <option value="all">전체</option>
            <option value="1week">최근 1주일</option>
            <option value="1month">최근 1개월</option>
            <option value="6months">최근 6개월</option>
          </select>
          <button className="refresh-btn" onClick={loadData} disabled={loading}>
            {loading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </header>

      {/* 요약 카드 (6개 상태) */}
      <section className="summary-cards">
        <div className="summary-card ordered">
          <span className="card-icon">📋</span>
          <div className="card-content">
            <span className="card-label">요청됨</span>
            <span className="card-value">{stats.ordered}</span>
          </div>
        </div>
        <div className="summary-card accepted">
          <span className="card-icon">✋</span>
          <div className="card-content">
            <span className="card-label">접수됨</span>
            <span className="card-value">{stats.accepted}</span>
          </div>
        </div>
        <div className="summary-card in-progress">
          <span className="card-icon">🔬</span>
          <div className="card-content">
            <span className="card-label">진행중</span>
            <span className="card-value">{stats.inProgress}</span>
          </div>
        </div>
        <div className="summary-card result-ready">
          <span className="card-icon">📝</span>
          <div className="card-content">
            <span className="card-label">결과대기</span>
            <span className="card-value">{stats.resultReady}</span>
          </div>
        </div>
        <div className="summary-card confirmed">
          <span className="card-icon">✅</span>
          <div className="card-content">
            <span className="card-label">확정</span>
            <span className="card-value">{stats.confirmed}</span>
          </div>
        </div>
        <div className="summary-card cancelled">
          <span className="card-icon">❌</span>
          <div className="card-content">
            <span className="card-label">취소</span>
            <span className="card-value">{stats.cancelled}</span>
          </div>
        </div>
      </section>

      {/* 진행 상황 분포 */}
      <section className="progress-section">
        <h3>검사 상태 분포</h3>
        <div className="progress-chart">
          <div className="progress-bar">
            {stats.ordered > 0 && (
              <div
                className="progress-segment ordered"
                style={{ width: `${getPercentage(stats.ordered)}%` }}
                title={`요청됨: ${stats.ordered}건 (${getPercentage(stats.ordered)}%)`}
              />
            )}
            {stats.accepted > 0 && (
              <div
                className="progress-segment accepted"
                style={{ width: `${getPercentage(stats.accepted)}%` }}
                title={`접수됨: ${stats.accepted}건 (${getPercentage(stats.accepted)}%)`}
              />
            )}
            {stats.inProgress > 0 && (
              <div
                className="progress-segment in-progress"
                style={{ width: `${getPercentage(stats.inProgress)}%` }}
                title={`진행중: ${stats.inProgress}건 (${getPercentage(stats.inProgress)}%)`}
              />
            )}
            {stats.resultReady > 0 && (
              <div
                className="progress-segment result-ready"
                style={{ width: `${getPercentage(stats.resultReady)}%` }}
                title={`결과대기: ${stats.resultReady}건 (${getPercentage(stats.resultReady)}%)`}
              />
            )}
            {stats.confirmed > 0 && (
              <div
                className="progress-segment confirmed"
                style={{ width: `${getPercentage(stats.confirmed)}%` }}
                title={`확정: ${stats.confirmed}건 (${getPercentage(stats.confirmed)}%)`}
              />
            )}
            {stats.cancelled > 0 && (
              <div
                className="progress-segment cancelled"
                style={{ width: `${getPercentage(stats.cancelled)}%` }}
                title={`취소: ${stats.cancelled}건 (${getPercentage(stats.cancelled)}%)`}
              />
            )}
          </div>
          <div className="progress-legend">
            <div className="legend-item">
              <span className="legend-color ordered" />
              <span>요청됨 ({stats.ordered}건, {getPercentage(stats.ordered)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color accepted" />
              <span>접수됨 ({stats.accepted}건, {getPercentage(stats.accepted)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color in-progress" />
              <span>진행중 ({stats.inProgress}건, {getPercentage(stats.inProgress)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color result-ready" />
              <span>결과대기 ({stats.resultReady}건, {getPercentage(stats.resultReady)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color confirmed" />
              <span>확정 ({stats.confirmed}건, {getPercentage(stats.confirmed)}%)</span>
            </div>
            <div className="legend-item">
              <span className="legend-color cancelled" />
              <span>취소 ({stats.cancelled}건, {getPercentage(stats.cancelled)}%)</span>
            </div>
          </div>
        </div>
      </section>

      {/* 지연 검사 알림 */}
      <section className="delayed-section">
        <h3>
          지연 검사 알림
          <span className="threshold-info">({DELAY_THRESHOLD_MINUTES}분 초과)</span>
        </h3>
        {delayedItems.length === 0 ? (
          <div className="empty-message">지연된 검사가 없습니다.</div>
        ) : (
          <table className="delayed-table">
            <thead>
              <tr>
                <th>OCS ID</th>
                <th>환자명</th>
                <th>환자번호</th>
                <th>검사 유형</th>
                <th>상태</th>
                <th>접수 시간</th>
                <th>경과 시간</th>
                <th>작업자</th>
                <th>요청의사</th>
              </tr>
            </thead>
            <tbody>
              {delayedItems.map((item) => {
                const elapsed = getElapsedMinutes(item.created_at);
                const isUrgent = elapsed > DELAY_THRESHOLD_MINUTES * 2;

                return (
                  <tr
                    key={item.id}
                    className={`clickable-row ${isUrgent ? 'urgent-row' : ''}`}
                    onClick={() => handleRowClick(item)}
                  >
                    <td className="ocs-id">{item.ocs_id}</td>
                    <td className="patient-name">{item.patient.name}</td>
                    <td>{item.patient.patient_number}</td>
                    <td>{item.job_type}</td>
                    <td>
                      <span className={`status-badge ${item.ocs_status.toLowerCase()}`}>
                        {STATUS_CONFIG[item.ocs_status]?.label || item.ocs_status_display}
                      </span>
                    </td>
                    <td>{formatDateTime(item.created_at)}</td>
                    <td className={`elapsed-time ${isUrgent ? 'urgent' : 'delayed'}`}>
                      {formatElapsedTime(elapsed)}
                    </td>
                    <td>{item.worker?.name || '-'}</td>
                    <td>{item.doctor?.name || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
