import type { UserUpdateForm } from "@/types/user";
import PhoneInput from "@/pages/common/PhoneInput";

interface Props {
  value: UserUpdateForm;
  // onChange: (v: UserProfileForm) => void;
  onChange: (v: UserUpdateForm | ((prev: UserUpdateForm) => UserUpdateForm)) => void;
}

export default function UserInfoSection({ value, onChange }: Props) {
  const handleUser = (key: keyof UserUpdateForm) =>
  (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(prev => ({ ...prev, [key]: e.target.value }));
  };

  const handleProfile = (key: keyof UserUpdateForm["profile"]) =>
  (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    onChange(prev => ({
      ...prev,
      profile: { ...prev.profile, [key]: e.target.value }
    }));
  };
  
  // const handle = 
  // (key : keyof UserUpdateForm) =>
  // (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
  //     onChange({ ...value, [key]: e.target.value });
  // };

  return (
    <section className="form-section dashed">
      <h3 className="section-title">개인정보</h3>

      <div className="user-info-grid">
        {/* 프로필 */}
        <div className="profile-box">
          <div className="profile-image" />
        </div>

        {/* 입력 필드 */}
        <div className="info-fields">
          <div className="field">
            <label>이름</label>
            <input 
                id="user-name"
                className = "userInfo"
                value={value.name} 
                onChange={handleUser("name")} />
          </div>

          <div className="field">
            <label>생년월일</label>
            <input
                type="date"
                id="user-birth-date" 
                className = "userInfo"
                placeholder="YYYY-MM-DD"
                value={value.profile.birthDate}
                onChange={handleProfile("birthDate")} />
          </div>

          <div className="field">
            <label>연락처</label>
            <PhoneInput
              value={value.profile.phoneMobile}
              onChange={(v) =>
                onChange(prev => ({ 
                  ...prev, 
                  profile :{
                    ...prev.profile, phoneMobile: v 
                  }
                }))
              }
              segments={[3, 4, 4]}
            />
          </div>

          <div className="field">
            <label>이메일</label>
            <div className="email-input-wrapper">
              <span className="email-icon">@</span>
              <input
                type="email"
                id="user-email"
                placeholder="example@email.com"
                value={value.email}
                onChange={handleUser("email")}
              />
            </div>

          </div>

          <div className="field">
            <label>유선전화</label>
            <PhoneInput
              value={value.profile.phoneOffice}
              onChange={(v) =>
                onChange(prev => ({ ...prev, 
                  profile :{
                    ...prev.profile, phoneOffice: v 
                  }}))
              }
              segments={[3, 3, 4]}
            />
          </div>


          <div className="field">
            <label>입사일</label>
            <input
              type="date"
              id="user-hire-date"
              className="userInfo"
              value={value.profile.hireDate}
              onChange={handleProfile("hireDate")}
            />
          </div>

          <div className="field">
            <label>소속부서</label>
             <select
              className="userInfoOption"
              value={value.profile.departmentId}
              onChange={handleProfile("departmentId")}
            >
              <option value="">선택</option>
              <option value="1">신경외과</option>
              <option value="2">영상의학과</option>
              <option value="3">검사과</option>
            </select>
          </div>

          <div className="field">
            <label>호칭</label>
            <select 
                className="userInfoOption" 
                value={value.profile.title} onChange={handleProfile("title")}>
              <option value="">선택</option>
              <option value="교수">교수</option>
              <option value="정교수">정교수</option>
              <option value="전문의">전문의</option>
            </select>
          </div>
        </div>
      </div>
    </section>
  );
}