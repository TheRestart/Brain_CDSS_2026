import React from "react";
import type { User } from "@/types/user";
import { useNavigate } from "react-router-dom";

interface UserTableRowProps {
  user: User;
  onToggleActive: (id: number) => void;
  onUnlock: (id: number) => void;
}

// 날짜 포맷 함수
const formatDate = (dateString: string | null) => {
  if (!dateString) return "-";
  return new Date(dateString).toLocaleString("ko-KR", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const UserTableRow: React.FC<UserTableRowProps> = ({ user, onToggleActive, onUnlock }) => {
  const navigate = useNavigate();

  const handleClickUser = (userId: number) => {
    navigate(`/admin/users/${userId}`);
  };

  return (
    <tr onClick={() => handleClickUser(user.id)}>
      <td>{user.login_id}</td>
      <td>{user.name}</td>
      <td>{user.role?.name ?? "없음"}</td>

      <td>
        {user.is_locked ? (
          <span className="badge danger">잠김</span>
        ) : (
          <>
            {user.is_online ? (
              <span className="badge online">🟢 접속 중</span>
            ) : (
              <span className="badge offline">⚪ 오프라인</span>
            )}
            {user.is_active && <span className="badge active">활성</span>}
            {!user.is_active && <span className="badge inactive">비활성</span>}
          </>
        )}
      </td>

      <td>{formatDate(user.last_login)}</td>

      <td>
        {user.is_locked ? (
          <button className="danger" onClick={() => onUnlock(user.id)}>
            잠금 해제
          </button>
        ) : (
          <button className="ghost" onClick={(e) => {
            e.stopPropagation();
            onToggleActive(user.id)
            }}
          >
            {user.is_active ? "비활성화" : "활성화"}
          </button>
        )}
      </td>
    </tr>
  );
};

export default UserTableRow;