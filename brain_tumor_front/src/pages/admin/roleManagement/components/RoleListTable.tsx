import type { Role } from "@/types/role";

interface Props {
  roles: Role[];
  onEdit: (role: Role) => void;
  onDelete: (role: Role) => void;
}

export default function RoleListTable({
  roles,
  onEdit,
  onDelete,
}: Props) {
  return (
    <table className="role-table">
      <thead>
        <tr>
          <th>역할명</th>
          <th>코드</th>
          <th>역할 설명</th>
          <th>상태</th>
          <th>수정</th>
          <th />
        </tr>
      </thead>

      <tbody>
        {roles.map((role) => (
          <tr key={role.id}>
            <td>{role.name}</td>
            <td>{role.code}</td>
            <td>{role.description || "-"}</td>
            <td>
              <span className={`status-badge ${role.is_active ? "on" : "off"}`}>
                {role.is_active ? "활성" : "비활성"}
              </span>
            </td>
            <td className="actions">
              <button
                className="btn-edit"
                onClick={() => onEdit(role)}
              >
                수정
              </button>
              <button
                className="btn-danger"
                onClick={() => onDelete(role)}
              >
                비활성화
              </button>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
