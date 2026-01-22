from django.db import models
from apps.patients.models import Patient
from apps.accounts.models import User
from apps.treatment.models import TreatmentPlan


class FollowUp(models.Model):
    """
    경과 추적

    치료 후 경과 관찰 및 추적 검사 관리.
    """

    class FollowUpType(models.TextChoices):
        ROUTINE = 'routine', '정기 추적'
        SYMPTOM_BASED = 'symptom_based', '증상 기반'
        POST_TREATMENT = 'post_treatment', '치료 후 추적'
        EMERGENCY = 'emergency', '응급 내원'

    class ClinicalStatus(models.TextChoices):
        STABLE = 'stable', '안정'
        IMPROVED = 'improved', '호전'
        DETERIORATED = 'deteriorated', '악화'
        RECURRENCE = 'recurrence', '재발'
        PROGRESSION = 'progression', '진행'
        REMISSION = 'remission', '관해'

    # 관계
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='followups',
        verbose_name='환자'
    )

    treatment_plan = models.ForeignKey(
        TreatmentPlan,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='followups',
        verbose_name='치료 계획'
    )

    # OCS 연결 (영상검사 등)
    related_ocs = models.ForeignKey(
        'ocs.OCS',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='followups',
        verbose_name='관련 OCS'
    )

    # 추적 정보
    followup_date = models.DateTimeField(
        verbose_name='추적 일시'
    )

    followup_type = models.CharField(
        max_length=20,
        choices=FollowUpType.choices,
        default=FollowUpType.ROUTINE,
        verbose_name='추적 유형'
    )

    # 임상 상태
    clinical_status = models.CharField(
        max_length=20,
        choices=ClinicalStatus.choices,
        verbose_name='임상 상태'
    )

    # 증상
    symptoms = models.JSONField(
        default=list,
        blank=True,
        verbose_name='증상',
        help_text='현재 증상 목록'
    )

    # KPS (Karnofsky Performance Score)
    kps_score = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='KPS 점수',
        help_text='Karnofsky Performance Score (0-100)'
    )

    # ECOG Performance Status
    ecog_score = models.PositiveIntegerField(
        null=True,
        blank=True,
        verbose_name='ECOG 점수',
        help_text='ECOG Performance Status (0-5)'
    )

    # 바이탈 사인
    vitals = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='바이탈 사인',
        help_text='BP, HR, RR, BT 등'
    )

    # 체중
    weight_kg = models.DecimalField(
        max_digits=5,
        decimal_places=2,
        null=True,
        blank=True,
        verbose_name='체중(kg)'
    )

    # 경과 기록
    note = models.TextField(
        blank=True,
        verbose_name='경과 기록'
    )

    # 다음 추적
    next_followup_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='다음 추적 예정일'
    )

    # 기록자
    recorded_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='recorded_followups',
        verbose_name='기록자'
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')

    class Meta:
        db_table = 'followup'
        verbose_name = '경과 추적'
        verbose_name_plural = '경과 추적 목록'
        ordering = ['-followup_date']
        indexes = [
            models.Index(fields=['patient']),
            models.Index(fields=['clinical_status']),
            models.Index(fields=['followup_date']),
            models.Index(fields=['followup_type']),
        ]

    def __str__(self):
        return f"{self.patient.name} - {self.followup_date.strftime('%Y-%m-%d')}"
