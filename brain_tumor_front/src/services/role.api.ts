import {api} from '@/services/api';

// Role 조회
export const fetchRoles = async (
  page: number,
  pageSize: number,
  search?: string,
  status?: string
) => {
  const res = await api.get("/auth/roles/", {
    params: {
      page,
      size: pageSize,
      search,
      status,
    },
  });

  return {
    roles: res?.data?.results ?? [], // DRF pagination 결과 (null 안전)
    total: res?.data?.count ?? 0, // 전체 개수 (null 안전)
  };
};


// Role 생성
export const createRole = async (data: {
  code: string;
  name: string;
  description?: string;
}) => {
  return api.post("/auth/roles/", data);
};

// Role 수정
export const updateRole = async (
  id: number,
  data: { name: string; description?: string; is_active: boolean }
) => {
  return api.patch(`/auth/roles/${id}/`, data);
};

// Role 삭제 - 비활성화
export const deleteRole = async (id: number) => {
  return api.delete(`/auth/roles/${id}/`);
};
