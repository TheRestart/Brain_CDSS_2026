from rest_framework import viewsets, status
from rest_framework.decorators import action
from rest_framework.response import Response
from rest_framework.permissions import IsAuthenticated
from django.utils import timezone

from .models import TreatmentPlan, TreatmentSession
from .serializers import (
    TreatmentPlanListSerializer, TreatmentPlanDetailSerializer,
    TreatmentPlanCreateSerializer, TreatmentSessionSerializer
)


class TreatmentPlanViewSet(viewsets.ModelViewSet):
    """
    치료 계획 ViewSet

    - GET /api/treatment/plans/ : 목록
    - POST /api/treatment/plans/ : 생성
    - GET /api/treatment/plans/{id}/ : 상세
    - PATCH /api/treatment/plans/{id}/ : 수정
    - DELETE /api/treatment/plans/{id}/ : 삭제
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = TreatmentPlan.objects.select_related(
            'patient', 'planned_by', 'encounter', 'ocs'
        ).prefetch_related('sessions')

        # 필터링
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        treatment_type = self.request.query_params.get('treatment_type')
        if treatment_type:
            queryset = queryset.filter(treatment_type=treatment_type)

        return queryset.order_by('-created_at')

    def get_serializer_class(self):
        if self.action == 'list':
            return TreatmentPlanListSerializer
        if self.action == 'create':
            return TreatmentPlanCreateSerializer
        return TreatmentPlanDetailSerializer

    @action(detail=True, methods=['post'])
    def start(self, request, pk=None):
        """치료 시작"""
        plan = self.get_object()
        if plan.status != TreatmentPlan.Status.PLANNED:
            return Response(
                {'detail': '계획됨 상태에서만 시작할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        plan.status = TreatmentPlan.Status.IN_PROGRESS
        plan.actual_start_date = timezone.now().date()
        plan.save()
        return Response({'message': '치료가 시작되었습니다.'})

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """치료 완료"""
        plan = self.get_object()
        if plan.status != TreatmentPlan.Status.IN_PROGRESS:
            return Response(
                {'detail': '진행 중 상태에서만 완료할 수 있습니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        plan.status = TreatmentPlan.Status.COMPLETED
        plan.actual_end_date = timezone.now().date()
        plan.save()
        return Response({'message': '치료가 완료되었습니다.'})

    @action(detail=True, methods=['post'])
    def cancel(self, request, pk=None):
        """치료 취소"""
        plan = self.get_object()
        if plan.status in [TreatmentPlan.Status.COMPLETED, TreatmentPlan.Status.CANCELLED]:
            return Response(
                {'detail': '이미 완료되거나 취소된 계획입니다.'},
                status=status.HTTP_400_BAD_REQUEST
            )
        plan.status = TreatmentPlan.Status.CANCELLED
        plan.save()
        return Response({'message': '치료가 취소되었습니다.'})


class TreatmentSessionViewSet(viewsets.ModelViewSet):
    """
    치료 세션 ViewSet

    - GET /api/treatment/sessions/ : 목록
    - POST /api/treatment/sessions/ : 생성
    - GET /api/treatment/sessions/{id}/ : 상세
    - PATCH /api/treatment/sessions/{id}/ : 수정
    """
    permission_classes = [IsAuthenticated]
    serializer_class = TreatmentSessionSerializer

    def get_queryset(self):
        queryset = TreatmentSession.objects.select_related(
            'treatment_plan', 'treatment_plan__patient', 'performed_by'
        )

        # 필터링
        plan_id = self.request.query_params.get('plan_id')
        if plan_id:
            queryset = queryset.filter(treatment_plan_id=plan_id)

        status_filter = self.request.query_params.get('status')
        if status_filter:
            queryset = queryset.filter(status=status_filter)

        return queryset.order_by('treatment_plan', 'session_number')

    @action(detail=True, methods=['post'])
    def complete(self, request, pk=None):
        """세션 완료"""
        session = self.get_object()
        session.status = TreatmentSession.Status.COMPLETED
        session.performed_by = request.user
        session.save()
        return Response({'message': '세션이 완료되었습니다.'})
