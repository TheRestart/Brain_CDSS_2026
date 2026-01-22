// 로그인 화면
/**
 * 로그인 처리 플로우
 * [LoginPage]
    ↓
    POST /api/auth/login/
    ↓
    accessToken / refreshToken 발급
    ↓
    GET /api/auth/me
    ↓
    GET /api/menus
    ↓
    AuthProvider 상태 갱신
    ↓
    Sidebar 자동 갱신

 */
import { useState } from 'react';
import { login } from '../../services/auth.api';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';

import '@/assets/style/login.css';
import Swal from 'sweetalert2';

export default function LoginPage(){
    const [id, setId] = useState('');
    const [pw, setPw] = useState('');    
    const navigate = useNavigate();

    const { refreshAuth } = useAuth();
    
    const handleLogin = async () => {
        //api 호출해서 로그인 처리 기능
        try{
            /** 로그인 API 호출 */
            const res = await login(id, pw);

            // 로그인 실패 처리
            if (!res.success) {
                Swal.fire({
                    icon: 'error',
                    title: '인증 실패',
                    text: res.error || '아이디 또는 비밀번호를 확인해주세요.',
                    width: 424,
                    padding: '1.25rem',
                    confirmButtonText: '확인',
                    confirmButtonColor: '#1d4ed8',
                });
                return;
            }

            // 로그인 성공 - 토큰 저장
            localStorage.setItem('accessToken', res.data.access); // access 토큰 저장
            localStorage.setItem('refreshToken', res.data.refresh); // refresh 토큰도 저장

            // 비밀번호 변경 필요 시 변경 페이지로 이동
            if (res.data.user.must_change_password) {
                await refreshAuth();
                navigate('/change-password', { replace: true });
                return;
            }


            // 로그인 후 유저 정보 갱신
            await refreshAuth();

            await Swal.fire({
                icon: 'success',
                title: '로그인 성공',
                text: '오늘도 화이팅하세요.',
                timer: 1200,
                width: 424,
                padding: '1.25rem',
                showConfirmButton: false,
            });

            //  홈으로 이동
            // navigate('/dashboard', {replace : true});
            await refreshAuth(); // menus, permissions 세팅

            navigate('/', { replace: true });

        }catch(error : any){
            const code = error?.response?.data?.code;
            const message = error?.response?.data?.message;
            const remain = error?.response?.data?.remain;

            // 계정 잠김
            if(code === 'LOGIN_LOCKED'){
                Swal.fire({
                    icon: 'warning',
                    title: '계정 잠김',
                    text: message ?? '로그인 실패 횟수 초과로 계정이 잠겼습니다. 관리자에게 문의하세요.',
                    width: 424,
                    padding: '1.25rem',
                    confirmButtonText: '확인',
                    confirmButtonColor: '#dc2626',
                
                });
                return;
            }
            // 비활성 계정
            if (code === 'INACTIVE_USER') {
                Swal.fire({
                    icon: 'error',
                    title: '비활성 계정',
                    text: message ?? '현재 비활성화된 계정입니다. 관리자에게 문의하세요.',
                    confirmButtonText: '확인',
                });
                return;
            }

            // 일반 로그인 실패
            Swal.fire({
                icon: 'error',
                title: '인증 실패',
                text: remain
                        ? `${message}\n(남은 시도 횟수: ${remain}회)`
                        : '아이디 또는 비밀번호를 확인해주세요.',
                width: 424,
                padding: '1.25rem',
                confirmButtonText: '확인',
                confirmButtonColor: '#1d4ed8', // 기존 버튼 색이랑 맞춤
                
            });
            console.error(error);
        }
        
    }

    return(
        <div className="login-page">
            <div className="login-overlay" />

            <header className="login-header">
                <div className="logo">                
                <span className="logo-icon">
                    <i className="fa-solid fa-brain"></i>
                </span>
                <div>
                    <strong>CDSS</strong>
                    <span className="sub">(brain_tumor)</span>
                    <div className="desc">CLINICAL DECISION SUPPORT SYSTEM</div>
                </div>
                </div>
            </header>

            <div className="login-container">
                <div className="login-card">
                <h2>로그인</h2>

                <div className="login-field">
                    <input
                    placeholder="아이디"
                    onChange={(e) => setId(e.target.value)}
                    />
                </div>

                <div className="login-field">
                    <input
                    type="password"
                    placeholder="비밀번호"
                    onChange={(e) => setPw(e.target.value)}
                    />
                </div>

                <button className="login-button" onClick={handleLogin}>
                    로그인
                </button>

                <div className="login-footer">
                    <a href="#">비밀번호를 잊으셨나요?</a>
                </div>
                </div>
            </div>
        </div>
    )
}