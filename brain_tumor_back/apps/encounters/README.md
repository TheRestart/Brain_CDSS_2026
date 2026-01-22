# Encounter Management (진료 관리)

뇌종양 CDSS의 진료 관리 모듈입니다.

## 개요

환자의 진료 정보를 관리하는 모듈로, 외래/입원/응급 진료 기록을 생성하고 추적합니다.

## 주요 기능

### 1. 진료 등록
- 진료 유형 선택 (외래/입원/응급)
- 진료과 선택 (신경과/신경외과)
- 담당 의사 지정
- 주 호소 및 진단명 기록
- 입원/퇴원 일시 관리

### 2. 진료 조회
- **목록 조회**: 페이지네이션, 검색, 필터링
- **상세 조회**: 진료 상세 정보 및 환자 정보
- 진료 유형별 조회
- 상태별 조회 (예정/진행중/완료/취소)
- 진료과별 조회
- 담당 의사별 조회
- 환자별 진료 이력

### 3. 진료 수정
- 진료 상태 변경
- 담당 의사 변경
- 진단명 수정
- 입원/퇴원 일시 수정

### 4. 진료 삭제
- Soft Delete (is_deleted 플래그 사용)
- 시스템 관리자만 가능

### 5. 진료 관리 기능
- 진료 완료 처리
- 진료 취소
- 진료 통계 조회

### 6. 특수 기능
- **입원중 환자 표시**: 퇴원 일시가 NULL이면 자동으로 '(입원중)' 표시
- **검색 가능한 Select**: 환자/의사 검색 후 선택 가능
- **의사 필터링**: 담당 의사 선택 시 DOCTOR role 사용자만 표시
- **페이지네이션**: 목록 조회 시 20건/페이지로 제공

## 데이터 모델

### Encounter (진료)

```python
{
    "id": 1,
    "patient": 1,                           # 환자 ID
    "patient_name": "김철수",                # 환자명
    "patient_number": "P202600001",         # 환자번호
    "encounter_type": "inpatient",          # 진료 유형 (outpatient/inpatient/emergency)
    "status": "in-progress",                # 상태 (scheduled/in-progress/completed/cancelled)
    "attending_doctor": 2,                  # 담당 의사 ID
    "attending_doctor_name": "doctor1",     # 담당 의사명
    "department": "neurosurgery",           # 진료과 (neurology/neurosurgery)
    "admission_date": "2026-01-02T09:00:00Z", # 입원/진료 일시
    "discharge_date": null,                 # 퇴원 일시
    "chief_complaint": "급성 두통 및 시야 장애", # 주 호소
    "primary_diagnosis": "뇌종양 의심",       # 주 진단명
    "secondary_diagnoses": ["고혈압", "당뇨"], # 부 진단명 (JSON 배열)
    "duration_days": null,                  # 재원 기간 (일수)
    "is_active": true,                      # 활성 진료 여부
    "created_at": "2026-01-07T10:00:00Z",
    "updated_at": "2026-01-07T10:00:00Z"
}
```

## API 엔드포인트

### 진료 목록 조회
```
GET /api/encounters/
```

**Query Parameters:**
- `q`: 검색어 (환자명, 환자번호, 주호소)
- `encounter_type`: 진료 유형 (outpatient/inpatient/emergency)
- `status`: 진료 상태 (scheduled/in-progress/completed/cancelled)
- `department`: 진료과 (neurology/neurosurgery)
- `attending_doctor`: 담당 의사 ID
- `patient`: 환자 ID
- `start_date`: 진료 시작일 (YYYY-MM-DD)
- `end_date`: 진료 종료일 (YYYY-MM-DD)
- `page`: 페이지 번호 (기본값: 1)
- `page_size`: 페이지 크기 (기본값: 20, 최대: 100)

**Response:**
```json
{
    "count": 10,
    "next": null,
    "previous": null,
    "results": [
        {
            "id": 1,
            "patient": 1,
            "patient_name": "김철수",
            "patient_number": "P202600001",
            "encounter_type": "inpatient",
            "encounter_type_display": "입원",
            "status": "in-progress",
            "status_display": "진행중",
            "attending_doctor": 2,
            "attending_doctor_name": "doctor1",
            "department": "neurosurgery",
            "department_display": "신경외과",
            "admission_date": "2026-01-02T09:00:00Z",
            "discharge_date": null,
            "chief_complaint": "급성 두통 및 시야 장애",
            "created_at": "2026-01-07T10:00:00Z"
        }
    ]
}
```

### 진료 상세 조회
```
GET /api/encounters/{id}/
```

**Response:**
```json
{
    "id": 1,
    "patient": 1,
    "patient_name": "김철수",
    "patient_number": "P202600001",
    "patient_gender": "M",
    "patient_age": 44,
    "encounter_type": "inpatient",
    "encounter_type_display": "입원",
    "status": "in-progress",
    "status_display": "진행중",
    "attending_doctor": 2,
    "attending_doctor_name": "doctor1",
    "department": "neurosurgery",
    "department_display": "신경외과",
    "admission_date": "2026-01-02T09:00:00Z",
    "discharge_date": null,
    "duration_days": null,
    "chief_complaint": "급성 두통 및 시야 장애",
    "primary_diagnosis": "뇌종양 의심",
    "secondary_diagnoses": ["고혈압", "당뇨"],
    "is_active": true,
    "created_at": "2026-01-07T10:00:00Z",
    "updated_at": "2026-01-07T10:00:00Z"
}
```

### 진료 등록
```
POST /api/encounters/
```

**권한:** DOCTOR, SYSTEMMANAGER

**Request Body:**
```json
{
    "patient": 1,
    "encounter_type": "inpatient",
    "status": "scheduled",
    "attending_doctor": 2,
    "department": "neurosurgery",
    "admission_date": "2026-01-10T09:00:00Z",
    "discharge_date": null,
    "chief_complaint": "두통 및 시야 장애",
    "primary_diagnosis": "뇌종양 의심",
    "secondary_diagnoses": ["고혈압"]
}
```

### 진료 수정
```
PUT /api/encounters/{id}/
PATCH /api/encounters/{id}/
```

**권한:** DOCTOR, SYSTEMMANAGER

**Request Body (PATCH 예시):**
```json
{
    "status": "completed",
    "discharge_date": "2026-01-15T14:00:00Z",
    "primary_diagnosis": "교모세포종"
}
```

### 진료 삭제
```
DELETE /api/encounters/{id}/
```

**권한:** SYSTEMMANAGER (Soft Delete)

### 진료 완료 처리
```
POST /api/encounters/{id}/complete/
```

**권한:** DOCTOR, SYSTEMMANAGER

진료 상태를 'completed'로 변경하고, 퇴원일시가 없으면 현재 시각으로 설정합니다.

### 진료 취소
```
POST /api/encounters/{id}/cancel/
```

**권한:** DOCTOR, SYSTEMMANAGER

진료 상태를 'cancelled'로 변경합니다. 완료된 진료는 취소할 수 없습니다.

### 진료 통계
```
GET /api/encounters/statistics/
```

**Response:**
```json
{
    "total": 10,
    "by_type": {
        "outpatient": {"label": "외래", "count": 5},
        "inpatient": {"label": "입원", "count": 3},
        "emergency": {"label": "응급", "count": 2}
    },
    "by_status": {
        "scheduled": {"label": "예정", "count": 2},
        "in-progress": {"label": "진행중", "count": 2},
        "completed": {"label": "완료", "count": 5},
        "cancelled": {"label": "취소", "count": 1}
    },
    "by_department": {
        "neurology": {"label": "신경과", "count": 5},
        "neurosurgery": {"label": "신경외과", "count": 5}
    }
}
```

## 권한 체계

| 액션 | DOCTOR | NURSE | SYSTEMMANAGER |
|------|--------|-------|---------------|
| 목록 조회 | ✅ | ✅ | ✅ |
| 상세 조회 | ✅ | ✅ | ✅ |
| 진료 등록 | ✅ | ❌ | ✅ |
| 진료 수정 | ✅ | ❌ | ✅ |
| 진료 삭제 | ❌ | ❌ | ✅ |
| 진료 완료 | ✅ | ❌ | ✅ |
| 진료 취소 | ✅ | ❌ | ✅ |
| 통계 조회 | ✅ | ✅ | ✅ |

## 유효성 검사

### 진료 등록/수정 시
1. **환자 유효성**
   - 삭제된 환자가 아닌지 확인
   - 활성 상태(active)인 환자인지 확인

2. **담당 의사 유효성**
   - 의사(DOCTOR) 역할인지 확인

3. **날짜 유효성**
   - 퇴원 일시 >= 입원 일시
   - **특별 규칙**: 퇴원 일시 = 입원 일시인 경우 → 퇴원 일시를 NULL로 설정 (입원중 상태)

## 더미 데이터 생성

```bash
cd brain_tumor_back
python manage.py shell -c "exec(open('apps/encounters/create_dummy_encounters.py', encoding='utf-8').read())"
```

30개의 진료 더미 데이터를 생성합니다:
- 다양한 진료 유형 (외래/입원/응급)
- 다양한 상태 (예정/진행중/완료/취소)
- 다양한 진료과 (신경과/신경외과)
- 실제 환자 및 의사와 연결
- 입원중 및 퇴원완료 데이터 포함
- 랜덤하게 담당 의사 배정

## 인덱스

성능 최적화를 위해 다음 필드에 인덱스가 생성됩니다:
- `patient` + `admission_date` (환자별 진료 이력 조회)
- `attending_doctor` + `admission_date` (의사별 진료 목록 조회)
- `status` (상태별 진료 조회)

## 관련 모델

- **Patient**: 환자 정보 (apps.patients)
- **User**: 담당 의사 정보 (apps.accounts)

## 비즈니스 로직

### 재원 기간 계산
```python
@property
def duration_days(self):
    """재원 기간 (일수)"""
    if self.discharge_date and self.admission_date:
        return (self.discharge_date - self.admission_date).days
    return None
```

### 활성 진료 여부
```python
@property
def is_active(self):
    """활성 진료 여부"""
    return self.status in ['scheduled', 'in-progress'] and not self.is_deleted
```

## 구현 세부사항

### 백엔드 구조

#### Serializers
- **EncounterListSerializer**: 진료 목록 조회용 (간단한 필드만 포함)
- **EncounterDetailSerializer**: 진료 상세 조회용 (모든 필드 + 환자 정보)
- **EncounterCreateSerializer**: 진료 등록용 (유효성 검사 포함)
- **EncounterUpdateSerializer**: 진료 수정용 (유효성 검사 포함)
- **EncounterSearchSerializer**: 검색 파라미터 검증용

#### ViewSet
- **EncounterViewSet**: ModelViewSet 기반
  - `list()`: 목록 조회 (페이지네이션, 검색, 필터링)
  - `retrieve()`: 상세 조회
  - `create()`: 진료 등록
  - `update()` / `partial_update()`: 진료 수정
  - `destroy()`: 진료 삭제 (Soft Delete)
  - `complete()`: 진료 완료 (커스텀 액션)
  - `cancel()`: 진료 취소 (커스텀 액션)
  - `statistics()`: 진료 통계 (커스텀 액션)

#### 페이지네이션
```python
class EncounterPagination(PageNumberPagination):
    """진료 목록 페이지네이션"""
    page_size = 20
    page_size_query_param = 'page_size'
    max_page_size = 100
```

#### 권한 체크 로직
```python
def perform_create(self, serializer):
    # DOCTOR, SYSTEMMANAGER만 진료 등록 가능
    if self.request.user.role.code not in ['DOCTOR', 'SYSTEMMANAGER']:
        raise PermissionDenied("진료를 등록할 권한이 없습니다.")
    serializer.save()

def perform_destroy(self, instance):
    # SYSTEMMANAGER만 진료 삭제 가능
    if self.request.user.role.code != 'SYSTEMMANAGER':
        raise PermissionDenied("진료를 삭제할 권한이 없습니다.")
    instance.is_deleted = True
    instance.save()
```

### 프론트엔드 구조

#### 주요 컴포넌트
- **EncounterListPage.tsx**: 진료 목록 페이지 (검색, 필터링, 페이지네이션)
- **EncounterListTable.tsx**: 진료 목록 테이블 (권한 기반 버튼 표시)
- **EncounterCreateModal.tsx**: 진료 등록 모달
  - 검색 가능한 환자 선택 (환자번호/이름 검색)
  - 검색 가능한 의사 선택 (DOCTOR role만 표시)
  - 부 진단명 다중 입력 (태그 방식)
  - 퇴원 일시 = 입원 일시 처리 안내

#### API 호출
```typescript
// services/encounter.api.ts
export const getEncounters = (params: any) => {
  return api.get('/encounters/', { params });
};

export const createEncounter = (data: EncounterCreateData) => {
  return api.post('/encounters/', data);
};

export const updateEncounter = (id: number, data: Partial<EncounterCreateData>) => {
  return api.patch(`/encounters/${id}/`, data);
};

export const deleteEncounter = (id: number) => {
  return api.delete(`/encounters/${id}/`);
};
```

#### 의사 필터링 로직
```typescript
const loadDoctors = async () => {
  // 모든 사용자 조회 후 DOCTOR role만 필터링
  const response = await api.get('/users/', {
    params: { page_size: 1000 }
  });
  const userList = Array.isArray(response.data) ? response.data : response.data.results || [];
  const doctorList = userList.filter((user: any) => user.role?.code === 'DOCTOR');
  setDoctors(doctorList);
};
```

#### 입원중 표시 로직
```typescript
// 테이블에서 퇴원 일시가 NULL이면 "(입원중)" 표시
<td>
  {e.discharge_date ? formatDateTime(e.discharge_date) :
    <span style={{ color: '#1976d2', fontWeight: 500 }}>(입원중)</span>
  }
</td>
```

## 향후 확장 계획

1. **진료 기록 상세화**
   - 진료 노트 (Encounter Note)
   - 처방 정보 연동
   - 검사 오더 연동

2. **알림 기능**
   - 예정된 진료 알림
   - 진료 상태 변경 알림

3. **리포트 기능**
   - 진료 이력 리포트
   - 재원 기간 분석
   - 진료과별 통계

4. **워크플로우 자동화**
   - 진료 상태 자동 업데이트
   - 검사 오더 자동 생성

## 트러블슈팅

### 의사 목록이 표시되지 않는 경우
- `/api/auth/roles/` 엔드포인트는 존재하지 않습니다.
- `/api/users/` 엔드포인트에서 모든 사용자 조회 후 `role.code === 'DOCTOR'`로 필터링하세요.

### 페이지네이션이 작동하지 않는 경우
- ViewSet에 `pagination_class = EncounterPagination` 설정 확인
- 프론트엔드에서 `response.data.results` 또는 직접 배열 처리 확인

### 퇴원 일시 입력 시 주의사항
- 퇴원 일시를 입원 일시와 동일하게 설정하면 자동으로 NULL로 처리됩니다.
- 이는 "입원중" 상태를 나타내기 위한 규칙입니다.
