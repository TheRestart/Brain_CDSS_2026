from django.db import models


class ImagingStudy(models.Model):
    """
    영상 검사 DICOM 메타데이터

    오더 관리는 OCS(apps.ocs.models.OCS)에서 담당.
    이 모델은 DICOM 영상 데이터 연동을 위한 메타데이터만 관리.
    """

    # 뇌종양 CDSS에 필요한 영상 검사만
    MODALITY_CHOICES = [
        ('MRI', 'MRI (Magnetic Resonance Imaging)'),
        ('CT', 'CT (Computed Tomography)'),
        ('PET', 'PET (Positron Emission Tomography)'),
    ]

    # ==========================================================================
    # OCS 연동 (오더 정보는 OCS에서 관리)
    # ==========================================================================
    ocs = models.OneToOneField(
        'ocs.OCS',
        on_delete=models.CASCADE,
        related_name='imaging_study',
        verbose_name='OCS 오더',
        help_text='연결된 OCS 오더 (job_role=RIS)'
    )

    # ==========================================================================
    # 검사 종류 (OCS.job_type과 동기화)
    # ==========================================================================
    modality = models.CharField(
        max_length=20,
        choices=MODALITY_CHOICES,
        verbose_name='검사 종류'
    )
    body_part = models.CharField(
        max_length=100,
        default='brain',
        verbose_name='촬영 부위'
    )

    # ==========================================================================
    # DICOM 메타데이터 (Orthanc 연동용)
    # ==========================================================================
    study_uid = models.CharField(
        max_length=200,
        null=True,
        blank=True,
        unique=True,
        verbose_name='Study Instance UID'
    )
    accession_number = models.CharField(
        max_length=50,
        null=True,
        blank=True,
        verbose_name='Accession Number'
    )
    series_count = models.IntegerField(
        default=0,
        verbose_name='시리즈 수'
    )
    instance_count = models.IntegerField(
        default=0,
        verbose_name='이미지 수'
    )

    # ==========================================================================
    # 검사 일정 (RIS 작업자가 관리)
    # ==========================================================================
    scheduled_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='예약 일시'
    )
    performed_at = models.DateTimeField(
        null=True,
        blank=True,
        verbose_name='검사 수행 일시'
    )

    # ==========================================================================
    # Soft Delete & 타임스탬프
    # ==========================================================================
    is_deleted = models.BooleanField(
        default=False,
        verbose_name='삭제 여부'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성 일시'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='수정 일시'
    )

    class Meta:
        db_table = 'imaging_studies'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['ocs']),
            models.Index(fields=['study_uid']),
            models.Index(fields=['modality']),
        ]
        verbose_name = '영상 검사 (DICOM)'
        verbose_name_plural = '영상 검사 목록 (DICOM)'

    def __str__(self):
        patient_name = self.ocs.patient.name if self.ocs else 'Unknown'
        return f"{self.get_modality_display()} - {patient_name}"

    # ==========================================================================
    # Properties (OCS에서 데이터 가져오기)
    # ==========================================================================
    @property
    def patient(self):
        """환자 정보 (OCS에서 가져옴)"""
        return self.ocs.patient if self.ocs else None

    @property
    def encounter(self):
        """진료 정보 (OCS에서 가져옴)"""
        return self.ocs.encounter if self.ocs else None

    @property
    def ordered_by(self):
        """오더 의사 (OCS.doctor)"""
        return self.ocs.doctor if self.ocs else None

    @property
    def ordered_at(self):
        """오더 일시 (OCS.created_at)"""
        return self.ocs.created_at if self.ocs else None

    @property
    def radiologist(self):
        """판독의 (OCS.worker)"""
        return self.ocs.worker if self.ocs else None

    @property
    def status(self):
        """검사 상태 (OCS.ocs_status 매핑)"""
        if not self.ocs:
            return 'ordered'
        status_map = {
            'ORDERED': 'ordered',
            'ACCEPTED': 'scheduled',
            'IN_PROGRESS': 'in_progress',
            'RESULT_READY': 'completed',
            'CONFIRMED': 'reported',
            'CANCELLED': 'cancelled',
        }
        return status_map.get(self.ocs.ocs_status, 'ordered')

    @property
    def is_completed(self):
        """검사 완료 여부"""
        return self.status in ['completed', 'reported']

    @property
    def has_report(self):
        """판독문 존재 여부 (OCS.worker_result._confirmed)"""
        if self.ocs and self.ocs.worker_result:
            return self.ocs.worker_result.get('_confirmed', False)
        return False

    @property
    def clinical_info(self):
        """임상 정보 (OCS.doctor_request에서 가져옴)"""
        if self.ocs and self.ocs.doctor_request:
            return self.ocs.doctor_request.get('clinical_info', '')
        return ''

    @property
    def special_instruction(self):
        """특별 지시사항 (OCS.doctor_request에서 가져옴)"""
        if self.ocs and self.ocs.doctor_request:
            return self.ocs.doctor_request.get('special_instruction', '')
        return ''

    @property
    def work_notes(self):
        """작업 노트 (OCS.worker_result에서 가져옴)"""
        if self.ocs and self.ocs.worker_result:
            return self.ocs.worker_result.get('work_notes', [])
        return []


# =============================================================================
# ImagingReport 모델은 OCS.worker_result JSON으로 통합되었습니다.
# 판독 정보는 OCS.worker_result에서 관리됩니다:
#   - findings: 판독 소견
#   - impression: 판독 결론
#   - tumor.detected: 종양 발견 여부
#   - tumor.location: 종양 위치 (lobe, hemisphere)
#   - tumor.size: 종양 크기 (max_diameter_cm, volume_cc)
#   - _confirmed: 제출 완료 여부
# =============================================================================
