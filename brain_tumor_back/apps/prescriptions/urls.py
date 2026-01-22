from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import PrescriptionViewSet, MedicationViewSet

router = DefaultRouter()
router.register(r'medications', MedicationViewSet, basename='medications')
router.register(r'', PrescriptionViewSet, basename='prescriptions')

urlpatterns = [
    path('', include(router.urls)),
]
