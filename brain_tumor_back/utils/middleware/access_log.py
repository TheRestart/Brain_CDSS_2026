import time
import logging
import json
import re
from django.utils.deprecation import MiddlewareMixin
from django.conf import settings

logger = logging.getLogger('access')


# AccessLog 기록 대상 경로 패턴 (API 경로만)
ACCESS_LOG_PATTERNS = [
    r'^/api/patients',
    r'^/api/encounters',
    r'^/api/imaging',
    r'^/api/ocs',
    r'^/api/reports',
    r'^/api/ai-inference',
    r'^/api/treatment',
    r'^/api/followup',
    r'^/api/prescriptions',
    r'^/api/schedules',
    r'^/api/menus',
]

# 제외할 경로 (인증, 감사로그 자체 등)
ACCESS_LOG_EXCLUDE_PATTERNS = [
    r'^/api/auth',
    r'^/api/audit',
    r'^/api/admin',
    r'^/static',
    r'^/media',
    r'^/__debug__',
]

# HTTP 메서드 → action 매핑
METHOD_ACTION_MAP = {
    'GET': 'VIEW',
    'POST': 'CREATE',
    'PUT': 'UPDATE',
    'PATCH': 'UPDATE',
    'DELETE': 'DELETE',
}

# 경로 → 메뉴명 매핑
PATH_MENU_MAP = {
    '/api/patients': '환자 관리',
    '/api/encounters': '진료 관리',
    '/api/imaging': '영상 검사',
    '/api/ocs': 'OCS',
    '/api/reports': '판독 결과',
    '/api/ai-inference': 'AI 추론',
    '/api/treatment': '치료 계획',
    '/api/followup': '경과 기록',
    '/api/prescriptions': '처방 관리',
    '/api/schedules': '일정 관리',
    '/api/menus': '메뉴 관리',
}


def get_menu_name(path):
    """경로에서 메뉴명 추출"""
    for prefix, name in PATH_MENU_MAP.items():
        if path.startswith(prefix):
            return name
    return None


def should_log_access(path):
    """AccessLog에 기록할 경로인지 확인"""
    # 제외 패턴 체크
    for pattern in ACCESS_LOG_EXCLUDE_PATTERNS:
        if re.match(pattern, path):
            return False

    # 포함 패턴 체크
    for pattern in ACCESS_LOG_PATTERNS:
        if re.match(pattern, path):
            return True

    return False


def get_client_ip(request):
    """클라이언트 IP 추출"""
    x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
    if x_forwarded_for:
        ip = x_forwarded_for.split(',')[0].strip()
    else:
        ip = request.META.get('REMOTE_ADDR')
    return ip


class AccessLogMiddleware(MiddlewareMixin):
    """모든 요청과 응답을 로깅하는 미들웨어"""

    def process_request(self, request):
        request.start_time = time.time()

    def process_response(self, request, response):
        # 실행 시간 계산
        duration = time.time() - getattr(request, 'start_time', time.time())
        duration_ms = int(duration * 1000)

        path = request.get_full_path()
        ip = get_client_ip(request)

        # 기본 로그 정보 (파일 로그)
        log_data = {
            'ip': ip,
            'method': request.method,
            'path': path,
            'status': response.status_code,
            'duration': f"{duration:.3f}s",
            'user': str(request.user) if request.user.is_authenticated else 'Anonymous',
        }

        # 파일 로그 기록
        message = f"{log_data['ip']} {log_data['user']} {log_data['method']} {log_data['path']} {log_data['status']} ({log_data['duration']})"

        if response.status_code >= 400:
            logger.warning(message)
        else:
            logger.info(message)

        # AccessLog DB 기록 (인증된 사용자 + 대상 경로만)
        if request.user.is_authenticated and should_log_access(path.split('?')[0]):
            try:
                self._save_access_log(request, response, duration_ms)
            except Exception as e:
                logger.error(f"AccessLog 저장 실패: {e}")

        return response

    def _save_access_log(self, request, response, duration_ms):
        """AccessLog DB에 저장"""
        from apps.audit.models import AccessLog

        path = request.get_full_path()
        path_without_query = path.split('?')[0]

        # action 결정
        action = METHOD_ACTION_MAP.get(request.method, 'VIEW')

        # export 감지 (쿼리 파라미터 또는 경로에 export 포함)
        if 'export' in path.lower() or 'download' in path.lower():
            action = 'EXPORT'

        # 결과 결정
        result = 'SUCCESS' if response.status_code < 400 else 'FAIL'

        # 실패 사유
        fail_reason = None
        if result == 'FAIL':
            try:
                if hasattr(response, 'data'):
                    fail_reason = str(response.data)[:500]
            except:
                fail_reason = f"HTTP {response.status_code}"

        # 요청 파라미터 (GET은 쿼리, POST/PUT/PATCH는 body)
        request_params = None
        try:
            if request.method == 'GET':
                if request.GET:
                    request_params = dict(request.GET)
            elif request.method in ['POST', 'PUT', 'PATCH']:
                if hasattr(request, 'data') and request.data:
                    # 민감 정보 제외
                    params = dict(request.data)
                    for key in ['password', 'token', 'secret', 'key']:
                        if key in params:
                            params[key] = '***'
                    request_params = params
        except:
            pass

        AccessLog.objects.create(
            user=request.user,
            user_role=request.user.role.name if request.user.role else None,
            request_method=request.method,
            request_path=path_without_query,
            request_params=request_params,
            menu_name=get_menu_name(path_without_query),
            action=action,
            ip_address=get_client_ip(request),
            user_agent=request.META.get('HTTP_USER_AGENT', '')[:500],
            result=result,
            fail_reason=fail_reason,
            response_status=response.status_code,
            duration_ms=duration_ms,
        )
