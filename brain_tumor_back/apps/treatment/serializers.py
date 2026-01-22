from rest_framework import serializers
from .models import TreatmentPlan, TreatmentSession


class TreatmentSessionSerializer(serializers.ModelSerializer):
    """치료 세션 시리얼라이저"""
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    performed_by_name = serializers.CharField(source='performed_by.name', read_only=True, allow_null=True)

    class Meta:
        model = TreatmentSession
        fields = [
            'id', 'treatment_plan', 'session_number', 'session_date',
            'performed_by', 'performed_by_name', 'status', 'status_display',
            'session_note', 'adverse_events', 'vitals_before', 'vitals_after',
            'medications', 'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class TreatmentPlanListSerializer(serializers.ModelSerializer):
    """치료 계획 목록용 시리얼라이저"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    planned_by_name = serializers.CharField(source='planned_by.name', read_only=True)
    treatment_type_display = serializers.CharField(source='get_treatment_type_display', read_only=True)
    treatment_goal_display = serializers.CharField(source='get_treatment_goal_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    session_count = serializers.SerializerMethodField()

    class Meta:
        model = TreatmentPlan
        fields = [
            'id', 'patient', 'patient_name', 'patient_number',
            'treatment_type', 'treatment_type_display',
            'treatment_goal', 'treatment_goal_display',
            'status', 'status_display',
            'planned_by', 'planned_by_name',
            'start_date', 'end_date', 'session_count',
            'created_at'
        ]

    def get_session_count(self, obj):
        return obj.sessions.count()


class TreatmentPlanDetailSerializer(serializers.ModelSerializer):
    """치료 계획 상세 시리얼라이저"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    planned_by_name = serializers.CharField(source='planned_by.name', read_only=True)
    treatment_type_display = serializers.CharField(source='get_treatment_type_display', read_only=True)
    treatment_goal_display = serializers.CharField(source='get_treatment_goal_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    sessions = TreatmentSessionSerializer(many=True, read_only=True)

    class Meta:
        model = TreatmentPlan
        fields = [
            'id', 'patient', 'patient_name', 'patient_number',
            'encounter', 'ocs',
            'treatment_type', 'treatment_type_display',
            'treatment_goal', 'treatment_goal_display',
            'plan_summary', 'planned_by', 'planned_by_name',
            'status', 'status_display',
            'start_date', 'end_date',
            'actual_start_date', 'actual_end_date',
            'notes', 'sessions',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class TreatmentPlanCreateSerializer(serializers.ModelSerializer):
    """치료 계획 생성 시리얼라이저"""

    class Meta:
        model = TreatmentPlan
        fields = [
            'patient', 'encounter', 'ocs',
            'treatment_type', 'treatment_goal', 'plan_summary',
            'start_date', 'end_date', 'notes'
        ]

    def create(self, validated_data):
        validated_data['planned_by'] = self.context['request'].user
        return super().create(validated_data)
