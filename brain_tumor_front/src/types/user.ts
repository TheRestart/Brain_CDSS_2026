export interface User {
    id: number;
    login_id: string;
    name: string;
    email : string;
    role: {
        code: string;
        name: string;
    };
    is_active: boolean;
    last_login: string | null;
    created_at: string;        // 계정 생성일 (ISO datetime)

    is_locked: boolean;
    failed_login_count: number;
    locked_at: string | null; // 계정 잠금 시각
    is_online: boolean;        // 현재 접속 중
    must_change_password: boolean;

    profile?: UserProfileForm;
}

export interface UserProfileForm {
//   name: string;
  birthDate: string;
  phoneMobile: string;
  phoneOffice: string;
//   email: string;
  hireDate: string;
  departmentId: string;
  title: string;
}

export interface UserSearchParams {
    search?: string;
    role?: string;
}

// 사용자 수정(PUT)
export interface UserUpdateForm {
  name: string;
  email: string;
  role: string;          // role.code
  is_active: boolean;
  profile: UserProfileForm;
}

// ============================================
// My Page (내 정보)
// ============================================

// 내 프로필 수정용 (본인만 수정 가능한 필드)
export interface MyProfileUpdateForm {
  name: string;
  email: string;
  profile: {
    phoneMobile: string;
    phoneOffice: string;
    title: string;
  };
}

// 비밀번호 변경
export interface ChangePasswordForm {
  current_password: string;
  new_password: string;
  confirm_password: string;
}
