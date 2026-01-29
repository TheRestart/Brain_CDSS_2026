# 보안 개선 TODO

## 1. `/api/orthanc/` API 권한 문제

### 현재 상태
`brain_tumor_back/apps/orthancproxy/views.py`에서 대부분의 API가 `AllowAny`로 설정되어 있음.

| API | 현재 권한 | 문제 |
|-----|----------|------|
| `list_patients` | AllowAny | 비로그인도 접근 가능 |
| `list_studies` | AllowAny | 비로그인도 접근 가능 |
| `list_series` | AllowAny | 비로그인도 접근 가능 |
| `list_instances` | AllowAny | 비로그인도 접근 가능 |
| `get_instance_file` | AllowAny | DICOM 파일 다운로드 가능 |
| `get_series_thumbnail` | AllowAny | 비로그인도 접근 가능 |
| `get_study_thumbnails` | AllowAny | 비로그인도 접근 가능 |
| `get_instance_preview` | AllowAny | 비로그인도 접근 가능 |
| `upload_patient` | IsAuthenticated | ✅ 정상 |
| `delete_*` | IsAuthenticated | ✅ 정상 |

### 권장 수정

**옵션 1: 최소 보안 (IsAuthenticated)**
```python
@api_view(["GET"])
@permission_classes([IsAuthenticated])  # AllowAny → IsAuthenticated
def list_patients(request):
    ...
```

**옵션 2: 강화된 보안 (특정 역할만 허용)**
Orthanc UI와 동일하게 SYSTEMMANAGER, ADMIN, DOCTOR, RIS만 허용

```python
# orthancproxy/permissions.py 생성
from rest_framework.permissions import BasePermission

ORTHANC_ALLOWED_ROLES = {"SYSTEMMANAGER", "ADMIN", "DOCTOR", "RIS"}

class IsOrthancAllowed(BasePermission):
    def has_permission(self, request, view):
        if not request.user.is_authenticated:
            return False
        if not request.user.role:
            return False
        return request.user.role.code in ORTHANC_ALLOWED_ROLES
```

```python
# views.py에서 사용
@api_view(["GET"])
@permission_classes([IsOrthancAllowed])
def list_patients(request):
    ...
```

### 영향 범위
- DICOM 뷰어 (Cornerstone.js)
- AI 추론 페이지
- 보고서 페이지
- RIS 워크리스트

### 수정 시 주의사항
- 프론트엔드에서 401/403 에러 처리 필요
- DICOM 뷰어 로딩 시 권한 체크 추가 필요

---

## 2. 완료된 보안 작업

### Orthanc UI 접근 제한 (2024-01-29 완료)
- `/orthanc/` 경로에 nginx auth_request 적용
- 허용 역할: SYSTEMMANAGER, ADMIN, DOCTOR, RIS
- 미인가 시 `/login?error=orthanc_access_denied`로 리다이렉트

**관련 파일:**
- `docker/nginx/nginx.conf` (auth_request 설정)
- `brain_tumor_back/apps/accounts/views.py` (OrthancAuthView)
- `brain_tumor_back/apps/accounts/urls.py` (orthanc-auth 경로)
