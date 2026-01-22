import type { OCSJobStats } from '@/services/ocs.api';
import './StatusBarChart.css';

interface StatusBarChartProps {
  stats: OCSJobStats | null;
  type: 'LIS' | 'RIS';
  title?: string;
}

interface ChartItem {
  label: string;
  value: number;
  color: string;
}

export function StatusBarChart({ stats, type, title }: StatusBarChartProps) {
  if (!stats) {
    return (
      <div className="status-bar-chart loading">
        <div className="chart-skeleton" />
      </div>
    );
  }

  const items: ChartItem[] = type === 'LIS' ? [
    { label: '접수 대기', value: stats.ordered, color: '#f59e0b' },
    { label: '조직 접수', value: stats.accepted, color: '#eab308' },
    { label: '분석 중', value: stats.in_progress, color: '#06b6d4' },
    { label: '결과 대기', value: stats.result_ready, color: '#8b5cf6' },
    { label: '확정 완료', value: stats.confirmed, color: '#10b981' },
    { label: '취소', value: stats.cancelled, color: '#6b7280' },
  ] : [
    { label: '오더 생성', value: stats.ordered, color: '#f59e0b' },
    { label: '검사 예약', value: stats.accepted, color: '#eab308' },
    { label: '촬영 중', value: stats.in_progress, color: '#06b6d4' },
    { label: '판독 대기', value: stats.result_ready, color: '#8b5cf6' },
    { label: '판독 완료', value: stats.confirmed, color: '#10b981' },
    { label: '취소', value: stats.cancelled, color: '#6b7280' },
  ];

  // 0인 항목 제외 (취소 제외 - 0이어도 표시할 수 있음)
  const displayItems = items.filter(item => item.value > 0 || item.label === '취소');

  const maxValue = Math.max(...items.map(i => i.value), 1);
  const total = items.reduce((sum, i) => sum + i.value, 0);

  return (
    <div className="status-bar-chart">
      {title && (
        <div className="chart-header">
          <h4>{title}</h4>
          <span className="chart-total">총 {total}건</span>
        </div>
      )}

      <div className="chart-container">
        {displayItems.map((item, index) => (
          <div key={index} className="chart-bar-wrapper">
            <div className="bar-label">{item.label}</div>
            <div className="bar-track">
              <div
                className="bar-fill"
                style={{
                  width: `${(item.value / maxValue) * 100}%`,
                  backgroundColor: item.color,
                }}
              />
            </div>
            <div className="bar-value">{item.value}</div>
          </div>
        ))}
      </div>

      {/* 범례 */}
      <div className="chart-legend">
        {items.slice(0, 5).map((item, index) => (
          <div key={index} className="legend-item">
            <span className="legend-color" style={{ backgroundColor: item.color }} />
            <span className="legend-label">{item.label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
