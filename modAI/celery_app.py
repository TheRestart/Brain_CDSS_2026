"""
Celery Application Configuration
"""
from celery import Celery
from config import settings

celery_app = Celery(
    'modai_tasks',
    broker=settings.CELERY_BROKER_URL or settings.REDIS_URL,
    backend=settings.CELERY_RESULT_BACKEND or settings.REDIS_URL,
    include=['tasks.m1_tasks', 'tasks.mg_tasks', 'tasks.mm_tasks']
)

celery_app.conf.update(
    # Serialization
    task_serializer='json',
    accept_content=['json'],
    result_serializer='json',

    # Timezone
    timezone='Asia/Seoul',
    enable_utc=True,

    # Worker settings
    worker_prefetch_multiplier=1,  # 메모리 최적화
    worker_max_tasks_per_child=5,  # 메모리 누수 방지 (GPU 모델 로드 때문에 낮게 설정)
    result_expires=3600,  # 1시간 후 결과 만료

    # Task settings
    task_acks_late=True,  # 작업 완료 후 ACK
    task_reject_on_worker_lost=True,  # 워커 손실 시 재시도
    task_track_started=True,  # 시작 상태 추적

    # Result settings
    result_extended=True,  # 확장 결과 정보

    # Retry settings
    task_default_retry_delay=60,  # 기본 재시도 지연 (초)
    task_max_retries=3,  # 최대 재시도 횟수

    # Task routing - 태스크를 적절한 큐로 라우팅
    task_routes={
        'tasks.m1_tasks.run_m1_inference': {'queue': 'm1_queue'},
        'tasks.mg_tasks.run_mg_inference': {'queue': 'mg_queue'},
        'tasks.mm_tasks.*': {'queue': 'mm_queue'},
    },
)


# Celery 실행 명령:
# Windows: celery -A celery_app worker --loglevel=info --pool=solo
# Linux/Mac: celery -A celery_app worker --loglevel=info
