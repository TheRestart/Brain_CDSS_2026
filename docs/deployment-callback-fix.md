# Docker 배포 환경 콜백 URL 문제 해결

## 문제 상황

### 증상
AI 추론(M1, MG, MM)은 성공하지만, 결과를 Django로 전송하는 콜백이 **403 Forbidden** 에러로 실패

```
POST http://34.46.109.203/api/ai/callback/ "HTTP/1.1 403 Forbidden"
```

### 원인
Docker 컨테이너 내부의 Celery worker가 **외부 IP**로 콜백을 시도했기 때문입니다.

```
[문제 흐름]
1. Django가 콜백 URL 생성: http://34.46.109.203/api/ai/callback/
2. Celery worker가 외부 IP로 요청 시도
3. Nginx → 외부에서 온 요청으로 인식 → CSRF/인증 문제 발생
4. 403 Forbidden 응답
```

Docker 내부에서는 컨테이너 이름을 사용한 내부 통신을 해야 합니다:
```
http://django:8000/api/ai/callback/  (올바른 방식)
```

## 해결 방법

### 수정된 파일
- `modAI/tasks/m1_tasks.py`
- `modAI/tasks/mg_tasks.py`
- `modAI/tasks/mm_tasks.py`

### 변경 내용

**변경 전** (`resolve_callback_url` 함수):
```python
def resolve_callback_url(callback_url: str) -> str:
    django_url = os.getenv('DJANGO_URL', '')

    if not django_url:
        return callback_url

    # localhost 또는 127.0.0.1만 대체
    if 'localhost' in callback_url or '127.0.0.1' in callback_url:
        # URL 변환 로직
        return resolved_url

    return callback_url  # 외부 IP는 그대로 반환 (문제!)
```

**변경 후**:
```python
def resolve_callback_url(callback_url: str) -> str:
    django_url = os.getenv('DJANGO_URL', '')

    if not django_url:
        return callback_url

    # DJANGO_URL이 설정되어 있으면 항상 내부 URL 사용
    # (localhost, 127.0.0.1, 외부 IP 모두 대체)
    from urllib.parse import urlparse
    parsed = urlparse(callback_url)
    path = parsed.path
    if parsed.query:
        path += f'?{parsed.query}'

    resolved_url = django_url.rstrip('/') + path
    return resolved_url  # 항상 내부 URL로 변환
```

### 동작 원리

| 입력 URL | 환경변수 DJANGO_URL | 출력 URL |
|----------|---------------------|----------|
| `http://34.46.109.203/api/ai/callback/` | `http://django:8000` | `http://django:8000/api/ai/callback/` |
| `http://localhost:8000/api/ai/callback/` | `http://django:8000` | `http://django:8000/api/ai/callback/` |
| `http://127.0.0.1:8000/api/ai/callback/` | `http://django:8000` | `http://django:8000/api/ai/callback/` |

## Docker Compose 환경변수 설정

`docker-compose.unified.yml`에서 Celery worker의 `DJANGO_URL` 환경변수가 올바르게 설정되어 있어야 합니다:

```yaml
fastapi-celery:
  environment:
    - DJANGO_URL=http://django:8000  # Docker 내부 네트워크 URL
```

## 적용 방법

수정된 코드를 배포한 후 Celery worker를 재시작합니다:

```bash
docker compose -f docker-compose.unified.yml restart fastapi-celery
```

또는 전체 서비스 재시작:

```bash
docker compose -f docker-compose.unified.yml down
docker compose -f docker-compose.unified.yml up -d
```

## 검증

로그에서 콜백 URL이 올바르게 변환되는지 확인:

```bash
docker logs nn-fastapi-celery --tail 50
```

정상 동작 시 로그:
```
[M1] Callback URL resolved: http://34.46.109.203/api/ai/callback/ -> http://django:8000/api/ai/callback/
[M1] Callback sent successfully with 4 files
```

## 관련 개념

### Docker 내부 네트워크
Docker Compose로 실행된 컨테이너들은 같은 네트워크(`medical-net`)에 속하며, 컨테이너 이름으로 서로 통신할 수 있습니다:

```
nn-fastapi-celery → django:8000 (내부 통신, 성공)
nn-fastapi-celery → 34.46.109.203:80 (외부 통신, 실패 가능)
```

### 왜 외부 IP로는 실패하는가?
1. **CSRF 보호**: Django는 외부에서 온 POST 요청에 CSRF 토큰을 요구
2. **인증 문제**: 외부 요청으로 인식되어 인증 미들웨어가 차단
3. **네트워크 경로**: 외부 IP → Nginx → Django 경로는 불필요하게 복잡하고 보안 정책에 걸릴 수 있음
