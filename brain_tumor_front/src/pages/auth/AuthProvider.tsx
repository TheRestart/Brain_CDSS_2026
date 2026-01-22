import { createContext, useContext, useEffect, useState, useRef } from 'react';
import SessionExtendModal from './SessionExtendModal';
import { connectPermissionSocket } from '@/socket/permissionSocket'
import { closeGlobalSocket as closeOCSSocket } from '@/socket/ocsSocket';
import type { MenuNode } from '@/types/menu';
import { fetchMe, fetchMenu } from '../../services/auth.api';
import type { User } from '@/types/user';

interface AuthContextValue {
  user : User | null;
  role: string | null;
  menus: MenuNode[];
  permissions: string[];

  sessionRemain: number;
  isAuthReady: boolean;
  isAuthenticated: boolean;

  logout: () => void;
  refreshAuth: () => Promise<User | null>;
  hasPermission: (menuId: string) => boolean;
}

const AuthContext = createContext<AuthContextValue | null>(null);


export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [role, setRole] = useState<string | null>(null);
  const [menus, setMenus] = useState<MenuNode[]>([]);

  const [isAuthReady, setIsAuthReady] = useState(false);
  const [sessionRemain, setSessionRemain] = useState(30 * 60);

  const [permissions, setPermissions] = useState<string[]>([]);


   // WebSocket을 저장할 ref
  const wsRef = useRef<WebSocket | null>(null);

  // 내 정보, 메뉴 조회
  const refreshAuth = async () => {

    const meRes = await fetchMe();
    if (!meRes.success) {
      console.error('fetchMe 실패:', meRes.error);
      return null;
    }

    const meInfo = meRes.data;
    const menuRes = await fetchMenu();

    setUser(meInfo);
    setRole(meInfo.role.code);
    setPermissions(meInfo.permissions ?? []);

    // 비밀번호 변경 필요하면 메뉴/소켓/권한 로딩 중단
    if (meInfo.must_change_password) {
      setMenus([]);
      return meInfo;
    }

    if (menuRes.success) {
      setMenus(menuRes.data.menus);
    }
    return meInfo;


};


  // 앱 최초 1회: 서버 기준 인증 초기화
  useEffect(() => {
    const initAuth = async () => {
      const token = localStorage.getItem('accessToken');
      if (!token) {
        setIsAuthReady(true);
        return;
      }

      try {
        await refreshAuth();
      } finally {
        setIsAuthReady(true);
      }

    };

    initAuth();
  }, []);


  const isAuthenticated = !!user;

  
  // WebSocket 연결 (세션 동안 유지)
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user?.must_change_password) return;
    
    // 이미 연결된 WebSocket이 있으면 닫고 새로 연결
    if (wsRef.current) {
      wsRef.current.close();
    }

    wsRef.current = connectPermissionSocket(async () => {
      const menuRes = await fetchMenu();
      setMenus(menuRes.data.menus);
    });
  }, [isAuthenticated, user]);

  // WebSocket 연결 - 서버로부터 실시간 알림 수신
  useEffect(() => {
    if (!user) return;
    const token = localStorage.getItem("accessToken");
    if (!token) return;
    const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    const ws = new WebSocket(`${wsBaseUrl}/presence/?token=${token}`);

    let interval: number | null = null;

    ws.onopen = () => {
      console.log("🟢 Presence connected");
      interval = window.setInterval(() => {
        ws.send(JSON.stringify({ type: "heartbeat" }));
      }, 30000);
    };
    ws.onclose = () => {
      console.log("🔴 Presence disconnected");
    };

    return () => {
      if (interval) clearInterval(interval);
      ws.close();
    };
  }, [user]);
  

  /** ⏱ 세션 타이머 */
  useEffect(() => {
    if (!isAuthenticated) return;
    if (user.must_change_password) return;

    const timer = setInterval(() => {
      setSessionRemain((prev) => Math.max(prev - 1, 0));
    }, 1000);

    return () => clearInterval(timer);
  }, [isAuthenticated, user]);

  /** 만료 시 연장 또는 로그아웃 */
  // 로그아웃 처리
  const logout = async () => {
    setUser(null);
    setRole(null);
    setMenus([]);

    setSessionRemain(30 * 60); // 초기값으로 복원
    setHasWarned(false);    
    setShowExtendModal(false);
    
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');

    // WebSocket 닫기
    if (wsRef.current) {
      wsRef.current.close();
    }

    // OCS WebSocket 닫기 (사용자 변경 시 재연결을 위해)
    closeOCSSocket();

  };

  // 로그인 후 25분	-> 연장 모달 1회 표시
  // 연장 클릭	세션 30분 리셋 + 다시 25분 후 재등장
  // 무시	만료 시 자동 로그아웃
  // 재로그인	정상 동작
  const WARNING_TIME = 5 * 60; // 5분
  const [showExtendModal, setShowExtendModal] = useState(false);
  const [hasWarned, setHasWarned] = useState(false);

  useEffect(() => {
    if (sessionRemain <= 0) {
      logout();
      return;
    }
    if (sessionRemain <= WARNING_TIME && !hasWarned) {
      setShowExtendModal(true);
      setHasWarned(true);
    }

  }, [sessionRemain]);

  const extendSession = () => {
    setSessionRemain(30 * 60); // 30분 연장
    setHasWarned(false);          
    setShowExtendModal(false);
  };


  // 권한 체크 로직
  const hasPermission = (menuCode: string) => {
    return permissions.includes(menuCode);
  };

  // const hasPermission = (menuCode: string) => {
  //   const walk = (tree: MenuNode[]): boolean =>
  //     tree.some(
  //       m => m.code === menuCode || (m.children && walk(m.children))
  //     );

  //   return walk(menus);
  // };

  // const hasPermission = (menuId: string) => {
  //   const walk = (tree: MenuNode[]): boolean =>
  //     tree.some(m => 
  //       m.code === menuId || 
  //       (m.children && walk(m.children)));

  //   return walk(menus);
  // };

  return (
    <AuthContext.Provider
      value={{ 
        user, role, sessionRemain, 
        logout, isAuthReady, 
        menus,
        isAuthenticated,refreshAuth, 
        hasPermission, permissions
      }}
    >
      {children}
      {showExtendModal && (
      <SessionExtendModal
        remain={sessionRemain}
        onExtend={extendSession}
        onLogout={logout}
      />
    )}
    </AuthContext.Provider>
  );
}

// Context를 안전하게 가져오는 훅
export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}