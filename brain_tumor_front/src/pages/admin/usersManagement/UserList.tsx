import { useEffect, useState } from "react";
import type { User } from "@/types/user";
import {
  fetchUsers,
  toggleUserActive,
  unlockUser,
} from "@/services/users.api";
import UserTable from "./components/UserTable";
import UserCreateModal from "./components/UserCreateModal";
import Pagination from '@/layout/Pagination';
import '@/assets/style/adminPageStyle.css';

export default function UserListPage() {
    const [users, setUsers] = useState<User[]>([]);
    const [search, setSearch] = useState("");
    const [roleFilter, setRoleFilter] = useState("");
    const [statusFilter, setStatusFilter] = useState(""); // active / inactive
    const [page, setPage] = useState(1); // 페이징 처리
    const [totalPages, setTotalPages] = useState(1);

    const PAGE_SIZE = 10;

    // API로 사용자 목록 불러오기(DRF 응답 대응)
    const loadUsers = async () => {
        const data = await fetchUsers({
            search: search || undefined,
            role__code: roleFilter || undefined,
            is_active:
                statusFilter === ""
                    ? undefined
                    : statusFilter === "ACTIVE",
            page,
            size: PAGE_SIZE,
        });
        setUsers(data.results);
        setTotalPages(Math.ceil(data.count / PAGE_SIZE));
    };

    useEffect(() => {
        loadUsers();
    }, []);

    // 반응형 검색
    useEffect(() => {
        const timer = setTimeout(() => {
            setPage(1);
            loadUsers(); // ✅ 검색 시 바로 API 호출
        }, 300);

        return () => clearTimeout(timer);
    }, [search]);

    // 필터 변경에 따른 즉시 변경
    useEffect(() => {
        loadUsers();
    }, [page, roleFilter, statusFilter]);


    // API로 사용자 활성/비활성 토글
    const handleToggleActive = async (id: number) => {
        await toggleUserActive(id);
        loadUsers();
    };

    // API로 사용자 잠금 해제
    const handleUnlockUser = async (id: number) => {
        await unlockUser(id);
        loadUsers();
    };
    // 신규 사용자 생성 모달 상태
    const [openCreate, setOpenCreate] = useState(false);

    return (
    <div className="admin-card">
        {/* Toolbar */}
        <div className="admin-toolbar">
            <div className="toolbar-left">
                <input
                    className="search-input"
                    placeholder="사용자명 / ID 검색"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}

                />

                <select
                    className="role-select"
                    value={roleFilter}
                    onChange={(e) => {
                        setRoleFilter(e.target.value);
                        setPage(1);
                    }}
                >
                <option value="">전체 역할</option>
                <option value="ADMIN">관리자</option>
                <option value="DOCTOR">의사</option>
                <option value="NURSE">간호사</option>
                <option value="PATIENT">환자</option>
                <option value="RIS">영상과</option>
                <option value="LIS">검사과</option>
                </select>

                <select
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

            </div>

            <button 
                className="primary"
                onClick={() => setOpenCreate(true)}
            >
            사용자 추가
            </button>
        </div>

        {/* 사용자 리스트 테이블 컴포넌트*/}
        <UserTable
            users={users}
            onToggleActive={handleToggleActive}
            onUnlock={handleUnlockUser}
            onRefresh={loadUsers}
        />

        
        {/* 페이징 */}
        <section className="pagination-bar">
        <Pagination
            currentPage={page}
            totalPages={totalPages} 
            onChange={(p) => setPage(p)}
            pageSize={PAGE_SIZE}
        />
        </section>

        {/* 사용자 생성 모달 */}
        {openCreate && (
            <UserCreateModal
                onClose={() => setOpenCreate(false)}
                onCreated={loadUsers}
            />
        )}

    </div>
    );
}
