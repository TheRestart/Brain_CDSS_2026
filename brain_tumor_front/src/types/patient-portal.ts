/**
 * Patient Portal Types
 * - 환자 본인 포털용 타입 정의
 */

// 환자 본인 정보
export interface MyPatientInfo {
  id: number;
  patient_number: string;
  name: string;
  age: number;
  gender: 'M' | 'F';
  birth_date: string;
  blood_type?: string;
  phone?: string;
  allergies: string[];
  chronic_diseases: string[];
  registered_at: string;
}

// 환자 진료 이력 (백엔드 PatientEncounterListSerializer 응답)
export interface MyEncounter {
  id: number;
  encounter_type: string;
  encounter_type_display: string;
  status: string;
  status_display: string;
  attending_doctor_name: string;
  department_display?: string;
  admission_date: string;
  discharge_date?: string;
  chief_complaint?: string;
  primary_diagnosis?: string;
  scheduled_time?: string;
}

// 진료 이력 목록 (페이지네이션 포함)
export interface MyEncounterListResponse {
  count: number;
  next?: string;
  previous?: string;
  results: MyEncounter[];
}

// 환자 검사 결과 항목 (백엔드 PatientOCSListSerializer 응답)
export interface MyOCSItem {
  id: number;
  ocs_id: string;
  job_role: 'RIS' | 'LIS';
  job_type: string;
  ocs_status: string;
  ocs_status_display: string;
  ocs_result?: string;
  doctor_name: string;
  created_at: string;
  confirmed_at?: string;
}

// 검사 결과 목록 (페이지네이션 포함)
export interface MyOCSListResponse {
  count: number;
  next?: string;
  previous?: string;
  results: MyOCSItem[];
}

// 환자 주의사항
export interface MyAlert {
  id: number;
  alert_type: string;
  alert_type_display: string;
  severity: string;
  severity_display: string;
  title: string;
  description?: string;
  is_active: boolean;
}
