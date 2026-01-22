#!/usr/bin/env python
"""
외부 환자 데이터 생성 스크립트

기존 TCGA 환자 데이터 구조를 참조하여 10명의 외부 환자 데이터를 생성합니다.
- EXT-0001 ~ EXT-0010
- metadata, rna, protein, mri 폴더 구조
- 기존 TCGA 환자 데이터를 참조하여 생성

사용법:
    python setup_external_patients.py
"""

import os
import sys
import json
import shutil
import random
from pathlib import Path
from datetime import datetime

# 프로젝트 루트 디렉토리
PROJECT_ROOT = Path(__file__).resolve().parent.parent.parent
PATIENT_DATA_DIR = PROJECT_ROOT / "patient_data"

# 기존 TCGA 환자 목록
TCGA_PATIENTS = [
    "TCGA-CS-4944", "TCGA-CS-6666", "TCGA-DU-5855", "TCGA-DU-5874",
    "TCGA-DU-7014", "TCGA-DU-7015", "TCGA-DU-7018", "TCGA-DU-7300",
    "TCGA-DU-A5TW", "TCGA-DU-A5TY"
]

# 외부 환자 정보 (10명)
EXTERNAL_PATIENTS = [
    {
        "patient_id": "EXT-0001",
        "name": "외부환자A",
        "sex": "Male",
        "age": 45,
        "race": "ASIAN",
        "diagnosis": "Glioblastoma",
        "grade": "G4",
        "vital_status": "0:LIVING",
        "os_months": 12.5,
        "idh_status": "Wildtype",
        "mgmt_status": "Unmethylated",
        "referring_hospital": "서울대학교병원"
    },
    {
        "patient_id": "EXT-0002",
        "name": "외부환자B",
        "sex": "Female",
        "age": 38,
        "race": "ASIAN",
        "diagnosis": "Astrocytoma",
        "grade": "G2",
        "vital_status": "0:LIVING",
        "os_months": 24.3,
        "idh_status": "Mutant",
        "mgmt_status": "Methylated",
        "referring_hospital": "연세대학교세브란스병원"
    },
    {
        "patient_id": "EXT-0003",
        "name": "외부환자C",
        "sex": "Male",
        "age": 52,
        "race": "ASIAN",
        "diagnosis": "Oligodendroglioma",
        "grade": "G3",
        "vital_status": "0:LIVING",
        "os_months": 36.8,
        "idh_status": "Mutant",
        "mgmt_status": "Methylated",
        "referring_hospital": "삼성서울병원"
    },
    {
        "patient_id": "EXT-0004",
        "name": "외부환자D",
        "sex": "Female",
        "age": 61,
        "race": "ASIAN",
        "diagnosis": "Glioblastoma",
        "grade": "G4",
        "vital_status": "1:DECEASED",
        "os_months": 8.2,
        "idh_status": "Wildtype",
        "mgmt_status": "Unmethylated",
        "referring_hospital": "서울아산병원"
    },
    {
        "patient_id": "EXT-0005",
        "name": "외부환자E",
        "sex": "Male",
        "age": 33,
        "race": "ASIAN",
        "diagnosis": "Astrocytoma",
        "grade": "G3",
        "vital_status": "0:LIVING",
        "os_months": 48.1,
        "idh_status": "Mutant",
        "mgmt_status": "Methylated",
        "referring_hospital": "고려대학교안암병원"
    },
    {
        "patient_id": "EXT-0006",
        "name": "외부환자F",
        "sex": "Female",
        "age": 47,
        "race": "ASIAN",
        "diagnosis": "Oligodendroglioma",
        "grade": "G2",
        "vital_status": "0:LIVING",
        "os_months": 60.5,
        "idh_status": "Mutant",
        "mgmt_status": "Methylated",
        "referring_hospital": "서울성모병원"
    },
    {
        "patient_id": "EXT-0007",
        "name": "외부환자G",
        "sex": "Male",
        "age": 55,
        "race": "ASIAN",
        "diagnosis": "Glioblastoma",
        "grade": "G4",
        "vital_status": "0:LIVING",
        "os_months": 6.3,
        "idh_status": "Wildtype",
        "mgmt_status": "Unmethylated",
        "referring_hospital": "분당서울대학교병원"
    },
    {
        "patient_id": "EXT-0008",
        "name": "외부환자H",
        "sex": "Female",
        "age": 29,
        "race": "ASIAN",
        "diagnosis": "Astrocytoma",
        "grade": "G2",
        "vital_status": "0:LIVING",
        "os_months": 72.4,
        "idh_status": "Mutant",
        "mgmt_status": "Methylated",
        "referring_hospital": "경북대학교병원"
    },
    {
        "patient_id": "EXT-0009",
        "name": "외부환자I",
        "sex": "Male",
        "age": 64,
        "race": "ASIAN",
        "diagnosis": "Glioblastoma",
        "grade": "G4",
        "vital_status": "1:DECEASED",
        "os_months": 10.7,
        "idh_status": "Wildtype",
        "mgmt_status": "Unmethylated",
        "referring_hospital": "전남대학교병원"
    },
    {
        "patient_id": "EXT-0010",
        "name": "외부환자J",
        "sex": "Female",
        "age": 41,
        "race": "ASIAN",
        "diagnosis": "Oligoastrocytoma",
        "grade": "G3",
        "vital_status": "0:LIVING",
        "os_months": 30.2,
        "idh_status": "Mutant",
        "mgmt_status": "Methylated",
        "referring_hospital": "부산대학교병원"
    }
]


def create_patient_folder(patient_id):
    """환자 폴더 구조 생성"""
    patient_dir = PATIENT_DATA_DIR / patient_id

    # 폴더 구조 생성
    (patient_dir / "metadata").mkdir(parents=True, exist_ok=True)
    (patient_dir / "rna").mkdir(parents=True, exist_ok=True)
    (patient_dir / "protein").mkdir(parents=True, exist_ok=True)
    (patient_dir / "mri" / "t1").mkdir(parents=True, exist_ok=True)
    (patient_dir / "mri" / "t1ce").mkdir(parents=True, exist_ok=True)
    (patient_dir / "mri" / "t2").mkdir(parents=True, exist_ok=True)
    (patient_dir / "mri" / "flair").mkdir(parents=True, exist_ok=True)
    (patient_dir / "mri" / "seg").mkdir(parents=True, exist_ok=True)

    return patient_dir


def create_patient_info(patient_dir, patient_data):
    """patient_info.json 생성"""
    patient_id = patient_data["patient_id"]

    # 나이를 일수로 변환 (대략적인 계산)
    age_days = patient_data["age"] * 365

    # MGMT methylation value 생성
    if patient_data["mgmt_status"] == "Methylated":
        mgmt_value = random.uniform(0.4, 0.8)
    else:
        mgmt_value = random.uniform(0.1, 0.3)

    # IDH mutation 정보
    if patient_data["idh_status"] == "Mutant":
        idh_gene = "IDH1"
        idh_mutation = "R132H"
    else:
        idh_gene = None
        idh_mutation = None

    patient_info = {
        "patient_id": patient_id,
        "brats_id": f"External_{patient_id}",
        "dataset": "EXTERNAL",
        "split": "external",
        "export_date": datetime.now().isoformat(),
        "referring_hospital": patient_data["referring_hospital"],
        "clinical": {
            "Patient_ID": patient_id,
            "Dataset": "EXTERNAL",
            "SEX": patient_data["sex"],
            "AGE": patient_data["age"],
            "RACE": patient_data["race"],
            "ETHNICITY": "[Not Available]",
            "HISTOLOGICAL_DIAGNOSIS": patient_data["diagnosis"],
            "OS_STATUS": patient_data["vital_status"],
            "OS_MONTHS": patient_data["os_months"],
            "DFS_STATUS": "0:DiseaseFree" if "LIVING" in patient_data["vital_status"] else "1:Recurred/Progressed",
            "DFS_MONTHS": str(patient_data["os_months"])
        },
        "labels": {
            "gender": patient_data["sex"].lower(),
            "age_at_diagnosis": float(age_days),
            "tumor_grade": patient_data["grade"],
            "vital_status": None if "LIVING" in patient_data["vital_status"] else "Dead",
            "days_to_death": None if "LIVING" in patient_data["vital_status"] else int(patient_data["os_months"] * 30),
            "days_to_last_follow_up": int(patient_data["os_months"] * 30),
            "idh_status": patient_data["idh_status"],
            "idh_gene": idh_gene,
            "idh_mutation": idh_mutation,
            "mgmt_methylation_value": mgmt_value,
            "mgmt_status": patient_data["mgmt_status"]
        },
        "data_availability": {
            "mri": True,
            "mri_files": 5,
            "rna": True,
            "protein": True,
            "mutations": True
        }
    }

    # JSON 파일 저장
    with open(patient_dir / "metadata" / "patient_info.json", "w", encoding="utf-8") as f:
        json.dump(patient_info, f, indent=2, ensure_ascii=False)

    return patient_info


def create_mutations_csv(patient_dir, patient_data):
    """mutations.csv 생성"""
    patient_id = patient_data["patient_id"]

    # 기본 mutation 데이터
    mutations = [
        f"Patient_ID,Dataset,Hugo_Symbol,Variant_Classification,Variant_Type,HGVSp_Short,Chromosome,Start_Position"
    ]

    if patient_data["idh_status"] == "Mutant":
        mutations.append(f"{patient_id},EXTERNAL,IDH1,Missense_Mutation,SNP,p.R132H,2,209113112")

    # 추가 랜덤 mutation (GBM의 경우 더 많은 mutation)
    if patient_data["diagnosis"] == "Glioblastoma":
        common_mutations = [
            ("TP53", "Missense_Mutation", "SNP", "p.R273H", "17", "7578406"),
            ("PTEN", "Nonsense_Mutation", "SNP", "p.R130*", "10", "89692905"),
            ("EGFR", "Missense_Mutation", "SNP", "p.A289V", "7", "55241707"),
            ("NF1", "Frame_Shift_Del", "DEL", "p.R1513fs", "17", "29559932"),
        ]
    else:
        common_mutations = [
            ("TP53", "Missense_Mutation", "SNP", "p.R248Q", "17", "7578212"),
            ("ATRX", "Nonsense_Mutation", "SNP", "p.R1426*", "X", "76939405"),
            ("CIC", "Frame_Shift_Del", "DEL", "p.R215fs", "19", "42791875"),
        ]

    # 랜덤하게 1-3개 추가
    selected = random.sample(common_mutations, min(random.randint(1, 3), len(common_mutations)))
    for mut in selected:
        mutations.append(f"{patient_id},EXTERNAL,{mut[0]},{mut[1]},{mut[2]},{mut[3]},{mut[4]},{mut[5]}")

    with open(patient_dir / "metadata" / "mutations.csv", "w", encoding="utf-8") as f:
        f.write("\n".join(mutations) + "\n")


def copy_rna_data(patient_dir, patient_data, source_patient):
    """RNA 데이터 복사 및 수정"""
    patient_id = patient_data["patient_id"]
    source_dir = PATIENT_DATA_DIR / source_patient / "rna"
    dest_dir = patient_dir / "rna"

    # gene_expression.csv 복사 (약간의 노이즈 추가는 하지 않고 그대로 복사)
    source_file = source_dir / "gene_expression.csv"
    if source_file.exists():
        shutil.copy(source_file, dest_dir / "gene_expression.csv")

    # rna_summary.json 생성
    rna_summary = {
        "patient_id": patient_id,
        "total_genes": 20531,
        "non_zero_genes": random.randint(16000, 18000),
        "mean_expression": random.uniform(1000, 1500),
        "std_expression": random.uniform(20000, 25000),
        "source": "EXTERNAL_RNAseq"
    }

    with open(dest_dir / "rna_summary.json", "w", encoding="utf-8") as f:
        json.dump(rna_summary, f, indent=2)


def copy_protein_data(patient_dir, patient_data, source_patient):
    """Protein 데이터 복사"""
    patient_id = patient_data["patient_id"]
    source_dir = PATIENT_DATA_DIR / source_patient / "protein"
    dest_dir = patient_dir / "protein"

    # rppa.csv 복사
    source_file = source_dir / "rppa.csv"
    if source_file.exists():
        shutil.copy(source_file, dest_dir / "rppa.csv")

    # protein_summary.json 생성
    protein_summary = {
        "patient_id": patient_id,
        "total_proteins": 189,
        "source": "EXTERNAL_RPPA"
    }

    with open(dest_dir / "protein_summary.json", "w", encoding="utf-8") as f:
        json.dump(protein_summary, f, indent=2)


def copy_mri_data(patient_dir, source_patient):
    """MRI DICOM 데이터 복사"""
    source_dir = PATIENT_DATA_DIR / source_patient / "mri"
    dest_dir = patient_dir / "mri"

    # 각 MRI 시퀀스 폴더 복사
    for seq in ["t1", "t1ce", "t2", "flair", "seg"]:
        source_seq_dir = source_dir / seq
        dest_seq_dir = dest_dir / seq

        if source_seq_dir.exists():
            # DICOM 파일 복사
            for dcm_file in source_seq_dir.glob("*.dcm"):
                shutil.copy(dcm_file, dest_seq_dir / dcm_file.name)


def reset_external_patients():
    """기존 외부 환자 데이터 삭제"""
    print("\n기존 외부 환자 데이터 삭제 중...")
    deleted_count = 0

    for patient_data in EXTERNAL_PATIENTS:
        patient_id = patient_data["patient_id"]
        patient_dir = PATIENT_DATA_DIR / patient_id

        if patient_dir.exists():
            shutil.rmtree(patient_dir)
            print(f"  - {patient_id} 삭제됨")
            deleted_count += 1

    if deleted_count > 0:
        print(f"  총 {deleted_count}개 폴더 삭제 완료")
    else:
        print("  삭제할 폴더 없음")

    return deleted_count


def main():
    print("=" * 60)
    print("외부 환자 데이터 생성 스크립트")
    print("=" * 60)

    print(f"\n대상 폴더: {PATIENT_DATA_DIR}")
    print(f"생성할 환자 수: {len(EXTERNAL_PATIENTS)}명")
    print(f"참조 TCGA 환자: {len(TCGA_PATIENTS)}명")

    # 기존 외부 환자 데이터 리셋
    reset_external_patients()

    created_count = 0

    for i, patient_data in enumerate(EXTERNAL_PATIENTS):
        patient_id = patient_data["patient_id"]
        patient_dir = PATIENT_DATA_DIR / patient_id

        print(f"  [{i+1:2d}/10] {patient_id} 생성 중...")

        # 참조할 TCGA 환자 선택 (순환)
        source_patient = TCGA_PATIENTS[i % len(TCGA_PATIENTS)]

        try:
            # 1. 폴더 구조 생성
            create_patient_folder(patient_id)

            # 2. metadata 생성
            create_patient_info(patient_dir, patient_data)
            create_mutations_csv(patient_dir, patient_data)

            # 3. RNA 데이터 복사
            copy_rna_data(patient_dir, patient_data, source_patient)

            # 4. Protein 데이터 복사
            copy_protein_data(patient_dir, patient_data, source_patient)

            # 5. MRI 데이터 복사
            copy_mri_data(patient_dir, source_patient)

            print(f"         -> 완료 (참조: {source_patient})")
            created_count += 1

        except Exception as e:
            print(f"         -> 오류: {e}")
            # 실패 시 폴더 삭제
            if patient_dir.exists():
                shutil.rmtree(patient_dir)

    print("\n" + "=" * 60)
    print(f"완료: {created_count}명 생성")
    print("=" * 60)

    # 최종 환자 목록 출력
    print("\n현재 patient_data 폴더 내용:")
    for folder in sorted(PATIENT_DATA_DIR.iterdir()):
        if folder.is_dir():
            print(f"  - {folder.name}")


if __name__ == "__main__":
    main()
