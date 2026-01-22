from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated, BasePermission
from rest_framework.pagination import PageNumberPagination
from rest_framework.views import APIView
from django.utils import timezone
from django.db.models import Q
from datetime import timedelta
from drf_spectacular.utils import extend_schema, extend_schema_view, OpenApiParameter

from .models import DoctorSchedule, SharedSchedule, PersonalSchedule
from .serializers import (
    DoctorScheduleListSerializer,
    DoctorScheduleDetailSerializer,
    DoctorScheduleCreateSerializer,
    DoctorScheduleUpdateSerializer,
    DoctorScheduleCalendarSerializer,
    SharedScheduleListSerializer,
    SharedScheduleCreateSerializer,
    SharedScheduleUpdateSerializer,
    SharedScheduleCalendarSerializer,
    PersonalScheduleListSerializer,
    PersonalScheduleCreateSerializer,
    PersonalScheduleUpdateSerializer,
    PersonalScheduleCalendarSerializer,
)


# =============================================================================
# 권한 클래스
# =============================================================================
class IsAdminUser(BasePermission):
    """Admin 또는 SystemManager 권한 체크"""
    def has_permission(self, request, view):
        return (
            request.user and
            request.user.is_authenticated and
            request.user.role and
            request.user.role.code in ('ADMIN', 'SYSTEMMANAGER')
        )


class DoctorSchedulePagination(PageNumberPagination):
    """일정 목록 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


@extend_schema_view(
    list=extend_schema(
        summary="의사 일정 목록 조회",
        description="현재 로그인한 의사의 일정 목록을 조회합니다.",
        parameters=[
            OpenApiParameter(name='schedule_type', description='일정 유형 필터', type=str),
            OpenApiParameter(name='start_date', description='시작일 (YYYY-MM-DD)', type=str),
            OpenApiParameter(name='end_date', description='종료일 (YYYY-MM-DD)', type=str),
        ]
    ),
    retrieve=extend_schema(summary="의사 일정 상세 조회"),
    create=extend_schema(summary="의사 일정 생성"),
    partial_update=extend_schema(summary="의사 일정 수정"),
    destroy=extend_schema(summary="의사 일정 삭제"),
)
class DoctorScheduleViewSet(viewsets.ModelViewSet):
    """
    의사 일정 CRUD ViewSet

    의사의 개인 일정(회의, 휴가, 교육 등)을 관리합니다.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = DoctorSchedulePagination

    def get_queryset(self):
        """현재 사용자의 일정만 조회"""
        queryset = DoctorSchedule.objects.filter(
            doctor=self.request.user,
            is_deleted=False
        )

        # 일정 유형 필터
        schedule_type = self.request.query_params.get('schedule_type')
        if schedule_type:
            queryset = queryset.filter(schedule_type=schedule_type)

        # 날짜 범위 필터
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(start_datetime__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_datetime__date__lte=end_date)

        return queryset.order_by('start_datetime')

    def get_serializer_class(self):
        """액션별 Serializer 선택"""
        if self.action == 'list':
            return DoctorScheduleListSerializer
        elif self.action == 'create':
            return DoctorScheduleCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return DoctorScheduleUpdateSerializer
        elif self.action == 'calendar':
            return DoctorScheduleCalendarSerializer
        return DoctorScheduleDetailSerializer

    def perform_destroy(self, instance):
        """Soft Delete"""
        instance.is_deleted = True
        instance.save()

    @extend_schema(
        summary="캘린더용 일정 조회",
        description="지정된 월의 일정을 캘린더 표시용 간소화된 형식으로 반환합니다.",
        parameters=[
            OpenApiParameter(name='year', description='년도 (YYYY)', type=int, required=True),
            OpenApiParameter(name='month', description='월 (1-12)', type=int, required=True),
        ]
    )
    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """캘린더용 월별 일정 조회"""
        year = request.query_params.get('year')
        month = request.query_params.get('month')

        if not year or not month:
            return Response(
                {'detail': 'year와 month 파라미터가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            year = int(year)
            month = int(month)
        except ValueError:
            return Response(
                {'detail': 'year와 month는 숫자여야 합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 해당 월의 시작/끝 계산
        start_date = timezone.datetime(year, month, 1, tzinfo=timezone.get_current_timezone())
        if month == 12:
            end_date = timezone.datetime(year + 1, 1, 1, tzinfo=timezone.get_current_timezone())
        else:
            end_date = timezone.datetime(year, month + 1, 1, tzinfo=timezone.get_current_timezone())

        # 일정 조회 (해당 월에 걸치는 모든 일정)
        schedules = DoctorSchedule.objects.filter(
            doctor=request.user,
            is_deleted=False,
            start_datetime__lt=end_date,
            end_datetime__gte=start_date
        ).order_by('start_datetime')

        serializer = DoctorScheduleCalendarSerializer(schedules, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="오늘 일정 조회",
        description="오늘의 일정을 조회합니다."
    )
    @action(detail=False, methods=['get'])
    def today(self, request):
        """오늘의 일정 조회"""
        now = timezone.now()
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)
        today_end = today_start + timedelta(days=1)

        schedules = DoctorSchedule.objects.filter(
            doctor=request.user,
            is_deleted=False,
            start_datetime__lt=today_end,
            end_datetime__gte=today_start
        ).order_by('start_datetime')

        serializer = DoctorScheduleListSerializer(schedules, many=True)
        return Response(serializer.data)

    @extend_schema(
        summary="이번 주 일정 조회",
        description="이번 주의 일정을 조회합니다."
    )
    @action(detail=False, methods=['get'], url_path='this-week')
    def this_week(self, request):
        """이번 주 일정 조회"""
        now = timezone.now()
        today = now.replace(hour=0, minute=0, second=0, microsecond=0)

        # 이번 주 월요일
        week_start = today - timedelta(days=today.weekday())
        week_end = week_start + timedelta(days=7)

        schedules = DoctorSchedule.objects.filter(
            doctor=request.user,
            is_deleted=False,
            start_datetime__lt=week_end,
            end_datetime__gte=week_start
        ).order_by('start_datetime')

        serializer = DoctorScheduleListSerializer(schedules, many=True)
        return Response(serializer.data)


# =============================================================================
# 공유 일정 ViewSet (Admin 전용)
# =============================================================================
@extend_schema_view(
    list=extend_schema(summary="공유 일정 목록 조회 (Admin)"),
    retrieve=extend_schema(summary="공유 일정 상세 조회"),
    create=extend_schema(summary="공유 일정 생성"),
    partial_update=extend_schema(summary="공유 일정 수정"),
    destroy=extend_schema(summary="공유 일정 삭제"),
)
class SharedScheduleViewSet(viewsets.ModelViewSet):
    """
    공유 일정 CRUD ViewSet (Admin 전용)

    Admin이 권한별 공유 일정을 관리합니다.
    """
    permission_classes = [IsAuthenticated, IsAdminUser]
    pagination_class = None  # 페이지네이션 없이 전체 목록 반환

    def get_queryset(self):
        queryset = SharedSchedule.objects.filter(is_deleted=False)

        # visibility 필터
        visibility = self.request.query_params.get('visibility')
        if visibility:
            queryset = queryset.filter(visibility=visibility)

        # 날짜 범위 필터
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(start_datetime__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_datetime__date__lte=end_date)

        return queryset.order_by('start_datetime')

    def get_serializer_class(self):
        if self.action == 'list':
            return SharedScheduleListSerializer
        elif self.action == 'create':
            return SharedScheduleCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return SharedScheduleUpdateSerializer
        return SharedScheduleListSerializer

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


# =============================================================================
# 개인 일정 ViewSet (모든 사용자)
# =============================================================================
@extend_schema_view(
    list=extend_schema(summary="개인 일정 목록 조회"),
    retrieve=extend_schema(summary="개인 일정 상세 조회"),
    create=extend_schema(summary="개인 일정 생성"),
    partial_update=extend_schema(summary="개인 일정 수정"),
    destroy=extend_schema(summary="개인 일정 삭제"),
)
class PersonalScheduleViewSet(viewsets.ModelViewSet):
    """
    개인 일정 CRUD ViewSet

    모든 사용자가 자신의 개인 일정을 관리합니다.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = DoctorSchedulePagination

    def get_queryset(self):
        queryset = PersonalSchedule.objects.filter(
            user=self.request.user,
            is_deleted=False
        )

        # 일정 유형 필터
        schedule_type = self.request.query_params.get('schedule_type')
        if schedule_type:
            queryset = queryset.filter(schedule_type=schedule_type)

        # 날짜 범위 필터
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(start_datetime__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(start_datetime__date__lte=end_date)

        return queryset.order_by('start_datetime')

    def get_serializer_class(self):
        if self.action == 'list':
            return PersonalScheduleListSerializer
        elif self.action == 'create':
            return PersonalScheduleCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return PersonalScheduleUpdateSerializer
        return PersonalScheduleListSerializer

    def perform_destroy(self, instance):
        instance.is_deleted = True
        instance.save()


# =============================================================================
# 통합 캘린더 API (Dashboard용 / 진료탭용)
# =============================================================================
@extend_schema(
    summary="통합 캘린더 조회",
    description="""
    사용자의 통합 캘린더를 조회합니다.
    - 공유 일정: 전체 공지(ALL) + 사용자 권한에 해당하는 공유 일정
    - 개인 일정: 본인의 개인 일정
    - 환자 일정: patient_id 파라미터 전달 시 해당 환자의 진료 일정 (Encounter)
    """,
    parameters=[
        OpenApiParameter(name='year', description='년도 (YYYY)', type=int, required=True),
        OpenApiParameter(name='month', description='월 (1-12)', type=int, required=True),
        OpenApiParameter(name='patient_id', description='환자 ID (진료탭용)', type=int, required=False),
    ]
)
class UnifiedCalendarView(APIView):
    """통합 캘린더 API"""
    permission_classes = [IsAuthenticated]

    def get(self, request):
        year = request.query_params.get('year')
        month = request.query_params.get('month')
        patient_id = request.query_params.get('patient_id')

        if not year or not month:
            return Response(
                {'detail': 'year와 month 파라미터가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        try:
            year = int(year)
            month = int(month)
        except ValueError:
            return Response(
                {'detail': 'year와 month는 숫자여야 합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 해당 월의 시작/끝 계산
        start_date = timezone.datetime(year, month, 1, tzinfo=timezone.get_current_timezone())
        if month == 12:
            end_date = timezone.datetime(year + 1, 1, 1, tzinfo=timezone.get_current_timezone())
        else:
            end_date = timezone.datetime(year, month + 1, 1, tzinfo=timezone.get_current_timezone())

        user = request.user
        user_role = user.role.code if user.role else None

        # 1. 공유 일정 조회 (전체 공지 + 사용자 권한)
        shared_filter = Q(is_deleted=False) & Q(
            start_datetime__lt=end_date,
            end_datetime__gte=start_date
        ) & (
            Q(visibility='ALL') | Q(visibility=user_role)
        )
        shared_schedules = SharedSchedule.objects.filter(shared_filter).order_by('start_datetime')
        shared_data = SharedScheduleCalendarSerializer(shared_schedules, many=True).data

        # 2. 개인 일정 조회
        personal_schedules = PersonalSchedule.objects.filter(
            user=user,
            is_deleted=False,
            start_datetime__lt=end_date,
            end_datetime__gte=start_date
        ).order_by('start_datetime')
        personal_data = PersonalScheduleCalendarSerializer(personal_schedules, many=True).data

        # 3. 환자 일정 조회 (patient_id가 있을 경우)
        patient_data = []
        if patient_id:
            try:
                from apps.encounters.models import Encounter
                patient_encounters = Encounter.objects.filter(
                    patient_id=patient_id,
                    is_deleted=False
                ).filter(
                    Q(encounter_date__gte=start_date.date(), encounter_date__lt=end_date.date()) |
                    Q(admission_date__gte=start_date.date(), admission_date__lt=end_date.date())
                ).order_by('encounter_date')

                for enc in patient_encounters:
                    enc_date = enc.admission_date or enc.encounter_date
                    patient_data.append({
                        'id': enc.id,
                        'title': f'{enc.get_encounter_type_display()} - {enc.get_status_display()}',
                        'schedule_type': 'patient',
                        'schedule_type_display': '환자 진료',
                        'start': enc_date.isoformat() if enc_date else None,
                        'end': enc_date.isoformat() if enc_date else None,
                        'all_day': True,
                        'color': '#f59e0b',  # 노랑
                        'scope': 'patient',
                        'patient_id': patient_id,
                    })
            except Exception:
                pass  # Encounter 앱이 없거나 오류 시 무시

        return Response({
            'shared': shared_data,
            'personal': personal_data,
            'patient': patient_data,
        })
