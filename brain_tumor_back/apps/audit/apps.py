from django.apps import AppConfig

# 로그인 성공/실패 기록
class AuditConfig(AppConfig):
    default_auto_field = "django.db.models.BigAutoField"
    name = "apps.audit"
