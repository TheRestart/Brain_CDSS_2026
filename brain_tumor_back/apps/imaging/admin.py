from django.contrib import admin
from .models import ImagingStudy


@admin.register(ImagingStudy)
class ImagingStudyAdmin(admin.ModelAdmin):
    """
    영상 검사 Admin (OCS 통합 버전)

    ImagingStudy는 DICOM 메타데이터만 관리.
    오더/판독 정보는 OCS Admin에서 확인.
    """
    list_display = ['id', 'get_patient_name', 'modality', 'study_uid', 'get_ocs_status', 'created_at']
    list_filter = ['modality', 'is_deleted', 'created_at']
    search_fields = ['ocs__patient__name', 'ocs__patient__patient_number', 'study_uid']
    readonly_fields = ['created_at', 'updated_at']
    raw_id_fields = ['ocs']

    def get_patient_name(self, obj):
        return obj.ocs.patient.name if obj.ocs else '-'
    get_patient_name.short_description = '환자명'

    def get_ocs_status(self, obj):
        return obj.ocs.get_ocs_status_display() if obj.ocs else '-'
    get_ocs_status.short_description = 'OCS 상태'


# =============================================================================
# ImagingReport Admin 삭제됨
# 판독 정보는 OCS.worker_result JSON에서 관리됩니다.
# OCS Admin에서 확인 가능합니다.
# =============================================================================
