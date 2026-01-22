# OCS (Order Communication System) 제작 기획서

## 1. 개요

### 1.1 목적
기존 복잡한 다중 테이블 구조(OCS, RISRequest, LISRequest, TreatmentRequest, ConsultationRequest)를
**단일 OCS 테이블**로 통합하여 관리 효율성을 높인다.

### 1.2 설계 원칙
- **단순화**: 하나의 테이블로 모든 오더 관리
- **유연성**: JSON 필드를 활용한 확장 가능한 구조
- **추적성**: 상태별 시간 기록으로 전체 워크플로우 추적
- **보안성**: 확정 후 수정 불가 (Immutable)

---

## 2. 데이터베이스 설계

### 2.1 OCS 테이블 구조

```
┌──────────────────────────────────────────────────────────────────────┐
│                            OCS (단일 테이블)                           │
├──────────────────────────────────────────────────────────────────────┤
│ id                │ PK, Auto Increment                               │
│ ocs_id            │ 사용자 ID (ocs_0001) - unique                    │
├──────────────────────────────────────────────────────────────────────┤
│ ocs_status        │ ORDERED → ACCEPTED → IN_PROGRESS →               │
│                   │ RESULT_READY → CONFIRMED / CANCELLED             │
├──────────────────────────────────────────────────────────────────────┤
│ patient_id        │ FK → Patient (필수)                              │
│ doctor_id         │ FK → User (의사, 필수)                           │
│ worker_id         │ FK → User (작업자, nullable)                     │
│ encounter_id      │ FK → Encounter (nullable)                        │
├──────────────────────────────────────────────────────────────────────┤
│ job_role          │ RIS, LIS, TREATMENT, CONSULT 등                  │
│ job_type          │ 뇌종양 CDSS 전용:                                │
│                   │ - RIS: MRI, CT, PET                              │
│                   │ - LIS: CBC, CMP, Coagulation, Tumor Markers,     │
│                   │        GENE_PANEL, RNA_SEQ, DNA_SEQ, BIOMARKER   │
│                   │ - TREATMENT: SURGERY, RADIATION, CHEMOTHERAPY   │
├──────────────────────────────────────────────────────────────────────┤
│ doctor_request    │ JSON - 의사 요청 (템플릿 + 자유 필드)             │
│ worker_result     │ JSON - 작업 결과 (job_role별 템플릿 + 자유 필드)  │
│ attachments       │ JSON - 첨부파일 정보                              │
├──────────────────────────────────────────────────────────────────────┤
│ ocs_result        │ Boolean (True/False/None)                        │
├──────────────────────────────────────────────────────────────────────┤
│ created_at        │ 생성일시 (ORDERED)                               │
│ accepted_at       │ 접수일시 (ACCEPTED)                              │
│ in_progress_at    │ 진행시작일시 (IN_PROGRESS)                       │
│ result_ready_at   │ 결과대기일시 (RESULT_READY)                      │
│ confirmed_at      │ 확정일시 (CONFIRMED)                             │
│ cancelled_at      │ 취소일시 (CANCELLED)                             │
│ updated_at        │ 최종수정일시                                      │
├──────────────────────────────────────────────────────────────────────┤
│ priority          │ urgent, normal, scheduled                        │
│ is_deleted        │ Soft Delete                                      │
└──────────────────────────────────────────────────────────────────────┘
```

### 2.2 필드 상세 설명

#### 식별자
| 필드 | 타입 | 설명 |
|------|------|------|
| `id` | BigAutoField | PK, 자동 생성 |
| `ocs_id` | CharField(20) | 사용자 친화적 ID (예: ocs_0001), unique |

#### 상태 (ocs_status)
| 상태 | 설명 |
|------|------|
| `ORDERED` | 의사가 오더 생성 |
| `ACCEPTED` | 작업자가 오더 접수 |
| `IN_PROGRESS` | 작업 진행 중 |
| `RESULT_READY` | 결과 입력 완료, 의사 확인 대기 |
| `CONFIRMED` | 의사 확정 완료 (수정 불가) |
| `CANCELLED` | 취소됨 |

#### 관계 (Foreign Keys)
| 필드 | 타입 | 필수 | 설명 |
|------|------|------|------|
| `patient_id` | FK → Patient | ✅ | 환자 |
| `doctor_id` | FK → User | ✅ | 처방 의사 |
| `worker_id` | FK → User | ❌ | 현재 작업 담당자 (작업 중일 때만) |
| `encounter_id` | FK → Encounter | ❌ | 연관 진료 |

#### 취소 정보
| 필드 | 타입 | 설명 |
|------|------|------|
| `cancel_reason` | CharField(200) (nullable) | 취소 사유 |

#### 작업 구분
| 필드 | 타입 | 설명 |
|------|------|------|
| `job_role` | CharField(20) | RIS, LIS, TREATMENT, CONSULT 등 |
| `job_type` | CharField(50) | 뇌종양 CDSS 전용 - RIS: MRI/CT/PET, LIS: CBC/CMP/Coagulation/Tumor Markers/GENE_PANEL/RNA_SEQ/DNA_SEQ/BIOMARKER, TREATMENT: SURGERY/RADIATION/CHEMOTHERAPY |

#### 우선순위 (priority)
| 값 | 설명 |
|------|------|
| `urgent` | 긴급 |
| `normal` | 일반 |
| `scheduled` | 예약 |

---

## 3. JSON 필드 설계

### 3.1 doctor_request (의사 요청)

```json
{
  "_template": "default",
  "_version": "1.0",

  "chief_complaint": "두통 및 시야 흐림",
  "clinical_info": "고혈압 병력",
  "request_detail": "Brain MRI with contrast",
  "special_instruction": "조영제 알러지 확인",

  "_custom": {
    "추가필드1": "값1",
    "메모": "환자가 폐소공포증 있음"
  }
}
```

### 3.2 worker_result (작업 결과)

#### RIS용 템플릿 (DICOM 연동)
```json
{
  "_template": "RIS",
  "_version": "1.0",
  "_confirmed": false,

  "dicom": {
    "study_uid": "1.2.840.113619.2.55.3...",
    "series": [
      {
        "series_uid": "1.2.840...",
        "modality": "MR",
        "description": "T1 Axial",
        "instance_count": 24
      }
    ],
    "accession_number": "ACC20260109000"
  },

  "impression": "뇌종양 의심 소견",
  "findings": "우측 측두엽에 2.3cm 종괴 발견",
  "recommendation": "신경외과 협진 권유",

  "_custom": {
    "추가소견": "조영증강 패턴 확인됨"
  }
}
```

#### LIS용 템플릿
```json
{
  "_template": "LIS",
  "_version": "1.0",
  "_confirmed": false,

  "test_results": [
    {
      "code": "WBC",
      "name": "백혈구",
      "value": "12.5",
      "unit": "10^3/uL",
      "reference": "4.0-10.0",
      "is_abnormal": true
    },
    {
      "code": "CRP",
      "name": "C-반응단백",
      "value": "3.2",
      "unit": "mg/dL",
      "reference": "0-0.5",
      "is_abnormal": true
    }
  ],

  "summary": "염증 수치 상승",
  "interpretation": "감염 가능성 있음",

  "_custom": {}
}
```

#### TREATMENT용 템플릿
```json
{
  "_template": "TREATMENT",
  "_version": "1.0",
  "_confirmed": false,

  "procedure": "종양 절제술",
  "duration_minutes": 180,
  "anesthesia": "전신마취",
  "outcome": "성공적 완료",
  "complications": null,

  "_custom": {
    "출혈량": "200ml"
  }
}
```

### 3.3 attachments (첨부파일)

```json
{
  "files": [
    {
      "name": "brain_mri.png",
      "type": "image",
      "size": 512000,
      "preview": "image",
      "uploaded": true
    },
    {
      "name": "result.csv",
      "type": "csv",
      "size": 1024,
      "preview": "table",
      "uploaded": true
    },
    {
      "name": "report.pdf",
      "type": "pdf",
      "size": 204800,
      "preview": "iframe",
      "uploaded": true
    },
    {
      "name": "study.dcm",
      "type": "dicom",
      "size": 10485760,
      "preview": "none",
      "uploaded": false,
      "dicom_viewer_url": "ohif://study/1.2.3.4.5"
    }
  ],
  "zip_url": "https://storage.googleapis.com/cdss-bucket/ocs_0001/attachments.zip",
  "total_size": 11203584,
  "last_modified": "2026-01-08T10:30:00Z",
  "_custom": {}
}
```

#### 파일 미리보기 규칙
| type | preview | 처리 방법 |
|------|---------|-----------|
| `image` (png, jpg, gif) | `image` | `<img>` 태그 |
| `csv` | `table` | 파싱 후 테이블 렌더링 |
| `pdf` | `iframe` | `<iframe>` 또는 PDF.js |
| `dicom` | `none` | OHIF/Cornerstone 뷰어 링크 |
| 기타 | `download` | 다운로드 링크만 제공 |

---

## 4. localStorage 명명 규칙

### 4.1 키 패턴
```
CDSS_LOCAL_STORAGE:{job_role}:{ocs_id}:{type}
```

### 4.2 예시
| 패턴 | 예시 | 설명 |
|------|------|------|
| 의사 요청 Draft | `CDSS_LOCAL_STORAGE:DOCTOR:ocs_0001:request` | 의사가 작성 중인 요청 |
| 작업자 결과 Draft | `CDSS_LOCAL_STORAGE:RIS:ocs_0001:result` | RIS 작업자 임시저장 |
| 첨부파일 목록 | `CDSS_LOCAL_STORAGE:RIS:ocs_0001:files` | 업로드 대기 파일 목록 |
| 첨부파일 캐시 | `CDSS_LOCAL_STORAGE:RIS:ocs_0001:file:{filename}` | 개별 파일 데이터 |
| 동기화 메타 | `CDSS_LOCAL_STORAGE:RIS:ocs_0001:meta` | 동기화 상태 정보 |

### 4.3 React 사용 예시
```javascript
// 저장
const key = `CDSS_LOCAL_STORAGE:RIS:${ocsId}:result`;
localStorage.setItem(key, JSON.stringify(workerResult));

// 조회
const draft = JSON.parse(localStorage.getItem(key));

// 확정 후 삭제
localStorage.removeItem(key);
localStorage.removeItem(`CDSS_LOCAL_STORAGE:RIS:${ocsId}:files`);
```

### 4.4 동기화 메타 데이터
```json
{
  "last_synced_at": "2026-01-08T10:30:00Z",
  "server_version": 5,
  "local_version": 5,
  "is_dirty": false,
  "conflict": null
}
```

---

## 5. API 설계

### 5.1 기본 CRUD

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/ocs/` | OCS 목록 조회 |
| POST | `/api/ocs/` | OCS 생성 (의사) |
| GET | `/api/ocs/{id}/` | OCS 상세 조회 |
| PATCH | `/api/ocs/{id}/` | OCS 수정 (확정 전만 가능) |
| DELETE | `/api/ocs/{id}/` | OCS 삭제 (Soft Delete) |

### 5.2 상태 변경 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| POST | `/api/ocs/{id}/accept/` | 오더 접수 (ORDERED → ACCEPTED) |
| POST | `/api/ocs/{id}/start/` | 작업 시작 (ACCEPTED → IN_PROGRESS) |
| POST | `/api/ocs/{id}/save_result/` | 결과 임시 저장 (Draft) |
| POST | `/api/ocs/{id}/submit_result/` | 결과 제출 (IN_PROGRESS → RESULT_READY) |
| POST | `/api/ocs/{id}/confirm/` | 확정 (RESULT_READY → CONFIRMED) |
| POST | `/api/ocs/{id}/cancel/` | 취소 (→ CANCELLED) |

### 5.3 조회 API

| Method | Endpoint | 설명 |
|--------|----------|------|
| GET | `/api/ocs/by_ocs_id/?ocs_id=ocs_0001` | ocs_id로 조회 |
| GET | `/api/ocs/by_patient/?patient_id=1` | 환자별 OCS 목록 |
| GET | `/api/ocs/by_doctor/?doctor_id=1` | 의사별 OCS 목록 |
| GET | `/api/ocs/by_worker/?worker_id=1` | 작업자별 OCS 목록 |
| GET | `/api/ocs/pending/` | 미완료 OCS 목록 |

### 5.4 API 응답 예시

```json
{
  "id": 1,
  "ocs_id": "ocs_0001",
  "ocs_status": "IN_PROGRESS",
  "ocs_status_display": "진행 중",

  "patient": {
    "id": 1,
    "name": "홍길동",
    "patient_number": "P20260001"
  },
  "doctor": {
    "id": 2,
    "name": "김의사"
  },
  "worker": {
    "id": 3,
    "name": "이기사"
  },

  "job_role": "RIS",
  "job_type": "MRI",
  "priority": "normal",

  "doctor_request": { ... },
  "worker_result": { ... },
  "attachments": { ... },

  "ocs_result": null,

  "created_at": "2026-01-08T09:00:00Z",
  "accepted_at": "2026-01-08T09:30:00Z",
  "in_progress_at": "2026-01-08T10:00:00Z",
  "result_ready_at": null,
  "confirmed_at": null,

  "_localStorage": {
    "request_key": "CDSS_LOCAL_STORAGE:DOCTOR:ocs_0001:request",
    "result_key": "CDSS_LOCAL_STORAGE:RIS:ocs_0001:result",
    "files_key": "CDSS_LOCAL_STORAGE:RIS:ocs_0001:files"
  }
}
```

---

## 6. 워크플로우

### 6.1 기본 흐름

```
┌─────────┐    ┌─────────┐    ┌─────────────┐    ┌─────────────┐    ┌───────────┐
│ ORDERED │───▶│ ACCEPTED│───▶│ IN_PROGRESS │───▶│ RESULT_READY│───▶│ CONFIRMED │
└─────────┘    └─────────┘    └─────────────┘    └─────────────┘    └───────────┘
     │              │               │                   │
     │              │               │                   │
     └──────────────┴───────────────┴───────────────────┘
                              │
                              ▼
                        ┌───────────┐
                        │ CANCELLED │
                        └───────────┘
```

### 6.2 역할별 권한

| 역할 | 가능한 작업 |
|------|------------|
| 의사 (Doctor) | OCS 생성, 확정, 취소 |
| 작업자 (Worker) | 접수, 작업 시작, 결과 저장/제출 |
| 관리자 (Admin) | 전체 권한 |

### 6.3 상태별 수정 가능 여부

| 상태 | doctor_request | worker_result | 삭제 |
|------|----------------|---------------|------|
| ORDERED | ✅ | ❌ | ✅ |
| ACCEPTED | ❌ | ✅ | ✅ |
| IN_PROGRESS | ❌ | ✅ | ❌ |
| RESULT_READY | ❌ | ✅ | ❌ |
| CONFIRMED | ❌ | ❌ | ❌ |
| CANCELLED | ❌ | ❌ | ❌ |

---

## 7. 선택적 확장 기능

### 7.1 OCSHistory (로그 테이블) - 필수 
반영됨

작업자 변경, 취소 등 모든 이력을 추적하기 위한 감사(Audit) 테이블.

```
┌─────────────────────────────────────────────────┐
│                   OCSHistory                     │
├─────────────────────────────────────────────────┤
│ id              │ PK                            │
│ ocs             │ FK → OCS                      │
│ action          │ CREATED, ACCEPTED, CANCELLED, │
│                 │ STARTED, SUBMITTED, CONFIRMED,│
│                 │ WORKER_CHANGED, RESULT_SAVED  │
│ actor           │ FK → User (누가 변경했는지)    │
│ from_status     │ 이전 상태 (nullable)          │
│ to_status       │ 변경된 상태 (nullable)        │
│ from_worker     │ 이전 작업자 (nullable)         │
│ to_worker       │ 변경된 작업자 (nullable)       │
│ reason          │ 취소/변경 사유 (nullable)      │
│ created_at      │ 변경 시점                      │
│ snapshot_json   │ 변경 시점 데이터 (선택)        │
│ ip_address      │ 접속 IP (보안용, 선택)         │
└─────────────────────────────────────────────────┘
```

#### Action 종류
| Action | 설명 |
|--------|------|
| `CREATED` | OCS 생성 |
| `ACCEPTED` | 작업자가 오더 수락 |
| `CANCELLED` | 작업 취소 (worker → null) |
| `STARTED` | 작업 시작 |
| `SUBMITTED` | 결과 제출 |
| `CONFIRMED` | 의사 확정 |
| `WORKER_CHANGED` | 작업자 변경 |
| `RESULT_SAVED` | 결과 임시 저장 |

#### 시나리오 예시: 작업자 A 수락 → 취소 → 작업자 B 수락

```
OCSHistory 기록:
1. {action: ACCEPTED, actor: A, to_worker: A, to_status: ACCEPTED}
2. {action: CANCELLED, actor: A, from_worker: A, to_worker: null, reason: "개인 사유", to_status: ORDERED}
3. {action: ACCEPTED, actor: B, to_worker: B, to_status: ACCEPTED}

OCS 테이블 현재 상태:
- worker_id: B (현재 담당자)
- ocs_status: ACCEPTED
- cancel_reason: null (현재 취소 상태 아님)

※ 취소 이력은 OCSHistory에서 조회
```

### 7.2 통계용 Property - 선택

```python
@property
def turnaround_time(self):
    """오더 → 확정까지 소요 시간 (분)"""
    if self.confirmed_at and self.created_at:
        return (self.confirmed_at - self.created_at).total_seconds() / 60
    return None

@property
def work_time(self):
    """작업 시작 → 결과 완료 소요 시간 (분)"""
    if self.result_ready_at and self.in_progress_at:
        return (self.result_ready_at - self.in_progress_at).total_seconds() / 60
    return None
```

### 7.3 알림 필드 - 선택

```python
notify_on_result = models.BooleanField(default=True)  # 결과 알림
notify_on_confirm = models.BooleanField(default=True)  # 확정 알림
urgent_callback = models.CharField(max_length=20, blank=True)  # 긴급 연락처
```

---

## 8. 구현 체크리스트

### 8.1 필수 구현
- [x] OCS 모델 작성 ✅
- [x] OCSHistory 로그 테이블 작성 ✅
- [x] OCS Serializer 작성 ✅
- [x] OCS ViewSet 작성 ✅
- [x] URL 라우팅 설정 ✅
- [x] Admin 설정 ✅
- [x] 마이그레이션 생성 및 적용 ✅

### 8.2 선택적 구현
- [x] 통계용 Property ✅ (turnaround_time, work_time)
- [ ] 알림 기능
- [ ] 첨부파일 보안 강화

---

## 9. 추가 고려사항

### 9.1 동시성 처리
- 여러 작업자가 동시에 같은 OCS를 수락하려 할 때 처리
- **해결**: `select_for_update()` 또는 DB 트랜잭션 사용

```python
from django.db import transaction

@transaction.atomic
def accept_ocs(ocs_id, worker):
    ocs = OCS.objects.select_for_update().get(id=ocs_id)
    if ocs.worker_id is not None:
        raise ValidationError("이미 다른 작업자가 수락했습니다.")
    ocs.worker = worker
    ocs.ocs_status = 'ACCEPTED'
    ocs.accepted_at = timezone.now()
    ocs.save()
```

### 9.2 작업자 취소 시 상태 복구
- 작업자가 취소하면 `worker_id = null`, `ocs_status = ORDERED`로 복구
- 취소 이력은 `OCSHistory`에 기록 (누가, 언제, 왜)

### 9.3 의사의 OCS 취소 vs 작업자의 작업 취소
| 주체 | 상황 | 결과 |
|------|------|------|
| 의사 | OCS 전체 취소 | `ocs_status = CANCELLED`, 복구 불가 |
| 작업자 | 수락한 작업 취소 | `ocs_status = ORDERED`, 다른 작업자 수락 가능 |

### 9.4 재할당 (Reassign)
- 관리자가 작업자를 강제로 변경하는 경우
- `WORKER_CHANGED` action으로 기록

### 9.5 만료 처리 (선택)
- 일정 시간 내 수락되지 않은 OCS 자동 알림
- 긴급(urgent) OCS는 별도 처리

### 9.6 검색/필터링 요구사항
| 필터 | 설명 |
|------|------|
| `job_role` | RIS, LIS 등 역할별 |
| `ocs_status` | 상태별 |
| `priority` | 우선순위별 |
| `worker_id = null` | 미배정 OCS 목록 |
| `doctor_id` | 특정 의사의 OCS |
| `patient_id` | 특정 환자의 OCS |
| `created_at` 범위 | 기간별 조회 |

### 9.7 권한 검증
```python
# ViewSet에서 권한 체크 예시
def accept(self, request, pk=None):
    ocs = self.get_object()

    # job_role에 맞는 권한 확인
    if ocs.job_role == 'RIS' and not request.user.has_role('RIS_WORKER'):
        raise PermissionDenied("RIS 작업 권한이 없습니다.")

    # 이미 배정된 경우
    if ocs.worker_id is not None:
        raise ValidationError("이미 배정된 OCS입니다.")
```

---

## 10. 변경 이력

| 날짜 | 버전 | 변경 내용 |
|------|------|----------|
| 2026-01-08 | 1.0 | 초안 작성 |
| 2026-01-08 | 1.1 | OCSHistory 필수로 변경, 고려사항 추가 |
| 2026-01-08 | 1.2 | cancel_reason 필드만 유지, 취소 이력은 OCSHistory에서 관리 |
| 2026-01-08 | 1.3 | 구현 완료 (models, serializers, views, urls, admin) |
| 2026-01-08 | 1.4 | 마이그레이션 적용 완료 |
| 2026-01-08 | 1.5 | Frontend 연동 (types, services, pages, routeMap) |
| 2026-01-08 | 1.6 | 권한 체크 강화 (permissions.py), 테스트 코드 작성 |
