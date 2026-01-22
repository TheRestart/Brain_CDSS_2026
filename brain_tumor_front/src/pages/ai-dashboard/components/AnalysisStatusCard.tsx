import './AnalysisStatusCard.css';

interface AnalysisStatusCardProps {
  title: string;
  count: number;
  icon: string;
  color: 'primary' | 'success' | 'warning' | 'info' | 'error';
  loading?: boolean;
}

const colorMap = {
  primary: '#1976d2',
  success: '#4caf50',
  warning: '#ff9800',
  info: '#2196f3',
  error: '#f44336',
};

const bgColorMap = {
  primary: '#e3f2fd',
  success: '#e8f5e9',
  warning: '#fff3e0',
  info: '#e1f5fe',
  error: '#ffebee',
};

export default function AnalysisStatusCard({
  title,
  count,
  icon,
  color,
  loading = false,
}: AnalysisStatusCardProps) {
  return (
    <div
      className="analysis-status-card"
      style={{ borderLeftColor: colorMap[color] }}
    >
      <div
        className="analysis-status-card__icon"
        style={{ backgroundColor: bgColorMap[color], color: colorMap[color] }}
      >
        <span className="material-icons">{icon}</span>
      </div>
      <div className="analysis-status-card__content">
        <span className="analysis-status-card__title">{title}</span>
        {loading ? (
          <div className="analysis-status-card__skeleton" />
        ) : (
          <span className="analysis-status-card__count">{count.toLocaleString()}</span>
        )}
      </div>
    </div>
  );
}
