/**
 * 처방 관련 타입 정의
 */

// 처방 상태
export type PrescriptionStatus = 'DRAFT' | 'ISSUED' | 'DISPENSED' | 'CANCELLED';

// 복용 빈도
export type PrescriptionFrequency = 'QD' | 'BID' | 'TID' | 'QID' | 'PRN' | 'QOD' | 'QW';

// 투여 경로
export type PrescriptionRoute = 'PO' | 'IV' | 'IM' | 'SC' | 'TOPICAL' | 'INHALATION' | 'OTHER';

// 처방 항목
export interface PrescriptionItem {
  id: number;
  medication_name: string;
  medication_code?: string;
  dosage: string;
  frequency: PrescriptionFrequency;
  frequency_display?: string;
  route: PrescriptionRoute;
  route_display?: string;
  duration_days: number;
  quantity: number;
  instructions?: string;
  order: number;
  created_at?: string;
  updated_at?: string;
}

// 처방 항목 생성 데이터
export interface PrescriptionItemCreateData {
  medication_name: string;
  medication_code?: string;
  dosage: string;
  frequency: PrescriptionFrequency;
  route: PrescriptionRoute;
  duration_days: number;
  quantity: number;
  instructions?: string;
}

// 처방전 목록 아이템
export interface PrescriptionListItem {
  id: number;
  prescription_id: string;
  prescription_number?: string;  // 처방 번호 (목록에서 표시용)
  patient: number;
  patient_name?: string;
  patient_number?: string;
  doctor: number;
  doctor_name?: string;
  encounter?: number;
  status: PrescriptionStatus;
  status_display?: string;
  diagnosis?: string;
  notes?: string;  // 비고
  items?: PrescriptionItem[];  // 처방 항목 (상세 조회 시)
  item_count: number;
  created_at: string;
  issued_at?: string;
}

// 처방전 상세
export interface Prescription {
  id: number;
  prescription_id: string;
  patient: number;
  patient_name?: string;
  patient_number?: string;
  patient_birth_date?: string;
  patient_gender?: string;
  doctor: number;
  doctor_name?: string;
  encounter?: number;
  status: PrescriptionStatus;
  status_display?: string;
  diagnosis?: string;
  notes?: string;
  items: PrescriptionItem[];
  is_editable: boolean;
  created_at: string;
  issued_at?: string;
  dispensed_at?: string;
  cancelled_at?: string;
  updated_at: string;
  cancel_reason?: string;
}

// 처방전 목록 응답
export interface PrescriptionListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: PrescriptionListItem[];
}

// 처방전 검색 파라미터
export interface PrescriptionSearchParams {
  patient_id?: number;
  doctor_id?: number;
  encounter_id?: number;
  status?: PrescriptionStatus;
  my_only?: boolean;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

// 처방전 생성 데이터
export interface PrescriptionCreateData {
  patient_id: number;
  encounter_id?: number;
  diagnosis?: string;
  notes?: string;
  items?: PrescriptionItemCreateData[];
}

// 처방전 수정 데이터
export interface PrescriptionUpdateData {
  diagnosis?: string;
  notes?: string;
  items?: PrescriptionItemCreateData[];
}

// 처방전 취소 데이터
export interface PrescriptionCancelData {
  cancel_reason: string;
}

// 처방 발행 응답
export interface PrescriptionIssueResponse {
  message: string;
  prescription: Prescription;
}

// 빈도 표시 레이블
export const FREQUENCY_LABELS: Record<PrescriptionFrequency, string> = {
  QD: '1일 1회',
  BID: '1일 2회',
  TID: '1일 3회',
  QID: '1일 4회',
  PRN: '필요시',
  QOD: '격일',
  QW: '주 1회',
};

// 투여 경로 표시 레이블
export const ROUTE_LABELS: Record<PrescriptionRoute, string> = {
  PO: '경구',
  IV: '정맥주사',
  IM: '근육주사',
  SC: '피하주사',
  TOPICAL: '외용',
  INHALATION: '흡입',
  OTHER: '기타',
};

// 상태 표시 레이블
export const STATUS_LABELS: Record<PrescriptionStatus, string> = {
  DRAFT: '작성 중',
  ISSUED: '발행됨',
  DISPENSED: '조제 완료',
  CANCELLED: '취소됨',
};
