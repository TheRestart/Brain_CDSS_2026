import { Navigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';
import ChangePasswordForm from './ChangePasswordForm';
import '@/assets/style/changePwdStyle.css';

export default function ChangePasswordPage() {
  const { user, isAuthReady } = useAuth();

  if (!isAuthReady) return null;

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <ChangePasswordForm />
  );
}
