import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "./AuthProvider";
import type { ReactNode } from "react";

interface Props {
  children: ReactNode;
}

export default function RequirePasswordChange({ children }: Props) {
  const { user, isAuthReady  } = useAuth();
  const location = useLocation();

  // 인증 정보 로딩 끝나기 전에는 아무 판단도 하지 말 것
  if (!isAuthReady) return null;

  if (
    user?.must_change_password &&
    location.pathname !== "/change-password"
  ) {
    return <Navigate to="/change-password" replace />;
  }

  return <>{children}</>;
}
