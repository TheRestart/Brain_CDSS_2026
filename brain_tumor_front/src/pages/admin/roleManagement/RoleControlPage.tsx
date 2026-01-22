import { useEffect, useState } from "react";
import {
  fetchRoles,
  createRole,
  updateRole,
  deleteRole,
} from "@/services/role.api";
import type { Role } from "@/types/role";
import RoleFormModal from "./components/RoleFormModal";
import { showError, showQuestion, showSuccess } from '@/utils/alert';
import RoleListTable from "./components/RoleListTable";
import Pagination from '@/layout/Pagination';
import '@/assets/style/adminRoleControlPageStyle.css';



export default function RoleControlPage() {
  const [roles, setRoles] = useState<Role[]>([]);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState(""); // active / inactive
  const [editingRole, setEditingRole] = useState<Role | null>(null);
  const [page, setPage] = useState(1); // 페이징 처리
  const [totalCount, setTotalCount] = useState(0);

  const PAGE_SIZE = 10;


  const load = async () => {
    const { roles, total } = await fetchRoles(
      page, 
      PAGE_SIZE,
      search,
      statusFilter
    
    );
    setRoles(roles);
    setTotalCount(total);
  };

  useEffect(() => {
    load();
  }, [page, search, statusFilter]);

  const handleSubmit = async (data: any) => {
    try {
      if (editingRole) {
        await updateRole(editingRole.id, data);
        showSuccess("계정 수정 완료");
      } else {
        await createRole(data);
        showSuccess("계정 생성 완료");
      }
      setOpen(false);
      setEditingRole(null);
      load();
    }
    catch (err){
      showError("처리 중 오류가 발생했습니다.")
    }
  };

  const handleDelete = async (role: Role) => {
    const result = await showQuestion("이 역할을 비활성화 하시겠습니까?")
    if (!result.isConfirmed) return;  // 취소 누르면 중단

    await deleteRole(role.id);
    showSuccess("계정 비활성화 완료").then(() => {
      load();
    });
  };

  return (
    <div className="role-card">
      <div className="admin-toolbar">
        <div className="header-left">
          
          <input
              className="search-input"
              placeholder="사용자명 / ID 검색"
              value={search}
              onChange={(e) => {
                setSearch(e.target.value)
                setPage(1);
              }}
          />

          <select
             className="activate-select"
              value={statusFilter}
              onChange={(e) => {
                  setStatusFilter(e.target.value);
                  setPage(1);
              }}
          >
          <option value="">전체 상태</option>
          <option value="ACTIVE">활성</option>
          <option value="INACTIVE">비활성</option>
          </select>

          <p>시스템에 사용하는 사용자 역할을 관리합니다.</p>
        </div>

        <div className="header-right">
          <button className="button-primary" onClick={() => setOpen(true)}>
            + 역할 생성
          </button>
        </div>
      </div>
      
      {/* 테이블 카드 */}
      <RoleListTable
        roles={roles}
        onEdit={(role) => {
          setEditingRole(role);
          setOpen(true);
        }}
        onDelete={handleDelete}
      />

      
      {/* 역할 생성/수정 모달창  */}
      <RoleFormModal
        open={open}
        role={editingRole}
        onClose={() => {
          setOpen(false);
          setEditingRole(null);
        }}
        onSubmit={handleSubmit}
      />

      {/* 페이징 */}
      <section className="pagination-bar">
        <Pagination
            currentPage={page}
            totalPages={Math.ceil(totalCount / PAGE_SIZE)}
            onChange={(p) => setPage(p)}
            pageSize={PAGE_SIZE}
        />
      </section>
    </div>
  );
}
