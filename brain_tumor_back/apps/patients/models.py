from django.db import models
from django.core.validators import RegexValidator
from apps.accounts.models import User


class Patient(models.Model):
    """환자 모델"""

    GENDER_CHOICES = [
        ('M', '남성'),
        ('F', '여성'),
        ('O', '기타'),
    ]

    BLOOD_TYPE_CHOICES = [
        ('A+', 'A+'),
        ('A-', 'A-'),
        ('B+', 'B+'),
        ('B-', 'B-'),
        ('O+', 'O+'),
        ('O-', 'O-'),
        ('AB+', 'AB+'),
        ('AB-', 'AB-'),
    ]

    STATUS_CHOICES = [
        ('active', '진료중'),
        ('discharged', '퇴원'),
        ('transferred', '전원'),
        ('deceased', '사망'),
    ]

    SEVERITY_CHOICES = [
        ('normal', '정상'),
        ('mild', '경증'),
        ('moderate', '중등도'),
        ('severe', '중증'),
        ('critical', '위중'),
    ]

    # 환자 번호 자동 생성을 위한 검증
    phone_validator = RegexValidator(
        regex=r'^\d{2,3}-\d{3,4}-\d{4}$',
        message="전화번호 형식: 010-1234-5678"
    )

    # 기본 정보
    patient_number = models.CharField(
        max_length=20,
        unique=True,
        verbose_name='환자번호',
        help_text='자동 생성됨 (예: P2026010001)'
    )
    name = models.CharField(max_length=100, verbose_name='이름')
    birth_date = models.DateField(verbose_name='생년월일')
    gender = models.CharField(max_length=1, choices=GENDER_CHOICES, verbose_name='성별')

    # 연락처 정보
    phone = models.CharField(
        max_length=20,
        validators=[phone_validator],
        verbose_name='전화번호'
    )
    email = models.EmailField(blank=True, null=True, verbose_name='이메일')
    address = models.TextField(blank=True, verbose_name='주소')

    # 의료 정보
    ssn = models.CharField(
        max_length=255,
        unique=True,
        verbose_name='주민등록번호',
        help_text='암호화되어 저장됨'
    )
    blood_type = models.CharField(
        max_length=3,
        choices=BLOOD_TYPE_CHOICES,
        blank=True,
        null=True,
        verbose_name='혈액형'
    )
    allergies = models.JSONField(
        default=list,
        blank=True,
        verbose_name='알레르기',
        help_text='["페니실린", "조영제"] 형식'
    )
    chronic_diseases = models.JSONField(
        default=list,
        blank=True,
        verbose_name='기저질환',
        help_text='["고혈압", "당뇨"] 형식'
    )
    chief_complaint = models.TextField(
        blank=True,
        null=True,
        verbose_name='주 호소'
    )

    # 상태
    status = models.CharField(
        max_length=15,
        choices=STATUS_CHOICES,
        default='active',
        verbose_name='환자상태'
    )
    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
        default='normal',
        verbose_name='중증도'
    )

    # 등록 정보
    registered_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='registered_patients',
        verbose_name='등록자'
    )

    # 외부환자 정보
    is_external = models.BooleanField(
        default=False,
        verbose_name='외부환자 여부'
    )
    external_institution = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='external_patients',
        verbose_name='외부기관',
        help_text='EXTERNAL 역할 사용자 (기관)'
    )

    # 환자 계정 연결 (선택적 - 환자 포털 로그인용)
    user = models.OneToOneField(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='patient_profile',
        verbose_name='환자 계정'
    )

    # 메타 정보
    created_at = models.DateTimeField(auto_now_add=True, verbose_name='생성일시')
    updated_at = models.DateTimeField(auto_now=True, verbose_name='수정일시')
    is_deleted = models.BooleanField(default=False, verbose_name='삭제여부')

    class Meta:
        db_table = 'patients'
        verbose_name = '환자'
        verbose_name_plural = '환자 목록'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['patient_number']),
            models.Index(fields=['name']),
            models.Index(fields=['phone']),
            models.Index(fields=['status']),
            models.Index(fields=['severity']),
            models.Index(fields=['-created_at']),
        ]

    def __str__(self):
        return f"{self.patient_number} - {self.name}"

    def save(self, *args, **kwargs):
        """환자번호 자동 생성"""
        if not self.patient_number:
            from django.utils import timezone

            if self.is_external and self.external_institution:
                # 외부환자: {기관코드}-{YYYYMMDD}-{순번}
                today = timezone.now().strftime('%Y%m%d')
                inst_code = self.external_institution.login_id  # 기관코드

                last_patient = Patient.objects.filter(
                    patient_number__startswith=f'{inst_code}-{today}'
                ).order_by('-patient_number').first()

                seq = 1
                if last_patient:
                    try:
                        seq = int(last_patient.patient_number.split('-')[-1]) + 1
                    except (ValueError, IndexError):
                        seq = 1

                self.patient_number = f'{inst_code}-{today}-{seq:03d}'
            else:
                # 내부환자: P{YYYY}{00001}
                year = timezone.now().year

                # 해당 연도의 마지막 환자 번호 조회
                last_patient = Patient.objects.filter(
                    patient_number__startswith=f'P{year}'
                ).order_by('-patient_number').first()

                if last_patient:
                    # 기존 번호에서 시퀀스 추출 및 증가
                    last_number = int(last_patient.patient_number[5:])
                    new_number = last_number + 1
                else:
                    # 첫 환자
                    new_number = 1

                self.patient_number = f'P{year}{new_number:05d}'

        super().save(*args, **kwargs)

    @property
    def age(self):
        """현재 나이 계산"""
        if not self.birth_date:
            return None
        from django.utils import timezone
        today = timezone.now().date()
        age = today.year - self.birth_date.year

        # 생일이 지나지 않았으면 -1
        if today.month < self.birth_date.month or \
           (today.month == self.birth_date.month and today.day < self.birth_date.day):
            age -= 1

        return age

    @property
    def is_active(self):
        """활성 상태 확인"""
        return self.status == 'active' and not self.is_deleted


class PatientAlert(models.Model):
    """환자 주의사항 모델"""

    ALERT_TYPE_CHOICES = [
        ('ALLERGY', '알레르기'),
        ('CONTRAINDICATION', '금기사항'),
        ('PRECAUTION', '주의사항'),
        ('OTHER', '기타'),
    ]

    SEVERITY_CHOICES = [
        ('HIGH', '높음'),
        ('MEDIUM', '중간'),
        ('LOW', '낮음'),
    ]

    patient = models.ForeignKey(
        Patient,
        on_delete=models.CASCADE,
        related_name='alerts',
        verbose_name='환자'
    )
    alert_type = models.CharField(
        max_length=20,
        choices=ALERT_TYPE_CHOICES,
        verbose_name='주의사항 유형'
    )
    severity = models.CharField(
        max_length=10,
        choices=SEVERITY_CHOICES,
        default='MEDIUM',
        verbose_name='심각도'
    )
    title = models.CharField(
        max_length=200,
        verbose_name='제목'
    )
    description = models.TextField(
        blank=True,
        verbose_name='상세 설명'
    )
    is_active = models.BooleanField(
        default=True,
        verbose_name='활성 여부'
    )
    created_by = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        related_name='created_alerts',
        verbose_name='등록자'
    )
    created_at = models.DateTimeField(
        auto_now_add=True,
        verbose_name='생성일시'
    )
    updated_at = models.DateTimeField(
        auto_now=True,
        verbose_name='수정일시'
    )

    class Meta:
        db_table = 'patient_alerts'
        verbose_name = '환자 주의사항'
        verbose_name_plural = '환자 주의사항 목록'
        ordering = ['-severity', '-created_at']
        indexes = [
            models.Index(fields=['patient', 'alert_type']),
            models.Index(fields=['patient', 'is_active']),
        ]

    def __str__(self):
        return f"{self.patient.name} - {self.get_alert_type_display()}: {self.title}"
