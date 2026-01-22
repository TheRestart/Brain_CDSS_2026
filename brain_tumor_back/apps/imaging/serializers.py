"""
Imaging Serializers - OCS 통합 버전

영상 검사 데이터는 OCS(job_role='RIS')를 통해 관리됩니다.
이 Serializer들은 OCS 데이터를 기존 Imaging API 형식으로 변환합니다.
"""

from rest_framework import serializers
from apps.ocs.models import OCS


class ImagingStudyListSerializer(serializers.ModelSerializer):
    """영상 검사 목록용 Serializer (OCS 기반)"""

    # 환자 정보
    patient = serializers.IntegerField(source='patient.id', read_only=True)
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)

    # 진료 정보
    encounter = serializers.SerializerMethodField()
    encounter_id = serializers.SerializerMethodField()

    # 검사 정보 (OCS에서 매핑)
    modality = serializers.CharField(source='job_type', read_only=True)
    modality_display = serializers.SerializerMethodField()
    body_part = serializers.SerializerMethodField()
    status = serializers.SerializerMethodField()
    status_display = serializers.SerializerMethodField()

    # 오더/판독 정보
    ordered_by = serializers.IntegerField(source='doctor.id', read_only=True)
    ordered_by_name = serializers.CharField(source='doctor.name', read_only=True)
    ordered_at = serializers.DateTimeField(source='created_at', read_only=True)
    radiologist = serializers.SerializerMethodField()
    radiologist_name = serializers.SerializerMethodField()

    # 상태 플래그
    has_report = serializers.SerializerMethodField()

    class Meta:
        model = OCS
        fields = [
            'id',
            'ocs_id',
            'patient',
            'patient_name',
            'patient_number',
            'encounter',
            'encounter_id',
            'modality',
            'modality_display',
            'body_part',
            'status',
            'status_display',
            'ordered_by',
            'ordered_by_name',
            'ordered_at',
            'radiologist',
            'radiologist_name',
            'has_report',
            'created_at',
        ]

    def get_encounter(self, obj):
        return obj.encounter_id

    def get_encounter_id(self, obj):
        return obj.encounter_id

    def get_modality_display(self, obj):
        # 뇌종양 CDSS에 필요한 영상 검사만
        modality_map = {
            'MRI': 'MRI (Magnetic Resonance Imaging)',
            'CT': 'CT (Computed Tomography)',
            'PET': 'PET (Positron Emission Tomography)',
        }
        return modality_map.get(obj.job_type, obj.job_type)

    def get_body_part(self, obj):
        if obj.doctor_request:
            return obj.doctor_request.get('body_part', 'brain')
        return 'brain'

    def get_status(self, obj):
        status_map = {
            'ORDERED': 'ordered',
            'ACCEPTED': 'scheduled',
            'IN_PROGRESS': 'in_progress',
            'RESULT_READY': 'completed',
            'CONFIRMED': 'reported',
            'CANCELLED': 'cancelled',
        }
        return status_map.get(obj.ocs_status, 'ordered')

    def get_status_display(self, obj):
        return obj.get_ocs_status_display()

    def get_radiologist(self, obj):
        return obj.worker_id

    def get_radiologist_name(self, obj):
        return obj.worker.name if obj.worker else None

    def get_has_report(self, obj):
        if obj.worker_result:
            # findings나 impression이 있으면 판독문 존재
            return bool(obj.worker_result.get('findings') or obj.worker_result.get('impression'))
        return False


class ImagingStudyDetailSerializer(ImagingStudyListSerializer):
    """영상 검사 상세 정보용 Serializer"""

    # 추가 환자 정보
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    patient_age = serializers.SerializerMethodField()

    # DICOM 정보
    study_uid = serializers.SerializerMethodField()
    series_count = serializers.SerializerMethodField()
    instance_count = serializers.SerializerMethodField()

    # 일정 정보
    scheduled_at = serializers.SerializerMethodField()
    performed_at = serializers.SerializerMethodField()

    # 의사 요청 정보
    clinical_info = serializers.SerializerMethodField()
    special_instruction = serializers.SerializerMethodField()

    # 작업 노트
    work_notes = serializers.SerializerMethodField()

    # 판독문 정보
    report = serializers.SerializerMethodField()
    is_completed = serializers.SerializerMethodField()

    class Meta(ImagingStudyListSerializer.Meta):
        fields = ImagingStudyListSerializer.Meta.fields + [
            'patient_gender',
            'patient_age',
            'study_uid',
            'series_count',
            'instance_count',
            'scheduled_at',
            'performed_at',
            'clinical_info',
            'special_instruction',
            'work_notes',
            'report',
            'is_completed',
            'updated_at',
        ]

    def get_patient_age(self, obj):
        if hasattr(obj.patient, 'age'):
            return obj.patient.age
        return None

    def get_study_uid(self, obj):
        if obj.worker_result and obj.worker_result.get('dicom'):
            return obj.worker_result['dicom'].get('study_uid', '')
        return None

    def get_series_count(self, obj):
        if obj.worker_result and obj.worker_result.get('dicom'):
            return obj.worker_result['dicom'].get('series_count', 0)
        return 0

    def get_instance_count(self, obj):
        if obj.worker_result and obj.worker_result.get('dicom'):
            return obj.worker_result['dicom'].get('instance_count', 0)
        return 0

    def get_scheduled_at(self, obj):
        return obj.accepted_at

    def get_performed_at(self, obj):
        return obj.in_progress_at

    def get_clinical_info(self, obj):
        if obj.doctor_request:
            return obj.doctor_request.get('clinical_info', '')
        return ''

    def get_special_instruction(self, obj):
        if obj.doctor_request:
            return obj.doctor_request.get('special_instruction', '')
        return ''

    def get_work_notes(self, obj):
        if obj.worker_result:
            return obj.worker_result.get('work_notes', [])
        return []

    def get_is_completed(self, obj):
        return obj.ocs_status in ['RESULT_READY', 'CONFIRMED']

    def get_report(self, obj):
        """판독문 정보 반환"""
        if not obj.worker_result:
            return None

        findings = obj.worker_result.get('findings', '')
        impression = obj.worker_result.get('impression', '')

        if not findings and not impression:
            return None

        tumor = obj.worker_result.get('tumor', {})

        return {
            'id': obj.id,  # OCS ID 사용
            'radiologist': obj.worker_id,
            'radiologist_name': obj.worker.name if obj.worker else None,
            'findings': findings,
            'impression': impression,
            'tumor_detected': tumor.get('detected', False),
            'tumor_location': tumor.get('location'),
            'tumor_size': tumor.get('size'),
            'status': 'signed' if obj.worker_result.get('_confirmed') else 'draft',
            'status_display': '서명 완료' if obj.worker_result.get('_confirmed') else '작성 중',
            'signed_at': obj.confirmed_at if obj.worker_result.get('_confirmed') else None,
            'is_signed': obj.worker_result.get('_confirmed', False),
            'created_at': obj.created_at,
            'updated_at': obj.updated_at,
        }


class ImagingStudyCreateSerializer(serializers.Serializer):
    """영상 검사 오더 생성용 Serializer (OCS 생성)"""

    patient = serializers.IntegerField()
    encounter = serializers.IntegerField(required=False, allow_null=True)
    modality = serializers.ChoiceField(choices=['MRI', 'CT', 'PET'])
    body_part = serializers.CharField(default='brain', required=False)
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    clinical_info = serializers.CharField(required=False, allow_blank=True, default='')
    special_instruction = serializers.CharField(required=False, allow_blank=True, default='')

    def create(self, validated_data):
        """OCS 생성"""
        from apps.patients.models import Patient
        from apps.encounters.models import Encounter

        patient = Patient.objects.get(id=validated_data['patient'])

        encounter = None
        if validated_data.get('encounter'):
            encounter = Encounter.objects.get(id=validated_data['encounter'])

        doctor_request = {
            "_template": "RIS",
            "_version": "1.0",
            "clinical_info": validated_data.get('clinical_info', ''),
            "special_instruction": validated_data.get('special_instruction', ''),
            "body_part": validated_data.get('body_part', 'brain'),
            "_custom": {}
        }

        ocs = OCS.objects.create(
            patient=patient,
            doctor=self.context['request'].user,
            encounter=encounter,
            job_role='RIS',
            job_type=validated_data['modality'],
            doctor_request=doctor_request,
            worker_result={},
            priority='normal',
        )

        # scheduled_at이 있으면 상태 변경
        if validated_data.get('scheduled_at'):
            ocs.ocs_status = 'ACCEPTED'
            ocs.accepted_at = validated_data['scheduled_at']
            ocs.save()

        return ocs


class ImagingStudyUpdateSerializer(serializers.Serializer):
    """영상 검사 정보 수정용 Serializer (OCS 수정)"""

    modality = serializers.ChoiceField(choices=['MRI', 'CT', 'PET'], required=False)
    body_part = serializers.CharField(required=False)
    status = serializers.ChoiceField(
        choices=['ordered', 'scheduled', 'in_progress', 'completed', 'reported', 'cancelled'],
        required=False
    )
    scheduled_at = serializers.DateTimeField(required=False, allow_null=True)
    performed_at = serializers.DateTimeField(required=False, allow_null=True)
    study_uid = serializers.CharField(required=False, allow_blank=True)
    series_count = serializers.IntegerField(required=False)
    instance_count = serializers.IntegerField(required=False)
    work_note = serializers.CharField(required=False, allow_blank=True)

    def update(self, instance, validated_data):
        """OCS 수정"""
        from django.utils import timezone

        # modality 변경
        if 'modality' in validated_data:
            instance.job_type = validated_data['modality']

        # body_part 변경 (doctor_request에 저장)
        if 'body_part' in validated_data:
            if not instance.doctor_request:
                instance.doctor_request = {}
            instance.doctor_request['body_part'] = validated_data['body_part']

        # status 변경
        if 'status' in validated_data:
            status_map = {
                'ordered': 'ORDERED',
                'scheduled': 'ACCEPTED',
                'in_progress': 'IN_PROGRESS',
                'completed': 'RESULT_READY',
                'reported': 'CONFIRMED',
                'cancelled': 'CANCELLED',
            }
            new_status = status_map.get(validated_data['status'])
            if new_status:
                instance.ocs_status = new_status

                # 타임스탬프 설정
                now = timezone.now()
                if new_status == 'ACCEPTED' and not instance.accepted_at:
                    instance.accepted_at = now
                elif new_status == 'IN_PROGRESS' and not instance.in_progress_at:
                    instance.in_progress_at = now
                elif new_status == 'RESULT_READY' and not instance.result_ready_at:
                    instance.result_ready_at = now
                elif new_status == 'CONFIRMED' and not instance.confirmed_at:
                    instance.confirmed_at = now
                elif new_status == 'CANCELLED' and not instance.cancelled_at:
                    instance.cancelled_at = now

        # scheduled_at, performed_at
        if 'scheduled_at' in validated_data:
            instance.accepted_at = validated_data['scheduled_at']
        if 'performed_at' in validated_data:
            instance.in_progress_at = validated_data['performed_at']

        # DICOM 정보 (worker_result에 저장)
        if not instance.worker_result:
            instance.worker_result = {
                "_template": "RIS",
                "_version": "1.0",
                "_confirmed": False,
                "dicom": {},
                "findings": "",
                "impression": "",
                "tumor": {"detected": False, "location": {}, "size": {}},
                "work_notes": [],
                "_custom": {}
            }

        if 'dicom' not in instance.worker_result:
            instance.worker_result['dicom'] = {}

        if 'study_uid' in validated_data:
            instance.worker_result['dicom']['study_uid'] = validated_data['study_uid']
        if 'series_count' in validated_data:
            instance.worker_result['dicom']['series_count'] = validated_data['series_count']
        if 'instance_count' in validated_data:
            instance.worker_result['dicom']['instance_count'] = validated_data['instance_count']

        # work_note 추가
        if validated_data.get('work_note'):
            if 'work_notes' not in instance.worker_result:
                instance.worker_result['work_notes'] = []

            instance.worker_result['work_notes'].append({
                'timestamp': timezone.now().isoformat(),
                'author': self.context['request'].user.name if self.context.get('request') else 'Unknown',
                'content': validated_data['work_note']
            })

        instance.save()
        return instance


class ImagingReportCreateSerializer(serializers.Serializer):
    """판독문 생성용 Serializer (OCS worker_result 수정)"""

    imaging_study = serializers.IntegerField()  # OCS ID
    findings = serializers.CharField()
    impression = serializers.CharField()
    tumor_detected = serializers.BooleanField(default=False)
    tumor_location = serializers.JSONField(required=False, allow_null=True)
    tumor_size = serializers.JSONField(required=False, allow_null=True)

    def create(self, validated_data):
        """OCS worker_result에 판독 정보 저장"""
        ocs = OCS.objects.get(id=validated_data['imaging_study'])

        if not ocs.worker_result:
            ocs.worker_result = {
                "_template": "RIS",
                "_version": "1.0",
                "_confirmed": False,
                "dicom": {},
                "findings": "",
                "impression": "",
                "tumor": {"detected": False, "location": {}, "size": {}},
                "work_notes": [],
                "_custom": {}
            }

        ocs.worker_result['findings'] = validated_data['findings']
        ocs.worker_result['impression'] = validated_data['impression']

        if 'tumor' not in ocs.worker_result:
            ocs.worker_result['tumor'] = {}

        ocs.worker_result['tumor']['detected'] = validated_data.get('tumor_detected', False)

        if validated_data.get('tumor_location'):
            ocs.worker_result['tumor']['location'] = validated_data['tumor_location']
        if validated_data.get('tumor_size'):
            ocs.worker_result['tumor']['size'] = validated_data['tumor_size']

        # 작업자 설정
        if not ocs.worker:
            ocs.worker = self.context['request'].user

        # 상태 변경 (최소 IN_PROGRESS)
        if ocs.ocs_status == 'ORDERED':
            ocs.ocs_status = 'ACCEPTED'
        if ocs.ocs_status == 'ACCEPTED':
            ocs.ocs_status = 'IN_PROGRESS'

        ocs.save()
        return ocs


class ImagingReportUpdateSerializer(serializers.Serializer):
    """판독문 수정용 Serializer"""

    findings = serializers.CharField(required=False)
    impression = serializers.CharField(required=False)
    tumor_detected = serializers.BooleanField(required=False)
    tumor_location = serializers.JSONField(required=False, allow_null=True)
    tumor_size = serializers.JSONField(required=False, allow_null=True)

    def update(self, instance, validated_data):
        """OCS worker_result 수정"""
        if not instance.worker_result:
            instance.worker_result = {}

        if 'findings' in validated_data:
            instance.worker_result['findings'] = validated_data['findings']
        if 'impression' in validated_data:
            instance.worker_result['impression'] = validated_data['impression']

        if 'tumor' not in instance.worker_result:
            instance.worker_result['tumor'] = {}

        if 'tumor_detected' in validated_data:
            instance.worker_result['tumor']['detected'] = validated_data['tumor_detected']
        if 'tumor_location' in validated_data:
            instance.worker_result['tumor']['location'] = validated_data['tumor_location']
        if 'tumor_size' in validated_data:
            instance.worker_result['tumor']['size'] = validated_data['tumor_size']

        instance.save()
        return instance


class ImagingSearchSerializer(serializers.Serializer):
    """영상 검사 검색용 Serializer"""

    q = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='검색어 (환자명, 환자번호)'
    )
    modality = serializers.ChoiceField(
        choices=['MRI', 'CT', 'PET'],
        required=False,
        help_text='검사 종류'
    )
    status = serializers.ChoiceField(
        choices=['ordered', 'scheduled', 'in_progress', 'completed', 'reported', 'cancelled'],
        required=False,
        help_text='검사 상태'
    )
    ordered_by = serializers.IntegerField(
        required=False,
        help_text='오더 의사 ID'
    )
    radiologist = serializers.IntegerField(
        required=False,
        help_text='판독의 ID'
    )
    patient = serializers.IntegerField(
        required=False,
        help_text='환자 ID'
    )
    encounter = serializers.IntegerField(
        required=False,
        help_text='진료 ID'
    )
    start_date = serializers.DateField(
        required=False,
        help_text='검사 시작일 (YYYY-MM-DD)'
    )
    end_date = serializers.DateField(
        required=False,
        help_text='검사 종료일 (YYYY-MM-DD)'
    )

    def validate(self, data):
        """날짜 범위 검증"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("시작일은 종료일보다 이전이어야 합니다.")

        return data
