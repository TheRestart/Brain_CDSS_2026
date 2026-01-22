import { DoctorSummaryCards } from "./DoctorSummaryCards";
import { DoctorWorklist } from "./DoctorWorklist";
import { UnifiedCalendar } from "@/components/calendar/UnifiedCalendar";
import { AiAlertPanel } from "./AiAlertPanel";
import PatientListWidget from "../common/PatientListWidget";
import { DashboardHeader } from "../common/DashboardHeader";
import '@/assets/style/patientListView.css';

export default function DoctorDashboard() {
  return (
    <div className="dashboard doctor">
      <DashboardHeader role="DOCTOR" />
      <DoctorSummaryCards />
      <div className="dashboard-row">
        <DoctorWorklist />
        <UnifiedCalendar title="의사 통합 캘린더" />
      </div>
      <div className="dashboard-row">
        <AiAlertPanel />
        <PatientListWidget
          title="최근 환자"
          limit={5}
          showViewAll={true}
        />
      </div>
    </div>
  );
}
