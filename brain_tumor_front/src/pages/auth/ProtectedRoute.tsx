import { Navigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';

// 권한 가이드
interface Props {
  children: React.ReactNode;
  allowedRoles?: string[]; // 특정 역할만 접근 허용 (없으면 모든 인증 사용자 허용)
}

export default function ProtectedRoute({ children, allowedRoles }: Props) {
  const { isAuthReady, isAuthenticated, role } = useAuth();

  // Auth 초기화 대기
  if (!isAuthReady) return null;

  // 인증 정보 없음
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  // 역할 제한이 있는 경우 검사
  if (allowedRoles && allowedRoles.length > 0) {
    if (!role || !allowedRoles.includes(role)) {
      return <Navigate to="/403" replace />;
    }
  }

  return <>{children}</>;
}