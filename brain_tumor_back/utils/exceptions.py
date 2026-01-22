from rest_framework.exceptions import APIException
from rest_framework import status
from datetime import datetime


class CDSSException(APIException):
    """CDSS 프로젝트 기본 예외 클래스"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'ERR_500'
    default_detail = '서버 내부 오류가 발생했습니다.'

    def __init__(self, code=None, message=None, detail=None, field=None, status_code=None):
        super().__init__(detail=message or self.default_detail)
        self.code = code or self.default_code
        self.message = message or self.default_detail
        self.detail_info = detail
        self.field = field
        if status_code:
            self.status_code = status_code

    def get_full_details(self):
        error_detail = {
            'code': self.code,
            'message': self.message,
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
        if self.detail_info:
            error_detail['detail'] = self.detail_info
        if self.field:
            error_detail['field'] = self.field
        return {'error': error_detail}


class AuthenticationFailedException(CDSSException):
    """인증 실패 예외"""
    status_code = status.HTTP_401_UNAUTHORIZED
    default_code = 'ERR_001'
    default_detail = '인증에 실패했습니다. 다시 로그인해주세요.'


class PermissionDeniedException(CDSSException):
    """권한 거부 예외"""
    status_code = status.HTTP_403_FORBIDDEN
    default_code = 'ERR_002'
    default_detail = '해당 작업을 수행할 권한이 없습니다.'


class ValidationException(CDSSException):
    """유효성 검증 실패 예외"""
    status_code = status.HTTP_400_BAD_REQUEST
    default_code = 'ERR_101'
    default_detail = '입력값이 올바르지 않습니다.'


class ResourceNotFoundException(CDSSException):
    """리소스 없음 예외"""
    status_code = status.HTTP_404_NOT_FOUND
    default_code = 'ERR_201'
    default_detail = '요청한 리소스를 찾을 수 없습니다.'


class ConflictException(CDSSException):
    """충돌 예외 (락킹, 중복)"""
    status_code = status.HTTP_409_CONFLICT
    default_code = 'ERR_301'
    default_detail = '데이터 충돌이 발생했습니다.'


class BusinessLogicException(CDSSException):
    """비즈니스 로직 위반 예외"""
    status_code = status.HTTP_422_UNPROCESSABLE_ENTITY
    default_code = 'ERR_401'
    default_detail = '비즈니스 규칙을 위반했습니다.'


class ExternalSystemException(CDSSException):
    """외부 시스템 연동 실패 예외"""
    status_code = status.HTTP_502_BAD_GATEWAY
    default_code = 'ERR_501'
    default_detail = '외부 시스템 연동에 실패했습니다.'
