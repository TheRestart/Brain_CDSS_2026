import type { User, UserProfileForm, UserUpdateForm } from "@/types/user";
import PhoneInput from "@/pages/common/PhoneInput";

interface Props {
  user: User;
  form: UserUpdateForm;
  editMode: boolean;
  setForm: React.Dispatch<React.SetStateAction<UserUpdateForm>>;
}


export default function UserDetailProfile({
  user,
  form,
  editMode,
  setForm,
}: Props) {
  const fields: [keyof UserProfileForm, string][] = [
    ["birthDate", "생년월일"],
    ["phoneMobile", "휴대폰"],
    ["phoneOffice", "유선전화"],
    ["title", "직함"],
    ["hireDate", "입사일"],
  ];

  const TITLE_OPTIONS = ["교수", "정교수", "전문의"];

  return (
    <section className="form-section admin-card">
        <h3 className="section-title">프로필 정보</h3>

        <div className="info-fields">
            {fields.map(([key, label]) => (
            <div className="field" key={key}>
                <label>{label}</label>
                {editMode ? (
                    key === "phoneMobile" ? (
                        <PhoneInput
                        value={form.profile.phoneMobile || ""}
                        segments={[3, 4, 4]}
                        onChange={(v) =>
                            setForm((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, phoneMobile: v },
                            }))
                        }
                        />
                    ) : key === "phoneOffice" ? (
                        <PhoneInput
                        value={form.profile.phoneOffice || ""}
                        segments={[3, 3, 4]}
                        onChange={(v) =>
                            setForm((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, phoneOffice: v },
                            }))
                        }
                        />
                    ) : key === "title" ? (
                        <select
                        className="userInfoOption"
                        value={form.profile.title || ""}
                        onChange={(e) =>
                            setForm((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, title: e.target.value },
                            }))
                        }
                        >
                        <option value="">선택</option>
                        {TITLE_OPTIONS.map((t) => (
                            <option key={t} value={t}>
                            {t}
                            </option>
                        ))}
                        </select>
                    ) : key === "birthDate" || key === "hireDate" ? (
                        <input
                        type="date"
                        className="userInfo"
                        value={form.profile[key] || ""}
                        onChange={(e) =>
                            setForm((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, [key]: e.target.value },
                            }))
                        }
                        />
                    ) : (
                        <input
                        className="userInfo"
                        value={form.profile[key] || ""}
                        onChange={(e) =>
                            setForm((prev) => ({
                            ...prev,
                            profile: { ...prev.profile, [key]: e.target.value },
                            }))
                        }
                        />
                    )
                    ) : (
                    <p>{user.profile?.[key] || "-"}</p>
                    )}
            </div>
            ))}
        </div>
    </section>

  );
}
