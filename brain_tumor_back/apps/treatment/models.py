from django.db import models
from apps.patients.models import Patient
from apps.encounters.models import Encounter
from apps.accounts.models import User


class TreatmentPlan(models.Model):
    """
    치료 계획

    뇌종양 환자의 치료 계획 수립 및 추적.
    """

    class TreatmentType(models.TextChoices):
        SURGERY = 'surgery', '수술'
        RADIATION = 'radiation', '방사선 치료'
        CHEMOTHERAPY = 'chemotherapy', '항암 치료'
        OBSERVATION = 'observation', '경과 관찰'
        COMBINED = 'combined', '병합 치료'

    class TreatmentGoal(models.TextChoices):
        CURATIVE = 'curative', '완치 목적'
        PALLIATIVE = 'palliative', '완화 목적'
        ADJUVANT = 'adjuvant', '보조 요법'
        NEOADJUVANT = 'neoadjuvant', '선행 요법'

    class Status(models.TextChoices):
        PLANNED = 'planned', '계획됨'
        IN_PROGRESS = 'in_progress', '진행 중'
        COMPLETED = 'completed', '완료'
        CANCELLED = 'cancelled', '취소됨'
        ON_HOLD = 'on_hold', '보류 중'

    # 관계
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='treatment_plans',
        verbose_name='환자'
    )

    encounter = models.ForeignKey(
        Encounter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treatment_plans',
        verbose_name='진료'
    )

    # OCS 연결 (선택적)
    ocs = models.ForeignKey(
        'ocs.OCS',
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='treatment_plans',
        verbose_name='OCS 오더'
    )

    # 치료 정보
    treatment_type = models.CharField(
        max_length=20,
        choices=TreatmentType.choices,
        verbose_name='치료 유형'
    )

    treatment_goal = models.CharField(
        max_length=20,
        choices=TreatmentGoal.choices,
        default=TreatmentGoal.CURATIVE,
        verbose_name='치료 목표'
    )

    plan_summary = models.TextField(
        verbose_name='치료 계획 요약'
    )

    # 담당 의사
    planned_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='planned_treatments',
        verbose_name='계획 수립 의사'
    )

    # 상태 및 일정
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PLANNED,
        verbose_name='상태'
    )

    start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='시작 예정일'
    )

    end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='종료 예정일'
    )

    actual_start_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='실제 시작일'
    )

    actual_end_date = models.DateField(
        null=True,
        blank=True,
        verbose_name='실제 종료일'
    )

    # 추가 정보
    notes = models.TextField(
        blank=True,
        verbose_name='비고'
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')

    class Meta:
        db_table = 'treatment_plan'
        verbose_name = '치료 계획'
        verbose_name_plural = '치료 계획 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient']),
            models.Index(fields=['status']),
            models.Index(fields=['treatment_type']),
            models.Index(fields=['planned_by']),
        ]

    def __str__(self):
        return f"{self.patient.name} - {self.get_treatment_type_display()}"


class TreatmentSession(models.Model):
    """
    치료 세션

    개별 치료 회차 기록.
    """

    class Status(models.TextChoices):
        SCHEDULED = 'scheduled', '예정됨'
        IN_PROGRESS = 'in_progress', '진행 중'
        COMPLETED = 'completed', '완료'
        CANCELLED = 'cancelled', '취소됨'
        MISSED = 'missed', '불참'

    # 관계
    treatment_plan = models.ForeignKey(
        TreatmentPlan,
        on_delete=models.CASCADE,
        related_name='sessions',
        verbose_name='치료 계획'
    )

    # 세션 정보
    session_number = models.PositiveIntegerField(
        verbose_name='회차'
    )

    session_date = models.DateTimeField(
        verbose_name='치료 일시'
    )

    # 담당자
    performed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='performed_treatments',
        verbose_name='시술 의사'
    )

    # 상태
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.SCHEDULED,
        verbose_name='상태'
    )

    # 치료 기록
    session_note = models.TextField(
        blank=True,
        verbose_name='치료 기록'
    )

    # 부작용
    adverse_events = models.JSONField(
        default=list,
        blank=True,
        verbose_name='부작용',
        help_text='발생한 부작용 목록'
    )

    # 바이탈 사인 (치료 전후)
    vitals_before = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='치료 전 바이탈'
    )

    vitals_after = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='치료 후 바이탈'
    )

    # 투여 약물/용량 (항암 치료 시)
    medications = models.JSONField(
        default=list,
        blank=True,
        verbose_name='투여 약물',
        help_text='투여된 약물 및 용량'
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')

    class Meta:
        db_table = 'treatment_session'
        verbose_name = '치료 세션'
        verbose_name_plural = '치료 세션 목록'
        ordering = ['treatment_plan', 'session_number']
        unique_together = ['treatment_plan', 'session_number']
        indexes = [
            models.Index(fields=['treatment_plan']),
            models.Index(fields=['status']),
            models.Index(fields=['session_date']),
        ]

    def __str__(self):
        return f"{self.treatment_plan} - {self.session_number}회차"
