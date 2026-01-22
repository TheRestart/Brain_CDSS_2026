import { useState, useEffect } from 'react';
import { RISSummaryCards } from "./RISSummaryCards";
import { RISWorklist } from "./RISWorklist";
import { RISPendingReports } from "./RISPendingReports";
import { WorkflowPipeline } from "../common/WorkflowPipeline";
import { StatusBarChart } from "../common/StatusBarChart";
import { DashboardHeader } from "../common/DashboardHeader";
import { UnifiedCalendar } from "@/components/calendar/UnifiedCalendar";
import { getOCSProcessStatus, type OCSJobStats } from '@/services/ocs.api';

/**
 * RIS (영상실) 대시보드
 *
 * [RIS Summary] - 오늘 검사 대기, 판독 대기, 긴급 검사, 판독 완료
 * [Workflow Pipeline] - 워크플로우 단계별 현황 시각화
 * [RIS Worklist] - 영상 검사 목록 (모달리티 / 환자 / 상태)
 * [Status Chart] - 상태별 통계 차트
 * [Pending Reports] - 판독 대기 목록
 */
export default function RISDashboard() {
  const [stats, setStats] = useState<OCSJobStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getOCSProcessStatus();
      setStats(response.ris);
    } catch (error) {
      console.error('Failed to fetch RIS stats:', error);
    }
  };

  const handleStepClick = (stepId: string) => {
    console.log('Step clicked:', stepId);
    // 추후 해당 상태로 필터링된 목록으로 이동 가능
  };

  return (
    <div className="dashboard ris">
      <DashboardHeader role="RIS" />
      <RISSummaryCards />
      <WorkflowPipeline stats={stats} type="RIS" onStepClick={handleStepClick} />
      <div className="dashboard-row">
        <RISWorklist />
        <UnifiedCalendar title="RIS 통합 캘린더" />
      </div>
      <div className="dashboard-row">
        <RISPendingReports />
        <StatusBarChart stats={stats} type="RIS" title="상태별 영상 검사 현황" />
      </div>
    </div>
  );
}
