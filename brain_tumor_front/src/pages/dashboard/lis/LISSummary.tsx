import { useState, useEffect } from 'react';
import SummaryCard from '@/pages/common/SummaryCard';
import { getOCSProcessStatus, type OCSJobStats } from '@/services/ocs.api';

// 아이콘 컴포넌트
const ClipboardIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
    <rect x="8" y="2" width="8" height="4" rx="1" ry="1" />
  </svg>
);

const FlaskIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M9 3h6v5l4 9a2 2 0 0 1-1.8 2.9H6.8A2 2 0 0 1 5 17L9 8V3z" />
    <path d="M9 3h6" />
  </svg>
);

const ClockIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <circle cx="12" cy="12" r="10" />
    <polyline points="12 6 12 12 16 14" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export function LISSummary() {
  const [stats, setStats] = useState<OCSJobStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getOCSProcessStatus();
      setStats(response.lis);
    } catch (error) {
      console.error('Failed to fetch LIS stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="summary-cards lis">
        <SummaryCard title="오늘 접수" value={'-'} icon={<ClipboardIcon />} />
        <SummaryCard title="분석 중" value={'-'} icon={<FlaskIcon />} highlight />
        <SummaryCard title="결과 대기" value={'-'} icon={<ClockIcon />} warning />
        <SummaryCard title="확정 완료" value={'-'} icon={<CheckCircleIcon />} success />
      </section>
    );
  }

  return (
    <section className="summary-cards lis">
      <SummaryCard
        title="오늘 접수"
        value={stats?.total_today ?? 0}
        icon={<ClipboardIcon />}
        subtitle="총 접수 건수"
      />
      <SummaryCard
        title="분석 중"
        value={stats?.in_progress ?? 0}
        icon={<FlaskIcon />}
        highlight
        subtitle="진행 중인 병리"
      />
      <SummaryCard
        title="결과 대기"
        value={stats?.result_ready ?? 0}
        icon={<ClockIcon />}
        warning
        subtitle="의사 확인 대기"
      />
      <SummaryCard
        title="확정 완료"
        value={stats?.confirmed ?? 0}
        icon={<CheckCircleIcon />}
        success
        subtitle="오늘 완료"
      />
    </section>
  );
}
