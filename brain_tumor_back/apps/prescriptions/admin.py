from django.contrib import admin
from .models import Prescription, PrescriptionItem, Medication


@admin.register(Medication)
class MedicationAdmin(admin.ModelAdmin):
    """의약품 마스터 Admin"""
    list_display = [
        'code', 'name', 'generic_name', 'category',
        'default_dosage', 'default_route', 'default_frequency',
        'unit', 'is_active'
    ]
    list_filter = ['category', 'default_route', 'is_active']
    search_fields = ['code', 'name', 'generic_name']
    list_editable = ['is_active']
    ordering = ['category', 'name']

    fieldsets = (
        ('기본 정보', {
            'fields': ('code', 'name', 'generic_name', 'category')
        }),
        ('기본 처방 정보', {
            'fields': ('default_dosage', 'default_route', 'default_frequency', 'default_duration_days', 'unit')
        }),
        ('주의사항', {
            'fields': ('warnings', 'contraindications'),
            'classes': ('collapse',)
        }),
        ('상태', {
            'fields': ('is_active',)
        }),
    )


class PrescriptionItemInline(admin.TabularInline):
    model = PrescriptionItem
    extra = 1
    autocomplete_fields = ['medication']


@admin.register(Prescription)
class PrescriptionAdmin(admin.ModelAdmin):
    list_display = ['prescription_id', 'patient', 'doctor', 'status', 'item_count', 'created_at', 'issued_at']
    list_filter = ['status', 'doctor']
    search_fields = ['prescription_id', 'patient__name', 'doctor__name']
    inlines = [PrescriptionItemInline]
    readonly_fields = ['prescription_id', 'created_at', 'updated_at']

    def item_count(self, obj):
        return obj.items.count()
    item_count.short_description = '항목 수'


@admin.register(PrescriptionItem)
class PrescriptionItemAdmin(admin.ModelAdmin):
    list_display = ['prescription', 'medication', 'medication_name', 'dosage', 'frequency', 'route', 'duration_days']
    list_filter = ['frequency', 'route']
    search_fields = ['medication_name', 'prescription__prescription_id', 'medication__name']
    autocomplete_fields = ['medication']
