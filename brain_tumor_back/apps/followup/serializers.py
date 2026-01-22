from rest_framework import serializers
from .models import FollowUp


class FollowUpListSerializer(serializers.ModelSerializer):
    """경과 추적 목록용 시리얼라이저"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)
    followup_type_display = serializers.CharField(source='get_followup_type_display', read_only=True)
    clinical_status_display = serializers.CharField(source='get_clinical_status_display', read_only=True)

    class Meta:
        model = FollowUp
        fields = [
            'id', 'patient', 'patient_name', 'patient_number',
            'followup_date', 'followup_type', 'followup_type_display',
            'clinical_status', 'clinical_status_display',
            'kps_score', 'ecog_score',
            'recorded_by', 'recorded_by_name',
            'next_followup_date', 'created_at'
        ]


class FollowUpDetailSerializer(serializers.ModelSerializer):
    """경과 추적 상세 시리얼라이저"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    recorded_by_name = serializers.CharField(source='recorded_by.name', read_only=True)
    followup_type_display = serializers.CharField(source='get_followup_type_display', read_only=True)
    clinical_status_display = serializers.CharField(source='get_clinical_status_display', read_only=True)

    class Meta:
        model = FollowUp
        fields = [
            'id', 'patient', 'patient_name', 'patient_number',
            'treatment_plan', 'related_ocs',
            'followup_date', 'followup_type', 'followup_type_display',
            'clinical_status', 'clinical_status_display',
            'symptoms', 'kps_score', 'ecog_score',
            'vitals', 'weight_kg', 'note',
            'next_followup_date',
            'recorded_by', 'recorded_by_name',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class FollowUpCreateSerializer(serializers.ModelSerializer):
    """경과 추적 생성 시리얼라이저"""

    class Meta:
        model = FollowUp
        fields = [
            'patient', 'treatment_plan', 'related_ocs',
            'followup_date', 'followup_type',
            'clinical_status', 'symptoms',
            'kps_score', 'ecog_score', 'vitals', 'weight_kg',
            'note', 'next_followup_date'
        ]

    def create(self, validated_data):
        validated_data['recorded_by'] = self.context['request'].user
        return super().create(validated_data)
