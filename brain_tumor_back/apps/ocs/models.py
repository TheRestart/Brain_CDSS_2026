from django.db import models
from django.utils import timezone
from apps.patients.models import Patient
from apps.encounters.models import Encounter
from apps.accounts.models import User


# =============================================================================
# OCS (Order Communication System) - 단일 테이블 설계
# =============================================================================
# 상세 기획: ocs_제작기획.md 참조
# =============================================================================


class OCS(models.Model):
    """
    OCS (Order Communication System) 모델

    의사 → 작업자 간 오더 요청 및 결과 관리를 위한 단일 통합 테이블.
    RIS, LIS, TREATMENT, CONSULT 등 다양한 job_role을 JSON 필드로 유연하게 처리.
    """

    # =========================================================================
    # 상태 (ocs_status)
    # =========================================================================
    class OcsStatus(models.TextChoices):
        ORDERED = 'ORDERED', '오더 생성'
        ACCEPTED = 'ACCEPTED', '접수 완료'
        IN_PROGRESS = 'IN_PROGRESS', '진행 중'
        RESULT_READY = 'RESULT_READY', '결과 대기'
        CONFIRMED = 'CONFIRMED', '확정 완료'
        CANCELLED = 'CANCELLED', '취소됨'

    # =========================================================================
    # 우선순위 (priority)
    # =========================================================================
    class Priority(models.TextChoices):
        URGENT = 'urgent', '긴급'
        NORMAL = 'normal', '일반'

    # =========================================================================
    # 식별자
    # =========================================================================
    ocs_id = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='OCS ID',
        help_text='사용자 친화적 ID (예: ocs_0001)'
    )

    # =========================================================================
    # 상태
    # =========================================================================
    ocs_status = models.CharField(
        max_length=20,
        choices=OcsStatus.choices,
        default=OcsStatus.ORDERED,
        verbose_name='상태'
    )

    # =========================================================================
    # 관계 (Foreign Keys)
    # =========================================================================
    patient = models.ForeignKey(
        Patient,
        on_delete=models.PROTECT,
        related_name='ocs_orders',
        verbose_name='환자'
    )

    doctor = models.ForeignKey(
        User,
        on_delete=models.PROTECT,
        related_name='ocs_orders_as_doctor',
        verbose_name='처방 의사'
    )

    worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ocs_orders_as_worker',
        verbose_name='작업자',
        help_text='작업 수락 시 배정됨, 취소 시 null'
    )

    encounter = models.ForeignKey(
        Encounter,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ocs_orders',
        verbose_name='연관 진료'
    )

    # =========================================================================
    # 작업 구분
    # =========================================================================
    # job_role: RIS, LIS, TREATMENT, CONSULT
    job_role = models.CharField(
        max_length=20,
        verbose_name='작업 역할',
        help_text='RIS, LIS, TREATMENT, CONSULT 등'
    )

    # job_type (뇌종양 CDSS 전용):
    # - RIS: MRI, CT, PET (영상검사)
    # - LIS: CBC, CMP, Coagulation, Tumor Markers, GENE_PANEL, RNA_SEQ, DNA_SEQ, BIOMARKER
    # - TREATMENT: SURGERY, RADIATION, CHEMOTHERAPY
    job_type = models.CharField(
        max_length=50,
        verbose_name='작업 유형',
        help_text='RIS: MRI/CT/PET, LIS: CBC/CMP/Coagulation/Tumor Markers/GENE_PANEL/RNA_SEQ/DNA_SEQ/BIOMARKER, TREATMENT: SURGERY/RADIATION/CHEMOTHERAPY'
    )

    # =========================================================================
    # JSON 데이터 필드
    # =========================================================================
    doctor_request = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='의사 요청',
        help_text='의사가 작성한 요청 내용 (JSON)'
    )

    worker_result = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='작업 결과',
        help_text='작업자가 작성한 결과 (JSON, job_role별 템플릿)'
    )

    attachments = models.JSONField(
        default=dict,
        blank=True,
        verbose_name='첨부파일',
        help_text='첨부파일 정보 (JSON)'
    )

    # =========================================================================
    # 결과
    # =========================================================================
    ocs_result = models.BooleanField(
        null=True,
        blank=True,
        verbose_name='OCS 결과',
        help_text='True: 정상/완료, False: 비정상/미완료, None: 미확정'
    )

    # =========================================================================
    # 타임스탬프 (상태별)
    # =========================================================================
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성일시'
    )

    accepted_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='접수일시'
    )

    in_progress_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='진행시작일시'
    )

    result_ready_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='결과대기일시'
    )

    confirmed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='확정일시'
    )

    cancelled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='취소일시'
    )

    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='최종수정일시'
    )

    # =========================================================================
    # 우선순위
    # =========================================================================
    priority = models.CharField(
        max_length=20,
        choices=Priority.choices,
        default=Priority.NORMAL,
        verbose_name='우선순위'
    )

    # =========================================================================
    # 취소 정보
    # =========================================================================
    cancel_reason = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name='취소 사유'
    )

    # =========================================================================
    # Soft Delete
    # =========================================================================
    is_deleted = models.BooleanField(
        default=False,
        verbose_name='삭제 여부'
    )

    class Meta:
        db_table = 'ocs'
        verbose_name = 'OCS'
        verbose_name_plural = 'OCS 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ocs_id']),
            models.Index(fields=['ocs_status']),
            models.Index(fields=['job_role']),
            models.Index(fields=['patient']),
            models.Index(fields=['doctor']),
            models.Index(fields=['worker']),
            models.Index(fields=['priority']),
            models.Index(fields=['created_at']),
            # 복합 인덱스 - job_role 필터 + created_at 정렬 최적화
            models.Index(fields=['job_role', '-created_at'], name='ocs_jobrole_created_idx'),
            models.Index(fields=['is_deleted', 'job_role', '-created_at'], name='ocs_deleted_jobrole_idx'),
        ]

    def __str__(self):
        return f"{self.ocs_id} ({self.get_ocs_status_display()})"

    # =========================================================================
    # Properties
    # =========================================================================
    @property
    def turnaround_time(self):
        """오더 생성 → 확정까지 소요 시간 (분)"""
        if self.confirmed_at and self.created_at:
            return (self.confirmed_at - self.created_at).total_seconds() / 60
        return None

    @property
    def work_time(self):
        """작업 시작 → 결과 완료까지 소요 시간 (분)"""
        if self.result_ready_at and self.in_progress_at:
            return (self.result_ready_at - self.in_progress_at).total_seconds() / 60
        return None

    @property
    def is_editable(self):
        """수정 가능 여부 (CONFIRMED, CANCELLED 상태에서는 수정 불가)"""
        return self.ocs_status not in [self.OcsStatus.CONFIRMED, self.OcsStatus.CANCELLED]

    # =========================================================================
    # Methods
    # =========================================================================
    def save(self, *args, **kwargs):
        """저장 시 ocs_id 자동 생성"""
        if not self.ocs_id:
            self.ocs_id = self._generate_ocs_id()
        super().save(*args, **kwargs)

    def _generate_ocs_id(self):
        """ocs_id 자동 생성 (ocs_0001 형식)"""
        # ocs_ prefix를 가진 OCS 중 마지막 번호 조회
        last_ocs = OCS.objects.filter(
            ocs_id__startswith='ocs_'
        ).order_by('-ocs_id').first()

        if last_ocs and last_ocs.ocs_id:
            try:
                last_num = int(last_ocs.ocs_id.split('_')[1])
                return f"ocs_{last_num + 1:04d}"
            except (ValueError, IndexError):
                pass
        return "ocs_0001"

    def get_default_doctor_request(self):
        """doctor_request 기본 템플릿"""
        return {
            "_template": "default",
            "_version": "1.0",
            "chief_complaint": "",
            "clinical_info": "",
            "request_detail": "",
            "special_instruction": "",
            "_custom": {}
        }

    def get_default_worker_result(self):
        """job_role별 worker_result 기본 템플릿"""
        templates = {
            "RIS": {
                "_template": "RIS",
                "_version": "1.1",
                "_confirmed": False,
                "dicom": {
                    "study_uid": "",
                    "series": [],  # [{series_id, series_uid, series_type, series_description, instance_count}, ...]
                    # series_type: T1, T2, T1C, FLAIR, OTHER (SeriesDescription에서 파싱)
                    "accession_number": "",
                    "series_count": 0,
                    "instance_count": 0
                },
                "impression": "",
                "findings": "",
                "recommendation": "",
                "tumor": {
                    "detected": False,
                    "location": {
                        "lobe": "",
                        "hemisphere": ""
                    },
                    "size": {
                        "max_diameter_cm": None,
                        "volume_cc": None
                    }
                },
                "work_notes": [],  # [{timestamp, author, content}, ...]
                "_custom": {}
            },
            "LIS": {
                "_template": "LIS",
                "_version": "1.0",
                "_confirmed": False,
                "test_results": [],
                "summary": "",
                "interpretation": "",
                "_custom": {}
            },
            "TREATMENT": {
                "_template": "TREATMENT",
                "_version": "1.0",
                "_confirmed": False,
                "procedure": "",
                "duration_minutes": None,
                "anesthesia": "",
                "outcome": "",
                "complications": None,
                "_custom": {}
            }
        }
        return templates.get(self.job_role, {
            "_template": "default",
            "_version": "1.0",
            "_confirmed": False,
            "_custom": {}
        })

    def get_default_attachments(self):
        """attachments 기본 템플릿"""
        return {
            "files": [],
            "zip_url": None,
            "total_size": 0,
            "last_modified": None,
            # 외부 기관 데이터 (LIS 업로드 시 사용)
            "external_source": {
                "institution": {
                    "name": None,           # 기관명
                    "code": None,           # 기관코드
                    "contact": None,        # 연락처
                    "address": None,        # 주소
                },
                "execution": {
                    "performed_date": None,         # 검사 수행일
                    "performed_by": None,           # 검사자명
                    "specimen_collected_date": None,# 검체 채취일
                    "specimen_type": None,          # 검체 종류
                },
                "quality": {
                    "lab_certification_number": None,  # 검사실 인증번호
                    "qc_status": None,                 # QC 상태
                    "is_verified": False,              # 검증 여부
                },
            },
            "_custom": {}
        }


class OCSHistory(models.Model):
    """
    OCS 변경 이력 (Audit Log)

    작업자 변경, 취소, 상태 변경 등 모든 이력을 추적하는 감사 테이블.
    """

    # =========================================================================
    # Action 종류
    # =========================================================================
    class Action(models.TextChoices):
        CREATED = 'CREATED', 'OCS 생성'
        ACCEPTED = 'ACCEPTED', '오더 접수'
        CANCELLED = 'CANCELLED', '작업 취소'
        STARTED = 'STARTED', '작업 시작'
        RESULT_SAVED = 'RESULT_SAVED', '결과 임시저장'
        SUBMITTED = 'SUBMITTED', '결과 제출'
        CONFIRMED = 'CONFIRMED', '의사 확정'
        WORKER_CHANGED = 'WORKER_CHANGED', '작업자 변경'

    # =========================================================================
    # 관계
    # =========================================================================
    ocs = models.ForeignKey(
        OCS,
        on_delete=models.CASCADE,
        related_name='history',
        verbose_name='OCS'
    )

    actor = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='ocs_history_actions',
        verbose_name='변경자'
    )

    # =========================================================================
    # 액션 정보
    # =========================================================================
    action = models.CharField(
        max_length=20,
        choices=Action.choices,
        verbose_name='액션'
    )

    # =========================================================================
    # 상태 변경 정보
    # =========================================================================
    from_status = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name='이전 상태'
    )

    to_status = models.CharField(
        max_length=20,
        null=True,
        blank=True,
        verbose_name='변경된 상태'
    )

    # =========================================================================
    # 작업자 변경 정보
    # =========================================================================
    from_worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ocs_history_from_worker',
        verbose_name='이전 작업자'
    )

    to_worker = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='ocs_history_to_worker',
        verbose_name='변경된 작업자'
    )

    # =========================================================================
    # 사유
    # =========================================================================
    reason = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        verbose_name='사유',
        help_text='취소/변경 사유'
    )

    # =========================================================================
    # 타임스탬프
    # =========================================================================
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='변경 시점'
    )

    # =========================================================================
    # 스냅샷 (선택)
    # =========================================================================
    snapshot_json = models.JSONField(
        null=True,
        blank=True,
        verbose_name='변경 시점 데이터',
        help_text='변경 시점의 OCS 데이터 스냅샷'
    )

    # =========================================================================
    # 보안 정보 (선택)
    # =========================================================================
    ip_address = models.GenericIPAddressField(
        null=True,
        blank=True,
        verbose_name='접속 IP'
    )

    class Meta:
        db_table = 'ocs_history'
        verbose_name = 'OCS 이력'
        verbose_name_plural = 'OCS 이력 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ocs']),
            models.Index(fields=['action']),
            models.Index(fields=['actor']),
            models.Index(fields=['created_at']),
        ]

    def __str__(self):
        return f"{self.ocs.ocs_id} - {self.get_action_display()} ({self.created_at.strftime('%Y-%m-%d %H:%M')})"
