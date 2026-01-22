from django.contrib import admin
from .models import AIInference


@admin.register(AIInference)
class AIInferenceAdmin(admin.ModelAdmin):
    list_display = ['job_id', 'model_type', 'patient', 'status', 'mode', 'created_at', 'completed_at']
    list_filter = ['model_type', 'status', 'mode', 'created_at']
    search_fields = ['job_id', 'patient__name', 'patient__patient_number']
    readonly_fields = ['job_id', 'created_at', 'completed_at']
    ordering = ['-created_at']
