# Nginx SPA 라우팅 문제 해결

## 문제 상황

### 증상
페이지 새로고침 시 404 에러 발생:
```
GET http://34.46.109.203/ai/mg/ai_req_0002 404 (Not Found)
```

### 원인
`/ai/mg/ai_req_0002`는 **React SPA 프론트엔드 라우트**입니다.

1. 사용자가 React 앱 내에서 페이지 이동 → React Router가 처리 (정상)
2. 사용자가 새로고침(F5) → 브라우저가 서버에 해당 경로 직접 요청
3. 기존 Nginx 설정: `/ai/`를 FastAPI로 프록시
4. FastAPI에는 `/ai/mg/ai_req_0002` 엔드포인트가 없음 → **404 에러**

### 라우팅 구조 이해

| 경로 | 유형 | 처리 주체 |
|------|------|-----------|
| `/ai/mg/ai_req_0002` | 프론트엔드 라우트 | React SPA |
| `/ai/dashboard` | 프론트엔드 라우트 | React SPA |
| `/api/ai/requests/` | API 엔드포인트 | Django |
| `/api/ai/callback/` | API 엔드포인트 | Django |
| `/api/v1/m1/inference` | API 엔드포인트 | FastAPI |

## 해결 방법

### 변경 파일
`docker/nginx/nginx.conf`

### 변경 전 (문제)
```nginx
# /ai/를 FastAPI로 프록시 (프론트엔드 라우트도 FastAPI로 감)
location /ai/ {
    proxy_pass http://fastapi_backend;
    proxy_http_version 1.1;
    # ...
}
```

### 변경 후 (해결)
```nginx
# Frontend AI Routes (React SPA)
# /ai/m1/, /ai/mg/, /ai/mm/, /ai/dashboard 등 프론트엔드 라우팅
# 참고: AI API는 /api/ai/로 Django에서 처리 (위의 /api/ 블록에서 처리됨)
location /ai/ {
    try_files $uri $uri/ /index.html;
}
```

### 동작 원리

**`try_files $uri $uri/ /index.html;` 의미:**
1. `$uri` - 요청된 파일이 있으면 반환
2. `$uri/` - 요청된 디렉토리가 있으면 반환
3. `/index.html` - 둘 다 없으면 index.html 반환 (React SPA가 라우팅 처리)

**요청 흐름:**
```
브라우저 요청: /ai/mg/ai_req_0002
       ↓
Nginx: /ai/ 매칭
       ↓
try_files: /ai/mg/ai_req_0002 파일 없음
       ↓
try_files: /ai/mg/ai_req_0002/ 디렉토리 없음
       ↓
try_files: /index.html 반환
       ↓
React SPA 로드 → React Router가 /ai/mg/ai_req_0002 처리
```

## 전체 Nginx 라우팅 구조

```nginx
# 1. Django API (AI 포함)
location /api/ {
    proxy_pass http://django_backend;
}

# 2. Django Admin
location /admin/ {
    proxy_pass http://django_backend;
}

# 3. Django Static/Media
location /static/ { alias /app/static/; }
location /media/ { alias /app/media/; }

# 4. WebSocket
location /ws/ {
    proxy_pass http://django_backend;
}

# 5. Frontend AI Routes (React SPA) ← 이 부분 수정
location /ai/ {
    try_files $uri $uri/ /index.html;
}

# 6. Orthanc DICOM
location /orthanc/ {
    proxy_pass http://orthanc:8042/;
}

# 7. 기타 모든 경로 (React SPA)
location / {
    try_files $uri $uri/ /index.html;
}
```

## 적용 방법

```bash
# Nginx 설정 리로드
docker compose -f docker-compose.unified.yml restart nginx

# 또는 설정만 리로드 (무중단)
docker exec nn-nginx nginx -s reload
```

## 검증

1. `/ai/mg/ai_req_0002` 페이지로 이동
2. 새로고침(F5)
3. 페이지가 정상 로드되면 성공

## 관련 개념

### SPA (Single Page Application) 라우팅

SPA는 하나의 HTML 파일(`index.html`)을 로드한 후, JavaScript(React Router)가 URL에 따라 다른 컴포넌트를 렌더링합니다.

**클라이언트 사이드 라우팅:**
```
사용자 클릭 → React Router → 컴포넌트 변경 (서버 요청 없음)
```

**새로고침 시:**
```
브라우저 → 서버에 직접 요청 → Nginx가 index.html 반환 필요
```

### FastAPI 경로

FastAPI는 `/api/v1/...` 경로를 사용하며, Django에서 이를 프록시합니다:
- Django `/api/ai/m1/inference/` → FastAPI `/api/v1/m1/inference`

따라서 Nginx에서 `/ai/`를 FastAPI로 직접 프록시할 필요가 없습니다.
