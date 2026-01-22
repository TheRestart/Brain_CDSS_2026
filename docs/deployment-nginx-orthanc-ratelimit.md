# Nginx Orthanc API Rate Limiting 문제 해결

## 문제 상황

### 증상
DICOM 뷰어에서 이미지 로딩 시 503 에러 발생:
```
GET http://34.46.109.203/api/orthanc/instances/.../file/ 503 (Service Unavailable)
```

- 세그멘테이션 오버레이가 표시되지 않음
- 이미지 로딩은 되지만 일부 요청이 실패

### 원인
Nginx의 `/api/` 경로에 적용된 rate limiting 설정이 DICOM 뷰어의 대량 요청을 차단

```nginx
# 기존 설정 - 초당 10개 요청 제한
limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;

location /api/ {
    limit_req zone=api_limit burst=20 nodelay;  # ← 이 설정이 문제
    proxy_pass http://django_backend;
}
```

**DICOM 뷰어 동작 특성:**
- 하나의 스터디에 수십~수백 개의 이미지 슬라이스 포함
- 뷰어는 빠른 렌더링을 위해 다수의 이미지를 동시에 요청
- 초당 10개 요청 제한으로는 부족 → 503 에러 발생

## 해결 방법

### 변경 파일
`docker/nginx/nginx.conf`

### 변경 내용
`/api/orthanc/` 경로를 별도로 분리하여 rate limiting 제외

```nginx
# Orthanc API Proxy (no rate limit - DICOM 뷰어는 많은 요청 필요)
location /api/orthanc/ {
    proxy_pass http://django_backend;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;

    # DICOM 파일은 클 수 있으므로 타임아웃 증가
    proxy_connect_timeout 120s;
    proxy_send_timeout 120s;
    proxy_read_timeout 120s;
}

# Django API Proxy (rate limit 적용 - Orthanc 제외한 나머지 API)
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://django_backend;
    # ...
}
```

### 동작 원리

**Nginx location 매칭 규칙:**
1. Nginx는 더 구체적인(longer) prefix를 먼저 매칭
2. `/api/orthanc/`는 `/api/`보다 더 구체적
3. 따라서 Orthanc 요청은 rate limiting 없이 처리됨

**요청 흐름:**
```
요청: /api/orthanc/instances/xxx/file/
       ↓
Nginx: /api/orthanc/ 매칭 (더 구체적)
       ↓
rate limit 없이 Django로 프록시
       ↓
Django orthancproxy 앱에서 Orthanc 서버로 요청
       ↓
DICOM 파일 반환
```

### 추가 최적화

DICOM 파일 전송을 위한 타임아웃 증가:
- `proxy_connect_timeout 120s` - 연결 타임아웃
- `proxy_send_timeout 120s` - 요청 전송 타임아웃
- `proxy_read_timeout 120s` - 응답 대기 타임아웃

기본값(60초)보다 증가시켜 대용량 DICOM 파일 전송 안정성 확보

## 전체 Nginx 라우팅 구조

```nginx
# 1. Orthanc API (rate limit 제외 - DICOM 뷰어용)
location /api/orthanc/ {
    proxy_pass http://django_backend;
    # rate limit 없음
}

# 2. Django API (rate limit 적용)
location /api/ {
    limit_req zone=api_limit burst=20 nodelay;
    proxy_pass http://django_backend;
}

# 3. Django Admin
location /admin/ {
    proxy_pass http://django_backend;
}

# 4. Django Static/Media
location /static/ { alias /app/static/; }
location /media/ { alias /app/media/; }

# 5. WebSocket
location /ws/ {
    proxy_pass http://django_backend;
}

# 6. Frontend AI Routes (React SPA)
location /ai/ {
    try_files $uri $uri/ /index.html;
}

# 7. Orthanc 직접 프록시 (선택적)
location /orthanc/ {
    proxy_pass http://orthanc:8042/;
}

# 8. 기타 모든 경로 (React SPA)
location / {
    try_files $uri $uri/ /index.html;
}
```

## 적용 방법

```bash
# Nginx 설정 리로드
docker compose -f docker-compose.unified.yml restart nginx

# 또는 무중단 리로드
docker exec nn-nginx nginx -s reload
```

## 검증

1. DICOM 뷰어에서 스터디 열기
2. 모든 슬라이스 이미지가 정상 로드되는지 확인
3. 세그멘테이션 오버레이가 표시되는지 확인
4. 브라우저 개발자 도구 Network 탭에서 503 에러 없는지 확인

## 보안 고려사항

### Rate Limiting 제외 이유
- `/api/orthanc/`는 인증된 사용자만 접근 가능 (Django 인증 필요)
- DICOM 뷰어의 정상적인 동작을 위해 필수
- Orthanc 자체적으로도 접근 제어 가능

### 대안적 접근 (필요 시)
더 높은 rate limit을 적용하고 싶다면:

```nginx
# Orthanc 전용 rate limit zone (더 관대한 설정)
limit_req_zone $binary_remote_addr zone=orthanc_limit:10m rate=100r/s;

location /api/orthanc/ {
    limit_req zone=orthanc_limit burst=200 nodelay;
    proxy_pass http://django_backend;
}
```

## 관련 문서

- [Nginx SPA 라우팅 문제 해결](deployment-nginx-spa-routing.md)
- [AI Callback URL 문제 해결](deployment-callback-fix.md)
