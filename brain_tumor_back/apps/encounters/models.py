from django.db import models
from django.core.exceptions import ValidationError
from apps.patients.models import Patient
from apps.accounts.models import User


class Encounter(models.Model):
    """진료 모델"""

    ENCOUNTER_TYPE_CHOICES = [
        ('outpatient', '외래'),
        ('inpatient', '입원'),
        ('emergency', '응급'),
    ]

    STATUS_CHOICES = [
        ('scheduled', '예정'),
        ('in_progress', '진행중'),
        ('completed', '완료'),
        ('cancelled', '취소'),
    ]

    DEPARTMENT_CHOICES = [
        ('neurology', '신경과'),
        ('neurosurgery', '신경외과'),
    ]

    # 기본 정보
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='encounters',
        verbose_name='환자'
    )
    encounter_type = models.CharField(
        max_length=20,
        choices=ENCOUNTER_TYPE_CHOICES,
        verbose_name='진료 유형'
    )
    status = models.CharField(
        max_length=20,
        choices=STATUS_CHOICES,
        default='scheduled',
        verbose_name='상태'
    )
    attending_doctor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='encounters_as_doctor',
        verbose_name='담당 의사',
        limit_choices_to={'role__code__in': ['DOCTOR', 'SYSTEMMANAGER']}
    )
    department = models.CharField(
        max_length=20,
        choices=DEPARTMENT_CHOICES,
        verbose_name='진료과'
    )

    # 일시 정보
    admission_date = models.DateTimeField(
        verbose_name='입원/진료 일시'
    )
    scheduled_time = models.TimeField(
        null=True,
        blank=True,
        verbose_name='예약 시간'
    )
    discharge_date = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='퇴원 일시'
    )

    # 진료 내용
    chief_complaint = models.TextField(
        blank=True,
        default='',
        verbose_name='주 호소',
        help_text='환자가 호소하는 주요 증상'
    )
    primary_diagnosis = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='주 진단명'
    )
    secondary_diagnoses = models.JSONField(
        default=list,
        blank=True,
        verbose_name='부 진단명'
    )

    # SOAP 노트
    subjective = models.TextField(
        blank=True,
        default='',
        verbose_name='주관적 소견 (S)',
        help_text='환자가 호소하는 증상, 병력'
    )
    objective = models.TextField(
        blank=True,
        default='',
        verbose_name='객관적 소견 (O)',
        help_text='신체검사, 검사결과, 활력징후'
    )
    assessment = models.TextField(
        blank=True,
        default='',
        verbose_name='평가 (A)',
        help_text='진단명, 감별진단'
    )
    plan = models.TextField(
        blank=True,
        default='',
        verbose_name='계획 (P)',
        help_text='치료계획, 처방, 추적관찰'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')
    is_deleted = models.BooleanField(default=False, verbose_name='삭제 여부')

    class Meta:
        db_table = 'encounters'
        ordering = ['-admission_date']
        verbose_name = '진료'
        verbose_name_plural = '진료 목록'
        indexes = [
            models.Index(fields=['patient', '-admission_date']),
            models.Index(fields=['attending_doctor', '-admission_date']),
            models.Index(fields=['status']),
        ]

    def __str__(self):
        return f"{self.patient.name} - {self.get_encounter_type_display()} ({self.admission_date.strftime('%Y-%m-%d')})"

    def clean(self):
        """모델 유효성 검사"""
        if self.discharge_date and self.admission_date:
            if self.discharge_date < self.admission_date:
                raise ValidationError('퇴원 일시는 입원 일시보다 이후여야 합니다.')

    def save(self, *args, **kwargs):
        # update_fields가 지정된 경우 full_clean 건너뜀 (부분 업데이트)
        if not kwargs.get('update_fields'):
            self.full_clean()
        super().save(*args, **kwargs)

    @property
    def duration_days(self):
        """재원 기간 (일수)"""
        if self.discharge_date and self.admission_date:
            return (self.discharge_date - self.admission_date).days
        return None

    @property
    def is_active(self):
        """활성 진료 여부"""
        return self.status in ['scheduled', 'in_progress'] and not self.is_deleted
