"""
MG Model Schemas

Gene Expression 기반 예측 스키마
"""
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


class MGInferenceRequest(BaseModel):
    """MG 추론 요청 스키마 (Django -> FastAPI)"""
    job_id: str = Field(..., description="추론 요청 ID (ai_req_xxxx)")
    ocs_id: int = Field(..., description="OCS ID")
    patient_id: str = Field(..., description="환자 ID")
    csv_content: str = Field(..., description="Gene Expression CSV 파일 내용")
    callback_url: str = Field(..., description="Django 콜백 URL")
    mode: str = Field(default="manual", description="추론 모드: manual / auto")


class MGInferenceResponse(BaseModel):
    """MG 추론 응답 스키마 (FastAPI -> Django)"""
    task_id: str = Field(..., description="Celery Task ID")
    status: str = Field(..., description="상태: processing")
    message: str = Field(..., description="메시지")


class MGResultData(BaseModel):
    """MG 추론 결과 데이터"""
    survival_risk: Optional[Dict[str, Any]] = None
    survival_time: Optional[Dict[str, Any]] = None
    grade: Optional[Dict[str, Any]] = None
    recurrence: Optional[Dict[str, Any]] = None
    tmz_response: Optional[Dict[str, Any]] = None
    encoder_features: Optional[List[float]] = None
    processing_time_ms: Optional[float] = None
    input_genes_count: Optional[int] = None
    model_version: Optional[str] = None
    visualizations: Optional[Dict[str, str]] = None


class MGPredictRequest(BaseModel):
    """MG 예측 요청 (직접 API 호출용)"""
    gene_expression: List[float] = Field(..., description="Gene expression 값 리스트")
    gene_names: Optional[List[str]] = Field(default=None, description="Gene name 리스트")
    patient_id: Optional[str] = Field(default=None, description="환자 ID")


class MGPredictResponse(BaseModel):
    """MG 예측 응답"""
    success: bool = True
    patient_id: Optional[str] = None
    survival_risk: Optional[Dict[str, Any]] = None
    survival_time: Optional[Dict[str, Any]] = None
    grade: Optional[Dict[str, Any]] = None
    recurrence: Optional[Dict[str, Any]] = None
    tmz_response: Optional[Dict[str, Any]] = None
    visualizations: Optional[Dict[str, str]] = None
    processing_time_ms: float = 0.0
    model_version: str = "1.0.0"
    input_genes_count: int = 0


class MGErrorResponse(BaseModel):
    """에러 응답"""
    detail: str
