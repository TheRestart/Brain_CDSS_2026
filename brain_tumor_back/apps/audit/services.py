from .models import AuditLog

# Audit Log 기록 유틸
def create_audit_log(request, action, user=None):
    AuditLog.objects.create(
        user = user,
        action = action,
        ip_address = request.META.get("REMOTE_ADDR"),
        user_agent = request.META.get("HTTP_USER_AGENT", ""),
    )