# Docker 서비스 아키텍처 문서

## 개요

Brain Tumor CDSS 시스템의 Docker 기반 서비스 아키텍처를 설명합니다.

---

## 서비스 구성도

```
┌─────────────────────────────────────────────────────────────────┐
│                        클라이언트 (Browser)                       │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌─────────────────────────────────────────────────────────────────┐
│                     Nginx (nn-nginx) :80                         │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │  - React 정적 파일 서빙 (/usr/share/nginx/html)          │    │
│  │  - /api/* → Django 프록시                                │    │
│  │  - /admin/* → Django 프록시                              │    │
│  │  - /ws/* → Django WebSocket 프록시                       │    │
│  └─────────────────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────────────────┘
                                 │
                                 ▼
┌──────────────────────────────────────────────────────────────────┐
│                    Django (nn-django) :8000                       │
│  ┌────────────────────────────────────────────────────────────┐  │
│  │  - REST API                                                │  │
│  │  - 인증/권한 관리                                           │  │
│  │  - 비즈니스 로직                                            │  │
│  │  - AI 추론 요청 프록시 (→ FastAPI)                          │  │
│  │  - Orthanc 프록시 (/api/orthanc/* → Orthanc)               │  │
│  └────────────────────────────────────────────────────────────┘  │
└──────────────────────────────────────────────────────────────────┘
         │                                    │
         │                                    │
         ▼                                    ▼
┌──────────────────────────┐  ┌──────────────────────────────────┐
│  MySQL (nn-django-db)    │  │    FastAPI (nn-fastapi) :9000    │
│       :3306              │  │  ┌────────────────────────────┐  │
└──────────────────────────┘  │  │  - AI 모델 추론 API        │  │
                              │  │  - M1, MG, MM 모델         │  │
                              │  └────────────────────────────┘  │
                              └──────────────────────────────────┘
                                             │
                                             ▼
                              ┌──────────────────────────────────┐
                              │    Celery (nn-fastapi-celery)    │
                              │  - 비동기 AI 추론 작업            │
                              │  - GPU 연산 처리                 │
                              └──────────────────────────────────┘
                                             │
                              ┌──────────────┴──────────────┐
                              ▼                             ▼
               ┌──────────────────────────┐  ┌──────────────────────────┐
               │  Redis (nn-redis) :6379  │  │ Orthanc (nn-orthanc)     │
               │  - DB 0: Django Cache    │  │         :8042            │
               │  - DB 1: Celery Broker   │  │  - DICOM/PACS Server     │
               │  - DB 2: Celery Backend  │  │  - 의료 영상 저장소       │
               └──────────────────────────┘  └──────────────────────────┘
```

---

## 핵심 설계 원칙

### 1. Nginx → FastAPI 직접 접근 불가

```
❌ Nginx → FastAPI (직접 접근 불가)
✅ Nginx → Django → FastAPI (Django를 통한 프록시)
```

**이유:**
- Django에서 인증/권한 검증 후 FastAPI 호출
- API 요청 로깅 및 감사(Audit) 기능
- 단일 진입점으로 보안 강화

### 2. Django의 FastAPI 프록시

Django `ai_inference` 앱에서 FastAPI를 호출합니다:

```python
# brain_tumor_back/apps/ai_inference/views.py
FASTAPI_URL = os.getenv("FASTAPI_URL", "http://localhost:9000")

# M1 모델 추론
requests.post(f"{FASTAPI_URL}/api/v1/m1/inference", ...)

# MG 모델 추론
requests.post(f"{FASTAPI_URL}/api/v1/mg/inference", ...)

# MM 모델 추론
requests.post(f"{FASTAPI_URL}/api/v1/mm/inference", ...)
```

---

## 서비스 의존성

```yaml
# docker-compose.unified.yml 의존성 구조

nginx:
  depends_on:
    - django (healthy)      # Django만 의존

django:
  depends_on:
    - django-db (healthy)   # MySQL
    - redis (healthy)       # Cache

fastapi:
  depends_on:
    - redis (healthy)       # Celery Broker

fastapi-celery:
  depends_on:
    - redis (healthy)
    - fastapi (started)
```

### 시작 순서

```
1. redis, django-db     (인프라)
        ↓
2. django, fastapi      (애플리케이션)
        ↓
3. fastapi-celery       (워커)
        ↓
4. nginx                (리버스 프록시)
```

---

## Nginx 라우팅 규칙

| 경로 | 대상 | 설명 |
|------|------|------|
| `/` | React 정적 파일 | SPA 라우팅 (try_files) |
| `/api/*` | Django :8000 | REST API (rate limit 적용) |
| `/api/orthanc/*` | Django :8000 | DICOM API (rate limit 미적용) |
| `/admin/*` | Django :8000 | Django Admin |
| `/ws/*` | Django :8000 | WebSocket |
| `/ai/*` | React 정적 파일 | 프론트엔드 AI 페이지 |
| `/orthanc/*` | Orthanc :8042 | DICOM Viewer |
| `/static/*` | 정적 파일 | Django collectstatic |
| `/media/*` | 미디어 파일 | 업로드 파일 |

---

## 포트 매핑

| 서비스 | 컨테이너 포트 | 호스트 포트 | 외부 접근 |
|--------|--------------|------------|----------|
| Nginx | 80, 443 | 80, 443 | ✅ |
| Django | 8000 | 8000 | ⚠️ 디버깅용 |
| FastAPI | 9000 | 9000 | ⚠️ 디버깅용 |
| MySQL | 3306 | 3306 | ⚠️ 디버깅용 |
| Redis | 6379 | 6379 | ⚠️ 디버깅용 |
| Orthanc | 8042, 4242 | 8042, 4242 | ⚠️ 디버깅용 |

> ⚠️ Production 환경에서는 Nginx(80, 443)만 외부 노출 권장

---

## WSGI/ASGI 서버 설정

| 서비스 | 서버 | 설정 |
|--------|------|------|
| Django | Daphne (ASGI) | `daphne -b 0.0.0.0 -p 8000 config.asgi:application` |
| FastAPI | Uvicorn | `uvicorn main:app --host 0.0.0.0 --port 9000 --workers 2` |

### Daphne 사용 이유
- Django Channels 지원 (WebSocket)
- ASGI 비동기 처리

### Uvicorn 사용 이유
- FastAPI 네이티브 ASGI 서버
- 경량, 고성능

---

## 변경 이력

| 날짜 | 변경 내용 |
|------|----------|
| 2026-01-22 | nginx depends_on에서 fastapi 의존성 제거 |
| 2026-01-22 | nginx.conf에서 미사용 upstream fastapi_backend 제거 |

---

## 파일 위치

```
docker/
├── docker-compose.unified.yml   # 통합 배포 설정
├── nginx/
│   └── nginx.conf               # Nginx 설정
├── orthanc/
│   └── orthanc.json             # Orthanc 설정
└── ARCHITECTURE.md              # 본 문서
```

---

## 최종 업데이트

- **날짜**: 2026-01-22
- **작성자**: Claude Code
