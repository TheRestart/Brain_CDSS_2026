// Encounter types

export type EncounterType = 'outpatient' | 'inpatient' | 'emergency';

export type EncounterStatus = 'scheduled' | 'in_progress' | 'completed' | 'cancelled';

export type Department = 'neurology' | 'neurosurgery';

export interface Encounter {
  id: number;
  patient: number;
  patient_name?: string;
  patient_number?: string;
  patient_gender?: string;
  patient_age?: number;
  encounter_type: EncounterType;
  encounter_type_display?: string;
  status: EncounterStatus;
  status_display?: string;
  attending_doctor?: number;
  attending_doctor_name?: string;
  department?: Department;
  department_display?: string;
  // 진료 날짜/시간
  encounter_date?: string;
  scheduled_time?: string;
  admission_date?: string;
  discharge_date?: string | null;
  duration_days?: number | null;
  // 진료 내용
  chief_complaint?: string;
  symptoms?: string;
  diagnosis?: string;
  notes?: string;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  // SOAP 노트
  subjective?: string;      // S - 주관적 증상 (환자가 호소하는 증상)
  objective?: string;       // O - 객관적 소견 (검사 결과, 관찰 소견)
  assessment?: string;      // A - 평가 (진단, 감별진단)
  plan?: string;            // P - 계획 (치료 계획, 처방)
  is_active?: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface EncounterListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: Encounter[];
}

export type SortField = 'admission_date' | 'status';
export type SortDirection = 'asc' | 'desc';
export type TimeFilter = 'all' | 'past' | 'future';

export interface SortConfig {
  field: SortField;
  direction: SortDirection;
}

export interface EncounterSearchParams {
  q?: string;
  encounter_type?: EncounterType;
  status?: EncounterStatus;
  department?: Department;
  attending_doctor?: number;
  patient?: number;
  encounter_date?: string;
  start_date?: string;
  end_date?: string;
  page?: number;
  page_size?: number;
  ordering?: string;
  time_filter?: TimeFilter;
}

export interface EncounterCreateData {
  patient: number;
  encounter_type: EncounterType;
  status?: EncounterStatus;
  attending_doctor?: number;
  department?: Department;
  encounter_date?: string;
  scheduled_time?: string;
  admission_date?: string;
  discharge_date?: string | null;
  chief_complaint?: string;
  symptoms?: string;
  diagnosis?: string;
  notes?: string;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  // SOAP 노트
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface EncounterUpdateData {
  status?: EncounterStatus;
  attending_doctor?: number;
  department?: Department;
  encounter_date?: string;
  scheduled_time?: string;
  admission_date?: string;
  discharge_date?: string | null;
  chief_complaint?: string;
  symptoms?: string;
  diagnosis?: string;
  notes?: string;
  primary_diagnosis?: string;
  secondary_diagnoses?: string[];
  // SOAP 노트
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

export interface EncounterStatistics {
  total: number;
  by_type: {
    [key in EncounterType]: {
      label: string;
      count: number;
    };
  };
  by_status: {
    [key in EncounterStatus]: {
      label: string;
      count: number;
    };
  };
  by_department: {
    [key in Department]: {
      label: string;
      count: number;
    };
  };
}
