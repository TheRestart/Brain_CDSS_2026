// src/services/admin.permission.ts
import { api } from './api';
import type { MenuNode } from '@/types/menu';
import type { Role } from '@/types/adminManager';

/** Role 목록 조회 */
export async function fetchRoles(): Promise<Role[]> {
  const res = await api.get('/auth/roles/');
  // return res.data;
  return res.data.results ?? res.data;
}

/** 전체 메뉴 트리 */
export async function fetchMenuTree(): Promise<MenuNode[]> {
  // const res = await api.get('/admin/menus/');
  const res = await api.get('/auth/permissions/');
  return res.data;
}

/** 특정 Role의 메뉴 권한 조회 */
// export async function fetchRoleMenus(
//   roleCode: string
// ): Promise<number[]> {
//   const res = await api.get(`/admin/roles/${roleCode}/menus/`);
//   return res.data;
// }
export async function fetchRoleMenus(
  roleId: number
): Promise<number[]> {
  const res = await api.get(`/auth/roles/${roleId}/menu-ids/`);
  return res.data;
  // return res.data.permission_ids;
}

/** Role 메뉴 권한 저장 */
export async function saveRoleMenus(
  roleId: number,
  menuIds: number[]
): Promise<void> {
  await api.put(`/auth/roles/${roleId}/menus/`, {
    permission_ids: menuIds,
  });
}

/** 메뉴 권한 생성, 수정, 조회 */
export const updateRolePermissions = (roleId : number, permissionIds : number[]) =>
  api.put(`/auth/roles/${roleId}/menus/`, {
    permission_ids : permissionIds,
  })


  export async function fetchPermissionHistory(roleId: number) {
  const res = await api.get(
    `/api/admin/roles/${roleId}/permission-history/`
  );
  return res.data;
}
