from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import ImagingStudyViewSet, ImagingReportViewSet

router = DefaultRouter()
router.register(r'studies', ImagingStudyViewSet, basename='imaging-study')
router.register(r'reports', ImagingReportViewSet, basename='imaging-report')

urlpatterns = [
    path('', include(router.urls)),
]
