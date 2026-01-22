import { useState, useEffect } from 'react';
import { getAuditLogs, getAccessLogs } from '@/services/audit.api';
import type { AuditLog as AuditLogType, AccessLog as AccessLogType } from '@/services/audit.api';
import SearchableUserDropdown from '@/components/common/SearchableUserDropdown';
import '@/assets/style/adminPageStyle.css';

type TabType = 'auth' | 'access';

// 감사 로그 페이지 (인증 로그 + 접근 로그 탭)
export default function AuditLog() {
  const [activeTab, setActiveTab] = useState<TabType>('auth');

  // 인증 로그 상태
  const [authLogs, setAuthLogs] = useState<AuditLogType[]>([]);
  const [authLoading, setAuthLoading] = useState(true);
  const [authTotalCount, setAuthTotalCount] = useState(0);
  const [authPage, setAuthPage] = useState(1);
  const [authUserFilter, setAuthUserFilter] = useState('');
  const [authActionFilter, setAuthActionFilter] = useState('');
  const [authDateFilter, setAuthDateFilter] = useState('');

  // 접근 로그 상태
  const [accessLogs, setAccessLogs] = useState<AccessLogType[]>([]);
  const [accessLoading, setAccessLoading] = useState(true);
  const [accessTotalCount, setAccessTotalCount] = useState(0);
  const [accessPage, setAccessPage] = useState(1);
  const [accessUserFilter, setAccessUserFilter] = useState('');
  const [accessActionFilter, setAccessActionFilter] = useState('');
  const [accessResultFilter, setAccessResultFilter] = useState('');
  const [accessDateFilter, setAccessDateFilter] = useState('');

  const pageSize = 20;

  // 인증 로그 조회
  const fetchAuthLogs = async () => {
    setAuthLoading(true);
    try {
      const params: Record<string, any> = {
        page: authPage,
        page_size: pageSize,
      };
      if (authUserFilter) params.user_login_id = authUserFilter;
      if (authActionFilter) params.action = authActionFilter;
      if (authDateFilter) params.date = authDateFilter;

      const response = await getAuditLogs(params);
      setAuthLogs(response.results || []);
      setAuthTotalCount(response.count || 0);
    } catch (error) {
      console.error('Failed to fetch audit logs:', error);
    } finally {
      setAuthLoading(false);
    }
  };

  // 접근 로그 조회
  const fetchAccessLogs = async () => {
    setAccessLoading(true);
    try {
      const params: Record<string, any> = {
        page: accessPage,
        page_size: pageSize,
      };
      if (accessUserFilter) params.user_login_id = accessUserFilter;
      if (accessActionFilter) params.action = accessActionFilter;
      if (accessResultFilter) params.result = accessResultFilter;
      if (accessDateFilter) params.date = accessDateFilter;

      const response = await getAccessLogs(params);
      setAccessLogs(response.results || []);
      setAccessTotalCount(response.count || 0);
    } catch (error) {
      console.error('Failed to fetch access logs:', error);
    } finally {
      setAccessLoading(false);
    }
  };

  // 탭별 데이터 로드
  useEffect(() => {
    if (activeTab === 'auth') {
      fetchAuthLogs();
    } else {
      fetchAccessLogs();
    }
  }, [activeTab, authPage, authActionFilter, authDateFilter, accessPage, accessActionFilter, accessResultFilter, accessDateFilter]);

  // 탭 전환 시 페이지 초기화
  const handleTabChange = (tab: TabType) => {
    setActiveTab(tab);
  };

  const handleAuthSearch = () => {
    setAuthPage(1);
    fetchAuthLogs();
  };

  const handleAccessSearch = () => {
    setAccessPage(1);
    fetchAccessLogs();
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAuthResultClass = (action: string) => {
    if (action === 'LOGIN_SUCCESS' || action === 'LOGOUT') return 'success';
    if (action === 'LOGIN_FAIL' || action === 'LOGIN_LOCKED') return 'fail';
    return '';
  };

  const getAccessResultClass = (result: string) => {
    return result === 'SUCCESS' ? 'success' : 'fail';
  };

  const authTotalPages = Math.ceil(authTotalCount / pageSize);
  const accessTotalPages = Math.ceil(accessTotalCount / pageSize);

  return (
    <div className="admin-card">
      {/* 탭 영역 */}
      <div className="audit-tabs">
        <button
          className={`tab-btn ${activeTab === 'auth' ? 'active' : ''}`}
          onClick={() => handleTabChange('auth')}
        >
          인증 로그
        </button>
        <button
          className={`tab-btn ${activeTab === 'access' ? 'active' : ''}`}
          onClick={() => handleTabChange('access')}
        >
          접근 로그
        </button>
      </div>

      {/* 인증 로그 탭 */}
      {activeTab === 'auth' && (
        <>
          <div className="admin-toolbar">
            <SearchableUserDropdown
              value={authUserFilter}
              onChange={(userId) => {
                setAuthUserFilter(userId);
                setAuthPage(1);
              }}
              placeholder="사용자 검색"
            />
            <input
              type="date"
              value={authDateFilter}
              onChange={(e) => {
                setAuthDateFilter(e.target.value);
                setAuthPage(1);
              }}
            />
            <select
              value={authActionFilter}
              onChange={(e) => {
                setAuthActionFilter(e.target.value);
                setAuthPage(1);
              }}
            >
              <option value="">전체</option>
              <option value="LOGIN_SUCCESS">로그인 성공</option>
              <option value="LOGIN_FAIL">로그인 실패</option>
              <option value="LOGIN_LOCKED">계정 잠금</option>
              <option value="LOGOUT">로그아웃</option>
            </select>
            <button className="search-btn" onClick={handleAuthSearch}>검색</button>
          </div>

          {authLoading ? (
            <div className="loading-state">로딩 중...</div>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>사용자</th>
                    <th>이름</th>
                    <th>역할</th>
                    <th>액션</th>
                    <th>IP 주소</th>
                    <th>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {authLogs.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="empty-row">데이터가 없습니다.</td>
                    </tr>
                  ) : (
                    authLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.created_at)}</td>
                        <td>{log.user_login_id || '-'}</td>
                        <td>{log.user_name || '-'}</td>
                        <td>{log.user_role || '-'}</td>
                        <td>{log.action_display}</td>
                        <td>{log.ip_address || '-'}</td>
                        <td className={getAuthResultClass(log.action)}>
                          {log.action === 'LOGIN_SUCCESS' || log.action === 'LOGOUT' ? '성공' : '실패'}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {authTotalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={authPage === 1}
                    onClick={() => setAuthPage(authPage - 1)}
                  >
                    이전
                  </button>
                  <span>{authPage} / {authTotalPages}</span>
                  <button
                    disabled={authPage === authTotalPages}
                    onClick={() => setAuthPage(authPage + 1)}
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* 접근 로그 탭 */}
      {activeTab === 'access' && (
        <>
          <div className="admin-toolbar">
            <SearchableUserDropdown
              value={accessUserFilter}
              onChange={(userId) => {
                setAccessUserFilter(userId);
                setAccessPage(1);
              }}
              placeholder="사용자 검색"
            />
            <input
              type="date"
              value={accessDateFilter}
              onChange={(e) => {
                setAccessDateFilter(e.target.value);
                setAccessPage(1);
              }}
            />
            <select
              value={accessActionFilter}
              onChange={(e) => {
                setAccessActionFilter(e.target.value);
                setAccessPage(1);
              }}
            >
              <option value="">액션 전체</option>
              <option value="VIEW">조회</option>
              <option value="CREATE">생성</option>
              <option value="UPDATE">수정</option>
              <option value="DELETE">삭제</option>
              <option value="EXPORT">내보내기</option>
            </select>
            <select
              value={accessResultFilter}
              onChange={(e) => {
                setAccessResultFilter(e.target.value);
                setAccessPage(1);
              }}
            >
              <option value="">결과 전체</option>
              <option value="SUCCESS">성공</option>
              <option value="FAIL">실패</option>
            </select>
            <button className="search-btn" onClick={handleAccessSearch}>검색</button>
          </div>

          {accessLoading ? (
            <div className="loading-state">로딩 중...</div>
          ) : (
            <>
              <table className="admin-table">
                <thead>
                  <tr>
                    <th>시간</th>
                    <th>사용자</th>
                    <th>역할</th>
                    <th>메뉴</th>
                    <th>액션</th>
                    <th>경로</th>
                    <th>IP 주소</th>
                    <th>결과</th>
                  </tr>
                </thead>
                <tbody>
                  {accessLogs.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="empty-row">데이터가 없습니다.</td>
                    </tr>
                  ) : (
                    accessLogs.map((log) => (
                      <tr key={log.id}>
                        <td>{formatDate(log.created_at)}</td>
                        <td>{log.user_login_id || '-'}</td>
                        <td>{log.user_role || '-'}</td>
                        <td>{log.menu_name || '-'}</td>
                        <td>{log.action_display}</td>
                        <td className="path-cell" title={log.request_path}>
                          {log.request_path.length > 30
                            ? log.request_path.substring(0, 30) + '...'
                            : log.request_path}
                        </td>
                        <td>{log.ip_address || '-'}</td>
                        <td className={getAccessResultClass(log.result)}>
                          {log.result_display}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>

              {accessTotalPages > 1 && (
                <div className="pagination">
                  <button
                    disabled={accessPage === 1}
                    onClick={() => setAccessPage(accessPage - 1)}
                  >
                    이전
                  </button>
                  <span>{accessPage} / {accessTotalPages}</span>
                  <button
                    disabled={accessPage === accessTotalPages}
                    onClick={() => setAccessPage(accessPage + 1)}
                  >
                    다음
                  </button>
                </div>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}
