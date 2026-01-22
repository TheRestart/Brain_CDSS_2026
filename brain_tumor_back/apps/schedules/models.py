from django.db import models
from django.core.exceptions import ValidationError


# =============================================================================
# 공통 일정 유형 및 색상
# =============================================================================
class ScheduleType(models.TextChoices):
    """일정 유형 (개인/공유 공통)"""
    MEETING = 'meeting', '회의'
    LEAVE = 'leave', '휴가'
    TRAINING = 'training', '교육'
    PERSONAL = 'personal', '개인'
    ANNOUNCEMENT = 'announcement', '공지'
    EVENT = 'event', '행사'
    OTHER = 'other', '기타'


# 기본 색상 (일정 유형별)
SCHEDULE_DEFAULT_COLORS = {
    'meeting': '#5b8def',       # 파랑
    'leave': '#e56b6f',         # 빨강
    'training': '#f2a65a',      # 주황
    'personal': '#5fb3a2',      # 청록
    'announcement': '#8b5cf6',  # 보라 (공지)
    'event': '#ec4899',         # 핑크 (행사)
    'other': '#9ca3af',         # 회색
}


# 권한별 공유 대상
class ScheduleVisibility(models.TextChoices):
    """공유 일정 표시 대상"""
    ALL = 'ALL', '전체'
    ADMIN = 'ADMIN', '관리자'
    DOCTOR = 'DOCTOR', '의사'
    NURSE = 'NURSE', '간호사'
    LIS = 'LIS', '검사실'
    RIS = 'RIS', '영상실'
    PATIENT = 'PATIENT', '환자'
    EXTERNAL = 'EXTERNAL', '외부기관'


# =============================================================================
# 공유 일정 모델 (Admin이 관리, 권한별로 표시)
# =============================================================================
class SharedSchedule(models.Model):
    """
    공유 일정 모델

    Admin이 생성/관리하며, visibility에 따라 해당 권한 사용자에게 표시됩니다.
    - ALL: 모든 사용자에게 표시 (전체 공지)
    - DOCTOR: 의사 권한 사용자에게만 표시
    - 등등
    """

    # 일정 정보
    title = models.CharField(
        max_length=200,
        verbose_name='일정 제목'
    )

    schedule_type = models.CharField(
        max_length=20,
        choices=ScheduleType.choices,
        default=ScheduleType.ANNOUNCEMENT,
        verbose_name='일정 유형'
    )

    description = models.TextField(
        blank=True,
        default='',
        verbose_name='설명'
    )

    # 일시
    start_datetime = models.DateTimeField(
        verbose_name='시작 일시'
    )

    end_datetime = models.DateTimeField(
        verbose_name='종료 일시'
    )

    all_day = models.BooleanField(
        default=False,
        verbose_name='종일 여부'
    )

    # 표시 색상
    color = models.CharField(
        max_length=7,
        blank=True,
        default='',
        verbose_name='색상',
        help_text='HEX 코드 (예: #5b8def). 비워두면 일정 유형별 기본 색상 사용'
    )

    # 공유 대상 (권한)
    visibility = models.CharField(
        max_length=20,
        choices=ScheduleVisibility.choices,
        default=ScheduleVisibility.ALL,
        verbose_name='표시 대상'
    )

    # 작성자 (Admin)
    created_by = models.ForeignKey(
        'accounts.User',
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_shared_schedules',
        verbose_name='작성자'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')
    is_deleted = models.BooleanField(default=False, verbose_name='삭제 여부')

    class Meta:
        db_table = 'shared_schedules'
        verbose_name = '공유 일정'
        verbose_name_plural = '공유 일정 목록'
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['visibility', 'start_datetime']),
            models.Index(fields=['start_datetime']),
            models.Index(fields=['schedule_type']),
        ]

    def __str__(self):
        return f"[{self.get_visibility_display()}] {self.title}"

    def clean(self):
        """유효성 검사"""
        if self.start_datetime and self.end_datetime:
            if self.end_datetime <= self.start_datetime:
                raise ValidationError({
                    'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_color(self):
        """표시할 색상 반환 (사용자 지정 또는 기본값)"""
        if self.color:
            return self.color
        return SCHEDULE_DEFAULT_COLORS.get(self.schedule_type, '#9ca3af')


# =============================================================================
# 개인 일정 모델 (모든 권한 사용자가 각자 관리)
# =============================================================================
class PersonalSchedule(models.Model):
    """
    개인 일정 모델

    모든 권한의 사용자가 각자의 개인 일정을 관리합니다.
    본인만 조회/수정 가능합니다.
    """

    # 소유자 (모든 권한)
    user = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='personal_schedules',
        verbose_name='소유자'
    )

    # 일정 정보
    title = models.CharField(
        max_length=200,
        verbose_name='일정 제목'
    )

    schedule_type = models.CharField(
        max_length=20,
        choices=ScheduleType.choices,
        default=ScheduleType.OTHER,
        verbose_name='일정 유형'
    )

    description = models.TextField(
        blank=True,
        default='',
        verbose_name='설명'
    )

    # 일시
    start_datetime = models.DateTimeField(
        verbose_name='시작 일시'
    )

    end_datetime = models.DateTimeField(
        verbose_name='종료 일시'
    )

    all_day = models.BooleanField(
        default=False,
        verbose_name='종일 여부'
    )

    # 표시 색상
    color = models.CharField(
        max_length=7,
        blank=True,
        default='',
        verbose_name='색상',
        help_text='HEX 코드 (예: #5b8def). 비워두면 일정 유형별 기본 색상 사용'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')
    is_deleted = models.BooleanField(default=False, verbose_name='삭제 여부')

    class Meta:
        db_table = 'personal_schedules'
        verbose_name = '개인 일정'
        verbose_name_plural = '개인 일정 목록'
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['user', 'start_datetime']),
            models.Index(fields=['user', '-start_datetime']),
            models.Index(fields=['schedule_type']),
        ]

    def __str__(self):
        return f"[{self.get_schedule_type_display()}] {self.title} ({self.user.name})"

    def clean(self):
        """유효성 검사"""
        if self.start_datetime and self.end_datetime:
            if self.end_datetime <= self.start_datetime:
                raise ValidationError({
                    'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_color(self):
        """표시할 색상 반환 (사용자 지정 또는 기본값)"""
        if self.color:
            return self.color
        return SCHEDULE_DEFAULT_COLORS.get(self.schedule_type, '#9ca3af')

    @property
    def duration_hours(self):
        """일정 시간 (시간 단위)"""
        if self.start_datetime and self.end_datetime:
            delta = self.end_datetime - self.start_datetime
            return round(delta.total_seconds() / 3600, 1)
        return 0


# =============================================================================
# 기존 DoctorSchedule 유지 (하위 호환성)
# =============================================================================
class DoctorSchedule(models.Model):
    """
    의사 개인 일정 모델 (레거시 - PersonalSchedule로 마이그레이션 예정)

    의사의 개인 일정(회의, 휴가, 교육 등)을 관리합니다.
    환자 진료 일정은 Encounter 모델에서 관리됩니다.
    """

    class ScheduleType(models.TextChoices):
        MEETING = 'meeting', '회의'
        LEAVE = 'leave', '휴가'
        TRAINING = 'training', '교육'
        PERSONAL = 'personal', '개인'
        OTHER = 'other', '기타'

    # 기본 색상 (일정 유형별)
    DEFAULT_COLORS = {
        'meeting': '#5b8def',    # 파랑
        'leave': '#e56b6f',      # 빨강
        'training': '#f2a65a',   # 주황
        'personal': '#5fb3a2',   # 초록
        'other': '#9ca3af',      # 회색
    }

    # 의사
    doctor = models.ForeignKey(
        'accounts.User',
        on_delete=models.CASCADE,
        related_name='schedules',
        verbose_name='의사'
    )

    # 일정 정보
    title = models.CharField(
        max_length=200,
        verbose_name='일정 제목'
    )

    schedule_type = models.CharField(
        max_length=20,
        choices=ScheduleType.choices,
        default=ScheduleType.OTHER,
        verbose_name='일정 유형'
    )

    description = models.TextField(
        blank=True,
        default='',
        verbose_name='설명'
    )

    # 일시
    start_datetime = models.DateTimeField(
        verbose_name='시작 일시'
    )

    end_datetime = models.DateTimeField(
        verbose_name='종료 일시'
    )

    all_day = models.BooleanField(
        default=False,
        verbose_name='종일 여부'
    )

    # 표시 색상 (선택)
    color = models.CharField(
        max_length=7,
        blank=True,
        default='',
        verbose_name='색상',
        help_text='HEX 코드 (예: #5b8def). 비워두면 일정 유형별 기본 색상 사용'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')
    is_deleted = models.BooleanField(default=False, verbose_name='삭제 여부')

    class Meta:
        db_table = 'doctor_schedules'
        verbose_name = '의사 일정'
        verbose_name_plural = '의사 일정 목록'
        ordering = ['start_datetime']
        indexes = [
            models.Index(fields=['doctor', 'start_datetime']),
            models.Index(fields=['doctor', '-start_datetime']),
            models.Index(fields=['schedule_type']),
        ]

    def __str__(self):
        return f"[{self.get_schedule_type_display()}] {self.title} ({self.doctor.name})"

    def clean(self):
        """유효성 검사"""
        if self.start_datetime and self.end_datetime:
            if self.end_datetime <= self.start_datetime:
                raise ValidationError({
                    'end_datetime': '종료 일시는 시작 일시 이후여야 합니다.'
                })

    def save(self, *args, **kwargs):
        self.full_clean()
        super().save(*args, **kwargs)

    @property
    def display_color(self):
        """표시할 색상 반환 (사용자 지정 또는 기본값)"""
        if self.color:
            return self.color
        return self.DEFAULT_COLORS.get(self.schedule_type, '#9ca3af')

    @property
    def duration_hours(self):
        """일정 시간 (시간 단위)"""
        if self.start_datetime and self.end_datetime:
            delta = self.end_datetime - self.start_datetime
            return round(delta.total_seconds() / 3600, 1)
        return 0
