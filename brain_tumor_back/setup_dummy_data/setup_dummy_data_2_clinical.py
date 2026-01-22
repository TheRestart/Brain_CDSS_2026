#!/usr/bin/env python
"""
Brain Tumor CDSS - 더미 데이터 설정 스크립트 (2/3) - 임상 데이터

이 스크립트는 임상 관련 더미 데이터를 생성합니다:
- 환자 50명
- 진료(Encounter) 20건
- OCS (RIS) 15건 + ImagingStudy (환자데이터 폴더 15개 기준)
- OCS (LIS) 30건 (RNA_SEQ 15건 + BIOMARKER 15건, 동일 환자)
- 환자 주의사항
- 치료 계획 15건 + 세션
- 경과 추적 25건
- 처방전 20건 + 처방 항목 ~60건

※ OCS 데이터(MRI, RNA_SEQ, BIOMARKER)는 동일 환자(P202600001~P202600015)에게 생성됨
※ AI 추론 요청은 실제 요청 시 생성되므로 더미 데이터에서 제외

사용법:
    python setup_dummy_data_2_clinical.py          # 기존 데이터 유지, 부족분만 추가
    python setup_dummy_data_2_clinical.py --reset  # 임상 데이터만 삭제 후 새로 생성
    python setup_dummy_data_2_clinical.py --force  # 목표 수량 이상이어도 강제 추가

선행 조건:
    python setup_dummy_data_1_base.py     # 기본 더미 데이터 (역할/사용자/메뉴)
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
from django.db import IntegrityError, transaction


# ============================================================
# 선행 조건 확인
# ============================================================

def check_prerequisites():
    """선행 조건 확인"""
    print("\n[0단계] 선행 조건 확인...")

    from django.contrib.auth import get_user_model
    from apps.accounts.models import Role

    User = get_user_model()

    # 역할 확인
    if not Role.objects.exists():
        print("[ERROR] 역할(Role)이 없습니다.")
        print("  먼저 실행하세요: python setup_dummy_data_1_base.py")
        return False

    # 사용자 확인
    if not User.objects.exists():
        print("[ERROR] 사용자가 없습니다.")
        print("  먼저 실행하세요: python setup_dummy_data_1_base.py")
        return False

    # DOCTOR 역할 사용자 확인
    if not User.objects.filter(role__code='DOCTOR').exists():
        print("[WARNING] DOCTOR 역할 사용자가 없습니다. 첫 번째 사용자를 사용합니다.")

    print("[OK] 선행 조건 충족")
    return True


# ============================================================
# 환자 데이터 (from 1_base.py - 7,8,9,10단계)
# ============================================================

def create_dummy_patients(target_count=50, force=False):
    """더미 환자 데이터 생성"""
    print(f"\n[1단계] 환자 데이터 생성 (목표: {target_count}명)...")

    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = Patient.objects.filter(is_deleted=False).count()
    if existing_count >= target_count and not force:
        print(f"[SKIP] 이미 {existing_count}명의 환자가 존재합니다.")
        return True

    # 등록자 (슈퍼유저 또는 첫 번째 사용자)
    registered_by = User.objects.filter(is_superuser=True).first() or User.objects.first()
    if not registered_by:
        print("[ERROR] 사용자가 없습니다.")
        return False

    # 더미 환자 데이터 (50명)
    dummy_patients = [
        {"name": "김철수", "birth_date": timezone.now().date() - timedelta(days=365*45), "gender": "M", "phone": "010-1234-5678", "ssn": "7801011234567", "blood_type": "A+", "allergies": ["페니실린"], "chronic_diseases": ["고혈압"], "address": "서울특별시 강남구 테헤란로 123"},
        {"name": "이영희", "birth_date": timezone.now().date() - timedelta(days=365*38), "gender": "F", "phone": "010-2345-6789", "ssn": "8603151234568", "blood_type": "B+", "allergies": [], "chronic_diseases": ["당뇨"], "address": "서울특별시 서초구 서초대로 456"},
        {"name": "박민수", "birth_date": timezone.now().date() - timedelta(days=365*52), "gender": "M", "phone": "010-3456-7890", "ssn": "7205201234569", "blood_type": "O+", "allergies": ["조영제"], "chronic_diseases": ["고혈압", "당뇨"], "address": "경기도 성남시 분당구 판교로 789"},
        {"name": "최지은", "birth_date": timezone.now().date() - timedelta(days=365*29), "gender": "F", "phone": "010-4567-8901", "ssn": "9506101234560", "blood_type": "AB+", "allergies": [], "chronic_diseases": [], "address": "서울특별시 송파구 올림픽로 321"},
        {"name": "정현우", "birth_date": timezone.now().date() - timedelta(days=365*61), "gender": "M", "phone": "010-5678-9012", "ssn": "6309251234561", "blood_type": "A-", "allergies": ["아스피린"], "chronic_diseases": ["고혈압", "고지혈증"], "address": "서울특별시 마포구 월드컵로 654"},
        {"name": "강미라", "birth_date": timezone.now().date() - timedelta(days=365*34), "gender": "F", "phone": "010-6789-0123", "ssn": "9002051234562", "blood_type": "B-", "allergies": [], "chronic_diseases": [], "address": "인천광역시 연수구 센트럴로 987"},
        {"name": "윤서준", "birth_date": timezone.now().date() - timedelta(days=365*47), "gender": "M", "phone": "010-7890-1234", "ssn": "7707151234563", "blood_type": "O-", "allergies": ["설파제"], "chronic_diseases": [], "address": "경기도 고양시 일산동구 중앙로 147"},
        {"name": "임수진", "birth_date": timezone.now().date() - timedelta(days=365*55), "gender": "F", "phone": "010-8901-2345", "ssn": "6912201234564", "blood_type": "AB-", "allergies": ["페니실린", "조영제"], "chronic_diseases": ["당뇨", "고혈압"], "address": "서울특별시 강동구 천호대로 258"},
        {"name": "한지우", "birth_date": timezone.now().date() - timedelta(days=365*26), "gender": "O", "phone": "010-9012-3456", "ssn": "9808301234565", "blood_type": "A+", "allergies": [], "chronic_diseases": [], "address": "서울특별시 관악구 관악로 369"},
        {"name": "오민지", "birth_date": timezone.now().date() - timedelta(days=365*42), "gender": "F", "phone": "010-0123-4567", "ssn": "8204101234566", "blood_type": "B+", "allergies": [], "chronic_diseases": ["고지혈증"], "address": "경기도 수원시 영통구 광교로 741"},
        {"name": "서동훈", "birth_date": timezone.now().date() - timedelta(days=365*58), "gender": "M", "phone": "010-1111-2222", "ssn": "6605121234567", "blood_type": "A+", "allergies": [], "chronic_diseases": ["고혈압"], "address": "부산광역시 해운대구 해운대로 100"},
        {"name": "배수연", "birth_date": timezone.now().date() - timedelta(days=365*31), "gender": "F", "phone": "010-2222-3333", "ssn": "9303152234567", "blood_type": "O+", "allergies": ["페니실린"], "chronic_diseases": [], "address": "대구광역시 수성구 수성로 200"},
        {"name": "조성민", "birth_date": timezone.now().date() - timedelta(days=365*49), "gender": "M", "phone": "010-3333-4444", "ssn": "7508203234567", "blood_type": "B+", "allergies": [], "chronic_diseases": ["당뇨", "고지혈증"], "address": "광주광역시 서구 상무대로 300"},
        {"name": "신예린", "birth_date": timezone.now().date() - timedelta(days=365*27), "gender": "F", "phone": "010-4444-5555", "ssn": "9707154234567", "blood_type": "AB+", "allergies": [], "chronic_diseases": [], "address": "대전광역시 유성구 대학로 400"},
        {"name": "권도현", "birth_date": timezone.now().date() - timedelta(days=365*65), "gender": "M", "phone": "010-5555-6666", "ssn": "5909205234567", "blood_type": "A-", "allergies": ["조영제", "아스피린"], "chronic_diseases": ["고혈압", "당뇨", "고지혈증"], "address": "울산광역시 남구 삼산로 500"},
        {"name": "황지현", "birth_date": timezone.now().date() - timedelta(days=365*36), "gender": "F", "phone": "010-6666-7777", "ssn": "8804156234567", "blood_type": "O-", "allergies": [], "chronic_diseases": [], "address": "경기도 용인시 수지구 포은대로 600"},
        {"name": "안재호", "birth_date": timezone.now().date() - timedelta(days=365*53), "gender": "M", "phone": "010-7777-8888", "ssn": "7102207234567", "blood_type": "B-", "allergies": ["설파제"], "chronic_diseases": ["고혈압"], "address": "경기도 화성시 동탄대로 700"},
        {"name": "문서아", "birth_date": timezone.now().date() - timedelta(days=365*24), "gender": "F", "phone": "010-8888-9999", "ssn": "0001158234567", "blood_type": "AB-", "allergies": [], "chronic_diseases": [], "address": "서울특별시 노원구 동일로 800"},
        {"name": "송준혁", "birth_date": timezone.now().date() - timedelta(days=365*44), "gender": "M", "phone": "010-9999-0000", "ssn": "8007209234567", "blood_type": "A+", "allergies": [], "chronic_diseases": ["당뇨"], "address": "서울특별시 영등포구 여의대로 900"},
        {"name": "류하은", "birth_date": timezone.now().date() - timedelta(days=365*33), "gender": "F", "phone": "010-1234-0000", "ssn": "9106150234568", "blood_type": "O+", "allergies": ["페니실린"], "chronic_diseases": [], "address": "경기도 성남시 중원구 성남대로 1000"},
        {"name": "장태웅", "birth_date": timezone.now().date() - timedelta(days=365*57), "gender": "M", "phone": "010-2345-0000", "ssn": "6703201234568", "blood_type": "B+", "allergies": [], "chronic_diseases": ["고혈압", "고지혈증"], "address": "인천광역시 남동구 구월로 1100"},
        {"name": "노은지", "birth_date": timezone.now().date() - timedelta(days=365*29), "gender": "F", "phone": "010-3456-0000", "ssn": "9509152234568", "blood_type": "A+", "allergies": [], "chronic_diseases": [], "address": "부산광역시 부산진구 중앙대로 1200"},
        {"name": "하승우", "birth_date": timezone.now().date() - timedelta(days=365*41), "gender": "M", "phone": "010-4567-0000", "ssn": "8310203234568", "blood_type": "O-", "allergies": ["조영제"], "chronic_diseases": ["당뇨"], "address": "대구광역시 달서구 달구벌대로 1300"},
        {"name": "전소희", "birth_date": timezone.now().date() - timedelta(days=365*38), "gender": "F", "phone": "010-5678-0000", "ssn": "8605154234568", "blood_type": "AB+", "allergies": [], "chronic_diseases": [], "address": "광주광역시 북구 용봉로 1400"},
        {"name": "곽민재", "birth_date": timezone.now().date() - timedelta(days=365*62), "gender": "M", "phone": "010-6789-0000", "ssn": "6204205234568", "blood_type": "B-", "allergies": ["아스피린"], "chronic_diseases": ["고혈압", "당뇨"], "address": "대전광역시 서구 둔산로 1500"},
        {"name": "우다인", "birth_date": timezone.now().date() - timedelta(days=365*25), "gender": "F", "phone": "010-7890-0000", "ssn": "9908156234568", "blood_type": "A-", "allergies": [], "chronic_diseases": [], "address": "울산광역시 중구 성남로 1600"},
        {"name": "남기훈", "birth_date": timezone.now().date() - timedelta(days=365*50), "gender": "M", "phone": "010-8901-0000", "ssn": "7406207234568", "blood_type": "O+", "allergies": [], "chronic_diseases": ["고지혈증"], "address": "세종특별자치시 한누리대로 1700"},
        {"name": "심유나", "birth_date": timezone.now().date() - timedelta(days=365*35), "gender": "F", "phone": "010-9012-0000", "ssn": "8902158234568", "blood_type": "B+", "allergies": ["설파제"], "chronic_diseases": [], "address": "제주특별자치도 제주시 연동로 1800"},
        {"name": "엄태식", "birth_date": timezone.now().date() - timedelta(days=365*68), "gender": "M", "phone": "010-0123-0000", "ssn": "5607209234568", "blood_type": "AB-", "allergies": ["페니실린", "아스피린"], "chronic_diseases": ["고혈압", "당뇨", "고지혈증"], "address": "강원도 춘천시 중앙로 1900"},
        {"name": "차준영", "birth_date": timezone.now().date() - timedelta(days=365*40), "gender": "M", "phone": "010-1122-3344", "ssn": "8405201234569", "blood_type": "A+", "allergies": [], "chronic_diseases": [], "address": "경상북도 포항시 북구 중앙로 2000"},
        # 확장 환자 20명
        {"name": "김태현", "birth_date": timezone.now().date() - timedelta(days=365*48), "gender": "M", "phone": "010-1001-1001", "ssn": "7601011001001", "blood_type": "A+", "allergies": [], "chronic_diseases": ["고혈압"], "address": "서울특별시 강서구 강서로 100"},
        {"name": "이수민", "birth_date": timezone.now().date() - timedelta(days=365*32), "gender": "F", "phone": "010-1001-1002", "ssn": "9203151001002", "blood_type": "B+", "allergies": ["페니실린"], "chronic_diseases": [], "address": "서울특별시 동작구 동작대로 200"},
        {"name": "박준호", "birth_date": timezone.now().date() - timedelta(days=365*56), "gender": "M", "phone": "010-1001-1003", "ssn": "6809201001003", "blood_type": "O+", "allergies": [], "chronic_diseases": ["당뇨", "고혈압"], "address": "경기도 안양시 만안구 안양로 300"},
        {"name": "최유진", "birth_date": timezone.now().date() - timedelta(days=365*28), "gender": "F", "phone": "010-1001-1004", "ssn": "9608101001004", "blood_type": "AB+", "allergies": [], "chronic_diseases": [], "address": "서울특별시 종로구 종로 400"},
        {"name": "정민석", "birth_date": timezone.now().date() - timedelta(days=365*63), "gender": "M", "phone": "010-1001-1005", "ssn": "6105251001005", "blood_type": "A-", "allergies": ["조영제"], "chronic_diseases": ["고지혈증"], "address": "경기도 부천시 원미구 길주로 500"},
        {"name": "강서연", "birth_date": timezone.now().date() - timedelta(days=365*37), "gender": "F", "phone": "010-1001-1006", "ssn": "8706051001006", "blood_type": "B-", "allergies": [], "chronic_diseases": [], "address": "인천광역시 부평구 부평대로 600"},
        {"name": "윤재원", "birth_date": timezone.now().date() - timedelta(days=365*45), "gender": "M", "phone": "010-1001-1007", "ssn": "7909151001007", "blood_type": "O-", "allergies": ["아스피린"], "chronic_diseases": ["고혈압"], "address": "경기도 파주시 교하로 700"},
        {"name": "임하영", "birth_date": timezone.now().date() - timedelta(days=365*51), "gender": "F", "phone": "010-1001-1008", "ssn": "7312201001008", "blood_type": "AB-", "allergies": [], "chronic_diseases": ["당뇨"], "address": "서울특별시 성북구 성북로 800"},
        {"name": "한민주", "birth_date": timezone.now().date() - timedelta(days=365*23), "gender": "F", "phone": "010-1001-1009", "ssn": "0102151001009", "blood_type": "A+", "allergies": [], "chronic_diseases": [], "address": "서울특별시 도봉구 도봉로 900"},
        {"name": "오승현", "birth_date": timezone.now().date() - timedelta(days=365*39), "gender": "M", "phone": "010-1001-1010", "ssn": "8508101001010", "blood_type": "B+", "allergies": ["설파제"], "chronic_diseases": [], "address": "경기도 시흥시 시흥대로 1000"},
        {"name": "서지훈", "birth_date": timezone.now().date() - timedelta(days=365*54), "gender": "M", "phone": "010-1001-1011", "ssn": "7003121001011", "blood_type": "A+", "allergies": [], "chronic_diseases": ["고혈압", "당뇨"], "address": "부산광역시 사하구 낙동대로 1100"},
        {"name": "배아린", "birth_date": timezone.now().date() - timedelta(days=365*30), "gender": "F", "phone": "010-1001-1012", "ssn": "9407151001012", "blood_type": "O+", "allergies": [], "chronic_diseases": [], "address": "대구광역시 북구 침산로 1200"},
        {"name": "조현빈", "birth_date": timezone.now().date() - timedelta(days=365*46), "gender": "M", "phone": "010-1001-1013", "ssn": "7810201001013", "blood_type": "B+", "allergies": ["페니실린", "조영제"], "chronic_diseases": ["고지혈증"], "address": "광주광역시 동구 금남로 1300"},
        {"name": "신나연", "birth_date": timezone.now().date() - timedelta(days=365*26), "gender": "F", "phone": "010-1001-1014", "ssn": "9804151001014", "blood_type": "AB+", "allergies": [], "chronic_diseases": [], "address": "대전광역시 중구 대종로 1400"},
        {"name": "권혁준", "birth_date": timezone.now().date() - timedelta(days=365*59), "gender": "M", "phone": "010-1001-1015", "ssn": "6507201001015", "blood_type": "A-", "allergies": [], "chronic_diseases": ["고혈압", "고지혈증"], "address": "울산광역시 동구 봉수로 1500"},
        {"name": "황예나", "birth_date": timezone.now().date() - timedelta(days=365*34), "gender": "F", "phone": "010-1001-1016", "ssn": "9001151001016", "blood_type": "O-", "allergies": ["아스피린"], "chronic_diseases": [], "address": "경기도 의정부시 평화로 1600"},
        {"name": "안시우", "birth_date": timezone.now().date() - timedelta(days=365*42), "gender": "M", "phone": "010-1001-1017", "ssn": "8206201001017", "blood_type": "B-", "allergies": [], "chronic_diseases": ["당뇨"], "address": "경기도 광명시 광명로 1700"},
        {"name": "문채원", "birth_date": timezone.now().date() - timedelta(days=365*22), "gender": "F", "phone": "010-1001-1018", "ssn": "0210151001018", "blood_type": "AB-", "allergies": [], "chronic_diseases": [], "address": "서울특별시 금천구 가산디지털로 1800"},
        {"name": "송민호", "birth_date": timezone.now().date() - timedelta(days=365*47), "gender": "M", "phone": "010-1001-1019", "ssn": "7705201001019", "blood_type": "A+", "allergies": ["설파제"], "chronic_diseases": ["고혈압"], "address": "서울특별시 구로구 디지털로 1900"},
        {"name": "류소연", "birth_date": timezone.now().date() - timedelta(days=365*36), "gender": "F", "phone": "010-1001-1020", "ssn": "8809151001020", "blood_type": "O+", "allergies": [], "chronic_diseases": [], "address": "경기도 김포시 김포대로 2000"},
    ]

    created_count = 0
    skipped_count = 0

    for patient_data in dummy_patients:
        try:
            # SSN 중복 확인
            if Patient.objects.filter(ssn=patient_data['ssn']).exists():
                skipped_count += 1
                continue

            # 랜덤 중증도 할당
            severity_choices = ['normal', 'normal', 'normal', 'mild', 'mild', 'moderate', 'severe', 'critical']
            severity = random.choice(severity_choices)

            patient = Patient.objects.create(
                registered_by=registered_by,
                status='active',
                severity=severity,
                **patient_data
            )
            created_count += 1
        except IntegrityError:
            skipped_count += 1
        except Exception as e:
            print(f"  오류 ({patient_data['name']}): {e}")

    print(f"[OK] 환자 생성: {created_count}명, 스킵: {skipped_count}명")
    print(f"  현재 전체 환자: {Patient.objects.filter(is_deleted=False).count()}명")
    return True


def create_dummy_encounters(target_count=20, force=False):
    """더미 진료 데이터 생성"""
    print(f"\n[2단계] 진료 데이터 생성 (목표: {target_count}건)...")

    from apps.encounters.models import Encounter
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = Encounter.objects.count()
    if existing_count >= target_count and not force:
        print(f"[SKIP] 이미 {existing_count}건의 진료가 존재합니다.")
        return True

    # 필요한 데이터
    patients = list(Patient.objects.filter(is_deleted=False, status='active'))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 활성 환자가 없습니다.")
        return False

    if not doctors:
        print("[WARNING] DOCTOR 역할 사용자가 없습니다. 첫 번째 사용자를 사용합니다.")
        doctors = list(User.objects.all()[:1])

    encounter_types = ['outpatient', 'inpatient', 'emergency']
    statuses = ['scheduled', 'in_progress', 'completed', 'cancelled']
    departments = ['neurology', 'neurosurgery']

    chief_complaints = [
        '두통이 심해요', '어지러움증이 계속됩니다', '손발 저림 증상',
        '기억력 감퇴', '수면 장애', '편두통', '목 통증',
        '시야 흐림', '균형 감각 이상', '근육 경련', '발작 증세'
    ]

    primary_diagnoses = [
        '뇌종양 의심', '편두통', '뇌졸중', '파킨슨병',
        '치매', '간질', '다발성 경화증', '신경통'
    ]

    # SOAP 노트 샘플 데이터
    subjective_samples = [
        '3일 전부터 지속되는 두통, 아침에 더 심함',
        '일주일간 어지러움 증상, 구역감 동반',
        '양손 저림 증상, 특히 야간에 심해짐',
        '최근 건망증이 심해졌다고 호소',
        '잠들기 어렵고 자주 깸, 피로감 호소',
        '우측 관자놀이 쪽 박동성 두통',
        '경추 부위 통증, 고개 돌릴 때 악화',
    ]

    objective_samples = [
        'BP 130/85, HR 72, BT 36.5',
        '신경학적 검사 정상, 경부 강직 없음',
        '동공 반사 정상, 안구 운동 정상',
        'Romberg test 양성, 보행 시 불안정',
        'MMT 정상, DTR 정상, 병적 반사 없음',
        'GCS 15, 의식 명료, 지남력 정상',
        '뇌 MRI: T2 고신호 병변 확인',
    ]

    assessment_samples = [
        '긴장성 두통 의심, R/O 편두통',
        '말초성 현훈 vs 중추성 현훈 감별 필요',
        '수근관 증후군 의심',
        '경도 인지장애 가능성, 치매 스크리닝 필요',
        '불면증, 수면 무호흡 가능성',
        '뇌종양 의심, 추가 검사 필요',
        '경추 디스크 탈출증 의심',
    ]

    plan_samples = [
        '뇌 MRI 촬영, 진통제 처방, 2주 후 재진',
        '청력검사, 전정기능검사 예정, 어지럼증 약물 처방',
        '신경전도검사 의뢰, 보존적 치료',
        '인지기능검사, 혈액검사 (갑상선, B12)',
        '수면다원검사 의뢰, 수면위생 교육',
        'MRI 추적검사, 신경외과 협진',
        '물리치료 의뢰, NSAIDs 처방',
    ]

    created_count = 0

    for i in range(target_count):
        days_ago = random.randint(0, 60)
        admission_date = timezone.now() - timedelta(days=days_ago)
        encounter_type = random.choice(encounter_types)

        if days_ago > 30:
            status = random.choice(['completed', 'cancelled'])
        elif days_ago > 7:
            status = random.choice(['in_progress', 'completed'])
        else:
            status = random.choice(statuses)

        discharge_date = None
        if status == 'completed':
            if encounter_type == 'outpatient':
                discharge_days = random.choice([0, 1])
            elif encounter_type == 'inpatient':
                discharge_days = random.randint(1, 14)
            else:
                discharge_days = random.randint(0, 7)
            discharge_date = admission_date + timedelta(days=discharge_days)
        elif status == 'cancelled' and random.choice([True, False]):
            discharge_date = admission_date

        # 완료된 진료는 SOAP 노트 작성
        soap_data = {}
        if status in ['completed', 'in_progress']:
            soap_data = {
                'subjective': random.choice(subjective_samples),
                'objective': random.choice(objective_samples),
                'assessment': random.choice(assessment_samples),
                'plan': random.choice(plan_samples),
            }

        try:
            encounter = Encounter.objects.create(
                patient=random.choice(patients),
                encounter_type=encounter_type,
                status=status,
                attending_doctor=random.choice(doctors),
                department=random.choice(departments),
                admission_date=admission_date,
                discharge_date=discharge_date,
                chief_complaint=random.choice(chief_complaints),
                primary_diagnosis=random.choice(primary_diagnoses),
                secondary_diagnoses=random.sample(['고혈압', '당뇨', '고지혈증'], random.randint(0, 2)),
                **soap_data,
            )
            created_count += 1
        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 진료 생성: {created_count}건")

    # 오늘 예약 진료 3건 생성 (금일 예약 환자 목록 테스트용)
    print("\n[2-1단계] 오늘 예약 진료 생성...")
    today_scheduled_count = Encounter.objects.filter(
        admission_date__date=timezone.now().date(),
        status='scheduled'
    ).count()

    # 예약 시간 목록
    scheduled_times = [dt_time(9, 0), dt_time(10, 30), dt_time(14, 0), dt_time(15, 30), dt_time(16, 0)]

    if today_scheduled_count < 3:
        for i in range(3 - today_scheduled_count):
            try:
                Encounter.objects.create(
                    patient=random.choice(patients),
                    attending_doctor=random.choice(doctors),
                    admission_date=timezone.now(),
                    scheduled_time=scheduled_times[i % len(scheduled_times)],
                    status='scheduled',
                    encounter_type='outpatient',
                    department=random.choice(departments),
                    chief_complaint=random.choice(['정기 진료', '추적 검사', '상담', '재진'])
                )
            except Exception as e:
                print(f"  오류: {e}")
        print(f"[OK] 오늘 예약 진료: {3 - today_scheduled_count}건 추가 생성")
    else:
        print(f"[SKIP] 오늘 예약 진료 이미 {today_scheduled_count}건 존재")

    print(f"  현재 전체 진료: {Encounter.objects.count()}건")
    return True


def ensure_all_patients_have_encounters(min_encounters_per_patient=2, force=False):
    """
    모든 환자에게 과거 진료 기록이 있도록 보장
    - 각 환자당 최소 min_encounters_per_patient건의 완료된 진료 기록 생성
    - SOAP 노트 포함
    """
    print(f"\n[2-2단계] 모든 환자에게 과거 진료 기록 보장 (최소 {min_encounters_per_patient}건/환자)...")

    from apps.encounters.models import Encounter
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    patients = list(Patient.objects.filter(is_deleted=False, status='active'))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 활성 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    encounter_types = ['outpatient', 'inpatient']
    departments = ['neurology', 'neurosurgery']

    chief_complaints = [
        '두통이 심해요', '어지러움증이 계속됩니다', '손발 저림 증상',
        '기억력 감퇴', '수면 장애', '편두통', '목 통증',
        '시야 흐림', '균형 감각 이상', '근육 경련'
    ]

    primary_diagnoses = [
        '뇌종양 의심', '편두통', '뇌졸중', '파킨슨병',
        '치매', '간질', '다발성 경화증', '신경통'
    ]

    subjective_samples = [
        '3일 전부터 지속되는 두통, 아침에 더 심함',
        '일주일간 어지러움 증상, 구역감 동반',
        '양손 저림 증상, 특히 야간에 심해짐',
        '최근 건망증이 심해졌다고 호소',
        '잠들기 어렵고 자주 깸, 피로감 호소',
        '우측 관자놀이 쪽 박동성 두통',
        '경추 부위 통증, 고개 돌릴 때 악화',
        '두달 전부터 간헐적 두통, 최근 빈도 증가',
        '양측 하지 저림, 보행 시 불편감',
        '약 복용 후 증상 호전되었으나 재발',
    ]

    objective_samples = [
        'BP 130/85, HR 72, BT 36.5',
        '신경학적 검사 정상, 경부 강직 없음',
        '동공 반사 정상, 안구 운동 정상',
        'Romberg test 양성, 보행 시 불안정',
        'MMT 정상, DTR 정상, 병적 반사 없음',
        'GCS 15, 의식 명료, 지남력 정상',
        '뇌 MRI: T2 고신호 병변 확인',
        'BP 125/80, HR 68, SpO2 98%',
        '경추 ROM 제한, 압통 있음',
        '시야검사 정상, 안저검사 정상',
    ]

    assessment_samples = [
        '긴장성 두통 의심, R/O 편두통',
        '말초성 현훈 vs 중추성 현훈 감별 필요',
        '수근관 증후군 의심',
        '경도 인지장애 가능성, 치매 스크리닝 필요',
        '불면증, 수면 무호흡 가능성',
        '뇌종양 의심, 추가 검사 필요',
        '경추 디스크 탈출증 의심',
        '긴장성 두통, 스트레스 관련',
        '말초신경병증 가능성',
        '편두통, 약물 조절 필요',
    ]

    plan_samples = [
        '뇌 MRI 촬영, 진통제 처방, 2주 후 재진',
        '청력검사, 전정기능검사 예정, 어지럼증 약물 처방',
        '신경전도검사 의뢰, 보존적 치료',
        '인지기능검사, 혈액검사 (갑상선, B12)',
        '수면다원검사 의뢰, 수면위생 교육',
        'MRI 추적검사, 신경외과 협진',
        '물리치료 의뢰, NSAIDs 처방',
        '경과 관찰, 1개월 후 재진',
        '약물 용량 조절, 부작용 모니터링',
        '추가 검사 후 치료 방침 결정',
    ]

    created_count = 0
    patients_updated = 0

    for patient in patients:
        # 해당 환자의 완료된 진료 기록 수 확인
        completed_encounters = Encounter.objects.filter(
            patient=patient,
            status='completed'
        ).count()

        needed = min_encounters_per_patient - completed_encounters
        if needed <= 0 and not force:
            continue

        patients_updated += 1
        for i in range(max(needed, 1) if force else needed):
            days_ago = random.randint(30, 180)  # 30일 ~ 6개월 전
            admission_date = timezone.now() - timedelta(days=days_ago)
            encounter_type = random.choice(encounter_types)

            if encounter_type == 'outpatient':
                discharge_days = random.choice([0, 1])
            else:
                discharge_days = random.randint(1, 7)
            discharge_date = admission_date + timedelta(days=discharge_days)

            try:
                Encounter.objects.create(
                    patient=patient,
                    encounter_type=encounter_type,
                    status='completed',
                    attending_doctor=random.choice(doctors),
                    department=random.choice(departments),
                    admission_date=admission_date,
                    discharge_date=discharge_date,
                    chief_complaint=random.choice(chief_complaints),
                    primary_diagnosis=random.choice(primary_diagnoses),
                    secondary_diagnoses=random.sample(['고혈압', '당뇨', '고지혈증'], random.randint(0, 2)),
                    subjective=random.choice(subjective_samples),
                    objective=random.choice(objective_samples),
                    assessment=random.choice(assessment_samples),
                    plan=random.choice(plan_samples),
                )
                created_count += 1
            except Exception as e:
                print(f"  오류 ({patient.patient_number}): {e}")

    print(f"[OK] 과거 진료 기록 생성: {created_count}건 ({patients_updated}명 환자)")
    return True


def create_dummy_imaging_with_ocs(num_orders=15, force=False):
    """
    더미 영상 검사 데이터 생성 (OCS 통합 버전)

    ※ 환자데이터 폴더 수(15개)에 맞춰 15건만 생성
    ※ 환자번호 P202600001 ~ P202600015에게만 OCS RIS 생성
    ※ sync_orthanc_ocs.py로 Orthanc 연동 후 CONFIRMED 처리
    """
    print(f"\n[3단계] 영상 검사 데이터 생성 - OCS 통합 (목표: {num_orders}건, 환자데이터 폴더 수 기준)...")

    from apps.ocs.models import OCS
    from apps.imaging.models import ImagingStudy
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_ocs = OCS.objects.filter(job_role='RIS').count()
    if existing_ocs >= num_orders and not force:
        print(f"[SKIP] 이미 {existing_ocs}건의 RIS 오더가 존재합니다.")
        return True

    # 환자데이터 폴더와 매칭될 환자 16명 (P202600001 ~ P202600016)
    target_patients = list(Patient.objects.filter(
        is_deleted=False
    ).order_by('patient_number')[:num_orders])

    if len(target_patients) < num_orders:
        print(f"[WARNING] 환자가 {len(target_patients)}명만 존재합니다. {len(target_patients)}건만 생성합니다.")
        num_orders = len(target_patients)

    # 각 환자의 진료 기록 찾기
    radiologists = list(User.objects.filter(role__code__in=['RIS', 'DOCTOR']))
    if not radiologists:
        radiologists = list(User.objects.filter(role__code='DOCTOR'))

    priorities = ['urgent', 'normal']
    clinical_indications = ['brain tumor evaluation', 'follow-up', 'post-op check', 'treatment response']

    created_count = 0

    for patient in target_patients:
        # 해당 환자의 진료 기록 찾기
        encounter = Encounter.objects.filter(
            patient=patient,
            attending_doctor__isnull=False
        ).first()

        if not encounter:
            # 진료 기록이 없으면 첫 번째 의사로 생성
            doctor = User.objects.filter(role__code='DOCTOR').first()
            if not doctor:
                print(f"  [SKIP] {patient.patient_number}: 의사가 없음")
                continue
        else:
            doctor = encounter.attending_doctor

        # doctor_request 데이터
        doctor_request = {
            "_template": "default",
            "_version": "1.0",
            "clinical_info": f"{random.choice(clinical_indications)} - {patient.name}",
            "request_detail": f"MRI Head 촬영 요청",
            "special_instruction": random.choice(["", "조영제 사용", "조영제 없이"]),
        }

        # OCS 상태: ORDERED (sync_orthanc_ocs.py에서 CONFIRMED로 업데이트)
        ocs_status = 'ORDERED'

        try:
            with transaction.atomic():
                # OCS 생성
                ocs = OCS.objects.create(
                    patient=patient,
                    doctor=doctor,
                    worker=None,  # sync_orthanc_ocs.py에서 설정
                    encounter=encounter,
                    job_role='RIS',
                    job_type='MRI',
                    ocs_status=ocs_status,
                    priority=random.choice(priorities),
                    doctor_request=doctor_request,
                    worker_result={},  # sync_orthanc_ocs.py에서 설정
                    ocs_result=None,
                )

                # ImagingStudy 생성 (OCS에 연결)
                study = ImagingStudy.objects.create(
                    ocs=ocs,
                    modality='MRI',
                    body_part='Brain',
                    study_uid=None,  # sync_orthanc_ocs.py에서 설정
                    series_count=0,
                    instance_count=0,
                    scheduled_at=None,
                    performed_at=None,
                )

                created_count += 1
                print(f"  [CREATE] {patient.patient_number} -> {ocs.ocs_id}")

        except Exception as e:
            print(f"  [ERROR] {patient.patient_number}: {e}")

    print(f"[OK] OCS + ImagingStudy 생성: {created_count}건")
    print(f"  현재 전체 OCS(RIS): {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  현재 전체 ImagingStudy: {ImagingStudy.objects.count()}건")
    print(f"\n  ※ 다음 단계: sync_orthanc_ocs.py 실행하여 Orthanc 연동")
    return True


def create_dummy_lis_orders(num_orders=30, force=False):
    """
    더미 LIS (검사) 오더 생성

    ※ 환자데이터 폴더 수(15개)에 맞춰 30건 생성:
      - RNA_SEQ 15건 (P202600001 ~ P202600015)
      - BIOMARKER 15건 (P202600001 ~ P202600015)
    ※ 초기 상태는 ORDERED (sync_lis_ocs.py로 파일 동기화 후 CONFIRMED 처리)
    ※ worker_result는 비워둠 (sync_lis_ocs.py에서 v1.2 포맷으로 채움)
    """
    print(f"\n[4단계] 검사 오더 데이터 생성 - LIS (목표: {num_orders}건)...")
    print(f"  ※ 환자데이터 폴더(15개)에 맞춰 RNA_SEQ 15건 + BIOMARKER 15건 생성")

    from apps.ocs.models import OCS
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인 (RNA_SEQ, BIOMARKER만)
    existing_rna = OCS.objects.filter(job_role='LIS', job_type='RNA_SEQ').count()
    existing_bio = OCS.objects.filter(job_role='LIS', job_type='BIOMARKER').count()
    existing_total = existing_rna + existing_bio

    if existing_total >= num_orders and not force:
        print(f"[SKIP] 이미 RNA_SEQ {existing_rna}건, BIOMARKER {existing_bio}건 존재")
        return True

    # 환자 P202600001 ~ P202600015 가져오기
    target_patients = []
    for i in range(1, 16):
        patient_number = f"P20260000{i}" if i < 10 else f"P2026000{i}"
        patient = Patient.objects.filter(patient_number=patient_number, is_deleted=False).first()
        if patient:
            target_patients.append(patient)
        else:
            print(f"  [WARNING] 환자 {patient_number} 없음")

    if len(target_patients) < 15:
        print(f"[WARNING] 환자가 15명 미만입니다. ({len(target_patients)}명)")

    # 해당 환자들의 진료 기록
    encounters_map = {}
    for patient in target_patients:
        enc = Encounter.objects.filter(
            patient=patient,
            attending_doctor__isnull=False
        ).select_related('attending_doctor').first()
        if enc:
            encounters_map[patient.patient_number] = enc

    lab_workers = list(User.objects.filter(role__code__in=['LIS', 'DOCTOR']))
    if not lab_workers:
        lab_workers = list(User.objects.filter(role__code='DOCTOR'))

    # RNA_SEQ, BIOMARKER 각각 16건씩 생성 (환자데이터 폴더의 rna/, protein/ 매칭)
    test_types_to_create = ['RNA_SEQ', 'BIOMARKER']

    created_count = 0

    # 각 환자에 대해 RNA_SEQ, BIOMARKER OCS 생성
    for patient in target_patients:
        encounter = encounters_map.get(patient.patient_number)

        if not encounter:
            # 진료 기록이 없으면 첫 번째 의사 사용
            doctor = lab_workers[0] if lab_workers else None
        else:
            doctor = encounter.attending_doctor

        for test_type in test_types_to_create:
            # 이미 존재하면 스킵
            if OCS.objects.filter(
                patient=patient,
                job_role='LIS',
                job_type=test_type,
                is_deleted=False
            ).exists() and not force:
                continue

            # 초기 상태: ORDERED (sync_lis_ocs.py에서 CONFIRMED로 변경)
            ocs_status = 'ORDERED'

            # doctor_request 데이터
            test_name = "RNA 발현 분석" if test_type == 'RNA_SEQ' else "단백질 마커 분석"
            doctor_request = {
                "_template": "default",
                "_version": "1.0",
                "clinical_info": f"{patient.name} - 뇌종양 검사",
                "request_detail": f"{test_name} 요청",
                "special_instruction": "",
            }

            # worker_result는 비워둠 (sync_lis_ocs.py에서 v1.2 포맷으로 채움)
            worker_result = {}

            try:
                with transaction.atomic():
                    ocs = OCS.objects.create(
                        patient=patient,
                        doctor=doctor,
                        worker=None,  # sync_lis_ocs.py에서 설정
                        encounter=encounter,
                        job_role='LIS',
                        job_type=test_type,
                        ocs_status=ocs_status,
                        priority='normal',
                        doctor_request=doctor_request,
                        worker_result=worker_result,
                        ocs_result=None,
                    )
                    created_count += 1
                    print(f"  [+] {patient.patient_number} -> {test_type} ({ocs.ocs_id})")

            except Exception as e:
                print(f"  [ERROR] {patient.patient_number} {test_type}: {e}")

    rna_count = OCS.objects.filter(job_role='LIS', job_type='RNA_SEQ', is_deleted=False).count()
    bio_count = OCS.objects.filter(job_role='LIS', job_type='BIOMARKER', is_deleted=False).count()

    print(f"\n[OK] OCS(LIS) 생성: {created_count}건")
    print(f"  - RNA_SEQ: {rna_count}건")
    print(f"  - BIOMARKER: {bio_count}건")
    print(f"\n  ※ 다음 단계: sync_lis_ocs.py 실행하여 파일 동기화")
    return True


def create_additional_ocs_orders(num_orders=15, force=False):
    """
    추가 OCS 오더 생성 (ORDERED 상태 유지)

    ※ 환자데이터 폴더가 없는 환자(P202600016~)에게 OCS 생성
    ※ sync 스크립트와 매칭되지 않으므로 ORDERED 상태 유지
    ※ RIS 5건, LIS(RNA_SEQ) 5건, LIS(BIOMARKER) 5건 = 총 15건
    """
    print(f"\n[4-1단계] 추가 OCS 오더 생성 - ORDERED 상태 (목표: {num_orders}건)...")
    print(f"  ※ 환자데이터 폴더가 없는 환자에게 생성 (ORDERED 상태 유지)")

    from apps.ocs.models import OCS
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 환자데이터 폴더가 없는 환자 (P202600016 ~ P202600050)
    target_patients = list(Patient.objects.filter(
        is_deleted=False
    ).order_by('patient_number')[15:50])  # 16번째부터

    if len(target_patients) < 5:
        print(f"[WARNING] 추가 환자가 부족합니다. ({len(target_patients)}명)")
        return True

    # 의사 목록
    doctors = list(User.objects.filter(role__code='DOCTOR'))
    if not doctors:
        print("[ERROR] 의사가 없습니다.")
        return False

    # 각 타입별 5건씩 생성 (RIS 5 + RNA_SEQ 5 + BIOMARKER 5 = 15)
    job_configs = [
        ('RIS', 'MRI', 5),
        ('LIS', 'RNA_SEQ', 5),
        ('LIS', 'BIOMARKER', 5),
    ]

    created_count = 0
    patient_idx = 0

    for job_role, job_type, count in job_configs:
        for i in range(count):
            if patient_idx >= len(target_patients):
                patient_idx = 0  # 환자 순환

            patient = target_patients[patient_idx]
            patient_idx += 1

            # 해당 환자의 진료 기록 찾기
            encounter = Encounter.objects.filter(
                patient=patient,
                attending_doctor__isnull=False
            ).first()

            doctor = encounter.attending_doctor if encounter else random.choice(doctors)

            # doctor_request 데이터
            if job_role == 'RIS':
                request_detail = "MRI Head 촬영 요청"
                clinical_info = f"brain tumor evaluation - {patient.name}"
            else:
                test_name = "RNA 발현 분석" if job_type == 'RNA_SEQ' else "단백질 마커 분석"
                request_detail = f"{test_name} 요청"
                clinical_info = f"{patient.name} - 뇌종양 검사"

            doctor_request = {
                "_template": "default",
                "_version": "1.0",
                "clinical_info": clinical_info,
                "request_detail": request_detail,
                "special_instruction": "",
            }

            try:
                with transaction.atomic():
                    ocs = OCS.objects.create(
                        patient=patient,
                        doctor=doctor,
                        worker=None,
                        encounter=encounter,
                        job_role=job_role,
                        job_type=job_type,
                        ocs_status='ORDERED',  # ORDERED 상태 유지
                        priority='normal',
                        doctor_request=doctor_request,
                        worker_result={},
                        ocs_result=None,
                    )
                    created_count += 1
                    print(f"  [+] {patient.patient_number} -> {job_role}/{job_type} ({ocs.ocs_id})")

            except Exception as e:
                print(f"  [ERROR] {patient.patient_number} {job_role}/{job_type}: {e}")

    print(f"\n[OK] 추가 OCS 생성: {created_count}건 (모두 ORDERED 상태)")
    print(f"  - RIS: {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  - LIS: {OCS.objects.filter(job_role='LIS').count()}건")
    return True


def create_ai_models():
    """AI 모델 시드 데이터 생성 (현재 AIInference 단일 모델 사용으로 스킵)"""
    print(f"\n[5단계] AI 모델 데이터 생성...")
    print(f"[SKIP] AIInference 단일 모델 사용 - AI 모델 시드 데이터 불필요")
    return True


def create_patient_alerts(force=False):
    """환자 주의사항 더미 데이터 생성"""
    print("\n[6단계] 환자 주의사항 데이터 생성...")

    from apps.patients.models import Patient, PatientAlert
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = PatientAlert.objects.count()
    if existing_count > 0 and not force:
        print(f"[SKIP] 이미 {existing_count}건의 주의사항이 존재합니다.")
        return True

    patients = list(Patient.objects.filter(is_deleted=False))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    alert_samples = [
        {'alert_type': 'ALLERGY', 'severity': 'HIGH', 'title': '페니실린 알레르기', 'description': '페니실린 계열 항생제 투여 시 아나필락시스 반응 가능'},
        {'alert_type': 'ALLERGY', 'severity': 'HIGH', 'title': '조영제 알레르기', 'description': 'CT/MRI 조영제 투여 시 두드러기, 호흡곤란 발생 이력'},
        {'alert_type': 'ALLERGY', 'severity': 'MEDIUM', 'title': '아스피린 과민반응', 'description': 'NSAIDs 사용 시 주의 필요'},
        {'alert_type': 'CONTRAINDICATION', 'severity': 'HIGH', 'title': '와파린 복용 중', 'description': '항응고제 복용 중 - 출혈 위험'},
        {'alert_type': 'CONTRAINDICATION', 'severity': 'HIGH', 'title': 'MRI 금기', 'description': '심장 박동기 삽입 환자 - MRI 촬영 금지'},
        {'alert_type': 'PRECAUTION', 'severity': 'MEDIUM', 'title': '낙상 주의', 'description': '보행 장애로 인한 낙상 위험'},
        {'alert_type': 'PRECAUTION', 'severity': 'LOW', 'title': '당뇨 환자', 'description': '혈당 관리 필요 - 공복 검사 시 저혈당 주의'},
        {'alert_type': 'OTHER', 'severity': 'LOW', 'title': '보호자 연락 필요', 'description': '중요 결정 시 보호자 동의 필요'},
    ]

    created_count = 0

    # 각 환자에게 0~3개의 주의사항 추가
    for patient in patients:
        num_alerts = random.randint(0, 3)
        if num_alerts == 0:
            continue

        selected_alerts = random.sample(alert_samples, min(num_alerts, len(alert_samples)))
        for alert_data in selected_alerts:
            try:
                PatientAlert.objects.create(
                    patient=patient,
                    alert_type=alert_data['alert_type'],
                    severity=alert_data['severity'],
                    title=alert_data['title'],
                    description=alert_data['description'],
                    is_active=True,
                    created_by=random.choice(doctors),
                )
                created_count += 1
            except Exception as e:
                print(f"  오류: {e}")

    print(f"[OK] 환자 주의사항 생성: {created_count}건")
    print(f"  현재 전체 주의사항: {PatientAlert.objects.count()}건")
    return True


def link_patient_user_account():
    """
    PATIENT 역할 사용자를 환자(Patient) 테이블과 연결

    patient1~5 계정 → 환자 테이블의 김철수, 이영희, 박민수, 최지은, 정현우와 연결
    """
    print("\n[7단계] 환자 계정-환자 테이블 연결...")

    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # PATIENT 역할 사용자 ↔ 환자 이름 매핑 (5명)
    patient_mapping = [
        ('patient1', '김철수'),
        ('patient2', '이영희'),
        ('patient3', '박민수'),
        ('patient4', '최지은'),
        ('patient5', '정현우'),
    ]

    linked_count = 0
    skipped_count = 0

    for login_id, patient_name in patient_mapping:
        # 사용자 확인
        patient_user = User.objects.filter(login_id=login_id, role__code='PATIENT').first()
        if not patient_user:
            print(f"  [SKIP] {login_id} 사용자가 없거나 PATIENT 역할이 아닙니다.")
            skipped_count += 1
            continue

        # 이미 연결된 환자가 있는지 확인
        if Patient.objects.filter(user=patient_user).exists():
            linked_patient = Patient.objects.get(user=patient_user)
            print(f"  [OK] 이미 연결됨: {login_id} → {linked_patient.name}")
            skipped_count += 1
            continue

        # 환자 찾기
        patient = Patient.objects.filter(name=patient_name, is_deleted=False, user__isnull=True).first()
        if not patient:
            print(f"  [SKIP] {patient_name} 환자가 없거나 이미 연결됨")
            skipped_count += 1
            continue

        # 연결
        patient.user = patient_user
        patient.save()
        linked_count += 1
        print(f"  [OK] 연결: {login_id} → {patient.name} ({patient.patient_number})")

    print(f"[OK] 환자 계정 연결 완료 (연결: {linked_count}건, 스킵: {skipped_count}건)")
    print(f"     테스트 계정: patient1~5 / patient1001~patient5001")
    return True


# ============================================================
# 치료/경과/AI 요청 (from 2_add.py)
# ============================================================

def create_dummy_treatment_plans(num_plans=15, force=False):
    """더미 치료 계획 데이터 생성"""
    print(f"\n[8단계] 치료 계획 데이터 생성 (목표: {num_plans}건)...")

    from apps.treatment.models import TreatmentPlan, TreatmentSession
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = TreatmentPlan.objects.count()
    if existing_count >= num_plans and not force:
        print(f"[SKIP] 이미 {existing_count}건의 치료 계획이 존재합니다.")
        return True

    # 필요한 데이터
    patients = list(Patient.objects.filter(is_deleted=False))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    # 실제 모델의 choices 사용
    treatment_types = [choice[0] for choice in TreatmentPlan.TreatmentType.choices]
    treatment_goals = [choice[0] for choice in TreatmentPlan.TreatmentGoal.choices]
    statuses = [choice[0] for choice in TreatmentPlan.Status.choices]

    plan_summaries = {
        'surgery': ['뇌종양 절제술 시행 예정', '내시경 수술 계획', '감압술 시행', '조직 검사 후 치료 방향 결정'],
        'radiation': ['전뇌 방사선 치료 진행', '정위적 방사선 수술 계획', 'IMRT 치료 시행', '양성자 치료 고려'],
        'chemotherapy': ['테모졸로마이드 치료 시작', '베바시주맙 치료 진행', '복합 항암 요법 적용', '면역 항암 치료 시행'],
        'observation': ['정기 MRI 추적 관찰', '증상 모니터링 지속', '경과 관찰 후 치료 결정'],
        'combined': ['수술 후 방사선+항암 병합', '동시 화학방사선 요법 진행', '복합 치료 프로토콜 적용']
    }

    created_count = 0

    for i in range(num_plans):
        patient = random.choice(patients)
        doctor = random.choice(doctors)
        treatment_type = random.choice(treatment_types)
        treatment_goal = random.choice(treatment_goals)
        status = random.choice(statuses)

        days_ago = random.randint(0, 180)
        start_date = timezone.now().date() - timedelta(days=days_ago)

        end_date = None
        actual_start = None
        actual_end = None

        if status == 'completed':
            actual_start = start_date
            actual_end = start_date + timedelta(days=random.randint(14, 90))
            end_date = actual_end
        elif status == 'in_progress':
            actual_start = start_date
            end_date = start_date + timedelta(days=random.randint(30, 120))
        elif status == 'cancelled':
            end_date = start_date + timedelta(days=random.randint(7, 30))
        elif status == 'planned':
            end_date = start_date + timedelta(days=random.randint(30, 90))

        try:
            with transaction.atomic():
                plan = TreatmentPlan.objects.create(
                    patient=patient,
                    treatment_type=treatment_type,
                    treatment_goal=treatment_goal,
                    plan_summary=random.choice(plan_summaries[treatment_type]),
                    planned_by=doctor,
                    status=status,
                    start_date=start_date,
                    end_date=end_date,
                    actual_start_date=actual_start,
                    actual_end_date=actual_end,
                    notes=f"담당의: {doctor.name}" if random.random() < 0.3 else ""
                )

                # 치료 세션 생성 (방사선, 항암의 경우)
                if treatment_type in ['radiation', 'chemotherapy'] and status in ['in_progress', 'completed']:
                    num_sessions = random.randint(3, 8)
                    session_statuses = [choice[0] for choice in TreatmentSession.Status.choices]

                    for j in range(num_sessions):
                        session_datetime = timezone.now() - timedelta(days=days_ago - j * 7)
                        if session_datetime < timezone.now():
                            session_status = 'completed'
                        else:
                            session_status = 'scheduled'

                        TreatmentSession.objects.create(
                            treatment_plan=plan,
                            session_number=j + 1,
                            session_date=session_datetime,
                            performed_by=doctor if session_status == 'completed' else None,
                            status=session_status,
                            session_note=f"{j + 1}회차 치료 진행" if session_status == 'completed' else ""
                        )

                created_count += 1

        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 치료 계획 생성: {created_count}건")
    print(f"  현재 전체 치료 계획: {TreatmentPlan.objects.count()}건")
    print(f"  현재 전체 치료 세션: {TreatmentSession.objects.count()}건")
    return True


def create_dummy_followups(num_followups=25, force=False):
    """더미 경과 추적 데이터 생성"""
    print(f"\n[9단계] 경과 추적 데이터 생성 (목표: {num_followups}건)...")

    from apps.followup.models import FollowUp
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = FollowUp.objects.count()
    if existing_count >= num_followups and not force:
        print(f"[SKIP] 이미 {existing_count}건의 경과 기록이 존재합니다.")
        return True

    # 필요한 데이터
    patients = list(Patient.objects.filter(is_deleted=False))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    # 실제 모델의 choices 사용
    followup_types = [choice[0] for choice in FollowUp.FollowUpType.choices]
    clinical_statuses = [choice[0] for choice in FollowUp.ClinicalStatus.choices]

    symptoms_list = [
        ['두통'], ['어지러움'], ['시야 흐림'], ['손발 저림'],
        [], ['피로감'], ['기억력 저하'], ['수면 장애'],
        ['오심', '구토'], ['경련']
    ]

    notes_list = [
        '전반적으로 안정적인 상태 유지',
        '영상 소견상 변화 없음',
        '치료 반응 양호',
        '경미한 증상 악화 관찰',
        '추가 검사 필요',
        '현 치료 계획 유지 권고',
        '다음 정기 검진 예정',
        'MRI 추적 검사 예정'
    ]

    created_count = 0

    for i in range(num_followups):
        patient = random.choice(patients)
        doctor = random.choice(doctors)
        followup_type = random.choice(followup_types)
        clinical_status = random.choice(clinical_statuses)

        days_ago = random.randint(0, 365)
        followup_datetime = timezone.now() - timedelta(days=days_ago)

        # 다음 방문일 (50% 확률로 설정)
        next_followup = None
        if random.random() < 0.5:
            next_followup = followup_datetime.date() + timedelta(days=random.randint(30, 90))

        # 바이탈 사인 (JSON 형식)
        vitals = {}
        if random.random() < 0.6:
            vitals = {
                'bp_systolic': random.randint(110, 140),
                'bp_diastolic': random.randint(70, 90),
                'heart_rate': random.randint(60, 100),
                'temperature': round(random.uniform(36.0, 37.5), 1)
            }

        try:
            FollowUp.objects.create(
                patient=patient,
                followup_date=followup_datetime,
                followup_type=followup_type,
                clinical_status=clinical_status,
                symptoms=random.choice(symptoms_list) if random.random() < 0.7 else [],
                kps_score=random.choice([None, 70, 80, 90, 100]),
                ecog_score=random.choice([None, 0, 1, 2]),
                vitals=vitals,
                weight_kg=round(random.uniform(50, 85), 2) if random.random() < 0.6 else None,
                note=random.choice(notes_list),
                next_followup_date=next_followup,
                recorded_by=doctor
            )
            created_count += 1

        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 경과 기록 생성: {created_count}건")
    print(f"  현재 전체 경과 기록: {FollowUp.objects.count()}건")
    return True


# ============================================================
# 처방 데이터 (from 3_prescriptions.py)
# ============================================================

# 뇌종양 관련 약품 목록
MEDICATIONS = [
    # 항암제
    {"name": "Temozolomide 140mg", "code": "TEM140", "dosage": "140mg", "frequency": "QD", "route": "PO", "instructions": "공복에 복용, 구역질 시 제토제 병용"},
    {"name": "Temozolomide 250mg", "code": "TEM250", "dosage": "250mg", "frequency": "QD", "route": "PO", "instructions": "공복에 복용, 혈구 수치 모니터링 필요"},
    {"name": "Bevacizumab 400mg", "code": "BEV400", "dosage": "400mg", "frequency": "QW", "route": "IV", "instructions": "10mg/kg 기준, 30분 이상 점적"},
    {"name": "Lomustine 100mg", "code": "LOM100", "dosage": "100mg", "frequency": "QOD", "route": "PO", "instructions": "6주 주기, 혈액 검사 필수"},
    # 부종/뇌압 관리
    {"name": "Dexamethasone 4mg", "code": "DEX4", "dosage": "4mg", "frequency": "TID", "route": "PO", "instructions": "식후 복용, 점진적 감량 필요"},
    {"name": "Dexamethasone 8mg", "code": "DEX8", "dosage": "8mg", "frequency": "BID", "route": "IV", "instructions": "응급 시 사용, 점진적 경구 전환"},
    {"name": "Mannitol 20% 100ml", "code": "MAN100", "dosage": "100ml", "frequency": "QID", "route": "IV", "instructions": "뇌압 상승 시 15분 이상 점적"},
    # 항경련제
    {"name": "Levetiracetam 500mg", "code": "LEV500", "dosage": "500mg", "frequency": "BID", "route": "PO", "instructions": "식사와 무관, 갑작스런 중단 금지"},
    {"name": "Levetiracetam 1000mg", "code": "LEV1000", "dosage": "1000mg", "frequency": "BID", "route": "PO", "instructions": "고용량, 졸음 주의"},
    {"name": "Valproic acid 500mg", "code": "VPA500", "dosage": "500mg", "frequency": "TID", "route": "PO", "instructions": "간기능 검사 정기적 시행"},
    {"name": "Phenytoin 100mg", "code": "PHE100", "dosage": "100mg", "frequency": "TID", "route": "PO", "instructions": "혈중 농도 모니터링 필요"},
    # 진통제
    {"name": "Acetaminophen 500mg", "code": "ACE500", "dosage": "500mg", "frequency": "QID", "route": "PO", "instructions": "1일 4g 초과 금지"},
    {"name": "Tramadol 50mg", "code": "TRA50", "dosage": "50mg", "frequency": "TID", "route": "PO", "instructions": "졸음 유발 가능, 운전 주의"},
    {"name": "Oxycodone 10mg", "code": "OXY10", "dosage": "10mg", "frequency": "BID", "route": "PO", "instructions": "마약성 진통제, 변비 예방 필요"},
    # 구역/구토 관리
    {"name": "Ondansetron 8mg", "code": "OND8", "dosage": "8mg", "frequency": "BID", "route": "PO", "instructions": "항암 치료 30분 전 투여"},
    {"name": "Metoclopramide 10mg", "code": "MET10", "dosage": "10mg", "frequency": "TID", "route": "PO", "instructions": "식전 30분 복용"},
    # 위장 보호
    {"name": "Esomeprazole 40mg", "code": "ESO40", "dosage": "40mg", "frequency": "QD", "route": "PO", "instructions": "아침 식전 복용"},
    {"name": "Famotidine 20mg", "code": "FAM20", "dosage": "20mg", "frequency": "BID", "route": "PO", "instructions": "스테로이드 병용 시 필수"},
    # 기타 보조
    {"name": "Megestrol acetate 160mg", "code": "MEG160", "dosage": "160mg", "frequency": "QD", "route": "PO", "instructions": "식욕 부진 시 사용"},
    {"name": "Methylphenidate 10mg", "code": "MPH10", "dosage": "10mg", "frequency": "BID", "route": "PO", "instructions": "피로감 개선, 오후 투여 피함"},
]

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
    "림프종 (Primary CNS Lymphoma)",
    "상의세포종 (Ependymoma)",
]

# 의약품 카테고리 매핑 (코드 접두어 기반)
MEDICATION_CATEGORIES = {
    'TEM': 'CHEMOTHERAPY',  # Temozolomide
    'BEV': 'CHEMOTHERAPY',  # Bevacizumab
    'LOM': 'CHEMOTHERAPY',  # Lomustine
    'DEX': 'STEROID',       # Dexamethasone
    'MAN': 'DIURETIC',      # Mannitol
    'LEV': 'ANTIEPILEPTIC', # Levetiracetam
    'VPA': 'ANTIEPILEPTIC', # Valproic acid
    'PHE': 'ANTIEPILEPTIC', # Phenytoin
    'ACE': 'ANALGESIC',     # Acetaminophen
    'TRA': 'ANALGESIC',     # Tramadol
    'OXY': 'ANALGESIC',     # Oxycodone
    'OND': 'ANTIEMETIC',    # Ondansetron
    'MET': 'ANTIEMETIC',    # Metoclopramide
    'ESO': 'OTHER',         # Esomeprazole (위장보호)
    'FAM': 'OTHER',         # Famotidine (위장보호)
    'MEG': 'OTHER',         # Megestrol (보조)
    'MPH': 'OTHER',         # Methylphenidate (보조)
}


def create_dummy_medications(force=False):
    """의약품 마스터 데이터 생성 (클릭 처방용)"""
    print(f"\n[10-1단계] 의약품 마스터 데이터 생성 (목표: {len(MEDICATIONS)}개)...")

    from apps.prescriptions.models import Medication

    # 기존 데이터 확인
    existing_count = Medication.objects.filter(is_active=True).count()
    if existing_count >= len(MEDICATIONS) and not force:
        print(f"[SKIP] 이미 {existing_count}개의 의약품이 존재합니다.")
        return True

    created_count = 0
    updated_count = 0

    for med in MEDICATIONS:
        # 코드 접두어로 카테고리 결정
        code_prefix = med['code'][:3]
        category = MEDICATION_CATEGORIES.get(code_prefix, 'OTHER')

        # Route 매핑
        route_map = {'PO': 'PO', 'IV': 'IV', 'IM': 'IM', 'SC': 'SC'}
        route = route_map.get(med['route'], 'OTHER')

        try:
            medication, created = Medication.objects.update_or_create(
                code=med['code'],
                defaults={
                    'name': med['name'],
                    'category': category,
                    'default_dosage': med['dosage'],
                    'default_route': route,
                    'default_frequency': med['frequency'],
                    'default_duration_days': 7,
                    'unit': '정' if route == 'PO' else 'ml' if route == 'IV' else '정',
                    'warnings': med['instructions'],
                    'is_active': True,
                }
            )
            if created:
                created_count += 1
            else:
                updated_count += 1
        except Exception as e:
            print(f"  오류 ({med['code']}): {e}")

    print(f"[OK] 의약품 생성: {created_count}개, 업데이트: {updated_count}개")
    print(f"  현재 전체 의약품: {Medication.objects.filter(is_active=True).count()}개")
    return True


def create_dummy_prescriptions(num_prescriptions=20, num_items_per_rx=3, force=False):
    """더미 처방 데이터 생성"""
    print(f"\n[11단계] 처방 데이터 생성 (목표: 처방 {num_prescriptions}건, 항목 약 {num_prescriptions * num_items_per_rx}건)...")

    from apps.prescriptions.models import Prescription, PrescriptionItem
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_count = Prescription.objects.count()
    if existing_count >= num_prescriptions and not force:
        print(f"[SKIP] 이미 {existing_count}건의 처방이 존재합니다.")
        return True

    # 필요한 데이터
    patients = list(Patient.objects.filter(is_deleted=False))
    doctors = list(User.objects.filter(role__code='DOCTOR'))
    encounters = list(Encounter.objects.all())

    if not patients:
        print("[ERROR] 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    statuses = [choice[0] for choice in Prescription.Status.choices]
    status_weights = [0.1, 0.5, 0.3, 0.1]  # DRAFT, ISSUED, DISPENSED, CANCELLED

    notes_list = [
        "다음 진료 시 반응 평가 예정",
        "부작용 발생 시 즉시 내원",
        "정기 혈액 검사 필요",
        "복용법 상세 설명 완료",
        "외래 2주 후 재방문 예정",
        "",
    ]

    prescription_count = 0
    item_count = 0

    for i in range(num_prescriptions):
        patient = random.choice(patients)
        doctor = random.choice(doctors)
        encounter = random.choice(encounters) if encounters and random.random() < 0.7 else None
        status = random.choices(statuses, weights=status_weights)[0]
        diagnosis = random.choice(DIAGNOSES)

        days_ago = random.randint(0, 180)
        created_at_delta = timedelta(days=days_ago)

        # 타임스탬프 설정
        issued_at = None
        dispensed_at = None
        cancelled_at = None
        cancel_reason = None

        if status in ['ISSUED', 'DISPENSED']:
            issued_at = timezone.now() - created_at_delta + timedelta(hours=random.randint(1, 4))
        if status == 'DISPENSED':
            dispensed_at = issued_at + timedelta(hours=random.randint(1, 24)) if issued_at else None
        if status == 'CANCELLED':
            cancelled_at = timezone.now() - created_at_delta + timedelta(hours=random.randint(1, 8))
            cancel_reason = random.choice([
                "환자 요청으로 취소",
                "처방 내용 변경",
                "약물 상호작용 우려",
                "진단 변경",
            ])

        try:
            with transaction.atomic():
                prescription = Prescription.objects.create(
                    patient=patient,
                    doctor=doctor,
                    encounter=encounter,
                    status=status,
                    diagnosis=diagnosis,
                    notes=random.choice(notes_list),
                    issued_at=issued_at,
                    dispensed_at=dispensed_at,
                    cancelled_at=cancelled_at,
                    cancel_reason=cancel_reason,
                )

                # 처방 항목 생성 (1~5개)
                num_items = random.randint(1, 5)
                selected_meds = random.sample(MEDICATIONS, min(num_items, len(MEDICATIONS)))

                for order, med in enumerate(selected_meds):
                    duration = random.choice([7, 14, 28, 30, 60, 90])

                    # 빈도에 따른 수량 계산
                    freq_multiplier = {'QD': 1, 'BID': 2, 'TID': 3, 'QID': 4, 'PRN': 1, 'QOD': 0.5, 'QW': 0.14}
                    daily_count = freq_multiplier.get(med['frequency'], 1)
                    quantity = int(duration * daily_count) + random.randint(0, 5)

                    PrescriptionItem.objects.create(
                        prescription=prescription,
                        medication_name=med['name'],
                        medication_code=med['code'],
                        dosage=med['dosage'],
                        frequency=med['frequency'],
                        route=med['route'],
                        duration_days=duration,
                        quantity=quantity,
                        instructions=med['instructions'],
                        order=order,
                    )
                    item_count += 1

                prescription_count += 1

        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] 처방 생성: {prescription_count}건")
    print(f"[OK] 처방 항목 생성: {item_count}건")
    print(f"  현재 전체 처방: {Prescription.objects.count()}건")
    print(f"  현재 전체 처방 항목: {PrescriptionItem.objects.count()}건")
    return True


def _generate_external_lis_worker_result(job_type: str, ocs_id: str, is_confirmed: bool = True) -> dict:
    """
    외부기관 LIS OCS worker_result 생성 (내부 환자와 동일한 v1.2 포맷)
    """
    timestamp = timezone.now().isoformat() + "Z"

    if job_type == 'RNA_SEQ':
        # RNA_SEQ 결과 포맷
        return {
            "_template": "LIS",
            "_version": "1.2",
            "_confirmed": is_confirmed,
            "_external": True,
            "_verifiedAt": timestamp if is_confirmed else None,
            "_verifiedBy": "외부기관" if is_confirmed else None,

            "test_type": "RNA_SEQ",

            # RNA-seq 결과
            "RNA_seq": f"CDSS_STORAGE/LIS/{ocs_id}/gene_expression.csv",
            "gene_expression": {
                "file_path": f"CDSS_STORAGE/LIS/{ocs_id}/gene_expression.csv",
                "file_size": random.randint(400000, 500000),
                "uploaded_at": timestamp,
                "top_expressed_genes": [
                    {"gene_symbol": "EGFR", "entrez_id": "1956", "expression": random.uniform(5000, 15000)},
                    {"gene_symbol": "TP53", "entrez_id": "7157", "expression": random.uniform(3000, 10000)},
                    {"gene_symbol": "PTEN", "entrez_id": "5728", "expression": random.uniform(2000, 8000)},
                    {"gene_symbol": "IDH1", "entrez_id": "3417", "expression": random.uniform(1500, 6000)},
                    {"gene_symbol": "ATRX", "entrez_id": "546", "expression": random.uniform(1000, 5000)},
                ],
                "total_genes": 20531,
            },

            # 분석 결과
            "sequencing_data": {
                "method": "RNA-Seq (Illumina HiSeq)",
                "coverage": round(random.uniform(90, 99), 1),
                "quality_score": round(random.uniform(35, 40), 1),
                "raw_data_path": f"CDSS_STORAGE/LIS/{ocs_id}/",
            },

            "summary": "외부기관 RNA 시퀀싱 분석 완료. 유전자 발현 프로파일 확인됨.",
            "interpretation": "뇌종양 관련 유전자 발현 패턴 분석 결과",

            "test_results": [],
            "gene_mutations": [],
            "_custom": {}
        }
    else:
        # BIOMARKER 결과 포맷
        protein_markers = [
            {"marker_name": "14-3-3_beta", "full_name": "YWHAB|14-3-3_beta", "value": str(round(random.uniform(-0.5, 0.5), 4)), "unit": "AU", "reference_range": "-1.0 ~ 1.0", "is_abnormal": False, "interpretation": "정상"},
            {"marker_name": "14-3-3_epsilon", "full_name": "YWHAE|14-3-3_epsilon", "value": str(round(random.uniform(-0.5, 0.5), 4)), "unit": "AU", "reference_range": "-1.0 ~ 1.0", "is_abnormal": False, "interpretation": "정상"},
            {"marker_name": "4E-BP1", "full_name": "EIF4EBP1|4E-BP1", "value": str(round(random.uniform(-0.5, 0.5), 4)), "unit": "AU", "reference_range": "-1.0 ~ 1.0", "is_abnormal": False, "interpretation": "정상"},
            {"marker_name": "EGFR", "full_name": "EGFR", "value": str(round(random.uniform(0.3, 0.8), 4)), "unit": "AU", "reference_range": "-1.0 ~ 1.0", "is_abnormal": True, "interpretation": "과발현"},
            {"marker_name": "p53", "full_name": "TP53", "value": str(round(random.uniform(-0.3, 0.3), 4)), "unit": "AU", "reference_range": "-1.0 ~ 1.0", "is_abnormal": False, "interpretation": "정상"},
        ]

        return {
            "_template": "LIS",
            "_version": "1.2",
            "_confirmed": is_confirmed,
            "_external": True,
            "_verifiedAt": timestamp if is_confirmed else None,
            "_verifiedBy": "외부기관" if is_confirmed else None,

            "test_type": "PROTEIN",

            # Protein 결과
            "protein": f"CDSS_STORAGE/LIS/{ocs_id}/rppa.csv",
            "protein_markers": protein_markers,
            "protein_data": {
                "file_path": f"CDSS_STORAGE/LIS/{ocs_id}/rppa.csv",
                "file_size": random.randint(5000, 6000),
                "uploaded_at": timestamp,
                "method": "RPPA (Reverse Phase Protein Array)",
                "total_markers": 189,
            },

            "summary": "외부기관 단백질 발현 분석 완료. RPPA 데이터 확인됨.",
            "interpretation": "뇌종양 관련 단백질 마커 분석 결과",

            "test_results": [],
            "_custom": {}
        }


def _get_existing_ocs_dicom_info(index: int) -> dict:
    """
    기존 ocs_* OCS에서 실제 Orthanc DICOM 정보를 가져옴
    외부 OCS가 실제 DICOM을 참조하도록 함
    """
    from apps.ocs.models import OCS

    # 기존 ocs_* 중 CONFIRMED이고 DICOM이 있는 것 조회
    source_ocs_list = OCS.objects.filter(
        ocs_id__startswith='ocs_',
        job_role='RIS',
        ocs_status='CONFIRMED'
    ).exclude(worker_result={}).order_by('ocs_id')

    if source_ocs_list.exists():
        # index를 순환하여 사용
        ocs = source_ocs_list[index % source_ocs_list.count()]
        wr = ocs.worker_result or {}
        dicom_info = wr.get('dicom', {})
        orthanc_info = wr.get('orthanc', {})

        if dicom_info.get('study_uid'):
            return {
                'dicom': dicom_info,
                'orthanc': orthanc_info
            }

    return None


def _generate_external_ris_worker_result(ocs_id: str, is_confirmed: bool = True, index: int = 0) -> dict:
    """
    외부기관 RIS OCS worker_result 생성 (내부 환자와 동일한 v1.2 포맷)
    실제 Orthanc에 있는 DICOM의 study_uid를 사용하여 AI 추론이 가능하도록 함
    """
    import uuid
    timestamp = timezone.now().isoformat() + "Z"

    # 기존 OCS에서 실제 DICOM 정보 가져오기
    existing_info = _get_existing_ocs_dicom_info(index)

    if existing_info:
        # 실제 DICOM 정보 사용
        dicom_info = existing_info['dicom']
        orthanc_info = existing_info['orthanc']
    else:
        # 기존 OCS가 없으면 가상 정보 생성 (AI 추론 불가)
        study_uid = f"1.2.410.200001.{random.randint(1000, 9999)}.{random.randint(100000, 999999)}"
        series_types = ["t1", "t1ce", "t2", "flair", "seg"]
        series_list = []
        for i, series_type in enumerate(series_types):
            series_list.append({
                "orthanc_id": uuid.uuid4().hex[:32],
                "series_uid": f"1.2.826.0.1.3680043.8.498.{random.randint(10000000000, 99999999999)}",
                "series_type": series_type.upper() if series_type != "t1ce" else "T1C",
                "description": series_type,
                "instances_count": 155,
            })
        dicom_info = {
            "study_uid": study_uid,
            "series_count": len(series_list),
            "instance_count": sum(s["instances_count"] for s in series_list),
        }
        orthanc_info = {
            "study_id": uuid.uuid4().hex[:16],
            "orthanc_study_id": uuid.uuid4().hex[:32],
            "series": series_list,
        }

    return {
        "_template": "RIS",
        "_version": "1.2",
        "_confirmed": is_confirmed,
        "_external": True,
        "_verifiedAt": timestamp if is_confirmed else None,
        "_verifiedBy": "외부기관" if is_confirmed else None,

        "orthanc": orthanc_info,
        "dicom": dicom_info,

        "findings": "외부기관 뇌 MRI 검사 결과, 종양 소견이 관찰됩니다.",
        "impression": "뇌종양 의심, 추가 검사 필요",
        "recommendation": "신경외과 협진 권고",

        "tumorDetected": True,
        "imageResults": [],
        "files": [],
        "_custom": {}
    }


def copy_patient_data_for_external(ocs_id: str, job_type: str, job_role: str) -> bool:
    """
    기존 patient_data에서 랜덤 환자 데이터를 CDSS_STORAGE로 복사
    - LIS: RNA_SEQ → rna 폴더, BIOMARKER → protein 폴더
    - RIS: MRI → mri 폴더
    """
    import shutil
    import json

    # 경로 설정
    base_dir = Path(__file__).resolve().parent.parent.parent  # brain_tumor_dev
    patient_data_dir = base_dir / 'patient_data'
    cdss_storage_dir = base_dir / 'CDSS_STORAGE'

    # patient_data 폴더에서 사용 가능한 환자 목록
    available_patients = [d for d in patient_data_dir.iterdir() if d.is_dir() and d.name.startswith('TCGA-')]
    if not available_patients:
        print(f"    [WARNING] patient_data에 복사할 환자 데이터가 없습니다.")
        return False

    # 랜덤 환자 선택
    source_patient = random.choice(available_patients)

    if job_role == 'LIS':
        target_dir = cdss_storage_dir / 'LIS' / ocs_id
        target_dir.mkdir(parents=True, exist_ok=True)

        if job_type == 'RNA_SEQ':
            # RNA 데이터 복사
            source_rna_dir = source_patient / 'rna'
            if source_rna_dir.exists():
                for file in source_rna_dir.iterdir():
                    if file.suffix in ['.csv', '.json']:
                        shutil.copy2(file, target_dir / file.name)
                # summary에 patient_id 업데이트
                summary_file = target_dir / 'rna_summary.json'
                if summary_file.exists():
                    with open(summary_file, 'r', encoding='utf-8') as f:
                        summary = json.load(f)
                    summary['patient_id'] = source_patient.name
                    summary['source'] = f"external_{source_patient.name}"
                    with open(summary_file, 'w', encoding='utf-8') as f:
                        json.dump(summary, f, indent=2)
                return True

        elif job_type == 'BIOMARKER':
            # Protein 데이터 복사
            source_protein_dir = source_patient / 'protein'
            if source_protein_dir.exists():
                for file in source_protein_dir.iterdir():
                    if file.suffix in ['.csv', '.json']:
                        shutil.copy2(file, target_dir / file.name)
                # summary에 patient_id 업데이트
                summary_file = target_dir / 'protein_summary.json'
                if summary_file.exists():
                    with open(summary_file, 'r', encoding='utf-8') as f:
                        summary = json.load(f)
                    summary['patient_id'] = source_patient.name
                    summary['source'] = f"external_{source_patient.name}"
                    with open(summary_file, 'w', encoding='utf-8') as f:
                        json.dump(summary, f, indent=2)
                return True

    elif job_role == 'RIS':
        # RIS(MRI)는 Orthanc에 업로드되므로 CDSS_STORAGE/RIS에 파일 복사하지 않음
        # worker_result에 가상의 Orthanc 정보만 저장
        return True

    return False


def create_external_ocs_data(force=False):
    """
    외부기관 OCS 더미 데이터 생성
    - LIS 외부 데이터: extr_0001 ~ extr_0010 (RNA_SEQ, BIOMARKER)
    - patient_data에서 실제 파일을 CDSS_STORAGE로 복사

    ※ RIS 외부 데이터(risx_*)는 더 이상 생성하지 않음
      - 외부 환자(is_external=True)의 OCS RIS는 main.py에서 생성
      - sync_orthanc_ocs.py에서 Orthanc 동기화
    """
    print("\n[12단계] 외부기관 OCS 데이터 생성 (LIS만)...")

    from apps.ocs.models import OCS, OCSHistory
    from apps.patients.models import Patient
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 외부기관 데이터 확인
    existing_lis = OCS.objects.filter(ocs_id__startswith='extr_').count()

    if existing_lis >= 5 and not force:
        print(f"[SKIP] 이미 외부기관 OCS 존재 (LIS: {existing_lis}건)")
        return True

    # 외부기관 사용자 찾기
    external_users = list(User.objects.filter(role__code='EXTERNAL'))
    if not external_users:
        print("[WARNING] EXTERNAL 역할 사용자가 없습니다. 첫 번째 DOCTOR 사용자를 사용합니다.")
        external_users = list(User.objects.filter(role__code='DOCTOR')[:1])

    if not external_users:
        print("[ERROR] 사용할 수 있는 사용자가 없습니다.")
        return False

    # 환자 목록
    patients = list(Patient.objects.filter(is_deleted=False)[:20])
    if not patients:
        print("[ERROR] 환자가 없습니다.")
        return False

    now = timezone.now()
    created_lis = 0
    created_ris = 0

    # LIS 외부 데이터 생성 (extr_0001 ~ extr_0010)
    # RNA_SEQ와 BIOMARKER만 사용 (실제 파일이 있는 타입)
    lis_job_types = ['RNA_SEQ', 'BIOMARKER']
    for i in range(10):
        ocs_id = f"extr_{i+1:04d}"
        if OCS.objects.filter(ocs_id=ocs_id).exists():
            continue

        patient = random.choice(patients)
        user = random.choice(external_users)
        # 짝수는 RNA_SEQ, 홀수는 BIOMARKER
        job_type = lis_job_types[i % 2]
        days_ago = random.randint(1, 30)

        try:
            # 파일 복사
            file_copied = copy_patient_data_for_external(ocs_id, job_type, 'LIS')

            with transaction.atomic():
                ocs = OCS.objects.create(
                    ocs_id=ocs_id,
                    patient=patient,
                    doctor=user,
                    worker=None,
                    job_role='LIS',
                    job_type=job_type,
                    ocs_status=random.choice([OCS.OcsStatus.RESULT_READY, OCS.OcsStatus.CONFIRMED]),
                    priority='normal',
                    doctor_request={
                        "_template": "external",
                        "_version": "1.0",
                        "source": "external_upload",
                        "original_filename": f"external_lis_{i+1}.xlsx",
                        "_custom": {}
                    },
                    worker_result=_generate_external_lis_worker_result(
                        job_type=job_type,
                        ocs_id=ocs_id,
                        is_confirmed=random.choice([True, False]),
                    ),
                    attachments={
                        "files": [],
                        "has_data_files": file_copied,
                        "external_source": {
                            "institution": {
                                "name": user.name if user else "외부기관",
                                "code": user.login_id if user else "ext_unknown"
                            },
                            "upload_date": (now - timedelta(days=days_ago)).isoformat()
                        }
                    },
                    accepted_at=now - timedelta(days=days_ago),
                    in_progress_at=now - timedelta(days=days_ago),
                    result_ready_at=now - timedelta(days=days_ago - 1),
                )
                created_lis += 1
                file_status = "✓" if file_copied else "✗"
                print(f"  [+] LIS 외부: {ocs_id} ({job_type}) - {patient.patient_number} [파일:{file_status}]")

        except Exception as e:
            print(f"  [ERROR] {ocs_id}: {e}")

    print(f"\n[OK] 외부기관 OCS 생성 완료")
    print(f"  - LIS 외부 (extr_): {OCS.objects.filter(ocs_id__startswith='extr_').count()}건")
    return True


def ensure_all_patients_have_prescriptions(min_prescriptions_per_patient=1, force=False):
    """
    모든 환자에게 과거 처방 기록이 있도록 보장
    - 각 환자당 최소 min_prescriptions_per_patient건의 처방 기록 생성
    - 완료된 진료에 연결
    """
    print(f"\n[11-1단계] 모든 환자에게 과거 처방 기록 보장 (최소 {min_prescriptions_per_patient}건/환자)...")

    from apps.prescriptions.models import Prescription, PrescriptionItem
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    patients = list(Patient.objects.filter(is_deleted=False, status='active'))
    doctors = list(User.objects.filter(role__code='DOCTOR'))

    if not patients:
        print("[ERROR] 활성 환자가 없습니다.")
        return False

    if not doctors:
        doctors = list(User.objects.all()[:1])

    notes_list = [
        "다음 진료 시 반응 평가 예정",
        "부작용 발생 시 즉시 내원",
        "정기 혈액 검사 필요",
        "복용법 상세 설명 완료",
        "외래 2주 후 재방문 예정",
    ]

    prescription_count = 0
    item_count = 0
    patients_updated = 0

    for patient in patients:
        # 해당 환자의 처방 기록 수 확인
        existing_prescriptions = Prescription.objects.filter(patient=patient).count()

        needed = min_prescriptions_per_patient - existing_prescriptions
        if needed <= 0 and not force:
            continue

        # 환자의 완료된 진료 기록 찾기
        completed_encounters = list(Encounter.objects.filter(
            patient=patient,
            status='completed'
        ).order_by('-admission_date'))

        patients_updated += 1

        for i in range(max(needed, 1) if force else needed):
            doctor = random.choice(doctors)
            encounter = completed_encounters[i] if i < len(completed_encounters) else None
            status = random.choice(['ISSUED', 'DISPENSED'])
            diagnosis = random.choice(DIAGNOSES)

            if encounter:
                days_ago = (timezone.now() - encounter.admission_date).days
            else:
                days_ago = random.randint(30, 180)

            issued_at = timezone.now() - timedelta(days=days_ago)
            dispensed_at = issued_at + timedelta(hours=random.randint(1, 24)) if status == 'DISPENSED' else None

            try:
                with transaction.atomic():
                    prescription = Prescription.objects.create(
                        patient=patient,
                        doctor=doctor,
                        encounter=encounter,
                        status=status,
                        diagnosis=diagnosis,
                        notes=random.choice(notes_list),
                        issued_at=issued_at,
                        dispensed_at=dispensed_at,
                    )

                    # 처방 항목 생성 (1~3개)
                    num_items = random.randint(1, 3)
                    selected_meds = random.sample(MEDICATIONS, min(num_items, len(MEDICATIONS)))

                    for order, med in enumerate(selected_meds):
                        duration = random.choice([7, 14, 28, 30])
                        freq_multiplier = {'QD': 1, 'BID': 2, 'TID': 3, 'QID': 4, 'PRN': 1, 'QOD': 0.5, 'QW': 0.14}
                        daily_count = freq_multiplier.get(med['frequency'], 1)
                        quantity = int(duration * daily_count) + random.randint(0, 5)

                        PrescriptionItem.objects.create(
                            prescription=prescription,
                            medication_name=med['name'],
                            medication_code=med['code'],
                            dosage=med['dosage'],
                            frequency=med['frequency'],
                            route=med['route'],
                            duration_days=duration,
                            quantity=quantity,
                            instructions=med['instructions'],
                            order=order,
                        )
                        item_count += 1

                    prescription_count += 1

            except Exception as e:
                print(f"  오류 ({patient.patient_number}): {e}")

    print(f"[OK] 과거 처방 기록 생성: {prescription_count}건, 항목 {item_count}건 ({patients_updated}명 환자)")
    return True


# ============================================================
# 데이터 리셋 및 요약
# ============================================================

def reset_clinical_data():
    """임상 더미 데이터 삭제"""
    print("\n[RESET] 임상 더미 데이터 삭제 중...")

    from apps.ocs.models import OCS, OCSHistory
    from apps.imaging.models import ImagingStudy
    from apps.encounters.models import Encounter
    from apps.patients.models import Patient, PatientAlert
    from apps.treatment.models import TreatmentPlan, TreatmentSession
    from apps.followup.models import FollowUp
    from apps.prescriptions.models import Prescription, PrescriptionItem

    # 삭제 순서: 의존성 역순
    # 처방 삭제
    prescription_item_count = PrescriptionItem.objects.count()
    PrescriptionItem.objects.all().delete()
    print(f"  PrescriptionItem: {prescription_item_count}건 삭제")

    prescription_count = Prescription.objects.count()
    Prescription.objects.all().delete()
    print(f"  Prescription: {prescription_count}건 삭제")

    # 치료 세션/계획 삭제
    treatment_session_count = TreatmentSession.objects.count()
    TreatmentSession.objects.all().delete()
    print(f"  TreatmentSession: {treatment_session_count}건 삭제")

    treatment_plan_count = TreatmentPlan.objects.count()
    TreatmentPlan.objects.all().delete()
    print(f"  TreatmentPlan: {treatment_plan_count}건 삭제")

    # 경과 기록 삭제
    followup_count = FollowUp.objects.count()
    FollowUp.objects.all().delete()
    print(f"  FollowUp: {followup_count}건 삭제")

    # 환자 주의사항 삭제
    patient_alert_count = PatientAlert.objects.count()
    PatientAlert.objects.all().delete()
    print(f"  PatientAlert: {patient_alert_count}건 삭제")

    # OCS 관련 삭제
    ocs_history_count = OCSHistory.objects.count()
    OCSHistory.objects.all().delete()
    print(f"  OCSHistory: {ocs_history_count}건 삭제")

    imaging_count = ImagingStudy.objects.count()
    ImagingStudy.objects.all().delete()
    print(f"  ImagingStudy: {imaging_count}건 삭제")

    ocs_count = OCS.objects.count()
    OCS.objects.all().delete()
    print(f"  OCS: {ocs_count}건 삭제")

    encounter_count = Encounter.objects.count()
    Encounter.objects.all().delete()
    print(f"  Encounter: {encounter_count}건 삭제")

    patient_count = Patient.objects.count()
    Patient.objects.all().delete()
    print(f"  Patient: {patient_count}건 삭제")

    print("[OK] 임상 더미 데이터 삭제 완료")


def print_summary():
    """임상 더미 데이터 요약"""
    print("\n" + "="*60)
    print("임상 더미 데이터 생성 완료! (2/3)")
    print("="*60)

    from apps.patients.models import Patient, PatientAlert
    from apps.encounters.models import Encounter
    from apps.imaging.models import ImagingStudy
    from apps.ocs.models import OCS
    from apps.treatment.models import TreatmentPlan, TreatmentSession
    from apps.followup.models import FollowUp
    from apps.prescriptions.models import Prescription, PrescriptionItem, Medication

    print(f"\n[통계 - 임상 데이터]")
    print(f"  - 환자: {Patient.objects.filter(is_deleted=False).count()}명")
    print(f"  - 환자 주의사항: {PatientAlert.objects.count()}건")
    print(f"  - 진료: {Encounter.objects.count()}건")
    print(f"  - OCS (RIS/MRI): {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  - OCS (LIS/RNA_SEQ): {OCS.objects.filter(job_role='LIS', job_type='RNA_SEQ').count()}건")
    print(f"  - OCS (LIS/BIOMARKER): {OCS.objects.filter(job_role='LIS', job_type='BIOMARKER').count()}건")
    print(f"  - OCS 외부기관 LIS (extr_): {OCS.objects.filter(ocs_id__startswith='extr_').count()}건")
    print(f"  - 영상 검사: {ImagingStudy.objects.count()}건")
    print(f"  - 치료 계획: {TreatmentPlan.objects.count()}건")
    print(f"  - 치료 세션: {TreatmentSession.objects.count()}건")
    print(f"  - 경과 기록: {FollowUp.objects.count()}건")
    print(f"  - 의약품 마스터: {Medication.objects.filter(is_active=True).count()}개")
    print(f"  - 처방전: {Prescription.objects.count()}건")
    print(f"  - 처방 항목: {PrescriptionItem.objects.count()}건")

    print(f"\n[OCS 동일 환자 매핑]")
    print(f"  ※ P202600001~P202600015 환자에게 MRI, RNA_SEQ, BIOMARKER 각각 1건씩 생성")
    print(f"  ※ 환자데이터 폴더(15개)와 1:1 매핑됨")

    print(f"\n[다음 단계]")
    print(f"  확장 데이터 생성:")
    print(f"    python setup_dummy_data_3_extended.py")
    print(f"")
    print(f"  또는 서버 실행:")
    print(f"    python manage.py runserver")
    print(f"")
    print(f"  테스트 계정:")
    print(f"    system / system001 (시스템 관리자)")
    print(f"    admin / admin001 (병원 관리자)")
    print(f"    doctor1~10 / doctor1001~10001 (의사)")
    print(f"    nurse1~3 / nurse1001~3001 (간호사)")
    print(f"    patient1~5 / patient1001~5001 (환자)")
    print(f"    ris1~3 / ris1001~3001 (영상과)")
    print(f"    lis1~3 / lis1001~3001 (검사과)")


def main():
    """메인 실행 함수"""
    # 명령줄 인자 파싱
    parser = argparse.ArgumentParser(description='Brain Tumor CDSS 임상 더미 데이터 생성')
    parser.add_argument('--reset', action='store_true', help='임상 데이터 삭제 후 새로 생성')
    parser.add_argument('--force', action='store_true', help='목표 수량 이상이어도 강제 추가')
    parser.add_argument('-y', '--yes', action='store_true', help='확인 없이 자동 실행 (비대화형 모드)')
    args = parser.parse_args()

    print("="*60)
    print("Brain Tumor CDSS - 임상 더미 데이터 생성 (2/3)")
    print("="*60)

    # 선행 조건 확인
    if not check_prerequisites():
        sys.exit(1)

    # --reset 옵션: 임상 데이터만 삭제
    if args.reset:
        if args.yes:
            reset_clinical_data()
        else:
            confirm = input("\n임상 데이터(환자, 진료, OCS, 치료, 경과, 처방)를 삭제하시겠습니까? (yes/no): ")
            if confirm.lower() == 'yes':
                reset_clinical_data()
            else:
                print("삭제 취소됨")
                sys.exit(0)

    force = args.reset or args.force  # reset 시에는 force=True

    # ===== 환자 / 진료 / OCS =====
    # 환자 생성
    create_dummy_patients(50, force=force)

    # 진료 생성
    create_dummy_encounters(20, force=force)

    # 모든 환자에게 과거 진료 기록 보장 (SOAP 포함)
    ensure_all_patients_have_encounters(min_encounters_per_patient=2, force=force)

    # 영상 검사 (OCS + ImagingStudy) - 환자데이터 폴더 15개 기준
    create_dummy_imaging_with_ocs(15, force=force)

    # 검사 오더 (LIS) - RNA_SEQ 15건 + BIOMARKER 15건 = 30건 (동일 환자)
    create_dummy_lis_orders(30, force=force)

    # 추가 OCS 15건 (ORDERED 상태) - 총 60건 맞추기
    create_additional_ocs_orders(15, force=force)

    # AI 모델
    create_ai_models()

    # 환자 주의사항
    create_patient_alerts(force=force)

    # 환자 계정 연결
    link_patient_user_account()

    # ===== 치료 / 경과 =====
    # 치료 계획
    create_dummy_treatment_plans(15, force=force)

    # 경과 추적
    create_dummy_followups(25, force=force)

    # AI 추론 요청은 더미 데이터로 생성하지 않음 (실제 사용자 요청 시 생성)

    # ===== 처방 =====
    # 의약품 마스터 데이터 (클릭 처방용)
    create_dummy_medications(force=force)

    # 처방 데이터
    create_dummy_prescriptions(20, 3, force=force)

    # 모든 환자에게 과거 처방 기록 보장
    ensure_all_patients_have_prescriptions(min_prescriptions_per_patient=1, force=force)

    # ===== 외부기관 OCS =====
    # 외부기관 OCS 더미 데이터 (extr_, risx_ prefix)
    create_external_ocs_data(force=force)

    # 요약 출력
    print_summary()


if __name__ == '__main__':
    main()
