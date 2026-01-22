from django.contrib import admin
from apps.audit.models import AuditLog   # ← audit 앱의 AuditLog를 가져오기

# Admin 사용자가 로그 확인
@admin.register(AuditLog)
class AuditLogAdmin(admin.ModelAdmin):
    list_display = ("action", "user", "ip_address", "created_at")
    list_filter = ("action",)
    readonly_fields = ("created_at",)