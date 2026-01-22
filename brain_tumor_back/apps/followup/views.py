from rest_framework import viewsets
from rest_framework.permissions import IsAuthenticated

from .models import FollowUp
from .serializers import (
    FollowUpListSerializer, FollowUpDetailSerializer, FollowUpCreateSerializer
)


class FollowUpViewSet(viewsets.ModelViewSet):
    """
    경과 추적 ViewSet

    - GET /api/followup/ : 목록
    - POST /api/followup/ : 생성
    - GET /api/followup/{id}/ : 상세
    - PATCH /api/followup/{id}/ : 수정
    - DELETE /api/followup/{id}/ : 삭제
    """
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        queryset = FollowUp.objects.select_related(
            'patient', 'treatment_plan', 'related_ocs', 'recorded_by'
        )

        # 필터링
        patient_id = self.request.query_params.get('patient_id')
        if patient_id:
            queryset = queryset.filter(patient_id=patient_id)

        clinical_status = self.request.query_params.get('clinical_status')
        if clinical_status:
            queryset = queryset.filter(clinical_status=clinical_status)

        followup_type = self.request.query_params.get('followup_type')
        if followup_type:
            queryset = queryset.filter(followup_type=followup_type)

        treatment_plan_id = self.request.query_params.get('treatment_plan_id')
        if treatment_plan_id:
            queryset = queryset.filter(treatment_plan_id=treatment_plan_id)

        return queryset.order_by('-followup_date')

    def get_serializer_class(self):
        if self.action == 'list':
            return FollowUpListSerializer
        if self.action == 'create':
            return FollowUpCreateSerializer
        return FollowUpDetailSerializer
