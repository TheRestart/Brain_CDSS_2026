#!/usr/bin/env python
"""
의약품 마스터 데이터 생성 스크립트

사용법:
    python manage.py shell -c "from setup_dummy_data.setup_medications import create_medications; create_medications()"

    또는 직접 실행:
    python setup_dummy_data/setup_medications.py
"""

import os
import sys
from pathlib import Path

# 프로젝트 루트 디렉토리로 이동
PROJECT_ROOT = Path(__file__).resolve().parent.parent
os.chdir(PROJECT_ROOT)
sys.path.insert(0, str(PROJECT_ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')

import django
django.setup()


# 뇌종양 관련 약품 목록
MEDICATIONS = [
    # 항암제
    {"name": "Temozolomide 140mg", "code": "TEM140", "dosage": "140mg", "frequency": "QD", "route": "PO", "instructions": "공복에 복용, 구역질 시 제토제 병용", "category": "CHEMOTHERAPY"},
    {"name": "Temozolomide 250mg", "code": "TEM250", "dosage": "250mg", "frequency": "QD", "route": "PO", "instructions": "공복에 복용, 혈구 수치 모니터링 필요", "category": "CHEMOTHERAPY"},
    {"name": "Bevacizumab 400mg", "code": "BEV400", "dosage": "400mg", "frequency": "QW", "route": "IV", "instructions": "10mg/kg 기준, 30분 이상 점적", "category": "CHEMOTHERAPY"},
    {"name": "Lomustine 100mg", "code": "LOM100", "dosage": "100mg", "frequency": "QOD", "route": "PO", "instructions": "6주 주기, 혈액 검사 필수", "category": "CHEMOTHERAPY"},
    # 부종/뇌압 관리
    {"name": "Dexamethasone 4mg", "code": "DEX4", "dosage": "4mg", "frequency": "TID", "route": "PO", "instructions": "식후 복용, 점진적 감량 필요", "category": "STEROID"},
    {"name": "Dexamethasone 8mg", "code": "DEX8", "dosage": "8mg", "frequency": "BID", "route": "IV", "instructions": "응급 시 사용, 점진적 경구 전환", "category": "STEROID"},
    {"name": "Mannitol 20% 100ml", "code": "MAN100", "dosage": "100ml", "frequency": "QID", "route": "IV", "instructions": "뇌압 상승 시 15분 이상 점적", "category": "DIURETIC"},
    # 항경련제
    {"name": "Levetiracetam 500mg", "code": "LEV500", "dosage": "500mg", "frequency": "BID", "route": "PO", "instructions": "식사와 무관, 갑작스런 중단 금지", "category": "ANTIEPILEPTIC"},
    {"name": "Levetiracetam 1000mg", "code": "LEV1000", "dosage": "1000mg", "frequency": "BID", "route": "PO", "instructions": "고용량, 졸음 주의", "category": "ANTIEPILEPTIC"},
    {"name": "Valproic acid 500mg", "code": "VPA500", "dosage": "500mg", "frequency": "TID", "route": "PO", "instructions": "간기능 검사 정기적 시행", "category": "ANTIEPILEPTIC"},
    {"name": "Phenytoin 100mg", "code": "PHE100", "dosage": "100mg", "frequency": "TID", "route": "PO", "instructions": "혈중 농도 모니터링 필요", "category": "ANTIEPILEPTIC"},
    # 진통제
    {"name": "Acetaminophen 500mg", "code": "ACE500", "dosage": "500mg", "frequency": "QID", "route": "PO", "instructions": "1일 4g 초과 금지", "category": "ANALGESIC"},
    {"name": "Tramadol 50mg", "code": "TRA50", "dosage": "50mg", "frequency": "TID", "route": "PO", "instructions": "졸음 유발 가능, 운전 주의", "category": "ANALGESIC"},
    {"name": "Oxycodone 10mg", "code": "OXY10", "dosage": "10mg", "frequency": "BID", "route": "PO", "instructions": "마약성 진통제, 변비 예방 필요", "category": "ANALGESIC"},
    # 구역/구토 관리
    {"name": "Ondansetron 8mg", "code": "OND8", "dosage": "8mg", "frequency": "BID", "route": "PO", "instructions": "항암 치료 30분 전 투여", "category": "ANTIEMETIC"},
    {"name": "Metoclopramide 10mg", "code": "MET10", "dosage": "10mg", "frequency": "TID", "route": "PO", "instructions": "식전 30분 복용", "category": "ANTIEMETIC"},
    # 위장 보호
    {"name": "Esomeprazole 40mg", "code": "ESO40", "dosage": "40mg", "frequency": "QD", "route": "PO", "instructions": "아침 식전 복용", "category": "OTHER"},
    {"name": "Famotidine 20mg", "code": "FAM20", "dosage": "20mg", "frequency": "BID", "route": "PO", "instructions": "스테로이드 병용 시 필수", "category": "OTHER"},
    # 기타 보조
    {"name": "Megestrol acetate 160mg", "code": "MEG160", "dosage": "160mg", "frequency": "QD", "route": "PO", "instructions": "식욕 부진 시 사용", "category": "OTHER"},
    {"name": "Methylphenidate 10mg", "code": "MPH10", "dosage": "10mg", "frequency": "BID", "route": "PO", "instructions": "피로감 개선, 오후 투여 피함", "category": "OTHER"},
]


def create_medications(force=False):
    """의약품 마스터 데이터 생성"""
    from apps.prescriptions.models import Medication

    print(f"\n{'='*60}")
    print(f"의약품 마스터 데이터 생성")
    print(f"{'='*60}")
    print(f"목표: {len(MEDICATIONS)}개")

    existing_count = Medication.objects.filter(is_active=True).count()
    if existing_count >= len(MEDICATIONS) and not force:
        print(f"[SKIP] 이미 {existing_count}개의 의약품이 존재합니다.")
        print(f"강제 재생성: create_medications(force=True)")
        return existing_count

    created_count = 0
    updated_count = 0

    for med in MEDICATIONS:
        try:
            medication, created = Medication.objects.update_or_create(
                code=med['code'],
                defaults={
                    'name': med['name'],
                    'category': med['category'],
                    'default_dosage': med['dosage'],
                    'default_route': med['route'],
                    'default_frequency': med['frequency'],
                    'default_duration_days': 7,
                    'unit': '정' if med['route'] == 'PO' else 'ml',
                    'warnings': med['instructions'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
                print(f"  [NEW] {med['code']} - {med['name']}")
            else:
                updated_count += 1
        except Exception as e:
            print(f"  [ERROR] {med['code']}: {e}")

    print(f"\n{'='*60}")
    print(f"생성 완료!")
    print(f"{'='*60}")
    print(f"  신규 생성: {created_count}개")
    print(f"  업데이트: {updated_count}개")
    print(f"  전체 의약품: {Medication.objects.filter(is_active=True).count()}개")

    return created_count + updated_count


if __name__ == '__main__':
    create_medications()
