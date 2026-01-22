import logging
from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.db import transaction
from django.utils import timezone
from .models import Encounter

logger = logging.getLogger(__name__)
from .serializers import (
    EncounterListSerializer,
    EncounterDetailSerializer,
    EncounterCreateSerializer,
    EncounterUpdateSerializer,
    EncounterSearchSerializer,
    EncounterStatusChangeSerializer,
)


class EncounterPagination(PageNumberPagination):
    """진료 목록 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class EncounterViewSet(viewsets.ModelViewSet):
    """
    진료 CRUD API

    권한 체크는 프론트엔드 라우터에서 관리
    """
    queryset = Encounter.objects.filter(is_deleted=False)
    permission_classes = [IsAuthenticated]
    pagination_class = EncounterPagination

    def get_serializer_class(self):
        """액션별 Serializer 선택"""
        if self.action == 'list':
            return EncounterListSerializer
        elif self.action == 'create':
            return EncounterCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return EncounterUpdateSerializer
        return EncounterDetailSerializer

    def perform_destroy(self, instance):
        """Soft Delete"""
        instance.is_deleted = True
        instance.save()

    def get_queryset(self):
        """검색 및 필터링"""
        queryset = super().get_queryset()

        # 검색 파라미터 처리
        search_serializer = EncounterSearchSerializer(data=self.request.query_params)
        if not search_serializer.is_valid():
            return queryset

        data = search_serializer.validated_data

        # 텍스트 검색 (환자명, 환자번호, 주호소)
        q = data.get('q')
        if q:
            queryset = queryset.filter(
                Q(patient__name__icontains=q) |
                Q(patient__patient_number__icontains=q) |
                Q(chief_complaint__icontains=q)
            )

        # 진료 유형 필터
        encounter_type = data.get('encounter_type')
        if encounter_type:
            queryset = queryset.filter(encounter_type=encounter_type)

        # 진료 상태 필터
        encounter_status = data.get('status')
        if encounter_status:
            queryset = queryset.filter(status=encounter_status)

        # 진료과 필터
        department = data.get('department')
        if department:
            queryset = queryset.filter(department=department)

        # 담당 의사 필터
        attending_doctor = data.get('attending_doctor')
        if attending_doctor:
            queryset = queryset.filter(attending_doctor_id=attending_doctor)

        # 환자 필터
        patient_id = data.get('patient')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)

        # 날짜 범위 필터
        start_date = data.get('start_date')
        end_date = data.get('end_date')
        if start_date:
            queryset = queryset.filter(admission_date__gte=start_date)
        if end_date:
            queryset = queryset.filter(admission_date__lte=end_date)

        # 시간 기준 필터 (past: 현재 시간 이전, future: 현재 시간 이후)
        time_filter = data.get('time_filter')
        if time_filter == 'past':
            queryset = queryset.filter(admission_date__lt=timezone.now())
        elif time_filter == 'future':
            queryset = queryset.filter(admission_date__gte=timezone.now())

        return queryset.select_related('patient', 'attending_doctor').order_by('-admission_date')

    @action(detail=False, methods=['get'])
    def statistics(self, request):
        """진료 통계 조회"""
        queryset = self.get_queryset()

        stats = {
            'total': queryset.count(),
            'by_type': {},
            'by_status': {},
            'by_department': {},
        }

        # 진료 유형별 통계
        for enc_type, label in Encounter.ENCOUNTER_TYPE_CHOICES:
            count = queryset.filter(encounter_type=enc_type).count()
            stats['by_type'][enc_type] = {
                'label': label,
                'count': count
            }

        # 상태별 통계
        for enc_status, label in Encounter.STATUS_CHOICES:
            count = queryset.filter(status=enc_status).count()
            stats['by_status'][enc_status] = {
                'label': label,
                'count': count
            }

        # 진료과별 통계
        for dept, label in Encounter.DEPARTMENT_CHOICES:
            count = queryset.filter(department=dept).count()
            stats['by_department'][dept] = {
                'label': label,
                'count': count
            }

        return Response(stats)

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """진료 완료 처리"""
        try:
            encounter = self.get_object()

            if encounter.status == 'completed':
                return Response(
                    {'detail': '이미 완료된 진료입니다.'},
                    status=status.HTTP_400_BAD_REQUEST
                )

            with transaction.atomic():
                # select_for_update로 동시성 문제 방지
                encounter = Encounter.objects.select_for_update().get(pk=encounter.pk)

                # 다시 한번 상태 확인 (race condition 방지)
                if encounter.status == 'completed':
                    return Response(
                        {'detail': '이미 완료된 진료입니다.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                encounter.status = 'completed'
                now = timezone.now()

                if not encounter.discharge_date:
                    encounter.discharge_date = now

                # 예약 시간(admission_date)이 퇴원 시간보다 미래인 경우
                # 실제 진료 시간으로 조정 (퇴원 1분 전으로 설정)
                update_fields = ['status', 'discharge_date']
                if encounter.admission_date and encounter.admission_date > encounter.discharge_date:
                    from datetime import timedelta
                    encounter.admission_date = encounter.discharge_date - timedelta(minutes=1)
                    update_fields.append('admission_date')

                # update_fields로 필요한 필드만 업데이트 (full_clean 건너뜀)
                encounter.save(update_fields=update_fields)

            serializer = self.get_serializer(encounter)
            return Response(serializer.data)

        except Encounter.DoesNotExist:
            return Response(
                {'detail': '진료를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'진료 완료 처리 중 오류: {e}', exc_info=True)
            return Response(
                {'detail': '진료 완료 처리 중 오류가 발생했습니다.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """진료 취소"""
        encounter = self.get_object()

        if encounter.status == 'completed':
            return Response(
                {'detail': '완료된 진료는 취소할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        encounter.status = 'cancelled'
        encounter.save()

        serializer = self.get_serializer(encounter)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def change_status(self, request, pk=None):
        """
        진료 상태 변경 (간호사용)

        POST /api/encounters/{id}/change_status/
        Body: { "status": "scheduled" | "in_progress" | "completed" | "cancelled" }

        모든 상태 전환이 허용됩니다.
        상태 변경 시 AccessLog 미들웨어에 의해 자동으로 감사 로그가 기록됩니다.
        """
        # 요청 데이터 검증
        serializer = EncounterStatusChangeSerializer(data=request.data)
        if not serializer.is_valid():
            return Response(
                serializer.errors,
                status=status.HTTP_400_BAD_REQUEST
            )

        new_status = serializer.validated_data['status']

        try:
            with transaction.atomic():
                # select_for_update로 동시성 문제 방지
                encounter = Encounter.objects.select_for_update().get(pk=pk, is_deleted=False)
                previous_status = encounter.status

                # 동일한 상태로 변경 시도 시 무시
                if previous_status == new_status:
                    return Response(
                        {'detail': '이미 해당 상태입니다.'},
                        status=status.HTTP_400_BAD_REQUEST
                    )

                # 상태 변경
                encounter.status = new_status
                update_fields = ['status']

                # completed 상태로 변경 시 discharge_date 설정
                if new_status == 'completed' and not encounter.discharge_date:
                    encounter.discharge_date = timezone.now()
                    update_fields.append('discharge_date')

                    # admission_date가 discharge_date보다 미래인 경우 조정
                    if encounter.admission_date and encounter.admission_date > encounter.discharge_date:
                        from datetime import timedelta
                        encounter.admission_date = encounter.discharge_date - timedelta(minutes=1)
                        update_fields.append('admission_date')

                # completed에서 다른 상태로 변경 시 discharge_date 초기화 (선택적)
                elif previous_status == 'completed' and new_status != 'completed':
                    encounter.discharge_date = None
                    update_fields.append('discharge_date')

                encounter.save(update_fields=update_fields)

            # 변경된 진료 정보 반환
            response_serializer = EncounterDetailSerializer(encounter)
            response_data = response_serializer.data
            response_data['previous_status'] = previous_status

            return Response(response_data)

        except Encounter.DoesNotExist:
            return Response(
                {'detail': '진료를 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )
        except Exception as e:
            logger.error(f'진료 상태 변경 중 오류: {e}', exc_info=True)
            return Response(
                {'detail': '진료 상태 변경 중 오류가 발생했습니다.'},
                status=status.HTTP_500_INTERNAL_SERVER_ERROR
            )

    @action(detail=False, methods=['get'])
    def calendar(self, request):
        """
        캘린더용 진료 목록 조회

        Query Parameters:
            - start_date: 시작일 (YYYY-MM-DD)
            - end_date: 종료일 (YYYY-MM-DD)
            - attending_doctor: 담당 의사 ID (선택)
            - department: 진료과 (선택)

        Returns:
            진료 목록 (캘린더 표시용 간소화된 데이터)
        """
        queryset = self.get_queryset()

        # 날짜 필터 (필수)
        start_date = request.query_params.get('start_date')
        end_date = request.query_params.get('end_date')

        if start_date:
            queryset = queryset.filter(admission_date__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(admission_date__date__lte=end_date)

        # 추가 필터
        attending_doctor = request.query_params.get('attending_doctor')
        if attending_doctor:
            queryset = queryset.filter(attending_doctor_id=attending_doctor)

        department = request.query_params.get('department')
        if department:
            queryset = queryset.filter(department=department)

        # 캘린더용 간소화된 응답
        events = []
        for enc in queryset.select_related('patient', 'attending_doctor'):
            events.append({
                'id': enc.id,
                'title': f"{enc.patient.name} ({enc.get_encounter_type_display()})",
                'start': enc.admission_date.isoformat() if enc.admission_date else None,
                'end': enc.discharge_date.isoformat() if enc.discharge_date else None,
                'patient_id': enc.patient.id,
                'patient_name': enc.patient.name,
                'patient_number': enc.patient.patient_number,
                'encounter_type': enc.encounter_type,
                'encounter_type_display': enc.get_encounter_type_display(),
                'status': enc.status,
                'status_display': enc.get_status_display(),
                'department': enc.department,
                'department_display': enc.get_department_display(),
                'attending_doctor_id': enc.attending_doctor.id if enc.attending_doctor else None,
                'attending_doctor_name': enc.attending_doctor.name if enc.attending_doctor else None,
                'chief_complaint': enc.chief_complaint,
            })

        return Response({
            'count': len(events),
            'events': events
        })

    @action(detail=False, methods=['get'])
    def today(self, request):
        """
        금일 예약된 진료 목록 조회

        Query Parameters:
            - attending_doctor: 담당 의사 ID (선택)
            - department: 진료과 (선택)
            - status: 상태 필터 (선택, 기본값: scheduled)

        Returns:
            금일 예약된 진료 목록 (시간순 정렬)
        """
        today = timezone.now().date()
        queryset = self.get_queryset().filter(
            admission_date__date=today
        )

        # 상태 필터 (기본: scheduled만 조회, 'all'이면 전체)
        status_filter = request.query_params.get('status', 'scheduled')
        if status_filter and status_filter != 'all':
            queryset = queryset.filter(status=status_filter)

        # 담당 의사 필터
        attending_doctor = request.query_params.get('attending_doctor')
        if attending_doctor:
            queryset = queryset.filter(attending_doctor_id=attending_doctor)

        # 진료과 필터
        department = request.query_params.get('department')
        if department:
            queryset = queryset.filter(department=department)

        # 시간순 정렬
        queryset = queryset.order_by('admission_date')

        serializer = EncounterListSerializer(queryset, many=True)
        # 배열 직접 반환 (프론트엔드 호환성)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='patient/(?P<patient_id>\\d+)')
    def by_patient(self, request, patient_id=None):
        """
        특정 환자의 진료 이력 조회

        Path Parameters:
            - patient_id: 환자 ID

        Query Parameters:
            - limit: 조회 개수 제한 (기본값: 전체)
            - status: 상태 필터 (선택)

        Returns:
            환자의 진료 이력 목록 (최신순 정렬)
        """
        queryset = self.get_queryset().filter(
            patient_id=patient_id
        ).order_by('-admission_date')

        # 상태 필터
        status_filter = request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        # 개수 제한
        limit = request.query_params.get('limit')
        if limit:
            try:
                queryset = queryset[:int(limit)]
            except ValueError:
                pass

        serializer = EncounterListSerializer(queryset, many=True)
        # 배열 직접 반환 (프론트엔드 호환성)
        return Response(serializer.data)
