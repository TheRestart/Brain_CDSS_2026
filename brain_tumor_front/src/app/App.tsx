import { Routes, Route } from 'react-router-dom';
import LoginPage from '@/pages/auth/LoginPage';
import AppLayout from '@/layout/AppLayout';
import CommingSoon from '@/pages/common/CommingSoon';
import ChangePasswordPage from '@/pages/auth/ChangePasswordPage';
import AppRoutes from '@/router/AppRoutes';

export default function App() {
  return (
    <Routes>
      {/* 공개 */}
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
