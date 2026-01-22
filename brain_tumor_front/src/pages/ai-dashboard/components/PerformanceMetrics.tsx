import './PerformanceMetrics.css';

interface PerformanceData {
  avg_dice_wt?: number;
  avg_dice_tc?: number;
  avg_dice_et?: number;
  avg_processing_time_seconds?: number;
  approval_rate?: number;
  rejection_rate?: number;
}

interface PerformanceMetricsProps {
  data?: PerformanceData;
  loading?: boolean;
}

export default function PerformanceMetrics({ data, loading = false }: PerformanceMetricsProps) {
  if (loading) {
    return (
      <div className="performance-metrics__loading">
        {[...Array(4)].map((_, i) => (
          <div key={i} className="performance-metrics__skeleton" />
        ))}
      </div>
    );
  }

  if (!data) {
    return (
      <div className="performance-metrics__empty">
        <span className="material-icons">analytics</span>
        <p>성능 데이터가 없습니다</p>
      </div>
    );
  }

  const avgDice =
    data.avg_dice_wt && data.avg_dice_tc && data.avg_dice_et
      ? ((data.avg_dice_wt + data.avg_dice_tc + data.avg_dice_et) / 3).toFixed(3)
      : '-';

  return (
    <div className="performance-metrics">
      <div className="performance-metrics__item">
        <div className="performance-metrics__icon performance-metrics__icon--blue">
          <span className="material-icons">speed</span>
        </div>
        <div className="performance-metrics__content">
          <span className="performance-metrics__label">평균 Dice Score</span>
          <span className="performance-metrics__value">{avgDice}</span>
          <div className="performance-metrics__sub">
            <span>WT: {data.avg_dice_wt?.toFixed(3) ?? '-'}</span>
            <span>TC: {data.avg_dice_tc?.toFixed(3) ?? '-'}</span>
            <span>ET: {data.avg_dice_et?.toFixed(3) ?? '-'}</span>
          </div>
        </div>
      </div>

      <div className="performance-metrics__item">
        <div className="performance-metrics__icon performance-metrics__icon--green">
          <span className="material-icons">check_circle</span>
        </div>
        <div className="performance-metrics__content">
          <span className="performance-metrics__label">승인율</span>
          <span className="performance-metrics__value">
            {data.approval_rate !== undefined ? `${(data.approval_rate * 100).toFixed(1)}%` : '-'}
          </span>
        </div>
      </div>

      <div className="performance-metrics__item">
        <div className="performance-metrics__icon performance-metrics__icon--red">
          <span className="material-icons">cancel</span>
        </div>
        <div className="performance-metrics__content">
          <span className="performance-metrics__label">반려율</span>
          <span className="performance-metrics__value">
            {data.rejection_rate !== undefined ? `${(data.rejection_rate * 100).toFixed(1)}%` : '-'}
          </span>
        </div>
      </div>

      <div className="performance-metrics__item">
        <div className="performance-metrics__icon performance-metrics__icon--orange">
          <span className="material-icons">timer</span>
        </div>
        <div className="performance-metrics__content">
          <span className="performance-metrics__label">평균 처리 시간</span>
          <span className="performance-metrics__value">
            {data.avg_processing_time_seconds !== undefined
              ? `${data.avg_processing_time_seconds.toFixed(1)}초`
              : '-'}
          </span>
        </div>
      </div>
    </div>
  );
}
