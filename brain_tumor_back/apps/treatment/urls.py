from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import TreatmentPlanViewSet, TreatmentSessionViewSet

router = DefaultRouter()
router.register(r'plans', TreatmentPlanViewSet, basename='treatment-plans')
router.register(r'sessions', TreatmentSessionViewSet, basename='treatment-sessions')

urlpatterns = [
    path('', include(router.urls)),
]
