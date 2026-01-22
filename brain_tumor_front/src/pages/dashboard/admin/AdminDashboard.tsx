import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats } from '@/services/dashboard.api';
import { fetchUsers } from '@/services/users.api';
import type { AdminStats } from '@/services/dashboard.api';
import type { User } from '@/types/user';
import { UnifiedCalendar } from '@/components/calendar/UnifiedCalendar';
import DashboardDetailModal, { type ModalType } from './DashboardDetailModal';
import { DashboardHeader } from '../common/DashboardHeader';
import type { OcsStatus } from '@/types/ocs';
import './AdminDashboard.css';

interface ModalState {
  open: boolean;
  type: ModalType;
  title: string;
  roleFilter?: string;
  ocsStatusFilter?: OcsStatus;
}

const USERS_PER_PAGE = 10;

export default function AdminDashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState<ModalState>({
    open: false,
    type: 'users',
    title: '',
  });

  // 역할별 사용자 리스트 상태
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [roleUsers, setRoleUsers] = useState<User[]>([]);
  const [roleUsersLoading, setRoleUsersLoading] = useState(false);
  const [roleUserPage, setRoleUserPage] = useState(1);
  const [roleUserTotalCount, setRoleUserTotalCount] = useState(0);

  const openModal = (type: ModalType, title: string, roleFilter?: string, ocsStatusFilter?: OcsStatus) => {
    setModal({ open: true, type, title, roleFilter, ocsStatusFilter });
  };

  const closeModal = () => {
    setModal({ open: false, type: 'users', title: '' });
  };

  // 역할 클릭 시 해당 역할의 사용자 목록 로드
  const handleRoleClick = async (role: string) => {
    if (selectedRole === role) {
      // 같은 역할 클릭 시 토글 (닫기)
      setSelectedRole(null);
      setRoleUsers([]);
      return;
    }

    setSelectedRole(role);
    setRoleUserPage(1);
    await loadRoleUsers(role, 1);
  };

  const loadRoleUsers = async (role: string, page: number) => {
    setRoleUsersLoading(true);
    try {
      const response = await fetchUsers({
        role__code: role,
        page,
        size: USERS_PER_PAGE,
      });
      setRoleUsers(response.results || []);
      setRoleUserTotalCount(response.count || 0);
    } catch (err) {
      console.error('Failed to fetch role users:', err);
      setRoleUsers([]);
    } finally {
      setRoleUsersLoading(false);
    }
  };

  // 페이지 변경 시
  const handleRoleUserPageChange = (newPage: number) => {
    setRoleUserPage(newPage);
    if (selectedRole) {
      loadRoleUsers(selectedRole, newPage);
    }
  };

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch admin stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  if (loading) return <div className="loading">통계 로딩 중...</div>;
  if (!stats) return <div className="error">통계를 불러올 수 없습니다.</div>;

  return (
    <div className="admin-dashboard">
      <DashboardHeader role="ADMIN" />

      {/* 요약 카드 */}
      <div className="summary-cards">
        <div
          className="summary-card users clickable"
          onClick={() => openModal('users', '전체 사용자 목록')}
        >
          <div className="card-icon">👥</div>
          <div className="card-content">
            <span className="card-value">{stats.users.total}</span>
            <span className="card-label">전체 사용자</span>
            <span className="card-sub">최근 로그인: {stats.users.recent_logins}명</span>
          </div>
        </div>

        <div
          className="summary-card patients clickable"
          onClick={() => openModal('patients', '전체 환자 목록')}
        >
          <div className="card-icon">🏥</div>
          <div className="card-content">
            <span className="card-value">{stats.patients.total}</span>
            <span className="card-label">전체 환자</span>
            <span className="card-sub">이번 달 신규: {stats.patients.new_this_month}명</span>
          </div>
        </div>

        <div
          className="summary-card ocs clickable"
          onClick={() => openModal('ocs', '전체 OCS 목록')}
        >
          <div className="card-icon">📋</div>
          <div className="card-content">
            <span className="card-value">{stats.ocs.total}</span>
            <span className="card-label">OCS 현황</span>
            <span className="card-sub">대기 중: {stats.ocs.pending_count}건</span>
          </div>
        </div>
      </div>

      {/* OCS 상태별 현황 */}
      <div className="dashboard-section">
        <h3>OCS 상태별 현황</h3>
        <div className="status-grid">
          {Object.entries(stats.ocs.by_status).map(([status, count]) => (
            <div
              key={status}
              className={`status-item status-${status.toLowerCase()} clickable`}
              onClick={() => openModal('ocs_status', `${status} 상태 OCS 목록`, undefined, status as OcsStatus)}
            >
              <span className="status-label">{status}</span>
              <span className="status-count">{count}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 관리 도구 바로가기 */}
      <div className="dashboard-section">
        <h3>관리 도구</h3>
        <div className="admin-tools-grid">
          <button
            className="admin-tool-btn"
            onClick={() => navigate('/admin/users')}
          >
            <span className="tool-icon">👥</span>
            <span className="tool-label">사용자 관리</span>
          </button>
          <button
            className="admin-tool-btn"
            onClick={() => navigate('/admin/roles')}
          >
            <span className="tool-icon">🔐</span>
            <span className="tool-label">역할 관리</span>
          </button>
          <button
            className="admin-tool-btn"
            onClick={() => navigate('/admin/permissions')}
          >
            <span className="tool-icon">📂</span>
            <span className="tool-label">메뉴 권한</span>
          </button>
          <button
            className="admin-tool-btn"
            onClick={() => navigate('/admin/pdf-watermark')}
          >
            <span className="tool-icon">💧</span>
            <span className="tool-label">PDF 워터마크</span>
          </button>
          <button
            className="admin-tool-btn"
            onClick={() => navigate('/admin/audit')}
          >
            <span className="tool-icon">📝</span>
            <span className="tool-label">감사 로그</span>
          </button>
          <button
            className="admin-tool-btn"
            onClick={() => navigate('/admin/monitor')}
          >
            <span className="tool-icon">📊</span>
            <span className="tool-label">시스템 모니터</span>
          </button>
        </div>
      </div>

      {/* 역할별 사용자 현황 + 캘린더 (병렬) */}
      <div className="dashboard-main-row">
        {/* 역할별 사용자 */}
        <div className="dashboard-section">
          <div className="section-header">
            <h3>역할별 사용자</h3>
            <button
              className="manage-btn"
              onClick={() => navigate('/admin/users')}
            >
              사용자 관리
            </button>
          </div>
          <div className="role-grid">
            {Object.entries(stats.users.by_role).map(([role, count]) => (
              <div
                key={role}
                className={`role-item clickable ${selectedRole === role ? 'active' : ''}`}
                onClick={() => handleRoleClick(role)}
              >
                <span className="role-name">{role}</span>
                <span className="role-count">{count}명</span>
              </div>
            ))}
          </div>

          {/* 선택된 역할의 사용자 리스트 */}
          {selectedRole && (
            <div className="role-user-list">
              <h4>{selectedRole} 사용자 목록</h4>
              {roleUsersLoading ? (
                <div className="loading-small">로딩 중...</div>
              ) : roleUsers.length === 0 ? (
                <div className="empty-small">사용자가 없습니다.</div>
              ) : (
                <>
                  <table className="user-table">
                    <thead>
                      <tr>
                        <th>이름</th>
                        <th>아이디</th>
                        <th>이메일</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {roleUsers.map((user) => (
                        <tr key={user.id}>
                          <td>{user.name}</td>
                          <td>{user.login_id}</td>
                          <td>{user.email || '-'}</td>
                          <td>
                            <span className={`user-status ${user.is_active ? 'active' : 'inactive'}`}>
                              {user.is_active ? '활성' : '비활성'}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {roleUserTotalCount > USERS_PER_PAGE && (
                    <div className="pagination">
                      <button
                        className="page-btn"
                        disabled={roleUserPage === 1}
                        onClick={() => handleRoleUserPageChange(roleUserPage - 1)}
                      >
                        이전
                      </button>
                      <span className="page-info">
                        {roleUserPage} / {Math.ceil(roleUserTotalCount / USERS_PER_PAGE)}
                      </span>
                      <button
                        className="page-btn"
                        disabled={roleUserPage >= Math.ceil(roleUserTotalCount / USERS_PER_PAGE)}
                        onClick={() => handleRoleUserPageChange(roleUserPage + 1)}
                      >
                        다음
                      </button>
                    </div>
                  )}
                </>
              )}
            </div>
          )}
        </div>

        {/* 캘린더 */}
        <UnifiedCalendar
          title="관리자 통합 캘린더"
          showManageButton
          onManageClick={() => navigate('/admin/shared-calendar')}
        />
      </div>

      {/* 상세 팝업 모달 */}
      {modal.open && (
        <DashboardDetailModal
          type={modal.type}
          title={modal.title}
          roleFilter={modal.roleFilter}
          ocsStatusFilter={modal.ocsStatusFilter}
          onClose={closeModal}
        />
      )}
    </div>
  );
}
