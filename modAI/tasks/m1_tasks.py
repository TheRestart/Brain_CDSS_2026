"""
M1 Celery Tasks

M1 MRI 추론을 위한 비동기 Celery task
- CDSS_STORAGE 직접 접근 없음
- 결과 파일은 callback으로 Django에 전송
"""
import os
import time
import logging
import httpx
from pathlib import Path
from celery import shared_task
from celery.utils.log import get_task_logger

import sys
sys.path.insert(0, str(Path(__file__).parent.parent))

from services.m1_service import M1InferenceService
from utils.orthanc_client import OrthancClient

logger = get_task_logger(__name__)


def resolve_callback_url(callback_url: str) -> str:
    """
    Docker 환경에서 callback URL을 내부 Django URL로 대체

    Docker 컨테이너 내부에서는 외부 IP나 localhost로 접근하면 문제가 발생하므로,
    DJANGO_URL 환경변수(예: http://django:8000)를 사용하여 내부 URL로 변환합니다.
    """
    django_url = os.getenv('DJANGO_URL', '')

    if not django_url:
        return callback_url

    # DJANGO_URL이 설정되어 있으면 항상 내부 URL 사용
    # (localhost, 127.0.0.1, 외부 IP 모두 대체)
    from urllib.parse import urlparse
    parsed = urlparse(callback_url)
    path = parsed.path
    if parsed.query:
        path += f'?{parsed.query}'

    # DJANGO_URL과 path 결합
    resolved_url = django_url.rstrip('/') + path
    logger.info(f"[M1] Callback URL resolved: {callback_url} -> {resolved_url}")
    return resolved_url


@shared_task(bind=True, name='tasks.m1_tasks.run_m1_inference')
def run_m1_inference(
    self,
    job_id: str,
    study_uid: str,
    patient_id: str,
    callback_url: str,
    mode: str = 'manual',
    series_ids: list = None,
    ocs_id: int = None,
):
    """
    M1 추론 Celery Task

    1. Orthanc에서 DICOM 데이터 fetch (study_uid로 t1/t1ce/t2/flair 자동 탐색)
    2. M1Preprocessor로 전처리
    3. M1ClsInference로 추론
    4. 결과를 callback으로 Django에 전송 (Django에서 CDSS_STORAGE에 저장)

    Args:
        job_id: Django에서 생성한 추론 요청 ID
        study_uid: DICOM Study UID
        patient_id: 환자 ID
        callback_url: Django 콜백 URL
        mode: 추론 모드 (manual/auto)
        series_ids: Orthanc Series ID 목록 (없으면 study_uid로 자동 탐색)
        ocs_id: OCS ID
    """
    task_id = self.request.id
    start_time = time.time()

    logger.info(f"[M1] Starting inference: job_id={job_id}, task_id={task_id}")
    logger.info(f"[M1] Study UID: {study_uid}, Auto-detect series: {series_ids is None}")

    try:
        # ============================================================
        # 1. Orthanc에서 DICOM 데이터 fetch
        # ============================================================
        self.update_state(state='PROCESSING', meta={
            'progress': 10,
            'status': 'Orthanc에서 DICOM 데이터 로드 중...'
        })

        orthanc = OrthancClient()
        # 최적화된 Archive API 사용 (620 요청 → 4 요청)
        dicom_data = orthanc.fetch_study_dicom_bytes_fast(study_uid, series_ids)

        # 모달리티 확인
        for mod in ['T1', 'T1CE', 'T2', 'FLAIR']:
            count = len(dicom_data.get(mod, []))
            logger.info(f"[M1] {mod}: {count} slices")
            if count == 0:
                raise ValueError(f"Missing modality: {mod}")

        self.update_state(state='PROCESSING', meta={
            'progress': 30,
            'status': 'DICOM 데이터 로드 완료, 전처리 중...'
        })

        # ============================================================
        # 2. 전처리
        # ============================================================
        service = M1InferenceService()
        preprocessed = service.preprocess(dicom_data, patient_id)

        logger.info(f"[M1] Preprocessing complete: shape={preprocessed['image'].shape}")

        self.update_state(state='PROCESSING', meta={
            'progress': 50,
            'status': '전처리 완료, M1 모델 추론 중...'
        })

        # ============================================================
        # 3. M1 모델 추론 (분류 + 세그멘테이션)
        # ============================================================
        result = service.predict_with_segmentation(preprocessed)

        logger.info(f"[M1] Inference complete: grade={result.get('grade', {}).get('predicted_class')}")

        if 'segmentation' in result:
            seg = result['segmentation']
            logger.info(f"[M1] Segmentation: WT={seg.get('wt_volume', 0):.2f}ml, TC={seg.get('tc_volume', 0):.2f}ml, ET={seg.get('et_volume', 0):.2f}ml")

        self.update_state(state='PROCESSING', meta={
            'progress': 80,
            'status': '추론 완료, 결과 준비 중...'
        })

        # ============================================================
        # 4. 결과 파일 내용 준비 (로컬 저장 없음, callback으로 전송)
        # ============================================================
        processing_time = (time.time() - start_time) * 1000
        result['processing_time_ms'] = processing_time

        # 파일 내용을 callback용으로 준비
        files_data = service.prepare_results_for_callback(result, job_id)

        logger.info(f"[M1] Files prepared for callback: {list(files_data.keys())}")

        self.update_state(state='PROCESSING', meta={
            'progress': 90,
            'status': '결과 준비 완료, 콜백 전송 중...'
        })

        # ============================================================
        # 5. Django callback (파일 내용 포함)
        # ============================================================
        # Callback용 결과 데이터
        callback_result = {
            'job_id': job_id,
            'patient_id': patient_id,
            'ocs_id': ocs_id,
            'grade': result.get('grade'),
            'idh': result.get('idh'),
            'mgmt': result.get('mgmt'),
            'survival': result.get('survival'),
            'processing_time_ms': processing_time,
        }

        # 세그멘테이션 볼륨 정보만 포함 (마스크/MRI 데이터 제외)
        if 'segmentation' in result:
            seg = result['segmentation']
            callback_result['segmentation'] = {
                'wt_volume': seg.get('wt_volume', 0),
                'tc_volume': seg.get('tc_volume', 0),
                'et_volume': seg.get('et_volume', 0),
                'ncr_volume': seg.get('ncr_volume', 0),
                'ed_volume': seg.get('ed_volume', 0),
                'mask_shape': seg.get('mask_shape', []),
                'label_distribution': seg.get('label_distribution', {}),
            }

        callback_data = {
            'job_id': job_id,
            'status': 'completed',
            'result_data': callback_result,
            'files': files_data,  # 파일 내용 포함
        }

        try:
            resolved_callback_url = resolve_callback_url(callback_url)
            response = httpx.post(
                resolved_callback_url,
                json=callback_data,
                timeout=120.0  # NPZ 파일이 크므로 타임아웃 증가
            )
            response.raise_for_status()
            logger.info(f"[M1] Callback sent successfully with {len(files_data)} files")
        except httpx.HTTPError as e:
            logger.error(f"[M1] Callback failed: {str(e)}")
            # 콜백 실패 시 재시도하거나 에러 처리

        logger.info(f"[M1] Inference completed: job_id={job_id}, time={processing_time:.1f}ms")

        return {
            'status': 'completed',
            'job_id': job_id,
            'processing_time_ms': processing_time,
        }

    except Exception as e:
        logger.error(f"[M1] Inference failed: {str(e)}", exc_info=True)

        # Django에 실패 callback
        try:
            resolved_callback_url = resolve_callback_url(callback_url)
            httpx.post(
                resolved_callback_url,
                json={
                    'job_id': job_id,
                    'status': 'failed',
                    'error_message': str(e),
                },
                timeout=30.0
            )
        except Exception as callback_error:
            logger.error(f"[M1] Failed to send error callback: {str(callback_error)}")

        raise
