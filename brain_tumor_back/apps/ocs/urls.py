from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import OCSViewSet, OCSProcessStatusView, UserLoginStatusView, ExternalPatientOCSCreateView


# =============================================================================
# OCS URLs - 단일 테이블 설계
# =============================================================================
# 상세 기획: ocs_제작기획.md 참조
# =============================================================================

router = DefaultRouter()
router.register(r'', OCSViewSet, basename='ocs')

urlpatterns = [
    # OCS 처리 현황 API (RIS + LIS 통합)
    path('process-status/', OCSProcessStatusView.as_view(), name='ocs-process-status'),
    # 사용자 로그인 현황 API (RIS + LIS)
    path('user-login-status/', UserLoginStatusView.as_view(), name='user-login-status'),
    # 외부환자 등록 + OCS 생성 통합 API
    path('external-patient-ocs/', ExternalPatientOCSCreateView.as_view(), name='external-patient-ocs'),
    path('', include(router.urls)),
]

# =============================================================================
# 생성된 URL 패턴:
# =============================================================================
# GET    /api/ocs/process-status/      - OCS 처리 현황 (RIS + LIS 통합)
# GET    /api/ocs/                     - OCS 목록 조회
# POST   /api/ocs/                     - OCS 생성
# GET    /api/ocs/{id}/                - OCS 상세 조회
# PATCH  /api/ocs/{id}/                - OCS 수정
# DELETE /api/ocs/{id}/                - OCS 삭제 (Soft Delete)
#
# GET    /api/ocs/by_ocs_id/?ocs_id=   - ocs_id로 조회
# GET    /api/ocs/pending/             - 미완료 OCS 목록
# GET    /api/ocs/by_patient/?patient_id= - 환자별 OCS 목록
# GET    /api/ocs/by_doctor/?doctor_id=   - 의사별 OCS 목록
# GET    /api/ocs/by_worker/?worker_id=   - 작업자별 OCS 목록
#
# POST   /api/ocs/{id}/accept/         - 오더 접수
# POST   /api/ocs/{id}/start/          - 작업 시작
# POST   /api/ocs/{id}/save_result/    - 결과 임시 저장
# POST   /api/ocs/{id}/submit_result/  - 결과 제출
# POST   /api/ocs/{id}/confirm/        - 확정
# POST   /api/ocs/{id}/cancel/         - 취소
#
# GET    /api/ocs/{id}/history/        - OCS 이력 조회
# =============================================================================
