"""
M1 Model Schemas
"""
from typing import Optional, List, Any, Dict
from pydantic import BaseModel, Field


class M1InferenceRequest(BaseModel):
    """M1 추론 요청 스키마 (Django -> FastAPI)"""
    job_id: str = Field(..., description="추론 요청 ID (ai_req_xxxx)")
    study_uid: str = Field(..., description="DICOM Study UID")
    series_ids: Optional[List[str]] = Field(default=None, description="Orthanc Series ID 목록 (없으면 study_uid로 자동 탐색)")
    patient_id: str = Field(..., description="환자 ID")
    ocs_id: Optional[int] = Field(default=None, description="OCS ID")
    callback_url: str = Field(..., description="Django 콜백 URL")
    mode: str = Field(default="manual", description="추론 모드: manual / auto")


class M1InferenceResponse(BaseModel):
    """M1 추론 응답 스키마 (FastAPI -> Django)"""
    task_id: str = Field(..., description="Celery Task ID")
    status: str = Field(..., description="상태: processing")
    message: str = Field(..., description="메시지")


class TaskStatusResponse(BaseModel):
    """Task 상태 조회 응답"""
    task_id: str
    status: str  # PENDING, STARTED, PROCESSING, SUCCESS, FAILURE
    progress: Optional[int] = None
    message: Optional[str] = None
    result: Optional[Dict[str, Any]] = None
    error: Optional[str] = None


class M1ResultData(BaseModel):
    """M1 추론 결과 데이터"""
    grade: Optional[Dict[str, Any]] = None
    idh: Optional[Dict[str, Any]] = None
    mgmt: Optional[Dict[str, Any]] = None
    survival: Optional[Dict[str, Any]] = None
    os_days: Optional[Dict[str, Any]] = None
    encoder_features: Optional[List[float]] = None
    processing_time_ms: Optional[float] = None
    visualization_paths: Optional[List[str]] = None
