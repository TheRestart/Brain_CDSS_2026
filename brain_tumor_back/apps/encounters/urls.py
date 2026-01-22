from django.urls import path, include
from rest_framework.routers import DefaultRouter
from .views import EncounterViewSet

app_name = 'encounters'

router = DefaultRouter()
router.register(r'', EncounterViewSet, basename='encounter')

urlpatterns = [
    path('', include(router.urls)),
]
