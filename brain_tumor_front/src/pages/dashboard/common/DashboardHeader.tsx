import type { ReactNode } from 'react';
import './DashboardHeader.css';

// 역할별 아이콘 정의
const MicroscopeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M6 18h8" />
    <path d="M3 22h18" />
    <path d="M14 22a7 7 0 1 0 0-14h-1" />
    <path d="M9 14h2" />
    <path d="M9 12a2 2 0 0 1-2-2V6h6v4a2 2 0 0 1-2 2Z" />
    <path d="M12 6V3a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v3" />
  </svg>
);

const ScannerIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="3" y="3" width="18" height="18" rx="2" />
    <circle cx="12" cy="12" r="5" />
    <path d="M12 7v10" />
    <path d="M7 12h10" />
  </svg>
);

const StethoscopeIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M4.8 2.3A.3.3 0 1 0 5 2H4a2 2 0 0 0-2 2v5a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6V4a2 2 0 0 0-2-2h-1a.2.2 0 1 0 .3.3" />
    <path d="M8 15v1a6 6 0 0 0 6 6v0a6 6 0 0 0 6-6v-4" />
    <circle cx="20" cy="10" r="2" />
  </svg>
);

const HeartPulseIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 14c1.49-1.46 3-3.21 3-5.5A5.5 5.5 0 0 0 16.5 3c-1.76 0-3 .5-4.5 2-1.5-1.5-2.74-2-4.5-2A5.5 5.5 0 0 0 2 8.5c0 2.3 1.5 4.05 3 5.5l7 7Z" />
    <path d="M3.22 12H9.5l.5-1 2 4.5 2-7 1.5 3.5h5.27" />
  </svg>
);

const SettingsIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
    <circle cx="12" cy="12" r="3" />
  </svg>
);

const UserIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <path d="M19 21v-2a4 4 0 0 0-4-4H9a4 4 0 0 0-4 4v2" />
    <circle cx="12" cy="7" r="4" />
  </svg>
);

const BuildingIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="4" y="2" width="16" height="20" rx="2" ry="2" />
    <path d="M9 22v-4h6v4" />
    <path d="M8 6h.01" />
    <path d="M16 6h.01" />
    <path d="M12 6h.01" />
    <path d="M12 10h.01" />
    <path d="M12 14h.01" />
    <path d="M16 10h.01" />
    <path d="M16 14h.01" />
    <path d="M8 10h.01" />
    <path d="M8 14h.01" />
  </svg>
);

const ServerIcon = () => (
  <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
    <rect x="2" y="2" width="20" height="8" rx="2" ry="2" />
    <rect x="2" y="14" width="20" height="8" rx="2" ry="2" />
    <line x1="6" y1="6" x2="6.01" y2="6" />
    <line x1="6" y1="18" x2="6.01" y2="18" />
  </svg>
);

export type DashboardRole = 'LIS' | 'RIS' | 'DOCTOR' | 'NURSE' | 'ADMIN' | 'PATIENT' | 'EXTERNAL' | 'SYSTEM_MANAGER';

interface RoleConfig {
  icon: ReactNode;
  title: string;
  subtitle: string;
  colorClass: string;
}

const ROLE_CONFIG: Record<DashboardRole, RoleConfig> = {
  LIS: {
    icon: <MicroscopeIcon />,
    title: '병리실 대시보드',
    subtitle: '병리 검사 및 분석 현황',
    colorClass: 'role-lis',
  },
  RIS: {
    icon: <ScannerIcon />,
    title: '영상실 대시보드',
    subtitle: '영상 검사 및 판독 현황',
    colorClass: 'role-ris',
  },
  DOCTOR: {
    icon: <StethoscopeIcon />,
    title: '의사 대시보드',
    subtitle: '진료 및 환자 관리',
    colorClass: 'role-doctor',
  },
  NURSE: {
    icon: <HeartPulseIcon />,
    title: '간호사 대시보드',
    subtitle: '진료 접수 및 환자 케어',
    colorClass: 'role-nurse',
  },
  ADMIN: {
    icon: <SettingsIcon />,
    title: '관리자 대시보드',
    subtitle: '시스템 및 사용자 관리',
    colorClass: 'role-admin',
  },
  PATIENT: {
    icon: <UserIcon />,
    title: '환자 대시보드',
    subtitle: '내 건강 정보 확인',
    colorClass: 'role-patient',
  },
  EXTERNAL: {
    icon: <BuildingIcon />,
    title: '외부기관 대시보드',
    subtitle: '검사 결과 업로드 현황',
    colorClass: 'role-external',
  },
  SYSTEM_MANAGER: {
    icon: <ServerIcon />,
    title: '시스템 관리자',
    subtitle: '전체 시스템 모니터링',
    colorClass: 'role-system',
  },
};

interface DashboardHeaderProps {
  role: DashboardRole;
  customTitle?: string;
  customSubtitle?: string;
  actions?: ReactNode;
}

export function DashboardHeader({ role, customTitle, customSubtitle, actions }: DashboardHeaderProps) {
  const config = ROLE_CONFIG[role];

  return (
    <header className={`dashboard-header ${config.colorClass}`}>
      <div className="header-left">
        <div className="header-icon">{config.icon}</div>
        <div className="header-text">
          <h1>{customTitle || config.title}</h1>
          <p>{customSubtitle || config.subtitle}</p>
        </div>
      </div>
      {actions && <div className="header-actions">{actions}</div>}
    </header>
  );
}
