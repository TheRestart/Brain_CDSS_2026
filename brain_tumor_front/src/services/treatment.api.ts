import { api } from './api';

// =============================================================================
// Treatment API Types (백엔드 모델과 일치)
// =============================================================================

export interface TreatmentPlan {
  id: number;
  patient: number;
  patient_name: string;
  patient_number: string;
  encounter: number | null;
  ocs: number | null;
  treatment_type: 'surgery' | 'radiation' | 'chemotherapy' | 'observation' | 'combined';
  treatment_type_display: string;
  treatment_goal: 'curative' | 'palliative' | 'adjuvant' | 'neoadjuvant';
  treatment_goal_display: string;
  plan_summary: string;
  planned_by: number;
  planned_by_name: string;
  status: 'planned' | 'in_progress' | 'completed' | 'cancelled' | 'on_hold';
  status_display: string;
  start_date: string | null;
  end_date: string | null;
  actual_start_date: string | null;
  actual_end_date: string | null;
  notes: string;
  sessions?: TreatmentSession[];
  session_count?: number;
  created_at: string;
  updated_at: string;
}

export interface TreatmentSession {
  id: number;
  treatment_plan: number;
  session_number: number;
  session_date: string;
  performed_by: number | null;
  performed_by_name: string | null;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled' | 'missed';
  status_display: string;
  session_note: string;
  adverse_events: string[];
  vitals_before: Record<string, unknown>;
  vitals_after: Record<string, unknown>;
  medications: Record<string, unknown>[];
  created_at: string;
  updated_at: string;
}

// 치료 계획 생성 데이터 (백엔드 필드명과 일치)
export interface TreatmentPlanCreateData {
  patient: number;              // patient_id → patient
  encounter?: number;           // encounter_id → encounter
  ocs?: number;
  treatment_type: string;
  treatment_goal: string;       // goals → treatment_goal
  plan_summary: string;         // title → plan_summary
  start_date?: string;
  end_date?: string;
  notes?: string;               // description → notes
}

export interface TreatmentSessionCreateData {
  treatment_plan: number;
  session_number: number;
  session_date: string;
  session_note?: string;
}

// =============================================================================
// API Functions
// =============================================================================

// 치료 계획 목록
export const getTreatmentPlans = async (params?: {
  patient_id?: number;
  status?: string;
  treatment_type?: string;
}): Promise<TreatmentPlan[]> => {
  const response = await api.get<TreatmentPlan[]>('/treatment/plans/', { params });
  return response.data;
};

// 치료 계획 상세
export const getTreatmentPlan = async (id: number): Promise<TreatmentPlan> => {
  const response = await api.get<TreatmentPlan>(`/treatment/plans/${id}/`);
  return response.data;
};

// 치료 계획 생성
export const createTreatmentPlan = async (data: TreatmentPlanCreateData): Promise<TreatmentPlan> => {
  const response = await api.post<TreatmentPlan>('/treatment/plans/', data);
  return response.data;
};

// 치료 계획 수정
export const updateTreatmentPlan = async (
  id: number,
  data: Partial<TreatmentPlanCreateData>
): Promise<TreatmentPlan> => {
  const response = await api.patch<TreatmentPlan>(`/treatment/plans/${id}/`, data);
  return response.data;
};

// 치료 계획 시작
export const startTreatmentPlan = async (id: number): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/treatment/plans/${id}/start/`);
  return response.data;
};

// 치료 계획 완료
export const completeTreatmentPlan = async (id: number): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/treatment/plans/${id}/complete/`);
  return response.data;
};

// 치료 계획 취소
export const cancelTreatmentPlan = async (id: number): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/treatment/plans/${id}/cancel/`);
  return response.data;
};

// 세션 목록
export const getTreatmentSessions = async (planId: number): Promise<TreatmentSession[]> => {
  const response = await api.get<TreatmentSession[]>(`/treatment/plans/${planId}/sessions/`);
  return response.data;
};

// 세션 생성
export const createTreatmentSession = async (
  planId: number,
  data: Omit<TreatmentSessionCreateData, 'treatment_plan'>
): Promise<TreatmentSession> => {
  const response = await api.post<TreatmentSession>(`/treatment/sessions/`, {
    ...data,
    treatment_plan: planId,
  });
  return response.data;
};

// 세션 완료
export const completeTreatmentSession = async (
  sessionId: number,
  data: { session_note?: string; adverse_events?: string[] }
): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/treatment/sessions/${sessionId}/complete/`, data);
  return response.data;
};

// 환자별 치료 계획 조회
export const getPatientTreatmentPlans = async (patientId: number): Promise<TreatmentPlan[]> => {
  const response = await api.get<TreatmentPlan[]>(`/treatment/plans/`, {
    params: { patient_id: patientId },
  });
  return response.data;
};
