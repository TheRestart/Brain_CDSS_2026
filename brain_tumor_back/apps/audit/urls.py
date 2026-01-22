from django.urls import path
from .views import (
    AuditLogListView,
    AccessLogListView,
    AccessLogDetailView,
    AccessLogSummaryView,
)

urlpatterns = [
    # 인증 감사 로그 (로그인/로그아웃)
    path('', AuditLogListView.as_view(), name='audit-log-list'),

    # 접근 감사 로그 (시스템 행위)
    path('access/', AccessLogListView.as_view(), name='access-log-list'),
    path('access/summary/', AccessLogSummaryView.as_view(), name='access-log-summary'),
    path('access/<int:pk>/', AccessLogDetailView.as_view(), name='access-log-detail'),
]
