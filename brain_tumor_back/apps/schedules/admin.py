from django.contrib import admin
from .models import DoctorSchedule


@admin.register(DoctorSchedule)
class DoctorScheduleAdmin(admin.ModelAdmin):
    list_display = (
        'title', 'doctor', 'schedule_type',
        'start_datetime', 'end_datetime', 'all_day',
        'created_at'
    )
    list_filter = ('schedule_type', 'all_day', 'created_at', 'doctor')
    search_fields = ('title', 'description', 'doctor__name', 'doctor__login_id')
    readonly_fields = ('created_at', 'updated_at')
    date_hierarchy = 'start_datetime'

    fieldsets = (
        ('기본 정보', {
            'fields': ('doctor', 'title', 'schedule_type', 'description')
        }),
        ('일시', {
            'fields': ('start_datetime', 'end_datetime', 'all_day')
        }),
        ('표시 설정', {
            'fields': ('color',),
            'classes': ('collapse',)
        }),
        ('메타 정보', {
            'fields': ('created_at', 'updated_at', 'is_deleted'),
            'classes': ('collapse',)
        }),
    )
