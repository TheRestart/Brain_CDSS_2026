#!/usr/bin/env python
"""
Brain Tumor CDSS - 더미 데이터 설정 스크립트 (1/3) - 기본 데이터

이 스크립트는 시스템 기본 데이터를 생성합니다:
- DB 자동 생성 (없는 경우)
- 마이그레이션 자동 실행
- 역할 7개 (SYSTEMMANAGER, ADMIN, DOCTOR, NURSE, PATIENT, RIS, LIS)
- 슈퍼유저 (system/system001)
- 테스트 사용자 10명
- 메뉴/권한 시드 데이터

사용법:
    python setup_dummy_data_1_base.py          # 기존 데이터 유지, 부족분만 추가
    python setup_dummy_data_1_base.py --reset  # 기존 데이터 삭제 후 새로 생성
    python setup_dummy_data_1_base.py --menu   # 메뉴/권한만 업데이트

다음 단계:
    python setup_dummy_data_2_clinical.py  # 임상 데이터 (환자, 진료, OCS, 치료, 경과, 처방)
    python setup_dummy_data_3_extended.py  # 확장 데이터 (오늘 진료, 대량 데이터, 스케줄)
"""

import os
import sys
import subprocess
from pathlib import Path
from datetime import timedelta
import random
import argparse

# 프로젝트 루트 디렉토리로 이동 (상위 폴더)
PROJECT_ROOT = Path(__file__).resolve().parent.parent
os.chdir(PROJECT_ROOT)


def create_database_if_not_exists():
    """데이터베이스가 없으면 생성 (Django 초기화 전에 실행)"""
    print("\n[0단계] 데이터베이스 존재 확인...")

    from dotenv import load_dotenv
    import environ

    env_path = PROJECT_ROOT / '.env'
    load_dotenv(env_path)

    env = environ.Env()

    db_name = env('MYSQL_DB', default='brain_tumor')
    db_user = env('MYSQL_USER', default='root')
    db_password = env('MYSQL_PASSWORD', default='')
    db_host = env('MYSQL_HOST', default='localhost')
    db_port = env('MYSQL_PORT', default='3306')

    try:
        import pymysql
    except ImportError:
        print("[WARNING] pymysql이 설치되지 않았습니다.")
        print("  pip install pymysql")
        return False

    try:
        # DB 없이 MySQL 서버에 연결
        conn = pymysql.connect(
            host=db_host,
            port=int(db_port),
            user=db_user,
            password=db_password,
            charset='utf8mb4'
        )

        cursor = conn.cursor()

        # DB 존재 확인
        cursor.execute(f"SHOW DATABASES LIKE '{db_name}'")
        result = cursor.fetchone()

        if result:
            print(f"[OK] 데이터베이스 '{db_name}' 이미 존재")
        else:
            # DB 생성
            print(f"[INFO] 데이터베이스 '{db_name}' 생성 중...")
            cursor.execute(f"CREATE DATABASE `{db_name}` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci")
            conn.commit()
            print(f"[OK] 데이터베이스 '{db_name}' 생성 완료")

        cursor.close()
        conn.close()
        return True

    except pymysql.Error as e:
        print(f"[ERROR] MySQL 연결 실패: {e}")
        print(f"  Host: {db_host}:{db_port}")
        print(f"  User: {db_user}")
        print("  MySQL 서버가 실행 중인지 확인하세요.")
        return False


def run_migrations():
    """마이그레이션 생성 및 실행"""
    print("\n[1단계] 마이그레이션 실행...")

    # 마이그레이션 파일 생성 (makemigrations) - --skip-checks로 URL 체크 건너뛰기
    try:
        print("  makemigrations 실행 중...")
        result = subprocess.run(
            [sys.executable, 'manage.py', 'makemigrations', '--skip-checks'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            if 'No changes detected' in result.stdout:
                print("  [OK] 변경사항 없음")
            else:
                print("  [OK] 마이그레이션 파일 생성 완료")
                if result.stdout:
                    # 생성된 마이그레이션 파일 출력
                    for line in result.stdout.strip().split('\n'):
                        if line.strip():
                            print(f"    {line}")
        else:
            print(f"  [WARNING] makemigrations 실패 - 계속 진행합니다")
            if result.stderr:
                print(f"    {result.stderr[:300]}")
    except Exception as e:
        print(f"  [WARNING] makemigrations 실행 실패: {e}")

    # 마이그레이션 적용 (migrate) - --skip-checks로 URL 체크 건너뛰기
    try:
        print("  migrate 실행 중...")
        result = subprocess.run(
            [sys.executable, 'manage.py', 'migrate', '--no-input', '--skip-checks'],
            cwd=str(PROJECT_ROOT),
            capture_output=True,
            text=True
        )
        if result.returncode == 0:
            print("[OK] 마이그레이션 완료")
            return True
        else:
            print(f"[ERROR] 마이그레이션 실패")
            if result.stderr:
                print(result.stderr[:500])
            return False
    except Exception as e:
        print(f"[ERROR] 마이그레이션 실행 실패: {e}")
        return False


# DB 생성 및 마이그레이션 (Django 초기화 전)
if __name__ == '__main__' or True:  # import 시에도 실행
    if not create_database_if_not_exists():
        print("[WARNING] DB 자동 생성 실패 - 계속 진행합니다.")

    if not run_migrations():
        print("[WARNING] 마이그레이션 실패 - 계속 진행합니다.")

# Django 설정 (DB 생성 후)
sys.path.insert(0, str(PROJECT_ROOT))
os.environ.setdefault('DJANGO_SETTINGS_MODULE', 'config.settings')
import django
django.setup()

from django.utils import timezone
from django.db import IntegrityError, transaction


def setup_roles():
    """기본 역할 생성"""
    print("\n[1단계] 기본 역할 설정...")

    from apps.accounts.models import Role

    roles = [
        ('SYSTEMMANAGER', 'System Manager', '시스템 관리자'),
        ('ADMIN', 'Admin', '병원 관리자'),
        ('DOCTOR', 'Doctor', '의사'),
        ('NURSE', 'Nurse', '간호사'),
        ('PATIENT', 'Patient', '환자'),
        ('RIS', 'RIS', '영상과'),
        ('LIS', 'LIS', '검사과'),
        ('EXTERNAL', 'External', '외부기관'),
    ]

    created_count = 0
    for code, name, description in roles:
        role, created = Role.objects.get_or_create(
            code=code,
            defaults={'name': name, 'description': description, 'is_active': True}
        )
        if created:
            created_count += 1
            print(f"  생성: {code}")
        else:
            print(f"  존재: {code}")

    print(f"[OK] 역할 설정 완료 ({created_count}개 생성)")
    return True


def setup_superuser():
    """슈퍼유저 생성"""
    print("\n[2단계] 슈퍼유저 확인...")

    from django.contrib.auth import get_user_model
    from apps.accounts.models import Role

    User = get_user_model()

    if User.objects.filter(is_superuser=True).exists():
        superuser = User.objects.filter(is_superuser=True).first()
        print(f"[OK] 슈퍼유저 이미 존재: {superuser.login_id}")
        return True

    print("슈퍼유저가 없습니다. 기본 슈퍼유저를 생성합니다.")

    # Role 가져오기
    system_role = Role.objects.filter(code='SYSTEMMANAGER').first()

    try:
        superuser = User(
            login_id='system',
            name='시스템관리자',
            is_superuser=True,
            is_staff=True,
            is_active=True,
            role=system_role
        )
        superuser.set_password('system001')
        superuser.save()
        print(f"[OK] 슈퍼유저 생성: system / system001")
        return True
    except Exception as e:
        print(f"[ERROR] 슈퍼유저 생성 실패: {e}")
        return False


def setup_test_users():
    """테스트 사용자 생성 (UserProfile 포함)"""
    print("\n[3단계] 테스트 사용자 설정...")

    from django.contrib.auth import get_user_model
    from apps.accounts.models import Role, UserProfile
    from datetime import date

    User = get_user_model()

    # (login_id, password, name, email, role_code, is_staff, profile_data)
    # 비밀번호 규칙: {login_id}001 (예: admin → admin001, doctor1 → doctor1001)
    test_users = [
        ('admin', 'admin001', '병원관리자', 'admin@neuronova.hospital', 'ADMIN', True, {
            'birthDate': date(1975, 3, 15),
            'phoneMobile': '010-1234-0001',
            'phoneOffice': '02-1234-1001',
            'hireDate': date(2010, 1, 1),
            'departmentId': 1,
            'title': '병원 관리자',
        }),
        ('doctor1', 'doctor1001', '김철수', 'doctor1@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1978, 5, 20),
            'phoneMobile': '010-2345-1001',
            'phoneOffice': '02-1234-2001',
            'hireDate': date(2015, 3, 1),
            'departmentId': 10,
            'title': '신경외과 전문의',
        }),
        ('doctor2', 'doctor2001', '이영희', 'doctor2@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1982, 8, 12),
            'phoneMobile': '010-3456-2001',
            'phoneOffice': '02-1234-2002',
            'hireDate': date(2018, 6, 15),
            'departmentId': 10,
            'title': '신경외과 부교수',
        }),
        ('doctor3', 'doctor3001', '박민수', 'doctor3@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1985, 11, 8),
            'phoneMobile': '010-4567-3001',
            'phoneOffice': '02-1234-2003',
            'hireDate': date(2020, 2, 1),
            'departmentId': 11,
            'title': '신경과 전문의',
        }),
        ('doctor4', 'doctor4001', '최지은', 'doctor4@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1988, 2, 25),
            'phoneMobile': '010-5678-4001',
            'phoneOffice': '02-1234-2004',
            'hireDate': date(2021, 9, 1),
            'departmentId': 12,
            'title': '영상의학과 전문의',
        }),
        ('doctor5', 'doctor5001', '정현우', 'doctor5@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1990, 7, 3),
            'phoneMobile': '010-6789-5001',
            'phoneOffice': '02-1234-2005',
            'hireDate': date(2022, 3, 1),
            'departmentId': 10,
            'title': '신경외과 레지던트 4년차',
        }),
        ('doctor6', 'doctor6001', '한소영', 'doctor6@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1983, 9, 14),
            'phoneMobile': '010-6789-6001',
            'phoneOffice': '02-1234-2006',
            'hireDate': date(2016, 7, 1),
            'departmentId': 11,
            'title': '신경과 부교수',
        }),
        ('doctor7', 'doctor7001', '오준혁', 'doctor7@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1979, 12, 5),
            'phoneMobile': '010-6789-7001',
            'phoneOffice': '02-1234-2007',
            'hireDate': date(2012, 4, 1),
            'departmentId': 10,
            'title': '신경외과 교수',
        }),
        ('doctor8', 'doctor8001', '윤서연', 'doctor8@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1987, 4, 22),
            'phoneMobile': '010-6789-8001',
            'phoneOffice': '02-1234-2008',
            'hireDate': date(2019, 11, 1),
            'departmentId': 12,
            'title': '영상의학과 전문의',
        }),
        ('doctor9', 'doctor9001', '임재현', 'doctor9@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1991, 6, 30),
            'phoneMobile': '010-6789-9001',
            'phoneOffice': '02-1234-2009',
            'hireDate': date(2023, 1, 1),
            'departmentId': 10,
            'title': '신경외과 레지던트 2년차',
        }),
        ('doctor10', 'doctor10001', '서민지', 'doctor10@neuronova.hospital', 'DOCTOR', False, {
            'birthDate': date(1986, 10, 17),
            'phoneMobile': '010-6789-0001',
            'phoneOffice': '02-1234-2010',
            'hireDate': date(2017, 8, 1),
            'departmentId': 11,
            'title': '신경과 전문의',
        }),
        ('nurse1', 'nurse1001', '홍수진', 'nurse1@neuronova.hospital', 'NURSE', False, {
            'birthDate': date(1992, 4, 18),
            'phoneMobile': '010-7890-6001',
            'phoneOffice': '02-1234-3001',
            'hireDate': date(2019, 5, 1),
            'departmentId': 20,
            'title': '신경외과 병동 수간호사',
        }),
        ('nurse2', 'nurse2001', '김미영', 'nurse2@neuronova.hospital', 'NURSE', False, {
            'birthDate': date(1994, 7, 12),
            'phoneMobile': '010-7890-6002',
            'phoneOffice': '02-1234-3002',
            'hireDate': date(2020, 3, 1),
            'departmentId': 20,
            'title': '신경외과 병동 간호사',
        }),
        ('nurse3', 'nurse3001', '박지현', 'nurse3@neuronova.hospital', 'NURSE', False, {
            'birthDate': date(1996, 11, 25),
            'phoneMobile': '010-7890-6003',
            'phoneOffice': '02-1234-3003',
            'hireDate': date(2021, 9, 1),
            'departmentId': 21,
            'title': '신경과 외래 간호사',
        }),
        # PATIENT 역할 사용자 (5명) - 환자 테이블과 연결됨
        ('patient1', 'patient1001', '김동현', 'patient1@example.com', 'PATIENT', False, {
            'birthDate': date(1981, 1, 15),
            'phoneMobile': '010-1234-5678',
            'phoneOffice': None,
            'hireDate': None,
            'departmentId': None,
            'title': None,
        }),
        ('patient2', 'patient2001', '이수정', 'patient2@example.com', 'PATIENT', False, {
            'birthDate': date(1988, 3, 20),
            'phoneMobile': '010-2345-6789',
            'phoneOffice': None,
            'hireDate': None,
            'departmentId': None,
            'title': None,
        }),
        ('patient3', 'patient3001', '박정훈', 'patient3@example.com', 'PATIENT', False, {
            'birthDate': date(1974, 5, 8),
            'phoneMobile': '010-3456-7890',
            'phoneOffice': None,
            'hireDate': None,
            'departmentId': None,
            'title': None,
        }),
        ('patient4', 'patient4001', '최민정', 'patient4@example.com', 'PATIENT', False, {
            'birthDate': date(1997, 6, 25),
            'phoneMobile': '010-4567-8901',
            'phoneOffice': None,
            'hireDate': None,
            'departmentId': None,
            'title': None,
        }),
        ('patient5', 'patient5001', '정승호', 'patient5@example.com', 'PATIENT', False, {
            'birthDate': date(1965, 9, 12),
            'phoneMobile': '010-5678-9012',
            'phoneOffice': None,
            'hireDate': None,
            'departmentId': None,
            'title': None,
        }),
        ('ris1', 'ris1001', '강민호', 'ris1@neuronova.hospital', 'RIS', False, {
            'birthDate': date(1987, 6, 22),
            'phoneMobile': '010-9012-8001',
            'phoneOffice': '02-1234-4001',
            'hireDate': date(2017, 8, 1),
            'departmentId': 30,
            'title': '영상의학과 방사선사',
        }),
        ('ris2', 'ris2001', '이준혁', 'ris2@neuronova.hospital', 'RIS', False, {
            'birthDate': date(1990, 3, 15),
            'phoneMobile': '010-9012-8002',
            'phoneOffice': '02-1234-4002',
            'hireDate': date(2019, 6, 1),
            'departmentId': 30,
            'title': '영상의학과 방사선사',
        }),
        ('ris3', 'ris3001', '최수빈', 'ris3@neuronova.hospital', 'RIS', False, {
            'birthDate': date(1993, 8, 28),
            'phoneMobile': '010-9012-8003',
            'phoneOffice': '02-1234-4003',
            'hireDate': date(2021, 2, 1),
            'departmentId': 30,
            'title': '영상의학과 방사선사',
        }),
        ('lis1', 'lis1001', '윤서연', 'lis1@neuronova.hospital', 'LIS', False, {
            'birthDate': date(1991, 12, 5),
            'phoneMobile': '010-0123-9001',
            'phoneOffice': '02-1234-5001',
            'hireDate': date(2020, 4, 15),
            'departmentId': 31,
            'title': '진단검사의학과 임상병리사',
        }),
        ('lis2', 'lis2001', '정다은', 'lis2@neuronova.hospital', 'LIS', False, {
            'birthDate': date(1989, 5, 10),
            'phoneMobile': '010-0123-9002',
            'phoneOffice': '02-1234-5002',
            'hireDate': date(2018, 9, 1),
            'departmentId': 31,
            'title': '진단검사의학과 임상병리사',
        }),
        ('lis3', 'lis3001', '한승우', 'lis3@neuronova.hospital', 'LIS', False, {
            'birthDate': date(1995, 1, 20),
            'phoneMobile': '010-0123-9003',
            'phoneOffice': '02-1234-5003',
            'hireDate': date(2022, 1, 1),
            'departmentId': 31,
            'title': '진단검사의학과 임상병리사',
        }),
        # EXTERNAL 역할 사용자 (외부기관) - 외부 영상의학과, 검진센터 등
        ('ext_snuh', 'ext_snuh001', '서울대학교병원', 'contact@snuh.org', 'EXTERNAL', False, {
            'birthDate': None,
            'phoneMobile': '02-2072-2114',
            'phoneOffice': '02-2072-2114',
            'hireDate': None,
            'departmentId': None,
            'title': '외부기관 - 서울대학교병원',
        }),
        ('ext_amc', 'ext_amc001', '서울아산병원', 'contact@amc.seoul.kr', 'EXTERNAL', False, {
            'birthDate': None,
            'phoneMobile': '1688-7575',
            'phoneOffice': '02-3010-3114',
            'hireDate': None,
            'departmentId': None,
            'title': '외부기관 - 서울아산병원',
        }),
        ('ext_smc', 'ext_smc001', '삼성서울병원', 'contact@samsung.com', 'EXTERNAL', False, {
            'birthDate': None,
            'phoneMobile': '1599-3114',
            'phoneOffice': '02-3410-2114',
            'hireDate': None,
            'departmentId': None,
            'title': '외부기관 - 삼성서울병원',
        }),
        ('ext_yuhs', 'ext_yuhs001', '세브란스병원', 'contact@yuhs.ac', 'EXTERNAL', False, {
            'birthDate': None,
            'phoneMobile': '1599-1004',
            'phoneOffice': '02-2228-0114',
            'hireDate': None,
            'departmentId': None,
            'title': '외부기관 - 세브란스병원',
        }),
        ('ext_cnuh', 'ext_cnuh001', '전남대학교병원', 'contact@cnuh.co.kr', 'EXTERNAL', False, {
            'birthDate': None,
            'phoneMobile': '062-220-5114',
            'phoneOffice': '062-220-5114',
            'hireDate': None,
            'departmentId': None,
            'title': '외부기관 - 전남대학교병원',
        }),
    ]

    created_count = 0
    profile_count = 0

    for login_id, password, name, email, role_code, is_staff, profile_data in test_users:
        user = User.objects.filter(login_id=login_id).first()

        if user:
            print(f"  존재: {login_id}")
            # 기존 사용자에도 프로필이 없으면 생성
            if not hasattr(user, 'profile') or not UserProfile.objects.filter(user=user).exists():
                UserProfile.objects.create(user=user, **profile_data)
                profile_count += 1
                print(f"    → 프로필 추가: {login_id}")
            continue

        try:
            role = Role.objects.filter(code=role_code).first()
            user = User(
                login_id=login_id,
                name=name,
                email=email,
                is_staff=is_staff,
                is_active=True,
                role=role
            )
            user.set_password(password)
            user.save()

            # UserProfile 생성
            UserProfile.objects.create(user=user, **profile_data)

            created_count += 1
            profile_count += 1
            print(f"  생성: {login_id} / {password} (프로필 포함)")
        except Exception as e:
            print(f"  오류 ({login_id}): {e}")

    print(f"[OK] 테스트 사용자 설정 완료 ({created_count}개 생성, 프로필 {profile_count}개)")
    return True


def setup_audit_logs():
    """
    감사 로그 더미 데이터 생성
    - 다양한 사용자의 로그인/로그아웃 이력
    """
    print("\n[감사 로그 더미 데이터 생성]")

    from apps.audit.models import AuditLog
    from apps.accounts.models import User
    from datetime import datetime, timedelta
    import random

    # 기존 데이터가 있으면 스킵
    existing_count = AuditLog.objects.count()
    if existing_count >= 50:
        print(f"  기존 감사 로그 {existing_count}건 존재 - 스킵")
        return True

    # 사용자 목록
    users = list(User.objects.filter(is_active=True)[:20])
    if not users:
        print("  사용자가 없습니다 - 스킵")
        return False

    actions = [
        ('LOGIN_SUCCESS', 0.7),   # 70% 확률
        ('LOGIN_FAIL', 0.15),     # 15% 확률
        ('LOGOUT', 0.13),         # 13% 확률
        ('LOGIN_LOCKED', 0.02),   # 2% 확률
    ]

    ip_addresses = [
        '192.168.1.100', '192.168.1.101', '192.168.1.102',
        '10.0.0.50', '10.0.0.51', '10.0.0.52',
        '172.16.0.10', '172.16.0.11',
    ]

    user_agents = [
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0',
        'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Safari/537.36',
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
        'Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 Mobile',
    ]

    created_count = 0
    base_time = datetime.now()

    # 최근 30일간의 로그 생성
    for days_ago in range(30, 0, -1):
        # 하루에 5~15개 로그
        daily_logs = random.randint(5, 15)

        for _ in range(daily_logs):
            # 랜덤 시간 (9시~18시)
            hour = random.randint(8, 18)
            minute = random.randint(0, 59)
            log_time = base_time - timedelta(days=days_ago, hours=random.randint(0, 23), minutes=minute)

            # 액션 선택 (가중치 기반)
            rand = random.random()
            cumulative = 0
            action = 'LOGIN_SUCCESS'
            for act, weight in actions:
                cumulative += weight
                if rand <= cumulative:
                    action = act
                    break

            # 사용자 선택 (LOGIN_FAIL은 가끔 None)
            user = random.choice(users)
            if action == 'LOGIN_FAIL' and random.random() < 0.3:
                user = None  # 존재하지 않는 사용자 시도

            AuditLog.objects.create(
                user=user,
                action=action,
                ip_address=random.choice(ip_addresses),
                user_agent=random.choice(user_agents),
                created_at=log_time,
            )
            created_count += 1

    print(f"[OK] 감사 로그 {created_count}건 생성 (전체: {AuditLog.objects.count()}건)")
    return True


def load_menu_permission_seed():
    """
    메뉴/권한 시드 데이터 로드

    메뉴 그룹 구조:
    ├── DASHBOARD
    ├── PATIENT: PATIENT_LIST, PATIENT_DETAIL, PATIENT_CARE, ENCOUNTER_LIST
    ├── OCS: OCS_STATUS, OCS_CREATE, OCS_MANAGE
    ├── IMAGING: IMAGE_VIEWER, OCS_RIS, OCS_RIS_DETAIL, RIS_DASHBOARD, RIS_RESULT_UPLOAD
    ├── LAB: LAB_RESULT_VIEW, LAB_RESULT_UPLOAD, OCS_LIS, OCS_LIS_DETAIL, LIS_PROCESS_STATUS
    ├── AI_SUMMARY: AI_REQUEST_LIST, AI_REQUEST_CREATE, AI_REQUEST_DETAIL
    └── ADMIN: ADMIN_USER, ADMIN_USER_DETAIL, ADMIN_ROLE, ADMIN_MENU_PERMISSION, ADMIN_AUDIT_LOG, ADMIN_SYSTEM_MONITOR
    """
    print("\n[1단계] 메뉴/권한 시드 데이터 로드...")

    from apps.menus.models import Menu
    from apps.accounts.models import Permission, Role

    # 변경 사항 추적을 위한 딕셔너리
    changes = {
        'Permission': {'before': 0, 'created': 0},
        'Menu': {'before': 0, 'created': 0},
        'MenuPermission': {'before': 0, 'created': 0},
        'MenuLabel': {'before': 0, 'created': 0},
    }

    changes['Permission']['before'] = Permission.objects.count()
    changes['Menu']['before'] = Menu.objects.count()

    print(f"  기존 데이터: 메뉴 {changes['Menu']['before']}개, 권한 {changes['Permission']['before']}개")
    print("  메뉴/권한 데이터 동기화 중...")

    # ========== 권한 데이터 ==========
    permissions_data = [
        ('DASHBOARD', '대시보드', '대시보드 화면 접근'),
        ('PATIENT', '환자', '환자 메뉴'),
        ('PATIENT_LIST', '환자 목록', '환자 목록 화면'),
        ('PATIENT_DETAIL', '환자 상세', '환자 상세 화면'),
        ('PATIENT_CARE', '환자 진료', '환자 진료 화면 접근'),
        ('ENCOUNTER_LIST', '진료 예약', '진료 예약/목록 화면'),
        ('ENCOUNTER_DETAIL', '진료 상세', '진료 상세 화면 (SOAP 노트 포함)'),
        ('OCS', '검사 오더', '검사 오더 메뉴'),
        ('OCS_STATUS', '검사 현황', '검사 오더 현황 조회 (간호사/관리자용)'),
        ('OCS_CREATE', '오더 생성', '검사 오더 생성 화면'),
        ('OCS_MANAGE', '오더 관리', '의사용 검사 오더 관리'),
        ('OCS_PROCESS_STATUS', 'OCS 처리 현황', 'RIS/LIS 통합 처리 현황 대시보드'),
        ('OCS_RIS', '영상 워크리스트', 'RIS 작업자용 영상 오더 처리'),
        ('OCS_RIS_DETAIL', '영상 검사 상세', 'RIS 영상 검사 상세 페이지'),
        ('RIS_DASHBOARD', '판독 현황 대시보드', 'RIS 전체 판독 현황 대시보드'),
        ('RIS_RESULT_UPLOAD', '영상 결과 업로드', '외부 영상 결과 업로드 화면'),
        ('OCS_LIS', '병리 워크리스트', 'LIS 작업자용 병리 오더 처리'),
        ('OCS_LIS_DETAIL', '병리 결과 상세', 'LIS 병리 결과 상세 페이지'),
        ('LIS_PROCESS_STATUS', '결과 처리 상태', 'LIS 업로드 데이터 처리 상태 모니터링'),
        ('IMAGING', '영상', '영상 메뉴'),
        ('IMAGE_VIEWER', '영상 조회', '영상 조회 화면'),
        ('RIS_WORKLIST', '판독 Worklist', 'RIS 판독 Worklist 화면'),
        ('LAB', '병리', '병리 메뉴'),
        ('LAB_RESULT_VIEW', '병리 결과 조회', '병리 결과 조회 화면'),
        ('LAB_RESULT_UPLOAD', '병리 결과 업로드', '병리 결과 업로드 화면'),
        ('AI', 'AI 분석', 'AI 분석 메뉴'),
        ('AI_REQUEST_LIST', 'AI 요청 목록', 'AI 추론 요청 목록'),
        ('AI_REQUEST_CREATE', 'AI 요청 생성', 'AI 추론 요청 생성'),
        ('AI_REQUEST_DETAIL', 'AI 요청 상세', 'AI 추론 요청 상세'),
        ('AI_PROCESS_STATUS', 'AI 처리 현황', 'AI 처리 현황 대시보드'),
        ('AI_MODELS', 'AI 모델 정보', 'AI 모델 목록 및 정보'),
        # AI 신규 분석 페이지 (M1, MG, MM)
        ('AI_M1_INFERENCE', 'M1 MRI 분석', 'M1 MRI 영상 기반 AI 분석'),
        ('AI_M1_DETAIL', 'M1 결과 상세', 'M1 분석 결과 상세 페이지'),
        ('AI_MG_INFERENCE', 'MG Gene 분석', 'MG 유전자 발현 기반 AI 분석'),
        ('AI_MG_DETAIL', 'MG 결과 상세', 'MG 분석 결과 상세 페이지'),
        ('AI_MM_INFERENCE', 'MM 멀티모달', 'MM 멀티모달 통합 AI 분석'),
        ('AI_MM_DETAIL', 'MM 결과 상세', 'MM 분석 결과 상세 페이지'),
        ('ADMIN', '관리자', '관리자 메뉴'),
        ('ADMIN_USER', '사용자 관리', '사용자 관리 화면'),
        ('ADMIN_USER_DETAIL', '사용자 관리 상세', '사용자 상세 화면'),
        ('ADMIN_ROLE', '역할 관리', '역할 관리 화면'),
        ('ADMIN_MENU_PERMISSION', '메뉴 권한 관리', '메뉴 권한 관리 화면'),
        ('ADMIN_AUDIT_LOG', '접근 감사 로그', '접근 감사 로그 화면'),
        ('ADMIN_SYSTEM_MONITOR', '시스템 모니터링', '시스템 모니터링 화면'),
        ('ADMIN_PDF_WATERMARK', 'PDF 워터마크 설정', 'PDF 워터마크 설정 화면'),
        # 진료 보고서
        ('REPORT', '진료 보고서', '진료 보고서 메뉴'),
        ('REPORT_DASHBOARD', '보고서 대시보드', '통합 보고서 대시보드 (OCS+AI+Final)'),
        ('REPORT_LIST', '보고서 목록', '보고서 목록 화면'),
        ('REPORT_CREATE', '보고서 작성', '보고서 작성 화면'),
        ('REPORT_DETAIL', '보고서 상세', '보고서 상세 화면'),
        # 환자 전용 메뉴 (MY_CARE)
        ('MY_CARE', '내 진료', '환자 전용 내 진료 메뉴'),
        ('MY_SUMMARY', '내 정보', '환자 전용 내 정보 요약'),
        ('MY_VISITS', '진료 기록', '환자 전용 진료 기록 조회'),
        ('MY_IMAGING', '영상 결과', '환자 전용 영상 검사 결과 조회'),
        ('MY_LAB', '병리 결과', '환자 전용 병리 결과 조회'),
        ('ABOUT_HOSPITAL', '병원 소개', '병원 안내 페이지'),
    ]

    permission_map = {}
    for code, name, description in permissions_data:
        perm, created = Permission.objects.get_or_create(
            code=code,
            defaults={'name': name, 'description': description}
        )
        permission_map[code] = perm
        if created:
            changes['Permission']['created'] += 1

    print(f"  권한 생성: {changes['Permission']['created']}개")

    # ========== 메뉴 데이터 ==========
    # 업데이트 추적 리스트
    menu_updates = []

    # 메뉴 생성 헬퍼 함수 (기존 레코드도 parent_id, order 업데이트)
    def create_menu(menu_id, **kwargs):
        menu, created = Menu.objects.get_or_create(id=menu_id, defaults=kwargs)
        if created:
            changes['Menu']['created'] += 1
        else:
            # 기존 레코드 업데이트 (parent, order 등)
            update_fields = []
            update_details = []
            if 'parent' in kwargs and menu.parent != kwargs['parent']:
                menu.parent = kwargs['parent']
                update_fields.append('parent')
            if 'parent_id' in kwargs and menu.parent_id != kwargs['parent_id']:
                menu.parent_id = kwargs['parent_id']
                update_fields.append('parent_id')
            if 'order' in kwargs and menu.order != kwargs['order']:
                old_order = menu.order
                menu.order = kwargs['order']
                update_fields.append('order')
                update_details.append(f"order: {old_order} → {kwargs['order']}")
            if 'breadcrumb_only' in kwargs and menu.breadcrumb_only != kwargs['breadcrumb_only']:
                old_val = menu.breadcrumb_only
                menu.breadcrumb_only = kwargs['breadcrumb_only']
                update_fields.append('breadcrumb_only')
                update_details.append(f"breadcrumb_only: {old_val} → {kwargs['breadcrumb_only']}")
            if 'is_active' in kwargs and menu.is_active != kwargs['is_active']:
                old_val = menu.is_active
                menu.is_active = kwargs['is_active']
                update_fields.append('is_active')
                update_details.append(f"is_active: {old_val} → {kwargs['is_active']}")
            if update_fields:
                menu.save(update_fields=update_fields)
                changes['Menu']['updated'] = changes['Menu'].get('updated', 0) + 1
                menu_updates.append({'code': menu.code, 'details': update_details or update_fields})
        return menu, created

    # 최상위 메뉴
    menu_admin, _ = create_menu(1, code='ADMIN', path=None, icon='settings', order=7, is_active=True)
    menu_ai, _ = create_menu(2, code='AI', path=None, icon=None, group_label='AI 분석', order=6, is_active=True)
    menu_dashboard, _ = create_menu(3, code='DASHBOARD', path='/dashboard', icon='home', order=1, is_active=True)
    menu_imaging, _ = create_menu(4, code='IMAGING', path=None, icon=None, group_label='영상', order=4, is_active=True)
    menu_lab, _ = create_menu(5, code='LAB', path=None, icon=None, group_label='검사', order=5, is_active=True)
    menu_ocs, _ = create_menu(6, code='OCS', path=None, icon=None, group_label='검사 오더', order=3, is_active=True)
    menu_patient, _ = create_menu(7, code='PATIENT', path=None, icon=None, group_label='환자', order=2, is_active=True)

    # Admin 하위
    create_menu(8, code='ADMIN_AUDIT_LOG', path='/admin/audit', order=4, is_active=True, parent=menu_admin)
    create_menu(9, code='ADMIN_MENU_PERMISSION', path='/admin/permissions', order=3, is_active=True, parent=menu_admin)
    create_menu(10, code='ADMIN_ROLE', path='/admin/roles', order=2, is_active=True, parent=menu_admin)
    create_menu(11, code='ADMIN_SYSTEM_MONITOR', path='/admin/monitor', order=5, is_active=True, parent=menu_admin)
    create_menu(12, code='ADMIN_USER', path='/admin/users', order=1, is_active=True, parent=menu_admin)
    create_menu(59, code='ADMIN_PDF_WATERMARK', path='/admin/pdf-watermark', order=6, is_active=True, parent=menu_admin)
    menu_admin_user_detail, _ = create_menu(13, code='ADMIN_USER_DETAIL', path='/admin/users/:id', breadcrumb_only=True, order=1, is_active=True, parent_id=12)

    # Imaging 하위
    create_menu(14, code='IMAGE_VIEWER', path='/imaging', icon='image', order=1, is_active=True, parent=menu_imaging)
    # RIS_WORKLIST 비활성화 - OCS_RIS와 중복되므로 사용하지 않음
    create_menu(15, code='RIS_WORKLIST', path='/ris/worklist', icon='x-ray', order=2, is_active=False, parent=menu_imaging)

    # Lab 하위
    create_menu(17, code='LAB_RESULT_VIEW', path='/lab', icon='book', order=1, is_active=True, parent=menu_lab)

    # OCS 하위 (검사 오더)
    menu_ocs_status, _ = create_menu(19, code='OCS_STATUS', path='/ocs/status', icon='clipboard', order=1, is_active=True, parent=menu_ocs)
    # OCS_MANAGE 비활성화 - OCS_STATUS로 통합됨
    menu_ocs_manage, _ = create_menu(23, code='OCS_MANAGE', path='/ocs/manage', icon='file-medical', order=3, is_active=False, parent=menu_ocs)
    # OCS_CREATE는 OCS_STATUS의 하위 메뉴로 변경
    create_menu(18, code='OCS_CREATE', path='/ocs/create', breadcrumb_only=True, order=2, is_active=True, parent=menu_ocs_status)
    # OCS 통합 처리 현황 (RIS + LIS 통합)
    create_menu(37, code='OCS_PROCESS_STATUS', path='/ocs/process-status', icon='chart-pie', order=4, is_active=True, parent=menu_ocs)

    # Patient 하위
    create_menu(20, code='PATIENT_LIST', path='/patients', order=1, is_active=True, parent=menu_patient)
    create_menu(21, code='PATIENT_DETAIL', path='/patients/:patientId', breadcrumb_only=True, order=1, is_active=True, parent_id=20)
    create_menu(22, code='PATIENT_CARE', path='/patientsCare', order=2, is_active=True, parent=menu_patient)
    create_menu(36, code='ENCOUNTER_LIST', path='/encounters', order=3, is_active=True, parent=menu_patient)

    # OCS_RIS: IMAGING 그룹 (영상과용)
    menu_ocs_ris, _ = create_menu(24, code='OCS_RIS', path='/ocs/ris', icon='x-ray', order=3, is_active=True, parent=menu_imaging)

    # OCS_LIS: LAB 그룹 (검사과용)
    menu_ocs_lis, _ = create_menu(25, code='OCS_LIS', path='/ocs/lis', icon='flask', order=3, is_active=True, parent=menu_lab)

    # OCS 상세 페이지 메뉴 (breadcrumb_only)
    create_menu(26, code='OCS_RIS_DETAIL', path='/ocs/ris/:ocsId', icon='x-ray', breadcrumb_only=True, order=1, is_active=True, parent=menu_ocs_ris)
    create_menu(27, code='OCS_LIS_DETAIL', path='/ocs/lis/:ocsId', icon='flask', breadcrumb_only=True, order=1, is_active=True, parent=menu_ocs_lis)

    # RIS Dashboard 메뉴 (IMAGING 그룹) - process-status로 경로 통일
    create_menu(30, code='RIS_DASHBOARD', path='/ocs/ris/process-status', icon='chart-bar', order=4, is_active=True, parent=menu_imaging)

    # RIS Result Upload 메뉴 (IMAGING 그룹)
    create_menu(32, code='RIS_RESULT_UPLOAD', path='/ris/upload', icon='upload', order=5, is_active=True, parent=menu_imaging)

    # LIS Process Status 메뉴 (LAB 그룹)
    create_menu(31, code='LIS_PROCESS_STATUS', path='/ocs/lis/process-status', icon='tasks', order=4, is_active=True, parent=menu_lab)

    # LIS Result Upload 메뉴 (LAB 그룹)
    create_menu(16, code='LAB_RESULT_UPLOAD', path='/lab/upload', icon='upload', order=5, is_active=True, parent=menu_lab)

    # AI 하위 메뉴
    menu_ai_request, _ = create_menu(34, code='AI_REQUEST_LIST', path='/ai/requests', icon='list', order=1, is_active=True, parent=menu_ai)
    create_menu(35, code='AI_REQUEST_CREATE', path='/ai/requests/create', breadcrumb_only=True, order=1, is_active=True, parent=menu_ai_request)
    create_menu(44, code='AI_REQUEST_DETAIL', path='/ai/requests/:id', breadcrumb_only=True, order=2, is_active=True, parent=menu_ai_request)
    create_menu(42, code='AI_PROCESS_STATUS', path='/ai/process-status', icon='chart-bar', order=3, is_active=True, parent=menu_ai)
    create_menu(43, code='AI_MODELS', path='/ai/models', icon='cpu', order=4, is_active=True, parent=menu_ai)
    # AI 신규 분석 페이지 (M1, MG, MM)
    menu_ai_m1, _ = create_menu(53, code='AI_M1_INFERENCE', path='/ai/m1', icon='brain', order=5, is_active=True, parent=menu_ai)
    create_menu(54, code='AI_M1_DETAIL', path='/ai/m1/:jobId', breadcrumb_only=True, order=1, is_active=True, parent=menu_ai_m1)
    menu_ai_mg, _ = create_menu(55, code='AI_MG_INFERENCE', path='/ai/mg', icon='dna', order=6, is_active=True, parent=menu_ai)
    create_menu(56, code='AI_MG_DETAIL', path='/ai/mg/:jobId', breadcrumb_only=True, order=1, is_active=True, parent=menu_ai_mg)
    menu_ai_mm, _ = create_menu(57, code='AI_MM_INFERENCE', path='/ai/mm', icon='layers', order=7, is_active=True, parent=menu_ai)
    create_menu(58, code='AI_MM_DETAIL', path='/ai/mm/:jobId', breadcrumb_only=True, order=1, is_active=True, parent=menu_ai_mm)

    # 진료 보고서 메뉴
    menu_report, _ = create_menu(38, code='REPORT', path=None, icon='file-text', group_label='보고서', order=8, is_active=True)
    create_menu(52, code='REPORT_DASHBOARD', path='/reports', icon='view-dashboard', order=1, is_active=True, parent=menu_report)
    menu_report_list, _ = create_menu(39, code='REPORT_LIST', path='/reports/list', icon='list', order=2, is_active=True, parent=menu_report)
    create_menu(40, code='REPORT_CREATE', path='/reports/create', breadcrumb_only=True, order=3, is_active=True, parent=menu_report_list)
    create_menu(41, code='REPORT_DETAIL', path='/reports/:id', breadcrumb_only=True, order=4, is_active=True, parent=menu_report_list)

    # 환자 전용 메뉴 (MY_CARE) - PATIENT 역할만 접근
    menu_my_care, _ = create_menu(45, code='MY_CARE', path=None, icon='user', group_label='내 진료', order=9, is_active=True)
    create_menu(46, code='MY_SUMMARY', path='/my/summary', icon='info-circle', order=1, is_active=True, parent=menu_my_care)
    create_menu(47, code='MY_VISITS', path='/my/visits', icon='calendar', order=2, is_active=True, parent=menu_my_care)
    create_menu(48, code='MY_IMAGING', path='/my/imaging', icon='x-ray', order=3, is_active=True, parent=menu_my_care)
    create_menu(49, code='MY_LAB', path='/my/lab', icon='flask', order=4, is_active=True, parent=menu_my_care)
    create_menu(51, code='ABOUT_HOSPITAL', path='/about-hospital', icon='hospital', order=5, is_active=True, parent=menu_my_care)

    print(f"  메뉴 생성: {changes['Menu']['created']}개 (전체: {Menu.objects.count()}개)")
    if menu_updates:
        print(f"  메뉴 업데이트: {len(menu_updates)}개")
        for update in menu_updates:
            details = ', '.join(update['details']) if isinstance(update['details'][0], str) else ', '.join(update['details'])
            print(f"    - {update['code']}: {details}")

    # ========== 메뉴-권한 매핑 (MenuPermission) ==========
    from apps.menus.models import MenuPermission

    changes['MenuPermission']['before'] = MenuPermission.objects.count()

    # path가 있는 모든 메뉴에 대해 동일 code의 권한 매핑 (breadcrumb_only 포함)
    for menu in Menu.objects.filter(path__isnull=False):
        if menu.code in permission_map:
            _, created = MenuPermission.objects.get_or_create(
                menu=menu,
                permission=permission_map[menu.code]
            )
            if created:
                changes['MenuPermission']['created'] += 1

    print(f"  메뉴-권한 매핑: {changes['MenuPermission']['created']}개 (전체: {MenuPermission.objects.count()}개)")

    # ========== 메뉴 라벨 (MenuLabel) ==========
    from apps.menus.models import MenuLabel

    changes['MenuLabel']['before'] = MenuLabel.objects.count()

    menu_labels_data = [
        # DASHBOARD
        (3, 'DEFAULT', '대시보드'),
        (3, 'DOCTOR', '의사 대시보드'),
        (3, 'NURSE', '간호 대시보드'),
        # PATIENT
        (7, 'DEFAULT', '환자'),
        (20, 'DEFAULT', '환자 목록'),
        (21, 'DEFAULT', '환자 상세'),
        (22, 'DEFAULT', '환자 진료'),
        (36, 'DEFAULT', '진료 예약'),
        # OCS (검사 오더)
        (6, 'DEFAULT', '검사 오더'),
        (6, 'DOCTOR', '검사 오더'),
        (6, 'NURSE', '검사 현황'),
        (19, 'DEFAULT', '검사 현황'),  # 간호사/관리자용 - 전체 조회
        (18, 'DEFAULT', '오더 생성'),
        (23, 'DEFAULT', '오더 관리'),  # 의사용 - 본인 오더 관리
        (23, 'DOCTOR', '내 오더 관리'),
        (24, 'DEFAULT', '영상 워크리스트'),
        (25, 'DEFAULT', '검사 워크리스트'),
        (26, 'DEFAULT', '영상 검사 상세'),
        (27, 'DEFAULT', '검사 결과 상세'),
        (37, 'DEFAULT', 'OCS 처리 현황'),
        (37, 'DOCTOR', '검사 처리 현황'),
        (37, 'NURSE', '검사 처리 현황'),
        (37, 'ADMIN', 'OCS 통합 현황'),
        # 간호사
        (28, 'DEFAULT', '진료 접수 현황'),
        (28, 'NURSE', '진료 접수'),
        # LIS Alert
        (29, 'DEFAULT', '검사 결과 Alert'),
        (29, 'LIS', '결과 Alert'),
        # RIS Dashboard
        (30, 'DEFAULT', '영상 판독 상세'),
        (30, 'RIS', '영상 판독 상세'),
        # RIS Result Upload
        (32, 'DEFAULT', '영상 결과 업로드'),
        (32, 'RIS', '영상 결과 업로드'),
        # LIS Process Status
        (31, 'DEFAULT', 'LIS 검사 상세'),
        (31, 'LIS', 'LIS 검사 상세'),
        # IMAGING
        (4, 'DEFAULT', '영상'),
        (14, 'DEFAULT', '영상 조회'),
        (15, 'DEFAULT', '판독 Worklist'),
        # AI
        (2, 'DEFAULT', 'AI 분석'),
        (34, 'DEFAULT', 'AI 요청 목록'),
        (34, 'DOCTOR', 'AI 분석 요청'),
        (35, 'DEFAULT', 'AI 요청 생성'),
        (44, 'DEFAULT', 'AI 요청 상세'),
        (42, 'DEFAULT', 'AI 처리 현황'),
        (43, 'DEFAULT', 'AI 모델 정보'),
        # AI 신규 분석 페이지 라벨 (M1, MG, MM)
        (53, 'DEFAULT', 'M1 MRI 분석'),
        (53, 'DOCTOR', 'MRI 분석'),
        (54, 'DEFAULT', 'M1 결과 상세'),
        (55, 'DEFAULT', 'MG Gene 분석'),
        (55, 'DOCTOR', '유전자 분석'),
        (56, 'DEFAULT', 'MG 결과 상세'),
        (57, 'DEFAULT', 'MM 멀티모달'),
        (57, 'DOCTOR', '통합 분석'),
        (58, 'DEFAULT', 'MM 결과 상세'),
        # LAB
        (5, 'DEFAULT', '병리'),
        (17, 'DEFAULT', '병리 조회'),  # 병리 결과 조회 → 병리 조회
        (16, 'DEFAULT', '병리 결과 업로드'),  # breadcrumb_only - OCS에서 이동
        # ADMIN
        (1, 'DEFAULT', '관리자'),
        (12, 'DEFAULT', '사용자 관리'),
        (13, 'DEFAULT', '사용자 관리 상세조회'),
        (10, 'DEFAULT', '역할 권한 관리'),
        (9, 'DEFAULT', '메뉴 권한 관리'),
        (8, 'DEFAULT', '접근 감사 로그'),
        (11, 'DEFAULT', '시스템 모니터링'),
        # REPORT
        (38, 'DEFAULT', '보고서'),
        (52, 'DEFAULT', '보고서 대시보드'),
        (52, 'DOCTOR', '통합 보고서'),
        (52, 'NURSE', '검사 결과'),
        (52, 'RIS', '검사 결과'),
        (52, 'LIS', '검사 결과'),
        (39, 'DEFAULT', '최종 보고서'),
        (40, 'DEFAULT', '보고서 작성'),
        (41, 'DEFAULT', '보고서 상세'),
        # MY_CARE (환자 전용)
        (45, 'DEFAULT', '내 진료'),
        (45, 'PATIENT', '내 진료'),
        (46, 'DEFAULT', '내 정보'),
        (46, 'PATIENT', '내 정보'),
        (47, 'DEFAULT', '진료 기록'),
        (47, 'PATIENT', '진료 기록'),
        (48, 'DEFAULT', '영상 결과'),
        (48, 'PATIENT', '내 영상 결과'),
        (49, 'DEFAULT', '병리 결과'),
        (49, 'PATIENT', '내 병리 결과'),
    ]

    for menu_id, role, text in menu_labels_data:
        try:
            menu = Menu.objects.get(id=menu_id)
            _, created = MenuLabel.objects.get_or_create(
                menu=menu,
                role=role,
                defaults={'text': text}
            )
            if created:
                changes['MenuLabel']['created'] += 1
        except Menu.DoesNotExist:
            pass

    print(f"  메뉴 라벨: {changes['MenuLabel']['created']}개 (전체: {MenuLabel.objects.count()}개)")

    # ========== 역할별 권한 매핑 (RolePermission - Menu 연결) ==========
    from apps.accounts.models import RolePermission

    # 메뉴 code → Menu 객체 매핑
    menu_map = {menu.code: menu for menu in Menu.objects.all()}

    role_menu_permissions = {
        'SYSTEMMANAGER': list(menu_map.keys()),  # 모든 메뉴
        'ADMIN': [
            'DASHBOARD', 'PATIENT', 'PATIENT_LIST', 'PATIENT_DETAIL', 'PATIENT_CARE', 'ENCOUNTER_LIST',
            'OCS', 'OCS_STATUS', 'OCS_CREATE', 'OCS_PROCESS_STATUS',
            'OCS_RIS', 'OCS_RIS_DETAIL', 'OCS_LIS', 'OCS_LIS_DETAIL',
            'IMAGING', 'IMAGE_VIEWER', 'RIS_WORKLIST', 'RIS_DASHBOARD', 'RIS_RESULT_UPLOAD',
            'LAB', 'LAB_RESULT_VIEW', 'LAB_RESULT_UPLOAD', 'LIS_PROCESS_STATUS',
            'AI', 'AI_REQUEST_LIST', 'AI_REQUEST_CREATE', 'AI_REQUEST_DETAIL', 'AI_PROCESS_STATUS', 'AI_MODELS',
            'AI_M1_INFERENCE', 'AI_M1_DETAIL', 'AI_MG_INFERENCE', 'AI_MG_DETAIL', 'AI_MM_INFERENCE', 'AI_MM_DETAIL',
            'REPORT', 'REPORT_DASHBOARD', 'REPORT_LIST', 'REPORT_CREATE', 'REPORT_DETAIL',
            'ADMIN', 'ADMIN_USER', 'ADMIN_USER_DETAIL', 'ADMIN_ROLE', 'ADMIN_MENU_PERMISSION', 'ADMIN_AUDIT_LOG', 'ADMIN_SYSTEM_MONITOR', 'ADMIN_PDF_WATERMARK'
        ],
        'DOCTOR': ['DASHBOARD', 'PATIENT_LIST', 'PATIENT_DETAIL', 'PATIENT_CARE', 'ENCOUNTER_LIST', 'ENCOUNTER_DETAIL', 'OCS_STATUS', 'OCS_CREATE', 'OCS_PROCESS_STATUS', 'IMAGE_VIEWER', 'RIS_WORKLIST', 'LAB_RESULT_VIEW', 'AI', 'AI_REQUEST_LIST', 'AI_REQUEST_CREATE', 'AI_REQUEST_DETAIL', 'AI_M1_INFERENCE', 'AI_M1_DETAIL', 'AI_MG_INFERENCE', 'AI_MG_DETAIL', 'AI_MM_INFERENCE', 'AI_MM_DETAIL', 'REPORT', 'REPORT_DASHBOARD', 'REPORT_LIST', 'REPORT_CREATE', 'REPORT_DETAIL'],
        'NURSE': ['DASHBOARD', 'PATIENT_LIST', 'PATIENT_DETAIL', 'ENCOUNTER_LIST', 'ENCOUNTER_DETAIL', 'OCS_STATUS', 'OCS_PROCESS_STATUS', 'IMAGE_VIEWER', 'LAB_RESULT_VIEW', 'AI', 'AI_REQUEST_LIST', 'AI_REQUEST_DETAIL', 'AI_M1_DETAIL', 'AI_MG_DETAIL', 'AI_MM_DETAIL', 'REPORT', 'REPORT_DASHBOARD', 'REPORT_LIST', 'REPORT_DETAIL'],  # AI 결과 조회 및 리포트 열람
        'RIS': ['DASHBOARD', 'IMAGE_VIEWER', 'RIS_WORKLIST', 'OCS_RIS', 'OCS_RIS_DETAIL', 'RIS_DASHBOARD', 'RIS_RESULT_UPLOAD', 'AI', 'AI_REQUEST_LIST', 'REPORT', 'REPORT_DASHBOARD'],
        'LIS': ['DASHBOARD', 'LAB_RESULT_VIEW', 'LAB_RESULT_UPLOAD', 'OCS_LIS', 'OCS_LIS_DETAIL', 'LIS_PROCESS_STATUS', 'AI', 'AI_REQUEST_LIST', 'REPORT', 'REPORT_DASHBOARD'],
        # 환자 전용 메뉴 (MY_CARE 그룹)
        'PATIENT': ['DASHBOARD', 'MY_CARE', 'MY_SUMMARY', 'MY_VISITS', 'MY_IMAGING', 'MY_LAB', 'ABOUT_HOSPITAL'],
        # 외부기관 전용 메뉴
        'EXTERNAL': ['DASHBOARD', 'IMAGE_VIEWER', 'AI', 'AI_REQUEST_LIST', 'AI_REQUEST_DETAIL', 'AI_M1_DETAIL', 'AI_MG_DETAIL', 'AI_MM_DETAIL', 'REPORT', 'REPORT_DASHBOARD', 'REPORT_LIST', 'REPORT_DETAIL'],
    }

    for role_code, menu_codes in role_menu_permissions.items():
        try:
            role = Role.objects.get(code=role_code)
            # 기존 RolePermission 삭제 후 새로 생성
            RolePermission.objects.filter(role=role).delete()
            created_count = 0
            for menu_code in menu_codes:
                if menu_code in menu_map:
                    RolePermission.objects.create(
                        role=role,
                        permission=menu_map[menu_code]  # permission 필드가 Menu를 참조
                    )
                    created_count += 1
            print(f"  {role_code}: {created_count}개 메뉴 권한 설정")
        except Role.DoesNotExist:
            print(f"  경고: {role_code} 역할이 없습니다")

    # ========== 변경 요약 출력 ==========
    print("\n  [결과 요약]")
    for table, counts in changes.items():
        created = counts['created']
        if created > 0:
            print(f"  결과: {table} 테이블에 {created}개가 추가되었습니다.")
        else:
            print(f"  결과: {table} 테이블에 변경 없음 (기존 {counts['before']}개)")

    print(f"\n[OK] 메뉴/권한 시드 완료")
    return True


def create_dummy_patients(target_count=30, force=False):
    """더미 환자 데이터 생성"""
    print(f"\n[2단계] 환자 데이터 생성 (목표: {target_count}명)...")

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

    # 더미 환자 데이터
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
        # 확장 환자 20명 (기존 setup_dummy_data_4_extended.py에서 통합)
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
    print(f"\n[3단계] 진료 데이터 생성 (목표: {target_count}건)...")

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
    print("\n[3-1단계] 오늘 예약 진료 생성...")
    from datetime import time as dt_time
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


def create_dummy_imaging_with_ocs(num_orders=30, force=False):
    """더미 영상 검사 데이터 생성 (OCS 통합 버전)"""
    print(f"\n[4단계] 영상 검사 데이터 생성 - OCS 통합 (목표: {num_orders}건)...")

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

    # 필요한 데이터 - 환자와 담당 의사 관계가 있는 진료 기록만 사용
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

    for i in range(num_orders):
        # 진료 기록에서 환자와 담당 의사 관계 가져오기
        encounter = random.choice(encounters)
        patient = encounter.patient
        doctor = encounter.attending_doctor  # 환자의 담당 의사가 요청
        modality = random.choice(modalities)
        body_part = random.choice(body_parts)

        days_ago = random.randint(0, 90)
        ocs_status = random.choice(ocs_statuses)

        # 작업자 (ACCEPTED 이후에만)
        worker = None
        if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            worker = random.choice(radiologists)

        # doctor_request 데이터
        doctor_request = {
            "_template": "default",
            "_version": "1.0",
            "clinical_info": f"{random.choice(clinical_indications)} - {patient.name}",
            "request_detail": f"{modality} {body_part} 촬영 요청",
            "special_instruction": random.choice(["", "조영제 사용", "조영제 없이", "긴급"]),
        }

        # worker_result 데이터 (RESULT_READY 이후에만)
        worker_result = {}
        if ocs_status in ['RESULT_READY', 'CONFIRMED']:
            tumor_detected = random.random() < 0.3
            lobes = ['frontal', 'temporal', 'parietal', 'occipital']
            hemispheres = ['left', 'right']

            # MRI인 경우 4채널 시리즈 생성
            series_data = []
            if modality == 'MRI':
                for seq_type in ['T1', 'T2', 'T1C', 'FLAIR']:
                    series_data.append({
                        "series_uid": f"1.2.840.{random.randint(100000, 999999)}.{seq_type}",
                        "series_type": seq_type,
                        "series_description": f"{seq_type} Weighted",
                        "instance_count": random.randint(20, 60)
                    })
            else:
                # CT, X-Ray 등 단일 시리즈
                series_data.append({
                    "series_uid": f"1.2.840.{random.randint(100000, 999999)}.1",
                    "series_type": "OTHER",
                    "series_description": f"{modality} Series",
                    "instance_count": random.randint(30, 200)
                })

            worker_result = {
                "_template": "RIS",
                "_version": "1.1",
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
                    "series": series_data,
                    "series_count": len(series_data),
                    "instance_count": sum(s.get('instance_count', 0) for s in series_data)
                },
                "work_notes": []
            }

        try:
            with transaction.atomic():
                # OCS 생성
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
                )

                # ImagingStudy 생성 (OCS에 연결)
                scheduled_at = None
                performed_at = None

                if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
                    scheduled_at = timezone.now() - timedelta(days=days_ago) + timedelta(days=random.randint(1, 3))

                if ocs_status in ['IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
                    performed_at = scheduled_at + timedelta(hours=random.randint(1, 24)) if scheduled_at else None

                study = ImagingStudy.objects.create(
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

    print(f"[OK] OCS + ImagingStudy 생성: {created_count}건")
    print(f"  현재 전체 OCS(RIS): {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  현재 전체 ImagingStudy: {ImagingStudy.objects.count()}건")
    return True


def create_dummy_lis_orders(num_orders=30, force=False):
    """더미 LIS (검사) 오더 생성"""
    print(f"\n[5단계] 검사 오더 데이터 생성 - LIS (목표: {num_orders}건)...")

    from apps.ocs.models import OCS
    from apps.patients.models import Patient
    from apps.encounters.models import Encounter
    from django.contrib.auth import get_user_model
    User = get_user_model()

    # 기존 데이터 확인
    existing_ocs = OCS.objects.filter(job_role='LIS').count()
    if existing_ocs >= num_orders and not force:
        print(f"[SKIP] 이미 {existing_ocs}건의 LIS 오더가 존재합니다.")
        return True

    # 필요한 데이터 - 환자와 담당 의사 관계가 있는 진료 기록만 사용
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

    for i in range(num_orders):
        # 진료 기록에서 환자와 담당 의사 관계 가져오기
        encounter = random.choice(encounters)
        patient = encounter.patient
        doctor = encounter.attending_doctor  # 환자의 담당 의사가 요청
        test_type = random.choice(test_types)

        # 날짜 분포: 1주일 ~ 6개월 (180일)
        days_ago = random.randint(0, 180)

        # 상태 결정: 오래된 데이터일수록 CONFIRMED 확률 높음
        if days_ago > 90:  # 3개월 이상
            ocs_status = random.choice(['CONFIRMED', 'CONFIRMED', 'CONFIRMED', 'CANCELLED'])
        elif days_ago > 30:  # 1개월 이상
            ocs_status = random.choice(['RESULT_READY', 'CONFIRMED', 'CONFIRMED'])
        elif days_ago > 7:  # 1주일 이상
            ocs_status = random.choice(['IN_PROGRESS', 'RESULT_READY', 'CONFIRMED'])
        else:  # 최근 1주일
            ocs_status = random.choice(ocs_statuses)

        # 작업자 (ACCEPTED 이후에만)
        worker = None
        if ocs_status in ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY', 'CONFIRMED']:
            worker = random.choice(lab_workers)

        # doctor_request 데이터
        doctor_request = {
            "_template": "default",
            "_version": "1.0",
            "clinical_info": f"{patient.name} - 정기검사",
            "request_detail": f"{test_type} 검사 요청",
            "special_instruction": random.choice(["", "공복 필요", "아침 첫 소변", ""]),
        }

        # worker_result 데이터 (RESULT_READY 이후에만)
        worker_result = {}
        if ocs_status in ['RESULT_READY', 'CONFIRMED']:
            is_abnormal = random.random() < 0.2

            # 검사 결과 샘플
            test_results = []
            if test_type == 'CBC':
                test_results = [
                    {"code": "WBC", "name": "백혈구", "value": str(round(random.uniform(4.0, 11.0), 1)), "unit": "10^3/uL", "reference": "4.0-11.0", "is_abnormal": False},
                    {"code": "RBC", "name": "적혈구", "value": str(round(random.uniform(4.0, 6.0), 2)), "unit": "10^6/uL", "reference": "4.0-6.0", "is_abnormal": False},
                    {"code": "HGB", "name": "혈색소", "value": str(round(random.uniform(12.0, 17.0), 1)), "unit": "g/dL", "reference": "12.0-17.0", "is_abnormal": False},
                    {"code": "PLT", "name": "혈소판", "value": str(random.randint(150, 400)), "unit": "10^3/uL", "reference": "150-400", "is_abnormal": False},
                ]
            elif test_type == 'Tumor Markers':
                cea_val = round(random.uniform(0.5, 5.0), 2) if not is_abnormal else round(random.uniform(5.1, 20.0), 2)
                afp_val = round(random.uniform(0.5, 10.0), 2) if not is_abnormal else round(random.uniform(10.1, 50.0), 2)
                test_results = [
                    {"code": "CEA", "name": "암배아항원", "value": str(cea_val), "unit": "ng/mL", "reference": "0-5.0", "is_abnormal": cea_val > 5.0},
                    {"code": "AFP", "name": "알파태아단백", "value": str(afp_val), "unit": "ng/mL", "reference": "0-10.0", "is_abnormal": afp_val > 10.0},
                ]
            elif test_type in ['GENE_PANEL', 'RNA_SEQ', 'DNA_SEQ']:
                # 유전자 검사 결과
                gene_mutations = [
                    {"gene_name": "IDH1", "mutation_type": "R132H" if is_abnormal else "Wild Type", "status": "Mutant" if is_abnormal else "Normal", "allele_frequency": round(random.uniform(0.1, 0.5), 2) if is_abnormal else None, "clinical_significance": "Favorable prognosis" if is_abnormal else "N/A"},
                    {"gene_name": "TP53", "mutation_type": random.choice(["Missense", "Nonsense", "Wild Type"]), "status": random.choice(["Mutant", "Normal"]), "allele_frequency": round(random.uniform(0.05, 0.3), 2), "clinical_significance": "Variable"},
                    {"gene_name": "MGMT", "mutation_type": "Methylated" if random.random() > 0.5 else "Unmethylated", "status": "Methylated" if random.random() > 0.5 else "Unmethylated", "allele_frequency": None, "clinical_significance": "TMZ response predictor"},
                    {"gene_name": "EGFR", "mutation_type": random.choice(["Amplified", "Normal"]), "status": random.choice(["Amplified", "Normal"]), "allele_frequency": None, "clinical_significance": "GBM marker"},
                ]
                # RNA 시퀀싱 데이터 (AI 모델 매칭용)
                rna_seq_data = {
                    "sample_id": f"RNA_{random.randint(10000, 99999)}",
                    "sequencing_platform": random.choice(["Illumina NovaSeq", "Illumina HiSeq", "Ion Torrent"]),
                    "read_depth": f"{random.randint(30, 100)}x",
                    "quality_score": round(random.uniform(28, 38), 1),
                    "gene_expression_profile": "available",
                    "transcript_count": random.randint(15000, 25000)
                }
                test_results = [{"code": "GENE", "name": "유전자 변이 분석", "value": "분석 완료", "unit": "", "reference": "", "is_abnormal": is_abnormal}]
                worker_result = {
                    "_template": "LIS", "_version": "1.1", "_confirmed": ocs_status == 'CONFIRMED',
                    "test_type": "GENETIC", "test_results": test_results, "gene_mutations": gene_mutations,
                    "RNA_seq": rna_seq_data,  # AI 모델 매칭용 키
                    "summary": "유전자 변이 검출됨" if is_abnormal else "유전자 변이 없음",
                    "interpretation": "IDH1 변이 양성 - 예후 양호" if is_abnormal else "특이 변이 없음", "_custom": {}
                }
            elif test_type == 'BIOMARKER':
                # 단백질 검사 결과
                protein_markers = [
                    {"marker_name": "GFAP", "value": round(random.uniform(0.1, 5.0), 2), "unit": "ng/mL", "reference_range": "0-2.0", "is_abnormal": random.random() > 0.7, "interpretation": "Astrocyte marker"},
                    {"marker_name": "S100B", "value": round(random.uniform(0.01, 0.5), 3), "unit": "ug/L", "reference_range": "0-0.15", "is_abnormal": random.random() > 0.6, "interpretation": "Brain injury marker"},
                    {"marker_name": "NSE", "value": round(random.uniform(5, 25), 1), "unit": "ng/mL", "reference_range": "0-16.3", "is_abnormal": random.random() > 0.7, "interpretation": "Neuroendocrine marker"},
                ]
                test_results = [{"code": "PROT", "name": "단백질 마커 분석", "value": "분석 완료", "unit": "", "reference": "", "is_abnormal": is_abnormal}]
                worker_result = {
                    "_template": "LIS", "_version": "1.0", "_confirmed": ocs_status == 'CONFIRMED',
                    "test_type": "PROTEIN", "test_results": test_results, "protein_markers": protein_markers,
                    "protein": "GFAP, S100B 상승" if is_abnormal else "정상 범위",
                    "summary": "단백질 마커 이상" if is_abnormal else "정상 범위",
                    "interpretation": "뇌종양 관련 마커 상승 소견" if is_abnormal else "특이 소견 없음", "_custom": {}
                }
            else:
                # 일반 검사
                test_results = [
                    {"code": "TEST1", "name": f"{test_type} 항목1", "value": str(round(random.uniform(50, 150), 1)), "unit": "mg/dL", "reference": "50-150", "is_abnormal": False},
                    {"code": "TEST2", "name": f"{test_type} 항목2", "value": str(round(random.uniform(10, 50), 1)), "unit": "U/L", "reference": "10-50", "is_abnormal": False},
                ]

            # GENE/BIOMARKER는 위에서 이미 worker_result 설정됨
            if test_type not in ['GENE_PANEL', 'RNA_SEQ', 'DNA_SEQ', 'BIOMARKER']:
                worker_result = {
                "_template": "LIS",
                "_version": "1.0",
                "_confirmed": ocs_status == 'CONFIRMED',
                "test_results": test_results,
                "summary": "이상 소견 있음" if is_abnormal else "정상 범위",
                "interpretation": "추가 검사 권장" if is_abnormal else "특이 소견 없음",
                "_custom": {}
            }

        # 타임스탬프 계산
        base_time = timezone.now() - timedelta(days=days_ago)
        timestamps = {
            'accepted_at': None,
            'in_progress_at': None,
            'result_ready_at': None,
            'confirmed_at': None,
            'cancelled_at': None,
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
                # OCS 생성
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
                # created_at은 auto_now_add이므로 별도 업데이트
                OCS.objects.filter(pk=ocs.pk).update(created_at=base_time)
                created_count += 1

        except Exception as e:
            print(f"  오류: {e}")

    print(f"[OK] OCS(LIS) 생성: {created_count}건")
    print(f"  현재 전체 OCS(LIS): {OCS.objects.filter(job_role='LIS').count()}건")
    return True


def create_ai_models():
    """AI 모델 시드 데이터 생성 (현재 AIInference 단일 모델 사용으로 스킵)"""
    print(f"\n[6단계] AI 모델 데이터 생성...")
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


def update_encounters_with_soap(force=False):
    """기존 진료에 SOAP 데이터 추가"""
    print("\n[7단계] 진료 SOAP 데이터 업데이트...")

    from apps.encounters.models import Encounter

    # 완료/진행중 진료만 업데이트
    encounters = Encounter.objects.filter(
        status__in=['completed', 'in_progress'],
        subjective='',  # SOAP 데이터가 없는 진료만
    )

    if not encounters.exists() and not force:
        print("[SKIP] 업데이트 대상 진료가 없거나 이미 SOAP 데이터가 있습니다.")
        return True

    soap_samples = [
        {
            'subjective': '두통이 2주 전부터 시작되어 점점 심해지고 있습니다. 오심, 구토 동반됨.',
            'objective': 'V/S: BP 130/85, HR 78, BT 36.5\nNeuro exam: Pupil reflex (+/+), MMT 5/5',
            'assessment': '두통 - 원인 감별 필요 (Tension type vs. Secondary headache)',
            'plan': '1. Brain MRI with contrast 처방\n2. 진통제 처방 (Acetaminophen 500mg tid)\n3. 2주 후 F/U',
        },
        {
            'subjective': '왼쪽 팔다리 저림 증상이 3일 전부터 있습니다. 힘이 빠지는 느낌도 있음.',
            'objective': 'V/S: 안정적\nNeuro exam: Lt. side weakness (MMT 4/5), sensory decreased',
            'assessment': 'Rt. hemisphere lesion 의심 - Brain tumor vs. Infarction R/O',
            'plan': '1. Brain CT & MRI 시행\n2. Lab 검사 (CBC, Coag, Chemistry)\n3. 신경외과 협진 의뢰',
        },
        {
            'subjective': '경련이 어제 발생했습니다. 의식 소실 동반, 약 2분간 지속.',
            'objective': 'V/S: 안정적\nEEG: Abnormal findings at Rt. temporal area',
            'assessment': 'New onset seizure - Structural lesion 감별 필요',
            'plan': '1. Anti-epileptic drug 시작 (Levetiracetam 500mg bid)\n2. Brain MRI 시행\n3. 발작 일지 작성 교육',
        },
        {
            'subjective': '정기 추적 검사 방문. 특이 증상 없음.',
            'objective': 'V/S: 정상\nNeuro exam: No focal neurological deficit',
            'assessment': 'Brain tumor s/p treatment - Stable disease',
            'plan': '1. Brain MRI F/U 예약\n2. 현재 투약 유지\n3. 3개월 후 재방문',
        },
    ]

    updated_count = 0
    for encounter in encounters[:15]:  # 최대 15건만 업데이트
        soap = random.choice(soap_samples)
        encounter.subjective = soap['subjective']
        encounter.objective = soap['objective']
        encounter.assessment = soap['assessment']
        encounter.plan = soap['plan']
        encounter.save()
        updated_count += 1

    print(f"[OK] 진료 SOAP 데이터 업데이트: {updated_count}건")
    return True


def link_patient_user_account():
    """
    PATIENT 역할 사용자를 환자(Patient) 테이블과 연결

    patient1~5 계정 → 환자 테이블의 김철수, 이영희, 박민수, 최지은, 정현우와 연결
    """
    print("\n[추가 단계] 환자 계정-환자 테이블 연결...")

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


def reset_base_data():
    """기본 더미 데이터 삭제 (base 영역만)"""
    print("\n[RESET] 기본 더미 데이터 삭제 중...")

    from apps.ocs.models import OCS, OCSHistory
    from apps.imaging.models import ImagingStudy
    from apps.encounters.models import Encounter
    from apps.patients.models import Patient, PatientAlert
    from apps.menus.models import Menu, MenuLabel, MenuPermission
    from apps.ai_inference.models import AIInference
    from apps.treatment.models import TreatmentPlan, TreatmentSession
    from apps.followup.models import FollowUp
    from apps.prescriptions.models import Prescription, PrescriptionItem
    from apps.audit.models import AuditLog

    # 삭제 순서: 의존성 역순
    # 감사 로그 삭제
    audit_log_count = AuditLog.objects.count()
    AuditLog.objects.all().delete()
    print(f"  AuditLog: {audit_log_count}건 삭제")

    # 환자 주의사항 삭제
    patient_alert_count = PatientAlert.objects.count()
    PatientAlert.objects.all().delete()
    print(f"  PatientAlert: {patient_alert_count}건 삭제")

    # 처방 삭제 (Patient 참조)
    prescription_item_count = PrescriptionItem.objects.count()
    PrescriptionItem.objects.all().delete()
    print(f"  PrescriptionItem: {prescription_item_count}건 삭제")

    prescription_count = Prescription.objects.count()
    Prescription.objects.all().delete()
    print(f"  Prescription: {prescription_count}건 삭제")

    # AI 추론 삭제
    ai_inference_count = AIInference.objects.count()
    AIInference.objects.all().delete()
    print(f"  AIInference: {ai_inference_count}건 삭제")

    # 치료 세션/계획 삭제 (추가 데이터지만 base 데이터에 의존)
    treatment_session_count = TreatmentSession.objects.count()
    TreatmentSession.objects.all().delete()
    print(f"  TreatmentSession: {treatment_session_count}건 삭제")

    treatment_plan_count = TreatmentPlan.objects.count()
    TreatmentPlan.objects.all().delete()
    print(f"  TreatmentPlan: {treatment_plan_count}건 삭제")

    # 경과 기록 삭제 (추가 데이터지만 base 데이터에 의존)
    followup_count = FollowUp.objects.count()
    FollowUp.objects.all().delete()
    print(f"  FollowUp: {followup_count}건 삭제")

    # 기본 데이터 삭제
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

    # 불필요한 메뉴 삭제 (PATIENT_IMAGING_HISTORY 등)
    deprecated_menus = ['PATIENT_IMAGING_HISTORY']
    for menu_code in deprecated_menus:
        try:
            menu = Menu.objects.filter(code=menu_code).first()
            if menu:
                MenuLabel.objects.filter(menu=menu).delete()
                MenuPermission.objects.filter(menu=menu).delete()
                menu.delete()
                print(f"  Menu '{menu_code}' 삭제됨")
        except Exception as e:
            print(f"  Menu '{menu_code}' 삭제 실패: {e}")

    print("[OK] 기본 더미 데이터 삭제 완료")


def print_summary_base():
    """기본 데이터 요약 (역할/사용자/메뉴)"""
    print("\n" + "="*60)
    print("기본 데이터 생성 완료! (1/3)")
    print("="*60)

    from apps.menus.models import Menu, MenuLabel, MenuPermission
    from apps.accounts.models import Permission, Role, User
    from apps.audit.models import AuditLog

    print(f"\n[통계 - 기본 데이터]")
    print(f"  - 역할: {Role.objects.count()}개")
    print(f"  - 사용자: {User.objects.count()}명")
    print(f"  - 메뉴: {Menu.objects.count()}개")
    print(f"  - 메뉴 라벨: {MenuLabel.objects.count()}개")
    print(f"  - 메뉴-권한 매핑: {MenuPermission.objects.count()}개")
    print(f"  - 권한: {Permission.objects.count()}개")
    print(f"  - 감사 로그: {AuditLog.objects.count()}건")

    print(f"\n[다음 단계]")
    print(f"  임상 데이터 생성:")
    print(f"    python setup_dummy_data_2_clinical.py")


def print_summary():
    """기본 더미 데이터 요약 (레거시 호환)"""
    print("\n" + "="*60)
    print("기본 더미 데이터 생성 완료!")
    print("="*60)

    from apps.patients.models import Patient, PatientAlert
    from apps.encounters.models import Encounter
    from apps.imaging.models import ImagingStudy
    from apps.ocs.models import OCS
    from apps.menus.models import Menu, MenuLabel, MenuPermission
    from apps.accounts.models import Permission
    from apps.ai_inference.models import AIInference

    print(f"\n[통계 - 기본 데이터]")
    print(f"  - 메뉴: {Menu.objects.count()}개")
    print(f"  - 메뉴 라벨: {MenuLabel.objects.count()}개")
    print(f"  - 메뉴-권한 매핑: {MenuPermission.objects.count()}개")
    print(f"  - 권한: {Permission.objects.count()}개")
    print(f"  - 환자: {Patient.objects.filter(is_deleted=False).count()}명")
    print(f"  - 환자 주의사항: {PatientAlert.objects.count()}건")
    print(f"  - 진료: {Encounter.objects.count()}건")
    print(f"  - 진료 (SOAP 포함): {Encounter.objects.exclude(subjective='').count()}건")
    print(f"  - OCS (RIS): {OCS.objects.filter(job_role='RIS').count()}건")
    print(f"  - OCS (LIS): {OCS.objects.filter(job_role='LIS').count()}건")
    print(f"  - 영상 검사: {ImagingStudy.objects.count()}건")
    print(f"  - AI 추론: {AIInference.objects.count()}건")

    print(f"\n[다음 단계]")
    print(f"  추가 데이터 생성:")
    print(f"    python setup_dummy_data_2_clinical.py")
    print(f"")
    print(f"  또는 전체 실행:")
    print(f"    python setup_dummy_data.py")


def main():
    """메인 실행 함수"""
    # 명령줄 인자 파싱
    parser = argparse.ArgumentParser(description='Brain Tumor CDSS 기본 더미 데이터 생성')
    parser.add_argument('--reset', action='store_true', help='기존 데이터 삭제 후 새로 생성')
    parser.add_argument('--force', action='store_true', help='목표 수량 이상이어도 강제 추가')
    parser.add_argument('--menu', action='store_true', help='메뉴/권한만 업데이트 (네비게이션 바 반영)')
    parser.add_argument('-y', '--yes', action='store_true', help='확인 없이 자동 실행 (비대화형 모드)')
    args = parser.parse_args()

    print("="*60)
    print("Brain Tumor CDSS - 기본 더미 데이터 생성 (1/2)")
    print("="*60)

    # --menu 옵션: 메뉴/권한만 업데이트
    if args.menu:
        print("\n[메뉴/권한 업데이트 모드]")
        load_menu_permission_seed()
        print("\n" + "="*60)
        print("메뉴/권한 업데이트 완료!")
        print("="*60)
        return

    # --reset 옵션: 기존 데이터 삭제
    if args.reset:
        if args.yes:
            # 비대화형 모드: 확인 없이 삭제
            reset_base_data()
        else:
            confirm = input("\n정말 기존 데이터를 모두 삭제하시겠습니까? (yes/no): ")
            if confirm.lower() == 'yes':
                reset_base_data()
            else:
                print("삭제 취소됨")
                sys.exit(0)

    force = args.reset or args.force  # reset 시에는 force=True

    # ===== 1단계: 역할/사용자/메뉴 (필수) =====
    # 역할 생성
    setup_roles()

    # 슈퍼유저 생성
    setup_superuser()

    # 테스트 사용자 생성
    setup_test_users()

    # 메뉴/권한 시드 데이터 로드
    load_menu_permission_seed()

    # 감사 로그 더미 데이터 생성
    setup_audit_logs()

    # 요약 출력
    print_summary_base()


if __name__ == '__main__':
    main()
