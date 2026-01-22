import type { User } from '@/types/user';
import type { PaginatedResponse } from '@/types/pagination'
import { api } from './api';

// 사용자 목록 조회 파라미터
export interface UserListParams {
  search?: string;
  role__code?: string;
  
  is_active?: boolean;
  page?: number;
  size?: number;
}

/* 사용자 생성 */
export interface CreateUserPayload {
  login_id: string;
  // password: string;
  name: string;
  role: string; // role code (ADMIN, DOCTOR ...)
  email: string;
  is_active: boolean;
  profile : {
    phoneMobile: string | null;
    phoneOffice: string | null;
    birthDate: string | null;
    hireDate: string | null;
    departmentId: number | null;
    title: string | null;
  }
}

/* 사용자 수정 */
export interface UpdateUserPayload {
  name?: string;
  role?: string;
  is_active?: boolean;
}

// API 함수 모음
/* 사용자 목록 조회 api */
export const fetchUsers = async (params?: UserListParams) => {
    const res = await api.get<PaginatedResponse<User>>("/users/", {
        params,
    });
    return res.data;
};

/* 활성 / 비활성 토글 */
export const toggleUserActive = async (id: number) => {
  const res = await api.patch(`/users/${id}/toggle-active/`);
  return res.data;
};

/* 잠금 해제 */
export const unlockUser = async (id: number) => {
  const res = await api.patch(`/users/${id}/unlock/`);
  return res.data;
};

/* 사용자 단건 조회 (상세) */
export const fetchUserDetail = async (id: number) => {
  const res = await api.get<User>(`/users/${id}/`);
  return res.data;
};

/* 사용자 생성 */
export const createUser = async (payload: CreateUserPayload) => {
  const res = await api.post<User>("/users/", payload);
  return res.data;
}

/* 사용자 수정 */
export const updateUser = async (
  id: number,
  payload: UpdateUserPayload
) => {
  const res = await api.put<User>(`/users/${id}/`, payload);
  return res.data;
};

/* 사용자 삭제 */
export const deleteUser = async (id: number) => {
  const res = await api.delete(`/users/${id}/`);
  return res.data;
};

// ========== 외부기관 (EXTERNAL) API ==========

/* 외부기관 정보 타입 */
export interface ExternalInstitution {
  id: number;
  name: string;  // 기관명
  code: string;  // 기관코드
  email: string;
}

/* 외부기관 목록 조회 */
export const fetchExternalInstitutions = async (): Promise<ExternalInstitution[]> => {
  const res = await api.get<ExternalInstitution[]>('/users/external-institutions/');
  return res.data;
};
