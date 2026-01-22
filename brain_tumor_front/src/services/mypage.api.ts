/**
 * My Page API Service
 * - 내 정보 조회/수정
 * - 비밀번호 변경
 */
import { api } from './api';
import type { User, MyProfileUpdateForm, ChangePasswordForm } from '@/types/user';

/**
 * 내 정보 조회
 * GET /api/users/me/
 */
export const getMyProfile = async (): Promise<User> => {
  const response = await api.get<User>('/users/me/');
  return response.data;
};

/**
 * 내 정보 수정
 * PUT /api/users/me/
 */
export const updateMyProfile = async (data: MyProfileUpdateForm): Promise<User> => {
  const response = await api.put<User>('/users/me/', data);
  return response.data;
};

/**
 * 비밀번호 변경
 * POST /api/users/me/change-password/
 */
export const changeMyPassword = async (data: ChangePasswordForm): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>('/users/me/change-password/', data);
  return response.data;
};
