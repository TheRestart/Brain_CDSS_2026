// OCS (Order Communication System) types

// =============================================================================
// Enums & Constants
// =============================================================================

export type OcsStatus =
  | 'ORDERED'
  | 'ACCEPTED'
  | 'IN_PROGRESS'
  | 'RESULT_READY'
  | 'CONFIRMED'
  | 'CANCELLED';

export type Priority = 'urgent' | 'normal';

export type JobRole = 'RIS' | 'LIS' | 'TREATMENT' | 'CONSULT';

export const OCS_STATUS_LABELS: Record<OcsStatus, string> = {
  ORDERED: '오더 생성',
  ACCEPTED: '접수 완료',
  IN_PROGRESS: '진행 중',
  RESULT_READY: '결과 대기',
  CONFIRMED: '확정 완료',
  CANCELLED: '취소됨',
};

export const PRIORITY_LABELS: Record<Priority, string> = {
  urgent: '긴급',
  normal: '일반',
};

export const JOB_ROLE_LABELS: Record<JobRole, string> = {
  RIS: '영상의학',
  LIS: '검사실',
  TREATMENT: '치료',
  CONSULT: '협진',
};

// =============================================================================
// Minimal Types (for nested responses)
// =============================================================================

export interface UserMinimal {
  id: number;
  login_id: string;
  name: string;
}

export interface PatientMinimal {
  id: number;
  patient_number: string;
  name: string;
}

// =============================================================================
// JSON Field Types
// =============================================================================

export interface DoctorRequest {
  _template: string;
  _version: string;
  chief_complaint: string;
  clinical_info: string;
  request_detail: string;
  special_instruction: string;
  _custom: Record<string, unknown>;
}

// RIS worker result (v1.2 - 중복 필드 제거, LocalStorage 파일 저장)
export interface RISWorkerResult {
  _template: 'RIS';
  _version: string;  // '1.2' - 중복 필드 제거 및 LocalStorage 파일 저장
  _confirmed: boolean;

  // Orthanc 연동 정보 (주 저장소 - DICOM 업로드 시 자동 저장)
  orthanc?: {
    patient_id: string;        // Orthanc Patient ID (MySQL patient_number 기반)
    orthanc_study_id: string;  // Orthanc Internal Study ID (API 호출용)
    study_id: string;          // DICOM StudyID (UUID)
    study_uid: string;         // StudyInstanceUID (OCS_{ocsId}_{patientId}_{timestamp})
    series: {
      orthanc_id: string;      // Orthanc Series ID
      series_uid: string;      // SeriesInstanceUID
      series_type: string;     // T1, T2, T1C, FLAIR, OTHER
      description: string;     // Series Description (폴더명)
      instances_count: number; // Instance 수
    }[];
    uploaded_at: string;       // 업로드 일시
  } | null;

  // dicom 필드 (호환성 유지 - orthanc에서 파생된 최소 정보만)
  dicom?: {
    study_uid: string;
    series_count: number;
    instance_count: number;
  };

  impression: string;
  findings: string;
  recommendation: string;

  // 뇌종양 판독 결과
  tumorDetected?: boolean | null;  // true: 종양 있음, false: 종양 없음, null: 미판정

  // 검사 결과 항목 (UI에서 추가)
  imageResults?: {
    itemName: string;
    value: string;
    unit: string;
    refRange: string;
    flag: 'normal' | 'abnormal' | 'critical';
  }[];

  // 첨부 파일 (LocalStorage 참조 방식 - dataUrl 제외)
  files?: {
    name: string;
    size: number;
    type: string;
    uploadedAt: string;
    storageKey: string;  // LocalStorage 참조 키 (dataUrl은 LocalStorage에 저장)
  }[];

  _custom: Record<string, unknown>;
}

// LIS worker result - 확장된 구조 (BLOOD, GENETIC, PROTEIN 등)
export interface LISWorkerResult {
  _template: 'LIS';
  _version: string;
  _confirmed: boolean;
  test_type?: string; // BLOOD, GENETIC, PROTEIN, URINE, CSF, BIOPSY

  // 기본 검사 결과 (BLOOD, URINE, CSF 등)
  test_results: {
    code: string;
    name: string;
    value: string;
    unit: string;
    reference: string;
    is_abnormal: boolean;
  }[];
  summary: string;
  interpretation: string;

  // 유전자 검사 (GENETIC)
  RNA_seq?: string | null; // RNA 시퀀싱 결과 파일 경로 (하위 호환성)
  gene_expression?: GeneExpressionData | null; // 유전자 발현 데이터 (v1.2+)
  gene_mutations?: GeneMutation[]; // 유전자 변이 목록
  sequencing_data?: {
    method?: string; // 시퀀싱 방법 (e.g., "NGS", "Sanger")
    coverage?: number; // 커버리지 (%)
    quality_score?: number; // 품질 점수
    raw_data_path?: string; // 원본 데이터 경로
  };

  // 단백질 검사 (PROTEIN)
  protein?: string | null; // 단백질 분석 결과
  protein_markers?: ProteinMarker[]; // 단백질 마커 목록

  // 조직 검사 (BIOPSY)
  biopsy_result?: {
    tissue_type?: string;
    pathology_findings?: string;
    grade?: string;
    stage?: string;
  };

  _custom: Record<string, unknown>;
}

// 유전자 발현 데이터 타입 (AI 추론용)
export interface GeneExpressionData {
  file_path: string; // CDSS_STORAGE 경로 포함
  file_name?: string; // 실제 저장된 파일명 (타임스탬프 포함)
  file_size?: number;
  uploaded_at?: string;
  total_genes?: number; // 분석된 유전자 수
  top_expressed_genes?: Array<{
    entrez_id: string;
    expression: number;
    gene_symbol: string;
  }>;
}

// 유전자 변이 타입
export interface GeneMutation {
  gene_name: string; // 유전자명 (e.g., "TP53", "IDH1")
  mutation_type: string; // 변이 유형 (e.g., "missense", "deletion")
  position?: string; // 위치 정보
  variant?: string; // 변이 정보 (e.g., "R132H")
  allele_frequency?: number; // 대립유전자 빈도
  clinical_significance?: 'pathogenic' | 'likely_pathogenic' | 'uncertain' | 'likely_benign' | 'benign';
  is_actionable?: boolean; // 치료 가능 여부
}

// 단백질 마커 타입
export interface ProteinMarker {
  marker_name: string; // 마커명 (e.g., "EGFR", "Ki-67")
  value: string; // 결과값
  unit?: string; // 단위
  reference_range?: string; // 참고 범위
  interpretation?: string; // 해석 (e.g., "양성", "음성", "과발현")
  is_abnormal?: boolean; // 비정상 여부
}

// Treatment worker result
export interface TreatmentWorkerResult {
  _template: 'TREATMENT';
  _version: string;
  _confirmed: boolean;
  procedure: string;
  duration_minutes: number | null;
  anesthesia: string;
  outcome: string;
  complications: string | null;
  _custom: Record<string, unknown>;
}

// Default worker result
export interface DefaultWorkerResult {
  _template: string;
  _version: string;
  _confirmed: boolean;
  _custom: Record<string, unknown>;
}

export type WorkerResult =
  | RISWorkerResult
  | LISWorkerResult
  | TreatmentWorkerResult
  | DefaultWorkerResult;

// Attachments
export interface AttachmentFile {
  name: string;
  type: string;
  size: number;
  preview: 'image' | 'table' | 'iframe' | 'none' | 'download';
  uploaded: boolean;
  dicom_viewer_url?: string;
}

export interface Attachments {
  files: AttachmentFile[];
  zip_url: string | null;
  total_size: number;
  last_modified: string | null;
  _custom: Record<string, unknown>;
}

// =============================================================================
// OCS History
// =============================================================================

export type OcsHistoryAction =
  | 'CREATED'
  | 'ACCEPTED'
  | 'CANCELLED'
  | 'STARTED'
  | 'RESULT_SAVED'
  | 'SUBMITTED'
  | 'CONFIRMED'
  | 'WORKER_CHANGED';

export const HISTORY_ACTION_LABELS: Record<OcsHistoryAction, string> = {
  CREATED: 'OCS 생성',
  ACCEPTED: '오더 접수',
  CANCELLED: '작업 취소',
  STARTED: '작업 시작',
  RESULT_SAVED: '결과 임시저장',
  SUBMITTED: '결과 제출',
  CONFIRMED: '의사 확정',
  WORKER_CHANGED: '작업자 변경',
};

export interface OCSHistory {
  id: number;
  action: OcsHistoryAction;
  action_display: string;
  actor: UserMinimal | null;
  from_status: OcsStatus | null;
  to_status: OcsStatus | null;
  from_worker: UserMinimal | null;
  to_worker: UserMinimal | null;
  reason: string | null;
  created_at: string;
  snapshot_json: Record<string, unknown> | null;
  ip_address: string | null;
}

// =============================================================================
// OCS Main Types
// =============================================================================

export interface LocalStorageKeys {
  request_key: string;
  result_key: string;
  files_key: string;
  meta_key: string;
}

// List item (lightweight)
export interface OCSListItem {
  id: number;
  ocs_id: string;
  ocs_status: OcsStatus;
  ocs_status_display: string;
  patient: PatientMinimal;
  doctor: UserMinimal;
  worker: UserMinimal | null;
  job_role: JobRole;
  job_type: string;
  priority: Priority;
  priority_display: string;
  ocs_result: boolean | null;
  created_at: string;
  updated_at: string;
}

// Detail (full)
export interface OCSDetail {
  id: number;
  ocs_id: string;
  ocs_status: OcsStatus;
  ocs_status_display: string;
  patient: PatientMinimal;
  doctor: UserMinimal;
  worker: UserMinimal | null;
  encounter: number | null;
  job_role: JobRole;
  job_type: string;
  doctor_request: DoctorRequest;
  worker_result: WorkerResult;
  attachments: Attachments;
  ocs_result: boolean | null;
  created_at: string;
  accepted_at: string | null;
  in_progress_at: string | null;
  result_ready_at: string | null;
  confirmed_at: string | null;
  cancelled_at: string | null;
  updated_at: string;
  priority: Priority;
  priority_display: string;
  cancel_reason: string | null;
  is_deleted: boolean;
  turnaround_time: number | null;
  work_time: number | null;
  is_editable: boolean;
  history: OCSHistory[];
  local_storage_keys: LocalStorageKeys;
}

// =============================================================================
// API Request/Response Types
// =============================================================================

export interface OCSListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: OCSListItem[];
}

export interface OCSSearchParams {
  ocs_status?: OcsStatus;
  job_role?: JobRole;
  priority?: Priority;
  patient_id?: number;
  doctor_id?: number;
  worker_id?: number;
  unassigned?: boolean;
  page?: number;
  page_size?: number;
  q?: string; // 검색어 (환자명, 환자번호, OCS ID, 작업유형)
}

export interface OCSCreateData {
  patient_id: number;
  encounter_id?: number | null;
  job_role: JobRole;
  job_type: string;
  doctor_request?: Partial<DoctorRequest>;
  priority?: Priority;
  attachments?: {
    external_source?: {
      institution?: {
        id: number;
        name: string;
        code: string;
        email?: string;
      };
    };
  };
}

export interface OCSUpdateData {
  doctor_request?: Partial<DoctorRequest>;
  worker_result?: Partial<WorkerResult>;
  attachments?: Partial<Attachments>;
  priority?: Priority;
}

// Status change requests
export interface OCSAcceptRequest {}

export interface OCSStartRequest {}

export interface OCSSaveResultRequest {
  worker_result?: Partial<WorkerResult> | Record<string, unknown>;
  attachments?: Partial<Attachments>;
}

export interface OCSSubmitResultRequest {
  worker_result?: Partial<WorkerResult>;
  attachments?: Partial<Attachments>;
}

export interface OCSConfirmRequest {
  ocs_result?: boolean | null;
  worker_result?: Partial<WorkerResult> | Record<string, unknown>;
}

export interface OCSCancelRequest {
  cancel_reason?: string;
}

// =============================================================================
// localStorage Sync Meta
// =============================================================================

export interface LocalStorageMeta {
  last_synced_at: string;
  server_version: number;
  local_version: number;
  is_dirty: boolean;
  conflict: string | null;
}

// =============================================================================
// Type Guards
// =============================================================================

/**
 * WorkerResult가 RISWorkerResult인지 확인하는 타입 가드
 */
export function isRISWorkerResult(result: unknown): result is RISWorkerResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_template' in result &&
    (result as RISWorkerResult)._template === 'RIS'
  );
}

/**
 * WorkerResult가 LISWorkerResult인지 확인하는 타입 가드
 */
export function isLISWorkerResult(result: unknown): result is LISWorkerResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_template' in result &&
    (result as LISWorkerResult)._template === 'LIS'
  );
}

/**
 * WorkerResult가 TreatmentWorkerResult인지 확인하는 타입 가드
 */
export function isTreatmentWorkerResult(result: unknown): result is TreatmentWorkerResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_template' in result &&
    (result as TreatmentWorkerResult)._template === 'TREATMENT'
  );
}

/**
 * 객체가 WorkerResult 타입인지 확인하는 타입 가드
 */
export function isWorkerResult(result: unknown): result is WorkerResult {
  return (
    typeof result === 'object' &&
    result !== null &&
    '_template' in result &&
    '_version' in result &&
    '_confirmed' in result
  );
}

/**
 * RISWorkerResult에서 orthanc 정보 안전하게 접근
 */
export function getRISOrthancInfo(result: WorkerResult | null | undefined): RISWorkerResult['orthanc'] | null {
  if (isRISWorkerResult(result) && result.orthanc) {
    return result.orthanc;
  }
  return null;
}

/**
 * RISWorkerResult에서 imageResults 안전하게 접근
 */
export function getRISImageResults(result: WorkerResult | null | undefined): RISWorkerResult['imageResults'] | undefined {
  if (isRISWorkerResult(result)) {
    return result.imageResults;
  }
  return undefined;
}

/**
 * RISWorkerResult에서 files 안전하게 접근
 */
export function getRISFiles(result: WorkerResult | null | undefined): RISWorkerResult['files'] | undefined {
  if (isRISWorkerResult(result)) {
    return result.files;
  }
  return undefined;
}

/**
 * LISWorkerResult에서 test_results 안전하게 접근
 */
export function getLISTestResults(result: WorkerResult | null | undefined): LISWorkerResult['test_results'] | undefined {
  if (isLISWorkerResult(result)) {
    return result.test_results;
  }
  return undefined;
}

/**
 * LISWorkerResult에서 gene_mutations 안전하게 접근
 */
export function getLISGeneMutations(result: WorkerResult | null | undefined): LISWorkerResult['gene_mutations'] | undefined {
  if (isLISWorkerResult(result)) {
    return result.gene_mutations;
  }
  return undefined;
}

/**
 * LISWorkerResult에서 protein_markers 안전하게 접근
 */
export function getLISProteinMarkers(result: WorkerResult | null | undefined): LISWorkerResult['protein_markers'] | undefined {
  if (isLISWorkerResult(result)) {
    return result.protein_markers;
  }
  return undefined;
}
