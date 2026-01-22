import { api } from './api';

// =============================================================================
// Audit Log API
// =============================================================================

export interface AuditLog {
  id: number;
  user: number | null;
  user_login_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: 'LOGIN_SUCCESS' | 'LOGIN_FAIL' | 'LOGIN_LOCKED' | 'LOGOUT';
  action_display: string;
  ip_address: string | null;
  user_agent: string | null;
  created_at: string;
}

export interface AuditLogListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AuditLog[];
}

export interface AuditLogParams {
  user_login_id?: string;
  action?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

/**
 * 인증 감사 로그 목록 조회
 */
export const getAuditLogs = async (params?: AuditLogParams): Promise<AuditLogListResponse> => {
  const response = await api.get<AuditLogListResponse>('/audit/', { params });
  return response.data;
};

// =============================================================================
// Access Log API (접근 감사 로그)
// =============================================================================

export interface AccessLog {
  id: number;
  user: number | null;
  user_login_id: string | null;
  user_name: string | null;
  user_role: string | null;
  action: 'VIEW' | 'CREATE' | 'UPDATE' | 'DELETE' | 'EXPORT' | 'PRINT';
  action_display: string;
  menu_name: string | null;
  request_method: string;
  request_path: string;
  ip_address: string | null;
  result: 'SUCCESS' | 'FAIL';
  result_display: string;
  response_status: number | null;
  created_at: string;
}

export interface AccessLogListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: AccessLog[];
}

export interface AccessLogParams {
  user_login_id?: string;
  user_role?: string;
  action?: string;
  result?: string;
  date?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  page_size?: number;
}

/**
 * 접근 감사 로그 목록 조회
 */
export const getAccessLogs = async (params?: AccessLogParams): Promise<AccessLogListResponse> => {
  const response = await api.get<AccessLogListResponse>('/audit/access/', { params });
  return response.data;
};
