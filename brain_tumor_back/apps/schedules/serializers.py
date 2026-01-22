from rest_framework import serializers
from .models import DoctorSchedule, SharedSchedule, PersonalSchedule


# =============================================================================
# 공유 일정 Serializers (Admin 관리용)
# =============================================================================
class SharedScheduleListSerializer(serializers.ModelSerializer):
    """공유 일정 목록 조회용"""
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )
    visibility_display = serializers.CharField(
        source='get_visibility_display', read_only=True
    )
    created_by_name = serializers.CharField(
        source='created_by.name', read_only=True
    )
    color = serializers.CharField(source='display_color', read_only=True)

    class Meta:
        model = SharedSchedule
        fields = [
            'id', 'title', 'schedule_type', 'schedule_type_display',
            'start_datetime', 'end_datetime', 'all_day',
            'color', 'visibility', 'visibility_display',
            'created_by', 'created_by_name', 'created_at',
        ]
        read_only_fields = fields


class SharedScheduleCreateSerializer(serializers.ModelSerializer):
    """공유 일정 생성용"""

    class Meta:
        model = SharedSchedule
        fields = [
            'title', 'schedule_type', 'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color', 'visibility',
        ]

    def validate(self, attrs):
        start = attrs.get('start_datetime')
        end = attrs.get('end_datetime')
        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
            })
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        return SharedSchedule.objects.create(
            created_by=request.user,
            **validated_data
        )


class SharedScheduleUpdateSerializer(serializers.ModelSerializer):
    """공유 일정 수정용"""

    class Meta:
        model = SharedSchedule
        fields = [
            'title', 'schedule_type', 'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color', 'visibility',
        ]

    def validate(self, attrs):
        start = attrs.get('start_datetime', self.instance.start_datetime)
        end = attrs.get('end_datetime', self.instance.end_datetime)
        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
            })
        return attrs


class SharedScheduleCalendarSerializer(serializers.ModelSerializer):
    """공유 일정 캘린더 표시용"""
    start = serializers.DateTimeField(source='start_datetime', read_only=True)
    end = serializers.DateTimeField(source='end_datetime', read_only=True)
    color = serializers.CharField(source='display_color', read_only=True)
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )
    scope = serializers.SerializerMethodField()

    class Meta:
        model = SharedSchedule
        fields = [
            'id', 'title', 'schedule_type', 'schedule_type_display',
            'start', 'end', 'all_day', 'color',
            'visibility', 'scope',
        ]
        read_only_fields = fields

    def get_scope(self, obj):
        return 'shared'


# =============================================================================
# 개인 일정 Serializers (모든 사용자용)
# =============================================================================
class PersonalScheduleListSerializer(serializers.ModelSerializer):
    """개인 일정 목록 조회용"""
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )
    color = serializers.CharField(source='display_color', read_only=True)

    class Meta:
        model = PersonalSchedule
        fields = [
            'id', 'title', 'schedule_type', 'schedule_type_display',
            'start_datetime', 'end_datetime', 'all_day',
            'color', 'created_at',
        ]
        read_only_fields = fields


class PersonalScheduleCreateSerializer(serializers.ModelSerializer):
    """개인 일정 생성용"""

    class Meta:
        model = PersonalSchedule
        fields = [
            'title', 'schedule_type', 'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color',
        ]

    def validate(self, attrs):
        start = attrs.get('start_datetime')
        end = attrs.get('end_datetime')
        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
            })
        return attrs

    def create(self, validated_data):
        request = self.context.get('request')
        return PersonalSchedule.objects.create(
            user=request.user,
            **validated_data
        )


class PersonalScheduleUpdateSerializer(serializers.ModelSerializer):
    """개인 일정 수정용"""

    class Meta:
        model = PersonalSchedule
        fields = [
            'title', 'schedule_type', 'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color',
        ]

    def validate(self, attrs):
        start = attrs.get('start_datetime', self.instance.start_datetime)
        end = attrs.get('end_datetime', self.instance.end_datetime)
        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
            })
        return attrs


class PersonalScheduleCalendarSerializer(serializers.ModelSerializer):
    """개인 일정 캘린더 표시용"""
    start = serializers.DateTimeField(source='start_datetime', read_only=True)
    end = serializers.DateTimeField(source='end_datetime', read_only=True)
    color = serializers.CharField(source='display_color', read_only=True)
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )
    scope = serializers.SerializerMethodField()

    class Meta:
        model = PersonalSchedule
        fields = [
            'id', 'title', 'schedule_type', 'schedule_type_display',
            'start', 'end', 'all_day', 'color',
            'scope',
        ]
        read_only_fields = fields

    def get_scope(self, obj):
        return 'personal'


# =============================================================================
# 기존 DoctorSchedule Serializers (하위 호환성)
# =============================================================================
class DoctorScheduleListSerializer(serializers.ModelSerializer):
    """목록 조회용 Serializer"""
    doctor_name = serializers.CharField(source='doctor.name', read_only=True)
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )
    display_color = serializers.CharField(read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = [
            'id', 'doctor', 'doctor_name',
            'title', 'schedule_type', 'schedule_type_display',
            'start_datetime', 'end_datetime', 'all_day',
            'color', 'display_color',
            'created_at',
        ]
        read_only_fields = fields


class DoctorScheduleDetailSerializer(serializers.ModelSerializer):
    """상세 조회용 Serializer"""
    doctor_name = serializers.CharField(source='doctor.name', read_only=True)
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )
    display_color = serializers.CharField(read_only=True)
    duration_hours = serializers.FloatField(read_only=True)

    class Meta:
        model = DoctorSchedule
        fields = [
            'id', 'doctor', 'doctor_name',
            'title', 'schedule_type', 'schedule_type_display',
            'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color', 'display_color', 'duration_hours',
            'created_at', 'updated_at',
        ]
        read_only_fields = [
            'id', 'doctor', 'doctor_name',
            'schedule_type_display', 'display_color', 'duration_hours',
            'created_at', 'updated_at',
        ]


class DoctorScheduleCreateSerializer(serializers.ModelSerializer):
    """생성용 Serializer"""

    class Meta:
        model = DoctorSchedule
        fields = [
            'title', 'schedule_type', 'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color',
        ]

    def validate(self, attrs):
        """시작/종료 일시 검증"""
        start = attrs.get('start_datetime')
        end = attrs.get('end_datetime')

        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
            })

        return attrs

    def create(self, validated_data):
        """생성 시 현재 사용자를 doctor로 설정"""
        request = self.context.get('request')
        return DoctorSchedule.objects.create(
            doctor=request.user,
            **validated_data
        )


class DoctorScheduleUpdateSerializer(serializers.ModelSerializer):
    """수정용 Serializer"""

    class Meta:
        model = DoctorSchedule
        fields = [
            'title', 'schedule_type', 'description',
            'start_datetime', 'end_datetime', 'all_day',
            'color',
        ]

    def validate(self, attrs):
        """시작/종료 일시 검증"""
        start = attrs.get('start_datetime', self.instance.start_datetime)
        end = attrs.get('end_datetime', self.instance.end_datetime)

        if start and end and end <= start:
            raise serializers.ValidationError({
                'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
            })

        return attrs


class DoctorScheduleCalendarSerializer(serializers.ModelSerializer):
    """캘린더 표시용 간소화 Serializer"""
    # 프론트엔드 CalendarScheduleItem 타입과 필드명 일치
    start = serializers.DateTimeField(source='start_datetime', read_only=True)
    end = serializers.DateTimeField(source='end_datetime', read_only=True)
    color = serializers.CharField(source='display_color', read_only=True)
    schedule_type_display = serializers.CharField(
        source='get_schedule_type_display', read_only=True
    )

    class Meta:
        model = DoctorSchedule
        fields = [
            'id', 'title', 'schedule_type', 'schedule_type_display',
            'start', 'end', 'all_day',
            'color',
        ]
        read_only_fields = fields
