# Docker 볼륨 마운트 장애 보고서

| 항목 | 내용 |
|------|------|
| **작성일** | 2026-01-30 |
| **작성자** | 개발팀 |
| **장애 등급** | 중요 (서비스 일부 불가) |
| **상태** | 해결됨 |

---

## 1. 장애 개요

### 1.1 증상
- AI 추론 요청 시 **503 Service Unavailable** 에러 발생
- 프론트엔드에서 `/api/ai/m1/inference/` 호출 실패

### 1.2 영향 범위
- M1/MG/MM 모델 추론 기능 전체 불가
- 뇌종양 CDSS AI 분석 서비스 중단

### 1.3 발생 시간
- 발견: 2026-01-30 오전
- 해결: 2026-01-30 11:10

---

## 2. 원인 분석

### 2.1 에러 로그
```
ERROR: Error loading ASGI app. Could not import module "main".
INFO: Child process [68734] died
```

### 2.2 근본 원인
**Docker 볼륨 마운트 실패 (Stale Container 문제)**

FastAPI 컨테이너 내부 `/app` 디렉토리에 소스 코드가 마운트되지 않음:

```bash
# 장애 상태 - 소스 파일 없음
$ docker exec nn-fastapi ls -la /app
total 12
drwxr-xr-x 4 root root   80 Jan 29 23:44 .
drwxr-xr-x 1 root root 4096 Jan 22 01:47 ..
drwxrwxrwx 2 root root 4096 Jan 16 05:49 models    # Named volume만 존재
drwxrwxrwx 2 root root 4096 Jan 16 01:54 temp      # Named volume만 존재
```

### 2.3 기술적 원인

#### docker-compose.unified.yml 볼륨 설정
```yaml
fastapi:
  volumes:
    - ../modAI:/app              # Bind mount (실패)
    - fastapi_models:/app/models # Named volume (성공)
    - fastapi_temp:/app/temp     # Named volume (성공)
```

#### 문제 발생 메커니즘
1. 컨테이너가 이전에 생성될 때 bind mount가 실패한 상태로 생성됨
2. 이후 `docker compose up -d` 또는 `docker restart`로는 볼륨 설정이 갱신되지 않음
3. Named volume(`models`, `temp`)만 마운트된 상태 유지
4. `main.py` 등 소스 파일 부재로 FastAPI 시작 실패

### 2.4 Windows Docker 환경 특이사항

| 요소 | 설명 |
|------|------|
| **상대 경로** | `../modAI` 형태의 상대 경로가 Windows에서 불안정 |
| **파일 공유** | Docker Desktop의 File Sharing 설정 필요 |
| **경로 구분자** | Windows(`\`) vs Linux(`/`) 변환 이슈 |
| **권한** | NTFS ↔ Linux 권한 매핑 문제 |

---

## 3. 해결 방법

### 3.1 즉시 조치 (수행됨)
```powershell
cd C:\Users\302-28\Desktop\brain_tumor_dev_3\brain_tumor_dev\docker
docker compose -f docker-compose.unified.yml down
docker compose -f docker-compose.unified.yml up -d
```

### 3.2 해결 확인
```bash
$ docker exec nn-fastapi ls -la /app
total 56
-rwxrwxrwx 1 root root 3046 Jan 16 02:39 main.py      # 소스 파일 정상 마운트
-rwxrwxrwx 1 root root 1593 Jan 16 03:07 celery_app.py
-rwxrwxrwx 1 root root 2956 Jan 19 06:10 config.py
drwxrwxrwx 1 root root 4096 Jan 22 06:27 routers
...
```

```bash
$ curl http://localhost:9000/health
{"status": "healthy", "device": "cuda"}
```

---

## 4. 재발 방지 대책

### 4.1 단기 대책

#### A. 시작 스크립트 사용
```powershell
# start-services.ps1
Write-Host "Stopping services..."
docker compose -f docker-compose.unified.yml down

Write-Host "Starting services..."
docker compose -f docker-compose.unified.yml up -d --build

Write-Host "Waiting for health check..."
Start-Sleep -Seconds 30

# Health check
$response = Invoke-WebRequest -Uri http://localhost:9000/health -UseBasicParsing
Write-Host "FastAPI Status: $($response.Content)"
```

#### B. 절대 경로 사용
```yaml
# docker-compose.unified.yml
fastapi:
  volumes:
    - C:/Users/302-28/Desktop/brain_tumor_dev_3/brain_tumor_dev/modAI:/app
```

### 4.2 중기 대책

#### 개발/운영 환경 분리

**docker-compose.dev.yml (개발용)**
```yaml
fastapi:
  volumes:
    - ../modAI:/app  # 코드 수정 즉시 반영
```

**docker-compose.prod.yml (운영용)**
```yaml
fastapi:
  image: nn-fastapi:latest
  # 볼륨 마운트 없음 - 이미지에 코드 포함
```

### 4.3 장기 대책

| 대책 | 설명 | 우선순위 |
|------|------|----------|
| **CI/CD 파이프라인** | 이미지 빌드 자동화, 볼륨 의존성 제거 | 높음 |
| **Health Check 강화** | 시작 시 볼륨 마운트 상태 검증 | 중간 |
| **Linux VM 전환** | Windows Docker 불안정성 해소 | 낮음 |
| **Kubernetes 전환** | 선언적 볼륨 관리 | 낮음 |

---

## 5. 진단 체크리스트

향후 동일 문제 발생 시 확인 절차:

```bash
# 1. 컨테이너 상태 확인
docker ps | findstr fastapi

# 2. FastAPI 로그 확인
docker logs nn-fastapi --tail 50

# 3. 볼륨 마운트 상태 확인
docker exec nn-fastapi ls -la /app

# 4. main.py 존재 확인
docker exec nn-fastapi cat /app/main.py

# 5. Health 체크
curl http://localhost:9000/health
```

---

## 6. 결론

### 6.1 요약
- **문제**: Docker 볼륨 마운트 미갱신으로 FastAPI 소스 코드 부재
- **원인**: Windows Docker Desktop 환경에서 Stale Container 상태 유지
- **해결**: 컨테이너 삭제 후 재생성 (`down` + `up`)

### 6.2 교훈
1. Windows Docker 환경에서 bind mount는 불안정할 수 있음
2. 운영 환경에서는 볼륨 마운트 대신 이미지에 코드 포함 권장
3. 서비스 시작 스크립트에 `down` + `up` 패턴 사용 권장

### 6.3 관련 용어
- **Stale Container**: 오래된 설정을 유지하는 컨테이너
- **Bind Mount**: 호스트 경로를 컨테이너에 직접 마운트
- **Named Volume**: Docker가 관리하는 볼륨

---

## 부록: 참고 자료

- [Docker Desktop for Windows - File Sharing](https://docs.docker.com/desktop/windows/)
- [Docker Compose volumes](https://docs.docker.com/compose/compose-file/compose-file-v3/#volumes)
- [Bind mounts vs Volumes](https://docs.docker.com/storage/bind-mounts/)
