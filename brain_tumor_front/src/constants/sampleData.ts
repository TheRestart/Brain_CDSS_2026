/**
 * 샘플 데이터 정의
 * - 환자 등록, SOAP 노트, 검사 결과 등에서 사용
 * - LLM 연동 전 테스트용 더미 데이터
 */

// ============== 환자 샘플 데이터 ==============

export interface PatientSampleData {
  name: string;
  gender: 'M' | 'F';
  birth_date: string;
  phone: string;
  address: string;
  chief_complaint: string;
  medical_history: string;
  allergies: string;
  emergency_contact_name: string;
  emergency_contact_phone: string;
}

export const PATIENT_SAMPLES: PatientSampleData[] = [
  {
    name: '김뇌종',
    gender: 'M',
    birth_date: '1965-03-15',
    phone: '010-1234-5678',
    address: '서울시 강남구 테헤란로 123',
    chief_complaint: '두통, 시력 저하',
    medical_history: '고혈압(2018년 진단), 당뇨병(2020년 진단)',
    allergies: '페니실린',
    emergency_contact_name: '김보호',
    emergency_contact_phone: '010-9876-5432',
  },
  {
    name: '이두통',
    gender: 'F',
    birth_date: '1978-07-22',
    phone: '010-2345-6789',
    address: '서울시 서초구 반포대로 456',
    chief_complaint: '반복적 편두통',
    medical_history: '편두통(2015년부터), 우울증(2019년 진단)',
    allergies: '없음',
    emergency_contact_name: '이가족',
    emergency_contact_phone: '010-8765-4321',
  },
  {
    name: '박어지',
    gender: 'M',
    birth_date: '1952-11-08',
    phone: '010-3456-7890',
    address: '서울시 송파구 올림픽로 789',
    chief_complaint: '어지럼증, 균형감각 이상',
    medical_history: '이석증(2021년), 고혈압(2010년 진단)',
    allergies: '아스피린',
    emergency_contact_name: '박자녀',
    emergency_contact_phone: '010-7654-3210',
  },
];

// ============== SOAP 노트 샘플 데이터 ==============

export interface SOAPSampleData {
  type: 'A' | 'B' | 'C';
  label: string;
  description: string;
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

export const SOAP_SAMPLES: SOAPSampleData[] = [
  {
    type: 'A',
    label: '뇌종양',
    description: '뇌종양 의심 환자 SOAP',
    subjective: `[주호소] 3개월 전부터 시작된 두통, 최근 2주간 악화
[현병력]
- 두통: 아침에 심하고, 구역감 동반
- 시야 흐림: 우측 시야가 뿌옇게 보임
- 언어: 가끔 말이 어눌해짐
[과거력] 고혈압 약 복용 중 (암로디핀 5mg)
[가족력] 아버지 뇌졸중`,
    objective: `[V/S] BP 140/90, HR 78, BT 36.8, RR 18
[신경학적 검사]
- 의식: Alert
- 동공: 정상 반응
- 근력: 좌측 상지 4+/5
- 감각: 좌측 감각 저하
[영상검사] Brain MRI 예정`,
    assessment: `1. Brain tumor, R/O Glioblastoma
   - 우측 전두엽 종괴 의심
   - 종괴 효과로 인한 좌측 편마비
2. Hypertension, controlled`,
    plan: `1. Brain MRI with enhancement (오늘)
2. 신경외과 협진 의뢰
3. 고혈압 약 유지
4. 증상 악화 시 즉시 내원 교육
5. 다음 외래: MRI 결과 확인 후 치료 계획 수립`,
  },
  {
    type: 'B',
    label: '두통',
    description: '만성 두통 환자 SOAP',
    subjective: `[주호소] 1년간 지속되는 두통
[현병력]
- 위치: 양측 측두부, 후두부
- 양상: 조이는 듯한 느낌
- 빈도: 주 3-4회, 각 4-6시간 지속
- 악화요인: 스트레스, 수면 부족
- 완화요인: 휴식, 진통제 복용
[동반증상] 어깨 결림, 피로감
[과거력] 특이사항 없음`,
    objective: `[V/S] BP 120/80, HR 72, BT 36.5
[신경학적 검사]
- 의식: Alert
- 뇌신경: 정상
- 근력/감각: 정상
[이학적 검사]
- 두피 압통: 양측 측두근 압통(+)
- 경추 ROM: 약간 제한`,
    assessment: `1. Tension-type headache, chronic
   - 근긴장성 두통 특징적 양상
   - 신경학적 이상 소견 없음
2. Cervical myofascial pain syndrome`,
    plan: `1. 약물치료
   - Acetaminophen 500mg PRN
   - Eperisone 50mg TID x 2주
2. 비약물치료
   - 스트레스 관리 교육
   - 규칙적 수면 권고
   - 물리치료 의뢰
3. 두통 일기 작성 교육
4. F/U 2주 후`,
  },
  {
    type: 'C',
    label: '어지럼증',
    description: '어지럼증 환자 SOAP',
    subjective: `[주호소] 3일 전 갑자기 발생한 어지럼증
[현병력]
- 양상: 빙빙 도는 느낌 (회전성)
- 지속시간: 수초~1분
- 유발요인: 누웠다 일어날 때, 고개 돌릴 때
- 동반증상: 오심, 구토 1회
[과거력] 고혈압, 당뇨병
[약물력] Amlodipine 5mg, Metformin 500mg`,
    objective: `[V/S] BP 135/85, HR 80, BT 36.6
[신경학적 검사]
- 의식: Alert
- 안진: Dix-Hallpike test (+) 우측
- 청력: 정상
- 근력/감각/소뇌기능: 정상
[이학적 검사]
- Romberg test: Negative
- 보행: 정상`,
    assessment: `1. BPPV (Benign Paroxysmal Positional Vertigo)
   - 우측 후반고리관 이석증
   - Dix-Hallpike 양성
2. HTN, DM - controlled`,
    plan: `1. Epley maneuver 시행 (오늘)
2. 약물치료
   - Betahistine 16mg TID x 1주
   - Dimenhydrinate 50mg PRN
3. 체위 주의사항 교육
   - 급격한 자세 변화 피하기
   - 높은 베개 사용
4. 증상 악화 시 재내원
5. F/U 1주 후`,
  },
];

// ============== RIS 판독 소견 샘플 ==============

export interface RISReportSampleData {
  type: 'brain_mri' | 'brain_ct' | 'spine_mri';
  label: string;
  findings: string;
  impression: string;
  recommendation: string;
}

export const RIS_REPORT_SAMPLES: RISReportSampleData[] = [
  {
    type: 'brain_mri',
    label: 'Brain MRI (종양)',
    findings: `1. 우측 전두엽에 약 3.5 x 2.8 x 3.0 cm 크기의 불균질한 조영증강을 보이는 종괴가 관찰됩니다.
2. 종괴 주변으로 광범위한 혈관성 부종이 동반되어 있습니다.
3. 종괴 효과로 인해 정중선이 좌측으로 약 8mm 편위되어 있습니다.
4. 우측 측뇌실 전각이 압박되어 있습니다.
5. 기타 뇌실질 및 뇌간에는 특이 소견 없습니다.`,
    impression: `1. Right frontal lobe mass with ring enhancement
   - High-grade glioma (GBM) 의심
   - Size: 3.5 x 2.8 x 3.0 cm
2. Significant perilesional edema with mass effect
3. Midline shift to the left (8mm)`,
    recommendation: `1. 신경외과 협진 권고
2. 추가 평가: MR spectroscopy, Perfusion MRI 고려
3. 조직검사 및 수술적 치료 논의 필요`,
  },
  {
    type: 'brain_ct',
    label: 'Brain CT (정상)',
    findings: `1. 뇌실질: 양측 대뇌반구 및 소뇌에 급성 출혈이나 경색 소견 없습니다.
2. 뇌실: 정상 크기 및 형태입니다.
3. 정중선 편위 없습니다.
4. 두개골: 골절 소견 없습니다.
5. 부비동: 정상 공기음영입니다.`,
    impression: `Unremarkable brain CT
- 급성 두개내 병변 없음
- 연령에 적합한 정상 소견`,
    recommendation: `임상적으로 필요시 MRI 추가 검사 고려`,
  },
  {
    type: 'spine_mri',
    label: 'Spine MRI (디스크)',
    findings: `1. L4-5 level: 중심성 추간판 탈출증이 관찰되며, 경막낭을 압박합니다.
2. L5-S1 level: 우측 측방형 추간판 돌출이 있으며, 우측 S1 신경근을 접촉합니다.
3. L3-4 level: 경미한 추간판 팽윤 소견입니다.
4. 척수: 신호 강도 정상입니다.
5. 요추 전만: 감소되어 있습니다.`,
    impression: `1. L4-5 central disc herniation with thecal sac compression
2. L5-S1 right paracentral disc protrusion contacting right S1 nerve root
3. Mild disc bulging at L3-4`,
    recommendation: `1. 신경외과/정형외과 협진
2. 보존적 치료 우선 시행 권고
3. 증상 호전 없을 시 수술적 치료 고려`,
  },
];

// ============== LIS 검사 결과 샘플 ==============

export interface LISResultSampleData {
  type: 'blood_normal' | 'blood_abnormal' | 'tumor_marker';
  label: string;
  results: Array<{
    item: string;
    value: string;
    unit: string;
    reference: string;
    status: 'normal' | 'high' | 'low' | 'critical';
  }>;
  interpretation: string;
}

export const LIS_RESULT_SAMPLES: LISResultSampleData[] = [
  {
    type: 'blood_normal',
    label: '일반 혈액검사 (정상)',
    results: [
      { item: 'WBC', value: '6.8', unit: '10³/μL', reference: '4.0-10.0', status: 'normal' },
      { item: 'RBC', value: '4.5', unit: '10⁶/μL', reference: '4.0-5.5', status: 'normal' },
      { item: 'Hemoglobin', value: '14.2', unit: 'g/dL', reference: '12.0-16.0', status: 'normal' },
      { item: 'Hematocrit', value: '42.5', unit: '%', reference: '36-48', status: 'normal' },
      { item: 'Platelet', value: '245', unit: '10³/μL', reference: '150-400', status: 'normal' },
      { item: 'Glucose (fasting)', value: '98', unit: 'mg/dL', reference: '70-100', status: 'normal' },
      { item: 'BUN', value: '15', unit: 'mg/dL', reference: '7-20', status: 'normal' },
      { item: 'Creatinine', value: '0.9', unit: 'mg/dL', reference: '0.6-1.2', status: 'normal' },
    ],
    interpretation: '모든 검사 항목이 정상 범위입니다.',
  },
  {
    type: 'blood_abnormal',
    label: '일반 혈액검사 (이상)',
    results: [
      { item: 'WBC', value: '12.5', unit: '10³/μL', reference: '4.0-10.0', status: 'high' },
      { item: 'RBC', value: '3.2', unit: '10⁶/μL', reference: '4.0-5.5', status: 'low' },
      { item: 'Hemoglobin', value: '9.8', unit: 'g/dL', reference: '12.0-16.0', status: 'low' },
      { item: 'Hematocrit', value: '30.2', unit: '%', reference: '36-48', status: 'low' },
      { item: 'Platelet', value: '520', unit: '10³/μL', reference: '150-400', status: 'high' },
      { item: 'Glucose (fasting)', value: '156', unit: 'mg/dL', reference: '70-100', status: 'high' },
      { item: 'BUN', value: '28', unit: 'mg/dL', reference: '7-20', status: 'high' },
      { item: 'Creatinine', value: '1.8', unit: 'mg/dL', reference: '0.6-1.2', status: 'high' },
    ],
    interpretation: `[주요 이상 소견]
1. 백혈구 증가: 감염 또는 염증 반응 시사
2. 빈혈 소견: Hb 9.8, 추가 검사 필요 (철분, 페리틴 등)
3. 혈소판 증가: 반응성 vs 골수증식질환 감별 필요
4. 신기능 저하: BUN, Creatinine 상승
5. 공복혈당 상승: 당뇨병 평가 필요`,
  },
  {
    type: 'tumor_marker',
    label: '종양표지자 검사',
    results: [
      { item: 'AFP', value: '3.2', unit: 'ng/mL', reference: '< 10', status: 'normal' },
      { item: 'CEA', value: '2.1', unit: 'ng/mL', reference: '< 5', status: 'normal' },
      { item: 'CA 19-9', value: '18', unit: 'U/mL', reference: '< 37', status: 'normal' },
      { item: 'PSA', value: '1.5', unit: 'ng/mL', reference: '< 4', status: 'normal' },
      { item: 'NSE', value: '28', unit: 'ng/mL', reference: '< 16.3', status: 'high' },
      { item: 'S-100', value: '0.15', unit: 'μg/L', reference: '< 0.1', status: 'high' },
    ],
    interpretation: `[종양표지자 결과]
1. 일반 종양표지자 (AFP, CEA, CA19-9, PSA): 정상 범위
2. NSE 상승: 신경내분비종양, 소세포폐암, 뇌종양에서 상승 가능
3. S-100 상승: 중추신경계 손상 또는 종양 관련 가능성
* 임상 소견과 영상 검사 결과를 종합하여 해석 필요`,
  },
];

// ============== OCS 검사 요청 샘플 ==============

export interface OCSOrderSampleData {
  type: 'ris' | 'lis';
  label: string;
  orders: Array<{
    code: string;
    name: string;
    priority: 'normal' | 'urgent';  // 백엔드 Priority 타입과 일치
  }>;
}

export const OCS_ORDER_SAMPLES: OCSOrderSampleData[] = [
  {
    type: 'ris',
    label: '뇌종양 의심 검사',
    orders: [
      { code: 'MRI001', name: 'Brain MRI with enhancement', priority: 'urgent' },
      { code: 'MRI002', name: 'MR Spectroscopy', priority: 'normal' },
      { code: 'CT001', name: 'Chest CT (전이 평가)', priority: 'normal' },
    ],
  },
  {
    type: 'lis',
    label: '뇌종양 수술 전 검사',
    orders: [
      { code: 'LAB001', name: 'CBC with differential', priority: 'urgent' },
      { code: 'LAB002', name: 'BMP (Basic Metabolic Panel)', priority: 'urgent' },
      { code: 'LAB003', name: 'Coagulation panel (PT/aPTT)', priority: 'urgent' },
      { code: 'LAB004', name: 'LFT (Liver Function Test)', priority: 'normal' },
      { code: 'LAB005', name: 'Tumor markers (NSE, S-100)', priority: 'normal' },
    ],
  },
];

// ============== 진료 등록 샘플 데이터 ==============

export interface EncounterSampleData {
  type: 'A' | 'B' | 'C';
  label: string;
  description: string;
  chief_complaint: string;
  primary_diagnosis: string;
  secondary_diagnoses: string[];
  encounter_type: 'outpatient' | 'inpatient' | 'emergency';
  department: 'neurology' | 'neurosurgery';
}

export const ENCOUNTER_SAMPLES: EncounterSampleData[] = [
  {
    type: 'A',
    label: '뇌종양',
    description: '뇌종양 의심 환자 진료',
    chief_complaint: `지속적인 두통이 3개월 전부터 시작되어 점차 악화되고 있습니다.
특히 아침에 심하고, 구역감을 동반합니다.
최근 2주간 좌측 시야가 흐려지는 증상이 새로 발생했습니다.
간헐적으로 좌측 상지에 저린 느낌이 있습니다.`,
    primary_diagnosis: 'Brain tumor, suspected (의심 뇌종양)',
    secondary_diagnoses: ['Increased intracranial pressure (두개내압 상승)', 'Visual disturbance (시각 장애)'],
    encounter_type: 'inpatient',
    department: 'neurosurgery',
  },
  {
    type: 'B',
    label: '두통',
    description: '편두통 환자 외래 진료',
    chief_complaint: `반복적인 편두통이 5년 전부터 있었으나, 최근 3개월간 빈도가 증가했습니다.
한 달에 10회 이상 발생하며, 진통제 효과가 점점 감소합니다.
두통 시 빛에 예민해지고, 구역감이 동반됩니다.
월경 전후로 악화되는 경향이 있습니다.`,
    primary_diagnosis: 'Chronic migraine (만성 편두통)',
    secondary_diagnoses: ['Medication overuse headache (약물 과용 두통)'],
    encounter_type: 'outpatient',
    department: 'neurology',
  },
  {
    type: 'C',
    label: '어지럼증',
    description: '어지럼증 응급 환자 진료',
    chief_complaint: `오늘 아침 기상 시 갑자기 심한 어지럼증이 발생했습니다.
주변이 빙빙 도는 느낌이 있고, 고개를 돌리면 악화됩니다.
구역, 구토가 동반되며, 오늘 2차례 토했습니다.
이명이나 청력 감소는 없습니다.`,
    primary_diagnosis: 'Benign paroxysmal positional vertigo (양성 발작성 체위성 현훈)',
    secondary_diagnoses: ['Nausea and vomiting (구역, 구토)'],
    encounter_type: 'emergency',
    department: 'neurology',
  },
];

// ============== OCS 생성 샘플 데이터 ==============

export interface OCSCreateSampleData {
  type: 'A' | 'B' | 'C';
  label: string;
  description: string;
  job_role: 'RIS' | 'LIS' | 'TREATMENT' | 'CONSULT';
  job_type: string;
  priority: 'normal' | 'urgent';  // 백엔드 Priority 타입과 일치
  clinical_info: string;
  special_instruction: string;
}

export const OCS_CREATE_SAMPLES: OCSCreateSampleData[] = [
  {
    type: 'A',
    label: '뇌종양',
    description: '뇌종양 의심 환자 MRI 검사',
    job_role: 'RIS',
    job_type: 'MRI',
    priority: 'urgent',
    clinical_info: `[임상 정보]
- 주호소: 3개월간 지속되는 두통, 최근 악화
- 동반증상: 좌측 시야 흐림, 좌측 상지 저림
- 신경학적 소견: 좌측 상지 근력 저하 (4+/5)
- 과거력: 고혈압 (amolodipine 5mg 복용 중)
- 의심 진단: Brain tumor, R/O Glioblastoma`,
    special_instruction: `- 조영제 사용 MRI 필요 (enhancement)
- Diffusion, Perfusion sequence 포함
- 이전 영상 없음
- 두개내압 상승 증상 있어 검사 중 모니터링 필요`,
  },
  {
    type: 'B',
    label: '두통',
    description: '만성 두통 환자 CT 검사',
    job_role: 'RIS',
    job_type: 'CT',
    priority: 'normal',
    clinical_info: `[임상 정보]
- 주호소: 1년간 지속되는 긴장성 두통
- 빈도: 주 3-4회, 각 4-6시간 지속
- 위치: 양측 측두부, 후두부
- 양상: 조이는 듯한 느낌
- 악화요인: 스트레스, 수면 부족
- 신경학적 검사: 정상`,
    special_instruction: `- Non-contrast CT
- 두개골 병변 여부 확인
- 부비동 상태 확인 포함`,
  },
  {
    type: 'C',
    label: '어지럼증',
    description: '어지럼증 환자 혈액 검사',
    job_role: 'LIS',
    job_type: 'CBC',
    priority: 'urgent',
    clinical_info: `[임상 정보]
- 주호소: 3일 전 갑자기 발생한 어지럼증
- 양상: 회전성 현훈, 체위 변화 시 악화
- 동반증상: 오심, 구토
- Dix-Hallpike test: 우측 양성
- 과거력: 고혈압, 당뇨병
- 의심 진단: BPPV (양성 발작성 체위성 현훈)`,
    special_instruction: `- CBC, Electrolyte panel 포함
- 공복 상태 불필요
- 급성 어지럼증 환자로 결과 신속 확인 필요`,
  },
];

// ============== 헬퍼 함수 ==============

/** 오늘 날짜를 YYYY-MM-DD 형식으로 반환 */
export const getTodayDate = (): string => {
  const today = new Date();
  return today.toISOString().split('T')[0];
};

/** 랜덤 환자 번호 생성 */
export const generatePatientNumber = (): string => {
  const year = new Date().getFullYear();
  const random = Math.floor(Math.random() * 100000).toString().padStart(5, '0');
  return `P${year}${random}`;
};

/** 나이 계산 */
export const calculateAge = (birthDate: string): number => {
  const today = new Date();
  const birth = new Date(birthDate);
  let age = today.getFullYear() - birth.getFullYear();
  const monthDiff = today.getMonth() - birth.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
    age--;
  }
  return age;
};
