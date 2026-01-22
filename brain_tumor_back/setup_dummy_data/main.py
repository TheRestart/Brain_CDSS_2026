#!/usr/bin/env python
"""
Brain Tumor CDSS - 더미 데이터 설정 스크립트 (통합 래퍼)

이 스크립트는 더미 데이터 스크립트를 순차 실행합니다:
1. setup_dummy_data_1_base.py     - 기본 데이터 (DB생성, 마이그레이션, 역할, 사용자, 메뉴/권한)
2. setup_dummy_data_2_clinical.py - 임상 데이터 (환자, 진료, OCS 16건, AI, 치료계획, 경과, 처방)
2.5. setup_medications.py         - 의약품 마스터 데이터 (뇌종양 관련 의약품 20종)
3. setup_external_patients.py     - 외부 환자 데이터 생성 (EXT-0001~EXT-0010, MRI/RNA/Protein)
4. sync_orthanc_ocs.py            - Orthanc 연동 (MRI DICOM 업로드, OCS RIS worker_result 업데이트)
5. sync_lis_ocs.py                - LIS 연동 (RNA/Protein 파일 복사, OCS LIS worker_result 업데이트)
6. setup_dummy_data_3_extended.py - 확장 데이터 (대량 진료/OCS LIS, 오늘 진료, 일정)
7. setup_dummy_data_4_encounter_schedule.py - 진료 예약 스케줄 (의사별 일정 기간 예약)
8. setup_dummy_data_5_access_logs.py - 접근 감사 로그 (AccessLog 200건)

사용법:
    python -m setup_dummy_data          # 기존 데이터 유지, 부족분만 추가
    python -m setup_dummy_data --reset  # 기존 데이터 삭제 후 새로 생성
    python -m setup_dummy_data --reset -y  # 확인 없이 리셋 실행
    python -m setup_dummy_data --force  # 목표 수량 이상이어도 강제 추가
    python -m setup_dummy_data --base   # 기본 데이터만 생성
    python -m setup_dummy_data --clinical    # 임상 데이터만 생성
    python -m setup_dummy_data --sync   # Orthanc/LIS 동기화만 실행
    python -m setup_dummy_data --extended    # 확장 데이터만 생성
    python -m setup_dummy_data --menu   # 메뉴/권한만 업데이트
    python -m setup_dummy_data --schedule    # 진료 예약 스케줄만 생성 (기본: 2026-01-15 ~ 2026-02-28)
    python -m setup_dummy_data --schedule --start 2026-03-01 --end 2026-03-31  # 기간 지정

선행 조건:
    없음 (DB가 없으면 자동 생성)
    ※ Orthanc 서버가 실행 중이어야 MRI DICOM 업로드 가능 (없으면 스킵)

개별 실행:
    python setup_dummy_data/setup_dummy_data_1_base.py [--reset] [--force]
    python setup_dummy_data/setup_dummy_data_2_clinical.py [--reset] [--force]
    python setup_dummy_data/sync_orthanc_ocs.py [--dry-run] [--skip-upload]
    python setup_dummy_data/sync_lis_ocs.py [--dry-run]
    python setup_dummy_data/setup_dummy_data_3_extended.py [--reset] [--force]
"""

import os
import sys
import subprocess
import argparse
from pathlib import Path

# 현재 디렉토리 (setup_dummy_data 폴더)
SCRIPT_DIR = Path(__file__).resolve().parent
# 프로젝트 루트 디렉토리 (상위 폴더)
PROJECT_ROOT = SCRIPT_DIR.parent


def run_script(script_name, args_list=None, description=""):
    """스크립트 실행"""
    script_path = SCRIPT_DIR / script_name

    if not script_path.exists():
        print(f"[ERROR] {script_name} 파일이 없습니다.")
        return False

    cmd = [sys.executable, str(script_path)]
    if args_list:
        cmd.extend(args_list)

    print(f"\n{'='*60}")
    print(f"[실행] {description}")
    print(f"{'='*60}")
    print(f"$ python setup_dummy_data/{script_name} {' '.join(args_list or [])}")
    print()

    try:
        result = subprocess.run(
            cmd,
            cwd=str(PROJECT_ROOT),
            check=False,
        )
        return result.returncode == 0
    except Exception as e:
        print(f"[ERROR] 스크립트 실행 실패: {e}")
        return False


def print_final_summary():
    """최종 요약 출력"""
    # Django 설정
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from django.utils import timezone
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from apps.imaging.models import ImagingStudy
    from apps.ocs.models import OCS
    from apps.menus.models import Menu, MenuLabel, MenuPermission
    from apps.accounts.models import Permission
    from apps.ai_inference.models import AIInference
    from apps.treatment.models import TreatmentPlan, TreatmentSession
    from apps.followup.models import FollowUp
    from apps.prescriptions.models import Prescription, PrescriptionItem
    from apps.accounts.models import User, Role
    from apps.schedules.models import DoctorSchedule, SharedSchedule, PersonalSchedule
    from apps.audit.models import AuditLog, AccessLog

    print("\n" + "="*60)
    print("전체 더미 데이터 생성 완료!")
    print("="*60)

    # 사용자 통계
    print(f"\n[사용자 통계]")
    for role in Role.objects.all():
        count = User.objects.filter(role=role).count()
        print(f"  - {role.name}: {count}명")

    # 오늘 예약 진료 수
    today = timezone.now().date()
    today_scheduled = Encounter.objects.filter(
        admission_date__date=today,
        status='scheduled'
    ).count()

    print(f"\n[데이터 통계]")
    print(f"  - 메뉴: {Menu.objects.count()}개")
    print(f"  - 메뉴 라벨: {MenuLabel.objects.count()}개")
    print(f"  - 메뉴-권한 매핑: {MenuPermission.objects.count()}개")
    print(f"  - 권한: {Permission.objects.count()}개")
    print(f"  - 환자 (내부): {Patient.objects.filter(is_deleted=False, is_external=False).count()}명")
    print(f"  - 환자 (외부): {Patient.objects.filter(is_deleted=False, is_external=True).count()}명")
    print(f"  - 환자-계정 연결: {Patient.objects.filter(user__isnull=False).count()}명")
    print(f"  - 진료 (전체): {Encounter.objects.count()}건")
    print(f"  - 진료 (오늘 예약): {today_scheduled}건")
    print(f"  - OCS (RIS): {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  - OCS (LIS): {OCS.objects.filter(job_role='LIS').count()}건")
    print(f"  - 영상 검사: {ImagingStudy.objects.count()}건")
    print(f"  - 치료 계획: {TreatmentPlan.objects.count()}건")
    print(f"  - 치료 세션: {TreatmentSession.objects.count()}건")
    print(f"  - 경과 기록: {FollowUp.objects.count()}건")
    print(f"  - 처방: {Prescription.objects.count()}건")
    print(f"  - 처방 항목: {PrescriptionItem.objects.count()}건")
    print(f"  - AI 추론: {AIInference.objects.count()}건")
    print(f"  - 의사 일정: {DoctorSchedule.objects.filter(is_deleted=False).count()}건")
    print(f"  - 공유 일정: {SharedSchedule.objects.filter(is_deleted=False).count()}건")
    print(f"  - 개인 일정: {PersonalSchedule.objects.filter(is_deleted=False).count()}건")
    print(f"  - 인증 로그: {AuditLog.objects.count()}건")
    print(f"  - 접근 로그: {AccessLog.objects.count()}건")

    print(f"\n[다음 단계]")
    print(f"  서버 실행:")
    print(f"    python manage.py runserver")
    print(f"")
    print(f"  테스트 계정:")
    print(f"    system / system001 (시스템 관리자)")
    print(f"    admin, admin2, admin3 / admin001 (병원 관리자)")
    print(f"    doctor1~10 / doctor1001~doctor10001 (의사 10명)")
    print(f"    nurse1, nurse2, nurse3 / nurse1001 (간호사)")
    print(f"    patient1, patient2, patient3 / patient1001 (환자)")
    print(f"    ris1, ris2, ris3 / ris1001 (영상과)")
    print(f"    lis1, lis2, lis3 / lis1001 (검사과)")


def create_additional_users(reset=False):
    """추가 사용자 생성 (각 역할별 2명 추가, system/doctor 제외)"""
    # Django 설정
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from apps.accounts.models import User, Role

    print("\n" + "="*60)
    print("[실행] 추가 사용자 생성")
    print("="*60)

    # 추가할 사용자 정의 (system, doctor 제외)
    additional_users = [
        # ADMIN (병원 관리자)
        {'login_id': 'admin2', 'name': '관리자2', 'email': 'admin2@hospital.com', 'role_code': 'ADMIN', 'password': 'admin2001'},
        {'login_id': 'admin3', 'name': '관리자3', 'email': 'admin3@hospital.com', 'role_code': 'ADMIN', 'password': 'admin3001'},
        # NURSE (간호사)
        {'login_id': 'nurse2', 'name': '간호사2', 'email': 'nurse2@hospital.com', 'role_code': 'NURSE', 'password': 'nurse2001'},
        {'login_id': 'nurse3', 'name': '간호사3', 'email': 'nurse3@hospital.com', 'role_code': 'NURSE', 'password': 'nurse3001'},
        # RIS (영상과)
        {'login_id': 'ris2', 'name': '영상과2', 'email': 'ris2@hospital.com', 'role_code': 'RIS', 'password': 'ris2001'},
        {'login_id': 'ris3', 'name': '영상과3', 'email': 'ris3@hospital.com', 'role_code': 'RIS', 'password': 'ris3001'},
        # LIS (검사과)
        {'login_id': 'lis2', 'name': '검사과2', 'email': 'lis2@hospital.com', 'role_code': 'LIS', 'password': 'lis2001'},
        {'login_id': 'lis3', 'name': '검사과3', 'email': 'lis3@hospital.com', 'role_code': 'LIS', 'password': 'lis3001'},
        # PATIENT (환자)
        {'login_id': 'patient2', 'name': '환자2', 'email': 'patient2@email.com', 'role_code': 'PATIENT', 'password': 'patient2001'},
        {'login_id': 'patient3', 'name': '환자3', 'email': 'patient3@email.com', 'role_code': 'PATIENT', 'password': 'patient3001'},
    ]

    created_count = 0
    skipped_count = 0

    for user_data in additional_users:
        login_id = user_data['login_id']

        if reset:
            # 리셋 모드: 기존 사용자 삭제 후 재생성
            User.objects.filter(login_id=login_id).delete()

        if User.objects.filter(login_id=login_id).exists():
            print(f"  [SKIP] {login_id} 이미 존재")
            skipped_count += 1
            continue

        # 역할 가져오기
        role = Role.objects.filter(code=user_data['role_code']).first()

        user = User.objects.create_user(
            login_id=login_id,
            email=user_data['email'],
            password=user_data['password'],
            name=user_data['name'],
            role=role,
        )
        print(f"  [CREATE] {login_id} ({user_data['name']}) - {user_data['role_code']}")
        created_count += 1

    print(f"\n  생성: {created_count}명, 스킵: {skipped_count}명")
    return True


def create_external_patients(reset=False):
    """
    외부기관 환자 더미 데이터 생성
    - 각 외부기관(EXTERNAL) 사용자당 3명의 외부환자 생성
    - 외부환자 ID: {기관코드}-{YYYYMMDD}-{순번}
    """
    # Django 설정
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from django.utils import timezone
    from apps.accounts.models import User, Role
    from apps.patients.models import Patient
    from datetime import date
    import random

    print("\n" + "="*60)
    print("[실행] 외부기관 환자 생성")
    print("="*60)

    # 외부기관 역할 사용자 조회
    external_role = Role.objects.filter(code='EXTERNAL').first()
    if not external_role:
        print("  [SKIP] EXTERNAL 역할이 없습니다.")
        return True

    external_institutions = User.objects.filter(role=external_role, is_active=True)
    if not external_institutions.exists():
        print("  [SKIP] 외부기관 사용자가 없습니다.")
        return True

    # 외부환자 더미 데이터 (각 기관당 3명)
    external_patient_templates = [
        # 서울대병원 환자
        {'name': '김외부', 'birth_date': date(1975, 3, 15), 'gender': 'M'},
        {'name': '이검사', 'birth_date': date(1982, 7, 22), 'gender': 'F'},
        {'name': '박의뢰', 'birth_date': date(1968, 11, 8), 'gender': 'M'},
        # 아산병원 환자
        {'name': '최영상', 'birth_date': date(1990, 5, 12), 'gender': 'F'},
        {'name': '정진단', 'birth_date': date(1955, 9, 30), 'gender': 'M'},
        {'name': '강분석', 'birth_date': date(1987, 1, 18), 'gender': 'F'},
        # 삼성병원 환자
        {'name': '윤협진', 'birth_date': date(1979, 4, 25), 'gender': 'M'},
        {'name': '한연계', 'birth_date': date(1992, 8, 7), 'gender': 'F'},
        {'name': '송전원', 'birth_date': date(1963, 12, 3), 'gender': 'M'},
        # 세브란스 환자
        {'name': '조외래', 'birth_date': date(1985, 6, 14), 'gender': 'F'},
        {'name': '임판독', 'birth_date': date(1971, 2, 28), 'gender': 'M'},
        {'name': '황자문', 'birth_date': date(1995, 10, 19), 'gender': 'F'},
        # 전남대병원 환자
        {'name': '노원격', 'birth_date': date(1960, 7, 11), 'gender': 'M'},
        {'name': '백상담', 'birth_date': date(1988, 3, 5), 'gender': 'F'},
        {'name': '서지원', 'birth_date': date(1977, 9, 22), 'gender': 'M'},
    ]

    created_count = 0
    skipped_count = 0
    patient_idx = 0

    # 의사 조회 (OCS 생성 시 사용)
    doctor_role = Role.objects.filter(code='DOCTOR').first()
    doctors = list(User.objects.filter(role=doctor_role, is_active=True)[:3])
    if not doctors:
        print("  [WARNING] 의사 사용자가 없습니다. 외부환자만 생성합니다.")

    for institution in external_institutions:
        print(f"\n  [{institution.name}] ({institution.login_id})")

        # 각 기관당 3명의 환자 생성
        for i in range(3):
            if patient_idx >= len(external_patient_templates):
                patient_idx = 0  # 템플릿 재사용

            template = external_patient_templates[patient_idx]
            patient_idx += 1

            # 리셋 모드: 해당 기관의 외부환자 삭제
            if reset:
                Patient.objects.filter(
                    is_external=True,
                    external_institution=institution
                ).delete()

            # 이미 동일 정보의 환자가 있는지 확인
            existing = Patient.objects.filter(
                name=template['name'],
                birth_date=template['birth_date'],
                is_external=True,
                external_institution=institution
            ).first()

            if existing:
                print(f"    [SKIP] {template['name']} 이미 존재 ({existing.patient_number})")
                skipped_count += 1
                continue

            try:
                # 외부환자 생성 (patient_number는 save()에서 자동 생성)
                patient = Patient(
                    name=template['name'],
                    birth_date=template['birth_date'],
                    gender=template['gender'],
                    phone='000-0000-0000',  # 외부환자는 더미값
                    ssn=f"EXT-{institution.login_id}-{i+1:03d}",
                    is_external=True,
                    external_institution=institution,
                    registered_by=doctors[0] if doctors else None,
                )
                patient.save()
                print(f"    [CREATE] {template['name']} → {patient.patient_number}")
                created_count += 1

            except Exception as e:
                print(f"    [ERROR] {template['name']}: {e}")
                skipped_count += 1

    print(f"\n  생성: {created_count}명, 스킵: {skipped_count}명")
    return True


def link_patient_accounts(reset=False):
    """환자 계정을 환자 데이터와 연결"""
    # Django 설정
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from apps.accounts.models import User
    from apps.patients.models import Patient

    print("\n" + "="*60)
    print("[실행] 환자 계정-데이터 연결")
    print("="*60)

    # 연결할 환자 계정 매핑 (login_id, patient_number)
    patient_links = [
        ('patient1', 'P202600001'),
        ('patient2', 'P202600002'),
        ('patient3', 'P202600003'),
    ]

    linked_count = 0
    skipped_count = 0

    for login_id, patient_number in patient_links:
        try:
            user = User.objects.filter(login_id=login_id).first()
            patient = Patient.objects.filter(patient_number=patient_number).first()

            if not user:
                print(f"  [SKIP] {login_id} 사용자 없음")
                skipped_count += 1
                continue

            if not patient:
                print(f"  [SKIP] {patient_number} 환자 데이터 없음")
                skipped_count += 1
                continue

            if patient.user and patient.user != user and not reset:
                print(f"  [SKIP] {patient_number} 이미 다른 계정과 연결됨")
                skipped_count += 1
                continue

            patient.user = user
            patient.save()
            print(f"  [LINK] {login_id} <-> {patient_number} ({patient.name})")
            linked_count += 1

        except Exception as e:
            print(f"  [ERROR] {login_id} <-> {patient_number}: {e}")
            skipped_count += 1

    print(f"\n  연결: {linked_count}건, 스킵: {skipped_count}건")
    return True


def create_external_patient_ocs(reset=False):
    """
    외부 환자(is_external=True)에게 OCS 생성 (RIS + LIS)

    - RIS: MRI (sync_orthanc_ocs.py에서 Orthanc과 동기화)
    - LIS: RNA_SEQ, BIOMARKER (sync_lis_ocs.py에서 파일 동기화)
    """
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from django.utils import timezone
    from apps.patients.models import Patient
    from apps.ocs.models import OCS
    from apps.accounts.models import User

    print("\n" + "="*60)
    print("[실행] 외부 환자 OCS 생성 (RIS + LIS)")
    print("="*60)

    # 외부 환자 조회
    ext_patients = list(Patient.objects.filter(is_external=True, is_deleted=False))
    print(f"  외부 환자: {len(ext_patients)}명")

    if len(ext_patients) == 0:
        print("  [SKIP] 외부 환자가 없습니다.")
        return True

    # 의사 계정 찾기
    doctor = User.objects.filter(role__code='DOCTOR').first()
    if not doctor:
        doctor = User.objects.filter(is_superuser=True).first()
    print(f"  담당의: {doctor.login_id if doctor else 'None'}")

    # reset 모드면 기존 OCS 삭제
    if reset:
        from apps.ai_inference.models import AIInference
        ext_ocs = OCS.objects.filter(ocs_id__startswith='ext_ocs_')
        # 연결된 AIInference 삭제
        for ocs in ext_ocs:
            AIInference.objects.filter(mri_ocs=ocs).delete()
            AIInference.objects.filter(rna_ocs=ocs).delete()
            AIInference.objects.filter(protein_ocs=ocs).delete()
        ext_ocs.delete()
        print(f"  기존 ext_ocs_* OCS 삭제 완료")

    created_ris = 0
    created_lis = 0
    skipped = 0

    # OCS ID 카운터
    ocs_counter = 1

    for patient in ext_patients:
        print(f"\n  [{patient.patient_number}]")

        # 1. RIS OCS (MRI)
        existing_ris = OCS.objects.filter(patient=patient, job_role='RIS', job_type='MRI').exists()
        if existing_ris:
            print(f"    RIS/MRI: 이미 존재, 스킵")
            skipped += 1
        else:
            ocs_id = f'ext_ocs_{ocs_counter:04d}'
            while OCS.objects.filter(ocs_id=ocs_id).exists():
                ocs_counter += 1
                ocs_id = f'ext_ocs_{ocs_counter:04d}'

            OCS.objects.create(
                ocs_id=ocs_id,
                patient=patient,
                job_role='RIS',
                job_type='MRI',
                ocs_status=OCS.OcsStatus.ORDERED,
                doctor=doctor,
                created_at=timezone.now(),
            )
            print(f"    RIS/MRI: {ocs_id} 생성")
            created_ris += 1
            ocs_counter += 1

        # 2. LIS OCS (RNA_SEQ)
        existing_rna = OCS.objects.filter(patient=patient, job_role='LIS', job_type='RNA_SEQ').exists()
        if existing_rna:
            print(f"    LIS/RNA_SEQ: 이미 존재, 스킵")
            skipped += 1
        else:
            ocs_id = f'ext_ocs_{ocs_counter:04d}'
            while OCS.objects.filter(ocs_id=ocs_id).exists():
                ocs_counter += 1
                ocs_id = f'ext_ocs_{ocs_counter:04d}'

            OCS.objects.create(
                ocs_id=ocs_id,
                patient=patient,
                job_role='LIS',
                job_type='RNA_SEQ',
                ocs_status=OCS.OcsStatus.ORDERED,
                doctor=doctor,
                created_at=timezone.now(),
            )
            print(f"    LIS/RNA_SEQ: {ocs_id} 생성")
            created_lis += 1
            ocs_counter += 1

        # 3. LIS OCS (BIOMARKER)
        existing_bio = OCS.objects.filter(patient=patient, job_role='LIS', job_type='BIOMARKER').exists()
        if existing_bio:
            print(f"    LIS/BIOMARKER: 이미 존재, 스킵")
            skipped += 1
        else:
            ocs_id = f'ext_ocs_{ocs_counter:04d}'
            while OCS.objects.filter(ocs_id=ocs_id).exists():
                ocs_counter += 1
                ocs_id = f'ext_ocs_{ocs_counter:04d}'

            OCS.objects.create(
                ocs_id=ocs_id,
                patient=patient,
                job_role='LIS',
                job_type='BIOMARKER',
                ocs_status=OCS.OcsStatus.ORDERED,
                doctor=doctor,
                created_at=timezone.now(),
            )
            print(f"    LIS/BIOMARKER: {ocs_id} 생성")
            created_lis += 1
            ocs_counter += 1

    print(f"\n  생성: RIS {created_ris}건, LIS {created_lis}건, 스킵: {skipped}건")
    return True


def run_schedule_generator(start_date='2026-01-15', end_date='2026-02-28', per_doctor=10, force=False):
    """진료 예약 스케줄 생성"""
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from setup_dummy_data.setup_dummy_data_4_encounter_schedule import create_scheduled_encounters

    return create_scheduled_encounters(
        start_date=start_date,
        end_date=end_date,
        per_doctor_per_day=per_doctor,
        exclude_weekends=True,
        time_interval_minutes=30,
        force=force
    )


def reset_cdss_storage_folder(folder_path, folder_name):
    """
    CDSS_STORAGE 하위 폴더 초기화

    Args:
        folder_path: Path 객체
        folder_name: 표시용 폴더 이름 (AI, LIS, RIS)

    Returns:
        삭제된 폴더/파일 수
    """
    import shutil
    try:
        if not folder_path.exists():
            print(f"  CDSS_STORAGE/{folder_name} 폴더가 없습니다.")
            return 0

        # 하위 폴더/파일 목록 조회
        items = list(folder_path.iterdir())
        if not items:
            print(f"  CDSS_STORAGE/{folder_name}에 데이터가 없습니다.")
            return 0

        print(f"  CDSS_STORAGE/{folder_name}에 {len(items)}개의 항목이 있습니다. 삭제 중...")

        deleted_count = 0
        for item in items:
            try:
                if item.is_dir():
                    shutil.rmtree(item)
                else:
                    item.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"    [WARNING] {item.name} 삭제 실패: {e}")

        print(f"  [OK] {deleted_count}개 삭제 완료")
        return deleted_count

    except Exception as e:
        print(f"  [ERROR] CDSS_STORAGE/{folder_name} 리셋 실패: {e}")
        return 0


def reset_external_storage():
    """
    외부 저장소 초기화 (CDSS_STORAGE/AI, CDSS_STORAGE/LIS, CDSS_STORAGE/RIS, Orthanc)
    + OCS 상태 초기화 (CONFIRMED -> ORDERED, worker_result 삭제)

    setup_dummy_data --reset 실행 시 호출됨
    """
    # Django 설정
    os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
    os.chdir(PROJECT_ROOT)

    import django
    django.setup()

    from django.conf import settings
    from apps.ocs.models import OCS

    print("\n" + "=" * 60)
    print("[사전 작업] 외부 저장소 초기화")
    print("=" * 60)

    # 1. CDSS_STORAGE 초기화 (AI, LIS, RIS)
    print("\n[1] CDSS_STORAGE 초기화...")

    # 1-1. AI 초기화
    print("\n  [1-1] CDSS_STORAGE/AI 초기화...")
    reset_cdss_storage_folder(settings.CDSS_AI_STORAGE, "AI")

    # 1-2. LIS 초기화
    print("\n  [1-2] CDSS_STORAGE/LIS 초기화...")
    reset_cdss_storage_folder(settings.CDSS_LIS_STORAGE, "LIS")

    # 1-3. RIS 초기화
    print("\n  [1-3] CDSS_STORAGE/RIS 초기화...")
    reset_cdss_storage_folder(settings.CDSS_RIS_STORAGE, "RIS")

    # 2. Orthanc 초기화
    print("\n[2] Orthanc 초기화...")
    try:
        from setup_dummy_data.sync_orthanc_ocs import reset_orthanc_all
        reset_orthanc_all()
    except Exception as e:
        print(f"  [WARNING] Orthanc 초기화 실패: {e}")

    # 3. OCS 상태 초기화 (CONFIRMED -> ORDERED, worker_result 삭제)
    print("\n[3] OCS 상태 초기화...")

    # 3-1. RIS OCS 초기화 (내부 환자 ocs_0001~0015)
    print("\n  [3-1] RIS OCS 초기화 (ocs_0001~0015)...")
    ris_ocs = OCS.objects.filter(
        ocs_id__in=[f'ocs_{i:04d}' for i in range(1, 16)],
        job_role='RIS'
    )
    ris_count = ris_ocs.count()
    if ris_count > 0:
        ris_ocs.update(ocs_status=OCS.OcsStatus.ORDERED, worker_result={}, confirmed_at=None)
        print(f"    {ris_count}건 초기화 완료")
    else:
        print("    초기화 대상 없음")

    # 3-2. LIS OCS 초기화 (내부 환자 P202600001~P202600015)
    print("\n  [3-2] LIS OCS 초기화 (내부 환자)...")
    lis_ocs = OCS.objects.filter(
        job_role='LIS',
        job_type__in=['RNA_SEQ', 'BIOMARKER'],
        patient__patient_number__in=[f'P2026000{i:02d}' for i in range(1, 16)]
    )
    lis_count = lis_ocs.count()
    if lis_count > 0:
        lis_ocs.update(ocs_status=OCS.OcsStatus.ORDERED, worker_result={}, confirmed_at=None)
        print(f"    {lis_count}건 초기화 완료")
    else:
        print("    초기화 대상 없음")

    # 3-3. 외부 환자 OCS 초기화 (ext_ocs_*)
    print("\n  [3-3] 외부 환자 OCS 초기화 (ext_ocs_*)...")
    ext_ocs = OCS.objects.filter(ocs_id__startswith='ext_ocs_')
    ext_count = ext_ocs.count()
    if ext_count > 0:
        # 연결된 AIInference 먼저 삭제
        from apps.ai_inference.models import AIInference
        AIInference.objects.filter(mri_ocs__in=ext_ocs).delete()
        ext_ocs.delete()
        print(f"    {ext_count}건 삭제 완료")
    else:
        print("    삭제 대상 없음")


def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='Brain Tumor CDSS 더미 데이터 생성 (통합)')
    parser.add_argument('--reset', action='store_true', help='기존 데이터 삭제 후 새로 생성')
    parser.add_argument('--force', action='store_true', help='목표 수량 이상이어도 강제 추가')
    parser.add_argument('--base', action='store_true', help='기본 데이터만 생성 (1_base)')
    parser.add_argument('--clinical', action='store_true', help='임상 데이터만 생성 (2_clinical)')
    parser.add_argument('--sync', action='store_true', help='Orthanc/LIS 동기화만 실행')
    parser.add_argument('--extended', action='store_true', help='확장 데이터만 생성 (3_extended)')
    parser.add_argument('--menu', action='store_true', help='메뉴/권한만 업데이트')
    parser.add_argument('--schedule', action='store_true', help='진료 예약 스케줄 생성')
    parser.add_argument('--start', type=str, default='2026-01-15', help='예약 시작 날짜 (YYYY-MM-DD)')
    parser.add_argument('--end', type=str, default='2026-02-28', help='예약 종료 날짜 (YYYY-MM-DD)')
    parser.add_argument('--per-doctor', type=int, default=10, help='의사당 하루 예약 수 (기본: 10)')
    parser.add_argument('-y', '--yes', action='store_true', default=True, help='확인 없이 자동 실행 (기본값: True)')
    parser.add_argument('--interactive', action='store_true', help='대화형 모드 (확인 필요)')
    args = parser.parse_args()

    # --interactive 옵션이 있으면 -y 비활성화
    if args.interactive:
        args.yes = False

    print("="*60)
    print("Brain Tumor CDSS - 더미 데이터 생성 (통합)")
    print("="*60)

    # --menu 옵션: 메뉴/권한만 업데이트
    if args.menu:
        run_script(
            'setup_dummy_data_1_base.py',
            ['--menu'],
            '메뉴/권한 업데이트'
        )
        return

    # --schedule 옵션: 진료 예약 스케줄만 생성
    if args.schedule:
        print(f"\n[실행] 진료 예약 스케줄 생성")
        print(f"  기간: {args.start} ~ {args.end}")
        print(f"  의사당 하루 예약: {args.per_doctor}건")
        try:
            run_schedule_generator(
                start_date=args.start,
                end_date=args.end,
                per_doctor=args.per_doctor,
                force=args.force
            )
        except Exception as e:
            print(f"\n[ERROR] 스케줄 생성 실패: {e}")
            import traceback
            traceback.print_exc()
        return

    # 개별 실행 옵션 처리
    if args.base or args.clinical or args.sync or args.extended:
        script_args = []
        if args.reset:
            script_args.append('--reset')
        if args.force:
            script_args.append('--force')
        if args.yes:
            script_args.append('-y')

        if args.base:
            run_script('setup_dummy_data_1_base.py', script_args, '기본 데이터 생성')
        if args.clinical:
            run_script('setup_dummy_data_2_clinical.py', script_args, '임상 데이터 생성')
        if args.sync:
            # Orthanc/LIS 동기화 (--reset/--force 무시, 항상 실행)
            run_script('sync_orthanc_ocs.py', [], 'Orthanc MRI 동기화')
            run_script('sync_lis_ocs.py', [], 'LIS RNA/Protein 동기화')
        if args.extended:
            run_script('setup_dummy_data_3_extended.py', script_args, '확장 데이터 생성')
        return

    # 전체 실행
    script_args = []
    if args.reset:
        script_args.append('--reset')
    if args.force:
        script_args.append('--force')
    if args.yes:
        script_args.append('-y')

    success = True

    # 0. 외부 저장소 초기화 (항상 실행)
    reset_external_storage()

    # 1. 기본 데이터 생성 (역할, 사용자, 메뉴/권한)
    if not run_script(
        'setup_dummy_data_1_base.py',
        script_args,
        '기본 데이터 생성 (1/11) - 역할, 사용자, 메뉴/권한'
    ):
        print("\n[WARNING] 기본 데이터 생성에 문제가 있습니다.")
        success = False

    # 2. 임상 데이터 생성 (환자, 진료, OCS 16건, AI, 치료, 경과, 처방)
    if not run_script(
        'setup_dummy_data_2_clinical.py',
        script_args,
        '임상 데이터 생성 (2/11) - 환자, 진료, OCS 16건, AI, 치료, 경과, 처방'
    ):
        print("\n[WARNING] 임상 데이터 생성에 문제가 있습니다.")
        success = False

    # 2.5. 의약품 마스터 데이터 생성
    if not run_script(
        'setup_medications.py',
        [],  # 별도 옵션 없음
        '의약품 마스터 데이터 생성 (2.5/11) - 뇌종양 관련 의약품 20종'
    ):
        print("\n[WARNING] 의약품 데이터 생성에 문제가 있습니다.")
        # 의약품 생성 실패는 치명적이지 않음 - 계속 진행

    # 3. 외부 환자 데이터 생성 (EXT-0001~EXT-0010)
    if not run_script(
        'setup_external_patients.py',
        [],  # 별도 옵션 없음
        '외부 환자 데이터 생성 (3/11) - EXT-0001~EXT-0010 (MRI/RNA/Protein)'
    ):
        print("\n[WARNING] 외부 환자 데이터 생성에 문제가 있습니다.")
        # 외부 환자 생성 실패는 치명적이지 않음 - 계속 진행

    # 4. Orthanc MRI 동기화 (DICOM 업로드, OCS RIS worker_result 업데이트)
    print(f"\n{'='*60}")
    print(f"[실행] Orthanc MRI 동기화 (4/11)")
    print(f"{'='*60}")
    if not run_script(
        'sync_orthanc_ocs.py',
        [],  # sync 스크립트는 별도 옵션 없이 실행
        'Orthanc MRI 동기화 - DICOM 업로드, OCS RIS 업데이트 (내부+외부)'
    ):
        print("\n[WARNING] Orthanc 동기화에 문제가 있습니다. (Orthanc 서버 미실행?)")
        # Orthanc 실패는 치명적이지 않음 - 계속 진행

    # 5. LIS RNA/Protein 동기화 (파일 복사, OCS LIS worker_result 업데이트)
    print(f"\n{'='*60}")
    print(f"[실행] LIS RNA/Protein 동기화 (5/11)")
    print(f"{'='*60}")
    if not run_script(
        'sync_lis_ocs.py',
        [],  # sync 스크립트는 별도 옵션 없이 실행
        'LIS 동기화 - RNA/Protein 파일 복사, OCS LIS 업데이트'
    ):
        print("\n[WARNING] LIS 동기화에 문제가 있습니다.")
        # LIS 실패도 치명적이지 않음 - 계속 진행

    # 6. 확장 데이터 생성 (대량 진료/OCS LIS, 오늘 진료, 일정)
    if not run_script(
        'setup_dummy_data_3_extended.py',
        script_args,
        '확장 데이터 생성 (6/11) - 대량 진료/OCS LIS, 오늘 진료, 일정'
    ):
        print("\n[WARNING] 확장 데이터 생성에 문제가 있습니다.")
        success = False

    # 7. 추가 사용자 생성
    print(f"\n{'='*60}")
    print(f"[실행] 추가 사용자 생성 (7/11)")
    print(f"{'='*60}")
    try:
        create_additional_users(reset=args.reset)
    except Exception as e:
        print(f"\n[WARNING] 추가 사용자 생성에 문제가 있습니다: {e}")
        success = False

    # 8. 환자 계정-데이터 연결
    print(f"\n{'='*60}")
    print(f"[실행] 환자 계정-데이터 연결 (8/11)")
    print(f"{'='*60}")
    try:
        link_patient_accounts(reset=args.reset)
    except Exception as e:
        print(f"\n[WARNING] 환자 계정 연결에 문제가 있습니다: {e}")
        success = False

    # 9. 외부기관 환자 생성 (DB)
    print(f"\n{'='*60}")
    print(f"[실행] 외부기관 환자 생성 - DB (9/11)")
    print(f"{'='*60}")
    try:
        create_external_patients(reset=args.reset)
    except Exception as e:
        print(f"\n[WARNING] 외부기관 환자 생성에 문제가 있습니다: {e}")
        success = False

    # 9-1. 외부 환자 OCS 생성 (RIS + LIS)
    print(f"\n{'='*60}")
    print(f"[실행] 외부 환자 OCS 생성 - RIS + LIS (9-1/11)")
    print(f"{'='*60}")
    try:
        create_external_patient_ocs(reset=args.reset)
    except Exception as e:
        print(f"\n[WARNING] 외부 환자 OCS 생성에 문제가 있습니다: {e}")
        success = False

    # 9-2. 외부 환자 Orthanc 동기화 (OCS RIS 생성 후 다시 실행)
    print(f"\n{'='*60}")
    print(f"[실행] 외부 환자 Orthanc 동기화 (9-2/11)")
    print(f"{'='*60}")
    if not run_script(
        'sync_orthanc_ocs.py',
        [],
        '외부 환자 Orthanc 동기화 - OCS RIS CONFIRMED 상태로 업데이트'
    ):
        print("\n[WARNING] 외부 환자 Orthanc 동기화에 문제가 있습니다.")

    # 10. 접근 감사 로그 생성
    print(f"\n{'='*60}")
    print(f"[실행] 접근 감사 로그 생성 (10/11)")
    print(f"{'='*60}")
    if not run_script(
        'setup_dummy_data_5_access_logs.py',
        script_args,
        '접근 감사 로그 생성 (10/11) - AccessLog 200건'
    ):
        print("\n[WARNING] 접근 감사 로그 생성에 문제가 있습니다.")
        success = False

    # 최종 요약
    print_final_summary()

    if not success:
        sys.exit(1)


if __name__ == '__main__':
    main()
