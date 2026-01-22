import { api } from './api';
import type {
  OCSListItem,
  OCSDetail,
  OCSListResponse,
  OCSSearchParams,
  OCSCreateData,
  OCSUpdateData,
  OCSSaveResultRequest,
  OCSSubmitResultRequest,
  OCSConfirmRequest,
  OCSCancelRequest,
  OCSHistory,
} from '@/types/ocs';

/**
 * OCS (Order Communication System) API Service
 */

// =============================================================================
// 기본 CRUD
// =============================================================================

// OCS 목록 조회
export const getOCSList = async (params?: OCSSearchParams): Promise<OCSListResponse> => {
  const response = await api.get<OCSListResponse>('/ocs/', { params });
  return response.data;
};

// OCS 상세 조회
export const getOCS = async (ocsId: number): Promise<OCSDetail> => {
  const response = await api.get<OCSDetail>(`/ocs/${ocsId}/`);
  return response.data;
};

// OCS 생성
export const createOCS = async (data: OCSCreateData): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>('/ocs/', data);
  return response.data;
};

// OCS 수정
export const updateOCS = async (ocsId: number, data: OCSUpdateData): Promise<OCSDetail> => {
  const response = await api.patch<OCSDetail>(`/ocs/${ocsId}/`, data);
  return response.data;
};

// OCS 삭제 (Soft Delete)
export const deleteOCS = async (ocsId: number): Promise<void> => {
  await api.delete(`/ocs/${ocsId}/`);
};

// =============================================================================
// 추가 조회 API
// =============================================================================

// 환자별 OCS 목록
export const getOCSByPatient = async (patientId: number): Promise<OCSListItem[]> => {
  const response = await api.get<OCSListItem[]>('/ocs/by_patient/', {
    params: { patient_id: patientId },
  });
  return response.data;
};

// =============================================================================
// 상태 변경 API
// =============================================================================

// 오더 접수 (ORDERED → ACCEPTED)
export const acceptOCS = async (ocsId: number): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>(`/ocs/${ocsId}/accept/`);
  return response.data;
};

// 작업 시작 (ACCEPTED → IN_PROGRESS)
export const startOCS = async (ocsId: number): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>(`/ocs/${ocsId}/start/`);
  return response.data;
};

// 결과 임시 저장
export const saveOCSResult = async (
  ocsId: number,
  data: OCSSaveResultRequest
): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>(`/ocs/${ocsId}/save_result/`, data);
  return response.data;
};

// 결과 제출 (IN_PROGRESS → RESULT_READY)
export const submitOCSResult = async (
  ocsId: number,
  data: OCSSubmitResultRequest
): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>(`/ocs/${ocsId}/submit_result/`, data);
  return response.data;
};

// 확정 (RESULT_READY → CONFIRMED)
export const confirmOCS = async (ocsId: number, data: OCSConfirmRequest): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>(`/ocs/${ocsId}/confirm/`, data);
  return response.data;
};

// 취소
export const cancelOCS = async (ocsId: number, data?: OCSCancelRequest): Promise<OCSDetail> => {
  const response = await api.post<OCSDetail>(`/ocs/${ocsId}/cancel/`, data || {});
  return response.data;
};

// =============================================================================
// 이력 조회 API
// =============================================================================

// OCS 이력 조회
export const getOCSHistory = async (ocsId: number): Promise<OCSHistory[]> => {
  const response = await api.get<OCSHistory[]>(`/ocs/${ocsId}/history/`);
  return response.data;
};

// =============================================================================
// LIS 파일 업로드 API
// =============================================================================

// 외부 기관 정보 타입
export interface LISExternalSourceData {
  // 기관 정보
  institution_name?: string;
  institution_code?: string;
  institution_contact?: string;
  institution_address?: string;
  // 검사 수행 정보
  performed_date?: string;
  performed_by?: string;
  specimen_collected_date?: string;
  specimen_type?: string;
  // 품질/인증 정보
  lab_certification_number?: string;
  qc_status?: string;
  is_verified?: string;
}

// LIS 파일 업로드 응답 타입
export interface LISUploadResponse {
  message: string;
  file: {
    name: string;
    size: number;
    content_type: string;
    uploaded_at: string;
    uploaded_by: number;
    storage_path?: string;  // CDSS_STORAGE 상대 경로
    full_path?: string;     // 절대 경로 (디버깅용)
  };
  external_source: {
    institution: {
      name: string | null;
      code: string | null;
      contact: string | null;
      address: string | null;
    };
    execution: {
      performed_date: string | null;
      performed_by: string | null;
      specimen_collected_date: string | null;
      specimen_type: string | null;
    };
    quality: {
      lab_certification_number: string | null;
      qc_status: string | null;
      is_verified: boolean;
    };
  };
  ocs: OCSDetail;
}

// LIS 파일 업로드 (기존 OCS에 파일 추가)
export const uploadLISFile = async (
  ocsId: number,
  file: File,
  externalData?: LISExternalSourceData
): Promise<LISUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  // 외부 기관 정보 추가
  if (externalData) {
    Object.entries(externalData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });
  }

  const response = await api.post<LISUploadResponse>(
    `/ocs/${ocsId}/upload_lis_file/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// 외부 기관 LIS 데이터 생성 요청 타입
export interface CreateExternalLISRequest extends LISExternalSourceData {
  patient_id: number;
  job_type?: string;
  priority?: 'urgent' | 'normal';
  summary?: string;
  interpretation?: string;
}

// 외부 기관 LIS 데이터 생성 응답 타입
export interface CreateExternalLISResponse {
  message: string;
  ocs_id: string;  // extr_0001 형식
  file?: {
    name: string;
    size: number;
    content_type: string;
    uploaded_at: string;
    uploaded_by: number;
  } | null;
  external_source: LISUploadResponse['external_source'];
  ocs: OCSDetail;
}

// 외부 기관 LIS 데이터 생성 (새 OCS 생성 + 파일 업로드 선택)
export const createExternalLIS = async (
  file: File | null,
  data: CreateExternalLISRequest
): Promise<CreateExternalLISResponse> => {
  const formData = new FormData();

  // 파일이 있으면 추가
  if (file) {
    formData.append('file', file);
  }

  // 모든 데이터 추가
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      formData.append(key, String(value));
    }
  });

  const response = await api.post<CreateExternalLISResponse>(
    '/ocs/create_external_lis/',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// =============================================================================
// RIS 파일 업로드 API
// =============================================================================

// RIS 외부 기관 정보 타입
export interface RISExternalSourceData {
  // 기관 정보
  institution_name?: string;
  institution_code?: string;
  institution_contact?: string;
  institution_address?: string;
  // 촬영 수행 정보
  performed_date?: string;
  performed_by?: string;
  modality?: string;
  body_part?: string;
  // 품질/인증 정보
  equipment_certification_number?: string;
  qc_status?: string;
  is_verified?: string;
}

// RIS 파일 업로드 응답 타입
export interface RISUploadResponse {
  message: string;
  file: {
    name: string;
    size: number;
    content_type: string;
    uploaded_at: string;
    uploaded_by: number;
    storage_path?: string;  // CDSS_STORAGE 상대 경로
    full_path?: string;     // 절대 경로 (디버깅용)
  };
  external_source: {
    institution: {
      name: string | null;
      code: string | null;
      contact: string | null;
      address: string | null;
    };
    execution: {
      performed_date: string | null;
      performed_by: string | null;
      modality: string | null;
      body_part: string | null;
    };
    quality: {
      equipment_certification_number: string | null;
      qc_status: string | null;
      is_verified: boolean;
    };
  };
  ocs: OCSDetail;
}

// RIS 파일 업로드 (기존 OCS에 파일 추가)
export const uploadRISFile = async (
  ocsId: number,
  file: File,
  externalData?: RISExternalSourceData
): Promise<RISUploadResponse> => {
  const formData = new FormData();
  formData.append('file', file);

  // 외부 기관 정보 추가
  if (externalData) {
    Object.entries(externalData).forEach(([key, value]) => {
      if (value !== undefined && value !== '') {
        formData.append(key, value);
      }
    });
  }

  const response = await api.post<RISUploadResponse>(
    `/ocs/${ocsId}/upload_ris_file/`,
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// 외부 기관 RIS 데이터 생성 요청 타입
export interface CreateExternalRISRequest extends RISExternalSourceData {
  patient_id: number;
  job_type?: string;
  priority?: 'urgent' | 'normal';
  summary?: string;
  interpretation?: string;
}

// 외부 기관 RIS 데이터 생성 응답 타입
export interface CreateExternalRISResponse {
  message: string;
  ocs_id: string;  // risx_0001 형식
  file?: {
    name: string;
    size: number;
    content_type: string;
    uploaded_at: string;
    uploaded_by: number;
  } | null;
  external_source: RISUploadResponse['external_source'];
  ocs: OCSDetail;
}

// 외부 기관 RIS 데이터 생성 (새 OCS 생성 + 파일 업로드 선택)
export const createExternalRIS = async (
  file: File | null,
  data: CreateExternalRISRequest
): Promise<CreateExternalRISResponse> => {
  const formData = new FormData();

  // 파일이 있으면 추가
  if (file) {
    formData.append('file', file);
  }

  // 모든 데이터 추가
  Object.entries(data).forEach(([key, value]) => {
    if (value !== undefined && value !== '') {
      formData.append(key, String(value));
    }
  });

  const response = await api.post<CreateExternalRISResponse>(
    '/ocs/create_external_ris/',
    formData,
    {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    }
  );
  return response.data;
};

// =============================================================================
// OCS 처리 현황 API
// =============================================================================

// OCS 처리 현황 - 부서별 상태 타입
export type OCSJobStats = {
  ordered: number;      // 오더 생성
  accepted: number;     // 접수 완료
  in_progress: number;  // 진행 중
  result_ready: number; // 결과 대기
  confirmed: number;    // 확정 완료
  cancelled: number;    // 취소됨
  total_today: number;  // 오늘 생성된 건수
};

// OCS 처리 현황 응답 타입
export type OCSProcessStatus = {
  ris: OCSJobStats;
  lis: OCSJobStats;
  combined: {
    total_ordered: number;
    total_accepted: number;
    total_in_progress: number;
    total_result_ready: number;
    total_confirmed: number;
    total_cancelled: number;
    total_today: number;
  };
};

// OCS 처리 현황 조회
export const getOCSProcessStatus = async (): Promise<OCSProcessStatus> => {
  const response = await api.get<OCSProcessStatus>('/ocs/process-status/');
  return response.data;
};

// =============================================================================
// 사용자 로그인 현황 API
// =============================================================================

// 사용자 정보 타입
export type UserLoginInfo = {
  id: number;
  login_id: string;
  name: string;
  email: string | null;
  is_online: boolean;
  last_activity: string | null;
  last_activity_text: string;
  last_login_ip: string | null;
  created_at: string | null;
};

// 권한별 사용자 현황 타입
export type RoleLoginStatus = {
  online_count: number;
  total_count: number;
  users: UserLoginInfo[];
};

// 사용자 로그인 현황 응답 타입
export type UserLoginStatus = {
  ris: RoleLoginStatus;
  lis: RoleLoginStatus;
};

// 사용자 로그인 현황 조회
export const getUserLoginStatus = async (): Promise<UserLoginStatus> => {
  const response = await api.get<UserLoginStatus>('/ocs/user-login-status/');
  return response.data;
};

// =============================================================================
// localStorage 유틸리티
// =============================================================================

const STORAGE_PREFIX = 'CDSS_LOCAL_STORAGE';

// localStorage 키 생성
export const getLocalStorageKey = (
  jobRole: string,
  ocsId: string,
  type: 'request' | 'result' | 'files' | 'meta'
): string => {
  const role = type === 'request' ? 'DOCTOR' : jobRole;
  return `${STORAGE_PREFIX}:${role}:${ocsId}:${type}`;
};

// Draft 저장 (quota 초과 처리 포함)
export const saveDraft = <T>(key: string, data: T): boolean => {
  try {
    localStorage.setItem(key, JSON.stringify(data));
    return true;
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      console.warn('localStorage 용량 초과:', key);
    } else {
      console.error('Draft 저장 실패:', error);
    }
    return false;
  }
};

// Draft 조회 (JSON 파싱 에러 처리 포함)
export const getDraft = <T>(key: string, fallback: T | null = null): T | null => {
  const data = localStorage.getItem(key);
  if (!data) return fallback;
  try {
    return JSON.parse(data);
  } catch (error) {
    console.error('Draft JSON 파싱 실패:', key, error);
    localStorage.removeItem(key);  // 손상된 데이터 제거
    return fallback;
  }
};

// Draft 삭제
export const removeDraft = (key: string): void => {
  localStorage.removeItem(key);
};

// OCS 관련 모든 Draft 삭제
export const clearOCSDrafts = (jobRole: string, ocsId: string): void => {
  const types: ('request' | 'result' | 'files' | 'meta')[] = ['request', 'result', 'files', 'meta'];
  types.forEach(type => {
    const key = getLocalStorageKey(jobRole, ocsId, type);
    removeDraft(key);
  });
};

// =============================================================================
// 외부환자 + OCS 통합 생성 API
// =============================================================================

// 외부환자+OCS 생성 요청 타입
export interface ExternalPatientOCSData {
  patient: {
    name: string;
    birth_date: string;
    gender: 'M' | 'F' | 'O';
    institution_id: number;
  };
  ocs: {
    job_role: string;
    job_type: string;
    priority?: string;
    encounter_id?: number | null;
    doctor_request?: {
      clinical_info?: string;
      request_detail?: string;
      special_instruction?: string;
    };
  };
}

// 외부환자+OCS 생성 응답 타입
export interface ExternalPatientOCSResponse {
  message: string;
  patient: {
    id: number;
    patient_number: string;
    name: string;
    birth_date: string;
    gender: string;
    is_external: boolean;
    external_institution: {
      id: number;
      name: string;
      code: string;
    };
  };
  ocs: OCSDetail;
}

// 외부환자 등록 + OCS 생성
export const createExternalPatientOCS = async (
  data: ExternalPatientOCSData
): Promise<ExternalPatientOCSResponse> => {
  const response = await api.post<ExternalPatientOCSResponse>(
    '/ocs/external-patient-ocs/',
    data
  );
  return response.data;
};
