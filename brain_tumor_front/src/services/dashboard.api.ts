import { api } from './api';

// Admin Dashboard 통계
export type AdminStats = {
  users: {
    total: number;
    by_role: Record<string, number>;
    recent_logins: number;
  };
  patients: {
    total: number;
    new_this_month: number;
  };
  ocs: {
    total: number;
    by_status: Record<string, number>;
    pending_count: number;
  };
}

// OCS 상태별 카운트 타입
export type OcsStatusCounts = {
  ordered: number;
  accepted: number;
  in_progress: number;
  result_ready: number;
  confirmed: number;
  cancelled: number;
  total: number;
  total_this_week: number;
};

// External Dashboard 통계
export type ExternalStats = {
  lis_uploads: OcsStatusCounts;
  ris_uploads: OcsStatusCounts;
  recent_uploads: Array<{
    id: number;
    ocs_id: string;
    job_role: string;
    status: string;
    uploaded_at: string;
    patient_name: string;
  }>;
}

export const getAdminStats = async (): Promise<AdminStats> => {
  const response = await api.get('/dashboard/admin/stats/');
  return response.data;
};

export const getExternalStats = async (): Promise<ExternalStats> => {
  const response = await api.get('/dashboard/external/stats/');
  return response.data;
};

// Doctor Dashboard 통계
export type DoctorStats = {
  today_appointments: Array<{
    encounter_id: number;
    patient_id: number;
    patient_name: string;
    patient_number: string;
    scheduled_time: string;
    status: string;
    encounter_type: string;
  }>;
  stats: {
    total_today: number;
    completed: number;
    in_progress: number;
    waiting: number;
  };
}

export const getDoctorStats = async (): Promise<DoctorStats> => {
  const response = await api.get('/dashboard/doctor/stats/');
  return response.data;
};
