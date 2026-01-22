import { api } from './api';

// 통합 보고서 타입
export interface UnifiedReport {
  id: string;
  type: string;
  type_display: string;
  sub_type: string;
  patient_id: number | null;
  patient_number: string | null;
  patient_name: string | null;
  title: string;
  status: string;
  status_display: string;
  result: any;
  result_display: string;
  created_at: string | null;
  completed_at: string | null;
  author: string | null;
  doctor: string | null;
  thumbnail: ReportThumbnail;
  link: string;
}

// 채널별 썸네일 정보 (T1, T1C, T2, FLAIR, SEG)
export interface ChannelThumbnail {
  channel: 'T1' | 'T1C' | 'T2' | 'FLAIR' | 'SEG';
  url: string;
  description: string;
}

export interface ReportThumbnail {
  type: 'image' | 'icon' | 'segmentation' | 'chart' | 'dicom' | 'dicom_multi'
      | 'segmentation_overlay' | 'segmentation_with_mri';
  url?: string;
  icon?: string;
  color?: string;
  job_id?: string;
  api_url?: string;
  chart_type?: string;
  // DICOM 썸네일 관련
  orthanc_study_id?: string;
  thumbnails_url?: string;
  channels?: ChannelThumbnail[];
  // 세그멘테이션 오버레이 관련 (M1 추론)
  overlay_url?: string;
}

export interface UnifiedReportResponse {
  count: number;
  reports: UnifiedReport[];
}

export interface ReportDashboardParams {
  patient_id?: number;
  report_type?: 'OCS_RIS' | 'OCS_LIS' | 'AI_M1' | 'AI_MG' | 'AI_MM' | 'FINAL';
  date_from?: string;
  date_to?: string;
  limit?: number;
}

// 환자 타임라인 아이템
export interface TimelineItem {
  id: string;
  type: string;
  type_display: string;
  sub_type: string;
  title: string;
  date: string;
  status: string;
  result: string;
  result_flag: 'normal' | 'abnormal' | 'ai' | 'final';
  author: string | null;
  link: string;
}

export interface PatientTimelineResponse {
  patient_id: number;
  patient_number: string;
  patient_name: string;
  count: number;
  timeline: TimelineItem[];
}

// 통합 보고서 대시보드 조회
export async function getReportDashboard(params?: ReportDashboardParams): Promise<UnifiedReportResponse> {
  const response = await api.get('/reports/dashboard/', { params });
  return response.data;
}

// 환자별 보고서 타임라인 조회
export async function getPatientReportTimeline(patientId: number): Promise<PatientTimelineResponse> {
  const response = await api.get(`/reports/patient/${patientId}/timeline/`);
  return response.data;
}

// ============================================
// FinalReport (최종 보고서) API
// ============================================

// 보고서 상태
export type ReportStatus = 'DRAFT' | 'PENDING_REVIEW' | 'APPROVED' | 'FINALIZED' | 'CANCELLED';

// 보고서 유형
export type FinalReportType = 'INITIAL' | 'FOLLOWUP' | 'DISCHARGE' | 'FINAL';

// 보고서 첨부파일
export interface ReportAttachment {
  id: number;
  file_type: 'IMAGE' | 'DOCUMENT' | 'DICOM' | 'OTHER';
  file_name: string;
  file_path: string;
  file_size: number;
  description: string;
  uploaded_by: number;
  uploaded_by_name: string;
  created_at: string;
}

// 보고서 로그
export interface ReportLog {
  id: number;
  action: string;
  action_display: string;
  message: string;
  details: Record<string, unknown>;
  actor: number;
  actor_name: string;
  created_at: string;
}

// 보고서 목록 아이템
export interface FinalReportListItem {
  id: number;
  report_id: string;
  patient: number;
  patient_name: string;
  patient_number: string;
  report_type: FinalReportType;
  report_type_display: string;
  status: ReportStatus;
  status_display: string;
  primary_diagnosis: string;
  diagnosis_date: string;
  created_by: number;
  created_by_name: string;
  author_department: string;
  created_at: string;
  updated_at: string;
}

// 보고서 상세
export interface FinalReportDetail extends FinalReportListItem {
  encounter: number | null;
  secondary_diagnoses: string[];
  treatment_summary: string;
  treatment_plan: string;
  ai_analysis_summary: string;
  clinical_findings: string;
  doctor_opinion: string;
  recommendations: string;
  prognosis: string;
  author_work_station: string;
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  reviewed_at: string | null;
  approved_by: number | null;
  approved_by_name: string | null;
  approved_at: string | null;
  finalized_at: string | null;
  attachments: ReportAttachment[];
  logs: ReportLog[];
}

// 보고서 생성/수정 데이터
export interface FinalReportCreateData {
  patient: number;
  encounter?: number;
  report_type?: FinalReportType;
  primary_diagnosis: string;
  secondary_diagnoses?: string[];
  diagnosis_date: string;
  treatment_summary?: string;
  treatment_plan?: string;
  ai_analysis_summary?: string;
  clinical_findings?: string;
  doctor_opinion?: string;
  recommendations?: string;
  prognosis?: string;
}

export interface FinalReportUpdateData {
  report_type?: FinalReportType;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  diagnosis_date?: string;
  treatment_summary?: string;
  treatment_plan?: string;
  ai_analysis_summary?: string;
  clinical_findings?: string;
  doctor_opinion?: string;
  recommendations?: string;
  prognosis?: string;
}

// 보고서 목록 조회 파라미터
export interface FinalReportListParams {
  patient_id?: number;
  status?: ReportStatus;
  report_type?: FinalReportType;
}

// 보고서 목록 조회
export async function getFinalReportList(params?: FinalReportListParams): Promise<FinalReportListItem[]> {
  const response = await api.get('/reports/', { params });
  return response.data;
}

// 보고서 상세 조회
export async function getFinalReportDetail(id: number): Promise<FinalReportDetail> {
  const response = await api.get(`/reports/${id}/`);
  return response.data;
}

// 보고서 생성
export async function createFinalReport(data: FinalReportCreateData): Promise<FinalReportDetail> {
  const response = await api.post('/reports/', data);
  return response.data;
}

// 보고서 수정
export async function updateFinalReport(id: number, data: FinalReportUpdateData): Promise<FinalReportDetail> {
  const response = await api.patch(`/reports/${id}/`, data);
  return response.data;
}

// 보고서 삭제
export async function deleteFinalReport(id: number): Promise<void> {
  await api.delete(`/reports/${id}/`);
}

// 보고서 검토 제출
export async function submitFinalReport(id: number): Promise<FinalReportDetail> {
  const response = await api.post(`/reports/${id}/submit/`);
  return response.data;
}

// 보고서 승인
export async function approveFinalReport(id: number): Promise<FinalReportDetail> {
  const response = await api.post(`/reports/${id}/approve/`);
  return response.data;
}

// 보고서 최종 확정
export async function finalizeFinalReport(id: number): Promise<FinalReportDetail> {
  const response = await api.post(`/reports/${id}/finalize/`);
  return response.data;
}
