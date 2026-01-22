/**
 * 빈 상태 표시 컴포넌트
 */
import './EmptyState.css';

interface EmptyStateProps {
  icon?: string;
  title?: string;
  description?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
}

export default function EmptyState({
  icon = '📋',
  title = '데이터가 없습니다',
  description,
  action,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      <div className="empty-icon">{icon}</div>
      <h3 className="empty-title">{title}</h3>
      {description && <p className="empty-description">{description}</p>}
      {action && (
        <button className="btn btn-primary empty-action" onClick={action.onClick}>
          {action.label}
        </button>
      )}
    </div>
  );
}
