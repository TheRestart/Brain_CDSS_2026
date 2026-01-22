/**
 * AI 추론 알림 Toast 컴포넌트
 */
import { useAIInference, type AIInferenceNotification } from '@/context/AIInferenceContext';
import './AINotificationToast.css';

export default function AINotificationToast() {
  const { notifications, removeNotification, activeJobs, isFastAPIAvailable } = useAIInference();

  return (
    <div className="ai-toast-container">
      {/* FastAPI 서버 OFF 경고 */}
      {!isFastAPIAvailable && (
        <div className="ai-toast ai-toast-warning ai-toast-persistent">
          <div className="ai-toast-icon">⚠️</div>
          <div className="ai-toast-content">
            <div className="ai-toast-title">AI 서버 연결 실패</div>
            <div className="ai-toast-message">
              FastAPI(추론 모델 서버)가 OFF 상태입니다.
              <br />
              서버 관리자에게 문의하세요.
            </div>
          </div>
        </div>
      )}

      {/* 진행 중인 작업 표시 */}
      {activeJobs.length > 0 && (
        <div className="ai-toast ai-toast-info ai-toast-persistent">
          <div className="ai-toast-icon">
            <span className="ai-spinner"></span>
          </div>
          <div className="ai-toast-content">
            <div className="ai-toast-title">AI 추론 진행 중</div>
            <div className="ai-toast-message">
              {activeJobs.map(job => (
                <div key={job.job_id} className="ai-toast-job">
                  <span className="ai-toast-job-type">{job.model_type}</span>
                  <span className="ai-toast-job-id">{job.job_id}</span>
                  <span className="ai-toast-job-status">{job.status}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* 일반 알림 */}
      {notifications.map(notification => (
        <NotificationItem
          key={notification.id}
          notification={notification}
          onDismiss={() => removeNotification(notification.id)}
        />
      ))}
    </div>
  );
}

interface NotificationItemProps {
  notification: AIInferenceNotification;
  onDismiss: () => void;
}

function NotificationItem({ notification, onDismiss }: NotificationItemProps) {
  const iconMap = {
    success: '✅',
    error: '❌',
    info: 'ℹ️',
    warning: '⚠️',
  };

  return (
    <div className={`ai-toast ai-toast-${notification.type}`}>
      <div className="ai-toast-icon">{iconMap[notification.type]}</div>
      <div className="ai-toast-content">
        <div className="ai-toast-title">{notification.title}</div>
        <div className="ai-toast-message">{notification.message}</div>
        {notification.job_id && (
          <div className="ai-toast-job-id-small">{notification.job_id}</div>
        )}
      </div>
      <button className="ai-toast-close" onClick={onDismiss}>
        ×
      </button>
    </div>
  );
}
