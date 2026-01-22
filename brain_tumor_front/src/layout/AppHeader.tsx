import { useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';
import brainIcon from '@/assets/icon/mri-brain.png';
import Breadcrumb from '@/layout/Breadcrumb';
import { ROLE_THEME } from '@/utils/roleTheme';

interface AppHeaderProps {
  onToggleSidebar: () => void;
}

/* 초 → mm:ss */
function formatTime(sec: number) {
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m}:${s.toString().padStart(2, '0')}`;
}

export default function AppHeader({ onToggleSidebar }: AppHeaderProps) {
  const navigator = useNavigate();
  const { user , sessionRemain, logout } = useAuth();
  const [open, setOpen] = useState(false); // 드롭다운 컨트롤
  const dropdownRef = useRef<HTMLDivElement>(null); // 드롭다운 닫기

  if (!user) return null; // auth 준비 전 방어

  const handleLogout = () => {
    // 로그아웃 처리 로직 (예: 토큰 삭제, 리다이렉트 등)
    logout(); // AuthProvider에 위임 (권장)
    navigator('/login');
  }

  const tenant = {
    hospitalName: 'OO대학교병원',
    systemName: 'Brain CDSS',
  };

  // 로그인 user 역할에 따른 화면 색깔 및 아이콘 지정
  type RoleCode = keyof typeof ROLE_THEME;
  const theme = ROLE_THEME[user.role.code as RoleCode];


  // 드롭다운 외부 영역 클릭 감지
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setOpen(false);
      }
    };

    if (open) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [open]);


  return (
    <>
    <div
      style={{
        height: 4,
        background: theme.bg,
      }}
    />
    <header className="app-header"
    >
      {/* 좌측: 시스템명 (Home) */}
      <div className="header-left">
          
        <button className="hamburger-btn" onClick={onToggleSidebar}>
          ☰
        </button>
        <img src={brainIcon} className="system-logo" />
        <div className="system-title">
          <a href="/dashboard" className="system-name">
            <span>{tenant.hospitalName}</span>&nbsp;
            <strong>{tenant.systemName}</strong>
          </a>
          
        </div>
      </div>

      {/* 중앙 : 현재 메뉴 표시 */}
      <div className="header-center">
          <Breadcrumb />
      </div>

      {/* 우측 : 사용자 정보 */}
      <div className="headerRight">
        <div className="user-info">
            <span className="role">{user?.role.name}</span>
            <span className="divider">|</span>
            <div className='user-area' onClick={()=> setOpen(prev => !prev)} ref={dropdownRef}>
              <span className="userIcon">
                  <i className={`fa-solid ${theme.icon}`} />
              </span>
              <span className="user-name">{user?.name}</span>
              {open && (
                <div className="user-dropdown">
                  <ul>
                    <li onClick={() => navigator('/mypage')}>
                      <i className="fa-solid fa-user" /> 마이페이지
                    </li>
                    <li onClick={() => navigator('/change-password')}>
                      <i className="fa-solid fa-key" /> 비밀번호 변경
                    </li>
                  </ul>
                </div>
              )}
            </div>

            <span className="divider">|</span>
            <a onClick={handleLogout} className="danger" >
                <i className="fa-solid fa-right-from-bracket"/>&nbsp;로그아웃
            </a>
        </div>
        <div className="timer-display">            
            <span className="current-time">
                <strong>{new Date().toLocaleTimeString()}</strong>
            </span>
            <span className="divider">|</span>
            <span className={`session-timer ${sessionRemain < 300 ? 'danger' : ''}`}>
                ⏱ {formatTime(sessionRemain)}
            </span>
        </div>

        </div>
    </header>
  </>
  );
}
