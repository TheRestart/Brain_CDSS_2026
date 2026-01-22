# Imaging Study Management (영상 검사 관리)

**Phase 2.5: 영상 검사 및 판독 관리 시스템 (완료)**

## 📋 개요

뇌종양 CDSS를 위한 영상 검사 오더 및 판독 관리 모듈입니다. CT, MRI, PET, X-Ray 등의 영상 검사를 관리하고, 방사선과 전문의의 판독문 작성 및 서명 기능을 제공합니다.

## 🎯 주요 기능

### 1. 영상 검사 오더 관리 (ImagingStudy)
- ✅ 검사 오더 생성 (CT, MRI, PET, X-Ray)
- ✅ 검사 일정 관리 (예약, 수행 일시)
- ✅ 검사 상태 관리 (오더 생성 → 예약 → 수행 중 → 완료 → 판독 완료)
- ✅ 임상 정보 및 특별 지시사항 기록
- ✅ DICOM 메타데이터 연동 준비 (study_uid, series_count 등)

### 2. 판독문 관리 (ImagingReport)
- ✅ 판독 소견 작성 (Findings, Impression)
- ✅ 종양 정보 기록 (위치, 크기, 부피)
- ✅ 판독문 서명 기능
- ✅ 판독문 수정 (서명 전에만 가능)
- ✅ 판독 이력 추적

### 3. 환자별 영상 히스토리
- ✅ 환자 중심 타임라인 뷰
- ✅ 판독 상태별 표시
- ✅ 종양 발견 알림
- ✅ Study 상세 및 판독문 연계

### 4. RIS 워크리스트
- ✅ 검사 대기 목록 조회
- ✅ 모달리티별 필터링
- ✅ 우선순위 표시 (응급 검사)

## 📂 파일 구조

```
apps/imaging/
├── models.py                                        # 데이터 모델 (ImagingStudy, ImagingReport)
├── serializers.py                                   # API Serializers (6개)
├── views.py                                         # ViewSet (ImagingStudyViewSet, ImagingReportViewSet)
├── urls.py                                          # URL 라우팅
├── admin.py                                         # Django Admin 설정
├── apps.py                                          # App 설정
├── tests.py                                         # 테스트 파일
├── management/
│   └── commands/
│       └── register_imaging_menu.py                 # 메뉴 등록 Django 명령어
└── README.md                                        # 이 파일
```

**프론트엔드 파일:**
```
src/pages/imaging/
├── ImagingListPage.tsx                              # 영상 검사 목록 페이지
├── ImagingListTable.tsx                             # 검사 목록 테이블 컴포넌트
├── ImagingReportPage.tsx                            # 판독 전용 페이지 (NEW)
├── ImagingPage.tsx                                  # 영상 조회 페이지
├── ImagingWorklistPage.tsx                          # RIS 워크리스트 페이지
├── PatientImagingHistoryPage.tsx                    # 환자별 영상 히스토리 타임라인
├── PatientImagingHistoryPage.css                    # 히스토리 페이지 스타일
├── ImagingCreateModal.tsx                           # 검사 오더 생성 모달
├── ImagingEditModal.tsx                             # 검사 정보 수정 모달
├── ImagingDeleteModal.tsx                           # 검사 삭제 모달
└── ImagingReportModal.tsx                           # 판독문 작성/보기/서명 모달
```

## 🗄️ 데이터베이스 스키마

### ImagingStudy (영상 검사)
| 필드 | 타입 | 설명 |
|------|------|------|
| patient | FK | 환자 |
| encounter | FK | 진료 |
| modality | CharField | 검사 종류 (CT/MRI/PET/X-RAY) |
| body_part | CharField | 촬영 부위 |
| status | CharField | 검사 상태 |
| ordered_by | FK(User) | 오더 의사 |
| ordered_at | DateTime | 오더 일시 |
| scheduled_at | DateTime | 예약 일시 |
| performed_at | DateTime | 수행 일시 |
| radiologist | FK(User) | 판독의 |
| study_uid | CharField | DICOM Study UID |
| clinical_info | Text | 임상 정보 |
| special_instruction | Text | 특별 지시사항 |

### ImagingReport (판독문)
| 필드 | 타입 | 설명 |
|------|------|------|
| imaging_study | OneToOne | 영상 검사 |
| radiologist | FK(User) | 판독의 |
| findings | Text | 판독 소견 |
| impression | Text | 판독 결론 |
| tumor_detected | Boolean | 종양 발견 여부 |
| tumor_location | JSON | 종양 위치 (lobe, hemisphere) |
| tumor_size | JSON | 종양 크기 (diameter, volume) |
| status | CharField | 판독문 상태 (draft/signed/amended) |
| signed_at | DateTime | 서명 일시 |

## 🔌 API 엔드포인트

### ImagingStudy API
```
GET    /api/imaging/studies/                    # 목록 조회
GET    /api/imaging/studies/{id}/               # 상세 조회
POST   /api/imaging/studies/                    # 오더 생성
PATCH  /api/imaging/studies/{id}/               # 정보 수정
DELETE /api/imaging/studies/{id}/               # 삭제 (Soft Delete)
POST   /api/imaging/studies/{id}/complete/      # 검사 완료
POST   /api/imaging/studies/{id}/cancel/        # 검사 취소
GET    /api/imaging/studies/worklist/           # RIS 워크리스트
GET    /api/imaging/studies/patient-history/    # 환자별 영상 히스토리
```

### 검색 및 필터링 파라미터
```
# 기본 필터
?patient_id={id}            # 환자별 필터링
?modality={modality}        # 검사 종류 필터 (CT/MRI/PET/X-RAY)
?status={status}            # 검사 상태 필터
?start_date={date}          # 시작일 필터
?end_date={date}            # 종료일 필터

# 판독 상태 필터
?has_report=true            # 판독문 있는 검사만
?has_report=false           # 판독문 없는 검사만 (미판독)
?report_status=draft        # 판독 중인 검사
?report_status=signed       # 판독 완료 (서명됨) 검사

# 환자별 히스토리
?patient_id={id}            # 환자별 영상 히스토리 (날짜 역순)
```

### ImagingReport API
```
GET    /api/imaging/reports/              # 목록 조회
GET    /api/imaging/reports/{id}/         # 상세 조회
POST   /api/imaging/reports/              # 판독문 작성
PATCH  /api/imaging/reports/{id}/         # 판독문 수정
DELETE /api/imaging/reports/{id}/         # 판독문 삭제
POST   /api/imaging/reports/{id}/sign/    # 판독문 서명
```

## 🔐 권한 관리 (현재 비활성화)

**주의**: 현재 프로젝트에서 메뉴 권한 체크가 비활성화되어 모든 사용자가 모든 메뉴에 접근할 수 있습니다.

### 메뉴 구조
```
IMAGING (영상)
├── IMAGING_STUDY_LIST (영상 목록)      - /imaging/studies
├── IMAGE_VIEWER (영상 조회)            - /imaging
├── IMAGING_REPORT (판독)               - /imaging/reports
└── RIS_WORKLIST (워크리스트)           - /ris/worklist
```

## 🚀 설치 및 실행

### 1. 마이그레이션
```bash
cd brain_tumor_back
python manage.py makemigrations imaging
python manage.py migrate imaging
```

### 2. INSTALLED_APPS 등록
`config/settings.py`에 imaging 앱이 등록되어 있는지 확인:
```python
INSTALLED_APPS = [
    # ...
    "apps.imaging",  # 영상 관리
    # ...
]
```

### 3. URL 라우팅 등록
`config/urls.py`에 imaging URL이 등록되어 있는지 확인:
```python
urlpatterns = [
    # ...
    path("api/imaging/", include("apps.imaging.urls")),
    # ...
]
```

### 4. 메뉴 등록
```bash
# Django 관리 명령어 사용
python manage.py register_imaging_menu
```

### 5. 더미 데이터 생성 (선택)

더미 데이터 생성 스크립트는 `brain_tumor_back/dummy_data/` 폴더로 통합되었습니다.

📖 **자세한 사용법**: [../../dummy_data/README.md](../../dummy_data/README.md)

**빠른 실행:**
```bash
cd brain_tumor_back
python manage.py shell -c "from dummy_data.create_dummy_imaging import create_dummy_imaging_studies; create_dummy_imaging_studies(30, 20)"
```

생성되는 데이터:
- 30개의 영상 검사 (다양한 modality와 status)
- 20개의 판독문 (종양 발견 포함)

### 6. 서버 실행
```bash
daphne -b 127.0.0.1 -p 8000 config.asgi:application
```

## 💻 프론트엔드 페이지

### 메뉴 구조
| 메뉴 ID | 메뉴명 | 경로 | 컴포넌트 | 설명 |
|---------|--------|------|----------|------|
| IMAGING_STUDY_LIST | 영상 목록 | /imaging/studies | ImagingListPage | 전체 영상 검사 목록 |
| IMAGE_VIEWER | 영상 조회 | /imaging | ImagingPage | 영상 뷰어 (미구현) |
| IMAGING_REPORT | 판독 | /imaging/reports | ImagingReportPage | 판독 전용 페이지 |
| RIS_WORKLIST | 워크리스트 | /ris/worklist | RISWorklistPage | RIS 워크리스트 |

### 주요 페이지 설명

#### 1. 영상 목록 (ImagingListPage)
- **경로**: `/imaging/studies`
- **기능**:
  - 모든 영상 검사 목록 조회
  - 검색 및 필터링 (modality, status, 판독 상태)
  - 검사 오더 생성/수정/삭제
  - 판독문 작성 (ImagingReportModal 연동)
  - 페이지네이션

#### 2. 판독 (ImagingReportPage) **NEW**
- **경로**: `/imaging/reports`
- **기능**:
  - **완료된 검사만** 표시 (status='completed')
  - 판독 상태별 필터: 전체 / 판독 대기 / 판독 완료
  - 판독문 작성/수정 (ImagingReportModal 연동)
  - 판독 전용 인터페이스

#### 3. 영상 조회 (ImagingPage)
- **경로**: `/imaging`
- **상태**: Coming Soon (DICOM 뷰어 미구현)

#### 4. 환자별 영상 히스토리 (PatientImagingHistoryPage)
- **경로**: `/imaging/patient-history?patient_id={id}`
- **기능**:
  - 환자 기본 정보 패널
  - Study 타임라인 뷰 (최신순)
  - 판독 상태 표시 (미판독/판독중/판독완료)
  - 종양 발견 알림
  - Study 상세 및 판독문 빠른 이동

### 컴포넌트 목록

#### 페이지 컴포넌트
1. **ImagingListPage** - 영상 검사 목록 (전체)
2. **ImagingReportPage** - 판독 전용 페이지 (완료된 검사만)
3. **ImagingPage** - 영상 조회 (미구현)
4. **ImagingWorklistPage** - RIS 워크리스트
5. **PatientImagingHistoryPage** - 환자별 영상 히스토리

#### 공통 컴포넌트
6. **ImagingListTable** - 검사 목록 테이블
7. **ImagingCreateModal** - 검사 오더 생성
8. **ImagingEditModal** - 검사 정보 수정
9. **ImagingDeleteModal** - 검사 삭제
10. **ImagingReportModal** - 판독문 작성/보기/서명

## 🔧 최근 수정 사항

### 2026-01-07 업데이트
1. **권한 시스템 비활성화**
   - `apps/menus/services.py`: 모든 활성화된 메뉴 반환
   - 모든 역할이 모든 메뉴에 접근 가능

2. **URL 라우팅 수정**
   - `config/urls.py`: imaging API 경로 추가
   - `config/settings.py`: INSTALLED_APPS에 imaging 추가

3. **판독 페이지 분리**
   - `ImagingReportPage.tsx`: 판독 전용 페이지 신규 생성
   - 영상 목록과 판독 페이지 명확히 구분
   - 완료된 검사만 판독 대상으로 표시

4. **사이드바 메뉴 활성화 수정**
   - `SidebarItem.tsx`: NavLink에 `end` prop 추가
   - 경로 정확히 일치할 때만 active 상태 적용
   - 부모 경로 포함 시 활성화되는 문제 해결

5. **파일 정리 및 구조 개선**
   - 불필요한 파일 삭제 (add_menus.py, register_menus.py, imaging_menu.sql, test_create.py)
   - 더미 데이터 생성 스크립트 통합: `create_dummy_imaging.py` → `dummy_data/` 폴더로 이동
   - 더미 데이터 관리 문서화: `dummy_data/README.md` 생성

6. **백엔드 권한 체크 제거**
   - `apps/imaging/views.py`: 모든 role 기반 권한 체크 제거
   - `ImagingStudyViewSet`, `ImagingReportViewSet`: IsAuthenticated만 유지
   - 권한 관리는 프론트엔드 라우터에서 처리

## 🔮 향후 개발 계획

### Phase 2.5 완료 (현재) ✅
- [x] 환자별 영상 히스토리 API (`/patient-history`)
- [x] 판독 상태 필터링 (`has_report`, `report_status`)
- [x] PatientImagingHistoryPage 구현
- [x] Study 메타데이터 계층 구조 표시
- [x] 판독 리포트 연계 강화
- [x] 판독 전용 페이지 (ImagingReportPage) 구현
- [x] 사이드바 메뉴 활성화 문제 해결

### Phase 3 계획 (1-2주)
- [ ] 정적 썸네일 업로드 및 표시
- [ ] ImagingSeries 모델 추가 (메타데이터만)
- [ ] React 이미지 뷰어 통합
- [ ] 기본 Zoom/Pan 기능

### Phase 4 계획 (2-4주)
- [ ] Orthanc PACS 서버 연동
- [ ] Cornerstone.js DICOM 뷰어
- [ ] Window/Level 조정
- [ ] 기본 Annotation 도구 (Line, ROI)
- [ ] Series 스크롤 및 동기화

### Phase 5+ 장기 계획 (2-6개월)
- [ ] OHIF Viewer 통합
- [ ] AI Overlay 및 Heatmap
- [ ] Advanced Annotation (3D ROI, 측정)
- [ ] Multi-Modality Fusion (CT + MRI)
- [ ] 판독 템플릿 시스템

**상세 계획**: [app_확장계획.md](../../app_확장계획.md) 참조

### 기술 스택
- **Backend**: Django REST Framework, MySQL
- **Frontend**: React, TypeScript, Vite, React Router
- **Phase 3+**: react-image-viewer
- **Phase 4+**: Orthanc (DICOM Server), Cornerstone.js (Image Viewer)
- **Phase 5+**: OHIF Viewer v3, vtk.js (3D)

## 📝 참고사항

### Soft Delete 패턴
- 실제 삭제 대신 `is_deleted=True`로 표시
- 데이터 복구 및 감사 추적 가능

### Timezone 처리
- 모든 DateTime 필드는 timezone-aware
- Django의 `timezone.now()` 사용

### OneToOne 관계
- 1개의 ImagingStudy에 1개의 ImagingReport만 생성 가능
- 중복 판독문 생성 방지

### React Router NavLink
- `end` prop 사용으로 정확한 경로 매칭
- 부모 경로 포함 시 active 되는 문제 방지

## 🐛 알려진 이슈

현재 없음

## 📧 문의

이슈 발견 시 GitHub Issues에 등록해주세요.
