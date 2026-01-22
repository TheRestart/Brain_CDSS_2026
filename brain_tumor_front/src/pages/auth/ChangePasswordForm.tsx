import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';
import { changePassword } from '@/services/auth.api';

export default function ChangePasswordForm() {
  const navigate = useNavigate();
  const { logout, user } = useAuth();

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [oldPassword, setOldPassword] = useState('');
  const isForced = user?.must_change_password;

  const validate = () => {
    if (!oldPassword || !newPassword || !confirmPassword) {
        return '모든 비밀번호를 입력해주세요.';
    }

    if (newPassword !== confirmPassword) {
        return '비밀번호가 일치하지 않습니다.';
    }

    if (newPassword.length < 8) {
        return '비밀번호는 8자 이상이어야 합니다.';
    }

    return null;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const validationError = validate();
    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setLoading(true);
      setError(null);

      await changePassword(oldPassword, newPassword);
    
      alert('비밀번호가 변경되었습니다. 다시 로그인해주세요.');

      await logout();
      navigate('/login', { replace: true });
    } catch (err : any) {  
      const msg = err?.response?.data?.message;
      setError(msg ?? '비밀번호 변경에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="change-password-wrapper">
      <form className="change-password-form" onSubmit={handleSubmit}>
        <h2>{isForced ? '비밀번호 변경이 필요합니다' : '비밀번호 변경'}</h2>

        {isForced && (
        <p className="notice">
            임시 비밀번호로 로그인하셨습니다. <br/> 반드시 변경해주세요.
        </p>
        )}

        <div className="form-group">
            <label>현재 비밀번호</label>
            <input
                type="password"
                value={oldPassword}
                onChange={(e) => setOldPassword(e.target.value)}
                placeholder="현재 비밀번호"
            />
        </div>


        <div className="form-group">
          <label>새 비밀번호</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            placeholder="새 비밀번호"
            autoFocus
          />
        </div>

        <div className="form-group">
          <label>새 비밀번호 확인</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            placeholder="새 비밀번호 확인"
          />
        </div>

        {error && <p className="error">{error}</p>}

        <button type="submit" disabled={loading}>
          {loading ? '변경 중...' : '비밀번호 변경'}
        </button>
      </form>
    </div>
  );
}
