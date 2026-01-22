from django.urls import path
from . import views

urlpatterns = [
    # ===== 조회 API =====
    path("patients/", views.list_patients),
    path("studies/", views.list_studies),
    path("series/", views.list_series),
    path("instances/", views.list_instances),

    path("instances/<str:instance_id>/file/", views.get_instance_file),

    # ===== 썸네일 API =====
    path("series/<str:series_id>/thumbnail/", views.get_series_thumbnail),
    path("studies/<str:study_id>/thumbnails/", views.get_study_thumbnails),
    path("instances/<str:instance_id>/preview/", views.get_instance_preview),

    # ===== 삭제 API (REST 스타일 지원) =====
    path("patients/<str:patient_id>/", views.delete_patient),
    path("studies/<str:study_id>/", views.delete_study),
    path("series/<str:series_id>/", views.delete_series),
    path("instances/<str:instance_id>/", views.delete_instance),

    # ===== 기존 delete/ 스타일 계속 유지 (둘 다 허용) =====
    path("delete/patient/<str:patient_id>/", views.delete_patient),
    path("delete/study/<str:study_id>/", views.delete_study),
    path("delete/series/<str:series_id>/", views.delete_series),
    path("delete/instance/<str:instance_id>/", views.delete_instance),

    # ===== 업로드 =====
    path("upload-patient/", views.upload_patient),
]
