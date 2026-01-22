from rest_framework import serializers
from .models import Patient, PatientAlert
from apps.accounts.models import User


class PatientListSerializer(serializers.ModelSerializer):
    """환자 목록용 Serializer (간단한 정보만)"""

    age = serializers.ReadOnlyField()
    registered_by_name = serializers.CharField(source='registered_by.username', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id',
            'patient_number',
            'name',
            'birth_date',
            'age',
            'gender',
            'phone',
            'blood_type',
            'status',
            'severity',
            'registered_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'patient_number', 'created_at']


class PatientDetailSerializer(serializers.ModelSerializer):
    """환자 상세 정보용 Serializer"""

    age = serializers.ReadOnlyField()
    is_active = serializers.ReadOnlyField()
    registered_by_name = serializers.CharField(source='registered_by.username', read_only=True)

    class Meta:
        model = Patient
        fields = [
            'id',
            'patient_number',
            'name',
            'birth_date',
            'age',
            'gender',
            'phone',
            'email',
            'address',
            'ssn',
            'blood_type',
            'allergies',
            'chronic_diseases',
            'chief_complaint',
            'status',
            'severity',
            'is_active',
            'registered_by',
            'registered_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = [
            'id',
            'patient_number',
            'age',
            'is_active',
            'registered_by',
            'registered_by_name',
            'created_at',
            'updated_at',
        ]
        extra_kwargs = {
            'ssn': {'write_only': True},  # SSN은 쓰기만 가능, 읽기 시 마스킹 필요
        }

    def validate_phone(self, value):
        """전화번호 형식 검증"""
        import re
        pattern = r'^\d{2,3}-\d{3,4}-\d{4}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError("전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)")
        return value

    def validate_ssn(self, value):
        """주민등록번호 검증 (간단한 형식 체크)"""
        import re
        # 하이픈 제거
        ssn_cleaned = value.replace('-', '')

        # 13자리 숫자인지 확인
        if not re.match(r'^\d{13}$', ssn_cleaned):
            raise serializers.ValidationError("주민등록번호는 13자리 숫자여야 합니다.")

        # 중복 체크 (수정 시 제외)
        instance = self.instance
        if Patient.objects.filter(ssn=value).exclude(pk=instance.pk if instance else None).exists():
            raise serializers.ValidationError("이미 등록된 주민등록번호입니다.")

        return value

    def validate_allergies(self, value):
        """알레르기 데이터 검증"""
        if not isinstance(value, list):
            raise serializers.ValidationError("알레르기는 배열 형식이어야 합니다.")
        return value

    def validate_chronic_diseases(self, value):
        """기저질환 데이터 검증"""
        if not isinstance(value, list):
            raise serializers.ValidationError("기저질환은 배열 형식이어야 합니다.")
        return value


class PatientCreateSerializer(serializers.ModelSerializer):
    """환자 등록용 Serializer"""

    class Meta:
        model = Patient
        fields = [
            'name',
            'birth_date',
            'gender',
            'phone',
            'email',
            'address',
            'ssn',
            'blood_type',
            'allergies',
            'chronic_diseases',
            'chief_complaint',
            'severity',
        ]

    def validate_phone(self, value):
        """전화번호 형식 검증"""
        import re
        pattern = r'^\d{2,3}-\d{3,4}-\d{4}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError("전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)")
        return value

    def validate_ssn(self, value):
        """주민등록번호 검증"""
        import re
        ssn_cleaned = value.replace('-', '')

        if not re.match(r'^\d{13}$', ssn_cleaned):
            raise serializers.ValidationError("주민등록번호는 13자리 숫자여야 합니다.")

        if Patient.objects.filter(ssn=value).exists():
            raise serializers.ValidationError("이미 등록된 주민등록번호입니다.")

        return value

    def create(self, validated_data):
        """환자 생성 (등록자 정보 자동 추가)"""
        request = self.context.get('request')
        if request and request.user:
            validated_data['registered_by'] = request.user
        return super().create(validated_data)


class PatientUpdateSerializer(serializers.ModelSerializer):
    """환자 정보 수정용 Serializer"""

    class Meta:
        model = Patient
        fields = [
            'name',
            'phone',
            'email',
            'address',
            'blood_type',
            'allergies',
            'chronic_diseases',
            'chief_complaint',
            'status',
            'severity',
        ]

    def validate_phone(self, value):
        """전화번호 형식 검증"""
        import re
        pattern = r'^\d{2,3}-\d{3,4}-\d{4}$'
        if not re.match(pattern, value):
            raise serializers.ValidationError("전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)")
        return value


class PatientSearchSerializer(serializers.Serializer):
    """환자 검색용 Serializer"""

    q = serializers.CharField(
        required=False,
        allow_blank=True,
        help_text='검색어 (이름, 환자번호, 전화번호)'
    )
    status = serializers.ChoiceField(
        choices=Patient.STATUS_CHOICES,
        required=False,
        help_text='환자 상태'
    )
    severity = serializers.ChoiceField(
        choices=Patient.SEVERITY_CHOICES,
        required=False,
        help_text='중증도'
    )
    gender = serializers.ChoiceField(
        choices=Patient.GENDER_CHOICES,
        required=False,
        help_text='성별'
    )
    start_date = serializers.DateField(
        required=False,
        help_text='등록일 시작 (YYYY-MM-DD)'
    )
    end_date = serializers.DateField(
        required=False,
        help_text='등록일 종료 (YYYY-MM-DD)'
    )

    def validate(self, data):
        """날짜 범위 검증"""
        start_date = data.get('start_date')
        end_date = data.get('end_date')

        if start_date and end_date and start_date > end_date:
            raise serializers.ValidationError("시작일은 종료일보다 이전이어야 합니다.")

        return data


# ========== PatientAlert Serializers ==========

class PatientAlertListSerializer(serializers.ModelSerializer):
    """환자 주의사항 목록용 Serializer"""

    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)

    class Meta:
        model = PatientAlert
        fields = [
            'id',
            'patient',
            'alert_type',
            'alert_type_display',
            'severity',
            'severity_display',
            'title',
            'description',
            'is_active',
            'created_by',
            'created_by_name',
            'created_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at']


class PatientAlertDetailSerializer(serializers.ModelSerializer):
    """환자 주의사항 상세용 Serializer"""

    alert_type_display = serializers.CharField(source='get_alert_type_display', read_only=True)
    severity_display = serializers.CharField(source='get_severity_display', read_only=True)
    created_by_name = serializers.CharField(source='created_by.name', read_only=True)
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)

    class Meta:
        model = PatientAlert
        fields = [
            'id',
            'patient',
            'patient_name',
            'patient_number',
            'alert_type',
            'alert_type_display',
            'severity',
            'severity_display',
            'title',
            'description',
            'is_active',
            'created_by',
            'created_by_name',
            'created_at',
            'updated_at',
        ]
        read_only_fields = ['id', 'created_by', 'created_at', 'updated_at']


class PatientAlertCreateSerializer(serializers.ModelSerializer):
    """환자 주의사항 생성용 Serializer"""

    class Meta:
        model = PatientAlert
        fields = [
            'patient',
            'alert_type',
            'severity',
            'title',
            'description',
            'is_active',
        ]

    def validate_patient(self, value):
        """환자 유효성 검사"""
        if value.is_deleted:
            raise serializers.ValidationError("삭제된 환자입니다.")
        return value

    def create(self, validated_data):
        """주의사항 생성 (등록자 정보 자동 추가)"""
        request = self.context.get('request')
        if request and request.user:
            validated_data['created_by'] = request.user
        return super().create(validated_data)


class PatientAlertUpdateSerializer(serializers.ModelSerializer):
    """환자 주의사항 수정용 Serializer"""

    class Meta:
        model = PatientAlert
        fields = [
            'alert_type',
            'severity',
            'title',
            'description',
            'is_active',
        ]


# ========== Patient Dashboard Serializers (환자용 마이페이지) ==========

class PatientDashboardSerializer(serializers.ModelSerializer):
    """환자 대시보드용 기본정보 Serializer (환자 본인용)"""

    age = serializers.ReadOnlyField()
    attending_doctor_name = serializers.SerializerMethodField()
    attending_doctor_department = serializers.SerializerMethodField()

    class Meta:
        model = Patient
        fields = [
            'id',
            'patient_number',
            'name',
            'birth_date',
            'age',
            'gender',
            'phone',
            'email',
            'address',
            'blood_type',
            'allergies',
            'chronic_diseases',
            'chief_complaint',
            'status',
            'severity',
            'attending_doctor_name',
            'attending_doctor_department',
            'created_at',
        ]

    def get_attending_doctor_name(self, obj):
        """주치의 이름 조회 (가장 최근 진료의 담당의)"""
        from apps.encounters.models import Encounter
        latest_encounter = Encounter.objects.filter(
            patient=obj, is_deleted=False
        ).order_by('-admission_date').first()

        if latest_encounter and latest_encounter.attending_doctor:
            return latest_encounter.attending_doctor.name
        return None

    def get_attending_doctor_department(self, obj):
        """주치의 부서 조회"""
        from apps.encounters.models import Encounter
        latest_encounter = Encounter.objects.filter(
            patient=obj, is_deleted=False
        ).order_by('-admission_date').first()

        if latest_encounter:
            return latest_encounter.get_department_display()
        return None


class PatientEncounterListSerializer(serializers.ModelSerializer):
    """환자용 진료 이력 Serializer (읽기 전용, 민감정보 제외)"""

    attending_doctor_name = serializers.CharField(source='attending_doctor.name', read_only=True)
    encounter_type_display = serializers.CharField(source='get_encounter_type_display', read_only=True)
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    department_display = serializers.CharField(source='get_department_display', read_only=True)

    class Meta:
        model = None  # 아래에서 동적 설정
        fields = [
            'id',
            'encounter_type',
            'encounter_type_display',
            'status',
            'status_display',
            'attending_doctor_name',
            'department_display',
            'admission_date',
            'discharge_date',
            'chief_complaint',
            'primary_diagnosis',
        ]

    def __init__(self, *args, **kwargs):
        from apps.encounters.models import Encounter
        self.Meta.model = Encounter
        super().__init__(*args, **kwargs)


class PatientOCSListSerializer(serializers.ModelSerializer):
    """환자용 OCS 이력 Serializer (읽기 전용, 결과만)"""

    doctor_name = serializers.CharField(source='doctor.name', read_only=True)
    ocs_status_display = serializers.CharField(source='get_ocs_status_display', read_only=True)

    class Meta:
        model = None  # 아래에서 동적 설정
        fields = [
            'id',
            'ocs_id',
            'job_role',
            'job_type',
            'ocs_status',
            'ocs_status_display',
            'ocs_result',
            'doctor_name',
            'created_at',
            'confirmed_at',
        ]

    def __init__(self, *args, **kwargs):
        from apps.ocs.models import OCS
        self.Meta.model = OCS
        super().__init__(*args, **kwargs)
