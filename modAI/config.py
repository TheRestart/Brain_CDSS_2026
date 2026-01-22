"""
modAI Configuration
"""
import os
import logging
from pathlib import Path
from pydantic_settings import BaseSettings

logger = logging.getLogger(__name__)


def get_device():
    """
    사용 가능한 최적의 device 반환

    우선순위: CUDA GPU > CPU
    """
    import torch

    if torch.cuda.is_available():
        device = "cuda"
        gpu_name = torch.cuda.get_device_name(0)
        logger.info(f"GPU 사용: {gpu_name}")
    else:
        device = "cpu"
        logger.info("CPU 사용 (GPU 없음)")

    return device


class Settings(BaseSettings):
    """modAI 서버 설정"""

    # Server
    HOST: str = "0.0.0.0"
    PORT: int = 9000
    DEBUG: bool = False

    # VM Communication (배포 시 메인 VM IP로 설정)
    MAIN_VM_IP: str = "localhost"

    # Orthanc DICOM Server (ORTHANC_URL 환경변수가 없으면 MAIN_VM_IP 사용)
    ORTHANC_URL: str = ""
    ORTHANC_USER: str = "orthanc"
    ORTHANC_PASSWORD: str = "orthanc"

    # Redis (for Celery)
    REDIS_URL: str = "redis://localhost:6379/0"
    # Celery Broker/Backend (Docker에서 별도 DB 번호 사용 가능)
    CELERY_BROKER_URL: str = ""  # 비어있으면 REDIS_URL 사용
    CELERY_RESULT_BACKEND: str = ""  # 비어있으면 REDIS_URL 사용

    # Django callback URL (DJANGO_URL 환경변수가 없으면 MAIN_VM_IP 사용)
    DJANGO_URL: str = ""

    def model_post_init(self, __context):
        """환경변수가 없으면 MAIN_VM_IP 기반으로 URL 생성"""
        if not self.ORTHANC_URL:
            object.__setattr__(self, 'ORTHANC_URL', f"http://{self.MAIN_VM_IP}:8042")
        if not self.DJANGO_URL:
            object.__setattr__(self, 'DJANGO_URL', f"http://{self.MAIN_VM_IP}:8000")

    # Storage paths
    BASE_DIR: Path = Path(__file__).parent
    MODEL_DIR: Path = Path(os.environ.get("MODEL_DIR", str(BASE_DIR / "model")))
    # STORAGE_DIR: 환경변수 우선, 없으면 로컬 경로 사용
    # Docker: /app/CDSS_STORAGE/AI, Local: brain_tumor_dev/CDSS_STORAGE/AI
    # BASE_DIR = modAI/, BASE_DIR.parent = brain_tumor_dev/
    STORAGE_DIR: Path = Path(os.environ.get(
        "STORAGE_DIR",
        str(BASE_DIR.parent / "CDSS_STORAGE" / "AI")
    ))

    # Model weights
    M1_WEIGHTS_PATH: Path = Path(os.environ.get(
        "M1_WEIGHTS_PATH",
        str(Path(os.environ.get("MODEL_DIR", str(BASE_DIR / "model"))) / "M1_Cls_best.pth")
    ))
    M1_SEG_WEIGHTS_PATH: Path = Path(os.environ.get(
        "M1_SEG_WEIGHTS_PATH",
        str(Path(os.environ.get("MODEL_DIR", str(BASE_DIR / "model"))) / "M1_Seg_separate_best.pth")
    ))

    # Device
    DEVICE: str = "auto"  # auto, cuda, cpu

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        extra = "ignore"


settings = Settings()

# Ensure directories exist
settings.STORAGE_DIR.mkdir(parents=True, exist_ok=True)
