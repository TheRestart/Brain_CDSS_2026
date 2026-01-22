/**
 * OCS 실시간 알림 Hook
 * - WebSocket을 통해 OCS 상태 변경 알림 수신
 * - Toast 알림 표시
 * - 싱글톤 WebSocket 사용으로 라우팅 시 중복 알림 방지
 */
import { useEffect, useRef, useCallback, useState } from 'react';
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

interface UseOCSNotificationOptions {
  onStatusChanged?: (event: OCSStatusChangedEvent) => void;
  onCreated?: (event: OCSCreatedEvent) => void;
  onCancelled?: (event: OCSCancelledEvent) => void;
  autoRefresh?: () => void;
  /** Toast 알림 비활성화 (콜백만 사용) */
  disableToast?: boolean;
}

export function useOCSNotification(options: UseOCSNotificationOptions = {}) {
  const { isAuthenticated, user } = useAuth();
  const listenerIdRef = useRef<string | null>(null);
  const optionsRef = useRef(options);
  const [notifications, setNotifications] = useState<OCSNotification[]>([]);
  const [isConnected, setIsConnected] = useState(isOCSSocketConnected());

  // options가 변경될 때 ref 업데이트
  useEffect(() => {
    optionsRef.current = options;
  }, [options]);

  const addNotification = useCallback((notification: Omit<OCSNotification, 'id'>) => {
    // Toast 비활성화 옵션이 있으면 알림 추가하지 않음
    if (optionsRef.current.disableToast) {
      return null;
    }

    const newNotification: OCSNotification = {
      ...notification,
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    };

    setNotifications((prev) => [newNotification, ...prev].slice(0, 10));

    setTimeout(() => {
      setNotifications((prev) => prev.filter((n) => n.id !== newNotification.id));
    }, 5000);

    return newNotification;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications((prev) => prev.filter((n) => n.id !== id));
  }, []);

  const clearNotifications = useCallback(() => {
    setNotifications([]);
  }, []);

  useEffect(() => {
    if (!isAuthenticated || !user) {
      return;
    }

    // 이미 구독 중이면 새로 구독하지 않음
    if (listenerIdRef.current) {
      return;
    }

    // 싱글톤 WebSocket에 구독 등록
    listenerIdRef.current = subscribeOCSSocket({
      onStatusChanged: (event) => {
        addNotification({
          type: 'status_changed',
          message: event.message,
          timestamp: event.timestamp,
          ocsId: event.ocs_id,
          ocsPk: event.ocs_pk,
        });

        optionsRef.current.onStatusChanged?.(event);
        optionsRef.current.autoRefresh?.();
      },

      onCreated: (event) => {
        addNotification({
          type: 'created',
          message: event.message,
          timestamp: event.timestamp,
          ocsId: event.ocs_id,
          ocsPk: event.ocs_pk,
        });

        optionsRef.current.onCreated?.(event);
        optionsRef.current.autoRefresh?.();
      },

      onCancelled: (event) => {
        addNotification({
          type: 'cancelled',
          message: event.message,
          timestamp: event.timestamp,
          ocsId: event.ocs_id,
          ocsPk: event.ocs_pk,
        });

        optionsRef.current.onCancelled?.(event);
        optionsRef.current.autoRefresh?.();
      },

      onError: () => {
        setIsConnected(false);
      },

      onClose: () => {
        setIsConnected(false);
      },
    });

    setIsConnected(isOCSSocketConnected());

    // cleanup: 구독 해제
    return () => {
      if (listenerIdRef.current) {
        unsubscribeOCSSocket(listenerIdRef.current);
        listenerIdRef.current = null;
      }
    };
  }, [isAuthenticated, user, addNotification]);

  return {
    notifications,
    isConnected,
    addNotification,
    removeNotification,
    clearNotifications,
  };
}
