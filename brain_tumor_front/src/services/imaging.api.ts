import { api } from './api';
import type {
  ImagingStudy,
  ImagingReport,
  ImagingStudyListResponse,
  ImagingStudySearchParams,
  ImagingStudyCreateData,
  ImagingStudyUpdateData,
  ImagingReportCreateData,
  ImagingReportUpdateData,
  ImagingStudyDetailResponse,
} from '@/types/imaging';

// ============================================
// Imaging Study APIs
// ============================================

/**
 * 영상 검사 목록 조회
 */
export const getImagingStudies = async (params?: ImagingStudySearchParams): Promise<ImagingStudyListResponse> => {
  const response = await api.get<ImagingStudyListResponse>('/imaging/studies/', { params });
  return response.data;
};

/**
 * 영상 검사 상세 조회
 */
export const getImagingStudy = async (studyId: number): Promise<ImagingStudyDetailResponse> => {
  const response = await api.get<ImagingStudyDetailResponse>(`/imaging/studies/${studyId}/`);
  return response.data;
};

/**
 * 영상 검사 오더 생성
 */
export const createImagingStudy = async (data: ImagingStudyCreateData): Promise<ImagingStudy> => {
  const response = await api.post<ImagingStudy>('/imaging/studies/', data);
  return response.data;
};

/**
 * 영상 검사 정보 수정
 */
export const updateImagingStudy = async (
  studyId: number,
  data: ImagingStudyUpdateData
): Promise<ImagingStudy> => {
  const response = await api.patch<ImagingStudy>(`/imaging/studies/${studyId}/`, data);
  return response.data;
};

/**
 * 영상 검사 삭제 (Soft Delete)
 */
export const deleteImagingStudy = async (studyId: number): Promise<void> => {
  await api.delete(`/imaging/studies/${studyId}/`);
};

/**
 * 영상 검사 완료 처리
 */
export const completeImagingStudy = async (studyId: number): Promise<ImagingStudy> => {
  const response = await api.post<ImagingStudy>(`/imaging/studies/${studyId}/complete/`);
  return response.data;
};

/**
 * 영상 검사 취소
 */
export const cancelImagingStudy = async (studyId: number): Promise<ImagingStudy> => {
  const response = await api.post<ImagingStudy>(`/imaging/studies/${studyId}/cancel/`);
  return response.data;
};

/**
 * RIS 워크리스트 조회 (검사 대기 목록)
 */
export const getImagingWorklist = async (params?: ImagingStudySearchParams): Promise<ImagingStudyListResponse> => {
  const response = await api.get<ImagingStudyListResponse>('/imaging/studies/worklist/', { params });
  return response.data;
};

/**
 * 환자별 영상 히스토리 조회
 */
export const getPatientImagingHistory = async (patientId: number, params?: { page?: number; page_size?: number }): Promise<ImagingStudyListResponse> => {
  const response = await api.get<ImagingStudyListResponse>('/imaging/studies/patient-history/', {
    params: { patient_id: patientId, ...params }
  });
  return response.data;
};

// ============================================
// Imaging Report APIs
// ============================================

/**
 * 판독문 작성
 */
export const createImagingReport = async (data: ImagingReportCreateData): Promise<ImagingReport> => {
  const response = await api.post<ImagingReport>('/imaging/reports/', data);
  return response.data;
};

/**
 * 판독문 수정
 */
export const updateImagingReport = async (
  reportId: number,
  data: ImagingReportUpdateData
): Promise<ImagingReport> => {
  const response = await api.patch<ImagingReport>(`/imaging/reports/${reportId}/`, data);
  return response.data;
};

/**
 * 판독문 서명
 */
export const signImagingReport = async (reportId: number): Promise<ImagingReport> => {
  const response = await api.post<ImagingReport>(`/imaging/reports/${reportId}/sign/`);
  return response.data;
};
