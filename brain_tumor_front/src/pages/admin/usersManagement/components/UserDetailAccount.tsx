import type { User, UserUpdateForm } from "@/types/user";

interface Props {
  user: User;
  form: UserUpdateForm;
  editMode: boolean;
  setForm: React.Dispatch<React.SetStateAction<UserUpdateForm>>;
}


export default function UserDetailAccount({
  user,
  form,
  editMode,
  setForm,
}: Props) {
  return (
    <section className="form-section admin-card">
        <h3 className="section-title">계정 정보</h3>

        <div className="info-fields">
            <div className="field">
            <label>로그인 ID</label>
            <p>{user.login_id}</p>
            </div>

            <div className="field">
            <label>이름</label>
            {editMode ? (
                <input
                className="userInfo"
                value={form.name}
                onChange={(e) =>
                    setForm((prev) => ({ ...prev, name: e.target.value }))
                }
                />
            ) : (
                <p>{user.name}</p>
            )}
            </div>

            <div className="field">
            <label>이메일</label>
            {editMode ? (
                <input
                className="userInfo"
                value={form.email || ""}
                onChange={(e) =>
                    setForm((prev) => ({ ...prev, email: e.target.value }))
                }
                />
            ) : (
                <p>{user.email || "-"}</p>
            )}
            </div>

            <div className="field">
            <label>역할</label>
            {editMode ? (
                <select
                className="userInfoOption"
                value={form.role}
                onChange={(e) =>
                    setForm((prev) => ({ ...prev, role: e.target.value }))
                }
                >
                <option value="ADMIN">관리자</option>
                <option value="DOCTOR">의사</option>
                <option value="NURSE">간호사</option>
                <option value="PATIENT">환자</option>
                <option value="RIS">영상과</option>
                <option value="LIS">검사과</option>
                </select>
            ) : (
                <p>{user.role.name}</p>
            )}
            </div>
        </div>
    </section>

  );
}
