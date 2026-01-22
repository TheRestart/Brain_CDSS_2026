"""
뇌종양 치료 관련 의약품 더미 데이터 생성 스크립트
"""
import os
import sys
import django

# Django 설정
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
django.setup()

from apps.prescriptions.models import Medication


def create_medications():
    medications = [
        # 진통제 (ANALGESIC)
        {
            'code': 'MED001',
            'name': '타이레놀정 500mg',
            'generic_name': 'Acetaminophen',
            'category': 'ANALGESIC',
            'default_dosage': '500mg',
            'default_route': 'PO',
            'default_frequency': 'TID',
            'default_duration_days': 7,
            'unit': '정',
            'warnings': '간질환자 주의',
            'contraindications': '중증 간장애'
        },
        {
            'code': 'MED002',
            'name': '트라마돌캡슐 50mg',
            'generic_name': 'Tramadol',
            'category': 'ANALGESIC',
            'default_dosage': '50mg',
            'default_route': 'PO',
            'default_frequency': 'TID',
            'default_duration_days': 7,
            'unit': '캡슐',
            'warnings': '졸음 유발 가능',
            'contraindications': 'MAO억제제 복용자'
        },
        {
            'code': 'MED003',
            'name': '펜타닐패치 25mcg/hr',
            'generic_name': 'Fentanyl',
            'category': 'ANALGESIC',
            'default_dosage': '25mcg/hr',
            'default_route': 'TOPICAL',
            'default_frequency': 'QOD',
            'default_duration_days': 14,
            'unit': '패치',
            'warnings': '72시간마다 교체',
            'contraindications': '호흡억제 환자'
        },

        # 항경련제 (ANTIEPILEPTIC)
        {
            'code': 'MED010',
            'name': '케프라정 500mg',
            'generic_name': 'Levetiracetam',
            'category': 'ANTIEPILEPTIC',
            'default_dosage': '500mg',
            'default_route': 'PO',
            'default_frequency': 'BID',
            'default_duration_days': 30,
            'unit': '정',
            'warnings': '서서히 감량 필요',
            'contraindications': None
        },
        {
            'code': 'MED011',
            'name': '디라넥스정 200mg',
            'generic_name': 'Phenytoin',
            'category': 'ANTIEPILEPTIC',
            'default_dosage': '200mg',
            'default_route': 'PO',
            'default_frequency': 'BID',
            'default_duration_days': 30,
            'unit': '정',
            'warnings': '잇몸비대 가능',
            'contraindications': '심차단 환자'
        },
        {
            'code': 'MED012',
            'name': '데파코트정 250mg',
            'generic_name': 'Valproate',
            'category': 'ANTIEPILEPTIC',
            'default_dosage': '250mg',
            'default_route': 'PO',
            'default_frequency': 'TID',
            'default_duration_days': 30,
            'unit': '정',
            'warnings': '간기능 모니터링 필요',
            'contraindications': '간질환자'
        },

        # 스테로이드 (STEROID) - 뇌부종 조절
        {
            'code': 'MED020',
            'name': '덱사메타손정 0.5mg',
            'generic_name': 'Dexamethasone',
            'category': 'STEROID',
            'default_dosage': '4mg',
            'default_route': 'PO',
            'default_frequency': 'BID',
            'default_duration_days': 7,
            'unit': '정',
            'warnings': '서서히 감량 필요, 혈당상승',
            'contraindications': '전신 진균감염'
        },
        {
            'code': 'MED021',
            'name': '솔루메드롤주 125mg',
            'generic_name': 'Methylprednisolone',
            'category': 'STEROID',
            'default_dosage': '125mg',
            'default_route': 'IV',
            'default_frequency': 'QD',
            'default_duration_days': 5,
            'unit': '바이알',
            'warnings': '급속주입 금지',
            'contraindications': '전신 진균감염'
        },

        # 항암제 (CHEMOTHERAPY) - 뇌종양 치료
        {
            'code': 'MED030',
            'name': '테모달캡슐 100mg',
            'generic_name': 'Temozolomide',
            'category': 'CHEMOTHERAPY',
            'default_dosage': '150mg/m2',
            'default_route': 'PO',
            'default_frequency': 'QD',
            'default_duration_days': 5,
            'unit': '캡슐',
            'warnings': '공복 투여, 골수억제 주의',
            'contraindications': '중증 골수억제'
        },
        {
            'code': 'MED031',
            'name': '아바스틴주 100mg',
            'generic_name': 'Bevacizumab',
            'category': 'CHEMOTHERAPY',
            'default_dosage': '10mg/kg',
            'default_route': 'IV',
            'default_frequency': 'QW',
            'default_duration_days': 14,
            'unit': '바이알',
            'warnings': '출혈 위험 모니터링',
            'contraindications': '최근 수술환자'
        },
        {
            'code': 'MED032',
            'name': '글리아델웨이퍼',
            'generic_name': 'Carmustine',
            'category': 'CHEMOTHERAPY',
            'default_dosage': '7.7mg',
            'default_route': 'OTHER',
            'default_frequency': 'QD',
            'default_duration_days': 1,
            'unit': '웨이퍼',
            'warnings': '수술 중 삽입',
            'contraindications': None
        },
        {
            'code': 'MED033',
            'name': '로무스틴캡슐 40mg',
            'generic_name': 'Lomustine',
            'category': 'CHEMOTHERAPY',
            'default_dosage': '110mg/m2',
            'default_route': 'PO',
            'default_frequency': 'QD',
            'default_duration_days': 1,
            'unit': '캡슐',
            'warnings': '6주마다 투여, 공복 복용',
            'contraindications': '중증 골수억제'
        },

        # 항구토제 (ANTIEMETIC)
        {
            'code': 'MED040',
            'name': '조프란정 8mg',
            'generic_name': 'Ondansetron',
            'category': 'ANTIEMETIC',
            'default_dosage': '8mg',
            'default_route': 'PO',
            'default_frequency': 'BID',
            'default_duration_days': 5,
            'unit': '정',
            'warnings': 'QT연장 주의',
            'contraindications': 'QT연장 환자'
        },
        {
            'code': 'MED041',
            'name': '나제아주 0.3mg',
            'generic_name': 'Ramosetron',
            'category': 'ANTIEMETIC',
            'default_dosage': '0.3mg',
            'default_route': 'IV',
            'default_frequency': 'QD',
            'default_duration_days': 3,
            'unit': '앰플',
            'warnings': None,
            'contraindications': None
        },
        {
            'code': 'MED042',
            'name': '맥소론정 10mg',
            'generic_name': 'Metoclopramide',
            'category': 'ANTIEMETIC',
            'default_dosage': '10mg',
            'default_route': 'PO',
            'default_frequency': 'TID',
            'default_duration_days': 5,
            'unit': '정',
            'warnings': '추체외로증상 주의',
            'contraindications': '장폐색'
        },

        # 이뇨제 (DIURETIC) - 뇌부종 조절
        {
            'code': 'MED050',
            'name': '만니톨주 20%',
            'generic_name': 'Mannitol',
            'category': 'DIURETIC',
            'default_dosage': '100ml',
            'default_route': 'IV',
            'default_frequency': 'QID',
            'default_duration_days': 5,
            'unit': 'ml',
            'warnings': '신기능 모니터링, 전해질 확인',
            'contraindications': '무뇨증'
        },
        {
            'code': 'MED051',
            'name': '라식스정 40mg',
            'generic_name': 'Furosemide',
            'category': 'DIURETIC',
            'default_dosage': '40mg',
            'default_route': 'PO',
            'default_frequency': 'QD',
            'default_duration_days': 7,
            'unit': '정',
            'warnings': '전해질 불균형 주의',
            'contraindications': '무뇨증'
        },
        {
            'code': 'MED052',
            'name': '글리세올주',
            'generic_name': 'Glycerol',
            'category': 'DIURETIC',
            'default_dosage': '200ml',
            'default_route': 'IV',
            'default_frequency': 'BID',
            'default_duration_days': 5,
            'unit': 'ml',
            'warnings': '당뇨환자 혈당 모니터링',
            'contraindications': '당뇨병성 케톤산증'
        },

        # 항응고제 (ANTICOAGULANT) - DVT 예방
        {
            'code': 'MED060',
            'name': '헤파린주 5000IU',
            'generic_name': 'Heparin',
            'category': 'ANTICOAGULANT',
            'default_dosage': '5000IU',
            'default_route': 'SC',
            'default_frequency': 'BID',
            'default_duration_days': 7,
            'unit': 'IU',
            'warnings': '출혈 모니터링',
            'contraindications': '활동성 출혈'
        },
        {
            'code': 'MED061',
            'name': '클렉산주 40mg',
            'generic_name': 'Enoxaparin',
            'category': 'ANTICOAGULANT',
            'default_dosage': '40mg',
            'default_route': 'SC',
            'default_frequency': 'QD',
            'default_duration_days': 7,
            'unit': '프리필드시린지',
            'warnings': '신기능장애시 용량조절',
            'contraindications': '활동성 출혈'
        },

        # 진정제 (SEDATIVE)
        {
            'code': 'MED070',
            'name': '미다졸람주 5mg',
            'generic_name': 'Midazolam',
            'category': 'SEDATIVE',
            'default_dosage': '2.5mg',
            'default_route': 'IV',
            'default_frequency': 'PRN',
            'default_duration_days': 3,
            'unit': '앰플',
            'warnings': '호흡억제 모니터링',
            'contraindications': '중증 호흡부전'
        },
        {
            'code': 'MED071',
            'name': '할시온정 0.25mg',
            'generic_name': 'Triazolam',
            'category': 'SEDATIVE',
            'default_dosage': '0.25mg',
            'default_route': 'PO',
            'default_frequency': 'QD',
            'default_duration_days': 7,
            'unit': '정',
            'warnings': '취침 전 복용',
            'contraindications': '수면무호흡증'
        },
        {
            'code': 'MED072',
            'name': '스틸녹스정 10mg',
            'generic_name': 'Zolpidem',
            'category': 'SEDATIVE',
            'default_dosage': '10mg',
            'default_route': 'PO',
            'default_frequency': 'QD',
            'default_duration_days': 7,
            'unit': '정',
            'warnings': '취침 직전 복용, 이상행동 주의',
            'contraindications': '중증 간장애'
        },

        # 항생제 (ANTIBIOTIC) - 수술 후 감염예방
        {
            'code': 'MED080',
            'name': '세파졸린주 1g',
            'generic_name': 'Cefazolin',
            'category': 'ANTIBIOTIC',
            'default_dosage': '1g',
            'default_route': 'IV',
            'default_frequency': 'TID',
            'default_duration_days': 5,
            'unit': '바이알',
            'warnings': '세팔로스포린 과민반응 주의',
            'contraindications': '세팔로스포린 알레르기'
        },
        {
            'code': 'MED081',
            'name': '반코마이신주 1g',
            'generic_name': 'Vancomycin',
            'category': 'ANTIBIOTIC',
            'default_dosage': '1g',
            'default_route': 'IV',
            'default_frequency': 'BID',
            'default_duration_days': 7,
            'unit': '바이알',
            'warnings': 'Red man syndrome 주의, 서서히 주입',
            'contraindications': '반코마이신 알레르기'
        },
        {
            'code': 'MED082',
            'name': '세프트리악손주 1g',
            'generic_name': 'Ceftriaxone',
            'category': 'ANTIBIOTIC',
            'default_dosage': '2g',
            'default_route': 'IV',
            'default_frequency': 'QD',
            'default_duration_days': 7,
            'unit': '바이알',
            'warnings': '칼슘 함유 수액과 혼합 금지',
            'contraindications': '세팔로스포린 알레르기'
        },
    ]

    created_count = 0
    for med_data in medications:
        med, created = Medication.objects.get_or_create(
            code=med_data['code'],
            defaults=med_data
        )
        if created:
            created_count += 1
            print(f'Created: {med.code} - {med.name}')
        else:
            print(f'Already exists: {med.code} - {med.name}')

    print(f'\n총 {created_count}개 새로 등록, 총 {Medication.objects.count()}개 의약품')


if __name__ == '__main__':
    create_medications()
