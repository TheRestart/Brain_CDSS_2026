# Orthanc Proxy
orthancproxy는 apps 폴더 밖에 있는 별도 Django 앱입니다.


Django 앱으로, Orthanc PACS 서버와의 통신을 프록시하여 DICOM 영상 관리 기능을 제공합니다.

## 개요

**목적**: 프론트엔드에서 Orthanc 서버에 직접 접근하지 않고, Django 백엔드를 통해 DICOM 영상을 조회/업로드/삭제할 수 있도록 합니다.

**기술 스택**:
- Django REST Framework
- pydicom (DICOM 파일 처리)
- requests (Orthanc REST API 호출)

---

## 설정

### settings.py 설정

```python
# Orthanc 서버 URL
ORTHANC_BASE_URL = "http://localhost:8042"

# 디버그 로깅 (선택)
ORTHANC_DEBUG_LOG = True
```

### URL 등록

```python
# config/urls.py
urlpatterns = [
    path("api/orthanc/", include("orthancproxy.urls")),
]
```

---

## API 엔드포인트

### 조회 API

| Method | Endpoint | 설명 | 파라미터 |
|--------|----------|------|----------|
| GET | `/api/orthanc/patients/` | 전체 환자 목록 | - |
| GET | `/api/orthanc/studies/` | 환자별 Study 목록 | `patient_id` (required) |
| GET | `/api/orthanc/series/` | Study별 Series 목록 | `study_id` (required) |
| GET | `/api/orthanc/instances/` | Series별 Instance 목록 | `series_id` (required) |
| GET | `/api/orthanc/instances/{id}/file/` | DICOM 파일 다운로드 | - |

### 업로드 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/orthanc/upload-patient/` | DICOM 파일 업로드 (폴더 단위) |

### 삭제 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| DELETE | `/api/orthanc/patients/{id}/` | 환자 삭제 |
| DELETE | `/api/orthanc/studies/{id}/` | Study 삭제 |
| DELETE | `/api/orthanc/series/{id}/` | Series 삭제 |
| DELETE | `/api/orthanc/instances/{id}/` | Instance 삭제 |

---

## 사용 예시

### 환자 목록 조회

```bash
curl http://localhost:8000/api/orthanc/patients/
```

**응답**:
```json
[
  {
    "orthancId": "abc123...",
    "patientId": "P2026-0001",
    "patientName": "홍길동",
    "studiesCount": 3
  }
]
```

### Study 목록 조회

```bash
curl "http://localhost:8000/api/orthanc/studies/?patient_id=abc123"
```

**응답**:
```json
[
  {
    "orthancId": "def456...",
    "studyInstanceUID": "1.2.840.xxx",
    "description": "Brain MRI",
    "studyDate": "20260111",
    "seriesCount": 4
  }
]
```

### DICOM 파일 업로드

```bash
curl -X POST http://localhost:8000/api/orthanc/upload-patient/ \
  -F "patient_id=P2026-0001" \
  -F "study_description=Brain MRI Scan" \
  -F "files=@/path/to/file1.dcm" \
  -F "files=@/path/to/file2.dcm" \
  -F "series_path=T1" \
  -F "series_path=T2"
```

**응답**:
```json
{
  "patientId": "P2026-0001",
  "studyUid": "1.2.840.xxx",
  "studyId": "uuid...",
  "studyDescription": "Brain MRI Scan",
  "uploaded": 2,
  "failedFiles": [],
  "orthancSeriesIds": ["ghi789..."]
}
```

---

## 핵심 기능

### 1. DICOM 계층 조회
- Patient → Study → Series → Instance 계층 구조 탐색
- 각 레벨별 메타데이터 반환 (Orthanc MainDicomTags)

### 2. 폴더 기반 업로드
- 여러 DICOM 파일을 한 번에 업로드
- `series_path` 파라미터로 폴더별 Series 그룹화
- 통합 Study 자동 생성 (단일 StudyInstanceUID)
- StudyDescription 지정 가능

### 3. 자동 정리 (Auto Cleanup)
- Instance 삭제 시 빈 Series 자동 삭제
- Series 삭제 시 빈 Study 자동 삭제
- Study 삭제 시 빈 Patient 자동 삭제

### 4. DICOM 파일 수정
업로드 시 pydicom을 사용하여 태그 수정:
- `PatientID`, `PatientName`: 요청된 patient_id로 설정
- `StudyInstanceUID`: 통합 UID 생성
- `SeriesInstanceUID`: 폴더별 고유 UID 생성
- `StudyDescription`: 요청된 설명 또는 기본값
- `StudyDate`, `StudyTime`: 없으면 현재 시간으로 설정

---

## 응답 데이터 구조

### Instance 메타데이터

```json
{
  "orthancId": "instance-orthanc-id",
  "instanceNumber": "1",
  "instanceNumberInt": 1,
  "sopInstanceUID": "1.2.840.xxx",
  "rows": "512",
  "columns": "512",
  "pixelSpacing": "0.5\\0.5",
  "sliceThickness": "1.0",
  "sliceLocation": "-50.0",
  "imagePositionPatient": "-100\\-100\\-50",
  "patientId": "P2026-0001",
  "patientName": "홍길동",
  "studyInstanceUID": "1.2.840.xxx",
  "seriesInstanceUID": "1.2.840.xxx",
  "seriesNumber": "1"
}
```

---

## 의존성

```
pydicom>=2.0.0
requests>=2.25.0
djangorestframework>=3.12.0
```

---

## 주의사항

1. **Orthanc 서버 필수**: 이 앱은 Orthanc PACS 서버가 실행 중이어야 동작합니다.
2. **인증**: 현재 일부 API는 `AllowAny` 권한으로 설정됨 (프로덕션에서는 수정 필요)
3. **타임아웃**: Orthanc API 호출 시 10-30초 타임아웃 설정됨
4. **로깅**: `ORTHANC_DEBUG_LOG=True` 시 상세 로그 출력

---

## 관련 문서

- [Orthanc REST API](https://book.orthanc-server.com/users/rest.html)
- [pydicom 문서](https://pydicom.github.io/)
- [app_확장계획.md](../../app_확장계획.md) - Phase 4 Orthanc 연동 계획

---

**작성일**: 2026-01-11
**작성자**: Claude
