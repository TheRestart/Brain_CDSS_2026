/**
 * AI 처리 현황 페이지
 * - AI 추론 요청 상태별 통계 대시보드
 * - 실시간 처리 현황 모니터링
 */
import { useState, useCallback, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAIRequestList, useAIModels } from '@/hooks';
import { LoadingSpinner } from '@/components/common';
import './AIProcessStatusPage.css';

// 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기 중',
  VALIDATING: '검증 중',
  PROCESSING: '처리 중',
  COMPLETED: '완료',
  FAILED: '실패',
  CANCELLED: '취소됨',
};

// 상태 색상
const STATUS_COLORS: Record<string, string> = {
  PENDING: '#f59e0b',
  VALIDATING: '#3b82f6',
  PROCESSING: '#10b981',
  COMPLETED: '#059669',
  FAILED: '#ef4444',
  CANCELLED: '#6b7280',
};

// 시간 필터 라벨
const TIME_RANGE_LABELS: Record<string, string> = {
  today: '오늘',
  week: '이번 주',
  month: '이번 달',
};

export default function AIProcessStatusPage() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<'today' | 'week' | 'month'>('today');
  const [autoRefresh, setAutoRefresh] = useState(true);
  const prevFailedCount = useRef(0);

  // 데이터 조회 (자동 새로고침 여부에 따라 폴링)
  const { requests, loading, error, refresh } = useAIRequestList({
    pollingInterval: autoRefresh ? 5000 : undefined,
  });

  const { models } = useAIModels();

  // 시간 범위로 필터링된 요청 목록
  const getFilteredByTimeRange = useCallback(() => {
    const now = new Date();
    const startDate = new Date();

    switch (timeRange) {
      case 'today':
        startDate.setHours(0, 0, 0, 0);
        break;
      case 'week':
        startDate.setDate(now.getDate() - 7);
        break;
      case 'month':
        startDate.setMonth(now.getMonth() - 1);
        break;
    }

    return requests.filter(req =>
      new Date(req.requested_at) >= startDate
    );
  }, [requests, timeRange]);

  const filteredRequests = getFilteredByTimeRange();

  // 실패 건수 변화 추적 (알림용)
  useEffect(() => {
    const currentFailed = filteredRequests.filter(r => r.status === 'FAILED').length;
    prevFailedCount.current = currentFailed;
  }, [filteredRequests]);

  // 상태별 통계 계산 (필터링된 요청 기준)
  const getStatusStats = useCallback(() => {
    const stats: Record<string, number> = {
      PENDING: 0,
      VALIDATING: 0,
      PROCESSING: 0,
      COMPLETED: 0,
      FAILED: 0,
      CANCELLED: 0,
    };

    filteredRequests.forEach((req) => {
      if (stats[req.status] !== undefined) {
        stats[req.status]++;
      }
    });

    return stats;
  }, [filteredRequests]);

  // 모델별 통계 계산 (필터링된 요청 기준)
  const getModelStats = useCallback(() => {
    const stats: Record<string, { total: number; completed: number; failed: number }> = {};

    filteredRequests.forEach((req) => {
      const modelCode = req.model_code;
      if (!stats[modelCode]) {
        stats[modelCode] = { total: 0, completed: 0, failed: 0 };
      }
      stats[modelCode].total++;
      if (req.status === 'COMPLETED') stats[modelCode].completed++;
      if (req.status === 'FAILED') stats[modelCode].failed++;
    });

    return stats;
  }, [filteredRequests]);

  // 진행 중인 요청 목록 (필터링된 요청 기준)
  const getActiveRequests = useCallback(() => {
    return filteredRequests.filter(
      (req) => req.status === 'PENDING' || req.status === 'VALIDATING' || req.status === 'PROCESSING'
    );
  }, [filteredRequests]);

  // 최근 완료/실패 요청 (필터링된 요청 기준)
  const getRecentResults = useCallback(() => {
    return filteredRequests
      .filter((req) => req.status === 'COMPLETED' || req.status === 'FAILED')
      .slice(0, 10);
  }, [filteredRequests]);

  const statusStats = getStatusStats();
  const modelStats = getModelStats();
  const activeRequests = getActiveRequests();
  const recentResults = getRecentResults();

  const totalRequests = filteredRequests.length;
  const successRate =
    totalRequests > 0
      ? Math.round((statusStats.COMPLETED / totalRequests) * 100)
      : 0;

  // 새 실패 건수 확인 (알림 배지용)
  const hasNewFailures = statusStats.FAILED > 0;

  if (loading && requests.length === 0) {
    return (
      <div className="ai-process-status loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-process-status error-state">
        <p>데이터를 불러오는 중 오류가 발생했습니다.</p>
        <button className="btn btn-primary" onClick={refresh}>
          다시 시도
        </button>
      </div>
    );
  }

  return (
    <div className="ai-process-status">
      {/* 헤더 */}
      <header className="page-header">
        <div>
          <h2>AI 처리 현황</h2>
          <p className="subtitle">AI 추론 요청의 실시간 처리 상태를 모니터링합니다</p>
        </div>
        <div className="header-actions">
          <label className="auto-refresh-toggle">
            <input
              type="checkbox"
              checked={autoRefresh}
              onChange={(e) => setAutoRefresh(e.target.checked)}
            />
            <span className="toggle-switch"></span>
            <span className="toggle-label">자동 새로고침</span>
          </label>
          <button className="btn btn-secondary" onClick={refresh}>
            새로고침
          </button>
          <button className="btn btn-primary" onClick={() => navigate('/ai/requests')}>
            요청 목록
          </button>
        </div>
      </header>

      {/* 시간 필터 */}
      <section className="time-filter-section">
        <span className="filter-label">기간:</span>
        <div className="time-filter-buttons">
          {Object.entries(TIME_RANGE_LABELS).map(([key, label]) => (
            <button
              key={key}
              className={`filter-btn ${timeRange === key ? 'active' : ''}`}
              onClick={() => setTimeRange(key as 'today' | 'week' | 'month')}
            >
              {label}
            </button>
          ))}
        </div>
      </section>

      {/* 상태별 통계 카드 */}
      <section className="stats-section">
        <h3>상태별 현황</h3>
        <div className="stats-grid">
          {Object.entries(STATUS_LABELS).map(([status, label]) => (
            <div
              key={status}
              className={`stat-card ${status.toLowerCase()} ${status === 'FAILED' && hasNewFailures ? 'has-alert' : ''}`}
              onClick={() => navigate(`/ai/requests?status=${status}`)}
            >
              <div className="stat-value">{statusStats[status]}</div>
              <div className="stat-label">{label}</div>
              {status === 'FAILED' && hasNewFailures && (
                <span className="alert-badge">!</span>
              )}
              <div
                className="stat-indicator"
                style={{ backgroundColor: STATUS_COLORS[status] }}
              />
            </div>
          ))}
        </div>
      </section>

      {/* 요약 통계 */}
      <section className="summary-section">
        <div className="summary-card">
          <div className="summary-icon">📊</div>
          <div className="summary-content">
            <div className="summary-value">{totalRequests}</div>
            <div className="summary-label">전체 요청</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">✅</div>
          <div className="summary-content">
            <div className="summary-value">{successRate}%</div>
            <div className="summary-label">성공률</div>
          </div>
        </div>
        <div className="summary-card">
          <div className="summary-icon">⏳</div>
          <div className="summary-content">
            <div className="summary-value">{activeRequests.length}</div>
            <div className="summary-label">진행 중</div>
          </div>
        </div>
      </section>

      <div className="content-grid">
        {/* 진행 중인 요청 */}
        <section className="active-requests-section">
          <h3>진행 중인 요청 ({activeRequests.length})</h3>
          {activeRequests.length === 0 ? (
            <div className="empty-state">현재 진행 중인 요청이 없습니다.</div>
          ) : (
            <div className="request-list">
              {activeRequests.map((req) => (
                <div
                  key={req.request_id}
                  className="request-item"
                  onClick={() => navigate(`/ai/requests/${req.request_id}`)}
                >
                  <div className="request-info">
                    <span className="request-model">{req.model_name}</span>
                    <span className="request-patient">
                      {req.patient_name} ({req.patient_number})
                    </span>
                  </div>
                  <div className="request-meta">
                    <span className={`status-badge status-${req.status.toLowerCase()}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                    <span className="request-time">
                      {new Date(req.requested_at).toLocaleTimeString('ko-KR')}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>

        {/* 최근 결과 */}
        <section className="recent-results-section">
          <h3>최근 결과</h3>
          {recentResults.length === 0 ? (
            <div className="empty-state">최근 결과가 없습니다.</div>
          ) : (
            <div className="request-list">
              {recentResults.map((req) => (
                <div
                  key={req.request_id}
                  className="request-item"
                  onClick={() => navigate(`/ai/requests/${req.request_id}`)}
                >
                  <div className="request-info">
                    <span className="request-model">{req.model_name}</span>
                    <span className="request-patient">
                      {req.patient_name}
                    </span>
                  </div>
                  <div className="request-meta">
                    <span className={`status-badge status-${req.status.toLowerCase()}`}>
                      {STATUS_LABELS[req.status]}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>

      {/* 모델별 통계 */}
      <section className="model-stats-section">
        <h3>모델별 현황</h3>
        <div className="model-stats-grid">
          {Object.entries(modelStats).map(([modelCode, stats]) => {
            const model = models.find((m) => m.code === modelCode);
            const successRate =
              stats.total > 0 ? Math.round((stats.completed / stats.total) * 100) : 0;

            return (
              <div key={modelCode} className="model-stat-card">
                <div className="model-header">
                  <span className="model-name">{model?.name || modelCode}</span>
                  <span className="model-code">{modelCode}</span>
                </div>
                <div className="model-stats">
                  <div className="model-stat">
                    <span className="stat-value">{stats.total}</span>
                    <span className="stat-label">전체</span>
                  </div>
                  <div className="model-stat completed">
                    <span className="stat-value">{stats.completed}</span>
                    <span className="stat-label">완료</span>
                  </div>
                  <div className="model-stat failed">
                    <span className="stat-value">{stats.failed}</span>
                    <span className="stat-label">실패</span>
                  </div>
                </div>
                <div className="model-progress">
                  <div className="progress-bar">
                    <div
                      className="progress-fill"
                      style={{ width: `${successRate}%` }}
                    />
                  </div>
                  <span className="progress-label">{successRate}% 성공</span>
                </div>
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
