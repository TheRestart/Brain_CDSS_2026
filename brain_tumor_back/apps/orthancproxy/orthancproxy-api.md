# Orthanc Proxy API 문서 (`orthancproxy`)

이 문서는 아래 `urls.py`와 `views.py` 기반으로 Orthanc DICOM 서버를 프록시하는 Django REST API를 설명합니다.  
또한 **Postman에서 바로 테스트할 수 있도록** 엔드포인트별 예시 요청을 포함합니다.

> ⚠️ 예시에서는 Django 서버 기본 주소를  
> `http://127.0.0.1:8000`  
> Orthanc 프록시 앱의 URL prefix를  
> `http://127.0.0.1:8000/api/orthanc/`  
> 로 가정합니다. (실제 프로젝트 `config/urls.py`에서 prefix가 다르면 그에 맞게 수정하세요.)

---

## 1. 구성 파일 요약

### 1.1. `urls.py`

```python
from django.urls import path
from . import views

urlpatterns = [
    # ===== 조회 API =====
    path("patients/", views.list_patients),
    path("studies/", views.list_studies),
    path("series/", views.list_series),
    path("instances/", views.list_instances),

    path("instances/<str:instance_id>/file/", views.get_instance_file),

    # ===== 삭제 API (REST 스타일 지원) =====
    path("patients/<str:patient_id>/", views.delete_patient),
    path("studies/<str:study_id>/", views.delete_study),
    path("series/<str:series_id>/", views.delete_series),
    path("instances/<str:instance_id>/", views.delete_instance),

    # ===== 기존 delete/ 스타일 계속 유지 (둘 다 허용) =====
    path("delete/patient/<str:patient_id>/", views.delete_patient),
    path("delete/study/<str:study_id>/", views.delete_study),
    path("delete/series/<str:series_id>/", views.delete_series),
    path("delete/instance/<str:instance_id>/", views.delete_instance),

    # ===== 업로드 =====
    path("upload-patient/", views.upload_patient),
]
```

> 즉, 최종 URL은 예를 들어 `config/urls.py` 에서  
> `path("api/orthanc/", include("orthancproxy.urls"))` 로 묶여 있다면  
> `http://127.0.0.1:8000/api/orthanc/patients/` 형태가 됩니다.

---

## 2. 공통 동작 및 로깅

### 2.1. Orthanc 기본 설정

```python
from django.conf import settings

ORTHANC = settings.ORTHANC_BASE_URL.rstrip("/")
```

- `settings.ORTHANC_BASE_URL` 에 Orthanc 서버 주소를 설정해야 합니다.
  - 예: `"http://localhost:8042"`
- 실제 요청은 `_get`, `_delete`, `_post_instance` 헬퍼를 통해 Orthanc에 전달됩니다.

---

### 2.2. 디버그 로그 (`dlog`)

```python
ORTHANC_DEBUG_LOG = getattr(settings, "ORTHANC_DEBUG_LOG", True)
```

- `settings.py` 에서 `ORTHANC_DEBUG_LOG = True/False` 로 콘솔 디버그 출력 on/off 가능.
- `dlog(label, payload)` 로 사람이 읽기 좋은 JSON 형식으로 로그 출력.
- 너무 긴 내용은 3000자에서 잘립니다.

---

### 2.3. 자동 정리 로직 (`_auto_cleanup_if_empty`)

```python
def _auto_cleanup_if_empty(patient_id=None, study_id=None):
    # study에 더 이상 series 없으면 study 삭제
    # patient에 더 이상 study 없으면 patient 삭제
```

- 인스턴스/시리즈/스터디 삭제 시 상위 계층이 비면 자동으로 지우는 기능입니다.
- 주로 개발/연구 서버에서 깔끔한 상태를 유지하기 위한 용도입니다.

---

## 3. 엔드포인트 목록

| 분류           | 메서드 | URL                                        | 설명                              |
|----------------|--------|--------------------------------------------|-----------------------------------|
| 환자 조회      | GET    | `/patients/`                               | Orthanc의 환자 목록 조회          |
| 스터디 조회    | GET    | `/studies/?patient_id={orthancId}`         | 환자별 Study 목록 조회            |
| 시리즈 조회    | GET    | `/series/?study_id={orthancStudyId}`       | Study별 Series 목록 조회          |
| 인스턴스 조회  | GET    | `/instances/?series_id={orthancSeriesId}`  | Series별 Instance 목록 + 메타     |
| DICOM 다운로드 | GET    | `/instances/{instance_id}/file/`           | 특정 Instance의 DICOM 파일 프록시 |
| 환자 삭제      | DELETE | `/patients/{patient_id}/`                  | Orthanc의 환자 삭제               |
| 스터디 삭제    | DELETE | `/studies/{study_id}/`                     | Orthanc의 Study 삭제              |
| 시리즈 삭제    | DELETE | `/series/{series_id}/`                     | Orthanc의 Series 삭제             |
| 인스턴스 삭제  | DELETE | `/instances/{instance_id}/`                | Orthanc의 Instance 삭제           |
| 환자 삭제(구)  | DELETE | `/delete/patient/{patient_id}/`            | 구 URL 유지용 (동일 동작)         |
| …              | DELETE | `/delete/study/{study_id}/`                |                                   |
| …              | DELETE | `/delete/series/{series_id}/`              |                                   |
| …              | DELETE | `/delete/instance/{instance_id}/`          |                                   |
| 업로드         | POST   | `/upload-patient/`                         | 폴더 업로드 → 통합 Study/Series   |

> 아래부터 각 엔드포인트별 상세 설명과 **Postman 테스트 예시**를 제공합니다.  
> 모든 예시는 `{{base_url}}` = `http://127.0.0.1:8000/api/orthanc` 로 가정합니다.

---

## 4. 환자 목록 조회: `GET /patients/`

### 4.1. 설명

Orthanc 서버의 환자 목록을 가져옵니다.  
각 환자에는 Orthanc 내부 ID, DICOM PatientID, PatientName, Study 개수 정보가 포함됩니다.

### 4.2. 요청

- **Method**: `GET`
- **URL 예시**:  
  `{{base_url}}/patients/`
- **Query Params**: 없음  
- **Body**: 없음

### 4.3. 응답 예시 (성공 200)

```json
[
  {
    "orthancId": "98a6fe70-3d97d9a1-7f54ccea-5b57e15b-6d1c4a74",
    "patientId": "sub-0004",
    "patientName": "sub-0004",
    "studiesCount": 1
  },
  {
    "orthancId": "a1b2c3d4-....",
    "patientId": "sub-0005",
    "patientName": "sub-0005",
    "studiesCount": 2
  }
]
```

### 4.4. 에러 응답 예시 (500)

```json
{
  "detail": "401 Client Error: Unauthorized for url: http://localhost:8042/patients"
}
```

### 4.5. Postman 테스트 방법

1. **새 요청** 생성  
2. **Method**: `GET`  
3. **URL**: `{{base_url}}/patients/`  
4. **Send** 클릭  
5. Response 탭에서 JSON 확인  

---

## 5. 환자별 Study 목록 조회: `GET /studies/`

### 5.1. 설명

특정 Orthanc 환자(`orthancId`)에 속한 Study 목록을 조회합니다.

### 5.2. 요청

- **Method**: `GET`
- **URL 예시**:  
  `{{base_url}}/studies/?patient_id=98a6fe70-3d97d9a1-7f54ccea-5b57e15b-6d1c4a74`

- **Query Params**

| 이름         | 필수 | 설명                                   |
|--------------|------|----------------------------------------|
| `patient_id` | O    | `list_patients` 에서 받은 `orthancId` |

- **Body**: 없음

### 5.3. 응답 예시 (성공 200)

```json
[
  {
    "orthancId": "6f2a0a4c-07b2774b-ea94b109-2fb1e9f4-950e7ed3",
    "studyInstanceUID": "1.2.826.0.1.3680043.8.498.13097121194223160729673485351421042972",
    "description": "AutoUploaded Study",
    "studyDate": "20260105",
    "seriesCount": 4
  }
]
```

### 5.4. 잘못된 요청 (400) 예시

```json
{
  "detail": "patient_id is required"
}
```

### 5.5. Postman 테스트 방법

1. `GET {{base_url}}/patients/` 로 먼저 환자 목록을 조회한다.  
2. 응답에서 `orthancId` 를 복사한다.  
3. 새 요청을 생성하여:
   - Method: `GET`
   - URL: `{{base_url}}/studies/?patient_id={복사한 orthancId}`
4. **Send** 클릭 후 결과 확인.

---

## 6. Study별 Series 목록 조회: `GET /series/`

### 6.1. 설명

특정 Study에 포함된 Series 목록을 가져옵니다.

### 6.2. 요청

- **Method**: `GET`
- **URL 예시**:  
  `{{base_url}}/series/?study_id=6f2a0a4c-07b2774b-ea94b109-2fb1e9f4-950e7ed3`

- **Query Params**

| 이름       | 필수 | 설명                                   |
|------------|------|----------------------------------------|
| `study_id` | O    | `list_studies` 응답의 `orthancId` 값 |

- **Body**: 없음

### 6.3. 응답 예시 (성공 200)

```json
[
  {
    "orthancId": "e15db700-5e458dab-86f9f04d-fd005aea-36cb4d02",
    "seriesInstanceUID": "1.2.826.0.1.3680043.8.498.11111111111111111111111111111111111",
    "seriesNumber": "1",
    "description": "T1",
    "modality": "MR",
    "instancesCount": 160
  },
  {
    "orthancId": "f2cbbf3e-....",
    "seriesInstanceUID": "1.2.826.0.1.3680043.8.498.22222222222222222222222222222222222",
    "seriesNumber": "2",
    "description": "T2",
    "modality": "MR",
    "instancesCount": 160
  }
]
```

### 6.4. 잘못된 요청 (400) 예시

```json
{
  "detail": "study_id is required"
}
```

### 6.5. Postman 테스트 방법

1. `GET {{base_url}}/studies/?patient_id=...` 로 스터디 목록을 가져온다.  
2. 응답의 `orthancId`를 복사.  
3. 새 요청:
   - Method: `GET`
   - URL: `{{base_url}}/series/?study_id={orthancStudyId}`
4. **Send** 후 결과 확인.

---

## 7. Series별 Instance 목록 조회: `GET /instances/`

### 7.1. 설명

특정 Series에 포함된 모든 Instance 목록과 주요 DICOM 메타데이터를 가져옵니다.  
내부적으로 Orthanc의 `/instances/{id}/simplified-tags` 를 사용합니다.

### 7.2. 요청

- **Method**: `GET`
- **URL 예시**:  
  `{{base_url}}/instances/?series_id=e15db700-5e458dab-86f9f04d-fd005aea-36cb4d02`

- **Query Params**

| 이름        | 필수 | 설명                                      |
|-------------|------|-------------------------------------------|
| `series_id` | O    | `list_series` 응답의 `orthancId` 필드 값 |

- **Body**: 없음

### 7.3. 응답 필드 설명

각 요소(`meta`)에는 다음과 같은 정보가 포함됩니다.

- `orthancId`: Orthanc Instance ID  
- `instanceNumber`: DICOM InstanceNumber(문자열)  
- `instanceNumberInt`: InstanceNumber의 정수 버전 (정렬용)  
- `sopInstanceUID`  
- `rows`, `columns`  
- `pixelSpacing`  
- `sliceThickness`  
- `sliceLocation`  
- `imagePositionPatient`  
- `patientId`, `patientName`  
- `studyInstanceUID`  
- `seriesInstanceUID`  
- `seriesNumber`  

### 7.4. 응답 예시 (성공 200)

```json
[
  {
    "orthancId": "0e40ec9c-5ec5e804-f4da7c83-ad043748-90c168b8",
    "instanceNumber": "1",
    "instanceNumberInt": 1,
    "sopInstanceUID": "1.2.826.0.1.3680043.8.498.99999999999999999999999999999999999",
    "rows": "256",
    "columns": "256",
    "pixelSpacing": "0.976562\\0.976562",
    "sliceThickness": "1.0",
    "sliceLocation": "0.0",
    "imagePositionPatient": "-125.0\\-125.0\\0.0",
    "patientId": "sub-0004",
    "patientName": "sub-0004",
    "studyInstanceUID": "1.2.826.0.1.3680043.8.498.13097121194223160729673485351421042972",
    "seriesInstanceUID": "1.2.826.0.1.3680043.8.498.11111111111111111111111111111111111",
    "seriesNumber": "1"
  },
  {
    "orthancId": "....",
    "instanceNumber": "2",
    "instanceNumberInt": 2,
    "sopInstanceUID": "...",
    "rows": "256",
    "columns": "256",
    "pixelSpacing": "0.976562\\0.976562",
    "sliceThickness": "1.0",
    "sliceLocation": "1.0",
    "imagePositionPatient": "-125.0\\-125.0\\1.0",
    "patientId": "sub-0004",
    "patientName": "sub-0004",
    "studyInstanceUID": "1.2.826.0.1.3680043.8.498.13097121194223160729673485351421042972",
    "seriesInstanceUID": "1.2.826.0.1.3680043.8.498.11111111111111111111111111111111111",
    "seriesNumber": "1"
  }
]
```

### 7.5. 잘못된 요청 (400) 예시

```json
{
  "detail": "series_id is required"
}
```

### 7.6. Postman 테스트 방법

1. `GET {{base_url}}/series/?study_id=...` 로 시리즈 목록을 가져온다.  
2. 하나의 `orthancId`를 복사.  
3. 새 요청:
   - Method: `GET`
   - URL: `{{base_url}}/instances/?series_id={orthancSeriesId}`
4. **Send** 후 결과 확인.

---

## 8. Instance DICOM 파일 프록시: `GET /instances/{instance_id}/file/`

### 8.1. 설명

특정 instance에 해당하는 DICOM 파일을 그대로 프록시하여 반환합니다.  
React Viewer(예: Cornerstone)에서 이 URL로 직접 DICOM을 로딩할 수 있습니다.

### 8.2. 요청

- **Method**: `GET`
- **URL 예시**:  
  `{{base_url}}/instances/0e40ec9c-5ec5e804-f4da7c83-ad043748-90c168b8/file/`

- **Path Params**

| 이름          | 필수 | 설명                   |
|---------------|------|------------------------|
| `instance_id` | O    | Orthanc Instance ID   |

- **Body**: 없음

### 8.3. 응답 (성공 200)

- **Content-Type**: `application/dicom`  
- Body: 바이너리 DICOM 데이터  

Postman에서는 Body를 Raw로 보기보다는 **Send** 후  
**Save Response → Save to file** 로 저장할 수 있습니다.

### 8.4. 에러 응답 예시 (500)

```json
{
  "detail": "404 Client Error: Not Found for url: http://localhost:8042/instances/0e40ec9c-.../file"
}
```

### 8.5. Postman 테스트 방법

1. `GET {{base_url}}/instances/?series_id=...` 결과에서 `orthancId`(instance_id)를 복사.  
2. 새 요청:
   - Method: `GET`
   - URL: `{{base_url}}/instances/{instance_id}/file/`
3. **Send**  
4. 정상이라면 Headers에 `Content-Type: application/dicom` 및 바이너리 응답이 보임.  
5. (원하면) 상단에서 **Save Response** 버튼으로 파일 저장.

---

## 9. 삭제 API들

### 공통 설명

- 모두 **Method: DELETE**
- 삭제 후 상위 계층(Series/Study/Patient)이 비면 `_auto_cleanup_if_empty` 가 동작하여 깨끗이 지웁니다.
- REST 스타일과 `/delete/...` 스타일 두 가지 URL이 모두 같은 view를 사용합니다.

---

### 9.1. Instance 삭제: `DELETE /instances/{instance_id}/`

#### 요청

- **URL 예시**  
  `{{base_url}}/instances/0e40ec9c-5ec5e804-f4da7c83-ad043748-90c168b8/`
- **Body**: 없음

#### 응답 예시 (성공 200)

```json
{
  "deleted": true,
  "instance_id": "0e40ec9c-5ec5e804-f4da7c83-ad043748-90c168b8"
}
```

#### Postman

- Method: `DELETE`
- URL: `{{base_url}}/instances/{instance_id}/`
- Send

---

### 9.2. Series 삭제: `DELETE /series/{series_id}/`

#### 요청

- **URL 예시**  
  `{{base_url}}/series/e15db700-5e458dab-86f9f04d-fd005aea-36cb4d02/`

#### 응답 예시

```json
{
  "deleted": true,
  "series_id": "e15db700-5e458dab-86f9f04d-fd005aea-36cb4d02"
}
```

---

### 9.3. Study 삭제: `DELETE /studies/{study_id}/`

#### 응답 예시

```json
{
  "deleted": true,
  "study_id": "6f2a0a4c-07b2774b-ea94b109-2fb1e9f4-950e7ed3"
}
```

---

### 9.4. Patient 삭제: `DELETE /patients/{patient_id}/`

> 여기서 `patient_id` 는 **Orthanc Patient ID** (`list_patients`의 `orthancId`) 입니다.  
> DICOM PatientID(`patientId`)와 다르니 주의하세요.

#### 응답 예시

```json
{
  "deleted": true,
  "patient_id": "98a6fe70-3d97d9a1-7f54ccea-5b57e15b-6d1c4a74"
}
```

---

### 9.5. `/delete/...` 스타일 (구 URL 유지)

- `DELETE /delete/patient/{patient_id}/`
- `DELETE /delete/study/{study_id}/`
- `DELETE /delete/series/{series_id}/`
- `DELETE /delete/instance/{instance_id}/`

동일한 view 를 사용하므로 응답 형식은 위와 같습니다.  
단지 URL path가 다르게 유지된 것뿐입니다.

---

## 10. 폴더 업로드: `POST /upload-patient/`

### 10.1. 설명

여러 DICOM 파일을 한 번에 업로드하여 **하나의 Study** 안에 **여러 Series**를 구성하는 API입니다.

- `patient_id`를 기반으로 PatientID/PatientName을 세팅  
- 새로운 `StudyInstanceUID` 와 UUID 기반 `StudyID` 생성  
- `series_path`(또는 `seriesPath`) 값이 같으면 같은 Series 로 묶임
  - 각 Series에 대해 고유 SeriesInstanceUID 부여
  - SeriesNumber 1, 2, 3, ... 순서로 증가
- DICOM 태그 자동 보정 후 Orthanc `/instances` 로 전송

### 10.2. 요청

- **Method**: `POST`
- **URL**: `{{base_url}}/upload-patient/`
- **Content-Type**: `multipart/form-data`

#### Form-Data 필드

| 키 이름       | 타입   | 필수 | 설명                                                                 |
|---------------|--------|------|----------------------------------------------------------------------|
| `patient_id`  | Text   | O    | 환자 ID. DICOM `PatientID`, `PatientName` 에도 동일하게 세팅됩니다. |
| `files`       | File[] | O    | 업로드할 DICOM 파일들. 동일 key 이름으로 여러 개 추가합니다.       |
| `series_path` | Text[] | O    | 각 파일에 대응하는 시리즈 경로 (예: `T1`, `T2`, `FLAIR`)             |

> `series_path` 대신 `seriesPath` 사용 가능 (`getlist("series_path") or getlist("seriesPath")`).

### 10.3. 내부 동작 요약

1. `study_uid = generate_uid()` 로 새로운 StudyInstanceUID 생성  
2. `study_id = str(uuid.uuid4())` 로 StudyID 생성  
3. `series_uid_map` / `series_num_map` 으로 `series_path`별 Series UID/Number 관리  
4. 각 파일에 대해:
   - `PatientID`, `PatientName` ← `patient_id`
   - `StudyInstanceUID`, `StudyID` ← 위에서 생성한 값
   - `StudyDescription` 없으면 `"AutoUploaded Study"` 로 채움
   - `StudyDate`, `StudyTime` 없으면 현재 시각으로 채움
   - `SeriesInstanceUID`, `SeriesNumber`, `SeriesDescription` 설정
   - `InstanceNumber` 없으면 전체 업로드 index 기반 자동 부여
   - 변환된 DICOM을 Orthanc `/instances` 로 POST
5. 업로드 성공한 Series들의 Orthanc Series ID를 수집하여 응답에 포함

### 10.4. 응답 예시 (201 Created)

```json
{
  "patientId": "sub-0004",
  "studyUid": "1.2.826.0.1.3680043.8.498.13097121194223160729673485351421042972",
  "studyId": "41f38f12-2af7-4bc8-9487-7a93e6e328aa",
  "uploaded": 320,
  "failedFiles": [],
  "orthancSeriesIds": [
    "e15db700-5e458dab-86f9f04d-fd005aea-36cb4d02",
    "f2cbbf3e-....",
    "...."
  ]
}
```

### 10.5. 잘못된 요청 예시

#### (1) `patient_id` 누락

```json
{
  "detail": "patient_id is required"
}
```

#### (2) 파일이 하나도 없음

```json
{
  "detail": "no files"
}
```

#### (3) `files` 개수와 `series_path` 개수가 불일치

```json
{
  "detail": "series_path count must match files count",
  "filesCount": 10,
  "seriesPathCount": 3
}
```

---

### 10.6. Postman 테스트 방법 (중요)

1. 새 요청 생성  
2. **Method**: `POST`  
3. **URL**: `{{base_url}}/upload-patient/`  
4. 상단 탭에서 **Body** 선택  
5. **form-data** 선택  

#### form-data 세팅 예시

| Key         | Type | Value               | 설명                                  |
|-------------|------|---------------------|---------------------------------------|
| patient_id  | Text | `sub-0004`          | 환자 ID                               |
| files       | File | `T1_0001.dcm`       | 첫 번째 파일                          |
| series_path | Text | `T1`                | 첫 번째 파일의 시리즈 경로            |
| files       | File | `T1_0002.dcm`       | 두 번째 파일                          |
| series_path | Text | `T1`                | 두 번째 파일도 T1 시리즈              |
| files       | File | `T2_0001.dcm`       | 세 번째 파일                          |
| series_path | Text | `T2`                | 세 번째 파일은 T2 시리즈              |
| ...         | ...  | ...                 | 필요한 만큼 반복                      |

- Postman에서는 동일 Key 이름(`files`, `series_path`) 으로 여러 줄 추가가 가능합니다.  
- `series_path` 를 폴더 구조처럼 `"T1/AX"`, `"T2/AX"` 이런 식으로 써도 문자열 그대로 SeriesDescription 으로 사용됩니다.

6. **Send** 클릭  
7. 응답 JSON에서:
   - `studyUid`, `studyId` 값 확인  
   - `orthancSeriesIds` 리스트 확인 → 이후 `/series/`, `/instances/` 에서 사용  

---

## 11. 디버깅 팁

- `settings.py` 에서:

```python
ORTHANC_BASE_URL = "http://localhost:8042"
ORTHANC_DEBUG_LOG = True
```

- 서버 실행 후 콘솔에서 `[INFO] ...` 로그를 보면:
  - `list_*` 결과 요약
  - `upload_patient` 업로드 결과
  - `get_instance_file` 호출 시 `content_length`
- Orthanc 인증 문제(예: 401 에러)가 발생하면:
  - Orthanc 쪽 설정(미들웨어, 인증 플러그인 등)을 먼저 확인  
  - 필요 시 `_get`, `_post_instance`, `_delete` 에 헤더 추가 가능  

---

이 내용을 그대로 복사해서 `orthancproxy-api.md` 같은 이름으로 저장하면,  
Orthanc 프록시 API 스펙 + Postman 테스트 가이드를 한 번에 사용할 수 있습니다.
