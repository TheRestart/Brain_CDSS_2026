import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getAdminStats } from '@/services/dashboard.api';
import type { AdminStats } from '@/services/dashboard.api';
import AdminDashboard from '../admin/AdminDashboard';
import DoctorDashboard from '../doctor/DoctorDashboard';
import NurseDashboard from '../nurse/NurseDashboard';
import LISDashboard from '../lis/LISDashboard';
import RISDashboard from '../ris/RISDashboard';
import PatientDashboardPreview from '../patient/PatientDashboardPreview';
import ExternalDashboard from '../external/ExternalDashboard';
import { DashboardHeader } from '../common/DashboardHeader';
import { AIAnalysisBlock } from '@/components/AIAnalysisBlock';
import './SystemManagerDashboard.css';

type TabType = 'OVERVIEW' | 'ADMIN' | 'DOCTOR' | 'NURSE' | 'LIS' | 'RIS' | 'PATIENT' | 'EXTERNAL';

const dashboards = {
  ADMIN: <AdminDashboard />,
  DOCTOR: <DoctorDashboard />,
  NURSE: <NurseDashboard />,
  LIS: <LISDashboard />,
  RIS: <RISDashboard />,
  PATIENT: <PatientDashboardPreview />,
  EXTERNAL: <ExternalDashboard />,
};

export default function SystemManagerDashboard() {
  const navigate = useNavigate();
  const [active, setActive] = useState<TabType>('OVERVIEW');
  const [stats, setStats] = useState<AdminStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const data = await getAdminStats();
        setStats(data);
      } catch (err) {
        console.error('Failed to fetch stats:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, []);

  const tabLabels: Record<TabType, string> = {
    OVERVIEW: '시스템 현황',
    ADMIN: '관리자',
    DOCTOR: '의사',
    NURSE: '간호사',
    LIS: '병리실',
    RIS: '영상실',
    PATIENT: '환자',
    EXTERNAL: '외부기관',
  };

  return (
    <div className="system-manager-dashboard">
      <DashboardHeader role="SYSTEM_MANAGER" />
      <div className="sm-tabs">
        {(Object.keys(tabLabels) as TabType[]).map((tab) => (
          <button
            key={tab}
            className={`sm-tab ${active === tab ? 'active' : ''}`}
            onClick={() => setActive(tab)}
          >
            {tabLabels[tab]}
          </button>
        ))}
      </div>

      <div className="sm-content">
        {active === 'OVERVIEW' ? (
          <div className="sm-overview">
            {loading ? (
              <div className="loading">통계 로딩 중...</div>
            ) : !stats ? (
              <div className="error">통계를 불러올 수 없습니다.</div>
            ) : (
              <>
                {/* 요약 카드 */}
                <div className="sm-summary-cards">
                  <div className="sm-card users">
                    <div className="sm-card-icon">👥</div>
                    <div className="sm-card-content">
                      <span className="sm-card-value">{stats.users.total}</span>
                      <span className="sm-card-label">전체 사용자</span>
                      <span className="sm-card-sub">최근 로그인: {stats.users.recent_logins}명</span>
                    </div>
                  </div>

                  <div className="sm-card patients">
                    <div className="sm-card-icon">🏥</div>
                    <div className="sm-card-content">
                      <span className="sm-card-value">{stats.patients.total}</span>
                      <span className="sm-card-label">전체 환자</span>
                      <span className="sm-card-sub">이번 달 신규: {stats.patients.new_this_month}명</span>
                    </div>
                  </div>

                  <div className="sm-card ocs">
                    <div className="sm-card-icon">📋</div>
                    <div className="sm-card-content">
                      <span className="sm-card-value">{stats.ocs.total}</span>
                      <span className="sm-card-label">OCS 현황</span>
                      <span className="sm-card-sub">대기 중: {stats.ocs.pending_count}건</span>
                    </div>
                  </div>
                </div>

                {/* OCS 상태별 현황 */}
                <div className="sm-section">
                  <h3>OCS 상태별 현황</h3>
                  <div className="sm-status-grid">
                    {Object.entries(stats.ocs.by_status).map(([status, count]) => (
                      <div key={status} className={`sm-status-item status-${status.toLowerCase()}`}>
                        <span className="sm-status-label">{status}</span>
                        <span className="sm-status-count">{count}</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 역할별 사용자 현황 */}
                <div className="sm-section">
                  <h3>역할별 사용자</h3>
                  <div className="sm-role-grid">
                    {Object.entries(stats.users.by_role).map(([role, count]) => (
                      <div key={role} className="sm-role-item">
                        <span className="sm-role-name">{role}</span>
                        <span className="sm-role-count">{count}명</span>
                      </div>
                    ))}
                  </div>
                </div>

                {/* 관리 도구 바로가기 */}
                <div className="sm-section">
                  <h3>관리 도구</h3>
                  <div className="sm-tools-grid">
                    <button className="sm-tool-btn" onClick={() => navigate('/admin/users')}>
                      <span className="tool-icon">👥</span>
                      <span className="tool-label">사용자 관리</span>
                    </button>
                    <button className="sm-tool-btn" onClick={() => navigate('/admin/roles')}>
                      <span className="tool-icon">🔐</span>
                      <span className="tool-label">역할 관리</span>
                    </button>
                    <button className="sm-tool-btn" onClick={() => navigate('/admin/permissions')}>
                      <span className="tool-icon">📂</span>
                      <span className="tool-label">메뉴 권한</span>
                    </button>
                    <button className="sm-tool-btn" onClick={() => navigate('/admin/pdf-watermark')}>
                      <span className="tool-icon">💧</span>
                      <span className="tool-label">PDF 워터마크</span>
                    </button>
                    <button className="sm-tool-btn" onClick={() => navigate('/admin/audit')}>
                      <span className="tool-icon">📝</span>
                      <span className="tool-label">감사 로그</span>
                    </button>
                    <button className="sm-tool-btn" onClick={() => navigate('/admin/monitor')}>
                      <span className="tool-icon">📊</span>
                      <span className="tool-label">시스템 모니터</span>
                    </button>
                  </div>
                </div>
              </>
            )}

            {/* AI 분석 블럭 */}
            <AIAnalysisBlock />
          </div>
        ) : (
          <div className="sm-dashboard-preview">
            <div className="preview-header">
              <span className="preview-badge">{tabLabels[active]} 대시보드 미리보기</span>
            </div>
            {dashboards[active as keyof typeof dashboards]}
          </div>
        )}
      </div>
    </div>
  );
}
