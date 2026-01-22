import { Suspense, lazy } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';
import ProtectedRoute from '@/pages/auth/ProtectedRoute';
import { routeMap } from './routeMap';
import type { MenuNode } from '@/types/menu';
import FullScreenLoader from '@/pages/common/FullScreenLoader';

// Lazy loaded pages (메뉴에 없는 특수 페이지들)
const OCSResultReportPage = lazy(() => import('@/pages/ocs/OCSResultReportPage'));
const RISStudyDetailPage = lazy(() => import('@/pages/ocs/RISStudyDetailPage'));
const LISStudyDetailPage = lazy(() => import('@/pages/ocs/LISStudyDetailPage'));
const MyPage = lazy(() => import('@/pages/mypage/MyPage'));
const PatientDashboard = lazy(() => import('@/pages/patient/PatientDashboard'));
const PatientDetailPage = lazy(() => import('@/pages/patient/PatientDetailPage'));
const SharedCalendarPage = lazy(() => import('@/pages/admin/SharedCalendarPage'));
const EncounterDetailPage = lazy(() => import('@/pages/encounter/EncounterDetailPage'));

// 접근 가능한 메뉴만 flatten (라우트 등록용 - breadcrumbOnly 포함)
function flattenAccessibleMenus(
  menus: MenuNode[],
  permissions: string[],
  includeHidden: boolean = false
): MenuNode[] {
  return menus.flatMap(menu => {
    const hasPermission = permissions.includes(menu.code);

    const children = menu.children
      ? flattenAccessibleMenus(menu.children, permissions, includeHidden)
      : [];

    // path가 있고 접근 가능하면 포함
    // includeHidden=true면 breadcrumbOnly도 포함 (라우트 등록용)
    if (menu.path && hasPermission) {
      if (!menu.breadcrumbOnly || includeHidden) {
        return [menu, ...children];
      }
    }

    // path가 없거나 접근 불가 → children만 포함
    return children;
  });
}

export default function AppRoutes() {
  const { menus, permissions, isAuthReady, role } = useAuth();

  // 인증 준비 전엔 로딩
  if (!isAuthReady) {
    return <FullScreenLoader />;
  }

  // PATIENT 역할은 메뉴 기반 라우팅 + 기본 경로만 다름
  const isPatient = role === 'PATIENT';
  const isExternal = role === 'EXTERNAL';
  const defaultPath = isPatient ? '/my/summary' : '/dashboard';

  // 메뉴/권한 준비 전엔 로딩 (EXTERNAL 역할은 메뉴 없이도 대시보드 접근 가능)
  if (!isExternal && (menus.length === 0 || permissions.length === 0)) {
    return <FullScreenLoader />;
  }

  // 라우트 등록용: breadcrumbOnly 메뉴도 포함
  const accessibleMenus = flattenAccessibleMenus(menus, permissions, true);

  return (
    <Suspense fallback={<FullScreenLoader />}>
      <Routes>
        {/* 홈 */}
        <Route index element={<Navigate to={defaultPath} replace />} />

        {/* OCS 결과 보고서 페이지 (메뉴에 없는 특수 페이지) */}
        <Route
          path="/ocs/report/:ocsId"
          element={
            <ProtectedRoute>
              <OCSResultReportPage />
            </ProtectedRoute>
          }
        />

        {/* RIS 영상 검사 상세 페이지 */}
        <Route
          path="/ocs/ris/:ocsId"
          element={
            <ProtectedRoute>
              <RISStudyDetailPage />
            </ProtectedRoute>
          }
        />

        {/* LIS 검사 결과 상세 페이지 */}
        <Route
          path="/ocs/lis/:ocsId"
          element={
            <ProtectedRoute>
              <LISStudyDetailPage />
            </ProtectedRoute>
          }
        />

        {/* 마이페이지 (모든 로그인 사용자 접근 가능) */}
        <Route
          path="/mypage"
          element={
            <ProtectedRoute>
              <MyPage />
            </ProtectedRoute>
          }
        />

        {/* 환자 포털 (PATIENT 역할만 접근 가능) */}
        <Route
          path="/patient/dashboard"
          element={
            <ProtectedRoute allowedRoles={['PATIENT']}>
              <PatientDashboard />
            </ProtectedRoute>
          }
        />

        {/* 환자 상세 페이지 */}
        <Route
          path="/patients/:patientId"
          element={
            <ProtectedRoute>
              <PatientDetailPage />
            </ProtectedRoute>
          }
        />

        {/* 진료 상세 페이지 (처방 상세 포함) */}
        <Route
          path="/encounters/:id"
          element={
            <ProtectedRoute>
              <EncounterDetailPage />
            </ProtectedRoute>
          }
        />

        {/* Admin 공유 캘린더 관리 페이지 */}
        <Route
          path="/admin/shared-calendar"
          element={
            <ProtectedRoute allowedRoles={['ADMIN', 'SYSTEMMANAGER']}>
              <SharedCalendarPage />
            </ProtectedRoute>
          }
        />

        {accessibleMenus.map(menu => {
          const Component = routeMap[menu.code];
          if (!Component) return null;

          return (
            <Route
              key={menu.code}
              path={menu.path!}
              element={
                <ProtectedRoute>
                  <Component />
                </ProtectedRoute>
              }
            />
          );
        })}

        <Route path="*" element={<Navigate to={isPatient ? defaultPath : "/403"} replace />} />
      </Routes>
    </Suspense>
  );
}