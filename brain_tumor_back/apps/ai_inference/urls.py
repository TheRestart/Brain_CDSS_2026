from django.urls import path
from .views import (
    M1InferenceView,
    MGInferenceView,
    MMInferenceView,
    MMAvailableOCSView,
    InferenceCallbackView,
    AIInferenceListView,
    AIInferenceDetailView,
    AIInferenceCancelView,
    AIInferenceDeleteByOCSView,
    AIInferenceFileDownloadView,
    AIInferenceFilesListView,
    AIInferenceSegmentationView,
    AIInferenceSegmentationCompareView,
    AIInferenceReviewView,
    AIInferenceM1ThumbnailView,
    MGGeneExpressionView,
    AIModelsListView,
    AIModelDetailView,
    PatientAIInferenceListView,
)

app_name = 'ai_inference'

urlpatterns = [
    # AI Models
    path('models/', AIModelsListView.as_view(), name='models-list'),
    path('models/<str:code>/', AIModelDetailView.as_view(), name='models-detail'),

    # M1 inference
    path('m1/inference/', M1InferenceView.as_view(), name='m1-inference'),

    # MG inference
    path('mg/inference/', MGInferenceView.as_view(), name='mg-inference'),
    path('mg/gene-expression/<int:ocs_id>/', MGGeneExpressionView.as_view(), name='mg-gene-expression'),

    # MM inference (Multimodal)
    path('mm/inference/', MMInferenceView.as_view(), name='mm-inference'),
    path('mm/available-ocs/<str:patient_id>/', MMAvailableOCSView.as_view(), name='mm-available-ocs'),

    # Callback (shared)
    path('callback/', InferenceCallbackView.as_view(), name='callback'),

    # Inference list/detail
    path('inferences/', AIInferenceListView.as_view(), name='inference-list'),
    path('inferences/by-ocs/<int:ocs_id>/', AIInferenceDeleteByOCSView.as_view(), name='inference-delete-by-ocs'),
    path('inferences/<str:job_id>/', AIInferenceDetailView.as_view(), name='inference-detail'),
    path('inferences/<str:job_id>/cancel/', AIInferenceCancelView.as_view(), name='inference-cancel'),
    path('inferences/<str:job_id>/review/', AIInferenceReviewView.as_view(), name='inference-review'),

    # Files
    path('inferences/<str:job_id>/files/', AIInferenceFilesListView.as_view(), name='inference-files'),
    path('inferences/<str:job_id>/files/<str:filename>/', AIInferenceFileDownloadView.as_view(), name='inference-file-download'),

    # Segmentation data
    path('inferences/<str:job_id>/segmentation/', AIInferenceSegmentationView.as_view(), name='inference-segmentation'),
    path('inferences/<str:job_id>/segmentation/compare/', AIInferenceSegmentationCompareView.as_view(), name='inference-segmentation-compare'),

    # Thumbnail (M1)
    path('inferences/<str:job_id>/thumbnail/', AIInferenceM1ThumbnailView.as_view(), name='inference-thumbnail'),

    # Patient AI inference list (진료화면용)
    path('patients/<int:patient_id>/requests/', PatientAIInferenceListView.as_view(), name='patient-inference-list'),
]