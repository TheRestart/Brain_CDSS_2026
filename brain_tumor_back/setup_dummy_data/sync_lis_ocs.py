#!/usr/bin/env python
"""
LIS OCS 동기화 스크립트

이 스크립트는:
1. 환자데이터 폴더의 RNA/Protein 데이터를 CDSS_STORAGE/LIS에 복사
2. OCS LIS 레코드의 worker_result를 업데이트
3. 파일이 있는 OCS → CONFIRMED, 없으면 → ACCEPTED

파일 저장 규칙:
- RNA_SEQ: 환자데이터/{patient}/rna/gene_expression.csv → CDSS_STORAGE/LIS/{ocs_id}/gene_expression.csv
- BIOMARKER: 환자데이터/{patient}/protein/rppa.csv → CDSS_STORAGE/LIS/{ocs_id}/rppa.csv

사용법:
    python setup_dummy_data/sync_lis_ocs.py
    python setup_dummy_data/sync_lis_ocs.py --dry-run  # 테스트 모드
"""

import os
import sys
import json
import shutil
import argparse
from pathlib import Path
from datetime import datetime

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

PATIENT_DATA_PATH = settings.PATIENT_DATA_ROOT
CDSS_STORAGE_PATH = settings.CDSS_LIS_STORAGE



# 내부 환자 폴더 목록 (순서대로 15개 - sync_orthanc_ocs.py와 동일)
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

# 외부 환자 폴더 목록 (6개 - setup_external_patients.py 참조)
EXTERNAL_PATIENT_FOLDERS = [
    "EXT-0001",
    "EXT-0002",
    "EXT-0003",
    "EXT-0004",
    "EXT-0005",
    "EXT-0006",
]

# 파일 매핑
FILE_MAPPING = {
    'RNA_SEQ': {
        'source_folder': 'rna',
        'source_file': 'gene_expression.csv',
        'summary_file': 'rna_summary.json',
    },
    'BIOMARKER': {
        'source_folder': 'protein',
        'source_file': 'rppa.csv',
        'summary_file': 'protein_summary.json',
    },
}


def reset_cdss_storage_lis():
    """
    CDSS_STORAGE/LIS 폴더의 모든 데이터 삭제

    Returns:
        삭제된 폴더 수
    """
    try:
        if not CDSS_STORAGE_PATH.exists():
            print("  CDSS_STORAGE/LIS 폴더가 없습니다.")
            return 0

        # 하위 폴더 목록 조회
        folders = list(CDSS_STORAGE_PATH.iterdir())
        if not folders:
            print("  CDSS_STORAGE/LIS에 데이터가 없습니다.")
            return 0

        print(f"  CDSS_STORAGE/LIS에 {len(folders)}개의 폴더가 있습니다. 삭제 중...")

        deleted_count = 0
        for folder in folders:
            try:
                if folder.is_dir():
                    shutil.rmtree(folder)
                else:
                    folder.unlink()
                deleted_count += 1
            except Exception as e:
                print(f"    [WARNING] {folder.name} 삭제 실패: {e}")

        print(f"  [OK] {deleted_count}개 삭제 완료")
        return deleted_count

    except Exception as e:
        print(f"  [ERROR] CDSS_STORAGE/LIS 리셋 실패: {e}")
        return 0


# ============================================================
# 파일 복사 및 OCS 업데이트
# ============================================================

def copy_lis_file(patient_folder, ocs_id, job_type, dry_run=False):
    """
    환자데이터에서 CDSS_STORAGE로 파일 복사

    Args:
        patient_folder: TCGA-CS-4944
        ocs_id: ocs_0001
        job_type: RNA_SEQ 또는 BIOMARKER
        dry_run: True면 실제 복사 안 함

    Returns:
        복사된 파일 정보 dict 또는 None
    """
    if job_type not in FILE_MAPPING:
        print(f"  [ERROR] 지원하지 않는 job_type: {job_type}")
        return None

    config = FILE_MAPPING[job_type]
    source_folder = PATIENT_DATA_PATH / patient_folder / config['source_folder']
    source_file = source_folder / config['source_file']
    summary_file = source_folder / config['summary_file']

    if not source_file.exists():
        print(f"  [ERROR] 소스 파일 없음: {source_file}")
        return None

    # 대상 폴더 생성
    dest_folder = CDSS_STORAGE_PATH / ocs_id
    dest_file = dest_folder / config['source_file']

    if dry_run:
        print(f"  [DRY-RUN] {source_file} -> {dest_file}")
        return {
            'source': str(source_file),
            'dest': str(dest_file),
            'size': source_file.stat().st_size,
            'copied_at': timezone.now().isoformat() + "Z",
            'storage_path': f"CDSS_STORAGE/LIS/{ocs_id}/{config['source_file']}",
        }

    # 실제 복사
    try:
        dest_folder.mkdir(parents=True, exist_ok=True)
        shutil.copy2(source_file, dest_file)

        # summary 파일도 복사 (있으면)
        if summary_file.exists():
            shutil.copy2(summary_file, dest_folder / config['summary_file'])

        print(f"  [OK] {config['source_file']} 복사 완료")

        return {
            'source': str(source_file),
            'dest': str(dest_file),
            'size': dest_file.stat().st_size,
            'copied_at': timezone.now().isoformat() + "Z",
            'storage_path': f"CDSS_STORAGE/LIS/{ocs_id}/{config['source_file']}",
        }

    except Exception as e:
        print(f"  [ERROR] 파일 복사 실패: {e}")
        return None


def generate_rna_seq_result(file_info, patient_folder, is_confirmed=True):
    """RNA_SEQ worker_result 생성"""
    timestamp = timezone.now().isoformat() + "Z"

    # 실제 gene_expression.csv 파싱하여 상위 유전자 추출
    genes_data = []
    try:
        csv_path = Path(file_info['dest'])
        if csv_path.exists():
            import csv
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)
                # 발현량 기준 상위 10개
                sorted_rows = sorted(rows, key=lambda x: float(x.get('Expression', 0)), reverse=True)[:10]
                for row in sorted_rows:
                    genes_data.append({
                        'gene_symbol': row.get('Hugo_Symbol', ''),
                        'entrez_id': row.get('Entrez_Gene_Id', ''),
                        'expression': float(row.get('Expression', 0)),
                    })
    except Exception as e:
        print(f"    [WARNING] gene_expression 파싱 실패: {e}")

    return {
        "_template": "LIS",
        "_version": "1.2",
        "_confirmed": is_confirmed,
        "_verifiedAt": timestamp if is_confirmed else None,
        "_verifiedBy": "시스템관리자" if is_confirmed else None,

        "test_type": "RNA_SEQ",

        # RNA-seq 결과
        "RNA_seq": file_info['storage_path'] if file_info else None,
        "gene_expression": {
            "file_path": file_info['storage_path'] if file_info else None,
            "file_size": file_info['size'] if file_info else 0,
            "uploaded_at": file_info['copied_at'] if file_info else None,
            "top_expressed_genes": genes_data,
            "total_genes": len(genes_data),
        },

        # 분석 결과
        "sequencing_data": {
            "method": "RNA-Seq (Illumina HiSeq)",
            "coverage": 95.5,
            "quality_score": 38.2,
            "raw_data_path": f"환자데이터/{patient_folder}/rna/",
        },

        "summary": "RNA 시퀀싱 분석 완료. 유전자 발현 프로파일 확인됨.",
        "interpretation": "뇌종양 관련 유전자 발현 패턴 분석 결과",

        "test_results": [],
        "gene_mutations": [],
        "_custom": {}
    }


def generate_biomarker_result(file_info, patient_folder, is_confirmed=True):
    """BIOMARKER worker_result 생성"""
    timestamp = timezone.now().isoformat() + "Z"

    # 실제 rppa.csv 파싱하여 단백질 마커 추출
    protein_markers = []
    try:
        csv_path = Path(file_info['dest'])
        if csv_path.exists():
            import csv
            with open(csv_path, 'r', encoding='utf-8') as f:
                reader = csv.DictReader(f)
                rows = list(reader)[:20]  # 상위 20개
                for row in rows:
                    protein_name = row.get('Protein_Name', '')
                    expression = float(row.get('Expression', 0))
                    # 이름에서 약어 추출 (예: YWHAB|14-3-3_beta -> 14-3-3_beta)
                    display_name = protein_name.split('|')[-1] if '|' in protein_name else protein_name
                    protein_markers.append({
                        'marker_name': display_name,
                        'full_name': protein_name,
                        'value': str(round(expression, 4)),
                        'unit': 'AU',
                        'reference_range': '-1.0 ~ 1.0',
                        'is_abnormal': abs(expression) > 0.5,
                        'interpretation': '과발현' if expression > 0.5 else ('저발현' if expression < -0.5 else '정상'),
                    })
    except Exception as e:
        print(f"    [WARNING] rppa.csv 파싱 실패: {e}")

    return {
        "_template": "LIS",
        "_version": "1.2",
        "_confirmed": is_confirmed,
        "_verifiedAt": timestamp if is_confirmed else None,
        "_verifiedBy": "시스템관리자" if is_confirmed else None,

        "test_type": "PROTEIN",

        # Protein 결과
        "protein": file_info['storage_path'] if file_info else None,
        "protein_markers": protein_markers,
        "protein_data": {
            "file_path": file_info['storage_path'] if file_info else None,
            "file_size": file_info['size'] if file_info else 0,
            "uploaded_at": file_info['copied_at'] if file_info else None,
            "method": "RPPA (Reverse Phase Protein Array)",
            "total_markers": len(protein_markers),
        },

        "summary": "단백질 발현 분석 완료. RPPA 데이터 확인됨.",
        "interpretation": "뇌종양 관련 단백질 마커 분석 결과",

        "test_results": [],
        "_custom": {}
    }


def update_ocs_worker_result(ocs, worker_result, is_confirmed=True, dry_run=False):
    """OCS worker_result 업데이트"""
    if dry_run:
        print(f"    [DRY-RUN] worker_result 업데이트 스킵")
        return

    ocs.worker_result = worker_result

    if is_confirmed:
        ocs.ocs_status = OCS.OcsStatus.CONFIRMED
        ocs.confirmed_at = timezone.now()
        ocs.ocs_result = True
    else:
        ocs.ocs_status = OCS.OcsStatus.ACCEPTED
        ocs.accepted_at = timezone.now()

    ocs.save()


# ============================================================
# 메인 로직
# ============================================================

def main():
    parser = argparse.ArgumentParser(description='LIS OCS 동기화 (환자데이터 -> CDSS_STORAGE)')
    parser.add_argument('--dry-run', action='store_true', help='테스트 모드 (실제 복사/업데이트 안 함)')
    parser.add_argument('--limit', type=int, default=0, help='처리할 환자 수 제한 (0=전체)')
    args = parser.parse_args()

    print("=" * 60)
    print("LIS OCS 동기화 (환자데이터 -> CDSS_STORAGE)")
    print("=" * 60)

    if args.dry_run:
        print("[MODE] DRY-RUN - 실제 변경 없음")

    # 1. CDSS_STORAGE 폴더 생성
    print("\n[1단계] CDSS_STORAGE 폴더 확인...")
    if not args.dry_run:
        CDSS_STORAGE_PATH.mkdir(parents=True, exist_ok=True)
    print(f"  경로: {CDSS_STORAGE_PATH}")

    # 2. 환자 목록 조회
    print("\n[2단계] 환자 목록 조회...")
    patients = list(Patient.objects.filter(is_deleted=False).order_by('patient_number')[:15])
    print(f"  DB 환자: {len(patients)}명")

    if len(patients) < 15:
        print(f"  [ERROR] 환자가 15명 미만입니다. 더미 데이터를 먼저 생성하세요.")
        return

    # 3. OCS LIS 목록 조회 (RNA_SEQ, BIOMARKER만)
    print("\n[3단계] OCS LIS 목록 조회...")
    ocs_rna_seq = list(OCS.objects.filter(
        job_role='LIS',
        job_type='RNA_SEQ',
        is_deleted=False
    ).order_by('id'))
    ocs_biomarker = list(OCS.objects.filter(
        job_role='LIS',
        job_type='BIOMARKER',
        is_deleted=False
    ).order_by('id'))

    print(f"  OCS RNA_SEQ: {len(ocs_rna_seq)}건")
    print(f"  OCS BIOMARKER: {len(ocs_biomarker)}건")

    # 4. 환자-폴더 매핑 (환자번호 기준 1:1 매칭)
    print("\n[4단계] 환자-폴더 매핑 (환자번호 기준)...")

    # 환자번호 P202600001 ~ P202600015 순서대로 매핑
    # 폴더[0] -> 환자 P202600001 -> OCS (patient=P202600001인 RNA_SEQ/BIOMARKER)
    limit = args.limit if args.limit > 0 else len(PATIENT_FOLDERS)
    mappings = []

    for i in range(min(limit, len(PATIENT_FOLDERS))):
        folder_name = PATIENT_FOLDERS[i]
        patient_number = f"P20260000{i+1}" if i < 9 else f"P2026000{i+1}"

        # 해당 환자번호의 환자 찾기
        patient = next((p for p in patients if p.patient_number == patient_number), None)

        if patient:
            mappings.append({
                'folder': folder_name,
                'patient': patient,
                'patient_number': patient_number,
            })
        else:
            print(f"  [WARNING] 환자 {patient_number} 없음, 스킵")

    print(f"  매핑 완료: {len(mappings)}건")

    for m in mappings[:5]:
        print(f"    {m['folder']} -> {m['patient_number']}")
    if len(mappings) > 5:
        print(f"    ... 외 {len(mappings) - 5}건")

    # 5. RNA_SEQ 처리 (환자번호 기준으로 OCS 찾기)
    print("\n[5단계] RNA_SEQ OCS 처리 (중복 확인)...")
    rna_confirmed_count = 0
    rna_skipped_count = 0
    processed_rna_ids = []

    for i, mapping in enumerate(mappings):
        folder = mapping['folder']
        patient_number = mapping['patient_number']
        patient = mapping['patient']

        # 해당 환자의 RNA_SEQ OCS 찾기
        ocs = next((o for o in ocs_rna_seq if o.patient and o.patient.patient_number == patient_number), None)

        if not ocs:
            print(f"\n[RNA_SEQ {i+1}/{len(mappings)}] {patient_number} <- {folder} - OCS 없음, 스킵")
            continue

        processed_rna_ids.append(ocs.id)

        # 이미 CONFIRMED이고 worker_result에 파일 정보가 있으면 스킵
        if ocs.ocs_status == OCS.OcsStatus.CONFIRMED:
            existing_result = ocs.worker_result or {}
            if existing_result.get("RNA_seq") or existing_result.get("gene_expression", {}).get("file_path"):
                print(f"\n[RNA_SEQ {i+1}/{len(mappings)}] {ocs.ocs_id} ({patient_number}) - 이미 CONFIRMED (스킵)")
                rna_skipped_count += 1
                continue

        print(f"\n[RNA_SEQ {i+1}/{len(mappings)}] {ocs.ocs_id} ({patient_number}) <- {folder}")

        # 파일 복사
        file_info = copy_lis_file(folder, ocs.ocs_id, 'RNA_SEQ', dry_run=args.dry_run)

        if file_info:
            # worker_result 생성 및 업데이트
            worker_result = generate_rna_seq_result(file_info, folder, is_confirmed=True)
            update_ocs_worker_result(ocs, worker_result, is_confirmed=True, dry_run=args.dry_run)
            rna_confirmed_count += 1
            print(f"    -> CONFIRMED")
        else:
            # 파일 없으면 ORDERED (싱크 안됨)
            if not args.dry_run:
                ocs.ocs_status = OCS.OcsStatus.ORDERED
                ocs.accepted_at = None
                ocs.save()
            print(f"    -> ORDERED (파일 없음)")

    print(f"\n  [RNA_SEQ 결과] 신규: {rna_confirmed_count}건, 스킵: {rna_skipped_count}건")

    # 6. BIOMARKER 처리 (환자번호 기준으로 OCS 찾기)
    print("\n[6단계] BIOMARKER OCS 처리 (중복 확인)...")
    biomarker_confirmed_count = 0
    biomarker_skipped_count = 0
    processed_biomarker_ids = []

    for i, mapping in enumerate(mappings):
        folder = mapping['folder']
        patient_number = mapping['patient_number']
        patient = mapping['patient']

        # 해당 환자의 BIOMARKER OCS 찾기
        ocs = next((o for o in ocs_biomarker if o.patient and o.patient.patient_number == patient_number), None)

        if not ocs:
            print(f"\n[BIOMARKER {i+1}/{len(mappings)}] {patient_number} <- {folder} - OCS 없음, 스킵")
            continue

        processed_biomarker_ids.append(ocs.id)

        # 이미 CONFIRMED이고 worker_result에 파일 정보가 있으면 스킵
        if ocs.ocs_status == OCS.OcsStatus.CONFIRMED:
            existing_result = ocs.worker_result or {}
            if existing_result.get("protein") or existing_result.get("protein_data", {}).get("file_path"):
                print(f"\n[BIOMARKER {i+1}/{len(mappings)}] {ocs.ocs_id} ({patient_number}) - 이미 CONFIRMED (스킵)")
                biomarker_skipped_count += 1
                continue

        print(f"\n[BIOMARKER {i+1}/{len(mappings)}] {ocs.ocs_id} ({patient_number}) <- {folder}")

        # 파일 복사
        file_info = copy_lis_file(folder, ocs.ocs_id, 'BIOMARKER', dry_run=args.dry_run)

        if file_info:
            # worker_result 생성 및 업데이트
            worker_result = generate_biomarker_result(file_info, folder, is_confirmed=True)
            update_ocs_worker_result(ocs, worker_result, is_confirmed=True, dry_run=args.dry_run)
            biomarker_confirmed_count += 1
            print(f"    -> CONFIRMED")
        else:
            # 파일 없으면 ORDERED (싱크 안됨)
            if not args.dry_run:
                ocs.ocs_status = OCS.OcsStatus.ORDERED
                ocs.accepted_at = None
                ocs.save()
            print(f"    -> ORDERED (파일 없음)")

    print(f"\n  [BIOMARKER 결과] 신규: {biomarker_confirmed_count}건, 스킵: {biomarker_skipped_count}건")

    # 6-1. 외부 환자 RNA_SEQ 처리
    print("\n[6-1단계] 외부 환자 RNA_SEQ OCS 처리...")
    ext_rna_confirmed_count = 0
    ext_rna_skipped_count = 0

    # 외부 환자 OCS (ext_ocs_*) 조회
    ext_ocs_rna_seq = list(OCS.objects.filter(
        job_role='LIS',
        job_type='RNA_SEQ',
        ocs_id__startswith='ext_ocs_',
        is_deleted=False
    ).order_by('ocs_id'))

    print(f"  외부 환자 OCS RNA_SEQ: {len(ext_ocs_rna_seq)}건")

    for i, ocs in enumerate(ext_ocs_rna_seq):
        processed_rna_ids.append(ocs.id)

        # 이미 CONFIRMED이고 worker_result에 파일 정보가 있으면 스킵
        if ocs.ocs_status == OCS.OcsStatus.CONFIRMED:
            existing_result = ocs.worker_result or {}
            if existing_result.get("RNA_seq") or existing_result.get("gene_expression", {}).get("file_path"):
                print(f"\n[외부 RNA_SEQ {i+1}/{len(ext_ocs_rna_seq)}] {ocs.ocs_id} - 이미 CONFIRMED (스킵)")
                ext_rna_skipped_count += 1
                continue

        # 외부 환자 폴더 찾기 (순서대로 매핑)
        folder_idx = i % len(EXTERNAL_PATIENT_FOLDERS)
        folder = EXTERNAL_PATIENT_FOLDERS[folder_idx]

        print(f"\n[외부 RNA_SEQ {i+1}/{len(ext_ocs_rna_seq)}] {ocs.ocs_id} <- {folder}")

        # 파일 복사
        file_info = copy_lis_file(folder, ocs.ocs_id, 'RNA_SEQ', dry_run=args.dry_run)

        if file_info:
            worker_result = generate_rna_seq_result(file_info, folder, is_confirmed=True)
            update_ocs_worker_result(ocs, worker_result, is_confirmed=True, dry_run=args.dry_run)
            ext_rna_confirmed_count += 1
            print(f"    -> CONFIRMED")
        else:
            if not args.dry_run:
                ocs.ocs_status = OCS.OcsStatus.ORDERED
                ocs.accepted_at = None
                ocs.save()
            print(f"    -> ORDERED (파일 없음)")

    print(f"\n  [외부 RNA_SEQ 결과] 신규: {ext_rna_confirmed_count}건, 스킵: {ext_rna_skipped_count}건")

    # 6-2. 외부 환자 BIOMARKER 처리
    print("\n[6-2단계] 외부 환자 BIOMARKER OCS 처리...")
    ext_biomarker_confirmed_count = 0
    ext_biomarker_skipped_count = 0

    ext_ocs_biomarker = list(OCS.objects.filter(
        job_role='LIS',
        job_type='BIOMARKER',
        ocs_id__startswith='ext_ocs_',
        is_deleted=False
    ).order_by('ocs_id'))

    print(f"  외부 환자 OCS BIOMARKER: {len(ext_ocs_biomarker)}건")

    for i, ocs in enumerate(ext_ocs_biomarker):
        processed_biomarker_ids.append(ocs.id)

        # 이미 CONFIRMED이고 worker_result에 파일 정보가 있으면 스킵
        if ocs.ocs_status == OCS.OcsStatus.CONFIRMED:
            existing_result = ocs.worker_result or {}
            if existing_result.get("protein") or existing_result.get("protein_data", {}).get("file_path"):
                print(f"\n[외부 BIOMARKER {i+1}/{len(ext_ocs_biomarker)}] {ocs.ocs_id} - 이미 CONFIRMED (스킵)")
                ext_biomarker_skipped_count += 1
                continue

        # 외부 환자 폴더 찾기 (순서대로 매핑)
        folder_idx = i % len(EXTERNAL_PATIENT_FOLDERS)
        folder = EXTERNAL_PATIENT_FOLDERS[folder_idx]

        print(f"\n[외부 BIOMARKER {i+1}/{len(ext_ocs_biomarker)}] {ocs.ocs_id} <- {folder}")

        # 파일 복사
        file_info = copy_lis_file(folder, ocs.ocs_id, 'BIOMARKER', dry_run=args.dry_run)

        if file_info:
            worker_result = generate_biomarker_result(file_info, folder, is_confirmed=True)
            update_ocs_worker_result(ocs, worker_result, is_confirmed=True, dry_run=args.dry_run)
            ext_biomarker_confirmed_count += 1
            print(f"    -> CONFIRMED")
        else:
            if not args.dry_run:
                ocs.ocs_status = OCS.OcsStatus.ORDERED
                ocs.accepted_at = None
                ocs.save()
            print(f"    -> ORDERED (파일 없음)")

    print(f"\n  [외부 BIOMARKER 결과] 신규: {ext_biomarker_confirmed_count}건, 스킵: {ext_biomarker_skipped_count}건")

    # 7. 나머지 OCS를 ORDERED로 변경 (싱크 안됨)
    print("\n[7단계] 나머지 OCS LIS 상태 변경 (ORDERED)...")

    # 처리된 OCS ID 목록 (위에서 이미 생성됨)
    remaining_ocs = OCS.objects.filter(
        job_role='LIS',
        job_type__in=['RNA_SEQ', 'BIOMARKER'],
        is_deleted=False
    ).exclude(
        id__in=processed_rna_ids + processed_biomarker_ids
    ).exclude(
        ocs_status__in=[OCS.OcsStatus.CONFIRMED, OCS.OcsStatus.CANCELLED]
    )

    remaining_count = remaining_ocs.count()
    print(f"  대상: {remaining_count}건")

    if not args.dry_run and remaining_count > 0:
        updated = remaining_ocs.update(
            ocs_status=OCS.OcsStatus.ORDERED,
            accepted_at=None
        )
        print(f"  업데이트 완료: {updated}건")
    elif args.dry_run:
        print(f"  [DRY-RUN] 업데이트 스킵")

    # 8. 요약
    print("\n" + "=" * 60)
    print("완료!")
    print("=" * 60)

    print(f"\n[요약]")
    print(f"  - 내부 환자 폴더: {len(PATIENT_FOLDERS)}개")
    print(f"  - 외부 환자 폴더: {len(EXTERNAL_PATIENT_FOLDERS)}개")
    print(f"  - 내부 RNA_SEQ CONFIRMED: {rna_confirmed_count}건")
    print(f"  - 내부 BIOMARKER CONFIRMED: {biomarker_confirmed_count}건")
    print(f"  - 외부 RNA_SEQ CONFIRMED: {ext_rna_confirmed_count}건")
    print(f"  - 외부 BIOMARKER CONFIRMED: {ext_biomarker_confirmed_count}건")
    print(f"  - 나머지 ORDERED: {remaining_count}건")

    # 최종 OCS LIS 상태
    print(f"\n[OCS LIS 최종 상태]")
    for job_type in ['RNA_SEQ', 'BIOMARKER']:
        total = OCS.objects.filter(job_role='LIS', job_type=job_type, is_deleted=False).count()
        confirmed = OCS.objects.filter(job_role='LIS', job_type=job_type, ocs_status='CONFIRMED', is_deleted=False).count()
        ordered = OCS.objects.filter(job_role='LIS', job_type=job_type, ocs_status='ORDERED', is_deleted=False).count()
        print(f"  - {job_type}: {total}건 (CONFIRMED: {confirmed}, ORDERED: {ordered})")

    # CDSS_STORAGE 상태
    if CDSS_STORAGE_PATH.exists():
        lis_folders = list(CDSS_STORAGE_PATH.iterdir())
        print(f"\n[CDSS_STORAGE/LIS]")
        print(f"  - 폴더 수: {len(lis_folders)}개")


if __name__ == "__main__":
    main()
