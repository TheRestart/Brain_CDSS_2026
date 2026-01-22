import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useState, useEffect } from 'react';
import AppHeader from './AppHeader';
import { useAuth } from '@/pages/auth/AuthProvider';
import FullScreenLoader from '@/pages/common/FullScreenLoader';

import Sidebar from '@/layout/Sidebar';
import RequirePasswordChange from '@/pages/auth/RequirePasswordChange';
import { OCSNotificationProvider, useOCSNotificationContext } from '@/context/OCSNotificationContext';
import OCSNotificationToast from '@/components/OCSNotificationToast';
import { AIInferenceProvider } from '@/context/AIInferenceContext';
import AINotificationToast from '@/components/AINotificationToast';

// 전역 Toast 렌더링 컴포넌트
function GlobalOCSToast() {
  const { notifications, removeNotification } = useOCSNotificationContext();
  return (
    <OCSNotificationToast
      notifications={notifications}
      onDismiss={removeNotification}
    />
  );
}

// 모바일 여부 체크 함수
const isMobileDevice = () => window.innerWidth <= 768;

function AppLayoutContent() {
  const { role, isAuthReady } = useAuth();
  const location = useLocation();
  const [isSidebarOpen, setIsSidebarOpen] = useState(!isMobileDevice());
  const [isMobile, setIsMobile] = useState(isMobileDevice());

  // 화면 크기 변경 감지
  useEffect(() => {
    const handleResize = () => {
      const mobile = isMobileDevice();
      setIsMobile(mobile);
      if (!mobile && !isSidebarOpen) {
        setIsSidebarOpen(true);
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [isSidebarOpen]);

  // 모바일에서 페이지 이동 시 사이드바 닫기
  useEffect(() => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  }, [location.pathname, isMobile]);

  const toggleSidebar = () => setIsSidebarOpen(!isSidebarOpen);
  const closeSidebar = () => {
    if (isMobile) {
      setIsSidebarOpen(false);
    }
  };

  if (!isAuthReady) {
    return <FullScreenLoader />; // 로딩 스피너
  }

  if (!role) {
    return <Navigate to="/login" replace />;
  }

  return (
    <RequirePasswordChange>
      <div className='app-layout'>
        <AppHeader onToggleSidebar={toggleSidebar} />

        <div className='app-body'>
          {/* 모바일 백드롭 */}
          {isMobile && (
            <div
              className={`sidebar-backdrop ${isSidebarOpen ? 'open' : ''}`}
              onClick={closeSidebar}
            />
          )}
          {/* 사이드바 - 데스크톱: 조건부 렌더링, 모바일: 항상 렌더링+CSS로 제어 */}
          {(isSidebarOpen || isMobile) && (
            <aside className={`sidebar ${isSidebarOpen ? 'open' : ''}`}>
              <Sidebar />
            </aside>
          )}
          <main className='app-content'>
             {/* Outlet으로 자식 라우트(AppRoutes) 연결 */}
            <Outlet  />
          </main>
        </div>

        {/* 전역 OCS 알림 Toast */}
        <GlobalOCSToast />

        {/* 전역 AI 추론 알림 Toast */}
        <AINotificationToast />
      </div>
    </RequirePasswordChange>
  );
}

function AppLayout() {
  return (
    <OCSNotificationProvider>
      <AIInferenceProvider>
        <AppLayoutContent />
      </AIInferenceProvider>
    </OCSNotificationProvider>
  );
}

export default AppLayout;