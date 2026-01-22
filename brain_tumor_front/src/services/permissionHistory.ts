// src/services/permissionHistory.ts
import { api } from './api';

export interface PermissionHistory {
  id: number;
  menu_name: string;
  action: 'ADD' | 'REMOVE';
  changed_by_name: string;
  changed_at: string;
  reason?: string;
}

export async function fetchPermissionHistory(
  roleId: number,
  params?: {
    action?: string;
    from?: string;
    to?: string;
    page?: number;
    page_size?: number;
  }
) {
  const res = await api.get(
    `/auth/roles/${roleId}/permission-history/`,
    { params }
  );
  return res.data;
}
