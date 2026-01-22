# Encounter 데이터베이스 저장 구조 설명

## 1. 테이블 개요

- **테이블명**: `encounters`
- **설명**: 진료 정보를 저장하는 테이블
- **Django 모델**: `apps.encounters.models.Encounter`

## 2. 테이블 스키마

### 주요 컬럼

| 컬럼명 | 데이터 타입 | NULL 허용 | 기본값 | 설명 |
|--------|------------|----------|--------|------|
| **id** | BIGINT | NO | AUTO_INCREMENT | Primary Key |
| **patient_id** | BIGINT | NO | - | Foreign Key → patients.id |
| **encounter_type** | VARCHAR(20) | NO | - | 진료 유형 코드 |
| **status** | VARCHAR(20) | NO | 'scheduled' | 진료 상태 코드 |
| **attending_doctor_id** | BIGINT | NO | - | Foreign Key → accounts_user.id |
| **department** | VARCHAR(20) | NO | - | 진료과 코드 |
| **admission_date** | DATETIME | NO | - | 입원/진료 일시 (timezone aware) |
| **discharge_date** | DATETIME | **YES** | **NULL** | 퇴원 일시 (NULL = 입원중) |
| **chief_complaint** | TEXT | NO | - | 주 호소 |
| **primary_diagnosis** | VARCHAR(500) | NO | '' | 주 진단명 |
| **secondary_diagnoses** | JSON | NO | [] | 부 진단명 (JSON 배열) |
| **created_at** | DATETIME | NO | NOW() | 생성 일시 |
| **updated_at** | DATETIME | NO | NOW() | 수정 일시 (자동 갱신) |
| **is_deleted** | TINYINT(1) | NO | 0 | Soft Delete 플래그 |

### 인덱스

```sql
-- 환자별 최신 진료 조회용
INDEX idx_patient_admission (patient_id, admission_date DESC)

-- 의사별 최신 진료 조회용
INDEX idx_doctor_admission (attending_doctor_id, admission_date DESC)

-- 상태별 필터링용
INDEX idx_status (status)
```

## 3. Choice 필드 (코드값 저장)

데이터베이스에는 **영문 코드**가 저장되고, 화면에는 **한글명**이 표시됩니다.

### encounter_type (진료 유형)

| DB 저장값 | 화면 표시 |
|-----------|----------|
| `'outpatient'` | 외래 |
| `'inpatient'` | 입원 |
| `'emergency'` | 응급 |

### status (진료 상태)

| DB 저장값 | 화면 표시 |
|-----------|----------|
| `'scheduled'` | 예정 |
| `'in-progress'` | 진행중 |
| `'completed'` | 완료 |
| `'cancelled'` | 취소 |

### department (진료과)

| DB 저장값 | 화면 표시 |
|-----------|----------|
| `'neurology'` | 신경과 |
| `'neurosurgery'` | 신경외과 |

## 4. 특수 필드 상세 설명

### 4.1 discharge_date (퇴원 일시) - NULL 허용

**입원중 vs 퇴원 완료 구분**

```sql
-- 입원중 환자 조회 (discharge_date IS NULL)
SELECT * FROM encounters
WHERE discharge_date IS NULL
  AND status = 'in-progress';

-- 퇴원 완료 환자 조회 (discharge_date IS NOT NULL)
SELECT * FROM encounters
WHERE discharge_date IS NOT NULL;
```

**저장 예시:**
- 입원중: `discharge_date = NULL`
- 퇴원 완료: `discharge_date = '2026-01-07 14:30:00'`

### 4.2 secondary_diagnoses (부 진단명) - JSON 필드

**MySQL JSON 타입으로 배열 저장**

**저장 형태:**
```json
["고혈압", "당뇨", "고지혈증"]
```

**Python에서의 사용:**
```python
encounter = Encounter.objects.get(id=1)

# 읽기
print(encounter.secondary_diagnoses)  # ['고혈압', '당뇨']

# 쓰기
encounter.secondary_diagnoses = ['고혈압', '당뇨', '고지혈증']
encounter.save()

# 추가
encounter.secondary_diagnoses.append('부정맥')
encounter.save()
```

**SQL에서의 사용:**
```sql
-- JSON 배열 길이 확인
SELECT id, JSON_LENGTH(secondary_diagnoses) as count
FROM encounters;

-- 특정 값 포함 여부 확인 (MySQL 5.7+)
SELECT * FROM encounters
WHERE JSON_CONTAINS(secondary_diagnoses, '"고혈압"');

-- 배열이 비어있지 않은 레코드
SELECT * FROM encounters
WHERE JSON_LENGTH(secondary_diagnoses) > 0;
```

## 5. Foreign Key 관계

### 5.1 patient (환자)

```python
# 관계: Encounter.patient → Patient.id
# DB 저장: patient_id 컬럼에 환자 ID 저장
# on_delete: PROTECT (환자 삭제 시 진료가 있으면 삭제 불가)

# 사용 예시
encounter.patient.name  # 환자명 접근
encounter.patient.patient_number  # 환자번호 접근

# 역참조 (환자의 모든 진료 조회)
patient.encounters.all()
```

### 5.2 attending_doctor (담당 의사)

```python
# 관계: Encounter.attending_doctor → User.id
# DB 저장: attending_doctor_id 컬럼에 의사 ID 저장
# on_delete: PROTECT (의사 삭제 시 진료가 있으면 삭제 불가)

# 사용 예시
encounter.attending_doctor.name  # 의사명 접근
encounter.attending_doctor.email  # 의사 이메일 접근

# 역참조 (의사의 모든 진료 조회)
doctor.encounters_as_doctor.all()
```

## 6. Property 필드 (계산 필드 - DB에 저장 안됨)

### 6.1 duration_days (재원 기간)

```python
@property
def duration_days(self):
    if self.discharge_date and self.admission_date:
        return (self.discharge_date - self.admission_date).days
    return None

# 사용
encounter.duration_days  # 5 (5일 입원)
# discharge_date가 NULL이면 None 반환
```

### 6.2 is_active (활성 진료 여부)

```python
@property
def is_active(self):
    return self.status in ['scheduled', 'in-progress'] and not self.is_deleted

# 사용
encounter.is_active  # True or False
```

## 7. 실제 데이터 예시

### 외래 진료 (당일 퇴원)

```sql
INSERT INTO encounters (
    patient_id, encounter_type, status, attending_doctor_id,
    department, admission_date, discharge_date,
    chief_complaint, primary_diagnosis, secondary_diagnoses,
    created_at, updated_at, is_deleted
) VALUES (
    13, 'outpatient', 'completed', 15,
    'neurosurgery', '2026-01-06 14:30:00', '2026-01-06 18:30:00',
    '두통이 심해요', '편두통', '["고혈압"]',
    NOW(), NOW(), 0
);
```

### 입원 진료 (입원중)

```sql
INSERT INTO encounters (
    patient_id, encounter_type, status, attending_doctor_id,
    department, admission_date, discharge_date,
    chief_complaint, primary_diagnosis, secondary_diagnoses,
    created_at, updated_at, is_deleted
) VALUES (
    19, 'inpatient', 'in-progress', 12,
    'neurosurgery', '2026-01-05 10:00:00', NULL,  -- 퇴원 일시 = NULL (입원중)
    '뇌종양 수술 후 관찰', '뇌종양', '["고혈압", "당뇨"]',
    NOW(), NOW(), 0
);
```

## 8. 조회 쿼리 예시

### 8.1 입원중 환자 조회

```sql
SELECT
    e.id,
    p.name as patient_name,
    p.patient_number,
    e.admission_date,
    e.chief_complaint,
    u.name as doctor_name
FROM encounters e
LEFT JOIN patients p ON e.patient_id = p.id
LEFT JOIN accounts_user u ON e.attending_doctor_id = u.id
WHERE e.discharge_date IS NULL
  AND e.is_deleted = 0
  AND e.status = 'in-progress'
ORDER BY e.admission_date DESC;
```

### 8.2 재원 기간 계산

```sql
SELECT
    id,
    patient_id,
    admission_date,
    discharge_date,
    DATEDIFF(discharge_date, admission_date) as duration_days
FROM encounters
WHERE discharge_date IS NOT NULL;
```

### 8.3 부 진단명이 있는 진료 조회

```sql
SELECT
    id,
    patient_id,
    secondary_diagnoses,
    JSON_LENGTH(secondary_diagnoses) as diagnosis_count
FROM encounters
WHERE JSON_LENGTH(secondary_diagnoses) > 0;
```

## 9. 데이터 무결성 규칙

### Django 모델 레벨 검증

```python
def clean(self):
    """모델 유효성 검사"""
    if self.discharge_date and self.admission_date:
        if self.discharge_date < self.admission_date:
            raise ValidationError('퇴원 일시는 입원 일시보다 이후여야 합니다.')
```

### Foreign Key 제약

- **patient**: `on_delete=PROTECT` - 진료가 있는 환자는 삭제 불가
- **attending_doctor**: `on_delete=PROTECT` - 진료가 있는 의사는 삭제 불가

### Soft Delete

- 실제로 레코드를 삭제하지 않고 `is_deleted = 1`로 설정
- 조회 시 `is_deleted = 0`인 레코드만 필터링

## 10. 요약

1. **테이블명**: `encounters`
2. **Choice 필드**: 영문 코드로 저장, 화면에 한글 표시
3. **NULL 허용 필드**: `discharge_date` (입원중 = NULL)
4. **JSON 필드**: `secondary_diagnoses` (부 진단명 배열)
5. **Foreign Keys**: patient_id, attending_doctor_id
6. **Property 필드**: duration_days, is_active (계산 필드, DB 저장 안됨)
7. **Soft Delete**: is_deleted 플래그 사용
8. **Timezone**: 모든 DATETIME 필드는 timezone-aware
