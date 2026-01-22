import { api } from './api';

// =============================================================================
// Follow-up API Types (백엔드 모델과 일치)
// =============================================================================

export interface FollowUp {
  id: number;
  patient: number;
  patient_name: string;
  patient_number: string;
  treatment_plan: number | null;
  related_ocs: number | null;
  followup_date: string;
  followup_type: 'routine' | 'symptom_based' | 'post_treatment' | 'emergency';
  followup_type_display: string;
  clinical_status: 'stable' | 'improved' | 'deteriorated' | 'recurrence' | 'progression' | 'remission';
  clinical_status_display: string;
  symptoms: string[];
  kps_score: number | null;
  ecog_score: number | null;
  vitals: Record<string, unknown>;
  weight_kg: number | null;
  note: string;
  next_followup_date: string | null;
  recorded_by: number;
  recorded_by_name: string;
  created_at: string;
  updated_at: string;
}

// 경과 추적 생성 데이터 (백엔드 필드명과 일치)
export interface FollowUpCreateData {
  patient: number;              // patient_id → patient
  treatment_plan?: number;      // treatment_plan_id → treatment_plan
  related_ocs?: number;
  followup_date: string;
  followup_type: string;
  clinical_status: string;
  symptoms?: string[];
  kps_score?: number;
  ecog_score?: number;
  vitals?: Record<string, unknown>;
  weight_kg?: number;
  note?: string;
  next_followup_date?: string;
}

// =============================================================================
// API Functions
// =============================================================================

// 경과 기록 목록
export const getFollowUps = async (params?: {
  patient_id?: number;
  clinical_status?: string;
  followup_type?: string;
}): Promise<FollowUp[]> => {
  const response = await api.get<FollowUp[]>('/followup/', { params });
  return response.data;
};

// 경과 기록 상세
export const getFollowUp = async (id: number): Promise<FollowUp> => {
  const response = await api.get<FollowUp>(`/followup/${id}/`);
  return response.data;
};

// 경과 기록 생성
export const createFollowUp = async (data: FollowUpCreateData): Promise<FollowUp> => {
  const response = await api.post<FollowUp>('/followup/', data);
  return response.data;
};

// 경과 기록 수정
export const updateFollowUp = async (
  id: number,
  data: Partial<FollowUpCreateData>
): Promise<FollowUp> => {
  const response = await api.patch<FollowUp>(`/followup/${id}/`, data);
  return response.data;
};

// 경과 기록 삭제
export const deleteFollowUp = async (id: number): Promise<void> => {
  await api.delete(`/followup/${id}/`);
};

// 환자별 경과 기록 조회
export const getPatientFollowUps = async (patientId: number): Promise<FollowUp[]> => {
  const response = await api.get<FollowUp[]>('/followup/', {
    params: { patient_id: patientId },
  });
  return response.data;
};
