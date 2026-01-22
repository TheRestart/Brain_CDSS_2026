#!/usr/bin/env python
"""
Brain Tumor CDSS - 더미 데이터 설정 스크립트 (3/3) - 확장 데이터

이 스크립트는 확장 더미 데이터를 생성합니다:
- 확장 진료(Encounter) 150건
- 확장 OCS (RIS) 100건
- 확장 OCS (LIS) 80건
- 오늘 예약 환자 (의사별 5명씩)
- 공유 일정 (SharedSchedule)
- 개인 일정 (PersonalSchedule)

사용법:
    python setup_dummy_data_3_extended.py          # 기존 데이터 유지, 부족분만 추가
    python setup_dummy_data_3_extended.py --reset  # 확장 데이터만 삭제 후 새로 생성

선행 조건:
    python setup_dummy_data_1_base.py      # 기본 더미 데이터 (역할/사용자/메뉴)
    python setup_dummy_data_2_clinical.py  # 임상 더미 데이터 (환자/진료/OCS)
"""

import os
import sys
from pathlib import Path
from datetime import timedelta, time as dt_time
import random
import argparse

# 프로젝트 루트 디렉토리로 이동 (상위 폴더)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
os.chdir(PROJECT_ROOT)

# Django 설정 (sys.path에 프로젝트 루트 추가)
sys.path.insert(0, str(PROJECT_ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

# Django 초기화
import django
django.setup()

from django.utils import timezone
from django.db import transaction


# ============================================================
# 상수 및 샘플 데이터
# ============================================================

# 진단명 목록
DIAGNOSES = [
    "뇌교종 (Glioma)",
    "교모세포종 (Glioblastoma, GBM)",
    "핍지교종 (Oligodendroglioma)",
    "수막종 (Meningioma)",
    "뇌전이암 (Brain Metastasis)",
    "뇌하수체선종 (Pituitary Adenoma)",
    "청신경초종 (Vestibular Schwannoma)",
    "두개인두종 (Craniopharyngioma)",
]

# 주요 호소 증상
CHIEF_COMPLAINTS = [
    '두통이 심해요', '어지러움증이 계속됩니다', '손발 저림 증상',
    '기억력 감퇴', '수면 장애', '편두통', '목 통증',
    '시야 흐림', '균형 감각 이상', '근육 경련', '발작 증세',
    '정기 진료', '추적 검사', '상담', '재진', '수술 후 경과 관찰'
]

# SOAP 노트 샘플
SUBJECTIVE_SAMPLES = [
    '3일 전부터 지속되는 두통, 아침에 더 심함',
    '일주일간 어지러움 증상, 구역감 동반',
    '양손 저림 증상, 특히 야간에 심해짐',
    '최근 건망증이 심해졌다고 호소',
    '잠들기 어렵고 자주 깸, 피로감 호소',
    '우측 관자놀이 쪽 박동성 두통',
    '수술 후 회복 잘 되고 있음',
    '항암 치료 후 경과 양호',
]

OBJECTIVE_SAMPLES = [
    'BP 130/85, HR 72, BT 36.5',
    '신경학적 검사 정상, 경부 강직 없음',
    '동공 반사 정상, 안구 운동 정상',
    'Romberg test 양성, 보행 시 불안정',
    'MMT 정상, DTR 정상, 병적 반사 없음',
    'GCS 15, 의식 명료, 지남력 정상',
    '뇌 MRI: T2 고신호 병변 확인',
    '수술 부위 깨끗함, 감염 소견 없음',
]

ASSESSMENT_SAMPLES = [
    '긴장성 두통 의심, R/O 편두통',
    '말초성 현훈 vs 중추성 현훈 감별 필요',
    '수근관 증후군 의심',
    '경도 인지장애 가능성, 치매 스크리닝 필요',
    '뇌종양 의심, 추가 검사 필요',
    '수술 후 회복 양호',
    '항암 치료 효과 확인 중',
]

PLAN_SAMPLES = [
    '뇌 MRI 촬영, 진통제 처방, 2주 후 재진',
    '청력검사, 전정기능검사 예정',
    '신경전도검사 의뢰, 보존적 치료',
    '인지기능검사, 혈액검사 (갑상선, B12)',
    'MRI 추적검사, 신경외과 협진',
    '정기 추적 검사 예정',
    '항암 치료 지속, 혈액검사 모니터링',
]


# ============================================================
# 선행 조건 확인
# ============================================================

def check_prerequisites():
    """선행 조건 확인"""
    print("\n[0단계] 선행 조건 확인...")

    from django.contrib.auth import get_user_model
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter

    User = get_user_model()

    # 사용자 확인
    if not User.objects.exists():
        print("[ERROR] 사용자가 없습니다.")
        print("  먼저 실행하세요: python setup_dummy_data_1_base.py")
        return False

    # 의사 확인
    doctors = User.objects.filter(role__code='DOCTOR')
    if not doctors.exists():
        print("[ERROR] DOCTOR 역할 사용자가 없습니다.")
        print("  먼저 실행하세요: python setup_dummy_data_1_base.py")
        return False

    # 환자 확인
    patients = Patient.objects.filter(is_deleted=False)
    if not patients.exists():
        print("[ERROR] 환자 데이터가 없습니다.")
        print("  먼저 실행하세요: python setup_dummy_data_2_clinical.py")
        return False

    # 진료 확인
    encounters = Encounter.objects.all()
    if not encounters.exists():
        print("[ERROR] 진료 데이터가 없습니다.")
        print("  먼저 실행하세요: python setup_dummy_data_2_clinical.py")
        return False

    print(f"  사용자: {User.objects.count()}명 (의사: {doctors.count()}명)")
    print(f"  환자: {patients.count()}명")
    print(f"  진료: {encounters.count()}건")
    print("[OK] 선행 조건 충족")
    return True


# ============================================================
# 확장 진료 데이터 (from 4_extended.py)
# ============================================================

def create_extended_encounters(target_count=150, force=False):
    """확장 진료 데이터 생성"""
    print(f"\n[1단계] 확장 진료 데이터 생성 (목표: {target_count}건)...")

    from apps.encounters.models import Encounter
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = Encounter.objects.count()
    if existing_count >= target_count and not force:
        print(f"[SKIP] 이미 {existing_count}건의 진료가 존재합니다.")
        return True

    patients = list(Patient.objects.filter(is_deleted=False, status='active'))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    encounter_types = ['outpatient', 'inpatient', 'emergency']
    departments = ['neurology', 'neurosurgery']

    created_count = 0
    needed = target_count - existing_count

    for i in range(needed):
        patient = random.choice(patients)
        doctor = random.choice(doctors)

        days_ago = random.randint(7, 365)
        admission_date = timezone.now() - timedelta(days=days_ago)
        encounter_type = random.choice(encounter_types)
        status = random.choice(['completed', 'completed', 'completed', 'cancelled'])

        discharge_date = None
        if status == 'completed':
            if encounter_type == 'outpatient':
                discharge_days = 0
            elif encounter_type == 'inpatient':
                discharge_days = random.randint(3, 14)
            else:
                discharge_days = random.randint(1, 3)
            discharge_date = admission_date + timedelta(days=discharge_days)

        soap_data = {}
        if status == 'completed':
            soap_data = {
                'subjective': random.choice(SUBJECTIVE_SAMPLES),
                'objective': random.choice(OBJECTIVE_SAMPLES),
                'assessment': random.choice(ASSESSMENT_SAMPLES),
                'plan': random.choice(PLAN_SAMPLES),
            }

        try:
            Encounter.objects.create(
                patient=patient,
                encounter_type=encounter_type,
                status=status,
                attending_doctor=doctor,
                department=random.choice(departments),
                admission_date=admission_date,
                discharge_date=discharge_date,
                chief_complaint=random.choice(CHIEF_COMPLAINTS),
                primary_diagnosis=random.choice(DIAGNOSES),
                secondary_diagnoses=random.sample(['고혈압', '당뇨', '고지혈증'], random.randint(0, 2)),
                **soap_data,
            )
            created_count += 1
        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 확장 진료 생성: {created_count}건")
    print(f"  현재 전체 진료: {Encounter.objects.count()}건")
    return True


def create_extended_ocs_ris(target_count=100, force=False):
    """확장 OCS RIS (영상 검사) 데이터 생성"""
    print(f"\n[2단계] 확장 OCS RIS 생성 (목표: {target_count}건)...")

    from apps.ocs.models import OCS
    from apps.imaging.models import ImagingStudy
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = OCS.objects.filter(job_role='RIS').count()
    if existing_count >= target_count and not force:
        print(f"[SKIP] 이미 {existing_count}건의 RIS 오더가 존재합니다.")
        return True

    # 필요한 데이터
    encounters = list(Encounter.objects.filter(
        attending_doctor__isnull=False,
        patient__is_deleted=False
    ).select_related('patient', 'attending_doctor'))
    radiologists = list(User.objects.filter(role__code__in=['RIS', 'DOCTOR']))

    if not encounters:
        print("[ERROR] 담당 의사가 있는 진료 기록이 없습니다.")
        return False

    if not radiologists:
        radiologists = list(User.objects.filter(role__code='DOCTOR'))

    # 뇌종양 CDSS에 필요한 영상 검사만
    modalities = ['MRI']  # MRI만 사용 (CT, PET 제거)
    body_parts = ['Brain', 'Head']  # 뇌종양 관련 부위만
    ocs_statuses = ['ORDERED', 'ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']
    priorities = ['urgent', 'normal']
    clinical_indications = ['brain tumor evaluation', 'follow-up', 'post-op check', 'treatment response']

    created_count = 0
    needed = target_count - existing_count

    for i in range(needed):
        encounter = random.choice(encounters)
        patient = encounter.patient
        doctor = encounter.attending_doctor
        modality = random.choice(modalities)
        body_part = random.choice(body_parts)

        days_ago = random.randint(0, 180)
        ocs_status = random.choice(ocs_statuses)

        worker = None
        if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            worker = random.choice(radiologists)

        doctor_request = {
            "_template": "default",
            "_version": "1.0",
            "clinical_info": f"{random.choice(clinical_indications)} - {patient.name}",
            "request_detail": f"{modality} {body_part} 촬영 요청",
            "special_instruction": random.choice(["", "조영제 사용", "조영제 없이", "긴급"]),
        }

        worker_result = {}
        if ocs_status in ['RESULT_READY', 'CONFIRMED']:
            tumor_detected = random.random() < 0.3
            lobes = ['frontal', 'temporal', 'parietal', 'occipital']
            hemispheres = ['left', 'right']

            worker_result = {
                "_template": "RIS",
                "_version": "1.0",
                "_confirmed": ocs_status == 'CONFIRMED',
                "findings": "Mass lesion identified." if tumor_detected else "No acute intracranial abnormality.",
                "impression": "Brain tumor suspected." if tumor_detected else "Normal study.",
                "recommendation": "Further evaluation recommended." if tumor_detected else "",
                "tumor": {
                    "detected": tumor_detected,
                    "location": {"lobe": random.choice(lobes), "hemisphere": random.choice(hemispheres)} if tumor_detected else {},
                    "size": {"max_diameter_cm": round(random.uniform(1.0, 4.0), 1), "volume_cc": round(random.uniform(2.0, 30.0), 1)} if tumor_detected else {}
                },
                "dicom": {
                    "study_uid": f"1.2.840.{random.randint(100000, 999999)}.{random.randint(1000, 9999)}",
                    "series_count": random.randint(1, 5),
                    "instance_count": random.randint(20, 200)
                },
                "work_notes": []
            }

        base_time = timezone.now() - timedelta(days=days_ago)
        timestamps = {'accepted_at': None, 'in_progress_at': None, 'result_ready_at': None, 'confirmed_at': None}

        if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            timestamps['accepted_at'] = base_time + timedelta(hours=random.randint(1, 4))
        if ocs_status in ['IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            timestamps['in_progress_at'] = base_time + timedelta(hours=random.randint(4, 12))
        if ocs_status in ['RESULT_READY', 'CONFIRMED']:
            timestamps['result_ready_at'] = base_time + timedelta(hours=random.randint(12, 48))
        if ocs_status == 'CONFIRMED':
            timestamps['confirmed_at'] = base_time + timedelta(hours=random.randint(48, 72))

        try:
            with transaction.atomic():
                ocs = OCS.objects.create(
                    patient=patient,
                    doctor=doctor,
                    worker=worker,
                    encounter=encounter,
                    job_role='RIS',
                    job_type=modality,
                    ocs_status=ocs_status,
                    priority=random.choice(priorities),
                    doctor_request=doctor_request,
                    worker_result=worker_result,
                    ocs_result=True if ocs_status == 'CONFIRMED' else None,
                    accepted_at=timestamps['accepted_at'],
                    in_progress_at=timestamps['in_progress_at'],
                    result_ready_at=timestamps['result_ready_at'],
                    confirmed_at=timestamps['confirmed_at'],
                )

                scheduled_at = None
                performed_at = None
                if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
                    scheduled_at = base_time + timedelta(days=random.randint(1, 3))
                if ocs_status in ['IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
                    performed_at = scheduled_at + timedelta(hours=random.randint(1, 24)) if scheduled_at else None

                ImagingStudy.objects.create(
                    ocs=ocs,
                    modality=modality,
                    body_part=body_part,
                    study_uid=worker_result.get('dicom', {}).get('study_uid') if worker_result else None,
                    series_count=worker_result.get('dicom', {}).get('series_count', 0) if worker_result else 0,
                    instance_count=worker_result.get('dicom', {}).get('instance_count', 0) if worker_result else 0,
                    scheduled_at=scheduled_at,
                    performed_at=performed_at,
                )

                created_count += 1

        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 확장 OCS(RIS) 생성: {created_count}건")
    print(f"  현재 전체 OCS(RIS): {OCS.objects.filter(job_role='RIS').count()}건")
    return True


def create_extended_ocs_lis(target_count=80, force=False):
    """확장 OCS LIS (검사) 데이터 생성"""
    print(f"\n[3단계] 확장 OCS LIS 생성 (목표: {target_count}건)...")

    from apps.ocs.models import OCS
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = OCS.objects.filter(job_role='LIS').count()
    if existing_count >= target_count and not force:
        print(f"[SKIP] 이미 {existing_count}건의 LIS 오더가 존재합니다.")
        return True

    # 필요한 데이터
    encounters = list(Encounter.objects.filter(
        attending_doctor__isnull=False,
        patient__is_deleted=False
    ).select_related('patient', 'attending_doctor'))
    lab_workers = list(User.objects.filter(role__code__in=['LIS', 'DOCTOR']))

    if not encounters:
        print("[ERROR] 담당 의사가 있는 진료 기록이 없습니다.")
        return False

    if not lab_workers:
        lab_workers = list(User.objects.filter(role__code='DOCTOR'))

    # 뇌종양 CDSS에 필요한 검사만 (8종류)
    test_types = [
        # 혈액검사 (4) - 항암치료/수술 전 필수
        'CBC',            # 일반혈액검사
        'CMP',            # 종합대사패널 (간/신기능 포함)
        'Coagulation',    # 응고검사
        'Tumor Markers',  # 종양표지자
        # 유전자검사 (3) - 뇌종양 분류/예후 판정
        'GENE_PANEL',     # IDH1, MGMT, TP53, EGFR
        'RNA_SEQ',        # RNA 발현 분석
        'DNA_SEQ',        # DNA 변이 분석
        # 단백질검사 (1) - 뇌손상/종양 마커
        'BIOMARKER',      # GFAP, S100B, NSE
    ]
    ocs_statuses = ['ORDERED', 'ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']
    priorities = ['urgent', 'normal']

    created_count = 0
    needed = target_count - existing_count

    for i in range(needed):
        encounter = random.choice(encounters)
        patient = encounter.patient
        doctor = encounter.attending_doctor
        test_type = random.choice(test_types)

        days_ago = random.randint(0, 180)

        if days_ago > 90:
            ocs_status = random.choice(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CANCELLED'])
        elif days_ago > 30:
            ocs_status = random.choice(['RESULT_READY', 'CONFIRMED', 'CONFIRMED'])
        elif days_ago > 7:
            ocs_status = random.choice(['IN_PROGRESS', 'RESULT_READY', 'CONFIRMED'])
        else:
            ocs_status = random.choice(ocs_statuses)

        worker = None
        if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            worker = random.choice(lab_workers)

        doctor_request = {
            "_template": "default",
            "_version": "1.0",
            "clinical_info": f"{patient.name} - 정기검사",
            "request_detail": f"{test_type} 검사 요청",
            "special_instruction": random.choice(["", "공복 필요", "아침 첫 소변", ""]),
        }

        worker_result = {}
        if ocs_status in ['RESULT_READY', 'CONFIRMED']:
            is_abnormal = random.random() < 0.2

            if test_type in ['GENE_PANEL', 'RNA_SEQ', 'DNA_SEQ']:
                gene_mutations = [
                    {"gene_name": "IDH1", "mutation_type": "R132H" if is_abnormal else "Wild Type", "status": "Mutant" if is_abnormal else "Normal"},
                    {"gene_name": "MGMT", "mutation_type": "Methylated" if random.random() > 0.5 else "Unmethylated", "status": "Methylated" if random.random() > 0.5 else "Unmethylated"},
                ]
                worker_result = {
                    "_template": "LIS", "_version": "1.0", "_confirmed": ocs_status == 'CONFIRMED',
                    "test_type": "GENETIC", "gene_mutations": gene_mutations,
                    "summary": "유전자 변이 검출됨" if is_abnormal else "유전자 변이 없음",
                    "interpretation": "IDH1 변이 양성" if is_abnormal else "특이 변이 없음", "_custom": {}
                }
            elif test_type == 'BIOMARKER':
                protein_markers = [
                    {"marker_name": "GFAP", "value": round(random.uniform(0.1, 5.0), 2), "unit": "ng/mL", "reference_range": "0-2.0", "is_abnormal": random.random() > 0.7},
                    {"marker_name": "S100B", "value": round(random.uniform(0.01, 0.5), 3), "unit": "ug/L", "reference_range": "0-0.15", "is_abnormal": random.random() > 0.6},
                ]
                worker_result = {
                    "_template": "LIS", "_version": "1.0", "_confirmed": ocs_status == 'CONFIRMED',
                    "test_type": "PROTEIN", "protein_markers": protein_markers,
                    "summary": "단백질 마커 이상" if is_abnormal else "정상 범위",
                    "interpretation": "뇌종양 관련 마커 상승" if is_abnormal else "특이 소견 없음", "_custom": {}
                }
            else:
                test_results = [
                    {"code": "TEST1", "name": f"{test_type} 항목1", "value": str(round(random.uniform(50, 150), 1)), "unit": "mg/dL", "reference": "50-150", "is_abnormal": False},
                ]
                worker_result = {
                    "_template": "LIS", "_version": "1.0", "_confirmed": ocs_status == 'CONFIRMED',
                    "test_results": test_results,
                    "summary": "이상 소견 있음" if is_abnormal else "정상 범위",
                    "interpretation": "추가 검사 권장" if is_abnormal else "특이 소견 없음", "_custom": {}
                }

        base_time = timezone.now() - timedelta(days=days_ago)
        timestamps = {
            'accepted_at': None, 'in_progress_at': None, 'result_ready_at': None,
            'confirmed_at': None, 'cancelled_at': None,
        }

        if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            timestamps['accepted_at'] = base_time + timedelta(hours=random.randint(1, 4))
        if ocs_status in ['IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            timestamps['in_progress_at'] = base_time + timedelta(hours=random.randint(4, 12))
        if ocs_status in ['RESULT_READY', 'CONFIRMED']:
            timestamps['result_ready_at'] = base_time + timedelta(hours=random.randint(12, 48))
        if ocs_status == 'CONFIRMED':
            timestamps['confirmed_at'] = base_time + timedelta(hours=random.randint(48, 72))
        if ocs_status == 'CANCELLED':
            timestamps['cancelled_at'] = base_time + timedelta(hours=random.randint(1, 24))

        try:
            with transaction.atomic():
                ocs = OCS.objects.create(
                    patient=patient,
                    doctor=doctor,
                    worker=worker,
                    encounter=encounter,
                    job_role='LIS',
                    job_type=test_type,
                    ocs_status=ocs_status,
                    priority=random.choice(priorities),
                    doctor_request=doctor_request,
                    worker_result=worker_result,
                    ocs_result=True if ocs_status == 'CONFIRMED' else None,
                    accepted_at=timestamps['accepted_at'],
                    in_progress_at=timestamps['in_progress_at'],
                    result_ready_at=timestamps['result_ready_at'],
                    confirmed_at=timestamps['confirmed_at'],
                    cancelled_at=timestamps['cancelled_at'],
                )
                OCS.objects.filter(pk=ocs.pk).update(created_at=base_time)
                created_count += 1

        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 확장 OCS(LIS) 생성: {created_count}건")
    print(f"  현재 전체 OCS(LIS): {OCS.objects.filter(job_role='LIS').count()}건")
    return True


# ============================================================
# 오늘 예약 환자 (from 5_today_encounters.py)
# ============================================================

def create_today_encounters(reset=False):
    """오늘 예약 환자 데이터 생성"""
    print("\n[4단계] 오늘 예약 환자 생성...")

    from apps.encounters.models import Encounter
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    doctors = list(User.objects.filter(role__code='DOCTOR', is_active=True))
    patients = list(Patient.objects.filter(is_deleted=False)[:50])

    if not doctors:
        print("[ERROR] DOCTOR 역할의 사용자가 없습니다.")
        return

    if not patients:
        print("[ERROR] 환자 데이터가 없습니다.")
        return

    print(f"  발견된 의사: {len(doctors)}명")

    # 오늘 예약 삭제 (reset 옵션)
    if reset:
        deleted_count = Encounter.objects.filter(
            admission_date__gte=today_start,
            admission_date__lt=today_start + timezone.timedelta(days=1)
        ).delete()[0]
        print(f"[INFO] 기존 오늘 예약 {deleted_count}건 삭제됨")

    # 예약 시간대
    scheduled_times = [
        dt_time(9, 0), dt_time(10, 0), dt_time(11, 0),
        dt_time(14, 0), dt_time(15, 0), dt_time(16, 0),
    ]

    encounter_types = ['outpatient', 'outpatient', 'outpatient', 'inpatient', 'emergency']
    chief_complaints = [
        '두통 지속', '어지러움', '정기 검진', '추적 관찰',
        '증상 악화', 'MRI 결과 확인', '약 처방 요청',
    ]

    created_count = 0

    for doctor in doctors:
        existing = Encounter.objects.filter(
            attending_doctor=doctor,
            admission_date__gte=today_start,
            admission_date__lt=today_start + timezone.timedelta(days=1),
            is_deleted=False
        ).count()

        if existing >= 5:
            print(f"[SKIP] {doctor.name}: 이미 {existing}건의 오늘 예약 존재")
            continue

        statuses = ['scheduled', 'scheduled', 'scheduled', 'in_progress', 'completed']
        random.shuffle(statuses)

        used_patients = set()

        for i, status in enumerate(statuses):
            available = [p for p in patients if p.id not in used_patients]
            if not available:
                break
            patient = random.choice(available)
            used_patients.add(patient.id)

            sched_time = scheduled_times[i % len(scheduled_times)]
            admission_dt = today_start.replace(hour=sched_time.hour, minute=sched_time.minute)

            try:
                Encounter.objects.create(
                    patient=patient,
                    attending_doctor=doctor,
                    admission_date=admission_dt,
                    scheduled_time=sched_time,
                    status=status,
                    encounter_type=random.choice(encounter_types),
                    department=random.choice(['neurology', 'neurosurgery']),
                    chief_complaint=random.choice(chief_complaints),
                )
                created_count += 1
                print(f"  [+] {doctor.name} <- {patient.name} ({status}) @ {sched_time.strftime('%H:%M')}")
            except Exception as e:
                print(f"  [ERROR] 생성 실패: {e}")

    print(f"\n[DONE] 총 {created_count}건의 오늘 예약 생성 완료")

    # 의사별 요약
    print("\n[SUMMARY] 의사별 오늘 예약 현황:")
    for doctor in doctors:
        count = Encounter.objects.filter(
            attending_doctor=doctor,
            admission_date__gte=today_start,
            admission_date__lt=today_start + timezone.timedelta(days=1),
            is_deleted=False
        ).exclude(status='cancelled').count()
        print(f"  {doctor.name}: {count}건")


# ============================================================
# 스케줄 데이터 (from 6_schedules.py)
# ============================================================

def create_shared_schedules(reset=False):
    """공유 일정 더미 데이터 생성"""
    print("\n[5단계] 공유 일정 생성...")

    from apps.accounts.models import User
    from apps.schedules.models import SharedSchedule

    admin_user = User.objects.filter(role__code='ADMIN', is_active=True).first()
    if not admin_user:
        print("[ERROR] ADMIN 역할의 사용자가 없습니다.")
        return 0

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if reset:
        deleted_count = SharedSchedule.objects.filter(is_deleted=False).delete()[0]
        print(f"[INFO] 기존 공유 일정 {deleted_count}건 삭제됨")

    shared_samples = [
        ('전체 직원 회의', 'meeting', '#5b8def', 'ALL', False),
        ('월례 조회', 'announcement', '#8b5cf6', 'ALL', False),
        ('시스템 점검 안내', 'announcement', '#8b5cf6', 'ALL', True),
        ('신년 휴무', 'event', '#ec4899', 'ALL', True),
        ('의료진 워크샵', 'training', '#f2a65a', 'DOCTOR', False),
        ('간호사 보수교육', 'training', '#f2a65a', 'NURSE', False),
        ('검사실 품질관리 교육', 'training', '#f2a65a', 'LIS', False),
        ('영상실 안전교육', 'training', '#f2a65a', 'RIS', False),
        ('관리자 회의', 'meeting', '#5b8def', 'ADMIN', False),
        ('의사 진료지침 세미나', 'training', '#f2a65a', 'DOCTOR', False),
        ('간호 프로토콜 회의', 'meeting', '#5b8def', 'NURSE', False),
        ('외부기관 연계 미팅', 'meeting', '#5b8def', 'EXTERNAL', False),
        ('환자 안내 공지', 'announcement', '#8b5cf6', 'PATIENT', True),
        ('LIS 시스템 업데이트', 'announcement', '#8b5cf6', 'LIS', True),
        ('RIS 장비 점검', 'announcement', '#8b5cf6', 'RIS', True),
    ]

    time_slots = [(9, 0, 10, 0), (10, 0, 11, 30), (13, 0, 14, 0), (14, 0, 15, 30), (15, 0, 17, 0)]

    created_count = 0

    for title, schedule_type, color, visibility, is_all_day in shared_samples:
        day_offset = random.randint(0, 45)
        schedule_date = today_start + timedelta(days=day_offset)

        if is_all_day:
            start_dt = schedule_date.replace(hour=0, minute=0)
            end_dt = schedule_date.replace(hour=23, minute=59)
        else:
            slot = random.choice(time_slots)
            start_dt = schedule_date.replace(hour=slot[0], minute=slot[1])
            end_dt = schedule_date.replace(hour=slot[2], minute=slot[3])

        try:
            SharedSchedule.objects.create(
                title=title,
                schedule_type=schedule_type,
                start_datetime=start_dt,
                end_datetime=end_dt,
                all_day=is_all_day,
                color=color,
                visibility=visibility,
                description=f'{title} - 자동 생성된 공유 일정',
                created_by=admin_user,
            )
            created_count += 1
        except Exception as e:
            print(f"  [ERROR] 공유 일정 생성 실패: {e}")

    print(f"[OK] 공유 일정 생성: {created_count}건")
    return created_count


def create_personal_schedules(reset=False):
    """개인 일정 더미 데이터 생성"""
    print("\n[6단계] 개인 일정 생성...")

    from apps.accounts.models import User
    from apps.schedules.models import PersonalSchedule

    users = list(User.objects.filter(is_active=True).select_related('role'))

    now = timezone.now()
    today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

    if reset:
        deleted_count = PersonalSchedule.objects.filter(is_deleted=False).delete()[0]
        print(f"[INFO] 기존 개인 일정 {deleted_count}건 삭제됨")

    personal_samples = {
        'personal': [('개인 약속', '#5fb3a2'), ('병원 외 미팅', '#5fb3a2'), ('건강검진', '#5fb3a2'), ('가족 행사', '#5fb3a2')],
        'meeting': [('팀 미팅', '#5b8def'), ('프로젝트 회의', '#5b8def')],
        'leave': [('연차', '#e56b6f'), ('반차', '#e56b6f'), ('조퇴', '#e56b6f')],
        'training': [('온라인 교육', '#f2a65a'), ('자격증 공부', '#f2a65a')],
        'other': [('기타 일정', '#9ca3af')],
    }

    time_slots = [(8, 0, 9, 0), (9, 0, 10, 0), (12, 0, 13, 0), (14, 0, 15, 0), (17, 0, 18, 0), (18, 0, 19, 0)]

    created_count = 0

    for user in users:
        if user.role and user.role.code == 'PATIENT':
            continue

        existing = PersonalSchedule.objects.filter(user=user, is_deleted=False).count()
        if existing >= 5:
            continue

        num_schedules = random.randint(3, 6)

        for i in range(num_schedules):
            day_offset = random.randint(-3, 30)
            schedule_date = today_start + timedelta(days=day_offset)

            schedule_type = random.choice(list(personal_samples.keys()))
            title, color = random.choice(personal_samples[schedule_type])

            if schedule_type == 'leave':
                all_day = random.random() < 0.6
            else:
                all_day = random.random() < 0.15

            if all_day:
                start_dt = schedule_date.replace(hour=0, minute=0)
                end_dt = schedule_date.replace(hour=23, minute=59)
            else:
                slot = random.choice(time_slots)
                start_dt = schedule_date.replace(hour=slot[0], minute=slot[1])
                end_dt = schedule_date.replace(hour=slot[2], minute=slot[3])

            try:
                PersonalSchedule.objects.create(
                    user=user,
                    title=title,
                    schedule_type=schedule_type,
                    start_datetime=start_dt,
                    end_datetime=end_dt,
                    all_day=all_day,
                    color=color,
                    description=f'{title} - 자동 생성된 개인 일정',
                )
                created_count += 1
            except Exception as e:
                print(f"  [ERROR] 개인 일정 생성 실패: {e}")

    print(f"[OK] 개인 일정 생성: {created_count}건")
    return created_count


# ============================================================
# 요약 및 메인 함수
# ============================================================

def print_summary():
    """확장 더미 데이터 요약"""
    print("\n" + "="*60)
    print("확장 더미 데이터 생성 완료! (3/3)")
    print("="*60)

    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from apps.ocs.models import OCS
    from apps.imaging.models import ImagingStudy
    from apps.schedules.models import SharedSchedule, PersonalSchedule

    today = timezone.now().date()

    print(f"\n[통계 - 확장 데이터]")
    print(f"  - 전체 환자: {Patient.objects.filter(is_deleted=False).count()}명")
    print(f"  - 전체 진료: {Encounter.objects.count()}건")
    print(f"  - 오늘 예약 진료: {Encounter.objects.filter(admission_date__date=today, status='scheduled').count()}건")
    print(f"  - OCS (RIS): {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  - OCS (LIS): {OCS.objects.filter(job_role='LIS').count()}건")
    print(f"  - 영상 검사: {ImagingStudy.objects.count()}건")
    print(f"  - 공유 일정: {SharedSchedule.objects.filter(is_deleted=False).count()}건")
    print(f"  - 개인 일정: {PersonalSchedule.objects.filter(is_deleted=False).count()}건")

    print(f"\n[다음 단계]")
    print(f"  서버 실행:")
    print(f"    python manage.py runserver")
    print(f"")
    print(f"  테스트 계정:")
    print(f"    system / system001 (시스템 관리자)")
    print(f"    admin / admin001 (병원 관리자)")
    print(f"    doctor1~10 / doctor1001~10001 (의사)")


def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='Brain Tumor CDSS 확장 더미 데이터 생성')
    parser.add_argument('--reset', action='store_true', help='확장 데이터 삭제 후 새로 생성')
    parser.add_argument('--force', action='store_true', help='목표 수량 이상이어도 강제 추가')
    parser.add_argument('-y', '--yes', action='store_true', help='확인 없이 자동 실행')
    args = parser.parse_args()

    print("="*60)
    print("Brain Tumor CDSS - 확장 더미 데이터 생성 (3/3)")
    print("="*60)

    # 선행 조건 확인
    if not check_prerequisites():
        sys.exit(1)

    force = args.reset or args.force

    # ===== 확장 데이터 생성 =====
    # 1. 확장 진료
    create_extended_encounters(150, force=force)

    # 2. 확장 OCS - 스킵
    # ※ OCS는 setup_dummy_data_2_clinical.py에서 60건 생성
    #   - 기본 45건: RIS 15건, LIS 30건 (환자데이터 폴더와 매칭 → CONFIRMED)
    #   - 추가 15건: RIS 5건, LIS 10건 (환자데이터 없음 → ORDERED 유지)
    print("\n[2단계] 확장 OCS 생성 스킵")
    print("  ※ OCS는 setup_dummy_data_2_clinical.py에서 60건 생성 완료")
    print("  ※ 기본 45건 (CONFIRMED): RIS 15 + RNA_SEQ 15 + BIOMARKER 15")
    print("  ※ 추가 15건 (ORDERED): RIS 5 + RNA_SEQ 5 + BIOMARKER 5")

    # 4. 오늘 예약 환자
    create_today_encounters(reset=args.reset)

    # 5. 공유 일정
    create_shared_schedules(reset=args.reset)

    # 6. 개인 일정
    create_personal_schedules(reset=args.reset)

    # 요약 출력
    print_summary()


if __name__ == '__main__':
    main()
