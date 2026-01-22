# Brain Tumor CDSS - 더미 데이터 생성 시스템

Brain Tumor CDSS 프로젝트의 개발/테스트용 더미 데이터 생성 시스템입니다.

## 목차

1. [빠른 시작](#빠른-시작)
2. [개요](#개요)
3. [아키텍처](#아키텍처)
4. [설계 철학](#설계-철학)
5. [사용법](#사용법)
6. [파일 구조](#파일-구조)
7. [데이터 흐름](#데이터-흐름)
8. [스크립트별 상세 설명](#스크립트별-상세-설명)
9. [환자데이터 동기화](#환자데이터-동기화)
10. [진료 예약 스케줄 생성](#진료-예약-스케줄-생성)
11. [테스트 계정](#테스트-계정)
12. [생성되는 데이터 통계](#생성되는-데이터-통계)
13. [새 기능 추가 가이드](#새-기능-추가-가이드)
14. [트러블슈팅](#트러블슈팅)
15. [AI 추론 워크플로우](#ai-추론-워크플로우)

---

## 빠른 시작

```bash
cd brain_tumor_back

# 한 번에 모든 것 (DB 생성 + 마이그레이션 + 더미 데이터)
python -m setup_dummy_data
```

> DB가 없으면 자동 생성하고, 마이그레이션도 자동 실행합니다.

**리셋 후 재생성 (권장):**
```bash
python -m setup_dummy_data --reset
# 또는 확인 없이 자동 실행 (비대화형 모드)
python -m setup_dummy_data --reset -y
```

**끝!** 이제 서버를 실행하세요:
```bash
python manage.py runserver
```

---

## 개요

이 시스템은 개발 및 테스트 환경에서 필요한 더미 데이터를 자동으로 생성합니다.

### 주요 기능

- **자동 DB 생성**: MySQL 데이터베이스가 없으면 자동 생성
- **자동 마이그레이션**: `makemigrations` + `migrate` 자동 실행
- **멱등성 보장**: 여러 번 실행해도 동일한 결과
- **계층적 데이터 생성**: 의존성 순서대로 데이터 생성
- **유연한 옵션**: 부분 실행, 초기화, 강제 추가 등 지원

---

## 아키텍처

```
setup_dummy_data/
├── main.py                                  # 통합 실행 래퍼 (진입점)
├── __main__.py                              # python -m setup_dummy_data 지원
├── __init__.py                              # 패키지 초기화
├── setup_dummy_data_1_base.py               # 기본 데이터 (역할, 사용자, 메뉴/권한)
├── setup_dummy_data_2_clinical.py           # 임상 데이터 (환자, 진료, OCS, 치료, 경과, 처방)
├── setup_medications.py                     # 의약품 마스터 데이터 (뇌종양 관련 약품 20종)
├── setup_dummy_data_3_extended.py           # 확장 데이터 (대량 진료/OCS, 오늘 진료, 일정)
├── setup_dummy_data_4_encounter_schedule.py # 진료 예약 스케줄 (의사별 기간 예약)
├── setup_dummy_data_5_access_logs.py        # 접근 감사 로그 (AccessLog 200건)
├── sync_orthanc_ocs.py                      # Orthanc DICOM 업로드 + OCS RIS 동기화
├── sync_lis_ocs.py                          # LIS 파일 복사 + OCS LIS 동기화
├── dummy data 업그레이드 계획.md              # OCS worker_result 양식 문서
└── DB_SETUP_GUIDE.md                        # 이 문서
```

### 계층 구조

```
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                 main.py (통합 래퍼) - 9단계 자동 실행                               │
├──────────────────────────────────────────────────────────────────────────────────────────────────┤
│  1_base.py      │  2_clinical.py    │  medications.py  │  3_extended.py      │  4_schedule.py    │
│  (기본)          │  (임상)            │  (의약품)         │  (확장)              │  (예약 스케줄)     │
├─────────────────┼───────────────────┼─────────────────┼─────────────────────┼───────────────────┤
│ - DB 생성        │ - 환자 50명        │ - 의약품 20종     │ - 확장 진료 150건    │ - 기간별 예약 생성 │
│ - 마이그레이션   │ - 진료 20건        │ - 항암제          │ - 확장 OCS LIS 80건  │ - 의사당 10명/일   │
│ - 역할 7개       │ - OCS RIS 15건     │ - 부종/뇌압관리   │ - 오늘 예약 진료     │ - 주말 제외        │
│ - 사용자 10명    │ - OCS LIS 30건     │ - 항경련제        │ - 공유 일정          │ - 30분 간격 슬롯   │
│ - 메뉴/권한      │ - 치료 계획 15건    │ - 진통제          │ - 개인 일정          │                   │
│                 │ - 경과 추적 25건    │ - 구역/구토관리   │                     │                   │
│                 │ - 처방 20건         │ - 위장보호        │                     │                   │
└─────────────────┴───────────────────┴─────────────────┴─────────────────────┴───────────────────┘

┌─────────────────────────────────────────────────────────────────────────────────────┐
│                      환자데이터 동기화 스크립트 (main.py에서 자동 실행)                   │
├─────────────────────────────────────────────────────────────────────────────────────┤
│  sync_orthanc_ocs.py (3/7단계)           │  sync_lis_ocs.py (4/7단계)                 │
│  (Orthanc DICOM + OCS RIS)               │  (LIS 파일 + OCS LIS)                      │
├─────────────────────────────────────────┼───────────────────────────────────────────┤
│ - 환자데이터/*/mri → Orthanc 업로드       │ - 환자데이터/*/rna → CDSS_STORAGE/LIS      │
│ - OCS RIS worker_result 업데이트 (v1.2)  │ - 환자데이터/*/protein → CDSS_STORAGE/LIS  │
│ - 15개 환자데이터 폴더 ↔ 15 OCS RIS 매칭  │ - 15개 환자데이터 폴더 ↔ 30 OCS LIS 매칭   │
│ - DICOM 있으면 CONFIRMED                 │ - RNA_SEQ 15건 + BIOMARKER 15건            │
│ - 없으면 ACCEPTED                        │ - 파일 있으면 CONFIRMED                    │
│ - MRI만 지원 (CT, PET 없음)              │ - 각 OCS 타입당 1파일만 저장               │
└─────────────────────────────────────────┴───────────────────────────────────────────┘
```

---

## 설계 철학

### 1. 멱등성 (Idempotency)

여러 번 실행해도 동일한 결과를 보장합니다.

```python
# 이미 존재하면 SKIP, 없으면 CREATE
if User.objects.filter(login_id=login_id).exists():
    print(f"  [SKIP] {login_id} 이미 존재")
else:
    User.objects.create_user(...)
    print(f"  [CREATE] {login_id}")
```

### 2. 계층적 의존성 (Layered Dependencies)

```
1_base (기본) ──► 2_clinical (임상) ──► 3_extended (확장) ──► 4_schedule (스케줄)
     │                   │                    │                    │
     ▼                   ▼                    ▼                    ▼
  역할/사용자           환자                 대량 진료             기간별 예약
  메뉴/권한            진료/OCS              오늘 진료
                      AI모델                 일정
                      치료/경과
                      처방
```

각 스크립트는 이전 단계의 데이터에 의존합니다.

### 3. 데이터 일관성

- **환자 데이터**: `setup_dummy_data_2_clinical.py`에서 통합 관리 (50명)
- **OCS 데이터**: 담당 의사-환자 관계(진료 기록)에 기반하여 생성
- **동명이인 금지**: 모든 사용자/환자 이름은 고유

### 4. 목표 수량 기반 생성

```python
def create_dummy_patients(target_count=50, force=False):
    existing = Patient.objects.filter(is_deleted=False).count()

    # 이미 목표 수량 이상이면 SKIP
    if existing >= target_count and not force:
        print(f"[SKIP] 이미 {existing}명 존재")
        return

    # 부족분만 생성
    to_create = target_count - existing
```

### 5. 트랜잭션 안전성

```python
from django.db import transaction

@transaction.atomic
def create_complex_data():
    # 모든 작업이 성공하거나 모두 롤백
    ...
```

---

## 사용법

### 기본 실행

```bash
# 프로젝트 루트에서 실행
cd brain_tumor_back

# 전체 데이터 생성 (기존 데이터 유지, 부족분만 추가)
python -m setup_dummy_data

# 또는
python setup_dummy_data/main.py
```

### 옵션

| 옵션 | 설명 |
|------|------|
| `--reset` | 기존 데이터 삭제 후 새로 생성 |
| `--force` | 목표 수량 이상이어도 강제 추가 |
| `--base` | 기본 데이터만 생성 (1_base) |
| `--clinical` | 임상 데이터만 생성 (2_clinical) |
| `--extended` | 확장 데이터만 생성 (3_extended) |
| `--menu` | 메뉴/권한만 업데이트 |
| `--schedule` | 진료 예약 스케줄만 생성 |
| `--start` | 예약 시작 날짜 (YYYY-MM-DD, 기본: 2026-01-15) |
| `--end` | 예약 종료 날짜 (YYYY-MM-DD, 기본: 2026-02-28) |
| `--per-doctor` | 의사당 하루 예약 수 (기본: 10) |
| `-y, --yes` | 확인 없이 자동 실행 |

### 사용 예시

```bash
# 전체 초기화 후 재생성
python -m setup_dummy_data --reset

# 확인 없이 자동 초기화
python -m setup_dummy_data --reset -y

# 메뉴/권한만 업데이트 (네비게이션 반영)
python -m setup_dummy_data --menu

# 기본 데이터만 강제 추가
python -m setup_dummy_data --base --force

# 임상 데이터만 생성
python -m setup_dummy_data --clinical

# 확장 데이터만 생성
python -m setup_dummy_data --extended

# 진료 예약 스케줄 생성 (기본 기간)
python -m setup_dummy_data --schedule

# 기간 지정 예약 스케줄 생성
python -m setup_dummy_data --schedule --start 2026-03-01 --end 2026-03-31

# 의사당 예약 수 변경
python -m setup_dummy_data --schedule --per-doctor 15
```

### 개별 스크립트 실행

```bash
# 기본 데이터만 (역할, 사용자, 메뉴/권한)
python setup_dummy_data/setup_dummy_data_1_base.py [--reset] [--force]

# 임상 데이터만 (환자, 진료, OCS, AI, 치료, 경과, 처방)
python setup_dummy_data/setup_dummy_data_2_clinical.py [--reset] [--force]

# 확장 데이터만 (대량 진료/OCS, 오늘 진료, 일정)
python setup_dummy_data/setup_dummy_data_3_extended.py [--reset] [--force]
```

---

## 파일 구조

### main.py - 통합 실행 래퍼

```python
def main():
    # 1. 기본 데이터 (역할, 사용자, 메뉴/권한)
    run_script('setup_dummy_data_1_base.py', args)

    # 2. 임상 데이터 (환자, 진료, OCS, AI, 치료, 경과, 처방)
    run_script('setup_dummy_data_2_clinical.py', args)

    # 3. 확장 데이터 (대량 진료/OCS, 오늘 진료, 일정)
    run_script('setup_dummy_data_3_extended.py', args)

    # 4. 추가 사용자 (admin2, nurse2...)
    create_additional_users()

    # 5. 환자 계정 연결
    link_patient_accounts()

    # 6. 최종 요약
    print_final_summary()
```

---

## 데이터 흐름

### 실행 순서 (9단계)

```
python -m setup_dummy_data
         │
         ▼
    ┌─────────┐
    │ main.py │
    └────┬────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [1/9] 1_base.py                         │
    │  ├─► DB 생성 (없으면)                    │
    │  ├─► 마이그레이션                        │
    │  ├─► 역할 7개                            │
    │  ├─► 사용자 10명                         │
    │  └─► 메뉴/권한                           │
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [2/9] 2_clinical.py                     │
    │  ├─► 환자 50명                           │
    │  ├─► 진료 20건                           │
    │  ├─► OCS RIS 15건 + ImagingStudy        │ ← 환자데이터 폴더 수(15개) 기준
    │  ├─► OCS LIS 30건                        │ ← RNA_SEQ 15건 + BIOMARKER 15건
    │  ├─► 치료 계획 15건                      │
    │  ├─► 경과 추적 25건                      │
    │  └─► 처방 20건 + 항목 ~60건              │   ※ AI 요청은 사용자가 직접 요청
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [2.5/9] setup_medications.py            │ ← NEW!
    │  └─► 의약품 마스터 데이터 20종            │
    │      (항암제, 부종관리, 항경련제, 진통제 등)│
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [3/9] sync_orthanc_ocs.py               │ ← 자동 실행
    │  ├─► 15개 환자데이터 폴더 → Orthanc 업로드│
    │  ├─► OCS RIS 15건 worker_result 업데이트 │
    │  └─► DICOM 있으면 CONFIRMED              │
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [4/9] sync_lis_ocs.py                   │ ← 자동 실행
    │  ├─► RNA_SEQ: gene_expression.csv 복사  │
    │  ├─► BIOMARKER: rppa.csv 복사           │
    │  ├─► OCS LIS 30건 worker_result 업데이트 │
    │  └─► 파일 있으면 CONFIRMED               │
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [5/9] 3_extended.py                     │
    │  ├─► 확장 진료 150건                     │
    │  ├─► 확장 OCS LIS 80건                   │ ← RIS는 환자데이터 폴더에 제한
    │  ├─► 오늘 예약 진료                      │
    │  ├─► 공유 일정                           │
    │  └─► 개인 일정                           │
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [6/9] 추가 사용자 생성                    │
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [7/9] 환자 계정-데이터 연결               │
    └────┬────────────────────────────────────┘
         │
    ┌────▼────────────────────────────────────┐
    │ [8/9] 5_access_logs.py                  │
    │  └─► 접근 감사 로그 200건                 │
    └────┬────────────────────────────────────┘
         │
         ▼
    최종 요약 출력
```

---

## 스크립트별 상세 설명

### setup_dummy_data_1_base.py (기본 시스템 데이터)
> **필수 데이터** - 앱 동작에 반드시 필요

```python
# ========== 0단계: 인프라 ==========
create_database_if_not_exists()  # DB 자동 생성
run_migrations()                  # makemigrations + migrate

# ========== 1단계: 기본 설정 ==========
setup_roles()           # 역할 7개 정의
setup_superuser()       # 시스템 관리자
setup_test_users()      # 테스트 사용자 10명

# ========== 2단계: 메뉴/권한 ==========
setup_menus_and_permissions()
```

- **DB 자동 생성** (없는 경우)
- **마이그레이션 자동 실행**
- 역할 7개 (SYSTEMMANAGER, ADMIN, DOCTOR, NURSE, PATIENT, RIS, LIS)
- 슈퍼유저 (system / system001)
- 테스트 사용자 10명 (admin, doctor1~5, nurse1, patient1, ris1, lis1)
- 메뉴/권한 시드 데이터 (ENCOUNTER_LIST 포함)

### setup_medications.py (의약품 마스터 데이터)
> **마스터 데이터** - 처방전 작성에 필요한 의약품 목록

```python
# 뇌종양 관련 의약품 20종 생성
create_medications()
```

- **항암제**: Temozolomide, Bevacizumab, Lomustine
- **부종/뇌압 관리**: Dexamethasone, Mannitol
- **항경련제**: Levetiracetam, Valproic acid, Phenytoin
- **진통제**: Acetaminophen, Tramadol, Oxycodone
- **구역/구토 관리**: Ondansetron, Metoclopramide
- **위장 보호**: Esomeprazole, Famotidine
- **기타 보조**: Megestrol, Methylphenidate

> 개별 실행: `python setup_dummy_data/setup_medications.py`

### setup_dummy_data_2_clinical.py (임상 데이터)
> **선택 데이터** - 임상 시나리오 테스트용

```python
# ========== 선행 조건 확인 ==========
check_prerequisites()  # 사용자, 의사 존재 확인

# ========== 환자/진료/OCS ==========
create_dummy_patients()           # 환자 50명
create_dummy_encounters()         # 진료 20건
create_dummy_imaging_with_ocs()   # OCS RIS 15건 + ImagingStudy (환자데이터 폴더 수 기준)
create_dummy_lis_orders()         # OCS LIS 30건 (RNA_SEQ 15건 + BIOMARKER 15건)
create_ai_models()                # AI 모델 (현재 스킵)

# ========== 치료/경과 ==========
create_dummy_treatment_plans()    # 치료 계획 15건
create_dummy_followups()          # 경과 추적 25건
# AI 요청은 더미로 생성하지 않음 (RIS/LIS 담당자가 직접 요청)

# ========== 처방 ==========
create_dummy_prescriptions()      # 처방 20건 + 항목 ~60건
```

- **선행 조건 자동 확인** (사용자, 의사 존재 여부)
- 환자 50명 (기본 30명 + 확장 20명 통합 관리)
- 진료(Encounter) 20건
- **OCS (RIS) 15건** + ImagingStudy (환자데이터 폴더 15개에 맞춤, P202600001~P202600015)
- **OCS (LIS) 30건** (RNA_SEQ 15건 + BIOMARKER 15건, 환자데이터 폴더 15개에 맞춤)
- 치료 계획 15건 + 치료 세션
- 경과 추적 25건
- **AI 추론 요청은 더미 데이터로 생성하지 않음** (RIS/LIS 담당자가 워크벤치에서 직접 요청)
- 처방전 20건 (DRAFT, ISSUED, DISPENSED, CANCELLED 상태 분포)
- 처방 항목 ~60건 (뇌종양 관련 약품)
  - 항암제: Temozolomide, Bevacizumab, Lomustine
  - 부종/뇌압 관리: Dexamethasone, Mannitol
  - 항경련제: Levetiracetam, Valproic acid, Phenytoin
  - 진통제: Acetaminophen, Tramadol, Oxycodone
  - 구역/구토 관리: Ondansetron, Metoclopramide
  - 위장 보호: Esomeprazole, Famotidine
  - 기타 보조: Megestrol, Methylphenidate

> **중요**: OCS RIS/LIS 개수는 환자데이터 폴더 수(15개)에 맞춰 제한됩니다.
> sync_orthanc_ocs.py, sync_lis_ocs.py에서 1:1 매칭되어 worker_result가 채워집니다.
> **AI 추론**: OCS CONFIRMED 후 RIS/LIS 담당자가 워크벤치에서 "AI 분석" 버튼으로 요청합니다.

### setup_dummy_data_3_extended.py (확장 데이터)
> **선택 데이터** - 대량 데이터 및 일정 테스트용

```python
# ========== 선행 조건 확인 ==========
check_prerequisites()  # 사용자, 환자 존재 확인

# ========== 대량 데이터 ==========
create_extended_encounters()  # 확장 진료 150건
# OCS RIS 확장 생성 SKIP (환자데이터 폴더 15개에 제한)
create_extended_ocs_lis()     # 확장 OCS LIS 80건

# ========== 오늘 진료 ==========
create_today_encounters()     # 오늘 예약 환자

# ========== 일정 ==========
create_shared_schedules()     # 공유 일정
create_personal_schedules()   # 개인 일정
```

- **선행 조건 자동 확인** (사용자, 의사, 환자 존재 여부)
- 확장 진료(Encounter) 150건
- **확장 OCS (RIS) 생성 스킵** - 환자데이터 폴더 15개에 맞춰 15건으로 제한됨
- 확장 OCS (LIS) 80건 (담당 의사만 요청)
- 오늘 날짜 기준 진료 데이터 생성 (실시간 대기 환자 목록 테스트용)
- 공유 일정 (Admin이 관리하는 권한별 공유 일정)
- 개인 일정 (모든 사용자의 개인 일정)

---

## 환자데이터 동기화

### 개요

`환자데이터` 폴더의 실제 의료 데이터(MRI, RNA-seq, Protein)를 시스템에 동기화합니다.
**main.py 실행 시 3/7단계, 4/7단계에서 자동으로 실행됩니다.**

```
c:/0000/환자데이터/  (15개 폴더)
├── TCGA-CS-4944/     ← P202600001과 매칭
│   ├── mri/                    # MRI DICOM 파일 (5채널)
│   │   ├── t1/                 # T1 강조 영상
│   │   ├── t2/                 # T2 강조 영상
│   │   ├── t1ce/               # T1 조영증강 영상
│   │   ├── flair/              # FLAIR 영상
│   │   └── seg/                # Segmentation 마스크
│   ├── rna/                    # RNA 시퀀싱 데이터
│   │   ├── gene_expression.csv # 유전자 발현 데이터
│   │   └── rna_summary.json
│   └── protein/                # 단백질 데이터
│       ├── rppa.csv            # RPPA 데이터
│       └── protein_summary.json
├── TCGA-CS-6666/     ← P202600002와 매칭
│   └── ...
└── ... (총 15개 환자 폴더)
```

### 환자데이터 폴더 목록 (15개)

| 순서 | 폴더명 | 환자번호 |
|------|--------|----------|
| 1 | TCGA-CS-4944 | P202600001 |
| 2 | TCGA-CS-6666 | P202600002 |
| 3 | TCGA-DU-5855 | P202600003 |
| 4 | TCGA-DU-5874 | P202600004 |
| 5 | TCGA-DU-7014 | P202600005 |
| 6 | TCGA-DU-7015 | P202600006 |
| 7 | TCGA-DU-7018 | P202600007 |
| 8 | TCGA-DU-7300 | P202600008 |
| 9 | TCGA-DU-A5TW | P202600009 |
| 10 | TCGA-DU-A5TY | P202600010 |
| 11 | TCGA-FG-7634 | P202600011 |
| 12 | TCGA-HT-7473 | P202600012 |
| 13 | TCGA-HT-7602 | P202600013 |
| 14 | TCGA-HT-7686 | P202600014 |
| 15 | TCGA-HT-7694 | P202600015 |

### sync_orthanc_ocs.py - Orthanc DICOM 동기화

MRI DICOM 파일을 Orthanc PACS에 업로드하고 OCS RIS를 업데이트합니다.

```bash
# 전체 실행 (MRI 업로드 + OCS 업데이트)
python setup_dummy_data/sync_orthanc_ocs.py

# 테스트 모드 (실제 변경 없음)
python setup_dummy_data/sync_orthanc_ocs.py --dry-run

# 업로드 스킵 (OCS 상태만 업데이트)
python setup_dummy_data/sync_orthanc_ocs.py --skip-upload

# 처리 환자 수 제한
python setup_dummy_data/sync_orthanc_ocs.py --limit 5
```

**동작 방식:**
1. `환자데이터/*/mri` 폴더의 DICOM 파일을 Orthanc에 업로드
2. OCS RIS의 `worker_result`를 v1.2 양식으로 업데이트
3. DICOM 데이터가 있는 OCS → `CONFIRMED`
4. 없는 OCS → `ACCEPTED`

**OCS RIS worker_result v1.2 구조:**
```json
{
  "_template": "RIS",
  "_version": "1.2",
  "_confirmed": true,
  "_verifiedAt": "2026-01-15T06:00:00.000Z",
  "_verifiedBy": "시스템관리자",
  "orthanc": {
    "patient_id": "P202600001",
    "orthanc_study_id": "d33631a2-...",
    "study_uid": "1.2.410.200001.0001.202600001.20260115...",
    "series": [
      {"orthanc_id": "...", "series_type": "T1", "instances_count": 155},
      {"orthanc_id": "...", "series_type": "T2", "instances_count": 155},
      {"orthanc_id": "...", "series_type": "T1C", "instances_count": 155},
      {"orthanc_id": "...", "series_type": "FLAIR", "instances_count": 155},
      {"orthanc_id": "...", "series_type": "SEG", "instances_count": 155}
    ]
  },
  "dicom": {"study_uid": "...", "series_count": 5, "instance_count": 775},
  "findings": "...",
  "impression": "...",
  "recommendation": "...",
  "tumorDetected": true
}
```

### sync_lis_ocs.py - LIS 파일 동기화

RNA-seq, Protein 파일을 `CDSS_STORAGE/LIS`에 복사하고 OCS LIS를 업데이트합니다.
**main.py에서 4/7단계로 자동 실행됩니다.**

```bash
# 전체 실행 (파일 복사 + OCS 업데이트)
python setup_dummy_data/sync_lis_ocs.py

# 테스트 모드 (실제 변경 없음)
python setup_dummy_data/sync_lis_ocs.py --dry-run

# 처리 환자 수 제한
python setup_dummy_data/sync_lis_ocs.py --limit 5
```

**파일 저장 규칙 (각 OCS 타입당 1파일만 저장):**

| OCS job_type | 소스 파일 | 저장 위치 |
|--------------|----------|----------|
| `RNA_SEQ` | `환자데이터/*/rna/gene_expression.csv` | `CDSS_STORAGE/LIS/{ocs_id}/gene_expression.csv` |
| `BIOMARKER` | `환자데이터/*/protein/rppa.csv` | `CDSS_STORAGE/LIS/{ocs_id}/rppa.csv` |

> **중요**: 각 환자(P202600001~P202600015)마다 RNA_SEQ 1건, BIOMARKER 1건으로 총 30건의 OCS LIS가 생성됩니다.

**저장소 구조:**
```
c:/0000/
├── brain_tumor_dev/           # 프로젝트 폴더
├── 환자데이터/                 # 원본 데이터 (읽기 전용, 15개 폴더)
└── CDSS_STORAGE/              # 시스템 저장소 (프로젝트 외부)
    └── LIS/                   # 30개 폴더 (RNA_SEQ 15 + BIOMARKER 15)
        ├── ocs_0016/           # RNA_SEQ OCS (P202600001)
        │   └── gene_expression.csv
        ├── ocs_0017/           # BIOMARKER OCS (P202600001)
        │   └── rppa.csv
        ├── ocs_0018/           # RNA_SEQ OCS (P202600002)
        │   └── gene_expression.csv
        └── ...
```

**OCS LIS worker_result v1.2 구조 (RNA_SEQ):**
```json
{
  "_template": "LIS",
  "_version": "1.2",
  "_confirmed": true,
  "test_type": "RNA_SEQ",
  "RNA_seq": "CDSS_STORAGE/LIS/ocs_0039/gene_expression.csv",
  "gene_expression": {
    "file_path": "CDSS_STORAGE/LIS/ocs_0039/gene_expression.csv",
    "file_size": 442823,
    "top_expressed_genes": [
      {"gene_symbol": "GFAP", "expression": 2554529.89},
      {"gene_symbol": "CLU", "expression": 1981621.21}
    ]
  },
  "sequencing_data": {
    "method": "RNA-Seq (Illumina HiSeq)",
    "coverage": 95.5,
    "quality_score": 38.2
  }
}
```

**OCS LIS worker_result v1.2 구조 (BIOMARKER):**
```json
{
  "_template": "LIS",
  "_version": "1.2",
  "_confirmed": true,
  "test_type": "PROTEIN",
  "protein": "CDSS_STORAGE/LIS/ocs_0044/rppa.csv",
  "protein_markers": [
    {"marker_name": "14-3-3_beta", "value": "-0.1172", "is_abnormal": false},
    {"marker_name": "14-3-3_epsilon", "value": "0.0987", "is_abnormal": false}
  ],
  "protein_data": {
    "method": "RPPA (Reverse Phase Protein Array)",
    "file_path": "CDSS_STORAGE/LIS/ocs_0044/rppa.csv",
    "total_markers": 20
  }
}
```

### 전체 동기화 순서

**방법 1: 자동 실행 (권장)**
```bash
# main.py가 1~7단계를 모두 자동 실행 (동기화 포함)
python -m setup_dummy_data --reset -y

# 서버 실행
python manage.py runserver
```

**방법 2: 수동 실행 (개별 단계)**
```bash
# 1. 기본/임상 더미 데이터 생성
python -m setup_dummy_data --base
python -m setup_dummy_data --clinical

# 2. Orthanc 서버 실행 확인 (localhost:8042)

# 3. MRI DICOM 동기화 (수동)
python setup_dummy_data/sync_orthanc_ocs.py

# 4. LIS 파일 동기화 (수동)
python setup_dummy_data/sync_lis_ocs.py

# 5. 확장 데이터 생성
python -m setup_dummy_data --extended

# 6. 서버 실행
python manage.py runserver
```

### 주의사항

- **Orthanc 서버 선택적**: `sync_orthanc_ocs.py` 실행 시 Orthanc 서버가 없으면 경고만 출력하고 계속 진행
- **환자데이터 폴더 수 제한**: OCS RIS는 15건만 생성 (환자데이터 폴더 15개에 맞춤)
- **OCS RIS는 MRI만 생성**: CT, PET OCS는 더 이상 생성되지 않음
- **환자 매핑 순서**: 환자번호 순서대로 환자데이터 폴더와 매핑됨
  - P202600001 ↔ TCGA-CS-4944
  - P202600002 ↔ TCGA-CS-6666
  - ... (15개 매핑)
  - P202600015 ↔ TCGA-HT-7694
- **LIS OCS 파일 규칙**: 각 OCS 타입(RNA_SEQ, BIOMARKER)당 1개 파일만 저장

---

## 진료 예약 스케줄 생성

### setup_dummy_data_4_encounter_schedule.py
> **목적**: 의사 대시보드의 '금일 예약 환자' 리스트를 충분히 채우기 위한 데이터 생성

### 사용법

```bash
# 기본 실행 (2026-01-15 ~ 2026-02-28, 의사당 10명/일)
python -m setup_dummy_data --schedule

# 기간 지정
python -m setup_dummy_data --schedule --start 2026-03-01 --end 2026-03-31

# 의사당 예약 수 변경
python -m setup_dummy_data --schedule --per-doctor 15

# 기존 데이터 무시하고 강제 생성
python -m setup_dummy_data --schedule --force
```

### Django Shell에서 직접 호출

```python
python manage.py shell

# 기본 실행
>>> from setup_dummy_data.setup_dummy_data_4_encounter_schedule import create_scheduled_encounters
>>> create_scheduled_encounters()

# 기간 지정
>>> create_scheduled_encounters('2026-03-01', '2026-03-31')

# 모든 옵션 지정
>>> create_scheduled_encounters(
...     start_date='2026-01-15',
...     end_date='2026-02-28',
...     per_doctor_per_day=10,
...     exclude_weekends=True,
...     time_interval_minutes=30,
...     force=False
... )
```

### 특정 기간 예약 삭제

```python
>>> from setup_dummy_data.setup_dummy_data_4_encounter_schedule import delete_scheduled_encounters

# 삭제 대상 확인
>>> delete_scheduled_encounters('2026-01-15', '2026-02-28')

# 실제 삭제
>>> delete_scheduled_encounters('2026-01-15', '2026-02-28', confirm=True)
```

### 주요 기능

| 기능 | 설명 |
|------|------|
| **유연한 기간 지정** | `--start`, `--end` 파라미터로 자유롭게 지정 |
| **주말 제외** | 토/일요일은 자동 제외 (월~금만 생성) |
| **30분 간격** | 09:00 ~ 17:00 (16개 슬롯) |
| **중복 방지** | 기존 예약이 있으면 스킵 |
| **삭제 함수** | `delete_scheduled_encounters()` 제공 |

### 예상 데이터량

기본 설정 (2026-01-15 ~ 2026-02-28):
- 영업일: 약 33일 (주말 제외)
- 의사 5명 × 10명/일 × 33일 = **약 1,650건**

---

## 테스트 계정

### 비밀번호 규칙

> **규칙: `{login_id}001`**
>
> 예시: `admin` → `admin001`, `doctor1` → `doctor1001`

### 기본 계정

| 역할 | 로그인 ID | 비밀번호 | 설명 |
|------|----------|----------|------|
| SYSTEMMANAGER | system | system001 | 시스템 관리자 (전체 권한) |
| ADMIN | admin | admin001 | 병원 관리자 |
| DOCTOR | doctor1~5 | doctor1001~doctor5001 | 의사 5명 |
| NURSE | nurse1 | nurse1001 | 간호사 |
| PATIENT | patient1 | patient1001 | 환자 |
| RIS | ris1 | ris1001 | 영상과 |
| LIS | lis1 | lis1001 | 검사과 |

### 추가 계정 (main.py에서 생성)

| 역할 | 로그인 ID | 비밀번호 |
|------|----------|----------|
| ADMIN | admin2, admin3 | admin2001, admin3001 |
| NURSE | nurse2, nurse3 | nurse2001, nurse3001 |
| RIS | ris2, ris3 | ris2001, ris3001 |
| LIS | lis2, lis3 | lis2001, lis3001 |
| PATIENT | patient2, patient3 | patient2001, patient3001 |

### 환자 계정 연결

| 계정 | 환자번호 | 환자명 |
|------|----------|--------|
| patient1 | P202600001 | 김동현 |
| patient2 | P202600002 | 이수정 |
| patient3 | P202600003 | 박정훈 |

---

## 생성되는 데이터 통계

| 항목 | 기본/임상 | 확장 | 스케줄 | 동기화 | 합계 |
|------|----------|------|--------|--------|------|
| 메뉴 | ~30개 | - | - | - | ~30개 |
| 권한 | ~30개 | - | - | - | ~30개 |
| 환자 | 50명 | - | - | - | 50명 |
| 진료 | 20건 | 150건 | ~1,650건 | - | ~1,820건 |
| **OCS RIS (MRI)** | **15건** | **-** | - | **15건 CONFIRMED** | **15건** |
| **OCS LIS** | **30건** | 80건 | - | **30건 CONFIRMED** | **~110건** |
| 영상 검사 | 15건 | - | - | - | 15건 |
| 치료 계획 | 15건 | - | - | - | 15건 |
| 경과 기록 | 25건 | - | - | - | 25건 |
| 처방전 | 20건 | - | - | - | 20건 |
| 처방 항목 | ~60건 | - | - | - | ~60건 |
| 공유 일정 | - | ~15건 | - | - | ~15건 |
| 개인 일정 | - | ~50건 | - | - | ~50건 |
| **Orthanc Studies** | - | - | - | **15개** | **15개** |
| **CDSS_STORAGE/LIS** | - | - | - | **30폴더** | **30폴더** |
| **AI 추론 요청** | **0건** | - | - | - | **사용자 요청 시 생성** |

### OCS 데이터 상세 (환자데이터 폴더 15개 기준)

| OCS 유형 | job_type | 생성 수 | CONFIRMED | ACCEPTED |
|----------|----------|---------|-----------|----------|
| **RIS** | **MRI** | **15건** | **15건 (DICOM 연동)** | **0건** |
| **LIS** | **RNA_SEQ** | **15건** | **15건 (파일 연동)** | **0건** |
| **LIS** | **BIOMARKER** | **15건** | **15건 (파일 연동)** | **0건** |
| LIS | 기타 (확장) | ~80건 | - | ~80건 |

> **중요**: OCS RIS (MRI)는 환자데이터 폴더 15개에 맞춰 15건만 생성됩니다.
> OCS LIS도 환자데이터 폴더 기준으로 30건 (RNA_SEQ 15 + BIOMARKER 15) 생성 후, 확장 데이터가 추가됩니다.
> CT, PET OCS는 더 이상 생성되지 않습니다.

---

## 새 기능 추가 가이드

### 새 권한 추가

`setup_dummy_data_1_base.py`의 `permissions_data` 수정:

```python
permissions_data = [
    # 기존 권한들...
    ('NEW_FEATURE', '새 기능', '새 기능 설명'),
    ('NEW_FEATURE_LIST', '새 기능 목록', '새 기능 목록 화면'),
]
```

### 새 메뉴 추가

`setup_dummy_data_1_base.py`의 `setup_menus_and_permissions()` 수정:

```python
# 메뉴 생성 (ID는 기존 최대값 + 1)
menu_new, _ = create_menu(
    42,                          # ID
    code='NEW_FEATURE',          # 코드
    path=None,                   # 상위 메뉴는 path 없음
    icon='star',                 # 아이콘
    group_label='새기능',         # 그룹 라벨
    order=9,                     # 정렬 순서
    is_active=True
)
```

### 역할별 권한 매핑

```python
role_menu_permissions = {
    'SYSTEMMANAGER': list(menu_map.keys()),  # 모든 메뉴
    'ADMIN': [
        # 기존 권한들...
        'NEW_FEATURE', 'NEW_FEATURE_LIST',
    ],
    'DOCTOR': [
        # 기존 권한들...
        'NEW_FEATURE_LIST',  # 필요시 추가
    ],
}
```

---

## 트러블슈팅

### 마이그레이션 실패 시

```bash
# 수동으로 마이그레이션 실행
python manage.py makemigrations --skip-checks
python manage.py migrate --skip-checks
```

### 메뉴가 네비게이션에 안 보일 때

```bash
# 메뉴/권한만 업데이트
python -m setup_dummy_data --menu
```

### 데이터 완전 초기화

```bash
# 모든 더미 데이터 삭제 후 재생성
python -m setup_dummy_data --reset -y
```

### __pycache__ 문제

```bash
# __pycache__ 삭제 후 재실행
find . -type d -name __pycache__ -exec rm -rf {} +
python -m setup_dummy_data --reset -y
```

### 데이터 수동 초기화

```bash
python manage.py shell
>>> from apps.ai_inference.models import AIInference
>>> from apps.treatment.models import TreatmentSession, TreatmentPlan
>>> from apps.followup.models import FollowUp
>>> from apps.prescriptions.models import PrescriptionItem, Prescription
>>> from apps.imaging.models import ImagingStudy
>>> from apps.ocs.models import OCS, OCSHistory
>>> from apps.encounters.models import Encounter
>>> from apps.patients.models import Patient
>>> from apps.schedules.models import SharedSchedule, PersonalSchedule

# 순서대로 삭제 (의존성 역순)
>>> AIInference.objects.all().delete()
>>> TreatmentSession.objects.all().delete()
>>> TreatmentPlan.objects.all().delete()
>>> FollowUp.objects.all().delete()
>>> PrescriptionItem.objects.all().delete()
>>> Prescription.objects.all().delete()
>>> OCSHistory.objects.all().delete()
>>> ImagingStudy.objects.all().delete()
>>> OCS.objects.all().delete()
>>> Encounter.objects.all().delete()
>>> Patient.objects.all().delete()
>>> PersonalSchedule.objects.all().delete()
>>> SharedSchedule.objects.all().delete()
```

---

## 데이터 일관성 규칙

1. **환자 통합 관리**: 모든 환자 데이터는 `setup_dummy_data_2_clinical.py`에서 관리 (50명)
2. **OCS 담당의 관계**: OCS 요청은 반드시 해당 환자의 담당 의사가 요청
3. **동명이인 금지**: 모든 사용자/환자 이름은 고유해야 함
4. **데이터 생성 순서**: 역할 → 사용자 → 환자 → 진료 → OCS 순서 준수

---

## Status 값 규칙

모든 status 값은 **snake_case**로 통일됩니다:

| 앱 | Status 값 |
|----|-----------|
| encounters | `scheduled`, `in_progress`, `completed`, `cancelled` |
| prescriptions | `DRAFT`, `ISSUED`, `DISPENSED`, `CANCELLED` |
| treatment | `planned`, `in_progress`, `completed`, `cancelled`, `on_hold` |
| followup | `stable`, `improved`, `deteriorated`, `recurrence`, `progression`, `remission` |
| imaging (OCS 매핑) | `ordered`, `scheduled`, `in_progress`, `completed`, `reported`, `cancelled` |
| ai_inference.status | `PENDING`, `PROCESSING`, `COMPLETED`, `FAILED`, `CANCELLED` |

---

## AI 추론 워크플로우

### 개요

AI 추론 요청은 **더미 데이터로 생성하지 않습니다**. RIS/LIS 담당자가 OCS 작업 완료(CONFIRMED) 후 워크벤치에서 직접 요청합니다.

### AI 모델 종류

| 모델 코드 | 모델명 | 입력 데이터 | 요청 주체 |
|-----------|--------|-------------|-----------|
| **M1** | MRI 분석 | OCS RIS (MRI) | RIS 담당자 |
| **MG** | Gene Analysis | OCS LIS (RNA_SEQ) | LIS 담당자 |
| **MM** | 멀티모달 | MRI + RNA_SEQ + Protein | 의사 (수동) |

### AI 요청 흐름

```
┌─────────────────────────────────────────────────────────────────┐
│                         M1 / MG 추론                             │
├─────────────────────────────────────────────────────────────────┤
│  1. OCS 생성 (의사) → ORDERED                                    │
│  2. 담당자 접수 (RIS/LIS) → ACCEPTED                             │
│  3. 작업 시작 → IN_PROGRESS                                      │
│  4. 결과 제출 → RESULT_READY                                     │
│  5. 확정 (담당자 또는 의사) → CONFIRMED                           │
│  6. [AI 분석] 버튼 클릭 (RIS/LIS 담당자)                          │
│     - AIInference 생성 (status: PENDING → PROCESSING → COMPLETED)│
│     - modAI 서버 연동                                            │
│  7. 콜백 수신 → AIInference status, completed_at 업데이트         │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                         MM 추론 (멀티모달)                        │
├─────────────────────────────────────────────────────────────────┤
│  ※ 수동 요청만 지원 (자동 트리거 없음)                            │
│  1. 의사가 환자 선택                                             │
│  2. 필요한 OCS 선택 (MRI, RNA_SEQ, Protein)                      │
│  3. MM 추론 요청                                                 │
└─────────────────────────────────────────────────────────────────┘
```

### AI 추론 결과 조회

OCS의 AI 분석 정보는 `ai_inference` 테이블에서 OCS ID로 조회합니다:

| OCS 조건 | AIInference 조회 |
|----------|------------------|
| job_role='RIS', job_type='MRI' | `AIInference.objects.filter(mri_ocs_id=ocs_id)` |
| job_role='LIS', job_type='RNA_SEQ' | `AIInference.objects.filter(rna_ocs_id=ocs_id)` |
| job_role='LIS', job_type='BIOMARKER' | `AIInference.objects.filter(protein_ocs_id=ocs_id)` |

### AI 분석 권한

AI 분석 요청은 다음 조건을 만족해야 합니다:

1. **OCS 상태**: `CONFIRMED` (확정된 오더만 분석 가능)
2. **요청 권한**: OCS의 `worker` 또는 `doctor`만 요청 가능
3. **인증**: 로그인된 사용자만 요청 가능 (IsAuthenticated)

### 테스트 방법

```bash
# 1. 더미 데이터 생성 (AI 요청 제외)
python -m setup_dummy_data --reset -y

# 2. 서버 실행
python manage.py runserver

# 3. RIS 계정으로 로그인
#    ris1 / ris1001

# 4. RIS 워크벤치에서 CONFIRMED 상태의 MRI OCS 선택

# 5. "AI 분석" 버튼 클릭하여 M1 추론 요청

# 6. LIS 계정으로 로그인
#    lis1 / lis1001

# 7. LIS 워크벤치에서 CONFIRMED 상태의 RNA_SEQ OCS 선택

# 8. "AI 분석" 버튼 클릭하여 MG 추론 요청
```
