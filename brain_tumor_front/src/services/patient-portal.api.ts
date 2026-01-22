/**
 * Patient Portal API Service
 * - 환자 본인 정보 조회 (PATIENT 역할 전용)
 */
import { api } from './api';
import type {
  MyPatientInfo,
  MyEncounter,
  MyEncounterListResponse,
  MyOCSItem,
  MyOCSListResponse,
  MyAlert,
} from '@/types/patient-portal';

// 배열 또는 paginated 응답을 배열로 정규화
type ListResponse<T> = T[] | { results: T[]; count?: number };
const normalizeList = <T>(data: ListResponse<T>): T[] => {
  return Array.isArray(data) ? data : data?.results || [];
};

/**
 * 환자 본인 정보 조회
 * GET /api/patients/me/
 */
export const getMyPatientInfo = async (): Promise<MyPatientInfo> => {
  const response = await api.get<MyPatientInfo>('/patients/me/');
  return response.data;
};

/**
 * 환자 본인 진료 이력 조회
 * GET /api/patients/me/encounters/
 * @param params.status - 진료 상태 필터 (scheduled, in_progress, completed, cancelled)
 * @param params.page - 페이지 번호
 * @param params.page_size - 페이지 크기 (기본 10, 최대 50)
 */
export const getMyEncounters = async (params?: {
  status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  page?: number;
  page_size?: number;
}): Promise<MyEncounterListResponse> => {
  const response = await api.get<MyEncounterListResponse>('/patients/me/encounters/', { params });
  return response.data;
};

/**
 * 오늘 예약된 진료 조회
 */
export const getMyTodaySchedule = async (): Promise<MyEncounter[]> => {
  const response = await getMyEncounters({ status: 'scheduled', page_size: 50 });
  const today = new Date().toISOString().split('T')[0];
  return (response.results || []).filter(enc =>
    enc.admission_date && enc.admission_date.startsWith(today)
  );
};

/**
 * 환자 본인 검사 결과 조회
 * GET /api/patients/me/ocs/
 * @param params.job_role - 검사 종류 필터 (RIS, LIS)
 * @param params.page - 페이지 번호
 * @param params.page_size - 페이지 크기 (기본 10, 최대 50)
 */
export const getMyOCS = async (params?: {
  job_role?: 'RIS' | 'LIS';
  page?: number;
  page_size?: number;
}): Promise<MyOCSListResponse> => {
  const response = await api.get<MyOCSListResponse>('/patients/me/ocs/', { params });
  return response.data;
};

/**
 * 환자 본인 검사 결과 전체 조회 (배열)
 */
export const getMyOCSList = async (job_role?: 'RIS' | 'LIS'): Promise<MyOCSItem[]> => {
  const response = await getMyOCS({ job_role, page_size: 50 });
  return response.results || [];
};

/**
 * 환자 본인 주의사항 조회
 * GET /api/patients/me/alerts/
 */
export const getMyAlerts = async (): Promise<MyAlert[]> => {
  const response = await api.get<ListResponse<MyAlert>>('/patients/me/alerts/');
  return normalizeList(response.data);
};
