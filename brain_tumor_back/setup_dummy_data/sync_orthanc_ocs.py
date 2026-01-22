#!/usr/bin/env python
"""
Orthanc DICOM 업로드 및 OCS 동기화 스크립트

이 스크립트는:
1. 환자데이터 폴더의 MRI를 Orthanc에 업로드
2. OCS RIS 레코드의 worker_result를 Orthanc 정보로 업데이트
3. Orthanc/DICOM 데이터가 있는 OCS → CONFIRMED, 없으면 → ORDERED (요청됨)

※ CT/PET OCS는 setup_dummy_data_*.py에서 생성하지 않음 (MRI만 생성)

사용법:
    python setup_dummy_data/sync_orthanc_ocs.py
    python setup_dummy_data/sync_orthanc_ocs.py --dry-run  # 테스트 모드
    python setup_dummy_data/sync_orthanc_ocs.py --skip-upload  # 업로드 스킵 (OCS만 업데이트)
"""

import os
import sys
import json
import argparse
import uuid
from pathlib import Path
from datetime import datetime
import requests

# 프로젝트 루트 디렉토리로 이동 (상위 폴더)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
os.chdir(PROJECT_ROOT)

# Django 설정
sys.path.insert(0, str(PROJECT_ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()

from django.utils import timezone
from django.db import transaction
from apps.ocs.models import OCS
from apps.patients.models import Patient
from django.conf import settings

# ============================================================
# 설정
# ============================================================

ORTHANC_URL = settings.ORTHANC_BASE_URL
PATIENT_DATA_PATH = settings.PATIENT_DATA_ROOT


# 환자 폴더 목록 (순서대로 15개 TCGA + 10개 외부환자)
PATIENT_FOLDERS = [
    "TCGA-CS-4944",
    "TCGA-CS-6666",
    "TCGA-DU-5855",
    "TCGA-DU-5874",
    "TCGA-DU-7014",
    "TCGA-DU-7015",
    "TCGA-DU-7018",
    "TCGA-DU-7300",
    "TCGA-DU-A5TW",
    "TCGA-DU-A5TY",
    "TCGA-FG-7634",
    "TCGA-HT-7473",
    "TCGA-HT-7602",
    "TCGA-HT-7686",
    "TCGA-HT-7694",
]

# 외부 환자 폴더 목록 (6개 - DB 외부 환자 수와 동일)
EXTERNAL_PATIENT_FOLDERS = [
    "EXT-0001",
    "EXT-0002",
    "EXT-0003",
    "EXT-0004",
    "EXT-0005",
    "EXT-0006",
]

# MRI 시리즈 타입 매핑
SERIES_TYPE_MAP = {
    "t1": "T1",
    "t2": "T2",
    "t1ce": "T1C",
    "flair": "FLAIR",
    "seg": "SEG",
}


# ============================================================
# Orthanc API 헬퍼
# ============================================================

def orthanc_get(path):
    """Orthanc GET 요청"""
    r = requests.get(f"{ORTHANC_URL}{path}", timeout=30)
    r.raise_for_status()
    return r.json()


def orthanc_post_dicom(dicom_bytes):
    """DICOM 파일 업로드"""
    r = requests.post(
        f"{ORTHANC_URL}/instances",
        data=dicom_bytes,
        headers={"Content-Type": "application/dicom"},
        timeout=60
    )
    r.raise_for_status()
    return r.json()


def orthanc_delete(path):
    """Orthanc DELETE 요청"""
    r = requests.delete(f"{ORTHANC_URL}{path}", timeout=30)
    r.raise_for_status()
    return r.json() if r.text else {}


def reset_orthanc_all():
    """
    Orthanc의 모든 데이터 삭제

    Returns:
        삭제된 study 수
    """
    try:
        # 모든 study 조회
        studies = orthanc_get("/studies")
        if not studies:
            print("  Orthanc에 데이터가 없습니다.")
            return 0

        print(f"  Orthanc에 {len(studies)}개의 Study가 있습니다. 삭제 중...")

        deleted_count = 0
        for study_id in studies:
            try:
                orthanc_delete(f"/studies/{study_id}")
                deleted_count += 1
            except Exception as e:
                print(f"    [WARNING] Study {study_id} 삭제 실패: {e}")

        print(f"  [OK] {deleted_count}개의 Study 삭제 완료")
        return deleted_count

    except requests.exceptions.ConnectionError:
        print("  [WARNING] Orthanc 서버에 연결할 수 없습니다. 리셋 스킵.")
        return 0
    except Exception as e:
        print(f"  [ERROR] Orthanc 리셋 실패: {e}")
        return 0


def check_orthanc_patient_exists(patient_number):
    """
    Orthanc에 해당 환자의 Study가 이미 존재하는지 확인

    Returns:
        study_info dict 또는 None
    """
    try:
        # Orthanc의 모든 환자 조회
        patients = orthanc_get("/patients")
        for patient_id in patients:
            patient_info = orthanc_get(f"/patients/{patient_id}")
            # PatientID가 일치하는지 확인
            main_dicom = patient_info.get("MainDicomTags", {})
            if main_dicom.get("PatientID") == patient_number:
                # 해당 환자의 Study 정보 반환
                studies = patient_info.get("Studies", [])
                if studies:
                    study_id = studies[0]  # 첫 번째 Study
                    study_info = orthanc_get(f"/studies/{study_id}")
                    return {
                        "orthanc_patient_id": patient_id,
                        "orthanc_study_id": study_id,
                        "study_info": study_info
                    }
        return None
    except Exception as e:
        print(f"  [WARNING] Orthanc 환자 확인 실패: {e}")
        return None


def get_existing_orthanc_info(patient_number):
    """
    Orthanc에서 기존 환자 Study 정보 조회

    Returns:
        orthanc_info dict (upload_patient_mri 반환값과 동일 구조) 또는 None
    """
    existing = check_orthanc_patient_exists(patient_number)
    if not existing:
        return None

    study_info = existing["study_info"]
    orthanc_study_id = existing["orthanc_study_id"]

    # Study의 Series 정보 수집
    series_list = []
    study_main_tags = study_info.get("MainDicomTags", {})

    for series_id in study_info.get("Series", []):
        try:
            series_info = orthanc_get(f"/series/{series_id}")
            series_tags = series_info.get("MainDicomTags", {})
            series_description = series_tags.get("SeriesDescription", "")

            # series_type 결정
            series_type = "OTHER"
            for key, value in SERIES_TYPE_MAP.items():
                if key.lower() in series_description.lower():
                    series_type = value
                    break

            series_list.append({
                "orthanc_id": series_id,
                "series_uid": series_tags.get("SeriesInstanceUID", ""),
                "series_type": series_type,
                "description": series_description,
                "instances_count": len(series_info.get("Instances", []))
            })
        except Exception as e:
            print(f"    [WARNING] Series 정보 조회 실패: {e}")

    return {
        "patient_id": patient_number,
        "orthanc_study_id": orthanc_study_id,
        "study_id": study_main_tags.get("StudyID", ""),
        "study_uid": study_main_tags.get("StudyInstanceUID", ""),
        "uploaded_at": study_main_tags.get("StudyDate", "") + "T" + study_main_tags.get("StudyTime", "")[:6] + ".000Z",
        "series": series_list
    }


# ============================================================
# DICOM 업로드
# ============================================================

def upload_patient_mri(patient_folder_name, patient_number, ocs_id, dry_run=False):
    """
    환자 MRI 폴더를 Orthanc에 업로드

    Args:
        patient_folder_name: TCGA-CS-4944
        patient_number: P202600001
        ocs_id: ocs_0001
        dry_run: True면 실제 업로드 안 함

    Returns:
        orthanc_info dict 또는 None
    """
    import pydicom
    from pydicom.uid import generate_uid

    mri_path = PATIENT_DATA_PATH / patient_folder_name / "mri"

    if not mri_path.exists():
        print(f"  [ERROR] MRI 폴더 없음: {mri_path}")
        return None

    # 시리즈 폴더 확인
    series_folders = [f for f in mri_path.iterdir() if f.is_dir()]
    if not series_folders:
        print(f"  [ERROR] 시리즈 폴더 없음: {mri_path}")
        return None

    # StudyInstanceUID 생성 (DICOM UI VR 규격: 숫자와 점만)
    timestamp = datetime.now().strftime("%Y%m%d%H%M%S")
    # ocs_id에서 숫자만 추출
    ocs_num = ''.join(filter(str.isdigit, ocs_id))
    patient_num = ''.join(filter(str.isdigit, patient_number))
    study_uid = f"1.2.410.200001.{ocs_num}.{patient_num}.{timestamp}"
    study_id = uuid.uuid4().hex[:16]  # SH VR 최대 16자

    now = datetime.now()
    study_date = now.strftime("%Y%m%d")
    study_time = now.strftime("%H%M%S")

    print(f"  StudyUID: {study_uid}")
    print(f"  시리즈: {[f.name for f in series_folders]}")

    if dry_run:
        print(f"  [DRY-RUN] 업로드 스킵")
        return {
            "patient_id": patient_number,
            "orthanc_study_id": "dry-run-study-id",
            "study_id": study_id,
            "study_uid": study_uid,
            "uploaded_at": timezone.now().isoformat() + "Z",
            "series": [
                {
                    "orthanc_id": f"dry-run-{folder.name}",
                    "series_uid": f"1.2.3.{i}",
                    "series_type": SERIES_TYPE_MAP.get(folder.name, "OTHER"),
                    "description": folder.name,
                    "instances_count": len(list(folder.glob("*.dcm")))
                }
                for i, folder in enumerate(series_folders, 1)
            ]
        }

    # 실제 업로드
    uploaded_series = {}  # series_name -> orthanc_series_id
    series_uid_map = {}   # series_name -> series_uid
    series_num = 1

    for series_folder in sorted(series_folders):
        series_name = series_folder.name
        series_uid = generate_uid()
        series_uid_map[series_name] = series_uid

        dcm_files = sorted(series_folder.glob("*.dcm"))
        print(f"    {series_name}: {len(dcm_files)} files", end="")

        for dcm_file in dcm_files:
            try:
                ds = pydicom.dcmread(str(dcm_file), force=True)

                # DICOM 태그 수정
                ds.PatientID = patient_number
                ds.PatientName = patient_number
                ds.StudyInstanceUID = study_uid
                ds.StudyID = study_id
                ds.StudyDescription = f"Brain MRI - {ocs_id}"
                ds.StudyDate = study_date
                ds.StudyTime = study_time
                ds.SeriesInstanceUID = series_uid
                ds.SeriesNumber = series_num
                ds.SeriesDescription = series_name

                # 메모리에 저장
                import io
                bio = io.BytesIO()
                ds.save_as(bio)
                bio.seek(0)

                # 업로드
                result = orthanc_post_dicom(bio.getvalue())

                if result.get("ParentSeries"):
                    uploaded_series[series_name] = result["ParentSeries"]

            except Exception as e:
                print(f"\n    [ERROR] {dcm_file.name}: {e}")

        series_num += 1
        print(" [OK]")

    # Orthanc Study ID 조회
    orthanc_study_id = None
    if uploaded_series:
        first_series_id = list(uploaded_series.values())[0]
        try:
            series_info = orthanc_get(f"/series/{first_series_id}")
            orthanc_study_id = series_info.get("ParentStudy")
        except Exception as e:
            print(f"  [WARNING] Study ID 조회 실패: {e}")

    # 결과 구성
    series_list = []
    for series_name, orthanc_series_id in uploaded_series.items():
        try:
            series_info = orthanc_get(f"/series/{orthanc_series_id}")
            instances_count = len(series_info.get("Instances", []))
        except:
            instances_count = 0

        series_list.append({
            "orthanc_id": orthanc_series_id,
            "series_uid": series_uid_map.get(series_name, ""),
            "series_type": SERIES_TYPE_MAP.get(series_name, "OTHER"),
            "description": series_name,
            "instances_count": instances_count
        })

    return {
        "patient_id": patient_number,
        "orthanc_study_id": orthanc_study_id,
        "study_id": study_id,
        "study_uid": study_uid,
        "uploaded_at": timezone.now().isoformat() + "Z",
        "series": series_list
    }


# ============================================================
# OCS 업데이트
# ============================================================

def update_ocs_worker_result(ocs, orthanc_info, is_confirmed=True, dry_run=False):
    """
    OCS worker_result 업데이트 (v1.2 포맷)

    Args:
        ocs: OCS 모델 인스턴스
        orthanc_info: Orthanc 업로드 결과 (study_id, orthanc_study_id, series 등)
        is_confirmed: CONFIRMED 상태로 설정할지 여부
        dry_run: True면 실제 업데이트 안 함

    worker_result v1.2 구조:
    {
        "_template": "RIS",
        "_version": "1.2",
        "_confirmed": true,
        "orthanc": {
            "study_id": "...",
            "orthanc_study_id": "...",
            "series": [...]
        },
        "dicom": {
            "study_uid": "...",
            ...
        },
        ...
    }
    """
    timestamp = timezone.now().isoformat() + "Z"

    # 전체 instances 수 계산
    total_instances = sum(s.get("instances_count", 0) for s in orthanc_info.get("series", []))

    # orthanc 정보 구성 (v1.2 포맷)
    orthanc_data = {
        "study_id": orthanc_info.get("study_id", ""),
        "orthanc_study_id": orthanc_info.get("orthanc_study_id", ""),
        "series": orthanc_info.get("series", [])
    }

    # dicom 정보 구성 (study_uid는 orthanc의 series[0].series_uid와 별도로 study_uid 사용)
    dicom_data = {
        "study_uid": orthanc_info.get("study_uid", ""),
        "series_count": len(orthanc_info.get("series", [])),
        "instance_count": total_instances
    }

    worker_result = {
        "_template": "RIS",
        "_version": "1.2",
        "_confirmed": is_confirmed,
        "_verifiedAt": timestamp if is_confirmed else None,
        "_verifiedBy": "시스템관리자" if is_confirmed else None,

        "orthanc": orthanc_data,
        "dicom": dicom_data,

        "findings": "뇌 MRI 검사 결과, 종양 소견이 관찰됩니다." if is_confirmed else "",
        "impression": "뇌종양 의심, 추가 검사 필요" if is_confirmed else "",
        "recommendation": "신경외과 협진 권고" if is_confirmed else "",

        "tumorDetected": True if is_confirmed else None,
        "imageResults": [],
        "files": [],
        "_custom": {}
    }

    if dry_run:
        print(f"    [DRY-RUN] worker_result 업데이트 스킵")
        return

    # 실제 업데이트
    ocs.worker_result = worker_result

    if is_confirmed:
        ocs.ocs_status = OCS.OcsStatus.CONFIRMED
        ocs.confirmed_at = timezone.now()
        ocs.ocs_result = True
    else:
        # 싱크 안된 OCS는 ORDERED 상태로
        ocs.ocs_status = OCS.OcsStatus.ORDERED
        ocs.accepted_at = None

    ocs.save()


# ============================================================
# 메인 로직
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='Orthanc DICOM 업로드 및 OCS 동기화')
    parser.add_argument('--dry-run', action='store_true', help='테스트 모드 (실제 업로드/업데이트 안 함)')
    parser.add_argument('--skip-upload', action='store_true', help='Orthanc 업로드 스킵 (OCS만 업데이트)')
    parser.add_argument('--limit', type=int, default=0, help='처리할 환자 수 제한 (0=전체)')
    parser.add_argument('--external-only', action='store_true', help='외부 환자만 처리')
    args = parser.parse_args()

    print("=" * 60)
    print("Orthanc DICOM 업로드 및 OCS 동기화")
    print("=" * 60)

    if args.dry_run:
        print("[MODE] DRY-RUN - 실제 변경 없음")

    # 1. 환자 목록 조회
    print("\n[1단계] 환자 목록 조회...")
    patients = list(Patient.objects.filter(is_deleted=False).order_by('patient_number'))
    print(f"  DB 환자: {len(patients)}명")

    if len(patients) < 15:
        print(f"  [WARNING] 환자가 15명 미만입니다.")

    # 2. OCS RIS 목록 조회
    print("\n[2단계] OCS RIS 목록 조회...")
    ocs_ris_list = list(OCS.objects.filter(job_role='RIS', job_type='MRI', is_deleted=False).order_by('id'))
    print(f"  OCS RIS: {len(ocs_ris_list)}건")

    # 3. 환자 폴더와 매핑
    print("\n[3단계] 환자-폴더 매핑...")

    mappings = []

    # 3-1. 내부 환자 매핑 (TCGA 폴더 -> P202600001~P202600015)
    if not args.external_only:
        print("  [내부 환자]")
        limit = args.limit if args.limit > 0 else len(PATIENT_FOLDERS)

        for i in range(min(limit, len(PATIENT_FOLDERS))):
            folder_name = PATIENT_FOLDERS[i]
            patient_number = f"P20260000{i+1}" if i < 9 else f"P2026000{i+1}"

            # 해당 환자번호의 환자 찾기
            patient = next((p for p in patients if p.patient_number == patient_number), None)

            # 해당 환자의 OCS 찾기
            ocs = next((o for o in ocs_ris_list if o.patient and o.patient.patient_number == patient_number), None)

            if patient:
                mappings.append({
                    "folder": folder_name,
                    "patient": patient,
                    "patient_number": patient_number,
                    "ocs": ocs,
                    "ocs_id": ocs.ocs_id if ocs else None,
                    "is_external": False,
                })
            else:
                print(f"    [WARNING] 환자 {patient_number} 없음, 스킵")

        print(f"    내부 환자 매핑: {len(mappings)}건")

    # 3-2. 외부 환자 매핑 (EXT 폴더 -> 외부환자)
    print("  [외부 환자]")
    external_mappings_count = 0

    # 외부 환자 조회 (is_external=True인 환자)
    external_patients = [p for p in patients if p.is_external]

    for i, folder_name in enumerate(EXTERNAL_PATIENT_FOLDERS):
        # 외부 환자 폴더가 존재하는지 확인
        folder_path = PATIENT_DATA_PATH / folder_name / "mri"
        if not folder_path.exists():
            print(f"    [WARNING] 폴더 없음: {folder_name}, 스킵")
            continue

        # 외부 환자 찾기 (순서대로 매핑)
        if i < len(external_patients):
            patient = external_patients[i]
            patient_number = patient.patient_number
        else:
            # 외부 환자가 부족하면 폴더 이름을 patient_number로 사용
            patient = None
            patient_number = folder_name

        # 해당 환자의 OCS 찾기
        ocs = None
        if patient:
            ocs = next((o for o in ocs_ris_list if o.patient and o.patient.id == patient.id), None)

        mappings.append({
            "folder": folder_name,
            "patient": patient,
            "patient_number": patient_number,
            "ocs": ocs,
            "ocs_id": ocs.ocs_id if ocs else None,
            "is_external": True,
        })
        external_mappings_count += 1

    print(f"    외부 환자 매핑: {external_mappings_count}건")
    print(f"  총 매핑: {len(mappings)}건")

    for m in mappings[:5]:
        ext_mark = "[외부]" if m.get("is_external") else "[내부]"
        print(f"    {ext_mark} {m['folder']} -> {m['patient_number']} -> {m['ocs_id']}")
    if len(mappings) > 5:
        print(f"    ... 외 {len(mappings) - 5}건")

    # 4. Orthanc 업로드 (기존 데이터 확인 후 스킵)
    print("\n[4단계] Orthanc 업로드 (중복 확인)...")

    upload_results = []
    skipped_count = 0
    uploaded_count = 0

    # 내부 환자별 Orthanc 정보 캐시 (폴더명 -> orthanc_info)
    folder_orthanc_cache = {}

    for i, mapping in enumerate(mappings):
        folder = mapping["folder"]
        patient_number = mapping["patient_number"]
        ocs = mapping["ocs"]
        ocs_id = mapping["ocs_id"] or f"ocs_new_{i+1:04d}"

        print(f"\n[{i+1}/{len(mappings)}] {folder} -> {patient_number}")

        # 1) OCS가 이미 CONFIRMED이고 worker_result에 orthanc 정보가 있으면 스킵
        if ocs and ocs.ocs_status == OCS.OcsStatus.CONFIRMED:
            existing_worker_result = ocs.worker_result or {}
            if existing_worker_result.get("orthanc", {}).get("orthanc_study_id"):
                print(f"  [SKIP] OCS 이미 CONFIRMED (orthanc_study_id 존재)")
                # 기존 worker_result의 orthanc 정보 사용
                orthanc_info = {
                    "patient_id": patient_number,
                    "orthanc_study_id": existing_worker_result["orthanc"]["orthanc_study_id"],
                    "study_id": existing_worker_result["orthanc"].get("study_id", ""),
                    "study_uid": existing_worker_result.get("dicom", {}).get("study_uid", ""),
                    "uploaded_at": existing_worker_result.get("_verifiedAt", ""),
                    "series": existing_worker_result["orthanc"].get("series", [])
                }
                upload_results.append({
                    "mapping": mapping,
                    "orthanc_info": orthanc_info,
                    "skipped": True
                })
                folder_orthanc_cache[folder] = orthanc_info
                skipped_count += 1
                continue

        # 2) Orthanc에 해당 환자 데이터가 이미 존재하는지 확인
        existing_orthanc = get_existing_orthanc_info(patient_number)
        if existing_orthanc:
            print(f"  [SKIP] Orthanc에 이미 존재 (Study: {existing_orthanc['orthanc_study_id'][:12]}...)")
            upload_results.append({
                "mapping": mapping,
                "orthanc_info": existing_orthanc,
                "skipped": True
            })
            folder_orthanc_cache[folder] = existing_orthanc
            skipped_count += 1
            continue

        # 3) --skip-upload 옵션
        if args.skip_upload:
            print(f"  [SKIP] 업로드 스킵 (--skip-upload)")
            orthanc_info = None
        else:
            # 4) 실제 업로드 수행
            orthanc_info = upload_patient_mri(folder, patient_number, ocs_id, dry_run=args.dry_run)
            if orthanc_info:
                uploaded_count += 1
                folder_orthanc_cache[folder] = orthanc_info

        upload_results.append({
            "mapping": mapping,
            "orthanc_info": orthanc_info,
            "skipped": False
        })

    print(f"\n  [결과] 스킵: {skipped_count}건, 업로드: {uploaded_count}건")

    # 5. OCS 업데이트
    print("\n[5단계] OCS 업데이트...")

    # Orthanc/DICOM 데이터가 있으면 CONFIRMED, 없으면 ORDERED
    confirmed_count = 0
    already_confirmed_count = 0

    for i, result in enumerate(upload_results):
        mapping = result["mapping"]
        orthanc_info = result["orthanc_info"]
        ocs = mapping["ocs"]
        was_skipped = result.get("skipped", False)

        if not ocs:
            print(f"  [{i+1}] {mapping['patient_number']}: OCS 없음, 스킵")
            continue

        # 이미 CONFIRMED 상태였으면 카운트만 하고 스킵
        if was_skipped and ocs.ocs_status == OCS.OcsStatus.CONFIRMED:
            print(f"  [{i+1}] {ocs.ocs_id} -> 이미 CONFIRMED (스킵)")
            already_confirmed_count += 1
            continue

        # orthanc_info가 있으면 CONFIRMED, 없으면 ORDERED
        is_confirmed = orthanc_info is not None
        status = "CONFIRMED" if is_confirmed else "ORDERED"

        if is_confirmed:
            confirmed_count += 1

        print(f"  [{i+1}] {ocs.ocs_id} -> {status}")

        if orthanc_info:
            update_ocs_worker_result(ocs, orthanc_info, is_confirmed=True, dry_run=args.dry_run)
        else:
            # Orthanc 업로드 없이 ORDERED 상태로 변경 (싱크 안됨)
            if not args.dry_run:
                ocs.ocs_status = OCS.OcsStatus.ORDERED
                ocs.accepted_at = None
                ocs.save()

    print(f"\n  [결과] 신규 CONFIRMED: {confirmed_count}건, 기존 CONFIRMED: {already_confirmed_count}건")

    # 6. 나머지 OCS RIS MRI를 ORDERED로 변경 (싱크 안됨)
    print("\n[6단계] 나머지 OCS RIS MRI 상태 변경 (ORDERED)...")

    processed_ocs_ids = [m["ocs"].id for m in [r["mapping"] for r in upload_results] if m["ocs"]]

    # MRI만 대상으로 함 (CT, PET 제외)
    remaining_ocs = OCS.objects.filter(
        job_role='RIS',
        job_type='MRI',
        is_deleted=False
    ).exclude(
        id__in=processed_ocs_ids
    ).exclude(
        ocs_status__in=[OCS.OcsStatus.CONFIRMED, OCS.OcsStatus.CANCELLED]
    )

    remaining_count = remaining_ocs.count()
    print(f"  대상: {remaining_count}건 (MRI only)")

    if not args.dry_run and remaining_count > 0:
        updated = remaining_ocs.update(
            ocs_status=OCS.OcsStatus.ORDERED,
            accepted_at=None
        )
        print(f"  업데이트 완료: {updated}건")
    elif args.dry_run:
        print(f"  [DRY-RUN] 업데이트 스킵")

    # 7. 요약
    print("\n" + "=" * 60)
    print("완료!")
    print("=" * 60)

    internal_count = len([m for m in mappings if not m.get("is_external")])
    external_count = len([m for m in mappings if m.get("is_external")])

    print(f"\n[요약]")
    print(f"  - 내부 환자 폴더: {len(PATIENT_FOLDERS)}개")
    print(f"  - 외부 환자 폴더: {len(EXTERNAL_PATIENT_FOLDERS)}개")
    print(f"  - 업로드 처리: {len(upload_results)}건 (내부: {internal_count}, 외부: {external_count})")
    print(f"  - CONFIRMED (DICOM 있음): {confirmed_count}건")
    print(f"  - 나머지 ORDERED (MRI): {remaining_count}건")

    # Orthanc 상태 확인
    try:
        studies = orthanc_get("/studies")
        print(f"  - Orthanc Studies: {len(studies)}개")
    except:
        pass

    # 최종 OCS RIS 상태
    print(f"\n[OCS RIS 최종 상태]")
    mri_total = OCS.objects.filter(job_role='RIS', job_type='MRI', is_deleted=False).count()
    mri_confirmed = OCS.objects.filter(job_role='RIS', job_type='MRI', ocs_status='CONFIRMED', is_deleted=False).count()
    mri_ordered = OCS.objects.filter(job_role='RIS', job_type='MRI', ocs_status='ORDERED', is_deleted=False).count()

    # 외부 환자 OCS 상태
    ext_ocs_total = OCS.objects.filter(ocs_id__startswith='ext_ocs_', is_deleted=False).count()
    ext_ocs_confirmed = OCS.objects.filter(ocs_id__startswith='ext_ocs_', ocs_status='CONFIRMED', is_deleted=False).count()

    print(f"  - MRI 전체: {mri_total}건 (CONFIRMED: {mri_confirmed}, ORDERED: {mri_ordered})")
    print(f"  - 외부 환자 OCS (ext_ocs_*): {ext_ocs_total}건 (CONFIRMED: {ext_ocs_confirmed})")


if __name__ == "__main__":
    main()
