import { api } from './api';
import type {
  DoctorScheduleListItem,
  DoctorScheduleDetail,
  DoctorScheduleCreateRequest,
  DoctorScheduleUpdateRequest,
  CalendarScheduleItem,
  ScheduleCalendarParams,
  UnifiedCalendarResponse,
  UnifiedCalendarParams,
  SharedScheduleListItem,
  SharedScheduleCreateRequest,
  SharedScheduleUpdateRequest,
  PersonalScheduleListItem,
  PersonalScheduleCreateRequest,
  PersonalScheduleUpdateRequest,
} from '@/types/schedule';

/**
 * 일정 API Service
 */

// =============================================================================
// 통합 캘린더 API (Dashboard/진료탭용)
// =============================================================================

// 통합 캘린더 조회
export const getUnifiedCalendar = async (
  params: UnifiedCalendarParams
): Promise<UnifiedCalendarResponse> => {
  const response = await api.get<UnifiedCalendarResponse>(
    '/schedules/calendar/unified/',
    { params }
  );
  return response.data;
};

// =============================================================================
// 공유 일정 API (Admin 전용)
// =============================================================================

// 공유 일정 목록 조회
export const getSharedScheduleList = async (
  visibility?: string
): Promise<SharedScheduleListItem[]> => {
  const params = visibility ? { visibility } : {};
  const response = await api.get<SharedScheduleListItem[]>('/schedules/shared/', { params });
  return response.data;
};

// 공유 일정 생성
export const createSharedSchedule = async (
  data: SharedScheduleCreateRequest
): Promise<SharedScheduleListItem> => {
  const response = await api.post<SharedScheduleListItem>('/schedules/shared/', data);
  return response.data;
};

// 공유 일정 수정
export const updateSharedSchedule = async (
  scheduleId: number,
  data: SharedScheduleUpdateRequest
): Promise<SharedScheduleListItem> => {
  const response = await api.patch<SharedScheduleListItem>(
    `/schedules/shared/${scheduleId}/`,
    data
  );
  return response.data;
};

// 공유 일정 삭제
export const deleteSharedSchedule = async (scheduleId: number): Promise<void> => {
  await api.delete(`/schedules/shared/${scheduleId}/`);
};

// =============================================================================
// 개인 일정 API (모든 사용자)
// =============================================================================

// 개인 일정 목록 조회
export const getPersonalScheduleList = async (): Promise<PersonalScheduleListItem[]> => {
  const response = await api.get<PersonalScheduleListItem[]>('/schedules/personal/');
  return response.data;
};

// 개인 일정 생성
export const createPersonalSchedule = async (
  data: PersonalScheduleCreateRequest
): Promise<PersonalScheduleListItem> => {
  const response = await api.post<PersonalScheduleListItem>('/schedules/personal/', data);
  return response.data;
};

// 개인 일정 수정
export const updatePersonalSchedule = async (
  scheduleId: number,
  data: PersonalScheduleUpdateRequest
): Promise<PersonalScheduleListItem> => {
  const response = await api.patch<PersonalScheduleListItem>(
    `/schedules/personal/${scheduleId}/`,
    data
  );
  return response.data;
};

// 개인 일정 삭제
export const deletePersonalSchedule = async (scheduleId: number): Promise<void> => {
  await api.delete(`/schedules/personal/${scheduleId}/`);
};

// =============================================================================
// 기존 의사 일정 API (하위 호환성)
// =============================================================================

// 일정 목록 조회
export const getScheduleList = async (): Promise<DoctorScheduleListItem[]> => {
  const response = await api.get<DoctorScheduleListItem[]>('/schedules/doctor/');
  return response.data;
};

// 일정 상세 조회
export const getSchedule = async (scheduleId: number): Promise<DoctorScheduleDetail> => {
  const response = await api.get<DoctorScheduleDetail>(`/schedules/doctor/${scheduleId}/`);
  return response.data;
};

// 일정 생성
export const createSchedule = async (
  data: DoctorScheduleCreateRequest
): Promise<DoctorScheduleDetail> => {
  const response = await api.post<DoctorScheduleDetail>('/schedules/doctor/', data);
  return response.data;
};

// 일정 수정
export const updateSchedule = async (
  scheduleId: number,
  data: DoctorScheduleUpdateRequest
): Promise<DoctorScheduleDetail> => {
  const response = await api.patch<DoctorScheduleDetail>(
    `/schedules/doctor/${scheduleId}/`,
    data
  );
  return response.data;
};

// 일정 삭제
export const deleteSchedule = async (scheduleId: number): Promise<void> => {
  await api.delete(`/schedules/doctor/${scheduleId}/`);
};

// 캘린더 조회 (월별) - 기존 호환
export const getScheduleCalendar = async (
  params: ScheduleCalendarParams
): Promise<CalendarScheduleItem[]> => {
  const response = await api.get<CalendarScheduleItem[]>(
    '/schedules/doctor/calendar/',
    { params }
  );
  return response.data;
};

// 오늘 일정 조회
export const getTodaySchedules = async (): Promise<DoctorScheduleListItem[]> => {
  const response = await api.get<DoctorScheduleListItem[]>('/schedules/doctor/today/');
  return response.data;
};

// 이번 주 일정 조회
export const getThisWeekSchedules = async (): Promise<DoctorScheduleListItem[]> => {
  const response = await api.get<DoctorScheduleListItem[]>('/schedules/doctor/this-week/');
  return response.data;
};
