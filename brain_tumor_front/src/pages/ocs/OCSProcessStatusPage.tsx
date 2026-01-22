/**
 * OCS 통합 처리 현황 대시보드
 * - RIS + LIS 통합 현황 요약
 * - 각 부서별 진행 상황 분포 (6개 상태)
 * - 전체 상태별 현황
 * - 권한별 사용자 로그인 현황
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOCSProcessStatus, getUserLoginStatus } from '@/services/ocs.api';
import type { OCSProcessStatus, OCSJobStats, UserLoginStatus, UserLoginInfo } from '@/services/ocs.api';
import { useOCSEventCallback } from '@/context/OCSNotificationContext';
import './OCSProcessStatusPage.css';

// 상태 정보 정의
const STATUS_INFO = {
  ordered: { label: '오더생성', className: 'ordered' },
  accepted: { label: '접수완료', className: 'accepted' },
  in_progress: { label: '진행중', className: 'in-progress' },
  result_ready: { label: '결과대기', className: 'result-ready' },
  confirmed: { label: '확정완료', className: 'confirmed' },
  cancelled: { label: '취소', className: 'cancelled' },
} as const;

type StatusKey = keyof typeof STATUS_INFO;

export default function OCSProcessStatusPage() {
  const navigate = useNavigate();

  const [status, setStatus] = useState<OCSProcessStatus | null>(null);
  const [userLoginStatus, setUserLoginStatus] = useState<UserLoginStatus | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedUser, setSelectedUser] = useState<UserLoginInfo | null>(null);

  // 데이터 로드
  const loadData = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [processResponse, loginResponse] = await Promise.all([
        getOCSProcessStatus(),
        getUserLoginStatus()
      ]);
      setStatus(processResponse);
      setUserLoginStatus(loginResponse);
    } catch (err) {
      console.error('Failed to load OCS process status:', err);
      setError('데이터를 불러오는데 실패했습니다.');
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

  // 퍼센트 계산
  const getPercentage = (value: number, total: number): number => {
    if (total === 0) return 0;
    return Math.round((value / total) * 100);
  };

  // 부서별 총합 계산 (cancelled 제외)
  const getJobTotal = (stats: OCSJobStats): number => {
    return stats.ordered + stats.accepted + stats.in_progress + stats.result_ready + stats.confirmed;
  };

  // 부서별 상세 페이지로 이동
  const handleNavigateToDetail = (type: 'ris' | 'lis') => {
    navigate(`/ocs/${type}/process-status`);
  };

  return (
    <div className="page ocs-process-status-page">
      {/* 헤더 */}
      <header className="page-header">
        <div className="header-left">
          <span className="subtitle">RIS/LIS 통합 처리 현황을 모니터링합니다.</span>
        </div>
        <div className="header-right">
          <button className="refresh-btn" onClick={loadData} disabled={loading}>
            {loading ? '로딩 중...' : '새로고침'}
          </button>
        </div>
      </header>

      {error && <div className="error-message">{error}</div>}

      {status && (
        <>
          {/* 통합 요약 카드 - 6개 상태 */}
          <section className="combined-summary">
            <div className="summary-card ordered">
              <div className="card-content">
                <span className="card-label">오더생성</span>
                <span className="card-value">{status.combined.total_ordered}</span>
              </div>
            </div>
            <div className="summary-card accepted">
              <div className="card-content">
                <span className="card-label">접수완료</span>
                <span className="card-value">{status.combined.total_accepted}</span>
              </div>
            </div>
            <div className="summary-card in-progress">
              <div className="card-content">
                <span className="card-label">진행중</span>
                <span className="card-value">{status.combined.total_in_progress}</span>
              </div>
            </div>
            <div className="summary-card result-ready">
              <div className="card-content">
                <span className="card-label">결과대기</span>
                <span className="card-value">{status.combined.total_result_ready}</span>
              </div>
            </div>
            <div className="summary-card confirmed">
              <div className="card-content">
                <span className="card-label">확정완료</span>
                <span className="card-value">{status.combined.total_confirmed}</span>
              </div>
            </div>
            <div className="summary-card cancelled">
              <div className="card-content">
                <span className="card-label">취소</span>
                <span className="card-value">{status.combined.total_cancelled}</span>
              </div>
            </div>
          </section>

          
          {/* 범례 */}
          <section className="legend-section">
            {(Object.keys(STATUS_INFO) as StatusKey[]).map((key) => (
              <div key={key} className="legend-item">
                <span className={`legend-color ${STATUS_INFO[key].className}`} />
                <span>{STATUS_INFO[key].label}</span>
              </div>
            ))}
          </section>
         

          {/* 부서별 현황 */}
          <section className="department-section">
            {/* RIS 현황 */}
            <div className="department-card" onClick={() => handleNavigateToDetail('ris')}>
              <div className="department-header">
                <h3>
                  <span className="dept-icon">🔬</span>
                  RIS (영상의학)
                </h3>
                <span className="today-count">오늘 {status.ris.total_today}건</span>
              </div>

              <div className="stats-grid">
                {(Object.keys(STATUS_INFO) as StatusKey[]).map((key) => (
                  <div key={key} className={`stat-item ${STATUS_INFO[key].className}`}>
                    <span className="stat-label">{STATUS_INFO[key].label}</span>
                    <span className="stat-value">{status.ris[key]}</span>
                  </div>
                ))}
              </div>

              <div className="progress-bar">
                {(Object.keys(STATUS_INFO) as StatusKey[])
                  .filter((key) => key !== 'cancelled' && status.ris[key] > 0)
                  .map((key) => (
                    <div
                      key={key}
                      className={`progress-segment ${STATUS_INFO[key].className}`}
                      style={{
                        width: `${getPercentage(status.ris[key], getJobTotal(status.ris))}%`,
                      }}
                    />
                  ))}
              </div>

              <div className="view-detail">상세보기 →</div>
            </div>

            {/* LIS 현황 */}
            <div className="department-card" onClick={() => handleNavigateToDetail('lis')}>
              <div className="department-header">
                <h3>
                  <span className="dept-icon">🧬</span>
                  LIS (진단검사)
                </h3>
                <span className="today-count">오늘 {status.lis.total_today}건</span>
              </div>

              <div className="stats-grid">
                {(Object.keys(STATUS_INFO) as StatusKey[]).map((key) => (
                  <div key={key} className={`stat-item ${STATUS_INFO[key].className}`}>
                    <span className="stat-label">{STATUS_INFO[key].label}</span>
                    <span className="stat-value">{status.lis[key]}</span>
                  </div>
                ))}
              </div>

              <div className="progress-bar">
                {(Object.keys(STATUS_INFO) as StatusKey[])
                  .filter((key) => key !== 'cancelled' && status.lis[key] > 0)
                  .map((key) => (
                    <div
                      key={key}
                      className={`progress-segment ${STATUS_INFO[key].className}`}
                      style={{
                        width: `${getPercentage(status.lis[key], getJobTotal(status.lis))}%`,
                      }}
                    />
                  ))}
              </div>

              <div className="view-detail">상세보기 →</div>
            </div>
          </section>

          {/* 사용자 로그인 현황 */}
          {userLoginStatus && (
            <section className="user-login-section">
              {/* RIS 사용자 현황 */}
              <div className="user-login-card">
                <div className="user-login-header">
                  <h3>
                    <span className="dept-icon">🔬</span>
                    RIS 사용자 현황
                  </h3>
                  <span className="login-count">
                    로그인: {userLoginStatus.ris.online_count} / {userLoginStatus.ris.total_count}
                  </span>
                </div>
                <div className="user-list">
                  {userLoginStatus.ris.users.map((user) => (
                    <div
                      key={user.id}
                      className={`user-item ${user.is_online ? 'online' : 'offline'}`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-id">({user.login_id})</span>
                      </div>
                      <div className="user-status">
                        <span className="last-activity">최근 활동: {user.last_activity_text}</span>
                        <span className={`status-badge ${user.is_online ? 'online' : 'offline'}`}>
                          {user.is_online ? '🟢 정상' : '⚠️ 미접속'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {userLoginStatus.ris.users.length === 0 && (
                    <div className="no-users">등록된 사용자가 없습니다.</div>
                  )}
                </div>
              </div>

              {/* LIS 사용자 현황 */}
              <div className="user-login-card">
                <div className="user-login-header">
                  <h3>
                    <span className="dept-icon">🧬</span>
                    LIS 사용자 현황
                  </h3>
                  <span className="login-count">
                    로그인: {userLoginStatus.lis.online_count} / {userLoginStatus.lis.total_count}
                  </span>
                </div>
                <div className="user-list">
                  {userLoginStatus.lis.users.map((user) => (
                    <div
                      key={user.id}
                      className={`user-item ${user.is_online ? 'online' : 'offline'}`}
                      onClick={() => setSelectedUser(user)}
                    >
                      <div className="user-info">
                        <span className="user-name">{user.name}</span>
                        <span className="user-id">({user.login_id})</span>
                      </div>
                      <div className="user-status">
                        <span className="last-activity">최근 활동: {user.last_activity_text}</span>
                        <span className={`status-badge ${user.is_online ? 'online' : 'offline'}`}>
                          {user.is_online ? '🟢 정상' : '⚠️ 미접속'}
                        </span>
                      </div>
                    </div>
                  ))}
                  {userLoginStatus.lis.users.length === 0 && (
                    <div className="no-users">등록된 사용자가 없습니다.</div>
                  )}
                </div>
              </div>
            </section>
          )}
        </>
      )}

      {loading && !status && <div className="loading-message">로딩 중...</div>}

      {/* 사용자 상세 정보 모달 */}
      {selectedUser && (
        <div className="user-detail-modal-overlay" onClick={() => setSelectedUser(null)}>
          <div className="user-detail-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h3>사용자 상세 정보</h3>
              <button className="close-btn" onClick={() => setSelectedUser(null)}>×</button>
            </div>
            <div className="modal-content">
              <div className="detail-row">
                <span className="detail-label">이름</span>
                <span className="detail-value">{selectedUser.name}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">아이디</span>
                <span className="detail-value">{selectedUser.login_id}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">이메일</span>
                <span className="detail-value">{selectedUser.email || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">상태</span>
                <span className={`detail-value status ${selectedUser.is_online ? 'online' : 'offline'}`}>
                  {selectedUser.is_online ? '🟢 접속 중' : '⚠️ 미접속'}
                </span>
              </div>
              <div className="detail-row">
                <span className="detail-label">최근 활동</span>
                <span className="detail-value">{selectedUser.last_activity_text}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">최근 접속 IP</span>
                <span className="detail-value">{selectedUser.last_login_ip || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="detail-label">계정 생성일</span>
                <span className="detail-value">
                  {selectedUser.created_at
                    ? new Date(selectedUser.created_at).toLocaleDateString('ko-KR')
                    : '-'}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
