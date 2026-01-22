from django.contrib import admin
from .models import Patient


@admin.register(Patient)
class PatientAdmin(admin.ModelAdmin):
    """환자 관리 Admin"""

    list_display = [
        'patient_number',
        'name',
        'birth_date',
        'age',
        'gender',
        'phone',
        'status',
        'registered_by',
        'created_at',
    ]

    list_filter = [
        'status',
        'gender',
        'blood_type',
        'created_at',
    ]

    search_fields = [
        'patient_number',
        'name',
        'phone',
    ]

    readonly_fields = [
        'patient_number',
        'age',
        'registered_by',
        'created_at',
        'updated_at',
    ]

    fieldsets = (
        ('기본 정보', {
            'fields': ('patient_number', 'name', 'birth_date', 'age', 'gender')
        }),
        ('연락처 정보', {
            'fields': ('phone', 'email', 'address')
        }),
        ('의료 정보', {
            'fields': ('ssn', 'blood_type', 'allergies', 'chronic_diseases')
        }),
        ('상태', {
            'fields': ('status',)
        }),
        ('메타 정보', {
            'fields': ('registered_by', 'created_at', 'updated_at', 'is_deleted'),
            'classes': ('collapse',)
        }),
    )

    def save_model(self, request, obj, form, change):
        """등록자 자동 설정"""
        if not change:  # 신규 등록 시
            obj.registered_by = request.user
        super().save_model(request, obj, form, change)
