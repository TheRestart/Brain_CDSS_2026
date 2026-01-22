"""
M1 Model Router

POST /api/v1/m1/inference - M1 추론 요청 (Celery task 등록)
POST /api/v1/m1/test - 동기 테스트 (디버깅용)
GET /api/v1/m1/task/{task_id}/status - Celery task 상태 조회
"""
import time
import json
from pathlib import Path
from fastapi import APIRouter, HTTPException
from celery.result import AsyncResult
from pydantic import BaseModel
from typing import Optional, List

from schemas.m1_schemas import M1InferenceRequest, M1InferenceResponse, TaskStatusResponse
from tasks.m1_tasks import run_m1_inference
from celery_app import celery_app
from config import settings

router = APIRouter()


class DirectTestRequest(BaseModel):
    """동기 테스트용 요청"""
    study_uid: str
    patient_id: str = "test_patient"
    include_segmentation: bool = True  # 세그멘테이션 포함 여부


@router.post("/inference", response_model=M1InferenceResponse)
async def start_m1_inference(request: M1InferenceRequest):
    """
    M1 추론 요청

    Django에서 호출되며, Celery task를 등록하고 즉시 반환
    실제 추론은 Celery worker에서 비동기로 수행
    """
    try:
        # Celery task 등록 (series_ids는 옵션, 없으면 study_uid로 자동 탐색)
        # apply_async로 m1_queue에 명시적으로 전송
        task = run_m1_inference.apply_async(
            kwargs={
                'job_id': request.job_id,
                'study_uid': request.study_uid,
                'patient_id': request.patient_id,
                'ocs_id': request.ocs_id,
                'callback_url': request.callback_url,
                'mode': request.mode,
                'series_ids': request.series_ids,
            },
            queue='m1_queue'
        )

        return M1InferenceResponse(
            task_id=task.id,
            status="processing",
            message="M1 추론 작업이 등록되었습니다."
        )

    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Task 등록 실패: {str(e)}")


@router.get("/task/{task_id}/status", response_model=TaskStatusResponse)
async def get_task_status(task_id: str):
    """
    Celery Task 상태 조회
    """
    result = AsyncResult(task_id, app=celery_app)

    response = TaskStatusResponse(
        task_id=task_id,
        status=result.status,
    )

    # 진행 중인 경우 progress 정보 포함
    if result.info and isinstance(result.info, dict):
        response.progress = result.info.get('progress', 0)
        response.message = result.info.get('status', '')

    # 완료된 경우 결과 정보 포함
    if result.status == 'SUCCESS' and result.result:
        response.result = result.result

    # 실패한 경우 에러 정보 포함
    if result.status == 'FAILURE':
        response.error = str(result.result) if result.result else "Unknown error"

    return response


@router.get("/health")
async def m1_health():
    """M1 라우터 헬스 체크"""
    return {"status": "healthy", "model": "M1"}


@router.post("/test")
async def direct_test(request: DirectTestRequest):
    """
    동기 테스트 엔드포인트 (Celery 없이 직접 실행)
    디버깅용으로 전체 파이프라인을 동기적으로 실행
    """
    from services.m1_service import M1InferenceService
    from utils.orthanc_client import OrthancClient

    start_time = time.time()
    logs = []

    def log(msg: str):
        elapsed = time.time() - start_time
        log_entry = f"[{elapsed:.2f}s] {msg}"
        logs.append(log_entry)
        print(log_entry)

    try:
        log(f"========== M1 Direct Test Start ==========")
        log(f"Study UID: {request.study_uid}")
        log(f"Patient ID: {request.patient_id}")

        # ============================================================
        # 1. Orthanc에서 DICOM 데이터 fetch
        # ============================================================
        log("Step 1: Fetching DICOM from Orthanc...")

        orthanc = OrthancClient()
        log(f"  Orthanc URL: {settings.ORTHANC_URL}")

        dicom_data = orthanc.fetch_study_dicom_bytes(request.study_uid, series_ids=None)

        # 모달리티별 슬라이스 수 확인
        modality_counts = {}
        for mod in ['T1', 'T1CE', 'T2', 'FLAIR']:
            count = len(dicom_data.get(mod, []))
            modality_counts[mod] = count
            log(f"  {mod}: {count} slices")
            if count == 0:
                raise ValueError(f"Missing modality: {mod}")

        log(f"  Total DICOM fetch complete!")

        # ============================================================
        # 2. 전처리
        # ============================================================
        log("Step 2: Preprocessing...")

        service = M1InferenceService()
        preprocessed = service.preprocess(dicom_data, request.patient_id)

        image_shape = tuple(preprocessed['image'].shape)
        log(f"  Preprocessed image shape: {image_shape}")
        log(f"  Image dtype: {preprocessed['image'].dtype}")
        log(f"  Image min: {preprocessed['image'].min():.4f}")
        log(f"  Image max: {preprocessed['image'].max():.4f}")

        if 'timing' in preprocessed:
            log(f"  Preprocessing timing: {preprocessed['timing']}")

        # ============================================================
        # 3. M1 모델 추론
        # ============================================================
        if request.include_segmentation:
            log("Step 3: Running M1 inference with segmentation...")
            result = service.predict_with_segmentation(preprocessed)
        else:
            log("Step 3: Running M1 inference (classification only)...")
            result = service.predict(preprocessed)

        log(f"  Grade: {result.get('grade', {})}")
        log(f"  IDH: {result.get('idh', {})}")
        log(f"  MGMT: {result.get('mgmt', {})}")
        log(f"  Survival: {result.get('survival', {})}")

        # 세그멘테이션 결과 확인
        if 'segmentation' in result:
            seg = result['segmentation']
            log(f"  Segmentation:")
            log(f"    - Whole Tumor (WT): {seg.get('wt_volume', 0)} ml")
            log(f"    - Tumor Core (TC): {seg.get('tc_volume', 0)} ml")
            log(f"    - Enhancing Tumor (ET): {seg.get('et_volume', 0)} ml")
            log(f"    - Mask shape: {seg.get('mask_shape', [])}")
            log(f"    - Label distribution: {seg.get('label_distribution', {})}")

        # Encoder features 확인
        encoder_features = result.get('encoder_features', [])
        if encoder_features:
            import numpy as np
            features_arr = np.array(encoder_features)
            log(f"  Encoder features shape: {features_arr.shape}")
            log(f"  Encoder features min: {features_arr.min():.4f}")
            log(f"  Encoder features max: {features_arr.max():.4f}")
            log(f"  Encoder features mean: {features_arr.mean():.4f}")

        log(f"  Processing time: {result.get('processing_time_ms', 0):.1f}ms")

        # ============================================================
        # 4. 결과 저장
        # ============================================================
        log("Step 4: Saving results...")

        output_dir = settings.STORAGE_DIR / "test_result"
        output_dir.mkdir(parents=True, exist_ok=True)

        result_file = output_dir / 'result.json'
        with open(result_file, 'w', encoding='utf-8') as f:
            # encoder_features는 너무 길어서 요약만 저장
            save_result = {k: v for k, v in result.items() if k != 'encoder_features'}
            save_result['encoder_features_shape'] = len(encoder_features)
            json.dump(save_result, f, ensure_ascii=False, indent=2, default=str)

        log(f"  Results saved to: {output_dir}")

        # ============================================================
        # 완료
        # ============================================================
        total_time = time.time() - start_time
        log(f"========== M1 Direct Test Complete ({total_time:.2f}s) ==========")

        # 반환할 결과 구성
        result_data = {
            "grade": result.get('grade'),
            "idh": result.get('idh'),
            "mgmt": result.get('mgmt'),
            "survival": result.get('survival'),
            "encoder_features_dim": len(encoder_features),
        }

        # 세그멘테이션 결과 추가 (visualization은 제외 - 너무 큼)
        if 'segmentation' in result:
            seg = result['segmentation']
            result_data['segmentation'] = {
                "wt_volume": seg.get('wt_volume', 0),
                "tc_volume": seg.get('tc_volume', 0),
                "et_volume": seg.get('et_volume', 0),
                "ncr_volume": seg.get('ncr_volume', 0),
                "ed_volume": seg.get('ed_volume', 0),
                "mask_shape": seg.get('mask_shape', []),
                "label_distribution": seg.get('label_distribution', {}),
            }

        return {
            "status": "success",
            "total_time_seconds": round(total_time, 2),
            "modality_counts": modality_counts,
            "image_shape": image_shape,
            "result": result_data,
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
