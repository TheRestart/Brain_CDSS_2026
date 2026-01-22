import React from "react";
import type { User } from "@/types/user";
import UserTableRow from "./UserTableRow";

interface UserTableProps {
  users: User[];
  onToggleActive: (id: number) => void;
  onUnlock: (id: number) => void;
  onRefresh: () => void;
}

const UserTable: React.FC<UserTableProps> = ({ users, onToggleActive, onUnlock, onRefresh: _onRefresh }) => {
  return (
    <table className="admin-table">
      <thead>
        <tr>
          <th>ID</th>
          <th>이름</th>
          <th>역할</th>
          <th>접속 유/무</th>
          <th>최근 로그인</th>
          <th>상태 변경</th>
        </tr>
      </thead>
      <tbody>
        {/* 사용자 행 컴포넌트 */}
        {users.map((user) => (
          <UserTableRow
            key={user.id}
            user={user}
            onToggleActive={onToggleActive}
            onUnlock={onUnlock}
          />
        ))}

        {users.length === 0 && (
          <tr>
            <td colSpan={6} style={{ textAlign: "center", padding: "20px" }}>
              조회된 사용자가 없습니다.
            </td>
          </tr>
        )}
      </tbody>
    </table>
  );
};

export default UserTable;