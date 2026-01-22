from rest_framework import serializers
from django.utils import timezone
from .models import OCS, OCSHistory
from apps.patients.models import Patient
from apps.accounts.models import User
from apps.ai_inference.models import AIInference


# =============================================================================
# OCS Serializers - 단일 테이블 설계
# =============================================================================
# 상세 기획: ocs_제작기획.md 참조
# =============================================================================


class UserMinimalSerializer(serializers.ModelSerializer):
    """최소 사용자 정보"""

    class Meta:
        model = User
        fields = ['id', 'login_id', 'name']


class PatientMinimalSerializer(serializers.ModelSerializer):
    """최소 환자 정보"""

    class Meta:
        model = Patient
        fields = ['id', 'patient_number', 'name']


class OCSHistorySerializer(serializers.ModelSerializer):
    """OCS 이력 Serializer"""
    actor = UserMinimalSerializer(read_only=True)
    from_worker = UserMinimalSerializer(read_only=True)
    to_worker = UserMinimalSerializer(read_only=True)
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = OCSHistory
        fields = [
            'id',
            'action',
            'action_display',
            'actor',
            'from_status',
            'to_status',
            'from_worker',
            'to_worker',
            'reason',
            'created_at',
            'snapshot_json',
            'ip_address',
        ]
        read_only_fields = fields


class OCSListSerializer(serializers.ModelSerializer):
    """OCS 목록 조회용 Serializer (가벼운 버전)"""
    patient = PatientMinimalSerializer(read_only=True)
    doctor = UserMinimalSerializer(read_only=True)
    worker = UserMinimalSerializer(read_only=True)
    ocs_status_display = serializers.CharField(source='get_ocs_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    ai_inference_info = serializers.SerializerMethodField()

    class Meta:
        model = OCS
        fields = [
            'id',
            'ocs_id',
            'ocs_status',
            'ocs_status_display',
            'patient',
            'doctor',
            'worker',
            'job_role',
            'job_type',
            'priority',
            'priority_display',
            'ocs_result',
            'created_at',
            'updated_at',
            'worker_result',  # AI 추론 페이지에서 DICOM study_uid 접근에 필요
            'ai_inference_info',  # AI 추론 완료 상태 (MM 모델용)
        ]
        read_only_fields = fields

    def get_ai_inference_info(self, obj):
        """OCS 타입별 AI 추론 완료 정보 반환"""
        # MRI OCS → M1 추론 상태
        if obj.job_type == 'MRI':
            inference = AIInference.objects.filter(
                mri_ocs=obj,
                model_type=AIInference.ModelType.M1,
                status=AIInference.Status.COMPLETED
            ).order_by('-completed_at').first()

            if inference:
                return {
                    'model_type': 'M1',
                    'status': 'completed',
                    'job_id': inference.job_id,
                    'completed_at': inference.completed_at.isoformat() if inference.completed_at else None
                }
            return {'model_type': 'M1', 'status': 'not_run'}

        # RNA_SEQ OCS → MG 추론 상태
        if obj.job_type == 'RNA_SEQ':
            inference = AIInference.objects.filter(
                rna_ocs=obj,
                model_type=AIInference.ModelType.MG,
                status=AIInference.Status.COMPLETED
            ).order_by('-completed_at').first()

            if inference:
                return {
                    'model_type': 'MG',
                    'status': 'completed',
                    'job_id': inference.job_id,
                    'completed_at': inference.completed_at.isoformat() if inference.completed_at else None
                }
            return {'model_type': 'MG', 'status': 'not_run'}

        # BIOMARKER OCS → 추론 불필요 (LIS에서 직접 제공)
        if obj.job_type == 'BIOMARKER':
            return {'model_type': None, 'status': 'not_required'}

        return None


class OCSDetailSerializer(serializers.ModelSerializer):
    """OCS 상세 조회용 Serializer"""
    patient = PatientMinimalSerializer(read_only=True)
    doctor = UserMinimalSerializer(read_only=True)
    worker = UserMinimalSerializer(read_only=True)
    ocs_status_display = serializers.CharField(source='get_ocs_status_display', read_only=True)
    priority_display = serializers.CharField(source='get_priority_display', read_only=True)
    turnaround_time = serializers.FloatField(read_only=True)
    work_time = serializers.FloatField(read_only=True)
    is_editable = serializers.BooleanField(read_only=True)
    history = OCSHistorySerializer(many=True, read_only=True)

    # localStorage 키 정보
    local_storage_keys = serializers.SerializerMethodField()

    class Meta:
        model = OCS
        fields = [
            'id',
            'ocs_id',
            'ocs_status',
            'ocs_status_display',
            'patient',
            'doctor',
            'worker',
            'encounter',
            'job_role',
            'job_type',
            'doctor_request',
            'worker_result',
            'attachments',
            'ocs_result',
            'created_at',
            'accepted_at',
            'in_progress_at',
            'result_ready_at',
            'confirmed_at',
            'cancelled_at',
            'updated_at',
            'priority',
            'priority_display',
            'cancel_reason',
            'is_deleted',
            'turnaround_time',
            'work_time',
            'is_editable',
            'history',
            'local_storage_keys',
        ]
        read_only_fields = [
            'id', 'ocs_id', 'created_at', 'updated_at',
            'turnaround_time', 'work_time', 'is_editable',
        ]

    def get_local_storage_keys(self, obj):
        """localStorage 키 생성"""
        return {
            'request_key': f"CDSS_LOCAL_STORAGE:DOCTOR:{obj.ocs_id}:request",
            'result_key': f"CDSS_LOCAL_STORAGE:{obj.job_role}:{obj.ocs_id}:result",
            'files_key': f"CDSS_LOCAL_STORAGE:{obj.job_role}:{obj.ocs_id}:files",
            'meta_key': f"CDSS_LOCAL_STORAGE:{obj.job_role}:{obj.ocs_id}:meta",
        }


class OCSCreateSerializer(serializers.ModelSerializer):
    """OCS 생성용 Serializer"""
    patient_id = serializers.IntegerField(write_only=True)
    encounter_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    attachments = serializers.JSONField(required=False, allow_null=True)

    class Meta:
        model = OCS
        fields = [
            'patient_id',
            'encounter_id',
            'job_role',
            'job_type',
            'doctor_request',
            'priority',
            'attachments',
        ]

    def validate_patient_id(self, value):
        """환자 존재 여부 확인"""
        try:
            Patient.objects.get(id=value)
        except Patient.DoesNotExist:
            raise serializers.ValidationError("해당 환자를 찾을 수 없습니다.")
        return value

    def create(self, validated_data):
        """OCS 생성 및 이력 기록"""
        request = self.context.get('request')
        patient_id = validated_data.pop('patient_id')
        encounter_id = validated_data.pop('encounter_id', None)
        attachments_data = validated_data.pop('attachments', None)

        # 기본 템플릿 적용
        if not validated_data.get('doctor_request'):
            ocs_temp = OCS(job_role=validated_data.get('job_role', ''))
            validated_data['doctor_request'] = ocs_temp.get_default_doctor_request()

        ocs = OCS.objects.create(
            patient_id=patient_id,
            encounter_id=encounter_id,
            doctor=request.user,
            **validated_data
        )

        # 외부기관 정보가 있으면 attachments에 병합
        if attachments_data:
            default_attachments = ocs.get_default_attachments()
            if 'external_source' in attachments_data:
                default_attachments['external_source'].update(attachments_data['external_source'])
            ocs.attachments = default_attachments
            ocs.save(update_fields=['attachments'])

        # 생성 이력 기록
        OCSHistory.objects.create(
            ocs=ocs,
            action=OCSHistory.Action.CREATED,
            actor=request.user,
            to_status=OCS.OcsStatus.ORDERED,
            ip_address=self._get_client_ip(request)
        )

        return ocs

    def _get_client_ip(self, request):
        """클라이언트 IP 추출"""
        x_forwarded_for = request.META.get('HTTP_X_FORWARDED_FOR')
        if x_forwarded_for:
            return x_forwarded_for.split(',')[0].strip()
        return request.META.get('REMOTE_ADDR')


class OCSUpdateSerializer(serializers.ModelSerializer):
    """OCS 수정용 Serializer"""

    class Meta:
        model = OCS
        fields = [
            'doctor_request',
            'worker_result',
            'attachments',
            'priority',
        ]

    def validate(self, attrs):
        """수정 가능 여부 확인"""
        instance = self.instance
        if not instance.is_editable:
            raise serializers.ValidationError(
                f"현재 상태({instance.get_ocs_status_display()})에서는 수정할 수 없습니다."
            )
        return attrs


# =============================================================================
# 상태 변경용 Serializers
# =============================================================================

class OCSAcceptSerializer(serializers.Serializer):
    """오더 접수 (ORDERED → ACCEPTED)"""

    def validate(self, attrs):
        ocs = self.instance
        if ocs.ocs_status != OCS.OcsStatus.ORDERED:
            raise serializers.ValidationError(
                f"ORDERED 상태에서만 접수할 수 있습니다. (현재: {ocs.get_ocs_status_display()})"
            )
        if ocs.worker is not None:
            raise serializers.ValidationError("이미 다른 작업자가 접수한 오더입니다.")
        return attrs


class OCSStartSerializer(serializers.Serializer):
    """작업 시작 (ACCEPTED → IN_PROGRESS)"""

    def validate(self, attrs):
        ocs = self.instance
        request = self.context.get('request')

        if ocs.ocs_status != OCS.OcsStatus.ACCEPTED:
            raise serializers.ValidationError(
                f"ACCEPTED 상태에서만 작업을 시작할 수 있습니다. (현재: {ocs.get_ocs_status_display()})"
            )
        if ocs.worker != request.user:
            raise serializers.ValidationError("본인이 접수한 오더만 시작할 수 있습니다.")
        return attrs


class OCSSaveResultSerializer(serializers.Serializer):
    """결과 임시 저장"""
    worker_result = serializers.JSONField(required=False)
    attachments = serializers.JSONField(required=False)

    def validate(self, attrs):
        ocs = self.instance
        request = self.context.get('request')

        if ocs.ocs_status not in [OCS.OcsStatus.IN_PROGRESS, OCS.OcsStatus.RESULT_READY]:
            raise serializers.ValidationError(
                f"진행 중 또는 결과 대기 상태에서만 저장할 수 있습니다. (현재: {ocs.get_ocs_status_display()})"
            )
        if ocs.worker != request.user:
            raise serializers.ValidationError("본인이 담당한 오더만 저장할 수 있습니다.")
        return attrs


class OCSSubmitResultSerializer(serializers.Serializer):
    """결과 제출 (IN_PROGRESS → RESULT_READY)"""
    worker_result = serializers.JSONField(required=False)
    attachments = serializers.JSONField(required=False)

    def validate(self, attrs):
        ocs = self.instance
        request = self.context.get('request')

        if ocs.ocs_status != OCS.OcsStatus.IN_PROGRESS:
            raise serializers.ValidationError(
                f"IN_PROGRESS 상태에서만 결과를 제출할 수 있습니다. (현재: {ocs.get_ocs_status_display()})"
            )
        if ocs.worker != request.user:
            raise serializers.ValidationError("본인이 담당한 오더만 제출할 수 있습니다.")
        return attrs


class OCSConfirmSerializer(serializers.Serializer):
    """확정 (RESULT_READY → CONFIRMED 또는 LIS/RIS 담당자의 경우 IN_PROGRESS → CONFIRMED)"""
    ocs_result = serializers.BooleanField(required=False, default=True)
    worker_result = serializers.JSONField(required=False)

    def validate(self, attrs):
        ocs = self.instance
        request = self.context.get('request')

        is_doctor = ocs.doctor == request.user
        is_worker = ocs.worker == request.user

        # LIS/RIS 담당자는 IN_PROGRESS에서 바로 확정 가능
        if ocs.job_role in ['LIS', 'RIS'] and is_worker:
            if ocs.ocs_status not in [OCS.OcsStatus.IN_PROGRESS, OCS.OcsStatus.RESULT_READY]:
                raise serializers.ValidationError(
                    f"IN_PROGRESS 또는 RESULT_READY 상태에서만 확정할 수 있습니다. (현재: {ocs.get_ocs_status_display()})"
                )
        # 의사는 RESULT_READY 상태에서만 확정 가능
        elif is_doctor:
            if ocs.ocs_status != OCS.OcsStatus.RESULT_READY:
                raise serializers.ValidationError(
                    f"RESULT_READY 상태에서만 확정할 수 있습니다. (현재: {ocs.get_ocs_status_display()})"
                )
        else:
            raise serializers.ValidationError("처방 의사 또는 LIS/RIS 담당자만 확정할 수 있습니다.")
        return attrs


class OCSCancelSerializer(serializers.Serializer):
    """취소"""
    cancel_reason = serializers.CharField(max_length=200, required=False, allow_blank=True)

    def validate(self, attrs):
        ocs = self.instance
        request = self.context.get('request')

        # 이미 취소되었거나 확정된 경우
        if ocs.ocs_status in [OCS.OcsStatus.CANCELLED, OCS.OcsStatus.CONFIRMED]:
            raise serializers.ValidationError(
                f"현재 상태({ocs.get_ocs_status_display()})에서는 취소할 수 없습니다."
            )

        # 의사가 아니고 작업자도 아닌 경우
        is_doctor = ocs.doctor == request.user
        is_worker = ocs.worker == request.user

        if not is_doctor and not is_worker:
            raise serializers.ValidationError("처방 의사 또는 담당 작업자만 취소할 수 있습니다.")

        # 작업자가 취소하는 경우 (작업 포기)
        if is_worker and not is_doctor:
            # IN_PROGRESS 이상에서는 작업자가 취소할 수 없음
            if ocs.ocs_status in [OCS.OcsStatus.RESULT_READY]:
                raise serializers.ValidationError(
                    "결과 제출 후에는 작업자가 취소할 수 없습니다. 의사에게 문의하세요."
                )

        return attrs
