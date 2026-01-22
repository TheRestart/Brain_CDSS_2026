# FastAPI 모델 로딩 및 PyTorch 설치 프로세스

## 1. 모델 추론 방식: MONAI + PyTorch

FastAPI에서 모델은 **MONAI와 PyTorch**를 함께 사용합니다.

### M1 모델 (MRI 기반 분류 + 세그멘테이션)

**파일 위치:** `modAI/services/m1_service.py`

```python
from monai.networks.nets import SwinUNETR

self.model = SwinUNETR(
    in_channels=4,      # T1, T1CE, T2, FLAIR
    out_channels=4,
    feature_size=48,
    spatial_dims=3
)
```

- MONAI의 SwinUNETR 3D 의료영상 신경망 사용
- 멀티태스크: Grade, IDH, MGMT, Survival 동시 예측
- 768-dim 인코더 피처 추출

### MG 모델 (유전자 발현 기반)

**파일 위치:** `modAI/services/mg_service.py`

```python
# 프로젝트 내부에 직접 정의된 커스텀 클래스들 (외부 라이브러리 아님)
class Gene2VecEncoder(nn.Module):    # Line 207 - 유전자 임베딩 인코더
class DEGEncoder(nn.Module):          # Line 238 - DEG 클러스터 인코더
class GeneExpressionCDSS(nn.Module):  # Line 254 - 통합 모델

# 모델 로딩
self.model = self._create_model(gene_embeddings)  # 순수 PyTorch
self.model.load_state_dict(checkpoint['model_state_dict'])
```

- **커스텀 모델**: Gene2VecEncoder, DEGEncoder는 외부 라이브러리가 아닌 프로젝트 내부에 직접 구현
- 순수 PyTorch 기반 (nn.Module 상속)

### M1 vs MG 모델 출처 비교

| 모델 | 출처 | Import 방식 |
|------|------|-------------|
| **SwinUNETR** | MONAI 라이브러리 | `from monai.networks.nets import SwinUNETR` |
| **Gene2VecEncoder** | 프로젝트 내부 정의 | `mg_service.py` 내부 class 정의 |
| **DEGEncoder** | 프로젝트 내부 정의 | `mg_service.py` 내부 class 정의 |
| **GeneExpressionCDSS** | 프로젝트 내부 정의 | `mg_service.py` 내부 class 정의 |

> **참고:** SwinUNETR은 의료영상 분야에서 널리 사용되는 표준 아키텍처라 MONAI가 제공하지만,
> Gene2Vec 관련 클래스들은 우리 프로젝트의 유전자 발현 데이터에 특화된 커스텀 모델이라 직접 구현했습니다.

---

## 2. PyTorch 설치 프로세스

### requirements.txt에 PyTorch가 없는 이유

GPU/CPU 버전이 다르기 때문에 별도 스크립트로 설치합니다.

```
# requirements.txt 설치 순서:
# 1. python install_pytorch.py  (GPU/CPU 감지 후 설치)
# 2. pip install -r requirements.txt
```

---

## 3. 로컬 개발 환경: install_pytorch.py

**파일 위치:** `modAI/install_pytorch.py`

### 설치 프로세스

```
┌──────────────────────────────────────────────────┐
│  python modAI/install_pytorch.py                 │
├──────────────────────────────────────────────────┤
│  1. nvidia-smi 실행 → CUDA 버전 감지             │
│     └─ "CUDA Version: 12.6" 파싱                 │
│                                                  │
│  2. CUDA 버전에 맞는 인덱스 선택                 │
│     ├─ 12.6 → cu126                              │
│     ├─ 12.4 → cu124                              │
│     ├─ 12.1 → cu121                              │
│     ├─ 11.8 → cu118                              │
│     └─ 없음 → CPU (PyPI 기본)                    │
│                                                  │
│  3. 기존 PyTorch 제거                            │
│     └─ pip uninstall torch torchvision           │
│                                                  │
│  4. 새 버전 설치                                 │
│     └─ pip install torch --index-url <URL>       │
└──────────────────────────────────────────────────┘
```

### CUDA 인덱스 매핑

```python
CUDA_INDEX_MAP = {
    "12.6": "https://download.pytorch.org/whl/cu126",
    "12.4": "https://download.pytorch.org/whl/cu124",
    "12.1": "https://download.pytorch.org/whl/cu121",
    "11.8": "https://download.pytorch.org/whl/cu118",
}
```

### GPU 감지 로직

- CUDA 12.6+ → cu126 우선, cu124, cu121 순 하위 호환
- CUDA 12.1~12.5 → cu124 또는 cu121
- CUDA 11.8+ → cu118
- CUDA 없음 → CPU 버전 (PyPI 기본)

---

## 4. Docker 빌드: setup.py + Dockerfile

### 4.1 1단계: docker/setup.py 실행

**파일 위치:** `docker/setup.py`

```python
# nvidia-smi로 GPU 감지
cuda_version = check_gpu()

# .env 파일에 설정
USE_GPU = "true" if cuda_version else "false"

# docker-compose.yml에 GPU deploy 설정 추가
if enable_gpu:
    services['fastapi']['deploy'] = {
        'resources': {
            'reservations': {
                'devices': [{'driver': 'nvidia', 'count': 1, 'capabilities': ['gpu']}]
            }
        }
    }
```

### 4.2 2단계: Docker 빌드 시 (Dockerfile)

**파일 위치:** `modAI/Dockerfile`

```dockerfile
ARG USE_GPU=false

# GPU/CPU 분기 설치
RUN if [ "$USE_GPU" = "true" ]; then \
        echo "Installing PyTorch with CUDA 12.1" && \
        pip install --no-cache-dir torch torchvision \
            --index-url https://download.pytorch.org/whl/cu121; \
    else \
        echo "Installing PyTorch CPU version" && \
        pip install --no-cache-dir torch torchvision \
            --index-url https://download.pytorch.org/whl/cpu; \
    fi
```

---

## 5. 전체 설치 흐름도

```
┌────────────────────────────────────────────────────────────────┐
│                    Docker 배포 프로세스                         │
└────────────────────────────────────────────────────────────────┘

  [1] python docker/setup.py
       │
       ├─→ nvidia-smi 실행
       │     ↓
       ├─→ GPU 존재? ────────────────────────────────┐
       │     │                                       │
       │    YES                                     NO
       │     ↓                                       ↓
       ├─→ .env: USE_GPU=true              .env: USE_GPU=false
       │     ↓                                       │
       └─→ docker-compose.yml에                      │
           GPU deploy 설정 추가                      │
                    │                                │
                    └────────────┬───────────────────┘
                                 ↓
  [2] docker compose -f docker-compose.unified.yml up -d --build
                                 │
                                 ↓
       ┌─────────────────────────────────────────────┐
       │           Dockerfile 빌드                   │
       ├─────────────────────────────────────────────┤
       │  ARG USE_GPU=${USE_GPU}                     │
       │                                             │
       │  if USE_GPU=true:                           │
       │    pip install torch --index-url .../cu121  │
       │  else:                                      │
       │    pip install torch --index-url .../cpu    │
       │                                             │
       │  pip install -r requirements.txt            │
       └─────────────────────────────────────────────┘
                                 │
                                 ↓
  [3] 컨테이너 시작 (main.py)
       │
       ├─→ settings.DEVICE == "auto"
       │     ↓
       ├─→ torch.cuda.is_available()
       │     │
       │    True                      False
       │     ↓                          ↓
       └─→ device = "cuda"         device = "cpu"
```

---

## 6. 런타임 Device 설정

### main.py (FastAPI 시작 시)

**파일 위치:** `modAI/main.py`

```python
# Device 자동 감지 (startup 시)
if settings.DEVICE == "auto":
    device = "cuda" if torch.cuda.is_available() else "cpu"
else:
    device = settings.DEVICE

models["device"] = device
```

### config.py

**파일 위치:** `modAI/config.py`

```python
def get_device():
    """사용 가능한 최적의 device 반환"""
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
    DEVICE: str = "auto"  # auto, cuda, cpu
```

---

## 7. 핵심 파일 역할

| 파일 | 경로 | 역할 |
|------|------|------|
| install_pytorch.py | `modAI/install_pytorch.py` | 로컬에서 GPU/CPU 자동 감지 후 PyTorch 설치 |
| setup.py | `docker/setup.py` | Docker 빌드 전 GPU 감지, `.env` 및 compose 설정 |
| Dockerfile | `modAI/Dockerfile` | `USE_GPU` ARG로 분기하여 PyTorch 설치 |
| requirements.txt | `modAI/requirements.txt` | MONAI, FastAPI 등 (PyTorch 제외) |
| config.py | `modAI/config.py` | 런타임에 `torch.cuda.is_available()` 확인 |
| main.py | `modAI/main.py` | FastAPI 서버 시작, device 설정 |
| m1_service.py | `modAI/services/m1_service.py` | M1 모델 서비스 (MONAI SwinUNETR) |
| mg_service.py | `modAI/services/mg_service.py` | MG 모델 서비스 (Gene2Vec) |

---

## 8. 사용법 요약

### 로컬 개발 환경

```bash
# 1. PyTorch 설치 (GPU/CPU 자동 감지)
python modAI/install_pytorch.py

# 2. 나머지 의존성 설치
pip install -r modAI/requirements.txt

# 3. FastAPI 서버 실행
cd modAI
uvicorn main:app --host 0.0.0.0 --port 9000
```

### Docker 배포

```bash
# 1. GPU 감지 및 설정
cd docker/
python setup.py

# 2. Docker Compose 빌드 및 실행
docker compose -f docker-compose.unified.yml up -d --build
```

---

## 9. 요약

1. **모델 추론**: MONAI의 SwinUNETR (PyTorch 기반) 사용
2. **PyTorch 미포함 이유**: GPU/CPU 버전이 달라서 별도 설치 필요
3. **설치 방식**:
   - 로컬: `install_pytorch.py`가 nvidia-smi로 CUDA 감지 후 자동 설치
   - Docker: `setup.py`가 GPU 감지 → `.env`에 `USE_GPU` 설정 → Dockerfile에서 분기 설치
4. **런타임 확인**: `torch.cuda.is_available()`로 device 자동 선택
