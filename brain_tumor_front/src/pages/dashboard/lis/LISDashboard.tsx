import { useState, useEffect } from 'react';
import { LISSummary } from "./LISSummary";
import { LISWorklist } from "./LISWorklist";
import { LISAbnormalAlert } from "./LISAbnormalAlert";
import { WorkflowPipeline } from "../common/WorkflowPipeline";
import { StatusBarChart } from "../common/StatusBarChart";
import { DashboardHeader } from "../common/DashboardHeader";
import { UnifiedCalendar } from "@/components/calendar/UnifiedCalendar";
import { getOCSProcessStatus, type OCSJobStats } from '@/services/ocs.api';

/**
 * LIS (병리실) 대시보드
 *
 * [LIS Summary] - 오늘 접수, 분석 중, 결과 대기, 확정 완료
 * [Workflow Pipeline] - 워크플로우 단계별 현황 시각화
 * [LIS Worklist] - 검사 목록 (검사종류 / 환자 / 상태)
 * [Status Chart] - 상태별 통계 차트
 * [Abnormal Alert] - 긴급 알림
 */
export default function LISDashboard() {
  const [stats, setStats] = useState<OCSJobStats | null>(null);

  useEffect(() => {
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      const response = await getOCSProcessStatus();
      setStats(response.lis);
    } catch (error) {
      console.error('Failed to fetch LIS stats:', error);
    }
  };

  const handleStepClick = (stepId: string) => {
    console.log('Step clicked:', stepId);
    // 추후 해당 상태로 필터링된 목록으로 이동 가능
  };

  return (
    <div className="dashboard lis">
      <DashboardHeader role="LIS" />
      <LISSummary />
      <WorkflowPipeline stats={stats} type="LIS" onStepClick={handleStepClick} />
      <div className="dashboard-row">
        <LISWorklist />
        <UnifiedCalendar title="병리실 통합 캘린더" />
      </div>
      <div className="dashboard-row">
        <LISAbnormalAlert />
        <StatusBarChart stats={stats} type="LIS" title="상태별 검사 현황" />
      </div>
    </div>
  );
}
