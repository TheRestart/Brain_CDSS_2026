/**
 * MyPage - 마이페이지 (내 정보 조회/수정, 비밀번호 변경)
 */
import { useState, useEffect } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import { getMyProfile, updateMyProfile, changeMyPassword } from '@/services/mypage.api';
import { useToast } from '@/components/common';
import type { User, MyProfileUpdateForm, ChangePasswordForm } from '@/types/user';
import './MyPage.css';

type MyPageTab = 'profile' | 'password';

export default function MyPage() {
  const { refreshAuth } = useAuth();
  const toast = useToast();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<MyPageTab>('profile');
  const [editMode, setEditMode] = useState(false);
  const [saving, setSaving] = useState(false);

  // 프로필 폼
  const [profileForm, setProfileForm] = useState<MyProfileUpdateForm>({
    name: '',
    email: '',
    profile: {
      phoneMobile: '',
      phoneOffice: '',
      title: '',
    },
  });

  // 비밀번호 폼
  const [passwordForm, setPasswordForm] = useState<ChangePasswordForm>({
    current_password: '',
    new_password: '',
    confirm_password: '',
  });

  // 데이터 로드
  useEffect(() => {
    loadMyProfile();
  }, []);

  const loadMyProfile = async () => {
    try {
      const data = await getMyProfile();
      setUser(data);
      setProfileForm({
        name: data.name || '',
        email: data.email || '',
        profile: {
          phoneMobile: data.profile?.phoneMobile || '',
          phoneOffice: data.profile?.phoneOffice || '',
          title: data.profile?.title || '',
        },
      });
    } catch (err) {
      toast.error('프로필 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // 프로필 저장
  const handleSaveProfile = async () => {
    if (!profileForm.name.trim()) {
      toast.error('이름을 입력하세요.');
      return;
    }

    setSaving(true);
    try {
      const updated = await updateMyProfile(profileForm);
      setUser(updated);
      await refreshAuth(); // AuthContext 업데이트
      setEditMode(false);
      toast.success('프로필이 수정되었습니다.');
    } catch (err: any) {
      const errorMsg = err.response?.data?.detail || '프로필 수정에 실패했습니다.';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  // 프로필 수정 취소
  const handleCancelEdit = () => {
    if (user) {
      setProfileForm({
        name: user.name || '',
        email: user.email || '',
        profile: {
          phoneMobile: user.profile?.phoneMobile || '',
          phoneOffice: user.profile?.phoneOffice || '',
          title: user.profile?.title || '',
        },
      });
    }
    setEditMode(false);
  };

  // 비밀번호 변경
  const handleChangePassword = async () => {
    if (passwordForm.new_password !== passwordForm.confirm_password) {
      toast.error('새 비밀번호가 일치하지 않습니다.');
      return;
    }

    if (passwordForm.new_password.length < 8) {
      toast.error('비밀번호는 8자 이상이어야 합니다.');
      return;
    }

    setSaving(true);
    try {
      await changeMyPassword(passwordForm);
      setPasswordForm({
        current_password: '',
        new_password: '',
        confirm_password: '',
      });
      toast.success('비밀번호가 변경되었습니다.');
    } catch (err: any) {
      const errorMsg =
        err.response?.data?.current_password?.[0] ||
        err.response?.data?.new_password?.[0] ||
        err.response?.data?.confirm_password?.[0] ||
        err.response?.data?.detail ||
        '비밀번호 변경에 실패했습니다.';
      toast.error(errorMsg);
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mypage-container">
        <div className="loading-state">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="mypage-container">
      <div className="mypage-header">
        <h1>마이페이지</h1>
        <p className="subtitle">{user?.name}님의 계정 정보</p>
      </div>

      {/* 탭 네비게이션 */}
      <div className="mypage-tabs">
        <button
          className={`tab ${activeTab === 'profile' ? 'active' : ''}`}
          onClick={() => setActiveTab('profile')}
        >
          프로필 정보
        </button>
        <button
          className={`tab ${activeTab === 'password' ? 'active' : ''}`}
          onClick={() => setActiveTab('password')}
        >
          비밀번호 변경
        </button>
      </div>

      {/* 프로필 탭 */}
      {activeTab === 'profile' && (
        <div className="mypage-content">
          {/* 계정 정보 (읽기 전용) */}
          <div className="profile-section">
            <h3>계정 정보</h3>
            <div className="info-grid">
              <div className="info-item">
                <label>로그인 ID</label>
                <span>{user?.login_id}</span>
              </div>
              <div className="info-item">
                <label>역할</label>
                <span className="role-badge">{user?.role?.name}</span>
              </div>
              <div className="info-item">
                <label>마지막 로그인</label>
                <span>
                  {user?.last_login
                    ? new Date(user.last_login).toLocaleString('ko-KR')
                    : '-'}
                </span>
              </div>
              <div className="info-item">
                <label>계정 상태</label>
                <span className={user?.is_active ? 'status-active' : 'status-inactive'}>
                  {user?.is_active ? '활성' : '비활성'}
                </span>
              </div>
              <div className="info-item">
                <label>계정 생성일</label>
                <span>
                  {user?.created_at
                    ? new Date(user.created_at).toLocaleDateString('ko-KR')
                    : '-'}
                </span>
              </div>
            </div>
          </div>

          {/* 개인 정보 (수정 가능) */}
          <div className="profile-section">
            <div className="section-header">
              <h3>개인 정보</h3>
              {!editMode && (
                <button className="btn btn-secondary" onClick={() => setEditMode(true)}>
                  수정
                </button>
              )}
            </div>

            {editMode ? (
              <div className="edit-form">
                <div className="form-group">
                  <label>이름 *</label>
                  <input
                    type="text"
                    value={profileForm.name}
                    onChange={(e) => setProfileForm({ ...profileForm, name: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>이메일</label>
                  <input
                    type="email"
                    value={profileForm.email}
                    onChange={(e) => setProfileForm({ ...profileForm, email: e.target.value })}
                  />
                </div>
                <div className="form-group">
                  <label>휴대폰</label>
                  <input
                    type="tel"
                    value={profileForm.profile.phoneMobile}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        profile: { ...profileForm.profile, phoneMobile: e.target.value },
                      })
                    }
                    placeholder="010-0000-0000"
                  />
                </div>
                <div className="form-group">
                  <label>사무실 전화</label>
                  <input
                    type="tel"
                    value={profileForm.profile.phoneOffice}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        profile: { ...profileForm.profile, phoneOffice: e.target.value },
                      })
                    }
                    placeholder="02-0000-0000"
                  />
                </div>
                <div className="form-group">
                  <label>직함</label>
                  <input
                    type="text"
                    value={profileForm.profile.title}
                    onChange={(e) =>
                      setProfileForm({
                        ...profileForm,
                        profile: { ...profileForm.profile, title: e.target.value },
                      })
                    }
                    placeholder="전문의, 과장 등"
                  />
                </div>

                <div className="form-actions">
                  <button
                    className="btn btn-secondary"
                    onClick={handleCancelEdit}
                    disabled={saving}
                  >
                    취소
                  </button>
                  <button
                    className="btn btn-primary"
                    onClick={handleSaveProfile}
                    disabled={saving}
                  >
                    {saving ? '저장 중...' : '저장'}
                  </button>
                </div>
              </div>
            ) : (
              <div className="info-grid">
                <div className="info-item">
                  <label>이름</label>
                  <span>{user?.name}</span>
                </div>
                <div className="info-item">
                  <label>이메일</label>
                  <span>{user?.email || '-'}</span>
                </div>
                <div className="info-item">
                  <label>휴대폰</label>
                  <span>{user?.profile?.phoneMobile || '-'}</span>
                </div>
                <div className="info-item">
                  <label>사무실 전화</label>
                  <span>{user?.profile?.phoneOffice || '-'}</span>
                </div>
                <div className="info-item">
                  <label>직함</label>
                  <span>{user?.profile?.title || '-'}</span>
                </div>
                <div className="info-item">
                  <label>입사일</label>
                  <span>{user?.profile?.hireDate || '-'}</span>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 비밀번호 변경 탭 */}
      {activeTab === 'password' && (
        <div className="mypage-content">
          <div className="profile-section">
            <h3>비밀번호 변경</h3>
            <p className="section-desc">
              보안을 위해 주기적으로 비밀번호를 변경하는 것을 권장합니다.
            </p>
            <div className="password-form">
              <div className="form-group">
                <label>현재 비밀번호 *</label>
                <input
                  type="password"
                  value={passwordForm.current_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, current_password: e.target.value })
                  }
                  placeholder="현재 비밀번호 입력"
                />
              </div>
              <div className="form-group">
                <label>새 비밀번호 *</label>
                <input
                  type="password"
                  value={passwordForm.new_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, new_password: e.target.value })
                  }
                  placeholder="8자 이상 입력"
                />
              </div>
              <div className="form-group">
                <label>새 비밀번호 확인 *</label>
                <input
                  type="password"
                  value={passwordForm.confirm_password}
                  onChange={(e) =>
                    setPasswordForm({ ...passwordForm, confirm_password: e.target.value })
                  }
                  placeholder="새 비밀번호 재입력"
                />
                {passwordForm.confirm_password &&
                  passwordForm.new_password !== passwordForm.confirm_password && (
                    <span className="error-text">비밀번호가 일치하지 않습니다.</span>
                  )}
              </div>

              <div className="form-actions">
                <button
                  className="btn btn-primary"
                  onClick={handleChangePassword}
                  disabled={
                    saving ||
                    !passwordForm.current_password ||
                    !passwordForm.new_password ||
                    !passwordForm.confirm_password
                  }
                >
                  {saving ? '변경 중...' : '비밀번호 변경'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
