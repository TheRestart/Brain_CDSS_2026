from rest_framework import serializers
from .models import FinalReport, ReportAttachment, ReportLog


class ReportAttachmentSerializer(serializers.ModelSerializer):
    uploaded_by_name = serializers.CharField(source='uploaded_by.name', read_only=True)

    class Meta:
        model = ReportAttachment
        fields = [
            'id',
            'file_type',
            'file_name',
            'file_path',
            'file_size',
            'description',
            'uploaded_by',
            'uploaded_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'uploaded_by', 'created_at']


class ReportLogSerializer(serializers.ModelSerializer):
    actor_name = serializers.CharField(source='actor.name', read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = ReportLog
        fields = [
            'id',
            'action',
            'action_display',
            'message',
            'details',
            'actor',
            'actor_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_at']


class FinalReportListSerializer(serializers.ModelSerializer):
    """보고서 목록 조회용 (간략)"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)

    class Meta:
        model = FinalReport
        fields = [
            'id',
            'report_id',
            'patient',
            'patient_name',
            'patient_number',
            'report_type',
            'report_type_display',
            'status',
            'status_display',
            'primary_diagnosis',
            'diagnosis_date',
            'created_by',
            'created_by_name',
            'author_department',
            'created_at',
            'updated_at',
        ]


class FinalReportDetailSerializer(serializers.ModelSerializer):
    """보고서 상세 조회용"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    reviewed_by_name = serializers.CharField(source='reviewed_by.name', read_only=True, allow_null=True)
    approved_by_name = serializers.CharField(source='approved_by.name', read_only=True, allow_null=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    report_type_display = serializers.CharField(source='get_report_type_display', read_only=True)
    attachments = ReportAttachmentSerializer(many=True, read_only=True)
    logs = ReportLogSerializer(many=True, read_only=True)

    class Meta:
        model = FinalReport
        fields = [
            'id',
            'report_id',
            'patient',
            'patient_name',
            'patient_number',
            'encounter',
            'report_type',
            'report_type_display',
            'status',
            'status_display',
            'primary_diagnosis',
            'secondary_diagnoses',
            'diagnosis_date',
            'treatment_summary',
            'treatment_plan',
            'ai_analysis_summary',
            'clinical_findings',
            'doctor_opinion',
            'recommendations',
            'prognosis',
            'created_by',
            'created_by_name',
            'author_department',
            'author_work_station',
            'reviewed_by',
            'reviewed_by_name',
            'reviewed_at',
            'approved_by',
            'approved_by_name',
            'approved_at',
            'finalized_at',
            'created_at',
            'updated_at',
            'attachments',
            'logs',
        ]


class FinalReportCreateSerializer(serializers.ModelSerializer):
    """보고서 생성용"""

    class Meta:
        model = FinalReport
        fields = [
            'patient',
            'encounter',
            'report_type',
            'primary_diagnosis',
            'secondary_diagnoses',
            'diagnosis_date',
            'treatment_summary',
            'treatment_plan',
            'ai_analysis_summary',
            'clinical_findings',
            'doctor_opinion',
            'recommendations',
            'prognosis',
        ]

    def create(self, validated_data):
        user = self.context['request'].user
        validated_data['created_by'] = user

        # 작성자 소속 정보 스냅샷
        if hasattr(user, 'profile') and user.profile:
            validated_data['author_department'] = user.profile.department or ''
            validated_data['author_work_station'] = user.profile.workStation or ''

        report = FinalReport.objects.create(**validated_data)

        # 생성 로그
        ReportLog.objects.create(
            report=report,
            action=ReportLog.Action.CREATED,
            message='보고서가 생성되었습니다.',
            actor=user
        )

        return report


class FinalReportUpdateSerializer(serializers.ModelSerializer):
    """보고서 수정용"""

    class Meta:
        model = FinalReport
        fields = [
            'report_type',
            'primary_diagnosis',
            'secondary_diagnoses',
            'diagnosis_date',
            'treatment_summary',
            'treatment_plan',
            'ai_analysis_summary',
            'clinical_findings',
            'doctor_opinion',
            'recommendations',
            'prognosis',
        ]

    def update(self, instance, validated_data):
        user = self.context['request'].user

        # 상태 검증 - DRAFT 상태에서만 수정 가능
        if instance.status not in [FinalReport.Status.DRAFT]:
            raise serializers.ValidationError('작성 중 상태의 보고서만 수정할 수 있습니다.')

        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 수정 로그
        ReportLog.objects.create(
            report=instance,
            action=ReportLog.Action.UPDATED,
            message='보고서가 수정되었습니다.',
            actor=user
        )

        return instance
