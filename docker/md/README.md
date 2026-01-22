# Docker Compose 구성 가이드

## 개요

이 프로젝트는 의료 영상 분석 시스템을 위한 Docker 기반 마이크로서비스 아키텍처입니다.

```
┌─────────────────────────────────────────────────────────────────┐
│                          메인 VM                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌───────────────────┐  │
│  │ Django  │  │ Orthanc │  │  Redis  │  │ OpenEMR + HAPI    │  │
│  │  :8000  │  │  :8042  │  │  :6379  │  │ FHIR :8080/:8081  │  │
│  └────┬────┘  └─────────┘  └─────────┘  └───────────────────┘  │
│       │              medical-net (Docker Bridge)                 │
└───────┼─────────────────────────────────────────────────────────┘
        │ HTTP (내부 IP)
        ▼
┌─────────────────────────────────────────────────────────────────┐
│                      FastAPI VM (별도 서버)                      │
│  ┌──────────┐  ┌──────────────┐  ┌───────────────┐              │
│  │ FastAPI  │  │ Celery       │  │ FastAPI-Redis │              │
│  │  :9000   │──│ Worker       │──│    :6380      │              │
│  └──────────┘  └──────────────┘  └───────────────┘              │
│                      fastapi-net (Docker Bridge)                 │
└─────────────────────────────────────────────────────────────────┘
```

---

## 파일 구조

```
docker/
├── docker-compose.django.yml       # Django + Orthanc + Redis + MySQL (메인 VM)
├── docker-compose.fastapi.yml      # FastAPI + Celery (⚠️ 별도 VM 배포)
├── docker-compose.emr.yml          # OpenEMR + HAPI FHIR + DBs
├── docker-compose.production.yml   # Production (Nginx 포함)
├── setup.py                        # 환경 체크 및 자동 설정 스크립트
├── .env.example                    # 환경변수 템플릿
├── .env                            # 실제 환경변수 (생성 필요)
├── orthanc/
│   └── orthanc.json                # Orthanc 설정
└── nginx/
    └── nginx.conf                  # Nginx 설정 (Production)
```

---

## 서비스 구성

| 파일 | 서비스 | 포트 | 배포 위치 |
|------|--------|------|----------|
| `docker-compose.django.yml` | django, django-db, orthanc, redis | 8000, 3306, 8042, 6379 | 메인 VM |
| `docker-compose.emr.yml` | openemr, openemr-db, hapi-fhir, hapi-db | 8080, 8081, 3308, 5432 | 메인 VM |
| `docker-compose.fastapi.yml` | fastapi, fastapi-celery, fastapi-redis | 9000, 6380 | **별도 VM** |
| `docker-compose.production.yml` | nginx + django + orthanc + redis | 80, 443, 8042 | 메인 VM |

---

## 빠른 시작

### 1단계: 환경 설정 (메인 VM)

```bash
cd docker
# cd C:\0000\brain_tumor_dev\docker

# .env 파일 생성
cp .env.example .env

# .env 파일 편집 - IP 주소와 비밀번호 수정
```

### 2단계: 메인 VM 서비스 실행

```bash
# Django + Orthanc + Redis + MySQL
docker compose -f docker-compose.django.yml up -d

# OpenEMR + HAPI FHIR (필요시)
docker compose -f docker-compose.emr.yml up -d
```

### 3단계: FastAPI VM 설정 (별도 서버)

```bash
# 1. 프로젝트 파일 복사 (docker 폴더 전체)
scp -r docker/ user@fastapi-vm:/path/to/project/

# 2. FastAPI VM에서 setup.py 실행 (필수!)
cd docker
python setup.py

# 3. .env 파일에서 MAIN_VM_IP 수정

# 4. Docker 빌드 및 실행
docker compose -f docker-compose.fastapi.yml up -d --build


```

# 컨테이너 중지 및 삭제
docker compose -f docker-compose.fastapi.yml down

# 컨테이너 재생성 (이미지 재빌드 불필요)
docker compose -f docker-compose.fastapi.yml up -d


docker compose -f docker-compose.django.yml down


docker compose -f docker-compose.django.yml up -d

---

## ⚠️ 중요: setup.py 사전 실행 (FastAPI VM)

FastAPI VM에서는 **반드시 `setup.py`를 먼저 실행**해야 합니다.

```bash
cd docker
python setup.py
```

### setup.py가 자동으로 하는 일

| 단계 | 내용 |
|------|------|
| 1 | Docker / Docker Compose 설치 확인 |
| 2 | **GPU 자동 감지** (nvidia-smi 실행) |
| 3 | 포트 사용 가능 여부 확인 |
| 4 | `.env` 파일 생성 및 **USE_GPU 자동 설정** |
| 5 | `docker-compose.fastapi.yml` GPU 설정 자동 활성화 |

### 실행 결과 예시

```
============================================================
   Brain Tumor CDSS - Docker 배포 설정
============================================================

============================================================
  1. Docker 체크
============================================================
  ✓ Docker - Docker version 24.0.7
  ✓ Docker Compose - Docker Compose version v2.21.0
  ✓ Docker 서비스 실행 중

============================================================
  2. GPU 체크
============================================================
  ✓ GPU 감지됨 - NVIDIA RTX 4090
  ✓ CUDA Version - 12.1
  ✓ NVIDIA Container Toolkit - Docker GPU 지원 확인됨

============================================================
  4. 환경 변수 설정
============================================================
  ✓ .env 파일 존재
  ✓ USE_GPU=true - 자동 설정됨
  ! MAIN_VM_IP 설정 필요 - 실제 IP로 변경하세요

============================================================
  설정 완료
============================================================

  ✓ 설정 완료!

  다음 단계:
  1. .env 파일에서 IP 주소와 비밀번호를 수정하세요
  2. 아래 명령어로 Docker를 실행하세요:

     # FastAPI VM (GPU)
     docker compose -f docker-compose.fastapi.yml up -d --build
```

---

## ⚠️ 중요: VM 간 통신 설정 (MAIN_VM_IP)

FastAPI는 별도의 VM에서 실행되므로, 메인 VM의 서비스에 접근하기 위해 **IP 주소 설정이 필수**입니다.

### 설정 방법

1. **메인 VM의 IP 주소 확인**
   ```bash
   # Linux
   ip addr show | grep "inet "

   # Windows
   ipconfig
   ```

2. **FastAPI VM의 `.env` 파일에 IP 설정**
   ```env
   # ⚠️ 반드시 실제 메인 VM IP로 변경!
   MAIN_VM_IP=192.168.1.100
   ```

3. **메인 VM의 `.env` 파일에 FastAPI URL 설정**
   ```env
   # ⚠️ 반드시 실제 FastAPI VM IP로 변경!
   FASTAPI_URL=http://192.168.1.200:9000
   ```








### 통신 흐름

```
┌─────────────────┐                      ┌─────────────────┐
│    메인 VM      │                      │   FastAPI VM    │
│  192.168.1.100  │                      │  192.168.1.200  │
├─────────────────┤                      ├─────────────────┤
│                 │   HTTP Request       │                 │
│  Django :8000   │ ──────────────────►  │  FastAPI :9000  │
│                 │   (AI 분석 요청)      │                 │
│                 │                      │                 │
│                 │   HTTP Response      │                 │
│                 │ ◄──────────────────  │  Celery Worker  │
│                 │   (분석 결과)         │                 │
│                 │                      │                 │
│  Orthanc :8042  │ ◄──────────────────  │                 │
│                 │   (DICOM 조회)        │                 │
└─────────────────┘                      └─────────────────┘
```

### 체크리스트

- [ ] 메인 VM과 FastAPI VM이 같은 네트워크에 있는지 확인
- [ ] 방화벽에서 필요한 포트 개방 (8000, 9000, 8042, 8080, 8081)
- [ ] FastAPI VM의 `.env`에 `MAIN_VM_IP` 설정 완료
- [ ] 메인 VM의 `.env`에 `FASTAPI_URL` 설정 완료
- [ ] `ping` 명령으로 VM 간 통신 테스트

---

## 서비스별 실행 명령어

### 메인 VM

```bash
cd docker

# Django + Orthanc + Redis + MySQL
docker compose -f docker-compose.django.yml up -d

# OpenEMR + HAPI FHIR (필요시)
docker compose -f docker-compose.emr.yml up -d

# Production (Nginx 포함)
docker compose -f docker-compose.production.yml up -d --build
```

### FastAPI VM (별도 서버)

```bash
cd docker

# 1. 환경 체크 및 자동 설정 (필수!)
python setup.py

# 2. .env 파일에서 MAIN_VM_IP 수정

# 3. 빌드 및 실행
docker compose -f docker-compose.fastapi.yml up -d --build
```

---

## 서비스 관리

### 로그 확인

```bash
# 메인 VM
docker compose -f docker-compose.django.yml logs -f django
docker compose -f docker-compose.django.yml logs -f orthanc
docker compose -f docker-compose.emr.yml logs -f openemr

# FastAPI VM
docker compose -f docker-compose.fastapi.yml logs -f fastapi
docker compose -f docker-compose.fastapi.yml logs -f fastapi-celery
```

### 서비스 재시작

```bash
# 메인 VM - Django만 재시작
docker compose -f docker-compose.django.yml restart django

# FastAPI VM - FastAPI만 재시작
docker compose -f docker-compose.fastapi.yml restart fastapi
```

### 서비스 중지

```bash
# 메인 VM
docker compose -f docker-compose.django.yml down
docker compose -f docker-compose.emr.yml down

# FastAPI VM
docker compose -f docker-compose.fastapi.yml down
```

### 서비스 상태 확인

```bash
# 메인 VM
docker compose -f docker-compose.django.yml ps
docker compose -f docker-compose.emr.yml ps

# FastAPI VM
docker compose -f docker-compose.fastapi.yml ps
```

---

## 데이터 볼륨

### 메인 VM

| 볼륨 | 용도 |
|------|------|
| `redis_data` | Redis 영속 데이터 |
| `orthanc_data` | DICOM 이미지 저장 |
| `django_db_data` | Django MySQL 데이터 |
| `django_static` | Django 정적 파일 |
| `django_media` | Django 미디어 파일 |
| `openemr_sites` | OpenEMR 사이트 데이터 |
| `openemr_db_data` | OpenEMR MariaDB 데이터 |
| `hapi_db_data` | HAPI FHIR PostgreSQL 데이터 |

### FastAPI VM

| 볼륨 | 용도 |
|------|------|
| `fastapi_models` | AI 모델 파일 |
| `fastapi_temp` | 임시 처리 파일 |
| `fastapi_redis_data` | Celery 브로커 데이터 |

---

## 문제 해결

### Docker 서비스 연결 실패

```bash
# 네트워크 확인
docker network ls
docker network inspect medical-net

# 컨테이너 IP 확인
docker inspect nn-django | grep IPAddress
```

### VM 간 통신 불가

1. **방화벽 확인**
   ```bash
   # Linux
   sudo ufw status
   sudo ufw allow 9000/tcp

   # Windows
   netsh advfirewall firewall show rule name=all
   ```

2. **IP 설정 확인**
   ```bash
   # FastAPI VM에서 메인 VM 접근 테스트
   curl http://${MAIN_VM_IP}:8042/system
   ```

### GPU 인식 안 됨 (FastAPI VM)

```bash
# 1. NVIDIA 드라이버 확인
nvidia-smi

# 2. NVIDIA Container Toolkit 설치
sudo apt install nvidia-container-toolkit
sudo systemctl restart docker

# 3. setup.py 다시 실행
python setup.py

# 4. 이미지 재빌드
docker compose -f docker-compose.fastapi.yml up -d --build
```

### 데이터베이스 연결 실패

```bash
# DB 컨테이너 로그 확인
docker logs nn-django-db

# DB 직접 접속 테스트
docker exec -it nn-django-db mysql -u root -p
```

---

## 백업 및 복원

### 볼륨 백업

```bash
# Django DB 백업
docker exec nn-django-db mysqldump -u root -p brain_tumor > backup.sql

# 볼륨 전체 백업
docker run --rm -v django_db_data:/data -v $(pwd):/backup \
    alpine tar czf /backup/django_db_backup.tar.gz /data
```

### 볼륨 복원

```bash
docker run --rm -v django_db_data:/data -v $(pwd):/backup \
    alpine tar xzf /backup/django_db_backup.tar.gz -C /
```

---

## 배포 체크리스트

### 메인 VM

- [ ] `.env` 파일 생성 및 설정
- [ ] `FASTAPI_URL` 설정 (FastAPI VM IP)
- [ ] `docker-compose.django.yml` 실행
- [ ] `docker-compose.emr.yml` 실행 (필요시)
- [ ] 방화벽 포트 개방 (8000, 8042, 6379)

### FastAPI VM

- [ ] 프로젝트 파일 복사
- [ ] **`python setup.py` 실행** (필수!)
- [ ] `docker/.env` 파일에서 `MAIN_VM_IP` 설정
- [ ] **`modAI/.env` 파일에서 `MAIN_VM_IP` 설정** (⚠️ 중요!)
- [ ] `docker-compose.fastapi.yml` 빌드 및 실행
- [ ] 방화벽 포트 개방
- [ ] 메인 VM과 통신 테스트

---

## ⚠️ 중요: modAI/.env 설정 (FastAPI VM)

FastAPI VM에서 M1/MG/MM 모델 추론 시 메인 VM의 Orthanc/Django 서버에 접근하기 위해 **`modAI/.env` 파일 설정이 필수**입니다.

### 설정 방법

```bash
# FastAPI VM에서 modAI/.env 파일 편집
nano modAI/.env
```

```env
# ⚠️ VM 배포 시 반드시 메인 VM IP로 변경!
MAIN_VM_IP=192.168.0.11

# 아래는 MAIN_VM_IP 기반으로 자동 생성됨 (주석 유지 권장)
# ORTHANC_URL=http://192.168.0.11:8042
# DJANGO_URL=http://192.168.0.11:8000
```

### 설정 원리

`modAI/config.py`에서 `MAIN_VM_IP`를 기반으로 URL을 자동 생성합니다:
- `ORTHANC_URL` 환경변수가 없으면 → `http://{MAIN_VM_IP}:8042`
- `DJANGO_URL` 환경변수가 없으면 → `http://{MAIN_VM_IP}:8000`

### 설정 후 재시작

```bash
# 환경변수 변경 후 컨테이너 재시작 필요
docker compose -f docker-compose.fastapi.yml restart
```

---

## WebSocket 설정

Django는 **Daphne ASGI 서버**를 사용하여 HTTP와 WebSocket을 모두 처리합니다.

### WebSocket 엔드포인트

| 경로 | Consumer | 용도 |
|------|----------|------|
| `ws/permissions/` | PermissionConsumer | 권한 실시간 알림 |
| `ws/user-permissions/` | UserPermissionConsumer | 사용자 권한 알림 |
| `ws/presence/` | PresenceConsumer | 온라인 상태 |
| `ws/ocs/` | OCSConsumer | OCS 실시간 업데이트 |
| `ws/ai-inference/` | AIInferenceConsumer | AI 추론 진행 상태 |

### 아키텍처

```
┌─────────────────────────────────────────────────────────────┐
│                      Django (Daphne)                         │
│                         :8000                                │
├─────────────────────────────────────────────────────────────┤
│  ┌─────────────┐     ┌─────────────────────────────────┐   │
│  │    HTTP     │     │          WebSocket               │   │
│  │  Requests   │     │   ws://host:8000/ws/...          │   │
│  └──────┬──────┘     └──────────────┬──────────────────┘   │
│         │                           │                       │
│         ▼                           ▼                       │
│  ┌─────────────┐     ┌─────────────────────────────────┐   │
│  │   Django    │     │   Django Channels (Consumers)    │   │
│  │   Views     │     │   - PermissionConsumer           │   │
│  │             │     │   - OCSConsumer                  │   │
│  │             │     │   - AIInferenceConsumer          │   │
│  └──────┬──────┘     └──────────────┬──────────────────┘   │
│         │                           │                       │
│         └───────────────┬───────────┘                       │
│                         ▼                                   │
│               ┌─────────────────┐                           │
│               │  Redis          │                           │
│               │  Channel Layer  │                           │
│               │    :6379        │                           │
│               └─────────────────┘                           │
└─────────────────────────────────────────────────────────────┘
```

### 설정 파일

| 파일 | 용도 |
|------|------|
| `config/asgi.py` | ASGI 애플리케이션 진입점 |
| `config/routing.py` | WebSocket URL 라우팅 |
| `config/base.py` | CHANNEL_LAYERS (Redis) 설정 |
| `apps/*/consumers.py` | WebSocket Consumer 구현 |

### WebSocket 연결 테스트

```javascript
// 브라우저 콘솔에서 테스트
const ws = new WebSocket('ws://192.168.0.11:8000/ws/ai-inference/');
ws.onopen = () => console.log('Connected');
ws.onmessage = (e) => console.log('Message:', e.data);
ws.onclose = () => console.log('Disconnected');
```

---

## Nginx + Cloudflare 설정 (Production)

### Nginx 역할

`docker-compose.production.yml` 사용 시 Nginx가 리버스 프록시로 동작합니다.

```
┌───────────────┐     ┌──────────┐     ┌──────────────────────┐
│  Cloudflare   │────►│  Nginx   │────►│  Django (Daphne)     │
│  (CDN/SSL)    │     │  :80/443 │     │  :8000               │
└───────────────┘     └────┬─────┘     └──────────────────────┘
                           │
                           ├──────────►  React Frontend (정적 파일)
                           │
                           └──────────►  Orthanc (:8042)
```

### Nginx 주요 설정

| 경로 | 대상 | 설명 |
|------|------|------|
| `/` | React SPA | 정적 파일 서빙 |
| `/api/` | Django | REST API 프록시 |
| `/ws/` | Django | **WebSocket 프록시** |
| `/admin/` | Django | 관리자 페이지 |
| `/orthanc/` | Orthanc | DICOM 뷰어 |
| `/ai/` | FastAPI | AI 추론 (같은 호스트일 때) |

### WebSocket Nginx 설정 (중요!)

`nginx/nginx.conf`에서 WebSocket 프록시 설정:

```nginx
location /ws/ {
    proxy_pass http://django_backend;
    proxy_http_version 1.1;
    proxy_set_header Upgrade $http_upgrade;
    proxy_set_header Connection "upgrade";
    proxy_set_header Host $host;

    # WebSocket 타임아웃 (7일)
    proxy_connect_timeout 7d;
    proxy_send_timeout 7d;
    proxy_read_timeout 7d;
}
```

### Cloudflare 설정 (WebSocket 사용 시)

Cloudflare를 사용할 경우 **WebSocket 지원을 활성화**해야 합니다:

1. **Cloudflare Dashboard** → Network → WebSockets → **On**

2. **SSL/TLS 모드**: Full (strict) 권장

3. **프록시 상태**:
   - 일반 트래픽: Proxied (주황색 구름)
   - WebSocket 문제 시: DNS only (회색 구름)로 테스트

### Cloudflare + WebSocket 문제 해결

WebSocket 연결이 안 될 경우:

```bash
# 1. Cloudflare 우회 테스트 (직접 IP 접속)
wscat -c ws://192.168.0.11:8000/ws/ai-inference/

# 2. Nginx 로그 확인
docker logs nn-nginx --tail 50

# 3. Django 로그 확인
docker logs nn-django --tail 50
```

### Production 배포 명령어

```bash
# 1. 프론트엔드 빌드
cd ../brain_tumor_front
npm run build

# 2. 빌드 결과물 복사
cp -r dist/* ../docker/nginx/html/

# 3. Production 스택 실행
cd ../docker
docker compose -f docker-compose.production.yml up -d --build
```
