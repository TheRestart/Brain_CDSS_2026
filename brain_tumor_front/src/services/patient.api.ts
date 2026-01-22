import { api } from './api';
import type {
  Patient,
  PatientListResponse,
  PatientSearchParams,
  PatientCreateData,
  PatientUpdateData,
  PatientStatistics,
  PatientAlert,
  PatientAlertCreateData,
  PatientAlertUpdateData,
  ExaminationSummary,
} from '@/types/patient';

/**
 * Patient API Service
 */

// Get patient list with pagination and filters
export const getPatients = async (params?: PatientSearchParams): Promise<PatientListResponse> => {
  const response = await api.get<PatientListResponse>('/patients/', { params });
  return response.data;
};

// Get patient detail
export const getPatient = async (patientId: number): Promise<Patient> => {
  const response = await api.get<Patient>(`/patients/${patientId}/`);
  return response.data;
};

// Create new patient
export const createPatient = async (data: PatientCreateData): Promise<Patient> => {
  const response = await api.post<Patient>('/patients/', data);
  return response.data;
};

// Update patient
export const updatePatient = async (
  patientId: number,
  data: PatientUpdateData
): Promise<Patient> => {
  const response = await api.put<Patient>(`/patients/${patientId}/`, data);
  return response.data;
};

// Delete patient (soft delete)
export const deletePatient = async (patientId: number): Promise<void> => {
  await api.delete(`/patients/${patientId}/`);
};

// Search patients (autocomplete)
export const searchPatients = async (params: { q?: string; id?: number }): Promise<Patient[]> => {
  const response = await api.get<Patient[]>('/patients/search/', { params });
  return response.data;
};

// Get patient statistics
export const getPatientStatistics = async (): Promise<PatientStatistics> => {
  const response = await api.get<PatientStatistics>('/patients/statistics/');
  return response.data;
};

// =============================================================================
// 외부 환자 등록 API
// =============================================================================

// 외부 환자 생성 요청 타입
export interface CreateExternalPatientRequest {
  name: string;
  birth_date: string;  // YYYY-MM-DD
  gender: 'M' | 'F' | 'O';
  phone?: string;
  address?: string;
  institution_name?: string;
  external_patient_id?: string;
}

// 외부 환자 생성 응답 타입
export interface CreateExternalPatientResponse {
  message: string;
  patient: Patient;
}

// 외부 환자 등록 (EXTR_XXXX 형식)
export const createExternalPatient = async (
  data: CreateExternalPatientRequest
): Promise<CreateExternalPatientResponse> => {
  const response = await api.post<CreateExternalPatientResponse>(
    '/patients/create_external/',
    data
  );
  return response.data;
};

// =============================================================================
// 환자 요약 API
// =============================================================================

// 환자 요약 응답 타입
export interface PatientSummary {
  patient: Patient;
  encounters: Array<{
    id: number;
    admission_date: string;
    encounter_type: string;
    encounter_type_display?: string;
    attending_doctor_name?: string;
    status: string;
    status_display?: string;
    chief_complaint?: string;
  }>;
  ocs_history: Array<{
    id: number;
    created_at: string;
    job_type: string;
    job_role: string;
    ocs_status: string;
    ocs_status_display?: string;
  }>;
  ai_inferences: Array<{
    id: number;
    requested_at: string;
    model_code: string;
    model_name?: string;
    status: string;
    status_display?: string;
  }>;
  prescriptions: Array<{
    id: number;
    prescribed_at: string;
    status: string;
  }>;
  generated_at: string;
}

/**
 * 환자 요약서 데이터 조회 (PDF 생성용)
 */
export const getPatientSummary = async (patientId: number): Promise<PatientSummary> => {
  const response = await api.get<PatientSummary>(`/patients/${patientId}/summary/`);
  return response.data;
};

// =============================================================================
// 환자 주의사항 (Patient Alerts) API
// =============================================================================

/**
 * 환자의 주의사항 목록 조회
 * GET /api/patients/{patientId}/alerts/
 */
export const getPatientAlerts = async (patientId: number): Promise<PatientAlert[]> => {
  const response = await api.get<PatientAlert[]>(`/patients/${patientId}/alerts/`);
  return response.data;
};

/**
 * 환자 주의사항 생성
 * POST /api/patients/{patientId}/alerts/
 */
export const createPatientAlert = async (
  patientId: number,
  data: PatientAlertCreateData
): Promise<PatientAlert> => {
  const response = await api.post<PatientAlert>(`/patients/${patientId}/alerts/`, data);
  return response.data;
};

/**
 * 환자 주의사항 수정
 * PATCH /api/patients/{patientId}/alerts/{alertId}/
 */
export const updatePatientAlert = async (
  patientId: number,
  alertId: number,
  data: PatientAlertUpdateData
): Promise<PatientAlert> => {
  const response = await api.patch<PatientAlert>(
    `/patients/${patientId}/alerts/${alertId}/`,
    data
  );
  return response.data;
};

/**
 * 환자 주의사항 삭제
 * DELETE /api/patients/{patientId}/alerts/{alertId}/
 */
export const deletePatientAlert = async (
  patientId: number,
  alertId: number
): Promise<void> => {
  await api.delete(`/patients/${patientId}/alerts/${alertId}/`);
};

// =============================================================================
// 진찰 요약 (Examination Summary) API
// =============================================================================

/**
 * 환자 진찰 요약 조회
 * GET /api/patients/{patientId}/examination-summary/
 */
export const getExaminationSummary = async (patientId: number): Promise<ExaminationSummary> => {
  const response = await api.get<ExaminationSummary>(`/patients/${patientId}/examination-summary/`);
  return response.data;
};
