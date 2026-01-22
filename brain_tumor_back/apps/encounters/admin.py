from django.contrib import admin
from .models import Encounter


@admin.register(Encounter)
class EncounterAdmin(admin.ModelAdmin):
    """진료 Admin"""
    list_display = [
        'id', 'patient', 'encounter_type', 'status',
        'attending_doctor', 'department', 'admission_date', 'is_deleted'
    ]
    list_filter = ['encounter_type', 'status', 'department', 'is_deleted']
    search_fields = ['patient__name', 'patient__patient_number', 'chief_complaint']
    date_hierarchy = 'admission_date'
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['patient', 'attending_doctor']

    fieldsets = (
        ('기본 정보', {
            'fields': ('patient', 'encounter_type', 'status', 'attending_doctor', 'department')
        }),
        ('일시', {
            'fields': ('admission_date', 'discharge_date')
        }),
        ('진료 내용', {
            'fields': ('chief_complaint', 'primary_diagnosis', 'secondary_diagnoses')
        }),
        ('메타 정보', {
            'fields': ('is_deleted', 'created_at', 'updated_at'),
            'classes': ('collapse',)
        }),
    )
