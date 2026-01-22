/**
 * 일정 관련 타입 정의
 */

// =============================================================================
// 일정 유형 및 색상
// =============================================================================

// 일정 유형 (공유/개인 공통)
export type ScheduleType =
  | 'meeting'
  | 'leave'
  | 'training'
  | 'personal'
  | 'announcement'
  | 'event'
  | 'other'
  | 'patient';

// 일정 유형 라벨
export const SCHEDULE_TYPE_LABELS: Record<ScheduleType, string> = {
  meeting: '회의',
  leave: '휴가',
  training: '교육',
  personal: '개인',
  announcement: '공지',
  event: '행사',
  other: '기타',
  patient: '환자 진료',
};

// 일정 유형별 기본 색상
export const SCHEDULE_TYPE_COLORS: Record<ScheduleType, string> = {
  meeting: '#5b8def',       // 파랑
  leave: '#e56b6f',         // 빨강
  training: '#f2a65a',      // 주황
  personal: '#5fb3a2',      // 청록
  announcement: '#8b5cf6',  // 보라
  event: '#ec4899',         // 핑크
  other: '#9ca3af',         // 회색
  patient: '#f59e0b',       // 노랑
};

// =============================================================================
// 공유 일정 표시 대상 (권한)
// =============================================================================
export type ScheduleVisibility =
  | 'ALL'
  | 'ADMIN'
  | 'DOCTOR'
  | 'NURSE'
  | 'LIS'
  | 'RIS'
  | 'PATIENT'
  | 'EXTERNAL';

export const VISIBILITY_LABELS: Record<ScheduleVisibility, string> = {
  ALL: '전체',
  ADMIN: '관리자',
  DOCTOR: '의사',
  NURSE: '간호사',
  LIS: '검사실',
  RIS: '영상실',
  PATIENT: '환자',
  EXTERNAL: '외부기관',
};

// =============================================================================
// 일정 Scope (통합 캘린더용)
// =============================================================================
export type ScheduleScope = 'shared' | 'personal' | 'patient';

export const SCOPE_LABELS: Record<ScheduleScope, string> = {
  shared: '공유 일정',
  personal: '개인 일정',
  patient: '환자 일정',
};

export const SCOPE_COLORS: Record<ScheduleScope, string> = {
  shared: '#5b8def',    // 파랑 (공유)
  personal: '#5fb3a2',  // 청록 (개인)
  patient: '#f59e0b',   // 노랑 (환자)
};

// 일정 목록 아이템
export interface DoctorScheduleListItem {
  id: number;
  title: string;
  schedule_type: ScheduleType;
  schedule_type_display: string;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  color: string;
}

// 일정 상세
export interface DoctorScheduleDetail extends DoctorScheduleListItem {
  description: string;
  doctor: number;
  doctor_name: string;
  created_at: string;
  updated_at: string;
}

// 일정 생성 요청
export interface DoctorScheduleCreateRequest {
  title: string;
  schedule_type: ScheduleType;
  start_datetime: string;
  end_datetime: string;
  all_day?: boolean;
  description?: string;
  color?: string;
}

// 일정 수정 요청
export interface DoctorScheduleUpdateRequest {
  title?: string;
  schedule_type?: ScheduleType;
  start_datetime?: string;
  end_datetime?: string;
  all_day?: boolean;
  description?: string;
  color?: string;
}

// 캘린더용 일정 아이템 (기존 호환)
export interface CalendarScheduleItem {
  id: number;
  title: string;
  schedule_type: ScheduleType;
  start: string;
  end: string;
  all_day: boolean;
  color: string;
}

// 캘린더 조회 파라미터
export interface ScheduleCalendarParams {
  year: number;
  month: number;
}

// =============================================================================
// 통합 캘린더용 타입
// =============================================================================

// 통합 캘린더 일정 아이템
export interface UnifiedScheduleItem {
  id: number;
  title: string;
  schedule_type: ScheduleType;
  schedule_type_display: string;
  start: string;
  end: string;
  all_day: boolean;
  color: string;
  scope: ScheduleScope;
  visibility?: ScheduleVisibility;  // 공유 일정만
  patient_id?: number;              // 환자 일정만
}

// 통합 캘린더 API 응답
export interface UnifiedCalendarResponse {
  shared: UnifiedScheduleItem[];
  personal: UnifiedScheduleItem[];
  patient: UnifiedScheduleItem[];
}

// 통합 캘린더 조회 파라미터
export interface UnifiedCalendarParams {
  year: number;
  month: number;
  patient_id?: number;  // 진료탭용 (선택)
}

// =============================================================================
// 공유 일정 타입 (Admin 관리용)
// =============================================================================
export interface SharedScheduleListItem {
  id: number;
  title: string;
  schedule_type: ScheduleType;
  schedule_type_display: string;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  color: string;
  visibility: ScheduleVisibility;
  visibility_display: string;
  created_by: number;
  created_by_name: string;
  created_at: string;
}

export interface SharedScheduleCreateRequest {
  title: string;
  schedule_type: ScheduleType;
  start_datetime: string;
  end_datetime: string;
  all_day?: boolean;
  description?: string;
  color?: string;
  visibility: ScheduleVisibility;
}

export interface SharedScheduleUpdateRequest {
  title?: string;
  schedule_type?: ScheduleType;
  start_datetime?: string;
  end_datetime?: string;
  all_day?: boolean;
  description?: string;
  color?: string;
  visibility?: ScheduleVisibility;
}

// =============================================================================
// 개인 일정 타입 (모든 사용자용)
// =============================================================================
export interface PersonalScheduleListItem {
  id: number;
  title: string;
  schedule_type: ScheduleType;
  schedule_type_display: string;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  color: string;
  created_at: string;
}

export interface PersonalScheduleCreateRequest {
  title: string;
  schedule_type: ScheduleType;
  start_datetime: string;
  end_datetime: string;
  all_day?: boolean;
  description?: string;
  color?: string;
}

export interface PersonalScheduleUpdateRequest {
  title?: string;
  schedule_type?: ScheduleType;
  start_datetime?: string;
  end_datetime?: string;
  all_day?: boolean;
  description?: string;
  color?: string;
}
