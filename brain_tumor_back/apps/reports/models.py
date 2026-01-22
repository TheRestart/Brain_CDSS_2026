from django.db import models
from apps.patients.models import Patient
from apps.accounts.models import User
from apps.encounters.models import Encounter
from apps.ai_inference.models import AIInference


class FinalReport(models.Model):
    """
    최종 진료 보고서

    환자의 진료 결과, AI 추론 결과, 의사 소견을 통합한 최종 보고서.
    """

    class Status(models.TextChoices):
        DRAFT = 'DRAFT', '작성 중'
        PENDING_REVIEW = 'PENDING_REVIEW', '검토 대기'
        APPROVED = 'APPROVED', '승인됨'
        FINALIZED = 'FINALIZED', '최종 확정'
        CANCELLED = 'CANCELLED', '취소됨'

    class ReportType(models.TextChoices):
        INITIAL = 'INITIAL', '초진 보고서'
        FOLLOWUP = 'FOLLOWUP', '경과 보고서'
        DISCHARGE = 'DISCHARGE', '퇴원 보고서'
        FINAL = 'FINAL', '최종 보고서'

    # 식별자
    report_id = models.CharField(
        max_length=30,
        unique=True,
        verbose_name='보고서 ID',
        help_text='보고서 식별자 (예: rpt_0001)'
    )

    # 관계
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='final_reports',
        verbose_name='환자'
    )

    encounter = models.ForeignKey(
        Encounter,
        on_delete=models.PROTECT,
        null=True,
        blank=True,
        related_name='final_reports',
        verbose_name='관련 진료'
    )

    # 보고서 유형 및 상태
    report_type = models.CharField(
        max_length=20,
        choices=ReportType.choices,
        default=ReportType.FINAL,
        verbose_name='보고서 유형'
    )

    status = models.CharField(
        max_length=20,
        choices=Status.choices,
        default=Status.DRAFT,
        verbose_name='상태'
    )

    # 진단 정보
    primary_diagnosis = models.CharField(
        max_length=500,
        verbose_name='주 진단명',
        help_text='최종 주 진단명'
    )

    secondary_diagnoses = models.JSONField(
        default=list,
        blank=True,
        verbose_name='부 진단명'
    )

    diagnosis_date = models.DateField(
        verbose_name='진단일'
    )

    # 치료 정보
    treatment_summary = models.TextField(
        blank=True,
        verbose_name='치료 요약',
        help_text='시행된 치료 내역 요약'
    )

    treatment_plan = models.TextField(
        blank=True,
        verbose_name='향후 치료 계획'
    )

    # AI 분석 결과 참조
    ai_inferences = models.ManyToManyField(
        AIInference,
        blank=True,
        related_name='final_reports',
        verbose_name='AI 추론'
    )

    ai_analysis_summary = models.TextField(
        blank=True,
        verbose_name='AI 분석 요약',
        help_text='AI 추론 결과 요약'
    )

    # 의사 소견
    clinical_findings = models.TextField(
        blank=True,
        verbose_name='임상 소견'
    )

    doctor_opinion = models.TextField(
        blank=True,
        verbose_name='의사 소견'
    )

    recommendations = models.TextField(
        blank=True,
        verbose_name='권고 사항'
    )

    prognosis = models.TextField(
        blank=True,
        verbose_name='예후',
        help_text='예상 경과'
    )

    # 작성자 정보
    created_by = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='created_reports',
        verbose_name='작성자'
    )

    # 작성자 소속 정보 (스냅샷)
    author_department = models.CharField(
        max_length=100,
        blank=True,
        verbose_name='작성자 부서',
        help_text='보고서 작성 시점의 작성자 부서'
    )

    author_work_station = models.CharField(
        max_length=200,
        blank=True,
        verbose_name='작성자 근무지',
        help_text='보고서 작성 시점의 작성자 근무지'
    )

    # 검토/승인 정보
    reviewed_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='reviewed_reports',
        verbose_name='검토자'
    )

    reviewed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='검토 일시'
    )

    approved_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='approved_reports',
        verbose_name='승인자'
    )

    approved_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='승인 일시'
    )

    finalized_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='최종 확정 일시'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')
    is_deleted = models.BooleanField(default=False, verbose_name='삭제 여부')

    class Meta:
        db_table = 'final_report'
        verbose_name = '최종 진료 보고서'
        verbose_name_plural = '최종 진료 보고서 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['report_id']),
            models.Index(fields=['patient']),
            models.Index(fields=['status']),
            models.Index(fields=['created_by']),
            models.Index(fields=['report_type']),
        ]

    def __str__(self):
        return f"{self.report_id} - {self.patient.name}"

    def save(self, *args, **kwargs):
        if not self.report_id:
            self.report_id = self._generate_report_id()

        # 작성자 소속 정보 스냅샷 저장
        if not self.author_department and hasattr(self.created_by, 'profile'):
            profile = self.created_by.profile
            if profile:
                self.author_department = profile.department or ''
                self.author_work_station = profile.workStation or ''

        super().save(*args, **kwargs)

    def _generate_report_id(self):
        """report_id 자동 생성 (rpt_0001 형식)"""
        last_report = FinalReport.objects.order_by('-id').first()
        if last_report and last_report.report_id:
            try:
                last_num = int(last_report.report_id.split('_')[-1])
                return f"rpt_{last_num + 1:04d}"
            except (ValueError, IndexError):
                pass
        return "rpt_0001"


class ReportAttachment(models.Model):
    """
    보고서 첨부파일

    보고서에 첨부되는 이미지, 문서 등의 파일.
    """

    class FileType(models.TextChoices):
        IMAGE = 'IMAGE', '이미지'
        DOCUMENT = 'DOCUMENT', '문서'
        DICOM = 'DICOM', 'DICOM 영상'
        OTHER = 'OTHER', '기타'

    report = models.ForeignKey(
        FinalReport,
        on_delete=models.CASCADE,
        related_name='attachments',
        verbose_name='보고서'
    )

    file_type = models.CharField(
        max_length=20,
        choices=FileType.choices,
        default=FileType.OTHER,
        verbose_name='파일 유형'
    )

    file_name = models.CharField(
        max_length=255,
        verbose_name='파일명'
    )

    file_path = models.CharField(
        max_length=500,
        verbose_name='파일 경로'
    )

    file_size = models.IntegerField(
        default=0,
        verbose_name='파일 크기 (bytes)'
    )

    description = models.CharField(
        max_length=500,
        blank=True,
        verbose_name='설명'
    )

    uploaded_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='uploaded_attachments',
        verbose_name='업로드자'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')

    class Meta:
        db_table = 'report_attachment'
        verbose_name = '보고서 첨부파일'
        verbose_name_plural = '보고서 첨부파일 목록'
        ordering = ['created_at']

    def __str__(self):
        return f"{self.report.report_id} - {self.file_name}"


class ReportLog(models.Model):
    """
    보고서 변경 로그

    보고서 생성, 수정, 상태 변경 등의 이력.
    """

    class Action(models.TextChoices):
        CREATED = 'CREATED', '생성'
        UPDATED = 'UPDATED', '수정'
        SUBMITTED = 'SUBMITTED', '검토 제출'
        REVIEWED = 'REVIEWED', '검토 완료'
        APPROVED = 'APPROVED', '승인'
        FINALIZED = 'FINALIZED', '최종 확정'
        CANCELLED = 'CANCELLED', '취소'

    report = models.ForeignKey(
        FinalReport,
        on_delete=models.CASCADE,
        related_name='logs',
        verbose_name='보고서'
    )

    action = models.CharField(
        max_length=20,
        choices=Action.choices,
        verbose_name='동작'
    )

    message = models.TextField(
        verbose_name='로그 메시지'
    )

    details = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='상세 정보'
    )

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='report_logs',
        verbose_name='수행자'
    )

    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')

    class Meta:
        db_table = 'report_log'
        verbose_name = '보고서 로그'
        verbose_name_plural = '보고서 로그 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['report']),
            models.Index(fields=['action']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.report.report_id} - {self.get_action_display()}"
