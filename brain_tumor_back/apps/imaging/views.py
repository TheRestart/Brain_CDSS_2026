"""
Imaging Views - OCS 통합 버전

영상 검사 데이터는 OCS(job_role='RIS')를 통해 관리됩니다.
기존 Imaging API 엔드포인트를 유지하면서 내부적으로 OCS를 사용합니다.
"""

from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from rest_framework.pagination import PageNumberPagination
from django.db.models import Q
from django.utils import timezone
from apps.ocs.models import OCS
from .serializers import (
    ImagingStudyListSerializer,
    ImagingStudyDetailSerializer,
    ImagingStudyCreateSerializer,
    ImagingStudyUpdateSerializer,
    ImagingReportCreateSerializer,
    ImagingReportUpdateSerializer,
    ImagingSearchSerializer,
)


class ImagingStudyPagination(PageNumberPagination):
    """영상 검사 목록 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100


class ImagingStudyViewSet(viewsets.ModelViewSet):
    """
    영상 검사 CRUD API (OCS 기반)

    내부적으로 OCS(job_role='RIS')를 사용합니다.
    기존 Imaging API 형식을 유지합니다.
    """
    permission_classes = [IsAuthenticated]
    pagination_class = ImagingStudyPagination

    def get_queryset(self):
        """RIS 오더만 조회"""
        queryset = OCS.objects.filter(
            job_role='RIS',
            is_deleted=False
        ).select_related('patient', 'doctor', 'worker', 'encounter')

        # 검색 파라미터
        q = self.request.query_params.get('q', '')
        if q:
            queryset = queryset.filter(
                Q(patient__name__icontains=q) |
                Q(patient__patient_number__icontains=q)
            )

        # modality 필터 (job_type)
        modality = self.request.query_params.get('modality')
        if modality:
            queryset = queryset.filter(job_type=modality)

        # status 필터 (OCS status로 변환)
        status_param = self.request.query_params.get('status')
        if status_param:
            status_map = {
                'ordered': 'ORDERED',
                'scheduled': 'ACCEPTED',
                'in_progress': 'IN_PROGRESS',
                'completed': 'RESULT_READY',
                'reported': 'CONFIRMED',
                'cancelled': 'CANCELLED',
            }
            ocs_status = status_map.get(status_param)
            if ocs_status:
                queryset = queryset.filter(ocs_status=ocs_status)

        # 의사/판독의 필터
        ordered_by = self.request.query_params.get('ordered_by')
        if ordered_by:
            queryset = queryset.filter(doctor_id=ordered_by)

        radiologist = self.request.query_params.get('radiologist')
        if radiologist:
            queryset = queryset.filter(worker_id=radiologist)

        # 환자/진료 필터
        patient = self.request.query_params.get('patient')
        if patient:
            queryset = queryset.filter(patient_id=patient)

        encounter = self.request.query_params.get('encounter')
        if encounter:
            queryset = queryset.filter(encounter_id=encounter)

        # 판독 상태 필터
        has_report = self.request.query_params.get('has_report')
        if has_report is not None:
            if has_report.lower() == 'true':
                # worker_result에 findings나 impression이 있는 경우
                queryset = queryset.exclude(worker_result={})
            elif has_report.lower() == 'false':
                queryset = queryset.filter(worker_result={})

        # 날짜 범위 필터
        start_date = self.request.query_params.get('start_date')
        end_date = self.request.query_params.get('end_date')
        if start_date:
            queryset = queryset.filter(created_at__date__gte=start_date)
        if end_date:
            queryset = queryset.filter(created_at__date__lte=end_date)

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        """액션별 Serializer 선택"""
        if self.action == 'list':
            return ImagingStudyListSerializer
        elif self.action == 'create':
            return ImagingStudyCreateSerializer
        elif self.action in ['update', 'partial_update']:
            return ImagingStudyUpdateSerializer
        else:
            return ImagingStudyDetailSerializer

    def perform_destroy(self, instance):
        """검사 삭제 (Soft Delete)"""
        instance.is_deleted = True
        instance.save()

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """검사 완료 처리"""
        ocs = self.get_object()

        if ocs.ocs_status == 'RESULT_READY':
            return Response(
                {'detail': '이미 완료된 검사입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ocs.ocs_status = 'RESULT_READY'
        ocs.result_ready_at = timezone.now()
        if not ocs.in_progress_at:
            ocs.in_progress_at = timezone.now()
        ocs.save()

        serializer = ImagingStudyDetailSerializer(ocs)
        return Response(serializer.data)

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """검사 취소"""
        ocs = self.get_object()

        if ocs.ocs_status == 'CONFIRMED':
            return Response(
                {'detail': '확정된 검사는 취소할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        ocs.ocs_status = 'CANCELLED'
        ocs.cancelled_at = timezone.now()
        ocs.save()

        serializer = ImagingStudyDetailSerializer(ocs)
        return Response(serializer.data)

    @action(detail=False, methods=['get'])
    def worklist(self, request):
        """부서별 워크리스트 (RIS 워크리스트)"""
        # 진행 중인 검사만 조회
        queryset = self.get_queryset().filter(
            ocs_status__in=['ORDERED', 'ACCEPTED', 'IN_PROGRESS']
        )

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ImagingStudyListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ImagingStudyListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='patient-history')
    def patient_history(self, request):
        """환자별 영상 히스토리 조회 (쿼리 파라미터 방식)"""
        patient_id = request.query_params.get('patient_id')
        if not patient_id:
            return Response(
                {'detail': 'patient_id 파라미터가 필요합니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        queryset = self.get_queryset().filter(
            patient_id=patient_id
        ).order_by('-created_at')

        page = self.paginate_queryset(queryset)
        if page is not None:
            serializer = ImagingStudyListSerializer(page, many=True)
            return self.get_paginated_response(serializer.data)

        serializer = ImagingStudyListSerializer(queryset, many=True)
        return Response(serializer.data)

    @action(detail=False, methods=['get'], url_path='patient/(?P<patient_id>\\d+)')
    def by_patient(self, request, patient_id=None):
        """
        특정 환자의 영상 검사 목록 조회 (URL 경로 방식)

        Path Parameters:
            - patient_id: 환자 ID

        Returns:
            영상 검사 목록 (최신순 정렬, 배열 직접 반환)
        """
        queryset = self.get_queryset().filter(
            patient_id=patient_id
        ).order_by('-created_at')

        serializer = ImagingStudyListSerializer(queryset, many=True)
        # 배열 직접 반환 (프론트엔드 호환성)
        return Response(serializer.data)


class ImagingReportViewSet(viewsets.ViewSet):
    """
    영상 판독문 CRUD API (OCS 기반)

    판독문은 OCS.worker_result JSON에 저장됩니다.
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        """판독문이 있는 RIS 오더만 조회"""
        return OCS.objects.filter(
            job_role='RIS',
            is_deleted=False
        ).exclude(
            worker_result={}
        ).select_related('patient', 'doctor', 'worker')

    def list(self, request):
        """판독문 목록"""
        queryset = self.get_queryset()

        # 특정 검사의 판독문
        imaging_study = request.query_params.get('imaging_study')
        if imaging_study:
            queryset = queryset.filter(id=imaging_study)

        # 특정 판독의의 판독문
        radiologist = request.query_params.get('radiologist')
        if radiologist:
            queryset = queryset.filter(worker_id=radiologist)

        serializer = ImagingStudyDetailSerializer(queryset, many=True)
        # report 필드만 추출
        reports = [item['report'] for item in serializer.data if item.get('report')]
        return Response(reports)

    def create(self, request):
        """판독문 생성"""
        serializer = ImagingReportCreateSerializer(
            data=request.data,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        ocs = serializer.save()

        detail_serializer = ImagingStudyDetailSerializer(ocs)
        return Response(detail_serializer.data['report'], status=status.HTTP_201_CREATED)

    def retrieve(self, request, pk=None):
        """판독문 조회"""
        try:
            ocs = OCS.objects.get(id=pk, job_role='RIS')
        except OCS.DoesNotExist:
            return Response(
                {'detail': '판독문을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        serializer = ImagingStudyDetailSerializer(ocs)
        report = serializer.data.get('report')
        if not report:
            return Response(
                {'detail': '판독문이 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        return Response(report)

    def update(self, request, pk=None):
        """판독문 수정"""
        try:
            ocs = OCS.objects.get(id=pk, job_role='RIS')
        except OCS.DoesNotExist:
            return Response(
                {'detail': '판독문을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 서명된 판독문은 수정 불가
        if ocs.worker_result and ocs.worker_result.get('_confirmed'):
            return Response(
                {'detail': '서명된 판독문은 수정할 수 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        serializer = ImagingReportUpdateSerializer(
            ocs,
            data=request.data,
            partial=True,
            context={'request': request}
        )
        serializer.is_valid(raise_exception=True)
        serializer.save()

        detail_serializer = ImagingStudyDetailSerializer(ocs)
        return Response(detail_serializer.data['report'])

    def partial_update(self, request, pk=None):
        """판독문 부분 수정"""
        return self.update(request, pk)

    def destroy(self, request, pk=None):
        """판독문 삭제"""
        try:
            ocs = OCS.objects.get(id=pk, job_role='RIS')
        except OCS.DoesNotExist:
            return Response(
                {'detail': '판독문을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        # 판독 정보 초기화
        if ocs.worker_result:
            ocs.worker_result['findings'] = ''
            ocs.worker_result['impression'] = ''
            ocs.worker_result['tumor'] = {'detected': False, 'location': {}, 'size': {}}
            ocs.worker_result['_confirmed'] = False
            ocs.save()

        # 상태 변경
        if ocs.ocs_status == 'CONFIRMED':
            ocs.ocs_status = 'RESULT_READY'
            ocs.confirmed_at = None
            ocs.save()

        return Response(status=status.HTTP_204_NO_CONTENT)

    @action(detail=True, methods=['post'])
    def sign(self, request, pk=None):
        """판독문 서명 (제출)"""
        try:
            ocs = OCS.objects.get(id=pk, job_role='RIS')
        except OCS.DoesNotExist:
            return Response(
                {'detail': '판독문을 찾을 수 없습니다.'},
                status=status.HTTP_404_NOT_FOUND
            )

        if not ocs.worker_result:
            return Response(
                {'detail': '판독문이 없습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        if ocs.worker_result.get('_confirmed'):
            return Response(
                {'detail': '이미 서명된 판독문입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )

        # 서명 처리
        ocs.worker_result['_confirmed'] = True
        ocs.ocs_status = 'CONFIRMED'
        ocs.confirmed_at = timezone.now()
        if not ocs.result_ready_at:
            ocs.result_ready_at = timezone.now()
        ocs.save()

        detail_serializer = ImagingStudyDetailSerializer(ocs)
        return Response(detail_serializer.data['report'])
