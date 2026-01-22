"""
modAI - Brain Tumor CDSS AI Server

FastAPI server for M1/MG/MM model inference
Port: 9000
"""
import os

# OpenMP 중복 라이브러리 허용 (PyTorch 관련)
os.environ['KMP_DUPLICATE_LIB_OK'] = 'TRUE'

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager
import torch

from config import settings


# 전역 모델 저장소
models = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 초기화/정리"""
    print("=" * 60)
    print("modAI - Brain Tumor CDSS AI Server")
    print("=" * 60)

    # Device 설정
    if settings.DEVICE == "auto":
        device = "cuda" if torch.cuda.is_available() else "cpu"
    else:
        device = settings.DEVICE

    models["device"] = device
    models["loaded"] = False

    print(f"  Device: {device}")
    print(f"  Model directory: {settings.MODEL_DIR}")
    print(f"  Storage directory: {settings.STORAGE_DIR}")
    print(f"  Orthanc URL: {settings.ORTHANC_URL}")
    print(f"  Redis URL: {settings.REDIS_URL}")
    print("=" * 60)
    print(f"Server starting on http://{settings.HOST}:{settings.PORT}")
    print("=" * 60)

    yield

    # Cleanup
    print("Shutting down modAI server...")
    models.clear()
    if torch.cuda.is_available():
        torch.cuda.empty_cache()


app = FastAPI(
    title="modAI - Brain Tumor CDSS AI Server",
    description="M1/MG/MM 모델 추론 서버",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS 설정 - 환경변수에서 MAIN_VM_IP 가져오기
main_vm_ip = os.getenv('MAIN_VM_IP', '')
cors_origins = [
    "http://localhost:8000",  # Django
    "http://localhost:5173",  # React (Vite)
    "http://localhost:3000",  # React (CRA)
]
if main_vm_ip:
    cors_origins.extend([
        f"http://{main_vm_ip}:8000",  # Django on Main VM
        f"http://{main_vm_ip}:5173",  # React (Vite) on Main VM
        f"http://{main_vm_ip}:3000",  # React (CRA) on Main VM
    ])

app.add_middleware(
    CORSMiddleware,
    allow_origins=cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# Routers
from routers import m1_router, mg_router, mm_router
app.include_router(m1_router.router, prefix="/api/v1/m1", tags=["M1 Model"])
app.include_router(mg_router.router, prefix="/api/v1/mg", tags=["MG Model"])
app.include_router(mm_router.router, prefix="/api/v1/mm", tags=["MM Model"])


@app.get("/")
async def root():
    """서버 정보"""
    return {
        "name": "modAI - Brain Tumor CDSS AI Server",
        "version": "1.0.0",
        "device": models.get("device", "unknown"),
        "models_loaded": models.get("loaded", False),
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {
        "status": "healthy",
        "device": models.get("device", "unknown"),
    }


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host=settings.HOST,
        port=settings.PORT,
        reload=settings.DEBUG,
    )
