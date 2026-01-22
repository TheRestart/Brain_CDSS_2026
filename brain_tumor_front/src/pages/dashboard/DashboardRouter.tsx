import DoctorDashboard from '@/pages/dashboard/doctor/DoctorDashboard';
import NurseDashboard from '@/pages/dashboard/nurse/NurseDashboard';
import LISDashboard from '@/pages/dashboard/lis/LISDashboard';
import RISDashboard from '@/pages/dashboard/ris/RISDashboard';
import SystemManagerDashboard from './systemManager/SystemManagerDashboard';
import AdminDashboard from './admin/AdminDashboard';
import ExternalDashboard from './external/ExternalDashboard';

interface Props {
  role: string;
}

export default function DashboardRouter({ role }: Props) {
  switch (role) {
    case 'DOCTOR':
      return <DoctorDashboard />;

    case 'NURSE':
      return <NurseDashboard />;

    case 'LIS':
      return <LISDashboard />;

    case 'RIS':
      return <RISDashboard />;

    case 'SYSTEMMANAGER':
      return <SystemManagerDashboard />;

    case 'ADMIN':
      return <AdminDashboard />;

    case 'EXTERNAL':
      return <ExternalDashboard />;

    default:
      return <div>대시보드를 찾을 수 없습니다.</div>;
  }
}
