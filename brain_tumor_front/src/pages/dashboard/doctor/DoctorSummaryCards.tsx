// 오늘 진료 요약 (카드형 KPI)
import { useState, useEffect } from 'react';
import { getDoctorStats } from '@/services/dashboard.api';
import type { DoctorStats } from '@/services/dashboard.api';
import SummaryCard from '@/pages/common/SummaryCard';

export function DoctorSummaryCards() {
  const [stats, setStats] = useState<DoctorStats['stats'] | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      try {
        const data = await getDoctorStats();
        setStats(data.stats);
      } catch (err) {
        console.error('Failed to load doctor stats:', err);
      } finally {
        setLoading(false);
      }
    };
    loadStats();
  }, []);

  if (loading) {
    return (
      <section className="summary-cards">
        <SummaryCard title="오늘 진료 예정" value={'-'} />
        <SummaryCard title="진료 중" value={'-'} highlight />
        <SummaryCard title="AI Alert" value={'-'} danger />
        <SummaryCard title="완료" value={'-'} />
      </section>
    );
  }

  return (
    <section className="summary-cards">
      <SummaryCard title="오늘 진료 예정" value={stats?.total_today ?? 0} />
      <SummaryCard title="진료 중" value={stats?.in_progress ?? 0} highlight />
      <SummaryCard title="AI Alert" value={2} danger />
      <SummaryCard title="완료" value={stats?.completed ?? 0} />
    </section>
  );
}
