import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { login } from '@/services/auth.api';
import { useAuth } from '@/pages/auth/AuthProvider';
import Swal from 'sweetalert2';
import '@/assets/style/landing.css';

export default function LandingPage() {
  const [showLoginModal, setShowLoginModal] = useState(false);
  const [id, setId] = useState('');
  const [pw, setPw] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { refreshAuth, role } = useAuth();

  // 이미 로그인된 경우 대시보드로 이동
  useEffect(() => {
    if (role) {
      navigate('/dashboard', { replace: true });
    }
  }, [role, navigate]);

  const handleLogin = async () => {
    if (!id || !pw) {
      Swal.fire({
        icon: 'warning',
        title: '입력 오류',
        text: '아이디와 비밀번호를 입력해주세요.',
        confirmButtonText: '확인',
        confirmButtonColor: '#1a73e8',
      });
      return;
    }

    setIsLoading(true);
    try {
      const res = await login(id, pw);

      if (!res.success) {
        Swal.fire({
          icon: 'error',
          title: '인증 실패',
          text: res.error || '아이디 또는 비밀번호를 확인해주세요.',
          confirmButtonText: '확인',
          confirmButtonColor: '#1a73e8',
        });
        return;
      }

      localStorage.setItem('accessToken', res.data.access);
      localStorage.setItem('refreshToken', res.data.refresh);

      if (res.data.user.must_change_password) {
        await refreshAuth();
        navigate('/change-password', { replace: true });
        return;
      }

      await refreshAuth();

      await Swal.fire({
        icon: 'success',
        title: '로그인 성공',
        text: '오늘도 화이팅하세요.',
        timer: 1200,
        showConfirmButton: false,
      });

      await refreshAuth();
      navigate('/dashboard', { replace: true });
    } catch (error: any) {
      const code = error?.response?.data?.code;
      const message = error?.response?.data?.message;
      const remain = error?.response?.data?.remain;

      if (code === 'LOGIN_LOCKED') {
        Swal.fire({
          icon: 'warning',
          title: '계정 잠김',
          text: message ?? '로그인 실패 횟수 초과로 계정이 잠겼습니다.',
          confirmButtonText: '확인',
          confirmButtonColor: '#dc2626',
        });
        return;
      }

      if (code === 'INACTIVE_USER') {
        Swal.fire({
          icon: 'error',
          title: '비활성 계정',
          text: message ?? '현재 비활성화된 계정입니다.',
          confirmButtonText: '확인',
        });
        return;
      }

      Swal.fire({
        icon: 'error',
        title: '인증 실패',
        text: remain
          ? `${message}\n(남은 시도 횟수: ${remain}회)`
          : '아이디 또는 비밀번호를 확인해주세요.',
        confirmButtonText: '확인',
        confirmButtonColor: '#1a73e8',
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter') {
      handleLogin();
    }
  };

  return (
    <div className="landing-page">
      {/* 중앙 이미지 */}
      <div className="landing-center">
        <img
          src="/images/main.png"
          alt="Brain CDSS"
          className="landing-image"
        />
      </div>

      {/* 하단 Welcome 텍스트 */}
      <div className="landing-bottom">
        <span
          className="landing-welcome"
          onClick={() => setShowLoginModal(true)}
        >
          welcome
        </span>
      </div>

      {/* Login Modal */}
      {showLoginModal && (
        <div className="landing-modal-backdrop" onClick={() => setShowLoginModal(false)}>
          <div className="landing-modal" onClick={(e) => e.stopPropagation()}>
            <button
              className="landing-modal-close"
              onClick={() => setShowLoginModal(false)}
            >
              <i className="fa-solid fa-xmark"></i>
            </button>

            <div className="landing-modal-header">
              <i className="fa-solid fa-brain landing-modal-icon"></i>
              <h2>로그인</h2>
            </div>

            <div className="landing-modal-body">
              <div className="landing-input-group">
                <label htmlFor="login-id">아이디</label>
                <input
                  id="login-id"
                  type="text"
                  placeholder="아이디를 입력하세요"
                  value={id}
                  onChange={(e) => setId(e.target.value)}
                  onKeyPress={handleKeyPress}
                  autoFocus
                />
              </div>

              <div className="landing-input-group">
                <label htmlFor="login-pw">비밀번호</label>
                <input
                  id="login-pw"
                  type="password"
                  placeholder="비밀번호를 입력하세요"
                  value={pw}
                  onChange={(e) => setPw(e.target.value)}
                  onKeyPress={handleKeyPress}
                />
              </div>

              <button
                className="landing-submit-btn"
                onClick={handleLogin}
                disabled={isLoading}
              >
                {isLoading ? (
                  <>
                    <i className="fa-solid fa-spinner fa-spin"></i>
                    로그인 중...
                  </>
                ) : (
                  '로그인'
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
