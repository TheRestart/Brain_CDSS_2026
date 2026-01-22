from django.contrib import admin
from .models import FollowUp


@admin.register(FollowUp)
class FollowUpAdmin(admin.ModelAdmin):
    """경과 추적 Admin"""
    list_display = [
        'id', 'patient', 'followup_date', 'followup_type',
        'clinical_status', 'kps_score', 'recorded_by'
    ]
    list_filter = ['followup_type', 'clinical_status']
    search_fields = ['patient__name', 'patient__patient_number', 'note']
    date_hierarchy = 'followup_date'
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['patient', 'treatment_plan', 'related_ocs', 'recorded_by']

    fieldsets = (
        ('환자 정보', {
            'fields': ('patient', 'treatment_plan', 'related_ocs')
        }),
        ('추적 정보', {
            'fields': ('followup_date', 'followup_type', 'clinical_status')
        }),
        ('임상 데이터', {
            'fields': ('symptoms', 'kps_score', 'ecog_score', 'weight_kg', 'vitals')
        }),
        ('기록', {
            'fields': ('note', 'next_followup_date', 'recorded_by')
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
