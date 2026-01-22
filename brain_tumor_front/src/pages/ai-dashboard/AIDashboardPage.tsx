import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { getAIAnalyticsStats, getModelUsageStats } from '@/services/ai.api';
import AnalysisStatusCard from './components/AnalysisStatusCard';
import ModelUsageChart from './components/ModelUsageChart';
import ResultDistribution from './components/ResultDistribution';
import RecentAnalysisList from './components/RecentAnalysisList';
import PerformanceMetrics from './components/PerformanceMetrics';
import HighRiskAlerts from './components/HighRiskAlerts';
import './AIDashboardPage.css';

type PeriodType = 'day' | 'week' | 'month';

export default function AIDashboardPage() {
  const [period, setPeriod] = useState<PeriodType>('week');

  // AI 분석 통계 조회
  const { data: stats, isLoading: statsLoading } = useQuery({
    queryKey: ['ai-analytics-stats'],
    queryFn: () => getAIAnalyticsStats(),
    refetchInterval: 30000, // 30초마다 갱신
  });

  // 모델별 사용 통계 조회
  const { data: usageStats, isLoading: usageLoading } = useQuery({
    queryKey: ['ai-model-usage', period],
    queryFn: () => getModelUsageStats(period),
  });

  const isLoading = statsLoading || usageLoading;

  return (
    <div className="page ai-dashboard-page">
      <div className="ai-dashboard-page__header">
        <h1 className="ai-dashboard-page__title">AI 분석 대시보드</h1>
        <div className="ai-dashboard-page__period-selector">
          <button
            className={`ai-dashboard-page__period-btn ${period === 'day' ? 'ai-dashboard-page__period-btn--active' : ''}`}
            onClick={() => setPeriod('day')}
          >
            일간
          </button>
          <button
            className={`ai-dashboard-page__period-btn ${period === 'week' ? 'ai-dashboard-page__period-btn--active' : ''}`}
            onClick={() => setPeriod('week')}
          >
            주간
          </button>
          <button
            className={`ai-dashboard-page__period-btn ${period === 'month' ? 'ai-dashboard-page__period-btn--active' : ''}`}
            onClick={() => setPeriod('month')}
          >
            월간
          </button>
        </div>
      </div>

      {/* 분석 현황 카드 */}
      <div className="ai-dashboard-page__status-cards">
        <AnalysisStatusCard
          title="전체 분석"
          count={stats?.total_analyses ?? 0}
          icon="analytics"
          color="primary"
          loading={isLoading}
        />
        <AnalysisStatusCard
          title="완료"
          count={stats?.completed ?? 0}
          icon="check_circle"
          color="success"
          loading={isLoading}
        />
        <AnalysisStatusCard
          title="진행중"
          count={stats?.in_progress ?? 0}
          icon="pending"
          color="warning"
          loading={isLoading}
        />
        <AnalysisStatusCard
          title="대기"
          count={stats?.pending ?? 0}
          icon="hourglass_empty"
          color="info"
          loading={isLoading}
        />
      </div>

      {/* 차트 영역 */}
      <div className="ai-dashboard-page__charts">
        <div className="ai-dashboard-page__chart-card">
          <h3 className="ai-dashboard-page__chart-title">모델별 사용 추이</h3>
          <ModelUsageChart data={usageStats?.data ?? []} loading={usageLoading} />
        </div>
        <div className="ai-dashboard-page__chart-card">
          <h3 className="ai-dashboard-page__chart-title">결과 분포 (등급)</h3>
          <ResultDistribution
            data={stats?.result_distribution?.grade ?? { G2: 0, G3: 0, G4: 0 }}
            loading={statsLoading}
          />
        </div>
      </div>

      {/* 하단 영역 */}
      <div className="ai-dashboard-page__bottom">
        <div className="ai-dashboard-page__metrics-card">
          <h3 className="ai-dashboard-page__chart-title">성능 지표</h3>
          <PerformanceMetrics data={stats?.performance} loading={statsLoading} />
        </div>
        <div className="ai-dashboard-page__alerts-card">
          <h3 className="ai-dashboard-page__chart-title">고위험 환자 알림</h3>
          <HighRiskAlerts patients={stats?.high_risk_patients ?? []} loading={statsLoading} />
        </div>
      </div>

      {/* 최근 분석 목록 */}
      <div className="ai-dashboard-page__recent">
        <h3 className="ai-dashboard-page__chart-title">최근 분석 요청</h3>
        <RecentAnalysisList />
      </div>
    </div>
  );
}
