import { lazy, type ComponentType } from 'react';

// Lazy loading으로 코드 스플리팅
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'));
const PatientListPage = lazy(() => import('@/pages/patient/PatientListPage'));
const PatientDetailPage = lazy(() => import('@/pages/patient/PatientDetailPage'));
// 레거시: OCS RIS 워크리스트로 대체됨
// const ImagingListPage = lazy(() => import('@/pages/imaging/ImagingListPage'));
const PatientImagingHistoryPage = lazy(() => import('@/pages/imaging/PatientImagingHistoryPage'));
const MenuPermissionPage = lazy(() => import('@/pages/admin/MenuPermissionPage'));
const UserList = lazy(() => import('@/pages/admin/usersManagement/UserList'));
const AuditLog = lazy(() => import('@/pages/admin/AuditLog'));
const SystemMonitorPage = lazy(() => import('@/pages/admin/SystemMonitorPage'));
const UserDetailPage = lazy(() => import('@/pages/admin/usersManagement/UserDetailPage'));
const RoleControlPage = lazy(() => import('@/pages/admin/roleManagement/RoleControlPage'));
const PdfWatermarkSettingsPage = lazy(() => import('@/pages/admin/PdfWatermarkSettingsPage'));

// OCS 페이지들 (통합됨)
const OCSCreatePage = lazy(() => import('@/pages/ocs/OCSCreatePage'));
const OCSStatusPage = lazy(() => import('@/pages/ocs/OCSStatusPage'));
const OCSManagePage = lazy(() => import('@/pages/ocs/OCSManagePage'));
const OCSRISWorklistPage = lazy(() => import('@/pages/ocs/RISWorklistPage'));
const RISStudyDetailPage = lazy(() => import('@/pages/ocs/RISStudyDetailPage'));
const LISWorklistPage = lazy(() => import('@/pages/ocs/LISWorklistPage'));
const LISStudyDetailPage = lazy(() => import('@/pages/ocs/LISStudyDetailPage'));
const RISProcessStatusPage = lazy(() => import('@/pages/ocs/RISProcessStatusPage'));
const LISUploadPage = lazy(() => import('@/pages/ocs/LISUploadPage'));
const LISProcessStatusPage = lazy(() => import('@/pages/ocs/LISProcessStatusPage'));
const RISUploadPage = lazy(() => import('@/pages/ocs/RISUploadPage'));
const OCSProcessStatusPage = lazy(() => import('@/pages/ocs/OCSProcessStatusPage'));

// Lab, Clinic
// 레거시: OCS LIS 워크리스트로 대체됨
// const LabListPage = lazy(() => import('@/pages/lab/LabListPage'));
const ClinicPage = lazy(() => import('@/pages/clinic/ClinicPage'));

// Encounter
const EncounterListPage = lazy(() => import('@/pages/encounter/EncounterListPage'));
const EncounterDetailPage = lazy(() => import('@/pages/encounter/EncounterDetailPage'));

// AI Inference
const AIRequestListPage = lazy(() => import('@/pages/ai-inference/AIRequestListPage'));
const AIRequestDetailPage = lazy(() => import('@/pages/ai-inference/AIRequestDetailPage'));
const AIProcessStatusPage = lazy(() => import('@/pages/ai-inference/AIProcessStatusPage'));
const AIModelsPage = lazy(() => import('@/pages/ai-inference/AIModelsPage'));
// AI 신규 분석 페이지 (M1, MG, MM)
const M1InferencePage = lazy(() => import('@/pages/ai-inference/M1InferencePage'));
const M1DetailPage = lazy(() => import('@/pages/ai-inference/M1DetailPage'));
const MGInferencePage = lazy(() => import('@/pages/ai-inference/MGInferencePage'));
const MGDetailPage = lazy(() => import('@/pages/ai-inference/MGDetailPage'));
const MMInferencePage = lazy(() => import('@/pages/ai-inference/MMInferencePage'));
const MMDetailPage = lazy(() => import('@/pages/ai-inference/MMDetailPage'));
const AIDashboardPage = lazy(() => import('@/pages/ai-dashboard/AIDashboardPage'));
// AI 결과 비교 페이지 (담당자 A)
const AICompareListPage = lazy(() => import('@/pages/ai-inference/AICompareListPage'));
const AICompareDetailPage = lazy(() => import('@/pages/ai-inference/AICompareDetailPage'));
// Patient Portal (환자 전용 - MY_CARE)
const MySummaryPage = lazy(() => import('@/pages/patient-portal/MySummaryPage'));
const MyVisitsPage = lazy(() => import('@/pages/patient-portal/MyVisitsPage'));
const MyImagingPage = lazy(() => import('@/pages/patient-portal/MyImagingPage'));
const MyLabPage = lazy(() => import('@/pages/patient-portal/MyLabPage'));
const AboutHospitalPage = lazy(() => import('@/pages/patient-portal/AboutHospitalPage'));

// Report (보고서)
const ReportDashboardPage = lazy(() => import('@/pages/report/ReportDashboardPage'));
const ReportListPage = lazy(() => import('@/pages/report/ReportListPage'));
const ReportCreatePage = lazy(() => import('@/pages/report/ReportCreatePage'));
const ReportDetailPage = lazy(() => import('@/pages/report/ReportDetailPage'));


/**
 * DB 메뉴 code ↔ React 컴포넌트 매핑 (계약서)
 *
 * 메뉴 그룹 구조:
 * ├── DASHBOARD
 * ├── PATIENT: PATIENT_LIST, PATIENT_DETAIL, PATIENT_CARE, ENCOUNTER_LIST
 * ├── OCS: OCS_STATUS, OCS_CREATE, OCS_MANAGE
 * ├── IMAGING: IMAGE_VIEWER, OCS_RIS, OCS_RIS_DETAIL, RIS_DASHBOARD, RIS_RESULT_UPLOAD
 * ├── LAB: LAB_RESULT_VIEW, LAB_RESULT_UPLOAD, OCS_LIS, OCS_LIS_DETAIL, LIS_PROCESS_STATUS
 * ├── AI: AI_REQUEST_LIST, AI_REQUEST_DETAIL, AI_PROCESS_STATUS, AI_MODELS,
 * │       AI_M1_INFERENCE, AI_M1_DETAIL, AI_MG_INFERENCE, AI_MG_DETAIL, AI_MM_INFERENCE, AI_MM_DETAIL,
 * │       AI_DASHBOARD, AI_COMPARE_LIST, AI_COMPARE_DETAIL
 * ├── REPORT: REPORT_DASHBOARD, REPORT_LIST, REPORT_CREATE, REPORT_DETAIL
 * ├── ADMIN: ADMIN_USER, ADMIN_USER_DETAIL, ADMIN_ROLE, ADMIN_MENU_PERMISSION, ADMIN_AUDIT_LOG, ADMIN_SYSTEM_MONITOR
 * └── MY_CARE (환자 전용): MY_SUMMARY, MY_VISITS, MY_IMAGING, MY_LAB
 */
export const routeMap: Record<string, ComponentType> = {
  // === DASHBOARD ===
  DASHBOARD: DashboardPage,

  // === PATIENT 그룹 ===
  PATIENT_LIST: PatientListPage,
  PATIENT_DETAIL: PatientDetailPage,
  PATIENT_CARE: ClinicPage,
  ENCOUNTER_LIST: EncounterListPage,
  ENCOUNTER_DETAIL: EncounterDetailPage,

  // === OCS 그룹 ===
  OCS_STATUS: OCSStatusPage,       // OCS 현황 (간호사/관리자용)
  OCS_CREATE: OCSCreatePage,       // OCS 생성
  OCS_MANAGE: OCSManagePage,       // OCS 관리 (의사용)
  OCS_PROCESS_STATUS: OCSProcessStatusPage, // OCS 통합 처리 현황

  // === IMAGING 그룹 ===
  // IMAGE_VIEWER: OCS RIS 워크리스트로 통합 (레거시 ImagingListPage 대체)
  IMAGE_VIEWER: OCSRISWorklistPage,
  PATIENT_IMAGING_HISTORY: PatientImagingHistoryPage,
  OCS_RIS: OCSRISWorklistPage,
  OCS_RIS_DETAIL: RISStudyDetailPage,
  RIS_DASHBOARD: RISProcessStatusPage,
  RIS_RESULT_UPLOAD: RISUploadPage,

  // === LAB 그룹 ===
  // LAB_RESULT_VIEW: OCS LIS 워크리스트로 통합 (레거시 LabListPage 대체)
  LAB_RESULT_VIEW: LISWorklistPage,
  LAB_RESULT_UPLOAD: LISUploadPage,
  OCS_LIS: LISWorklistPage,
  OCS_LIS_DETAIL: LISStudyDetailPage,
  LIS_PROCESS_STATUS: LISProcessStatusPage,

  // === AI 그룹 ===
  AI_REQUEST_LIST: AIRequestListPage,
  AI_REQUEST_DETAIL: AIRequestDetailPage,
  AI_PROCESS_STATUS: AIProcessStatusPage,
  AI_MODELS: AIModelsPage,
  // AI 신규 분석 페이지 (M1, MG, MM)
  AI_M1_INFERENCE: M1InferencePage,
  AI_M1_DETAIL: M1DetailPage,
  AI_MG_INFERENCE: MGInferencePage,
  AI_MG_DETAIL: MGDetailPage,
  AI_MM_INFERENCE: MMInferencePage,
  AI_MM_DETAIL: MMDetailPage,
  AI_DASHBOARD: AIDashboardPage,
  // AI 결과 비교 페이지 (담당자 A)
  AI_COMPARE_LIST: AICompareListPage,
  AI_COMPARE_DETAIL: AICompareDetailPage,

  // === ADMIN 그룹 ===
  ADMIN_USER: UserList,
  ADMIN_USER_DETAIL: UserDetailPage,
  ADMIN_ROLE: RoleControlPage,
  ADMIN_MENU_PERMISSION: MenuPermissionPage,
  ADMIN_AUDIT_LOG: AuditLog,
  ADMIN_SYSTEM_MONITOR: SystemMonitorPage,
  ADMIN_PDF_WATERMARK: PdfWatermarkSettingsPage,

  // === MY_CARE 그룹 (환자 전용) ===
  MY_SUMMARY: MySummaryPage,
  MY_VISITS: MyVisitsPage,
  MY_IMAGING: MyImagingPage,
  MY_LAB: MyLabPage,
  ABOUT_HOSPITAL: AboutHospitalPage,

  // === REPORT 그룹 ===
  REPORT_DASHBOARD: ReportDashboardPage,
  REPORT_LIST: ReportListPage,
  REPORT_CREATE: ReportCreatePage,
  REPORT_DETAIL: ReportDetailPage,
};