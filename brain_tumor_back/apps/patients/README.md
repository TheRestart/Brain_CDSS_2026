# Patient Management Module

환자 관리 모듈 - Brain Tumor CDSS의 핵심 환자 정보 관리 시스템

## 📋 목차

- [개요](#개요)
- [주요 기능](#주요-기능)
- [데이터 모델](#데이터-모델)
- [API 엔드포인트](#api-엔드포인트)
- [프론트엔드 구조](#프론트엔드-구조)
- [사용 방법](#사용-방법)
- [권한 관리](#권한-관리)

---

## 개요

**Patient Management** 모듈은 뇌종양 CDSS의 환자 기본 정보를 관리하는 핵심 모듈입니다.

### 기술 스택

- **Backend**: Django REST Framework
- **Database**: MySQL
- **Frontend**: React (TypeScript + Vite)
- **인증**: JWT + RBAC (기존 accounts 앱 활용)

### 주요 특징

- ✅ 환자 CRUD (생성, 조회, 수정, 삭제)
- ✅ 환자번호 자동 생성 (`P{연도}{일련번호}`)
- ✅ Soft Delete 패턴 (복구 가능한 삭제)
- ✅ 3-Gender 지원 (M/F/O)
- ✅ 검색 및 필터링 (이름, 환자번호, 전화번호, 성별, 상태)
- ✅ 페이지네이션 (기본 20건/페이지)
- ✅ 역할 기반 접근 제어 (DOCTOR, NURSE, SYSTEMMANAGER)

---

## 주요 기능

### 1. 환자 등록
- 환자 기본 정보 입력 (이름, 생년월일, 성별, 연락처, 주민등록번호)
- 의료 정보 입력 (혈액형, 알레르기, 기저질환)
- 환자번호 자동 생성 (예: P202600001)
- 폼 유효성 검사 (전화번호 형식, 주민등록번호 13자리)

### 2. 환자 조회
- **목록 조회**: 페이지네이션, 검색, 필터링, 혈액형 표시
- **상세 조회**: 별도 페이지로 환자 기본 정보 표시 (환자번호, 이름, 나이, 성별)
  - 상세 페이지 URL: `/patients/:patientId`
  - 탭 기반 UI (요약, 영상, 검사, AI - 추후 모듈 구현 시 연동)
- 환자 상태별 조회 (active/inactive/deceased)
- 성별별 조회 (남성/여성/기타)

### 3. 환자 수정
- 이름, 연락처, 주소 등 기본 정보 수정
- 혈액형, 알레르기, 기저질환 수정
- 환자 상태 변경 (활성/비활성/사망)
- 환자번호, 생년월일은 수정 불가

### 4. 환자 삭제
- Soft Delete 방식 (is_deleted 플래그)
- 삭제 확인 모달로 실수 방지
- 삭제된 환자는 목록에서 제외
- 실제 데이터는 DB에 유지 (복구 가능)

---

## 데이터 모델

### Patient Model

```python
class Patient(models.Model):
    # 기본 정보
    patient_number = CharField(max_length=20, unique=True)  # 자동 생성: P{year}{sequence}
    name = CharField(max_length=100)
    birth_date = DateField()
    gender = CharField(max_length=1, choices=[('M', '남성'), ('F', '여성'), ('O', '기타')])
    ssn = CharField(max_length=255, unique=True)  # 암호화 저장

    # 연락처
    phone = CharField(max_length=20)
    email = CharField(max_length=100, blank=True, null=True)
    address = TextField(blank=True, null=True)

    # 의료 정보
    blood_type = CharField(max_length=3, choices=[...], blank=True, null=True)
    allergies = JSONField(default=list)  # ["페니실린", "땅콩"]
    chronic_diseases = JSONField(default=list)  # ["고혈압", "당뇨"]

    # 상태 관리
    status = CharField(max_length=10, choices=[('active', '활성'), ('inactive', '비활성'), ('deceased', '사망')], default='active')
    is_deleted = BooleanField(default=False)

    # 감사 추적
    registered_by = ForeignKey(User, on_delete=SET_NULL, null=True, related_name='registered_patients')
    updated_by = ForeignKey(User, on_delete=SET_NULL, null=True, related_name='updated_patients')
    deleted_by = ForeignKey(User, on_delete=SET_NULL, null=True, related_name='deleted_patients')
    created_at = DateTimeField(auto_now_add=True)
    updated_at = DateTimeField(auto_now=True)
    deleted_at = DateTimeField(null=True, blank=True)
```

### 주요 필드 설명

| 필드 | 타입 | 설명 |
|------|------|------|
| `patient_number` | CharField | 환자번호 (자동 생성, Unique) |
| `ssn` | CharField | 주민등록번호 (암호화 저장) |
| `allergies` | JSONField | 알레르기 목록 (배열) |
| `chronic_diseases` | JSONField | 기저질환 목록 (배열) |
| `is_deleted` | BooleanField | Soft Delete 플래그 |
| `registered_by` | ForeignKey | 등록한 사용자 |

---

## API 엔드포인트

### Base URL
```
http://localhost:8000/api/patients/
```

### 1. 환자 목록 조회
```http
GET /api/patients/
```

**Query Parameters:**
- `page` (int): 페이지 번호 (기본: 1)
- `page_size` (int): 페이지 크기 (기본: 20)
- `q` (string): 검색어 (이름, 환자번호, 전화번호)
- `gender` (string): 성별 필터 (M/F/O)
- `status` (string): 상태 필터 (active/inactive/deceased)

**Response:**
```json
{
  "count": 100,
  "next": "http://localhost:8000/api/patients/?page=2",
  "previous": null,
  "results": [
    {
      "id": 1,
      "patient_number": "P202600001",
      "name": "홍길동",
      "birth_date": "1990-01-15",
      "gender": "M",
      "phone": "010-1234-5678",
      "email": "hong@example.com",
      "address": "서울시 강남구",
      "blood_type": "A+",
      "allergies": ["페니실린"],
      "chronic_diseases": ["고혈압"],
      "status": "active",
      "age": 36,
      "registered_by_name": "김의사",
      "created_at": "2026-01-07T10:30:00Z",
      "updated_at": "2026-01-07T10:30:00Z"
    }
  ]
}
```

### 2. 환자 상세 조회
```http
GET /api/patients/{id}/
```

**Response:**
```json
{
  "id": 1,
  "patient_number": "P202600001",
  "name": "홍길동",
  "birth_date": "1990-01-15",
  "gender": "M",
  "phone": "010-1234-5678",
  "email": "hong@example.com",
  "address": "서울시 강남구",
  "blood_type": "A+",
  "allergies": ["페니실린"],
  "chronic_diseases": ["고혈압"],
  "status": "active",
  "age": 36,
  "registered_by_name": "김의사",
  "created_at": "2026-01-07T10:30:00Z",
  "updated_at": "2026-01-07T10:30:00Z"
}
```

### 3. 환자 등록
```http
POST /api/patients/
Content-Type: application/json
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "name": "홍길동",
  "birth_date": "1990-01-15",
  "gender": "M",
  "ssn": "9001151234567",
  "phone": "010-1234-5678",
  "email": "hong@example.com",
  "address": "서울시 강남구",
  "blood_type": "A+",
  "allergies": ["페니실린"],
  "chronic_diseases": ["고혈압"]
}
```

**Response:** `201 Created`
```json
{
  "id": 1,
  "patient_number": "P202600001",
  "name": "홍길동",
  ...
}
```

### 4. 환자 수정
```http
PUT /api/patients/{id}/
Content-Type: application/json
Authorization: Bearer {access_token}
```

**Request Body:**
```json
{
  "name": "홍길동",
  "phone": "010-9999-8888",
  "email": "newemail@example.com",
  "address": "서울시 서초구",
  "blood_type": "A+",
  "allergies": ["페니실린", "땅콩"],
  "chronic_diseases": ["고혈압", "당뇨"],
  "status": "active"
}
```

**Response:** `200 OK`

### 5. 환자 삭제 (Soft Delete)
```http
DELETE /api/patients/{id}/
Authorization: Bearer {access_token}
```

**Response:** `204 No Content`

### 6. 환자 검색 (자동완성)
```http
GET /api/patients/search/?q={query}
```

**Response:**
```json
[
  {
    "id": 1,
    "patient_number": "P202600001",
    "name": "홍길동",
    "phone": "010-1234-5678",
    ...
  }
]
```

### 7. 환자 통계
```http
GET /api/patients/statistics/
```

**Response:**
```json
{
  "total_patients": 100,
  "active_patients": 85,
  "inactive_patients": 10,
  "deceased_patients": 5,
  "gender_distribution": {
    "M": 60,
    "F": 38,
    "O": 2
  }
}
```

---

## 프론트엔드 구조

### 디렉토리 구조

```
brain_tumor_front/src/
├── pages/patient/
│   ├── PatientListPage.tsx          # 환자 목록 페이지
│   ├── PatientListTable.tsx         # 환자 테이블 컴포넌트
│   ├── PatientDetailPage.tsx        # 환자 상세 페이지
│   ├── PatientDetailContent.tsx     # 상세 페이지 컨텐츠
│   ├── PatientDetailTabs.tsx        # 상세 페이지 탭
│   ├── PatientCreateModal.tsx       # 환자 등록 모달
│   ├── PatientEditModal.tsx         # 환자 수정 모달
│   ├── PatientViewModal.tsx         # 환자 조회 모달 (deprecated)
│   ├── PatientDeleteModal.tsx       # 환자 삭제 확인 모달
│   ├── PatientCreateModal.css       # 모달 공통 스타일
│   └── tabs/
│       ├── SummaryTab.tsx           # 요약 탭
│       ├── ImagingTab.tsx           # 영상 탭 (추후 구현)
│       ├── LabResultTab.tsx         # 검사 결과 탭 (추후 구현)
│       └── AiSummaryTab.tsx         # AI 분석 탭 (추후 구현)
├── services/
│   └── patient.api.ts               # Patient API 서비스
├── types/
│   └── patient.ts                   # Patient 타입 정의
└── assets/style/
    ├── patientListView.css          # 목록 페이지 스타일
    └── patientDetailView.css        # 상세 페이지 스타일
```

### 주요 컴포넌트

#### 1. PatientListPage
- 환자 목록 조회 및 검색
- 페이지네이션
- 필터링 (성별, 상태)
- 환자 등록 버튼 (DOCTOR, NURSE, SYSTEMMANAGER만)
- 모달 상태 관리 (등록, 수정, 삭제)

#### 2. PatientListTable
- 환자 데이터 테이블 표시
- 액션 버튼 (상세, 편집, 삭제)
- 상세 버튼 클릭 시 상세 페이지로 이동
- 편집/삭제 버튼은 권한이 있는 사용자에게만 표시

#### 3. PatientDetailPage
- 환자 기본 정보 헤더
- 탭 네비게이션 (요약, 영상, 검사, AI)
- 실제 API 데이터 로딩 및 표시

#### 4. SummaryTab
- 환자 기본 정보 카드
- 의료 정보 카드 (알레르기, 기저질환)
- 등록 정보 (등록자, 등록일, 수정일)
- 추후 구현 예정 섹션 (영상, 검사, AI)

#### 5. PatientCreateModal
- 환자 등록 폼
- 3개 섹션: 기본정보, 연락처, 의료정보
- 태그 입력 방식 (알레르기, 기저질환)
- 클라이언트 유효성 검사

#### 6. PatientEditModal
- 환자 정보 수정 폼
- 환자번호, 생년월일 수정 불가
- 기존 데이터 pre-fill

#### 7. PatientDeleteModal
- 삭제 확인 모달
- 환자 정보 표시
- Soft Delete 안내 메시지

---

## 사용 방법

### 1. 더미 데이터 생성

개발/테스트를 위한 더미 환자 데이터 생성:

```bash
cd brain_tumor_back
python manage.py create_dummy_patients
```

**생성되는 데이터:**
- 10명의 환자 (P202600001 ~ P202600010)
- 다양한 나이, 성별, 혈액형
- 알레르기 및 기저질환 샘플 데이터

### 2. 서버 실행

**Django 백엔드:**
```bash
cd brain_tumor_back
python manage.py runserver
```

**React 프론트엔드:**
```bash
cd brain_tumor_front
npm run dev
```

### 3. 환자 관리 접근

1. 로그인 (DOCTOR, NURSE, SYSTEMMANAGER 역할)
2. 사이드바에서 "환자 관리" 메뉴 클릭
3. 환자 목록 페이지로 이동 (`/patients`)

### 4. 환자 등록

1. "환자 등록" 버튼 클릭
2. 환자 정보 입력:
   - **기본정보**: 이름, 생년월일, 성별, 주민등록번호, 혈액형
   - **연락처**: 전화번호, 이메일, 주소
   - **의료정보**: 알레르기, 기저질환
3. "등록" 버튼 클릭

**주의사항:**
- 전화번호: `010-1234-5678` 형식
- 주민등록번호: 13자리 숫자
- 알레르기/기저질환: 엔터로 태그 추가

### 5. 환자 검색 및 필터링

**검색:**
- 검색창에 환자명, 환자번호, 전화번호 입력
- 실시간 검색 결과 표시

**필터링:**
- 상태: 전체 / 활성 / 비활성 / 사망
- 성별: 전체 / 남성 / 여성 / 기타

### 6. 환자 상세 조회

1. 목록에서 "상세" 버튼 클릭
2. 환자 상세 페이지로 이동 (`/patients/{id}`)
3. 탭 선택:
   - **요약**: 환자 기본 정보 및 의료 정보
   - **영상**: 영상 검사 내역 (추후 구현)
   - **검사**: 검사 결과 (추후 구현)
   - **AI**: AI 분석 결과 (추후 구현, DOCTOR/SYSTEMMANAGER만)

### 7. 환자 정보 수정

1. 목록에서 "편집" 버튼 클릭
2. 수정할 정보 변경
3. "저장" 버튼 클릭

**수정 가능 항목:**
- 이름, 연락처, 주소
- 혈액형, 알레르기, 기저질환
- 환자 상태

**수정 불가 항목:**
- 환자번호
- 생년월일
- 주민등록번호

### 8. 환자 삭제

1. 목록에서 "삭제" 버튼 클릭
2. 삭제 확인 모달에서 환자 정보 확인
3. "삭제" 버튼 클릭

**참고:**
- Soft Delete 방식으로 실제 데이터는 유지됨
- `is_deleted` 플래그만 true로 변경
- 복구 기능은 추후 관리자 기능으로 추가 예정

---

## 권한 관리

### 역할별 권한

| 기능 | PATIENT | NURSE | DOCTOR | SYSTEMMANAGER |
|------|---------|-------|--------|---------------|
| 목록 조회 | ❌ | ✅ | ✅ | ✅ |
| 상세 조회 | ❌ | ✅ | ✅ | ✅ |
| 환자 등록 | ❌ | ✅ | ✅ | ✅ |
| 환자 수정 | ❌ | ✅ | ✅ | ✅ |
| 환자 삭제 | ❌ | ✅ | ✅ | ✅ |
| AI 탭 조회 | ❌ | ❌ | ✅ | ✅ |

### 권한 구현

**Backend (DRF Permissions):**
```python
# apps/patients/permissions.py
from apps.core.permissions import BaseRolePermission

class PatientViewPermission(BaseRolePermission):
    allowed_roles = ['DOCTOR', 'NURSE', 'SYSTEMMANAGER']

class PatientModifyPermission(BaseRolePermission):
    allowed_roles = ['DOCTOR', 'NURSE', 'SYSTEMMANAGER']
```

**Frontend (React):**
```typescript
// PatientListPage.tsx
const { role } = useAuth();
const isSystemManager = role === 'SYSTEMMANAGER';
const canEdit = role === 'DOCTOR' || role === 'NURSE' || isSystemManager;

// 환자 등록 버튼 표시 조건
{(role === 'DOCTOR' || role === 'NURSE' || isSystemManager) && (
  <button onClick={() => setIsCreateModalOpen(true)}>
    환자 등록
  </button>
)}
```

---

## 개발 가이드

### 새로운 필드 추가하기

1. **모델 수정** (`apps/patients/models.py`):
```python
class Patient(models.Model):
    # 새 필드 추가
    emergency_contact = models.CharField(max_length=20, blank=True, null=True)
```

2. **마이그레이션 생성 및 적용**:
```bash
python manage.py makemigrations
python manage.py migrate
```

3. **Serializer 수정** (`apps/patients/serializers.py`):
```python
class PatientSerializer(serializers.ModelSerializer):
    class Meta:
        fields = [..., 'emergency_contact']
```

4. **TypeScript 타입 수정** (`src/types/patient.ts`):
```typescript
export interface Patient {
  ...
  emergency_contact: string | null;
}
```

5. **Form 수정** (해당 Modal 컴포넌트):
```tsx
<input
  type="tel"
  value={formData.emergency_contact || ''}
  onChange={(e) => setFormData({...formData, emergency_contact: e.target.value})}
/>
```

---

## 향후 개발 계획

### Phase 2 (다음 단계)
- [ ] 환자 이력 조회 (진료, 검사, 처방)
- [ ] 환자 복구 기능 (Soft Delete 취소)
- [ ] 환자 병합 기능 (중복 환자 통합)
- [ ] 환자 데이터 Export (CSV, Excel)

### Phase 3 (추후)
- [ ] 환자 사진 업로드
- [ ] 환자 동의서 관리
- [ ] 환자 차트 템플릿
- [ ] 환자 알림 설정

### 타 모듈 연동
- [ ] Encounter (진료) 모듈과 연동
- [ ] Imaging Study (영상 검사) 모듈과 연동
- [ ] Lab Result (검사 결과) 모듈과 연동
- [ ] AI Analysis (AI 분석) 모듈과 연동

---

## 트러블슈팅

### 1. 환자 등록 버튼이 보이지 않음
**원인**: 역할 권한 문제
**해결**: `useAuth()`에서 `role`을 직접 가져오기
```typescript
// Before (잘못된 방법)
const { user } = useAuth();
const role = user?.role.code;

// After (올바른 방법)
const { role } = useAuth();
```

### 2. 상세 페이지에 데이터가 표시되지 않음
**원인**: API 호출 실패 또는 데이터 전달 누락
**해결**:
- 브라우저 콘솔에서 에러 확인
- Network 탭에서 API 응답 확인
- patient prop이 컴포넌트에 제대로 전달되었는지 확인

### 3. 모달에서 취소/상세 버튼 글자가 안 보임
**원인**: 기본 버튼 스타일에 배경색/글자색 미지정
**해결**: `.btn` 스타일에 명시적인 색상 추가
```css
.btn {
  background: #f1f5f9;
  color: #334155;
}
```

---

## 참고 자료

- [Django REST Framework 공식 문서](https://www.django-rest-framework.org/)
- [React 공식 문서](https://react.dev/)
- [TypeScript 공식 문서](https://www.typescriptlang.org/)
- [프로젝트 기획서](../../app의%20기획.md)

---

## 라이선스

This project is part of Brain Tumor CDSS system.

---

**작성일**: 2026-01-07
**작성자**: Claude Sonnet 4.5
**버전**: 1.0.0
