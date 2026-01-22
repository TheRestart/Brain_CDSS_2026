"""
MG Model Router

POST /api/v1/mg/inference - MG 추론 요청 (Celery task 등록)
POST /api/v1/mg/test - 동기 테스트 (디버깅용)
GET /api/v1/mg/task/{task_id}/status - Celery task 상태 조회
"""
import time
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from celery.result import AsyncResult
from pydantic import BaseModel
from typing import Optional

from schemas.mg_schemas import MGInferenceRequest, MGInferenceResponse
from tasks.mg_tasks import run_mg_inference
from celery_app import celery_app
from config import settings

router = APIRouter()


class DirectTestRequest(BaseModel):
    """동기 테스트용 요청"""
    csv_path: str
    patient_id: str = "test_patient"
    include_visualizations: bool = True


@router.post("/inference", response_model=MGInferenceResponse)
async def start_mg_inference(request: MGInferenceRequest):
    """
    MG 추론 요청

    Django에서 호출되며, Celery task를 등록하고 즉시 반환
    실제 추론은 Celery worker에서 비동기로 수행
    """
    try:
        # Celery task 등록
        task = run_mg_inference.apply_async(
            kwargs={
                'job_id': request.job_id,
                'ocs_id': request.ocs_id,
                'patient_id': request.patient_id,
                'csv_content': request.csv_content,  # 파일 경로 대신 내용 전달
                'callback_url': request.callback_url,
                'mode': request.mode,
            },
            queue='mg_queue'  # MG는 mg_queue 사용
        )

        return MGInferenceResponse(
            task_id=task.id,
            status="processing",
            message="MG 추론 작업이 등록되었습니다."
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
async def mg_health():
    """MG 라우터 헬스 체크"""
    return {"status": "healthy", "model": "MG"}


@router.post("/test")
async def direct_test(request: DirectTestRequest):
    """
    동기 테스트 엔드포인트 (Celery 없이 직접 실행)
    디버깅용으로 전체 파이프라인을 동기적으로 실행
    """
    from services.mg_service import MGInferenceService

    start_time = time.time()
    logs = []

    def log(msg: str):
        elapsed = time.time() - start_time
        log_entry = f"[{elapsed:.2f}s] {msg}"
        logs.append(log_entry)
        print(log_entry)

    try:
        log(f"========== MG Direct Test Start ==========")
        log(f"CSV Path: {request.csv_path}")
        log(f"Patient ID: {request.patient_id}")

        # CSV 파일 확인
        csv_path = Path(request.csv_path)
        if not csv_path.exists():
            raise ValueError(f"CSV file not found: {csv_path}")

        log(f"  CSV file exists: {csv_path.stat().st_size} bytes")

        # MG 서비스 초기화
        service = MGInferenceService()

        # CSV 로드 및 전처리
        log("Step 1: Loading CSV data...")
        gene_data = service.load_csv(str(csv_path))
        log(f"  Loaded {gene_data['gene_count']} genes")

        # 추론 수행
        log("Step 2: Running MG inference...")
        result = service.predict(
            gene_expression=gene_data['gene_expression'],
            gene_names=gene_data['gene_names'],
            include_visualizations=request.include_visualizations
        )

        log(f"  Survival Risk: {result.get('survival_risk', {})}")
        log(f"  Grade: {result.get('grade', {})}")
        log(f"  Recurrence: {result.get('recurrence', {})}")
        log(f"  TMZ Response: {result.get('tmz_response', {})}")
        log(f"  Processing time: {result.get('processing_time_ms', 0):.1f}ms")

        # 결과 저장
        log("Step 3: Saving results...")
        output_dir = settings.STORAGE_DIR / "test_mg_result"
        output_dir.mkdir(parents=True, exist_ok=True)

        result_file = output_dir / 'result.json'
        with open(result_file, 'w', encoding='utf-8') as f:
            # encoder_features는 너무 길어서 요약만 저장
            save_result = {k: v for k, v in result.items() if k != 'encoder_features'}
            if 'encoder_features' in result:
                save_result['encoder_features_dim'] = len(result['encoder_features'])
            json.dump(save_result, f, ensure_ascii=False, indent=2, default=str)

        log(f"  Results saved to: {output_dir}")

        # 완료
        total_time = time.time() - start_time
        log(f"========== MG Direct Test Complete ({total_time:.2f}s) ==========")

        return {
            "status": "success",
            "total_time_seconds": round(total_time, 2),
            "gene_count": gene_data['gene_count'],
            "result": {
                "survival_risk": result.get('survival_risk'),
                "survival_time": result.get('survival_time'),
                "grade": result.get('grade'),
                "recurrence": result.get('recurrence'),
                "tmz_response": result.get('tmz_response'),
                "encoder_features_dim": len(result.get('encoder_features', [])),
            },
            "output_dir": str(output_dir),
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
