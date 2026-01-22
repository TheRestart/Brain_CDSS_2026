from rest_framework.views import exception_handler
from rest_framework.response import Response
from .exceptions import CDSSException
from datetime import datetime
import logging

logger = logging.getLogger(__name__)


def custom_exception_handler(exc, context):
    """DRF 기본 핸들러 + CDSS 커스텀 핸들러"""

    # CDSS 커스텀 예외 처리
    if isinstance(exc, CDSSException):
        logger.warning(f"CDSS Exception: {exc.code} - {exc.message}", extra={
            'code': exc.code,
            'detail': exc.detail_info,
            'field': exc.field,
            'view': context.get('view'),
            'request': context.get('request')
        })
        return Response(exc.get_full_details(), status=exc.status_code)

    # DRF 기본 예외 처리 (ValidationError, NotFound 등)
    response = exception_handler(exc, context)

    if response is not None:
        # DRF 예외를 표준 형식으로 변환
        error_detail = {
            'error': {
                'code': 'ERR_500',
                'message': str(response.data.get('detail', '요청 처리 중 오류가 발생했습니다.')),
                'timestamp': datetime.utcnow().isoformat() + 'Z'
            }
        }

        # ValidationError의 경우 field 정보 포함
        if hasattr(response.data, 'items'):
            for field, errors in response.data.items():
                if field != 'detail':
                    error_detail['error']['field'] = field
                    error_detail['error']['detail'] = str(errors[0]) if isinstance(errors, list) else str(errors)
                    error_detail['error']['code'] = 'ERR_101'
                    break

        response.data = error_detail
        logger.warning(f"DRF Exception: {error_detail['error']['code']} - {error_detail['error']['message']}")
        return response

    # 예상치 못한 예외 (500 에러)
    logger.error(f"Unexpected Exception: {str(exc)}", exc_info=True, extra={
        'view': context.get('view'),
        'request': context.get('request')
    })

    return Response({
        'error': {
            'code': 'ERR_500',
            'message': '서버 내부 오류가 발생했습니다. 관리자에게 문의해주세요.',
            'timestamp': datetime.utcnow().isoformat() + 'Z'
        }
    }, status=500)
