// Imaging types - OCS 통합 버전

export type ImagingModality = 'CT' | 'MRI' | 'PET' | 'X-RAY';

export type ImagingStatus = 'ordered' | 'scheduled' | 'in_progress' | 'completed' | 'reported' | 'cancelled';

export type ReportStatus = 'draft' | 'signed' | 'amended';

export interface TumorLocation {
  lobe: string;
  hemisphere: string;
}

export interface TumorSize {
  max_diameter_cm: number | null;
  volume_cc: number | null;
}

// 작업 노트 (OCS work_notes 배열 아이템)
export interface WorkNote {
  timestamp: string;
  author: string;
  content: string;
}

export interface ImagingStudy {
  id: number;
  ocs_id?: string;  // OCS 통합으로 추가
  patient: number;
  patient_name: string;
  patient_number: string;
  encounter: number | null;  // OCS에서는 encounter_id로 반환
  encounter_id?: number | null;
  encounter_type?: 'outpatient' | 'inpatient' | 'emergency';  // 응급 검사 표시용
  modality: ImagingModality;
  modality_display: string;
  body_part: string;
  status: ImagingStatus;
  status_display: string;
  ordered_by: number;
  ordered_by_name: string;
  ordered_at: string;
  scheduled_at: string | null;
  performed_at: string | null;
  radiologist: number | null;
  radiologist_name: string | null;
  study_uid: string | null;
  series_count: number;
  instance_count: number;
  clinical_info: string;
  special_instruction: string;
  work_notes?: WorkNote[];  // OCS 통합으로 변경 (work_note → work_notes 배열)
  is_completed: boolean;
  has_report: boolean;
  report?: ImagingReport;
  is_deleted?: boolean;
  created_at: string;
  updated_at?: string;
}

export interface ImagingReport {
  id: number;
  imaging_study?: number;  // OCS 통합에서는 OCS ID와 동일
  radiologist: number | null;
  radiologist_name: string | null;
  findings: string;
  impression: string;
  tumor_detected: boolean;
  tumor_location: TumorLocation | null;
  tumor_size: TumorSize | null;
  status: ReportStatus;
  status_display: string;
  signed_at: string | null;
  is_signed: boolean;
  created_at: string;
  updated_at: string;
}

export interface ImagingStudyListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ImagingStudy[];
}

export interface ImagingReportListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ImagingReport[];
}

export interface ImagingStudySearchParams {
  q?: string;
  modality?: ImagingModality;
  status?: ImagingStatus;
  patient?: number;
  encounter?: number;
  radiologist?: number;
  start_date?: string;
  end_date?: string;
  has_report?: boolean;
  report_status?: ReportStatus;
  page?: number;
  page_size?: number;
}

export interface ImagingStudyCreateData {
  patient: number;
  encounter: number | null;  // 외부 환자의 경우 null 허용
  modality: ImagingModality;
  body_part?: string;
  scheduled_at?: string;
  clinical_info?: string;
  special_instruction?: string;
}

export interface ImagingStudyUpdateData {
  modality?: ImagingModality;
  body_part?: string;
  status?: ImagingStatus;
  scheduled_at?: string | null;
  performed_at?: string | null;
  radiologist?: number | null;
  work_note?: string;  // 새 작업 노트 (work_notes 배열에 추가됨)
  study_uid?: string;
  series_count?: number;
  instance_count?: number;
}

export interface ImagingReportCreateData {
  imaging_study: number;
  findings: string;
  impression: string;
  tumor_detected?: boolean;
  tumor_location?: TumorLocation | null;
  tumor_size?: TumorSize | null;
}

export interface ImagingReportUpdateData {
  findings?: string;
  impression?: string;
  tumor_detected?: boolean;
  tumor_location?: TumorLocation | null;
  tumor_size?: TumorSize | null;
  status?: ReportStatus;
}

export interface ImagingStudyDetailResponse extends ImagingStudy {
  patient_details?: {
    id: number;
    name: string;
    patient_number: string;
    gender: string;
    date_of_birth: string;
    age: number;
  };
  encounter_details?: {
    id: number;
    encounter_type: string;
    admission_date: string;
    chief_complaint: string;
  };
  report?: ImagingReport;
}

// Form data for creating report with tumor details
export interface TumorReportFormData {
  tumor_detected: boolean;
  tumor_lobe?: string;
  tumor_hemisphere?: string;
  tumor_max_diameter?: number;
  tumor_volume?: number;
}
