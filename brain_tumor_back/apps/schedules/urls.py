from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import (
    DoctorScheduleViewSet,
    SharedScheduleViewSet,
    PersonalScheduleViewSet,
    UnifiedCalendarView,
)

app_name = 'schedules'

router = DefaultRouter()
# 기존 의사 일정 (하위 호환성)
router.register(r'doctor', DoctorScheduleViewSet, basename='doctor-schedule')
# 공유 일정 (Admin 전용)
router.register(r'shared', SharedScheduleViewSet, basename='shared-schedule')
# 개인 일정 (모든 사용자)
router.register(r'personal', PersonalScheduleViewSet, basename='personal-schedule')

urlpatterns = [
    # 통합 캘린더 API (Dashboard/진료탭용)
    path('calendar/unified/', UnifiedCalendarView.as_view(), name='unified-calendar'),
    # ViewSet 라우터
    path('', include(router.urls)),
]

# =============================================================================
# 생성된 URL 패턴:
# =============================================================================
# 통합 캘린더 (모든 사용자)
# GET    /api/schedules/calendar/unified/?year=&month=&patient_id=  - 통합 캘린더
#
# 기존 의사 일정 (하위 호환성)
# GET    /api/schedules/doctor/                 - 의사 일정 목록
# POST   /api/schedules/doctor/                 - 의사 일정 생성
# GET    /api/schedules/doctor/{id}/            - 의사 일정 상세
# PATCH  /api/schedules/doctor/{id}/            - 의사 일정 수정
# DELETE /api/schedules/doctor/{id}/            - 의사 일정 삭제
# GET    /api/schedules/doctor/calendar/        - 의사 캘린더용 월별 일정
# GET    /api/schedules/doctor/today/           - 의사 오늘 일정
# GET    /api/schedules/doctor/this-week/       - 의사 이번 주 일정
#
# 공유 일정 (Admin 전용)
# GET    /api/schedules/shared/                 - 공유 일정 목록
# POST   /api/schedules/shared/                 - 공유 일정 생성
# GET    /api/schedules/shared/{id}/            - 공유 일정 상세
# PATCH  /api/schedules/shared/{id}/            - 공유 일정 수정
# DELETE /api/schedules/shared/{id}/            - 공유 일정 삭제
#
# 개인 일정 (모든 사용자)
# GET    /api/schedules/personal/               - 개인 일정 목록
# POST   /api/schedules/personal/               - 개인 일정 생성
# GET    /api/schedules/personal/{id}/          - 개인 일정 상세
# PATCH  /api/schedules/personal/{id}/          - 개인 일정 수정
# DELETE /api/schedules/personal/{id}/          - 개인 일정 삭제
# =============================================================================
