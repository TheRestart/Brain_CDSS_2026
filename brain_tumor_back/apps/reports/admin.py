from django.contrib import admin
from .models import FinalReport, ReportAttachment, ReportLog


@admin.register(FinalReport)
class FinalReportAdmin(admin.ModelAdmin):
    list_display = [
        'report_id',
        'patient',
        'report_type',
        'status',
        'primary_diagnosis',
        'created_by',
        'created_at',
    ]
    list_filter = ['status', 'report_type', 'is_deleted']
    search_fields = ['report_id', 'patient__name', 'primary_diagnosis']
    readonly_fields = ['report_id', 'created_at', 'updated_at']


@admin.register(ReportAttachment)
class ReportAttachmentAdmin(admin.ModelAdmin):
    list_display = ['report', 'file_type', 'file_name', 'uploaded_by', 'created_at']
    list_filter = ['file_type']
    search_fields = ['file_name', 'report__report_id']


@admin.register(ReportLog)
class ReportLogAdmin(admin.ModelAdmin):
    list_display = ['report', 'action', 'actor', 'created_at']
    list_filter = ['action']
    search_fields = ['report__report_id', 'message']
