from rest_framework import generics, filters, status
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.views import APIView
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django_filters import FilterSet, CharFilter, ChoiceFilter, DateFilter
from django.db.models import Count, Max

from .models import AuditLog, AccessLog
from .serializers import AuditLogSerializer, AccessLogSerializer, AccessLogDetailSerializer


class AuditLogPagination(PageNumberPagination):
    """감사 로그 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class AuditLogFilter(FilterSet):
    """인증 감사 로그 필터"""
    user_login_id = CharFilter(field_name='user__login_id', lookup_expr='icontains')
    action = ChoiceFilter(choices=AuditLog.ACTION_CHOICES)
    date = DateFilter(field_name='created_at', lookup_expr='date')
    date_from = DateFilter(field_name='created_at', lookup_expr='date__gte')
    date_to = DateFilter(field_name='created_at', lookup_expr='date__lte')

    class Meta:
        model = AuditLog
        fields = ['user_login_id', 'action', 'date', 'date_from', 'date_to']


class AuditLogListView(generics.ListAPIView):
    """
    인증 감사 로그 목록 조회 API
    - 관리자 전용
    - 필터: user_login_id, action, date, date_from, date_to
    - 정렬: created_at (기본 내림차순)
    """
    queryset = AuditLog.objects.select_related('user', 'user__role').order_by('-created_at')
    serializer_class = AuditLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = AuditLogPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AuditLogFilter
    ordering_fields = ['created_at', 'action']
    ordering = ['-created_at']


class AccessLogFilter(FilterSet):
    """접근 감사 로그 필터"""
    user_login_id = CharFilter(field_name='user__login_id', lookup_expr='icontains')
    user_role = CharFilter(field_name='user_role', lookup_expr='icontains')
    ip_address = CharFilter(field_name='ip_address', lookup_expr='icontains')
    action = ChoiceFilter(choices=AccessLog.ACTION_CHOICES)
    result = ChoiceFilter(choices=AccessLog.RESULT_CHOICES)
    date = DateFilter(field_name='created_at', lookup_expr='date')
    date_from = DateFilter(field_name='created_at', lookup_expr='date__gte')
    date_to = DateFilter(field_name='created_at', lookup_expr='date__lte')

    class Meta:
        model = AccessLog
        fields = ['user_login_id', 'user_role', 'ip_address', 'action', 'result', 'date', 'date_from', 'date_to']


class AccessLogListView(generics.ListAPIView):
    """
    접근 감사 로그 목록 조회 API
    - 관리자 전용
    - 필터: user_login_id, user_role, ip_address, action, result, date_from, date_to
    - 정렬: created_at (기본 내림차순)
    """
    queryset = AccessLog.objects.select_related('user').order_by('-created_at')
    serializer_class = AccessLogSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = AuditLogPagination
    filter_backends = [DjangoFilterBackend, filters.OrderingFilter]
    filterset_class = AccessLogFilter
    ordering_fields = ['created_at', 'action', 'result']
    ordering = ['-created_at']


class AccessLogDetailView(generics.RetrieveAPIView):
    """
    접근 감사 로그 상세 조회 API
    - 관리자 전용
    """
    queryset = AccessLog.objects.select_related('user')
    serializer_class = AccessLogDetailSerializer
    permission_classes = [IsAuthenticated]


class AccessLogSummaryView(APIView):
    """
    접근 감사 로그 요약 정보 API
    - 총 로그 건수
    - 최근 접근 시간
    - 실패 건수
    """
    permission_classes = [IsAuthenticated]

    def get(self, request):
        # 필터 조건 적용
        queryset = AccessLog.objects.all()

        # 필터 파라미터 처리
        user_login_id = request.query_params.get('user_login_id')
        user_role = request.query_params.get('user_role')
        ip_address = request.query_params.get('ip_address')
        action = request.query_params.get('action')
        result = request.query_params.get('result')
        date_from = request.query_params.get('date_from')
        date_to = request.query_params.get('date_to')

        if user_login_id:
            queryset = queryset.filter(user__login_id__icontains=user_login_id)
        if user_role:
            queryset = queryset.filter(user_role__icontains=user_role)
        if ip_address:
            queryset = queryset.filter(ip_address__icontains=ip_address)
        if action:
            queryset = queryset.filter(action=action)
        if result:
            queryset = queryset.filter(result=result)
        if date_from:
            queryset = queryset.filter(created_at__date__gte=date_from)
        if date_to:
            queryset = queryset.filter(created_at__date__lte=date_to)

        # 집계
        total_count = queryset.count()
        latest_access = queryset.aggregate(latest=Max('created_at'))['latest']
        fail_count = queryset.filter(result='FAIL').count()

        return Response({
            'total_count': total_count,
            'latest_access': latest_access,
            'fail_count': fail_count,
        })
