import type { ReactNode } from 'react';

export interface SummaryCardProps {
  title: string;
  value: number | string;
  highlight?: boolean;
  danger?: boolean;
  success?: boolean;
  warning?: boolean;
  icon?: ReactNode;
  trend?: {
    value: number;
    direction: 'up' | 'down' | 'neutral';
    label?: string;
  };
  onClick?: () => void;
  subtitle?: string;
}

export default function SummaryCard({
  title,
  value,
  highlight,
  danger,
  success,
  warning,
  icon,
  trend,
  onClick,
  subtitle,
}: SummaryCardProps) {
  const getVariantClass = () => {
    if (danger) return 'danger';
    if (success) return 'success';
    if (warning) return 'warning';
    if (highlight) return 'highlight';
    return '';
  };

  const getTrendIcon = () => {
    if (!trend) return null;
    switch (trend.direction) {
      case 'up':
        return '↑';
      case 'down':
        return '↓';
      default:
        return '→';
    }
  };

  const getTrendClass = () => {
    if (!trend) return '';
    switch (trend.direction) {
      case 'up':
        return 'trend-up';
      case 'down':
        return 'trend-down';
      default:
        return 'trend-neutral';
    }
  };

  return (
    <div
      className={`card summary ${getVariantClass()} ${onClick ? 'clickable' : ''}`}
      onClick={onClick}
    >
      {icon && <div className="summary-icon">{icon}</div>}
      <div className="summary-content">
        <span className="title">{title}</span>
        <div className="value-row">
          <strong className="value">{value}</strong>
          {trend && (
            <span className={`trend ${getTrendClass()}`}>
              <span className="trend-icon">{getTrendIcon()}</span>
              <span className="trend-value">{Math.abs(trend.value)}%</span>
              {trend.label && <span className="trend-label">{trend.label}</span>}
            </span>
          )}
        </div>
        {subtitle && <span className="subtitle">{subtitle}</span>}
      </div>
    </div>
  );
}
