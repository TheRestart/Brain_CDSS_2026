from rest_framework import serializers
from django.utils import timezone
from .models import Prescription, PrescriptionItem, Medication
from apps.patients.models import Patient


# =============================================================================
# Medication (의약품 마스터) Serializers
# =============================================================================


class MedicationListSerializer(serializers.ModelSerializer):
    """의약품 목록용 시리얼라이저"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    default_route_display = serializers.CharField(source='get_default_route_display', read_only=True)

    class Meta:
        model = Medication
        fields = [
            'id', 'code', 'name', 'generic_name', 'category', 'category_display',
            'default_dosage', 'default_route', 'default_route_display',
            'default_frequency', 'default_duration_days', 'unit', 'is_active'
        ]


class MedicationDetailSerializer(serializers.ModelSerializer):
    """의약품 상세 시리얼라이저"""
    category_display = serializers.CharField(source='get_category_display', read_only=True)
    default_route_display = serializers.CharField(source='get_default_route_display', read_only=True)

    class Meta:
        model = Medication
        fields = [
            'id', 'code', 'name', 'generic_name', 'category', 'category_display',
            'default_dosage', 'default_route', 'default_route_display',
            'default_frequency', 'default_duration_days', 'unit',
            'warnings', 'contraindications', 'is_active',
            'created_at', 'updated_at'
        ]


class MedicationCreateSerializer(serializers.ModelSerializer):
    """의약품 생성 시리얼라이저"""

    class Meta:
        model = Medication
        fields = [
            'code', 'name', 'generic_name', 'category',
            'default_dosage', 'default_route', 'default_frequency',
            'default_duration_days', 'unit', 'warnings', 'contraindications', 'is_active'
        ]

    def validate_code(self, value):
        if Medication.objects.filter(code=value).exists():
            raise serializers.ValidationError('이미 존재하는 의약품 코드입니다.')
        return value


class MedicationUpdateSerializer(serializers.ModelSerializer):
    """의약품 수정 시리얼라이저"""

    class Meta:
        model = Medication
        fields = [
            'name', 'generic_name', 'category',
            'default_dosage', 'default_route', 'default_frequency',
            'default_duration_days', 'unit', 'warnings', 'contraindications', 'is_active'
        ]


class MedicationSearchSerializer(serializers.Serializer):
    """의약품 검색 시리얼라이저"""
    q = serializers.CharField(required=False, help_text='검색어 (코드, 이름, 일반명)')
    category = serializers.ChoiceField(choices=Medication.Category.choices, required=False)
    is_active = serializers.BooleanField(required=False, default=True)


class QuickPrescribeSerializer(serializers.Serializer):
    """
    클릭 처방용 시리얼라이저

    의사가 의약품을 클릭하면 기본값으로 처방 항목을 자동 생성.
    필요시 용량, 빈도 등을 커스터마이즈 가능.
    """
    medication_id = serializers.IntegerField(help_text='의약품 마스터 ID')

    # 선택적 오버라이드 필드
    dosage = serializers.CharField(max_length=100, required=False, help_text='용량 (미입력 시 기본값 사용)')
    frequency = serializers.CharField(max_length=20, required=False, help_text='복용 빈도 (미입력 시 기본값 사용)')
    route = serializers.CharField(max_length=20, required=False, help_text='투여 경로 (미입력 시 기본값 사용)')
    duration_days = serializers.IntegerField(required=False, help_text='처방 일수 (미입력 시 기본값 사용)')
    quantity = serializers.IntegerField(required=False, default=1, help_text='총 수량')
    instructions = serializers.CharField(required=False, allow_blank=True, help_text='복용 지시')

    def validate_medication_id(self, value):
        try:
            medication = Medication.objects.get(id=value, is_active=True)
        except Medication.DoesNotExist:
            raise serializers.ValidationError('존재하지 않거나 비활성화된 의약품입니다.')
        return value

    def create_prescription_item(self, prescription):
        """처방전에 의약품 항목 추가"""
        medication = Medication.objects.get(id=self.validated_data['medication_id'])

        # 기본값 사용 또는 오버라이드
        item = PrescriptionItem.objects.create(
            prescription=prescription,
            medication=medication,
            medication_name=medication.name,
            medication_code=medication.code,
            dosage=self.validated_data.get('dosage', medication.default_dosage),
            frequency=self.validated_data.get('frequency', medication.default_frequency),
            route=self.validated_data.get('route', medication.default_route),
            duration_days=self.validated_data.get('duration_days', medication.default_duration_days),
            quantity=self.validated_data.get('quantity', 1),
            instructions=self.validated_data.get('instructions', ''),
            order=prescription.items.count()
        )
        return item


class PrescriptionItemSerializer(serializers.ModelSerializer):
    """처방 항목 시리얼라이저"""
    frequency_display = serializers.CharField(source='get_frequency_display', read_only=True)
    route_display = serializers.CharField(source='get_route_display', read_only=True)
    medication_info = MedicationListSerializer(source='medication', read_only=True)

    class Meta:
        model = PrescriptionItem
        fields = [
            'id', 'medication', 'medication_info', 'medication_name', 'medication_code', 'dosage',
            'frequency', 'frequency_display', 'route', 'route_display',
            'duration_days', 'quantity', 'instructions', 'order',
            'created_at', 'updated_at'
        ]
        read_only_fields = ['created_at', 'updated_at']


class PrescriptionItemCreateSerializer(serializers.ModelSerializer):
    """처방 항목 생성용 시리얼라이저"""
    medication_id = serializers.IntegerField(required=False, allow_null=True, help_text='의약품 마스터 ID (클릭 처방 시)')

    class Meta:
        model = PrescriptionItem
        fields = [
            'medication_id', 'medication_name', 'medication_code', 'dosage',
            'frequency', 'route', 'duration_days', 'quantity',
            'instructions', 'order'
        ]

    def validate(self, attrs):
        medication_id = attrs.get('medication_id')
        medication_name = attrs.get('medication_name')

        # medication_id가 있으면 마스터에서 정보 가져오기
        if medication_id:
            try:
                medication = Medication.objects.get(id=medication_id, is_active=True)
                # 마스터 정보로 기본값 설정 (명시적으로 입력한 값은 유지)
                if not medication_name:
                    attrs['medication_name'] = medication.name
                if not attrs.get('medication_code'):
                    attrs['medication_code'] = medication.code
                if not attrs.get('dosage'):
                    attrs['dosage'] = medication.default_dosage
                if not attrs.get('frequency'):
                    attrs['frequency'] = medication.default_frequency
                if not attrs.get('route'):
                    attrs['route'] = medication.default_route
                if not attrs.get('duration_days'):
                    attrs['duration_days'] = medication.default_duration_days
                attrs['medication'] = medication
            except Medication.DoesNotExist:
                raise serializers.ValidationError({'medication_id': '존재하지 않거나 비활성화된 의약품입니다.'})
        elif not medication_name:
            raise serializers.ValidationError({'medication_name': '의약품명은 필수입니다.'})

        return attrs


class PrescriptionListSerializer(serializers.ModelSerializer):
    """처방전 목록용 시리얼라이저"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    doctor_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    item_count = serializers.SerializerMethodField()

    class Meta:
        model = Prescription
        fields = [
            'id', 'prescription_id', 'patient', 'patient_name', 'patient_number',
            'doctor', 'doctor_name', 'encounter', 'status', 'status_display',
            'diagnosis', 'item_count', 'created_at', 'issued_at'
        ]

    def get_doctor_name(self, obj):
        """doctor가 None일 경우 처리"""
        if obj.doctor:
            return obj.doctor.name
        return None

    def get_item_count(self, obj):
        """item_count - prefetch된 items 사용"""
        return obj.items.count()


class PrescriptionDetailSerializer(serializers.ModelSerializer):
    """처방전 상세 시리얼라이저"""
    patient_name = serializers.CharField(source='patient.name', read_only=True)
    patient_number = serializers.CharField(source='patient.patient_number', read_only=True)
    patient_birth_date = serializers.DateField(source='patient.birth_date', read_only=True)
    patient_gender = serializers.CharField(source='patient.gender', read_only=True)
    doctor_name = serializers.SerializerMethodField()
    status_display = serializers.CharField(source='get_status_display', read_only=True)
    items = PrescriptionItemSerializer(many=True, read_only=True)
    is_editable = serializers.BooleanField(read_only=True)

    def get_doctor_name(self, obj):
        """doctor가 None일 경우 처리"""
        if obj.doctor:
            return obj.doctor.name
        return None

    class Meta:
        model = Prescription
        fields = [
            'id', 'prescription_id', 
            'patient', 'patient_name', 'patient_number', 'patient_birth_date', 'patient_gender',
            'doctor', 'doctor_name', 'encounter',
            'status', 'status_display', 'diagnosis', 'notes',
            'items', 'is_editable',
            'created_at', 'issued_at', 'dispensed_at', 'cancelled_at', 'updated_at',
            'cancel_reason'
        ]
        read_only_fields = ['prescription_id', 'created_at', 'updated_at']


class PrescriptionCreateSerializer(serializers.ModelSerializer):
    """처방전 생성 시리얼라이저"""
    patient_id = serializers.IntegerField(write_only=True)
    encounter_id = serializers.IntegerField(write_only=True, required=False, allow_null=True)
    items = PrescriptionItemCreateSerializer(many=True, write_only=True, required=False)

    class Meta:
        model = Prescription
        fields = ['patient_id', 'encounter_id', 'diagnosis', 'notes', 'items']

    def validate_patient_id(self, value):
        try:
            Patient.objects.get(id=value)
        except Patient.DoesNotExist:
            raise serializers.ValidationError('존재하지 않는 환자입니다.')
        return value

    def create(self, validated_data):
        patient_id = validated_data.pop('patient_id')
        encounter_id = validated_data.pop('encounter_id', None)
        items_data = validated_data.pop('items', [])
        user = self.context['request'].user

        prescription = Prescription.objects.create(
            patient_id=patient_id,
            doctor=user,
            encounter_id=encounter_id,
            **validated_data
        )

        # 처방 항목 생성
        for idx, item_data in enumerate(items_data):
            item_data['order'] = idx
            PrescriptionItem.objects.create(prescription=prescription, **item_data)

        return prescription


class PrescriptionUpdateSerializer(serializers.ModelSerializer):
    """처방전 수정 시리얼라이저"""
    items = PrescriptionItemCreateSerializer(many=True, required=False)

    class Meta:
        model = Prescription
        fields = ['diagnosis', 'notes', 'items']

    def validate(self, attrs):
        if self.instance and not self.instance.is_editable:
            raise serializers.ValidationError('발행된 처방전은 수정할 수 없습니다.')
        return attrs

    def update(self, instance, validated_data):
        items_data = validated_data.pop('items', None)

        # 기본 필드 업데이트
        for attr, value in validated_data.items():
            setattr(instance, attr, value)
        instance.save()

        # 항목 업데이트 (전체 교체 방식)
        if items_data is not None:
            instance.items.all().delete()
            for idx, item_data in enumerate(items_data):
                item_data['order'] = idx
                PrescriptionItem.objects.create(prescription=instance, **item_data)

        return instance


class PrescriptionIssueSerializer(serializers.Serializer):
    """처방전 발행 시리얼라이저"""
    pass  # 추가 데이터 없이 발행


class PrescriptionCancelSerializer(serializers.Serializer):
    """처방전 취소 시리얼라이저"""
    cancel_reason = serializers.CharField(max_length=200, required=True)
