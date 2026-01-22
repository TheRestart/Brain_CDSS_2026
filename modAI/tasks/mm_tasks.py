"""
MM Model Celery Tasks

Multimodal (MRI + Gene + Protein) 추론을 위한 비동기 Celery task
- CDSS_STORAGE 직접 접근 없음
- 결과 파일은 callback으로 Django에 전송
"""
import os
import time
import json
import httpx
from celery import shared_task
from celery.utils.log import get_task_logger

from services.mm_service import MMInferenceService

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
    from urllib.parse import urlparse
    parsed = urlparse(callback_url)
    path = parsed.path
    if parsed.query:
        path += f'?{parsed.query}'

    resolved_url = django_url.rstrip('/') + path
    logger.info(f"[MM] Callback URL resolved: {callback_url} -> {resolved_url}")
    return resolved_url


@shared_task(bind=True, name='tasks.mm_tasks.run_mm_inference')
def run_mm_inference(
    self,
    job_id: str,
    ocs_id: int,
    patient_id: str,
    callback_url: str,
    mode: str = 'manual',
    mri_features: list = None,
    gene_features: list = None,
    protein_data: str = None,
    mri_ocs_id: int = None,
    gene_ocs_id: int = None,
    protein_ocs_id: int = None,
):
    """
    MM 추론 Celery Task

    1. 입력 데이터 검증 (mri_features, gene_features, protein_data)
    2. Protein CSV 파싱 (if protein_data provided)
    3. MMInferenceService로 추론
    4. 결과를 callback으로 Django에 전송

    Args:
        job_id: Django에서 생성한 추론 요청 ID
        ocs_id: MM 추론 기준 OCS ID
        patient_id: 환자 ID
        callback_url: Django 콜백 URL
        mode: 추론 모드 (manual/auto)
        mri_features: M1 encoder features (768-dim)
        gene_features: MG encoder features (64-dim)
        protein_data: RPPA CSV 파일 내용
        mri_ocs_id: MRI OCS ID (source tracking)
        gene_ocs_id: RNA_SEQ OCS ID (source tracking)
        protein_ocs_id: BIOMARKER OCS ID (source tracking)
    """
    task_id = self.request.id
    start_time = time.time()

    logger.info(f"[MM] Starting inference: job_id={job_id}, task_id={task_id}")
    logger.info(f"[MM] Patient: {patient_id}, OCS: {ocs_id}")
    logger.info(f"[MM] Source OCS - MRI: {mri_ocs_id}, Gene: {gene_ocs_id}, Protein: {protein_ocs_id}")

    try:
        # ============================================================
        # 1. 입력 데이터 검증
        # ============================================================
        self.update_state(state='PROCESSING', meta={
            'progress': 10,
            'status': '입력 데이터 검증 중...'
        })

        modalities_available = []
        if mri_features:
            logger.info(f"[MM] MRI features: {len(mri_features)}-dim")
            modalities_available.append('mri')
        if gene_features:
            logger.info(f"[MM] Gene features: {len(gene_features)}-dim")
            modalities_available.append('gene')
        if protein_data:
            logger.info(f"[MM] Protein data: {len(protein_data)} chars")
            modalities_available.append('protein')

        if not modalities_available:
            raise ValueError("At least one modality must be provided")

        logger.info(f"[MM] Available modalities: {modalities_available}")

        self.update_state(state='PROCESSING', meta={
            'progress': 20,
            'status': '데이터 전처리 중...'
        })

        # ============================================================
        # 2. Protein CSV 파싱
        # ============================================================
        protein_features = None
        if protein_data:
            service = MMInferenceService()
            protein_features = service.parse_protein_csv(protein_data)
            logger.info(f"[MM] Protein features parsed: {len(protein_features)}-dim")

        self.update_state(state='PROCESSING', meta={
            'progress': 40,
            'status': 'MM 모델 추론 중...'
        })

        # ============================================================
        # 3. MM 모델 추론
        # ============================================================
        service = MMInferenceService()
        result = service.predict(
            mri_features=mri_features,
            gene_features=gene_features,
            protein_features=protein_features,
            include_xai=True
        )

        logger.info(f"[MM] Inference complete: risk_group={result.get('risk_group', {}).get('predicted_class')}")
        logger.info(f"[MM] Survival: risk_score={result.get('survival', {}).get('risk_score', 0):.3f}")
        logger.info(f"[MM] Recurrence: {result.get('recurrence', {}).get('predicted_class')}")

        self.update_state(state='PROCESSING', meta={
            'progress': 70,
            'status': '결과 준비 중...'
        })

        # ============================================================
        # 4. 결과 파일 준비
        # ============================================================
        processing_time = (time.time() - start_time) * 1000
        result['processing_time_ms'] = processing_time

        files_data = service.prepare_results_for_callback(result, job_id)
        logger.info(f"[MM] Files prepared for callback: {list(files_data.keys())}")

        self.update_state(state='PROCESSING', meta={
            'progress': 85,
            'status': '결과 전송 중...'
        })

        # ============================================================
        # 5. Django callback
        # ============================================================
        callback_result = {
            'job_id': job_id,
            'patient_id': patient_id,
            'ocs_id': ocs_id,
            'mri_ocs_id': mri_ocs_id,
            'gene_ocs_id': gene_ocs_id,
            'protein_ocs_id': protein_ocs_id,
            'survival': result.get('survival'),
            'recurrence': result.get('recurrence'),
            'risk_group': result.get('risk_group'),
            'recommendation': result.get('recommendation'),
            'processing_time_ms': processing_time,
            'model_version': '2.0.0',
            'modalities_used': result.get('modalities_used', []),
        }

        callback_data = {
            'job_id': job_id,
            'status': 'completed',
            'result_data': callback_result,
            'files': files_data,
        }

        try:
            resolved_callback_url = resolve_callback_url(callback_url)
            response = httpx.post(
                resolved_callback_url,
                json=callback_data,
                timeout=60.0
            )
            response.raise_for_status()
            logger.info(f"[MM] Callback sent successfully with {len(files_data)} files")
        except httpx.HTTPError as e:
            logger.error(f"[MM] Callback failed: {str(e)}")

        logger.info(f"[MM] Inference completed: job_id={job_id}, time={processing_time:.1f}ms")

        return {
            'status': 'completed',
            'job_id': job_id,
            'processing_time_ms': processing_time,
        }

    except Exception as e:
        logger.error(f"[MM] Inference failed: {str(e)}", exc_info=True)

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
            logger.error(f"[MM] Failed to send error callback: {str(callback_error)}")

        raise
