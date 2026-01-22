import { useState } from "react";
import UserInfoSection from "./UserInfoSection";
import AccountSection, { type AccountForm } from "./AccountSection";
import type { UserUpdateForm } from "@/types/user";

interface Props {
  onSubmit: (data: { form: UserUpdateForm; account: AccountForm}) => void;
  onClose: () => void;
  onCreated: () => void;
  initialData?: {
    profile?: UserUpdateForm;
    account?: AccountForm;
  };
}

export default function UserForm({ onSubmit, initialData }: Props) {
  const [form, setForm] = useState<UserUpdateForm>({
    name: "",
    email: "",
    role: "",
    is_active: true,
    profile: {
      birthDate: "",
      phoneMobile: "",
      phoneOffice: "",
      hireDate: "",
      departmentId: "",
      title: "",
      ...initialData?.profile,
    },
  });

  const [account, setAccount] = useState<AccountForm>({
    login_id: "",
    role: "",
    ...initialData?.account,
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!account.login_id || !account.role) {
      alert("계정 정보를 모두 입력하세요.");
      return;
    }

    if (!form.name || !form.profile.birthDate) {
      alert("필수 개인정보가 누락되었습니다.");
      return;
    }

    // 데이터 넘김
    await onSubmit({ form, account });
  };

  return (
    <form className="user-form" id="user-form" onSubmit={handleSubmit}>
      <UserInfoSection 
        value={form} 
        onChange={setForm}
      />
      <AccountSection 
        value={account} 
        onChange={setAccount} 
        userName={form.name}  
        birthDate={form.profile.birthDate}
      />
    </form>
  );
}