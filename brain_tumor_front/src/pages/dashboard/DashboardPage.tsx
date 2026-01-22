import { useAuth } from '@/pages/auth/AuthProvider';
import DashboardRouter from './DashboardRouter';

export default function DashboardPage() {
  const { role } = useAuth();

  if (!role) return null;

  return (
    <div className="page dashboard-page">
      <DashboardRouter role={role} />
    </div>
  );
}
