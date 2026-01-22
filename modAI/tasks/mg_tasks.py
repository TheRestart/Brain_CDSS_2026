"""
MG Model Celery Tasks

Gene Expression 기반 추론 태스크
- CDSS_STORAGE 직접 접근 없음
- CSV 내용을 Django로부터 받아 처리
- 결과 파일은 callback으로 Django에 전송
"""
import os
import json
import base64
import httpx
import numpy as np
from celery import shared_task


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
    print(f"[MG] Callback URL resolved: {callback_url} -> {resolved_url}")
    return resolved_url


@shared_task(bind=True, name='tasks.mg_tasks.run_mg_inference')
def run_mg_inference(
    self,
    job_id: str,
    ocs_id: int,
    patient_id: str,
    csv_content: str,  # 파일 경로 대신 내용
    callback_url: str,
    mode: str = 'manual'
):
    """
    MG 추론 Celery Task

    1. CSV 내용에서 gene expression 데이터 파싱
    2. 전처리 및 추론
    3. 결과를 callback으로 Django에 전송 (Django에서 저장)
    """
    from services.mg_service import MGInferenceService

    def update_progress(progress: int, status: str):
        """진행 상태 업데이트"""
        self.update_state(
            state='PROCESSING',
            meta={'progress': progress, 'status': status}
        )

    try:
        print(f"\n{'='*60}")
        print(f"MG Inference Task Started")
        print(f"  Job ID: {job_id}")
        print(f"  OCS ID: {ocs_id}")
        print(f"  Patient ID: {patient_id}")
        print(f"  CSV Content Length: {len(csv_content)} chars")
        print(f"{'='*60}\n")

        # 1. CSV 내용 파싱
        update_progress(10, "Parsing CSV data...")

        # 2. MG 서비스 초기화 및 CSV 파싱
        update_progress(20, "Initializing MG service...")
        service = MGInferenceService()

        update_progress(30, "Parsing gene expression data...")
        gene_data = service.load_csv_content(csv_content)  # 내용으로 직접 파싱
        print(f"  Loaded {gene_data['gene_count']} genes")

        # 3. 추론 수행
        update_progress(50, "Running MG inference...")
        result = service.predict(
            gene_expression=gene_data['gene_expression'],
            gene_names=gene_data['gene_names'],
            include_visualizations=True
        )
        print(f"  Inference complete: {result.get('processing_time_ms', 0):.1f}ms")

        # 4. 결과 데이터 준비 (파일로 저장하지 않고 callback에 포함)
        update_progress(70, "Preparing results...")

        result_data = {
            'job_id': job_id,
            'patient_id': patient_id,
            'ocs_id': ocs_id,
            'survival_risk': result.get('survival_risk'),
            'survival_time': result.get('survival_time'),
            'grade': result.get('grade'),
            'recurrence': result.get('recurrence'),
            'tmz_response': result.get('tmz_response'),
            'xai': result.get('xai'),
            'processing_time_ms': result.get('processing_time_ms'),
            'input_genes_count': result.get('input_genes_count'),
            'model_version': result.get('model_version', '1.0.0'),
        }

        # 5. 파일 내용 준비 (Django에서 저장할 파일들)
        files_data = {}

        # mg_result.json
        files_data['mg_result.json'] = {
            'content': json.dumps(result_data, ensure_ascii=False, indent=2, default=str),
            'type': 'json'
        }

        # encoder_features 저장 (JSON 파일)
        if 'encoder_features' in result:
            features_data = {
                'job_id': job_id,
                'patient_id': patient_id,
                'ocs_id': ocs_id,
                'features': result['encoder_features'] if isinstance(result['encoder_features'], list) else result['encoder_features'].tolist(),
                'feature_dim': len(result['encoder_features']),
            }
            files_data['mg_gene_features.json'] = {
                'content': json.dumps(features_data, ensure_ascii=False, indent=2),
                'type': 'json'
            }

        # 시각화 이미지 (base64로 전송)
        if 'visualizations' in result and result['visualizations']:
            for viz_name, viz_base64 in result['visualizations'].items():
                if viz_base64:
                    files_data[f'mg_{viz_name}.png'] = {
                        'content': viz_base64,
                        'type': 'png'
                    }
            print(f"  Prepared {len(result['visualizations'])} visualizations")

        # 6. Django 콜백 (파일 내용 포함)
        update_progress(90, "Sending callback...")

        # Docker 환경에서 localhost를 host.docker.internal로 변환
        resolved_callback_url = resolve_callback_url(callback_url)

        callback_data = {
            'job_id': job_id,
            'status': 'completed',
            'result_data': result_data,
            'files': files_data,  # 파일 내용 포함
        }

        try:
            response = httpx.post(resolved_callback_url, json=callback_data, timeout=60.0)
            response.raise_for_status()
            print(f"  Callback sent successfully with {len(files_data)} files")
        except Exception as e:
            print(f"  Warning: Callback failed: {e}")

        update_progress(100, "Complete")
        print(f"\n{'='*60}")
        print(f"MG Inference Task Completed Successfully")
        print(f"{'='*60}\n")

        return {
            'job_id': job_id,
            'status': 'completed',
            'result': result_data,
        }

    except Exception as e:
        import traceback
        error_msg = str(e)
        error_trace = traceback.format_exc()

        print(f"\n{'='*60}")
        print(f"MG Inference Task FAILED")
        print(f"  Error: {error_msg}")
        print(f"  Traceback:\n{error_trace}")
        print(f"{'='*60}\n")

        # 에러 콜백
        try:
            resolved_callback_url = resolve_callback_url(callback_url)
            callback_data = {
                'job_id': job_id,
                'status': 'failed',
                'error_message': error_msg,
            }
            httpx.post(resolved_callback_url, json=callback_data, timeout=10.0)
        except Exception:
            pass

        raise
