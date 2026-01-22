/**
 * OCS 알림 Toast 컴포넌트
 */
import type { OCSNotification } from '@/hooks/useOCSNotification';
import './OCSNotificationToast.css';

interface Props {
  notifications: OCSNotification[];
  onDismiss: (id: string) => void;
  onClickNotification?: (notification: OCSNotification) => void;
}

const TYPE_ICONS: Record<OCSNotification['type'], string> = {
  status_changed: '🔄',
  created: '📋',
  cancelled: '❌',
};

const TYPE_COLORS: Record<OCSNotification['type'], string> = {
  status_changed: 'info',
  created: 'success',
  cancelled: 'warning',
};

export default function OCSNotificationToast({
  notifications,
  onDismiss,
  onClickNotification,
}: Props) {
  if (notifications.length === 0) return null;

  return (
    <div className="ocs-toast-container">
      {notifications.map((notification) => (
        <div
          key={notification.id}
          className={`ocs-toast ocs-toast--${TYPE_COLORS[notification.type]}`}
          onClick={() => onClickNotification?.(notification)}
        >
          <span className="ocs-toast__icon">{TYPE_ICONS[notification.type]}</span>
          <div className="ocs-toast__content">
            <p className="ocs-toast__message">{notification.message}</p>
            <span className="ocs-toast__time">
              {new Date(notification.timestamp).toLocaleTimeString('ko-KR')}
            </span>
          </div>
          <button
            className="ocs-toast__close"
            onClick={(e) => {
              e.stopPropagation();
              onDismiss(notification.id);
            }}
          >
            &times;
          </button>
        </div>
      ))}
    </div>
  );
}
