# 보안 개선 TODO

## Nginx → Orthanc 직접 연결 제거 필요

### 현재 문제

nginx.conf에서 `/orthanc/*` 경로가 Orthanc에 직접 프록시되어 있음:

```nginx
# nginx.conf 181-188줄
location /orthanc/ {
    proxy_pass http://orthanc:8042/;
    proxy_http_version 1.1;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
}
```

### 보안 위험

1. **인증 없이 의료 데이터 접근 가능**
   - 환자 DICOM 영상 열람
   - 환자 이름, 생년월일 등 DICOM 메타데이터 노출
   - 영상 다운로드 가능

2. **Orthanc 자체 인증도 비활성화됨** (docker-compose.unified.yml)
   ```yaml
   environment:
     - ORTHANC__AUTHENTICATION_ENABLED=false
     - ORTHANC__REMOTE_ACCESS_ALLOWED=true
     - AUTHORIZATION_PLUGIN_ENABLED=false
     - ORTHANC__ORTHANC_EXPLORER_2__UI__ENABLE_ANONYMOUS_ACCESS=true
   ```

### 해결 방안

nginx.conf에서 `/orthanc/*` 직접 프록시 블록 제거:

```nginx
# 삭제할 부분 (181-188줄)
location /orthanc/ {
    proxy_pass http://orthanc:8042/;
    ...
}
```

모든 Orthanc 접근은 Django를 통해서만 가능하게 함:
- `/api/orthanc/*` → Django → Orthanc (인증 거침)

### 관련 파일

- `docker/nginx/nginx.conf` - 직접 프록시 제거 필요
- `docker/docker-compose.unified.yml` - Orthanc 환경변수 (참고)
- `docker/ARCHITECTURE.md` - 아키텍처 문서 (이미 수정됨)

---

**작성일**: 2026-01-23
