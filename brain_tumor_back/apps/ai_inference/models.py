from django.db import models, transaction
from apps.patients.models import Patient
from apps.accounts.models import User
from apps.ocs.models import OCS


class AIInference(models.Model):
    """
    AI 추론 테이블 (단일 테이블)

    M1: mri_ocs로 중복 체크
    MG: rna_ocs로 중복 체크
    MM: mri_ocs + rna_ocs + protein_ocs 모두 일치해야 중복
    """

    class ModelType(models.TextChoices):
        M1 = 'M1', 'M1 (MRI)'
        MG = 'MG', 'MG (Genetic)'
        MM = 'MM', 'MM (Multimodal)'

    class Status(models.TextChoices):
        PENDING = 'PENDING', '대기'
        PROCESSING = 'PROCESSING', '처리중'
        COMPLETED = 'COMPLETED', '완료'
        FAILED = 'FAILED', '실패'

    class Mode(models.TextChoices):
        MANUAL = 'manual', '수동'
        AUTO = 'auto', '자동'

    # 식별자
    job_id = models.CharField(
        max_length=30,
        unique=True,
        verbose_name='Job ID',
        help_text='추론 요청 ID (ai_req_0001)'
    )

    # 모델 타입
    model_type = models.CharField(
        max_length=10,
        choices=ModelType.choices,
        verbose_name='모델 타입'
    )

    # 환자
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='ai_inferences',
        verbose_name='환자'
    )

    # OCS 참조 (모델별 사용)
    mri_ocs = models.ForeignKey(
        OCS,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='mri_inferences',
        verbose_name='MRI OCS',
        help_text='M1, MM 모델용'
    )

    rna_ocs = models.ForeignKey(
        OCS,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='rna_inferences',
        verbose_name='RNA OCS',
        help_text='MG, MM 모델용'
    )

    protein_ocs = models.ForeignKey(
        OCS,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='protein_inferences',
        verbose_name='Protein OCS',
        help_text='MM 모델용'
    )

    # 상태
    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.PENDING,
        verbose_name='상태'
    )

    mode = models.CharField(
        max_length=10,
        choices=Mode.choices,
        default=Mode.MANUAL,
        verbose_name='모드'
    )

    # 결과
    result_data = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='추론 결과',
        help_text='JSON 형태의 추론 결과'
    )

    error_message = models.TextField(
        blank=True,
        null=True,
        verbose_name='에러 메시지'
    )

    # 요청자
    requested_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='ai_inferences',
        verbose_name='요청자'
    )

    # 타임스탬프
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    completed_at = models.DateTimeField(null=True, blank=True, verbose_name='완료일시')

    class Meta:
        db_table = 'ai_inference'
        verbose_name = 'AI 추론'
        verbose_name_plural = 'AI 추론 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['job_id']),
            models.Index(fields=['model_type']),
            models.Index(fields=['status']),
            models.Index(fields=['mri_ocs']),
            models.Index(fields=['rna_ocs']),
            models.Index(fields=['protein_ocs']),
        ]

    def __str__(self):
        return f"{self.job_id} ({self.model_type})"

    def save(self, *args, **kwargs):
        if not self.job_id:
            self.job_id = self._generate_job_id()
        super().save(*args, **kwargs)

    @transaction.atomic
    def _generate_job_id(self):
        """job_id 자동 생성 (ai_req_0001 형식)

        Race condition 방지를 위해 @transaction.atomic + select_for_update 사용
        """
        last = AIInference.objects.select_for_update().order_by('-id').first()
        if last and last.job_id:
            try:
                num = int(last.job_id.split('_')[-1])
                return f"ai_req_{num + 1:04d}"
            except (ValueError, IndexError):
                pass
        return "ai_req_0001"

    @classmethod
    def find_existing(cls, model_type, mri_ocs=None, rna_ocs=None, protein_ocs=None):
        """
        동일한 OCS로 완료된 추론 찾기

        M1: mri_ocs만 비교
        MG: rna_ocs만 비교
        MM: mri_ocs + rna_ocs + protein_ocs 모두 비교
        """
        qs = cls.objects.filter(model_type=model_type, status=cls.Status.COMPLETED)

        if model_type == cls.ModelType.M1:
            qs = qs.filter(mri_ocs=mri_ocs)
        elif model_type == cls.ModelType.MG:
            qs = qs.filter(rna_ocs=rna_ocs)
        elif model_type == cls.ModelType.MM:
            qs = qs.filter(mri_ocs=mri_ocs, rna_ocs=rna_ocs, protein_ocs=protein_ocs)

        return qs.order_by('-completed_at').first()
