# Docker 배포 설정 가이드

## 개요

`setup.py`는 Docker 배포 전 시스템 환경을 자동으로 체크하고 설정하는 스크립트입니다.

## 실행 방법

```bash
cd docker
python setup.py
```

## 기능

### 1. Docker 체크
- Docker 설치 여부 확인
- Docker Compose 설치 여부 확인
- Docker 서비스 실행 상태 확인

### 2. GPU 체크
- `nvidia-smi` 명령으로 NVIDIA GPU 감지
- CUDA 버전 확인
- NVIDIA Container Toolkit 설치 여부 확인

### 3. 포트 체크
필요한 포트 사용 가능 여부를 확인합니다:

| 포트 | 서비스 |
|------|--------|
| 8000 | Django |
| 9000 | FastAPI |
| 8042 | Orthanc HTTP |
| 8080 | OpenEMR |
| 8081 | HAPI FHIR |
| 6379 | Redis |
| 6380 | FastAPI Redis |
| 3306 | Django MySQL |
| 3308 | OpenEMR MariaDB |
| 5432 | HAPI PostgreSQL |

### 4. 환경 변수 설정 (.env)
- `.env.example`에서 `.env` 파일 자동 생성
- GPU 감지 결과에 따라 `USE_GPU=true/false` 자동 설정

### 5. Docker Compose GPU 설정
GPU가 감지되면 `docker-compose.fastapi.yml`의 GPU 섹션을 자동으로 활성화합니다:

```yaml
# 주석 해제됨
deploy:
  resources:
    reservations:
      devices:
        - driver: nvidia
          count: 1
          capabilities: [gpu]
```

## GPU 설정의 이해

Docker에서 GPU를 사용하려면 **두 가지 설정이 모두 필요**합니다:

| 설정 | 위치 | 역할 |
|------|------|------|
| `USE_GPU=true` | `.env` | PyTorch가 CUDA 사용 여부 결정 |
| `deploy.resources` | `docker-compose.fastapi.yml` | Docker 컨테이너에 GPU 장치 할당 |

### 설정 조합별 결과

| USE_GPU | deploy 섹션 | 결과 |
|---------|-------------|------|
| true | 없음 | 에러 (GPU 접근 불가) |
| false | 있음 | 낭비 (GPU 할당되나 미사용) |
| true | 있음 | 정상 작동 |
| false | 없음 | CPU 모드 정상 작동 |

## GPU 사용을 위한 사전 요구사항

1. **NVIDIA 드라이버** 설치
   ```bash
   nvidia-smi  # 정상 출력되어야 함
   ```

2. **NVIDIA Container Toolkit** 설치
   ```bash
   # Ubuntu/Debian
   apt install nvidia-container-toolkit
   systemctl restart docker
   ```

## 실행 후 다음 단계

1. `.env` 파일에서 IP 주소와 비밀번호 수정
2. Docker 실행:

   **GPU 서버 (FastAPI VM):**
   ```bash
   docker compose -f docker-compose.fastapi.yml up -d --build
   ```

   **메인 VM:**
   ```bash
   docker compose -f docker-compose.yml \
                  -f docker-compose.django.yml \
                  -f docker-compose.emr.yml up -d --build
   ```

## 문제 해결

### Docker가 설치되지 않음
https://docs.docker.com/get-docker/ 에서 설치

### NVIDIA Container Toolkit 오류
```bash
# 설치
apt install nvidia-container-toolkit

# Docker 재시작
systemctl restart docker

# 테스트
docker run --rm --gpus all nvidia/cuda:11.0-base nvidia-smi
```

### 포트 충돌
해당 포트를 사용 중인 프로세스를 종료하거나, `.env`에서 포트 번호 변경
