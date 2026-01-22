// src/pages/admin/usersManagement/UserDetailPage.tsx
import { useNavigate, useParams } from 'react-router-dom';
import { useEffect, useState } from "react";
import { fetchUserDetail, updateUser, toggleUserActive } from "@/services/users.api";
import type { User, UserUpdateForm } from "@/types/user";
import FullScreenLoader from '@/pages/common/FullScreenLoader';
import { showQuestion, showSuccess } from '@/utils/alert';
import UserDetailAccount from './components/UserDetailAccount';
import UserDetailProfile from './components/UserDetailProfile';


export default function UserDetailPage() {
    const navigator = useNavigate(); 
    const { id } = useParams(); // URL에서 :id 추출
    const userId = Number(id);
    const [user, setUser] = useState<User | null>(null);
    const [editMode, setEditMode] = useState(false);
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
        },
    });
  
  useEffect(() => {
    fetchUserDetail(userId).then((data) => {
      setUser(data);
      setForm({
        name: data.name,
        email: data.email,
        role: data.role.code,
        is_active: data.is_active,
        profile: {
            birthDate: data.profile?.birthDate ?? "",
            phoneMobile: data.profile?.phoneMobile ?? "",
            phoneOffice: data.profile?.phoneOffice ?? "",
            hireDate: data.profile?.hireDate ?? "",
            departmentId: data.profile?.departmentId ?? "",
            title: data.profile?.title ?? "",
        },
      });
    });
  }, [userId]);

  if (!user) {
    return <FullScreenLoader />; // 로딩 스피너
  }
  
  // 수정
  const handleSave = async () => {
    await updateUser(userId, form);
    showSuccess("수정 완료")

    // 수정된 데이터로 사용자 정보 다시 조회
    const updatedUser = await fetchUserDetail(userId); 
    setUser(updatedUser);

    setEditMode(false);
  };

  // 삭제 (비활성화)
  const handleDeactivate = async () => {
    const result = await showQuestion("사용자를 비활성화  <br> 하시겠습니까?")
    if (!result.isConfirmed) return;  // 취소 누르면 중단

    await toggleUserActive(userId); // 계정 비활성 api 호출

    showSuccess("계정 비활성화 완료").then(() => {
        navigator("/admin/users");  // 이전 페이지로 이동
    });

  };

  return (
    <div className="admin-page">
        <UserDetailAccount
            user={user}
            form={form}
            editMode={editMode}
            setForm={setForm}
        />

        <UserDetailProfile
            user={user}
            form={form}
            editMode={editMode}
            setForm={setForm}
        />
    

        <div className="form-actions">
            {editMode ? (
                <>
                <button onClick={handleSave} className="primary">저장</button>
                <button onClick={() => setEditMode(false)} className="ghost">취소</button>
                </>
            ) : (
                <>
                <button onClick={() => setEditMode(true)}>수정</button>
                <button className="danger" onClick={handleDeactivate}>
                    계정 비활성
                </button>
                </>
            )}
        </div>

    </div>
  );
}