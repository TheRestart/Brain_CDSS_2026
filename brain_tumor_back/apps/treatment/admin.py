from django.contrib import admin
from .models import TreatmentPlan, TreatmentSession


class TreatmentSessionInline(admin.TabularInline):
    """치료 세션 인라인"""
    model = TreatmentSession
    extra = 0
    readonly_fields = ['created_at', 'updated_at']
    fields = [
        'session_number', 'session_date', 'status',
        'performed_by', 'session_note'
    ]


@admin.register(TreatmentPlan)
class TreatmentPlanAdmin(admin.ModelAdmin):
    """치료 계획 Admin"""
    list_display = [
        'id', 'patient', 'treatment_type', 'treatment_goal',
        'status', 'planned_by', 'start_date', 'end_date'
    ]
    list_filter = ['treatment_type', 'treatment_goal', 'status']
    search_fields = ['patient__name', 'patient__patient_number', 'plan_summary']
    date_hierarchy = 'created_at'
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['patient', 'encounter', 'ocs', 'planned_by']
    inlines = [TreatmentSessionInline]

    fieldsets = (
        ('환자 정보', {
            'fields': ('patient', 'encounter', 'ocs')
        }),
        ('치료 정보', {
            'fields': ('treatment_type', 'treatment_goal', 'plan_summary', 'planned_by')
        }),
        ('상태 및 일정', {
            'fields': ('status', 'start_date', 'end_date', 'actual_start_date', 'actual_end_date')
        }),
        ('추가 정보', {
            'fields': ('notes',),
            'classes': ('collapse',)
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )


@admin.register(TreatmentSession)
class TreatmentSessionAdmin(admin.ModelAdmin):
    """치료 세션 Admin"""
    list_display = [
        'id', 'treatment_plan', 'session_number', 'session_date',
        'status', 'performed_by'
    ]
    list_filter = ['status']
    search_fields = [
        'treatment_plan__patient__name',
        'treatment_plan__patient__patient_number'
    ]
    date_hierarchy = 'session_date'
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['treatment_plan', 'performed_by']

    fieldsets = (
        ('세션 정보', {
            'fields': ('treatment_plan', 'session_number', 'session_date', 'performed_by', 'status')
        }),
        ('치료 기록', {
            'fields': ('session_note', 'adverse_events', 'medications')
        }),
        ('바이탈', {
            'fields': ('vitals_before', 'vitals_after'),
            'classes': ('collapse',)
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
