from django.contrib import admin
from .models import OCS, OCSHistory


# =============================================================================
# OCS Admin - 단일 테이블 설계
# =============================================================================
# 상세 기획: ocs_제작기획.md 참조
# =============================================================================


class OCSHistoryInline(admin.TabularInline):
    """OCS 이력 인라인"""
    model = OCSHistory
    extra = 0
    readonly_fields = [
        'action', 'actor', 'from_status', 'to_status',
        'from_worker', 'to_worker', 'reason', 'created_at', 'ip_address'
    ]
    can_delete = False
    ordering = ['-created_at']

    def has_add_permission(self, request, obj=None):
        return False


@admin.register(OCS)
class OCSAdmin(admin.ModelAdmin):
    """OCS Admin"""
    list_display = [
        'ocs_id', 'ocs_status', 'patient', 'doctor', 'worker',
        'job_role', 'job_type', 'priority', 'ocs_result',
        'created_at', 'is_deleted'
    ]
    list_filter = [
        'ocs_status', 'job_role', 'priority', 'ocs_result', 'is_deleted'
    ]
    search_fields = [
        'ocs_id', 'patient__name', 'doctor__username', 'worker__username',
        'job_type'
    ]
    readonly_fields = [
        'ocs_id', 'created_at', 'updated_at',
        'accepted_at', 'in_progress_at', 'result_ready_at',
        'confirmed_at', 'cancelled_at'
    ]
    ordering = ['-created_at']
    date_hierarchy = 'created_at'
    inlines = [OCSHistoryInline]

    fieldsets = (
        ('기본 정보', {
            'fields': ('ocs_id', 'ocs_status', 'priority')
        }),
        ('관계', {
            'fields': ('patient', 'doctor', 'worker', 'encounter')
        }),
        ('작업 구분', {
            'fields': ('job_role', 'job_type')
        }),
        ('데이터', {
            'fields': ('doctor_request', 'worker_result', 'attachments'),
            'classes': ('collapse',)
        }),
        ('결과', {
            'fields': ('ocs_result', 'cancel_reason')
        }),
        ('타임스탬프', {
            'fields': (
                'created_at', 'accepted_at', 'in_progress_at',
                'result_ready_at', 'confirmed_at', 'cancelled_at', 'updated_at'
            ),
            'classes': ('collapse',)
        }),
        ('삭제', {
            'fields': ('is_deleted',),
            'classes': ('collapse',)
        }),
    )

    def get_queryset(self, request):
        """삭제된 항목도 보이도록"""
        return super().get_queryset(request)


@admin.register(OCSHistory)
class OCSHistoryAdmin(admin.ModelAdmin):
    """OCS 이력 Admin"""
    list_display = [
        'ocs', 'action', 'actor', 'from_status', 'to_status',
        'from_worker', 'to_worker', 'created_at'
    ]
    list_filter = ['action', 'created_at']
    search_fields = ['ocs__ocs_id', 'actor__username', 'reason']
    readonly_fields = [
        'ocs', 'action', 'actor', 'from_status', 'to_status',
        'from_worker', 'to_worker', 'reason', 'created_at',
        'snapshot_json', 'ip_address'
    ]
    ordering = ['-created_at']
    date_hierarchy = 'created_at'

    def has_add_permission(self, request):
        return False

    def has_change_permission(self, request, obj=None):
        return False

    def has_delete_permission(self, request, obj=None):
        return False
