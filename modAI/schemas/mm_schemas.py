"""
MM Model Schemas

Multimodal (MRI + Gene + Protein) 모델의 입출력 스키마
Django -> FastAPI 요청/응답 및 Celery task용 스키마
"""

from pydantic import BaseModel, Field
from typing import Optional, List, Dict, Any
from enum import Enum


class RiskGroup(str, Enum):
    LOW = "Low"
    MEDIUM = "Medium"
    HIGH = "High"


# === Request Schemas ===

class MMInferenceRequest(BaseModel):
    """MM 추론 요청 스키마 (Django -> FastAPI)"""
    job_id: str = Field(..., description="추론 요청 ID (ai_req_xxxx)")
    ocs_id: int = Field(..., description="MM 추론 기준 OCS ID (BIOMARKER)")
    patient_id: str = Field(..., description="환자 ID")

    # Feature data (각 모달리티의 feature 데이터)
    mri_features: Optional[List[float]] = Field(
        None,
        description="M1 encoder output (768-dim) from m1_encoder_features.npz"
    )
    gene_features: Optional[List[float]] = Field(
        None,
        description="MG encoder output (64-dim) from mg_gene_features.json"
    )
    protein_data: Optional[str] = Field(
        None,
        description="RPPA CSV 파일 내용"
    )

    # Source OCS IDs (어떤 OCS에서 가져온 데이터인지 추적)
    mri_ocs_id: Optional[int] = Field(None, description="MRI OCS ID")
    gene_ocs_id: Optional[int] = Field(None, description="RNA_SEQ OCS ID")
    protein_ocs_id: Optional[int] = Field(None, description="BIOMARKER OCS ID")

    callback_url: str = Field(..., description="Django 콜백 URL")
    mode: str = Field(default="manual", description="추론 모드: manual / auto")


class MMInferenceResponse(BaseModel):
    """MM 추론 응답 스키마 (FastAPI -> Django, 즉시 응답)"""
    task_id: str = Field(..., description="Celery Task ID")
    status: str = Field(..., description="상태: processing")
    message: str = Field(..., description="메시지")


# === Result Schemas ===

class SurvivalResult(BaseModel):
    """생존 예측 (Cox PH) - 핵심 Task"""
    hazard_ratio: float = Field(..., description="위험비")
    risk_score: float = Field(..., ge=0, le=1, description="위험 점수 (0-1)")
    survival_probability_6m: Optional[float] = Field(None, description="6개월 생존 확률")
    survival_probability_12m: Optional[float] = Field(None, description="12개월 생존 확률")
    model_cindex: Optional[float] = Field(None, description="모델 C-Index (검증 성능)")


class RecurrenceResult(BaseModel):
    """재발 예측"""
    predicted_class: str = Field(..., description="예측 클래스: Recurrence / No_Recurrence")
    recurrence_probability: float = Field(..., ge=0, le=1)


class RiskGroupResult(BaseModel):
    """위험군 분류"""
    predicted_class: str = Field(..., description="Low / Medium / High")
    probabilities: Dict[str, float] = Field(..., description="위험군별 확률")


class MMResultData(BaseModel):
    """MM 추론 결과 데이터 (Callback으로 전송)"""
    job_id: str
    patient_id: str
    ocs_id: int

    # Source OCS IDs
    mri_ocs_id: Optional[int] = None
    gene_ocs_id: Optional[int] = None
    protein_ocs_id: Optional[int] = None

    # Core Tasks
    survival: Optional[SurvivalResult] = None
    recurrence: Optional[RecurrenceResult] = None
    risk_group: Optional[RiskGroupResult] = None

    # Summary
    recommendation: Optional[str] = Field(None, description="치료 권고사항")

    # Metadata
    processing_time_ms: float = 0.0
    model_version: str = "2.0.0"
    modalities_used: List[str] = Field(default_factory=list, description="사용된 모달리티 목록")


class MMPredictRequest(BaseModel):
    """MM 직접 예측 요청 (테스트용)"""
    mri_features: Optional[List[float]] = Field(
        None, min_length=768, max_length=768,
        description="M1 encoder output (768-dim)"
    )
    gene_features: Optional[List[float]] = Field(
        None, min_length=64, max_length=64,
        description="MG encoder output (64-dim)"
    )
    protein_features: Optional[List[float]] = Field(
        None, description="RPPA protein expression (167-229 proteins)"
    )
    patient_id: Optional[str] = None


class MMErrorResponse(BaseModel):
    """에러 응답"""
    detail: str
