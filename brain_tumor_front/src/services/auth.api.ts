import {api} from '@/services/api';
import type { AxiosError } from 'axios';

// 에러 응답 타입
type AuthErrorResponse = { detail?: string; message?: string };

// 에러 메시지 추출 유틸리티
const getAuthErrorMessage = (error: unknown): string => {
  const axiosError = error as AxiosError<AuthErrorResponse>;
  const status = axiosError.response?.status;
  const detail = axiosError.response?.data?.detail || axiosError.response?.data?.message;

  if (detail) return detail;

  switch (status) {
    case 400: return '잘못된 요청입니다.';
    case 401: return '아이디 또는 비밀번호가 올바르지 않습니다.';
    case 403: return '접근 권한이 없습니다.';
    case 404: return '사용자를 찾을 수 없습니다.';
    case 429: return '로그인 시도가 너무 많습니다. 잠시 후 다시 시도해주세요.';
    default: return '인증 중 오류가 발생했습니다.';
  }
};

// 인증 API 모음
export const login = async (login_id: string, password: string) => {
  try {
    const res = await api.post('/auth/login/', { login_id, password });
    return { success: true as const, data: res.data };
  } catch (error) {
    const message = getAuthErrorMessage(error);
    return { success: false as const, error: message };
  }
};

export const fetchMe = async () => {
  try {
    const res = await api.get('/auth/me/');
    return { success: true as const, data: res.data };
  } catch (error) {
    const message = getAuthErrorMessage(error);
    return { success: false as const, error: message };
  }
};

export const fetchMenu = async () => {
  try {
    const res = await api.get('/auth/menu/');
    return { success: true as const, data: res.data };
  } catch (error) {
    const message = getAuthErrorMessage(error);
    return { success: false as const, error: message };
  }
};

// 비밀번호 변경 api
export const changePassword = async (old_password: string, new_password: string) => {
  try {
    const res = await api.post('/auth/change-password/', { old_password, new_password });
    return { success: true as const, data: res.data };
  } catch (error) {
    const axiosError = error as AxiosError<{ detail?: string; old_password?: string[]; new_password?: string[] }>;
    const detail = axiosError.response?.data?.detail
      || axiosError.response?.data?.old_password?.[0]
      || axiosError.response?.data?.new_password?.[0];
    return { success: false as const, error: detail || '비밀번호 변경에 실패했습니다.' };
  }
};

// 기존 방식 호환용 (deprecated - 점진적 마이그레이션)
export const loginLegacy = (login_id: string, password: string) =>
  api.post('/auth/login/', { login_id, password });

export const fetchMeLegacy = () =>
  api.get('/auth/me/');

export const fetchMenuLegacy = () =>
  api.get('/auth/menu/');
