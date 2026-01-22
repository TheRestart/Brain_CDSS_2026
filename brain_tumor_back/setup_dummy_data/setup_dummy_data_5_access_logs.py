#!/usr/bin/env python
"""
Brain Tumor CDSS - 더미 데이터 설정 스크립트 - 접근 감사 로그

이 스크립트는 AccessLog 더미 데이터를 생성합니다:
- 시스템 접근/행위 감사 로그 200건

사용법:
    python setup_dummy_data_5_access_logs.py          # 기존 데이터 유지, 부족분만 추가
    python setup_dummy_data_5_access_logs.py --reset  # 기존 데이터 삭제 후 새로 생성

선행 조건:
    python setup_dummy_data_1_base.py      # 기본 더미 데이터 (역할/사용자)
"""

import os
import sys
from pathlib import Path
from datetime import timedelta
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


# ============================================================
# 샘플 데이터
# ============================================================

# API 경로 및 메뉴 매핑
API_PATHS = [
    ('/api/patients', '환자 관리', ['GET', 'POST']),
    ('/api/patients/{id}', '환자 관리', ['GET', 'PUT', 'DELETE']),
    ('/api/encounters', '진료 관리', ['GET', 'POST']),
    ('/api/encounters/{id}', '진료 관리', ['GET', 'PUT']),
    ('/api/imaging', '영상 검사', ['GET']),
    ('/api/imaging/{id}', '영상 검사', ['GET']),
    ('/api/ocs', 'OCS', ['GET', 'POST']),
    ('/api/ocs/{id}', 'OCS', ['GET', 'PUT']),
    ('/api/reports', '판독 결과', ['GET', 'POST']),
    ('/api/reports/{id}', '판독 결과', ['GET', 'PUT']),
    ('/api/ai-inference', 'AI 추론', ['GET', 'POST']),
    ('/api/ai-inference/{id}', 'AI 추론', ['GET']),
    ('/api/treatment', '치료 계획', ['GET', 'POST']),
    ('/api/treatment/{id}', '치료 계획', ['GET', 'PUT']),
    ('/api/followup', '경과 기록', ['GET', 'POST']),
    ('/api/prescriptions', '처방 관리', ['GET', 'POST']),
    ('/api/schedules', '일정 관리', ['GET', 'POST']),
    ('/api/menus', '메뉴 관리', ['GET']),
    ('/api/patients/export', '환자 관리', ['GET']),  # 엑셀 다운로드
    ('/api/reports/export', '판독 결과', ['GET']),   # 엑셀 다운로드
]

# HTTP 메서드 → action 매핑
METHOD_ACTION_MAP = {
    'GET': 'VIEW',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE',
}

# User-Agent 샘플
USER_AGENTS = [
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0',
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15',
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0',
]

# IP 주소 샘플 (사설 IP)
IP_ADDRESSES = [
    '192.168.1.100', '192.168.1.101', '192.168.1.102', '192.168.1.103',
    '192.168.1.110', '192.168.1.111', '192.168.1.120', '192.168.1.121',
    '10.0.0.50', '10.0.0.51', '10.0.0.52', '10.0.0.60',
    '172.16.0.10', '172.16.0.11', '172.16.0.20',
]

# 실패 사유 샘플
FAIL_REASONS = [
    '권한 없음',
    '존재하지 않는 리소스',
    '유효하지 않은 요청 데이터',
    '세션 만료',
    '잘못된 파라미터',
]


def create_access_logs(target_count=200, reset=False, force=False):
    """접근 감사 로그 더미 데이터 생성"""
    print(f"\n[접근 감사 로그] 더미 데이터 생성 (목표: {target_count}건)...")

    from apps.audit.models import AccessLog
    from apps.accounts.models import User

    # 리셋 모드
    if reset:
        deleted_count = AccessLog.objects.all().delete()[0]
        print(f"[INFO] 기존 AccessLog {deleted_count}건 삭제됨")

    # 기존 데이터 확인
    existing_count = AccessLog.objects.count()
    if existing_count >= target_count and not force:
        print(f"[SKIP] 이미 {existing_count}건의 AccessLog가 존재합니다.")
        return True

    # 사용자 목록 (PATIENT 제외)
    users = list(User.objects.filter(is_active=True).exclude(role__code='PATIENT').select_related('role'))
    if not users:
        print("[ERROR] 활성 사용자가 없습니다.")
        return False

    print(f"  사용 가능한 사용자: {len(users)}명")

    created_count = 0
    needed = target_count - existing_count if not reset else target_count

    now = timezone.now()

    for i in range(needed):
        user = random.choice(users)

        # 랜덤 API 경로 선택
        path_info = random.choice(API_PATHS)
        base_path = path_info[0]
        menu_name = path_info[1]
        methods = path_info[2]

        # 경로에 ID 치환
        if '{id}' in base_path:
            path = base_path.replace('{id}', str(random.randint(1, 100)))
        else:
            path = base_path

        method = random.choice(methods)

        # action 결정
        if 'export' in path.lower():
            action = 'EXPORT'
        else:
            action = METHOD_ACTION_MAP.get(method, 'VIEW')

        # 결과 결정 (95% 성공, 5% 실패)
        is_success = random.random() > 0.05
        result = 'SUCCESS' if is_success else 'FAIL'

        # HTTP 상태 코드
        if is_success:
            if method == 'POST':
                response_status = 201
            elif method == 'DELETE':
                response_status = 204
            else:
                response_status = 200
        else:
            response_status = random.choice([400, 401, 403, 404, 500])

        # 실패 사유
        fail_reason = None
        if not is_success:
            fail_reason = random.choice(FAIL_REASONS)

        # 요청 파라미터
        request_params = None
        if method == 'GET' and random.random() > 0.5:
            request_params = {'page': random.randint(1, 10), 'page_size': 20}
        elif method in ['POST', 'PUT'] and random.random() > 0.3:
            request_params = {'field1': 'value1', 'field2': 'value2'}

        # 시간 (최근 30일 내)
        days_ago = random.randint(0, 30)
        hours_ago = random.randint(0, 23)
        minutes_ago = random.randint(0, 59)
        created_at = now - timedelta(days=days_ago, hours=hours_ago, minutes=minutes_ago)

        # 처리 시간 (50ms ~ 2000ms)
        duration_ms = random.randint(50, 2000)

        try:
            log = AccessLog.objects.create(
                user=user,
                user_role=user.role.name if user.role else None,
                request_method=method,
                request_path=path,
                request_params=request_params,
                menu_name=menu_name,
                action=action,
                ip_address=random.choice(IP_ADDRESSES),
                user_agent=random.choice(USER_AGENTS),
                result=result,
                fail_reason=fail_reason,
                response_status=response_status,
                duration_ms=duration_ms,
            )
            # created_at 수동 업데이트 (auto_now_add 우회)
            AccessLog.objects.filter(pk=log.pk).update(created_at=created_at)
            created_count += 1

        except Exception as e:
            print(f"  [ERROR] AccessLog 생성 실패: {e}")

    print(f"[OK] AccessLog 생성: {created_count}건")
    print(f"  현재 전체 AccessLog: {AccessLog.objects.count()}건")

    # 통계
    success_count = AccessLog.objects.filter(result='SUCCESS').count()
    fail_count = AccessLog.objects.filter(result='FAIL').count()
    print(f"  - 성공: {success_count}건")
    print(f"  - 실패: {fail_count}건")

    return True


def print_summary():
    """요약 출력"""
    from apps.audit.models import AccessLog, AuditLog

    print("\n" + "="*60)
    print("접근 감사 로그 더미 데이터 생성 완료!")
    print("="*60)

    print(f"\n[통계]")
    print(f"  - 인증 로그 (AuditLog): {AuditLog.objects.count()}건")
    print(f"  - 접근 로그 (AccessLog): {AccessLog.objects.count()}건")

    # action별 통계
    from django.db.models import Count
    action_stats = AccessLog.objects.values('action').annotate(count=Count('id')).order_by('-count')
    print(f"\n[접근 유형별]")
    for stat in action_stats:
        print(f"  - {stat['action']}: {stat['count']}건")


def main():
    """메인 실행 함수"""
    parser = argparse.ArgumentParser(description='Brain Tumor CDSS 접근 감사 로그 더미 데이터 생성')
    parser.add_argument('--reset', action='store_true', help='기존 데이터 삭제 후 새로 생성')
    parser.add_argument('--force', action='store_true', help='목표 수량 이상이어도 강제 추가')
    parser.add_argument('--count', type=int, default=200, help='생성할 로그 수 (기본: 200)')
    args = parser.parse_args()

    print("="*60)
    print("Brain Tumor CDSS - 접근 감사 로그 더미 데이터 생성")
    print("="*60)

    # AccessLog 더미 데이터 생성
    create_access_logs(
        target_count=args.count,
        reset=args.reset,
        force=args.force
    )

    # 요약 출력
    print_summary()


if __name__ == '__main__':
    main()
