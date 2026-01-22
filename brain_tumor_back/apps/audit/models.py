from django.db import models
from apps.accounts.models import User


class AuditLog(models.Model):
    """인증 감사 로그 (로그인/로그아웃)"""
    ACTION_CHOICES = (
        ("LOGIN_SUCCESS", "Login Success"),  # 로그인 성공
        ("LOGIN_FAIL", "Login Fail"),  # 로그인 실패
        ("LOGIN_LOCKED", "Login Locked"),  # 로그인 잠금
        ("LOGOUT", "Logout"),  # 로그아웃
    )

    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
    )

    action = models.CharField(max_length=30, choices=ACTION_CHOICES)
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'audit_log'
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} - {self.user}"


class AccessLog(models.Model):
    """시스템 접근/행위 감사 로그"""

    ACTION_CHOICES = (
        ("VIEW", "조회"),
        ("CREATE", "생성"),
        ("UPDATE", "수정"),
        ("DELETE", "삭제"),
        ("EXPORT", "내보내기"),
        ("PRINT", "인쇄"),
    )

    RESULT_CHOICES = (
        ("SUCCESS", "성공"),
        ("FAIL", "실패"),
    )

    # 사용자 정보
    user = models.ForeignKey(
        User,
        on_delete=models.SET_NULL,
        null=True,
        blank=True,
        related_name='access_logs'
    )
    user_role = models.CharField(max_length=50, null=True, blank=True)  # 조회 시점 역할 스냅샷

    # 요청 정보
    request_method = models.CharField(max_length=10)  # GET, POST, PUT, DELETE
    request_path = models.CharField(max_length=500)  # /api/patients/123
    request_params = models.JSONField(null=True, blank=True)  # 쿼리/바디 파라미터

    # 메뉴/기능 정보
    menu_name = models.CharField(max_length=100, null=True, blank=True)  # 환자 목록, 판독 결과 등
    action = models.CharField(max_length=20, choices=ACTION_CHOICES)

    # 클라이언트 정보
    ip_address = models.GenericIPAddressField(null=True, blank=True)
    user_agent = models.TextField(null=True, blank=True)

    # 결과 정보
    result = models.CharField(max_length=10, choices=RESULT_CHOICES, default='SUCCESS')
    fail_reason = models.TextField(null=True, blank=True)
    response_status = models.IntegerField(null=True, blank=True)  # HTTP 상태 코드

    # 시간
    created_at = models.DateTimeField(auto_now_add=True)
    duration_ms = models.IntegerField(null=True, blank=True)  # 처리 시간(ms)

    class Meta:
        db_table = 'access_log'
        indexes = [
            models.Index(fields=['-created_at']),
            models.Index(fields=['user', '-created_at']),
            models.Index(fields=['action']),
            models.Index(fields=['result']),
            models.Index(fields=['ip_address']),
        ]
        ordering = ['-created_at']

    def __str__(self):
        return f"{self.action} - {self.user} - {self.request_path}"
