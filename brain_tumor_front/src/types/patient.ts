// Patient types

import type { Encounter } from './encounter';
import type { OCSListItem } from './ocs';

export type Gender = 'M' | 'F' | 'O';

export type PatientStatus = 'active' | 'discharged' | 'transferred' | 'deceased';

export type PatientSeverity = 'normal' | 'mild' | 'moderate' | 'severe' | 'critical';

export type BloodType = 'A+' | 'A-' | 'B+' | 'B-' | 'O+' | 'O-' | 'AB+' | 'AB-';

// 상태 라벨
export const PATIENT_STATUS_LABELS: Record<PatientStatus, string> = {
  active: '진료중',
  discharged: '퇴원',
  transferred: '전원',
  deceased: '사망',
};

// 중증도 라벨
export const PATIENT_SEVERITY_LABELS: Record<PatientSeverity, string> = {
  normal: '정상',
  mild: '경증',
  moderate: '중등도',
  severe: '중증',
  critical: '위중',
};

export interface Patient {
  id: number;
  patient_number: string;
  name: string;
  birth_date: string;
  gender: Gender;
  phone: string;
  email: string | null;
  address: string;
  blood_type: BloodType | null;
  allergies: string[];
  chronic_diseases: string[];
  status: PatientStatus;
  severity: PatientSeverity;
  age: number;
  registered_by_name: string;
  created_at: string;
  updated_at: string;
}

export interface PatientListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Patient[];
}

export interface PatientSearchParams {
  q?: string;
  status?: PatientStatus;
  severity?: PatientSeverity;
  gender?: Gender;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
}

export interface PatientCreateData {
  name: string;
  birth_date: string;
  gender: Gender;
  phone: string;
  email?: string;
  address?: string;
  ssn: string;
  blood_type?: BloodType;
  allergies?: string[];
  chronic_diseases?: string[];
  chief_complaint?: string;  // 주 호소 (환자가 말하는 증상)
  severity?: PatientSeverity;
}

export interface PatientUpdateData {
  name?: string;
  phone?: string;
  email?: string;
  address?: string;
  blood_type?: BloodType;
  allergies?: string[];
  chronic_diseases?: string[];
  status?: PatientStatus;
  severity?: PatientSeverity;
}

export interface PatientStatistics {
  total: number;
  active: number;
  inactive: number;
  by_gender: {
    gender: Gender;
    count: number;
  }[];
}

// ============================================
// Patient Alert (환자 주의사항)
// ============================================

export type AlertType = 'ALLERGY' | 'CONTRAINDICATION' | 'PRECAUTION' | 'OTHER';

export type AlertSeverity = 'HIGH' | 'MEDIUM' | 'LOW';

export const ALERT_TYPE_LABELS: Record<AlertType, string> = {
  ALLERGY: '알러지',
  CONTRAINDICATION: '금기',
  PRECAUTION: '주의',
  OTHER: '기타',
};

export const ALERT_SEVERITY_LABELS: Record<AlertSeverity, string> = {
  HIGH: '높음',
  MEDIUM: '중간',
  LOW: '낮음',
};

export interface PatientAlert {
  id: number;
  patient: number;
  alert_type: AlertType;
  alert_type_display?: string;
  severity: AlertSeverity;
  severity_display?: string;
  title: string;
  description?: string;
  created_by?: number;
  created_by_name?: string;
  created_at: string;
  updated_at?: string;
  is_active: boolean;
}

export interface PatientAlertCreateData {
  alert_type: AlertType;
  severity: AlertSeverity;
  title: string;
  description?: string;
}

export interface PatientAlertUpdateData {
  alert_type?: AlertType;
  severity?: AlertSeverity;
  title?: string;
  description?: string;
  is_active?: boolean;
}

// ============================================
// Examination Summary (진찰 요약)
// ============================================

export interface ExaminationSummary {
  patient: {
    id: number;
    patient_number: string;
    name: string;
    age: number;
    gender: string;
    blood_type: string | null;
    allergies: string[];
    chronic_diseases: string[];
    chief_complaint: string;
  };
  alerts: PatientAlert[];
  current_encounter: Encounter | null;
  recent_encounters: Encounter[];
  recent_ocs: {
    ris: OCSListItem[];
    lis: OCSListItem[];
  };
  ai_summary: {
    id: number;
    created_at: string;
    result: any;
  } | null;
  generated_at: string;
}
