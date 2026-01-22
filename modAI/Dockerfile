# =============================================================
# Dockerfile - FastAPI + Celery (modAI)
# =============================================================
# 빌드 전 setup.py를 실행하면 GPU/CPU가 자동 설정됩니다.
#
# 사용법:
#   cd docker
#   python setup.py          # 환경 체크 및 .env 자동 설정
#   docker compose -f docker-compose.fastapi.yml up -d --build
# =============================================================

FROM python:3.11-slim

# Build argument: GPU 사용 여부 (.env의 USE_GPU 값 사용)
ARG USE_GPU=false

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1
ENV PYTHONUNBUFFERED=1
ENV PYTHONPATH=/app

# Set work directory
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y --no-install-recommends \
    build-essential \
    curl \
    git \
    && rm -rf /var/lib/apt/lists/*

# Install PyTorch (GPU/CPU 선택 - setup.py가 USE_GPU 자동 설정)
RUN if [ "$USE_GPU" = "true" ]; then \
        echo "========================================" && \
        echo "  Installing PyTorch with CUDA 12.1" && \
        echo "========================================" && \
        pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cu121; \
    else \
        echo "========================================" && \
        echo "  Installing PyTorch CPU version" && \
        echo "========================================" && \
        pip install --no-cache-dir torch torchvision --index-url https://download.pytorch.org/whl/cpu; \
    fi

# Install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir --upgrade pip && \
    pip install --no-cache-dir -r requirements.txt

# Copy project files
COPY . .

# Create directories for models and temp files
RUN mkdir -p /app/models /app/temp

# Expose port
EXPOSE 9000

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:9000/health || exit 1

# Default: Run FastAPI with Uvicorn
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "9000"]
