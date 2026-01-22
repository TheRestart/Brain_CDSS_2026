from django.contrib import admin
from django.urls import path, include

from rest_framework_simplejwt.views import TokenRefreshView
from apps.authorization.views import CustomTokenObtainPairView
from drf_spectacular.views import (
    SpectacularAPIView,
    SpectacularSwaggerView,
)
from apps.common.views import (
    AdminDashboardStatsView,
    ExternalDashboardStatsView,
    DoctorDashboardStatsView,
    HealthCheckView,
    SystemMonitorView,
    MonitorAlertConfigView,
    MonitorAlertAcknowledgeView,
    PdfWatermarkConfigView,
    DummyDataSetupView,
)


urlpatterns = [
    # Health Check (Docker/K8s용 - 인증 불필요)
    path("health/", HealthCheckView.as_view(), name="health_check"),

    path("admin/", admin.site.urls),
    path("api/auth/", include("apps.authorization.urls")), 
    path("api/token/", CustomTokenObtainPairView.as_view(), name="token_obtain_pair"),
    path("api/auth/refresh/", TokenRefreshView.as_view(), name="token_refresh"), # Refresh 토큰 재발급 API

    # 사용자 관리 API
    path("api/users/", include("apps.accounts.urls")),

    # 환자 관리 API
    path("api/patients/", include("apps.patients.urls")),

    # 진료 관리 API
    path("api/encounters/", include("apps.encounters.urls")),

    # 영상 관리 API
    path("api/imaging/", include("apps.imaging.urls")),

    # OCS (Order Communication System) API
    path("api/ocs/", include("apps.ocs.urls")),

    # AI Inference API
    path("api/ai/", include("apps.ai_inference.urls")),
    
    # 치료 관리 API
    path("api/treatment/", include("apps.treatment.urls")),

    # 경과 추적 API
    path("api/followup/", include("apps.followup.urls")),
    
    # 처방 관리 API
    path("api/prescriptions/", include("apps.prescriptions.urls")),

    # API 문서화 엔드포인트
    path("api/schema/", SpectacularAPIView.as_view(), name="schema"),
    path(
        "api/docs/",
        SpectacularSwaggerView.as_view(url_name="schema"),
        name="swagger-ui",
    ),
    
    # Orthanc 프록시
    path("api/orthanc/", include("apps.orthancproxy.urls")),

    # Dashboard API
    path("api/dashboard/admin/stats/", AdminDashboardStatsView.as_view()),
    path("api/dashboard/external/stats/", ExternalDashboardStatsView.as_view()),
    path("api/dashboard/doctor/stats/", DoctorDashboardStatsView.as_view()),

    # System Monitor API
    path("api/system/monitor/", SystemMonitorView.as_view(), name="system_monitor"),
    path("api/system/monitor/acknowledge/", MonitorAlertAcknowledgeView.as_view(), name="monitor_alert_acknowledge"),
    path("api/system/config/monitor-alerts/", MonitorAlertConfigView.as_view(), name="monitor_alert_config"),
    path("api/system/config/pdf-watermark/", PdfWatermarkConfigView.as_view(), name="pdf_watermark_config"),
    path("api/system/dummy-data-setup/", DummyDataSetupView.as_view(), name="dummy_data_setup"),

    # 진료 보고서 API
    path("api/reports/", include("apps.reports.urls")),

    # 의사 일정 API
    path("api/schedules/", include("apps.schedules.urls")),

    # 감사 로그 API
    path("api/audit/", include("apps.audit.urls")),
]
