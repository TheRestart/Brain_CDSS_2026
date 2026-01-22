import { Routes, Route } from 'react-router-dom';
import LoginPage from '@/pages/auth/LoginPage';
import LandingPage from '@/pages/landing/LandingPage';
import AppLayout from '@/layout/AppLayout';
import CommingSoon from '@/pages/common/CommingSoon';
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage';
import AppRoutes from '@/router/AppRoutes';

export default function App() {
  return (
    <Routes>
      {/* 공개 - 랜딩 페이지 (루트 경로) */}
      <Route path="/" element={<LandingPage />} />
      <Route path="/welcome" element={<LandingPage />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/403" element={<CommingSoon />} />
      <Route path="/change-password" element={<ChangePasswordPage />} />

      {/* 내부 */}
      <Route path="/*" element={<AppLayout />}>
        <Route path="*" element={<AppRoutes />} />
      </Route>
    </Routes>
  );
}
