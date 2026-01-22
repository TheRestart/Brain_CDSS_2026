/**
 * OCS 알림 전역 Context
 * - 앱 전역에서 단일 WebSocket 구독 관리
 * - 중복 알림 방지
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import {
  subscribeOCSSocket,
  unsubscribeOCSSocket,
  isOCSSocketConnected,
  type OCSStatusChangedEvent,
  type OCSCreatedEvent,
  type OCSCancelledEvent,
} from '@/socket/ocsSocket';

export interface OCSNotification {
  id: string;
  type: 'status_changed' | 'created' | 'cancelled';
  message: string;
  timestamp: string;
  ocsId: string;
  ocsPk: number;
}

interface OCSNotificationContextValue {
  notifications: OCSNotification[];
  isConnected: boolean;
  removeNotification: (id: string) => void;
  clearNotifications: () => void;
  /** 이벤트 콜백 등록 (페이지별 추가 처리용) */
  addEventCallback: (id: string, callbacks: EventCallbacks) => void;
  removeEventCallback: (id: string) => void;
}

interface EventCallbacks {
  onStatusChanged?: (event: OCSStatusChangedEvent) => void;
  onCreated?: (event: OCSCreatedEvent) => void;
  onCancelled?: (event: OCSCancelledEvent) => void;
}

const OCSNotificationContext = createContext<OCSNotificationContextValue | null>(null);

interface Props {
  children: ReactNode;
}

export function OCSNotificationProvider({ children }: Props) {
  const { isAuthenticated, user } = useAuth();
  const listenerIdRef = useRef<string | null>(null);
  const eventCallbacksRef = useRef<Map<string, EventCallbacks>>(new Map());

  const [notifications, setNotifications] = useState<OCSNotification[]>([]);
  const [isConnected, setIsConnected] = useState(isOCSSocketConnected());

  // 알림 추가
  const addNotification = useCallback((notification: Omit<OCSNotification, 'id'>) => {
    const newNotification: OCSNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 10));

    // 5초 후 자동 제거
    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
    }, 5000);

    return newNotification;
  }, []);

  // 알림 제거
  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  // 모든 알림 제거
  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  // 이벤트 콜백 등록 (페이지별 추가 처리)
  const addEventCallback = useCallback((id: string, callbacks: EventCallbacks) => {
    eventCallbacksRef.current.set(id, callbacks);
  }, []);

  // 이벤트 콜백 해제
  const removeEventCallback = useCallback((id: string) => {
    eventCallbacksRef.current.delete(id);
  }, []);

  // 전역 WebSocket 구독 (사용자 변경 시 재연결)
  useEffect(() => {
    console.log('🔌 [OCSNotificationProvider] useEffect 실행:', { isAuthenticated, user: user?.login_id });

    if (!isAuthenticated || !user) {
      console.log('🔌 [OCSNotificationProvider] 인증 안됨, WebSocket 연결 안함');
      // 로그아웃 시 기존 구독 해제
      if (listenerIdRef.current) {
        unsubscribeOCSSocket(listenerIdRef.current);
        listenerIdRef.current = null;
      }
      return;
    }

    // 이미 구독 중이면 먼저 해제 (사용자 변경 대응 - ocsSocket에서 토큰 비교로 재연결 처리)
    if (listenerIdRef.current) {
      console.log('🔌 [OCSNotificationProvider] 기존 구독 해제 후 재연결:', listenerIdRef.current);
      unsubscribeOCSSocket(listenerIdRef.current);
      listenerIdRef.current = null;
    }

    console.log('🔌 [OCSNotificationProvider] WebSocket 구독 시작...');
    // 싱글톤 WebSocket에 전역 구독 등록
    listenerIdRef.current = subscribeOCSSocket({
      onStatusChanged: (event) => {
        console.log('📥 [OCS] onStatusChanged 수신:', event.message);
        console.log('📥 [OCS] 등록된 콜백 수:', eventCallbacksRef.current.size);

        // Toast 알림 추가
        addNotification({
          type: 'status_changed',
          message: event.message,
          timestamp: event.timestamp,
          ocsId: event.ocs_id,
          ocsPk: event.ocs_pk,
        });

        // 등록된 모든 콜백 실행
        eventCallbacksRef.current.forEach((callbacks, id) => {
          console.log('📥 [OCS] 콜백 실행:', id);
          callbacks.onStatusChanged?.(event);
        });
      },

      onCreated: (event) => {
        console.log('📥 [OCS] onCreated 수신:', event.message);
        console.log('📥 [OCS] 등록된 콜백 수:', eventCallbacksRef.current.size);

        addNotification({
          type: 'created',
          message: event.message,
          timestamp: event.timestamp,
          ocsId: event.ocs_id,
          ocsPk: event.ocs_pk,
        });

        eventCallbacksRef.current.forEach((callbacks, id) => {
          console.log('📥 [OCS] 콜백 실행:', id);
          callbacks.onCreated?.(event);
        });
      },

      onCancelled: (event) => {
        console.log('📥 [OCS] onCancelled 수신:', event.message);
        console.log('📥 [OCS] 등록된 콜백 수:', eventCallbacksRef.current.size);

        addNotification({
          type: 'cancelled',
          message: event.message,
          timestamp: event.timestamp,
          ocsId: event.ocs_id,
          ocsPk: event.ocs_pk,
        });

        eventCallbacksRef.current.forEach((callbacks, id) => {
          console.log('📥 [OCS] 콜백 실행:', id);
          callbacks.onCancelled?.(event);
        });
      },

      onError: () => {
        setIsConnected(false);
      },

      onClose: () => {
        setIsConnected(false);
      },
    });

    console.log('🔌 [OCSNotificationProvider] WebSocket 구독 완료:', listenerIdRef.current);
    setIsConnected(isOCSSocketConnected());

    // cleanup
    return () => {
      console.log('🔌 [OCSNotificationProvider] WebSocket 구독 해제:', listenerIdRef.current);
      if (listenerIdRef.current) {
        unsubscribeOCSSocket(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, [isAuthenticated, user, addNotification]);

  const value: OCSNotificationContextValue = {
    notifications,
    isConnected,
    removeNotification,
    clearNotifications,
    addEventCallback,
    removeEventCallback,
  };

  return (
    <OCSNotificationContext.Provider value={value}>
      {children}
    </OCSNotificationContext.Provider>
  );
}

/**
 * OCS 알림 Context 사용 Hook
 */
export function useOCSNotificationContext() {
  const context = useContext(OCSNotificationContext);
  if (!context) {
    throw new Error('useOCSNotificationContext must be used within OCSNotificationProvider');
  }
  return context;
}

/**
 * 페이지별 이벤트 콜백 등록 Hook
 * - autoRefresh 등 페이지별 추가 동작 등록
 */
export function useOCSEventCallback(callbacks: EventCallbacks & { autoRefresh?: () => void }) {
  const { addEventCallback, removeEventCallback } = useOCSNotificationContext();
  const callbackIdRef = useRef<string | null>(null);

  // useRef로 콜백 참조를 안정화 (무한 루프 방지)
  const callbacksRef = useRef(callbacks);
  callbacksRef.current = callbacks;

  useEffect(() => {
    const id = `callback-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
    callbackIdRef.current = id;

    console.log('📝 [useOCSEventCallback] 콜백 등록:', id);

    // autoRefresh를 각 이벤트에 연결 (ref를 통해 최신 콜백 참조)
    const wrappedCallbacks: EventCallbacks = {
      onStatusChanged: (event) => {
        console.log('🔄 [useOCSEventCallback] onStatusChanged 실행:', id, event.message);
        callbacksRef.current.onStatusChanged?.(event);
        if (callbacksRef.current.autoRefresh) {
          console.log('🔄 [useOCSEventCallback] autoRefresh 호출:', id);
          callbacksRef.current.autoRefresh();
        }
      },
      onCreated: (event) => {
        console.log('🔄 [useOCSEventCallback] onCreated 실행:', id, event.message);
        callbacksRef.current.onCreated?.(event);
        if (callbacksRef.current.autoRefresh) {
          console.log('🔄 [useOCSEventCallback] autoRefresh 호출:', id);
          callbacksRef.current.autoRefresh();
        }
      },
      onCancelled: (event) => {
        console.log('🔄 [useOCSEventCallback] onCancelled 실행:', id, event.message);
        callbacksRef.current.onCancelled?.(event);
        if (callbacksRef.current.autoRefresh) {
          console.log('🔄 [useOCSEventCallback] autoRefresh 호출:', id);
          callbacksRef.current.autoRefresh();
        }
      },
    };

    addEventCallback(id, wrappedCallbacks);

    return () => {
      console.log('📝 [useOCSEventCallback] 콜백 해제:', callbackIdRef.current);
      if (callbackIdRef.current) {
        removeEventCallback(callbackIdRef.current);
        callbackIdRef.current = null;
      }
    };
  }, [addEventCallback, removeEventCallback]); // callbacks 의존성 제거
}
