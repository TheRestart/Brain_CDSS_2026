import { useState, useEffect } from 'react';
import SummaryCard from '@/pages/common/SummaryCard';
import { getOCSProcessStatus, type OCSJobStats } from '@/services/ocs.api';

// 아이콘 컴포넌트
const ImageIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
    <circle cx="8.5" cy="8.5" r="1.5" />
    <polyline points="21 15 16 10 5 21" />
  </svg>
);

const FileTextIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
    <line x1="16" y1="13" x2="8" y2="13" />
    <line x1="16" y1="17" x2="8" y2="17" />
    <polyline points="10 9 9 9 8 9" />
  </svg>
);

const AlertTriangleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z" />
    <line x1="12" y1="9" x2="12" y2="13" />
    <line x1="12" y1="17" x2="12.01" y2="17" />
  </svg>
);

const CheckCircleIcon = () => (
  <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
    <path d="M22 11.08V12a10 10 0 1 1-5.93-9.14" />
    <polyline points="22 4 12 14.01 9 11.01" />
  </svg>
);

export function RISSummaryCards() {
  const [stats, setStats] = useState<OCSJobStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getOCSProcessStatus();
      setStats(response.ris);
    } catch (error) {
      console.error('Failed to fetch RIS stats:', error);
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <section className="summary-cards ris">
        <SummaryCard title="오늘 검사 대기" value={'-'} icon={<ImageIcon />} />
        <SummaryCard title="판독 대기" value={'-'} icon={<FileTextIcon />} highlight />
        <SummaryCard title="긴급 검사" value={'-'} icon={<AlertTriangleIcon />} danger />
        <SummaryCard title="판독 완료" value={'-'} icon={<CheckCircleIcon />} success />
      </section>
    );
  }

  // 긴급 건수는 ordered + in_progress 중에서 urgent 우선순위인 것
  const urgentCount = (stats?.ordered ?? 0) + (stats?.accepted ?? 0);

  return (
    <section className="summary-cards ris">
      <SummaryCard
        title="오늘 검사 대기"
        value={stats?.total_today ?? 0}
        icon={<ImageIcon />}
        subtitle="총 검사 건수"
      />
      <SummaryCard
        title="판독 대기"
        value={stats?.result_ready ?? 0}
        icon={<FileTextIcon />}
        highlight
        subtitle="판독 대기 검사"
      />
      <SummaryCard
        title="대기 중"
        value={urgentCount}
        icon={<AlertTriangleIcon />}
        warning
        subtitle="접수 대기"
      />
      <SummaryCard
        title="판독 완료"
        value={stats?.confirmed ?? 0}
        icon={<CheckCircleIcon />}
        success
        subtitle="오늘 완료된 검사"
      />
    </section>
  );
}
