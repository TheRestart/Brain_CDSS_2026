"""
MM Model Router

POST /api/v1/mm/inference - MM 추론 요청 (Celery task 등록)
GET /api/v1/mm/task/{task_id}/status - Celery task 상태 조회
GET /api/v1/mm/health - 헬스 체크
POST /api/v1/mm/test - 동기 테스트 (디버깅용)
"""
import time
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from celery.result import AsyncResult
from pydantic import BaseModel
from typing import Optional, List

from schemas.mm_schemas import MMInferenceRequest, MMInferenceResponse, MMPredictRequest
from tasks.mm_tasks import run_mm_inference
from celery_app import celery_app

router = APIRouter()


@router.post("/inference", response_model=MMInferenceResponse)
async def start_mm_inference(request: MMInferenceRequest):
    """
    MM 추론 요청

    Django에서 호출되며, Celery task를 등록하고 즉시 반환
    실제 추론은 Celery worker에서 비동기로 수행
    """
    try:
        # Celery task 등록
        task = run_mm_inference.apply_async(
            kwargs={
                'job_id': request.job_id,
                'ocs_id': request.ocs_id,
                'patient_id': request.patient_id,
                'callback_url': request.callback_url,
                'mode': request.mode,
                'mri_features': request.mri_features,
                'gene_features': request.gene_features,
                'protein_data': request.protein_data,
                'mri_ocs_id': request.mri_ocs_id,
                'gene_ocs_id': request.gene_ocs_id,
                'protein_ocs_id': request.protein_ocs_id,
            },
            queue='mm_queue'  # MM은 mm_queue 사용
        )

        return MMInferenceResponse(
            task_id=task.id,
            status="processing",
            message="MM 추론 작업이 등록되었습니다."
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task 등록 실패: {str(e)}")


@router.get("/task/{task_id}/status")
async def get_task_status(task_id: str):
    """
    Celery Task 상태 조회
    """
    result = AsyncResult(task_id, app=celery_app)

    response = {
        "task_id": task_id,
        "status": result.status,
    }

    # 진행 중인 경우 progress 정보 포함
    if result.info and isinstance(result.info, dict):
        response["progress"] = result.info.get('progress', 0)
        response["message"] = result.info.get('status', '')

    # 완료된 경우 결과 정보 포함
    if result.status == 'SUCCESS' and result.result:
        response["result"] = result.result

    # 실패한 경우 에러 정보 포함
    if result.status == 'FAILURE':
        response["error"] = str(result.result) if result.result else "Unknown error"

    return response


@router.get("/health")
async def mm_health():
    """MM 라우터 헬스 체크"""
    from services.mm_service import MMInferenceService

    weights_path = Path(__file__).parent.parent / "model" / "mm_best.pt"

    return {
        "status": "healthy",
        "model": "MM",
        "weights_exist": weights_path.exists(),
        "version": "2.0.0"
    }


@router.get("/info")
async def model_info():
    """MM 모델 정보 반환"""
    weights_path = Path(__file__).parent.parent / "model" / "mm_best.pt"

    return {
        "model_name": "MM (Multimodal Model)",
        "version": "2.0.0",
        "status": "ready" if weights_path.exists() else "no_weights",
        "note": "Clinical metadata 제외 - Survival 예측 성능 향상",
        "input_modalities": [
            {
                "name": "mri_features",
                "dim": 768,
                "source": "M1 encoder (m1_encoder_features.npz)",
                "required": False,
            },
            {
                "name": "gene_features",
                "dim": 64,
                "source": "MG encoder (mg_gene_features.json)",
                "required": False,
            },
            {
                "name": "protein_features",
                "dim": "167-229",
                "source": "RPPA (rppa.csv)",
                "required": False,
            },
        ],
        "tasks": [
            {
                "name": "survival",
                "description": "생존 위험도 (Cox PH)",
                "output": "Hazard Ratio, Risk Score, Survival Probabilities",
            },
            {
                "name": "recurrence",
                "description": "재발 예측",
                "classes": ["No_Recurrence", "Recurrence"],
            },
            {
                "name": "risk_group",
                "description": "위험군 분류",
                "classes": ["Low", "Medium", "High"],
            },
        ],
        "fusion_method": "Cross-Modal Attention",
    }


class DirectTestRequest(BaseModel):
    """동기 테스트용 요청"""
    mri_features: Optional[List[float]] = None
    gene_features: Optional[List[float]] = None
    protein_csv_content: Optional[str] = None
    patient_id: str = "test_patient"


@router.post("/test")
async def direct_test(request: DirectTestRequest):
    """
    동기 테스트 엔드포인트 (Celery 없이 직접 실행)
    디버깅용으로 전체 파이프라인을 동기적으로 실행
    """
    from services.mm_service import MMInferenceService

    start_time = time.time()
    logs = []

    def log(msg: str):
        elapsed = time.time() - start_time
        log_entry = f"[{elapsed:.2f}s] {msg}"
        logs.append(log_entry)
        print(log_entry)

    try:
        log(f"========== MM Direct Test Start ==========")
        log(f"Patient ID: {request.patient_id}")
        log(f"MRI features: {len(request.mri_features) if request.mri_features else 0}-dim")
        log(f"Gene features: {len(request.gene_features) if request.gene_features else 0}-dim")
        log(f"Protein CSV: {len(request.protein_csv_content) if request.protein_csv_content else 0} chars")

        # MM 서비스 초기화
        service = MMInferenceService()

        # Protein CSV 파싱
        protein_features = None
        if request.protein_csv_content:
            log("Parsing protein CSV...")
            protein_features = service.parse_protein_csv(request.protein_csv_content)
            log(f"  Parsed {len(protein_features)} protein features")

        # 추론 수행
        log("Running MM inference...")
        result = service.predict(
            mri_features=request.mri_features,
            gene_features=request.gene_features,
            protein_features=protein_features,
            include_xai=True
        )

        log(f"  Survival Risk Score: {result.get('survival', {}).get('risk_score', 0):.3f}")
        log(f"  Risk Group: {result.get('risk_group', {}).get('predicted_class')}")
        log(f"  Recurrence: {result.get('recurrence', {}).get('predicted_class')}")
        log(f"  Processing time: {result.get('processing_time_ms', 0):.1f}ms")

        # 완료
        total_time = time.time() - start_time
        log(f"========== MM Direct Test Complete ({total_time:.2f}s) ==========")

        return {
            "status": "success",
            "total_time_seconds": round(total_time, 2),
            "result": {
                "survival": result.get('survival'),
                "recurrence": result.get('recurrence'),
                "risk_group": result.get('risk_group'),
                "recommendation": result.get('recommendation'),
                "modalities_used": result.get('modalities_used', []),
            },
            "logs": logs,
        }

    except Exception as e:
        import traceback
        error_trace = traceback.format_exc()
        log(f"ERROR: {str(e)}")
        log(f"Traceback:\n{error_trace}")

        return {
            "status": "error",
            "error": str(e),
            "traceback": error_trace,
            "logs": logs,
        }
