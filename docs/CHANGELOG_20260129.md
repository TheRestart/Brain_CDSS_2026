# 변경 이력 - 2026년 1월 29일

## 목차
1. [Pillow 라이브러리 누락 수정](#1-pillow-라이브러리-누락-수정)
2. [SYSTEMMANAGER 권한 보호](#2-systemmanager-권한-보호)
3. [외부기관 보고서 접근 제한](#3-외부기관-보고서-접근-제한)
4. [React 렌더링 에러 수정](#4-react-렌더링-에러-수정)
5. [PATIENT 대시보드 라우터 추가](#5-patient-대시보드-라우터-추가)
6. [진료 등록 모달 브라우저 호환성](#6-진료-등록-모달-브라우저-호환성)
7. [TypeScript 빌드 에러 수정](#7-typescript-빌드-에러-수정)
8. [MM 페이지 CSS 및 아이콘 수정](#8-mm-페이지-css-및-아이콘-수정)

---

## 1. Pillow 라이브러리 누락 수정

### 문제
- AI 추론 썸네일 API에서 500 에러 발생
- `ModuleNotFoundError: No module named 'PIL'`

### 해결
**파일**: `brain_tumor_back/requirements.txt`
```
Pillow==11.0.0  # 추가
```

### 적용 방법
```bash
docker-compose build backend
docker-compose up -d
```

---

## 2. SYSTEMMANAGER 권한 보호

### 문제
- Admin이 SYSTEMMANAGER(system) 역할의 권한을 수정할 수 있었음

### 해결

**파일**: `brain_tumor_back/apps/accounts/views.py`
- system 계정 보호 코드의 `username` → `login_id` 수정 (버그 수정)

**파일**: `brain_tumor_back/apps/authorization/views.py`
- SYSTEMMANAGER 역할 보호 함수 추가

```python
def _check_systemmanager_protection(self, request, role):
    """SYSTEMMANAGER 역할은 SYSTEMMANAGER만 수정 가능"""
    if role.code == 'SYSTEMMANAGER':
        if not request.user.role or request.user.role.code != 'SYSTEMMANAGER':
            return Response(
                {"detail": "SYSTEMMANAGER 역할은 수정할 수 없습니다."},
                status=status.HTTP_403_FORBIDDEN
            )
    return None
```

### 보호 범위
| 작업 | 엔드포인트 | 보호 |
|-----|----------|------|
| 역할 수정 | `PUT /roles/{id}/` | ✅ |
| 역할 부분 수정 | `PATCH /roles/{id}/` | ✅ |
| 역할 삭제 | `DELETE /roles/{id}/` | ✅ |
| 메뉴 권한 수정 | `PUT /roles/{id}/menus/` | ✅ |

---

## 3. 외부기관 보고서 접근 제한

### 문제
- EXTERNAL 역할 사용자가 모든 보고서를 볼 수 있었음

### 해결

**파일**: `brain_tumor_back/apps/reports/views.py`

```python
# 목록 조회 필터링
if request.user.role and request.user.role.code == 'EXTERNAL':
    queryset = queryset.filter(patient__external_institution=request.user)

# 상세 조회 권한 검사
if request.user.role and request.user.role.code == 'EXTERNAL':
    if report.patient.external_institution != request.user:
        raise PermissionDenied('해당 보고서에 접근 권한이 없습니다.')
```

### 동작 방식
- EXTERNAL 사용자: `Patient.external_institution`이 자신인 환자의 보고서만 조회 가능
- 수정/삭제: EXTERNAL 사용자는 `IsDoctorOrAdmin` 권한이 없으므로 불가

---

## 4. React 렌더링 에러 수정

### 문제
```
Cannot update a component (`BrowserRouter`) while rendering a different component (`LandingPage`)
```

### 해결

**파일**: `brain_tumor_front/src/pages/landing/LandingPage.tsx`

```tsx
// Before (렌더링 중 navigate 호출 - 에러)
if (role) {
  navigate('/dashboard', { replace: true });
  return null;
}

// After (useEffect로 변경 - 정상)
useEffect(() => {
  if (role) {
    navigate('/dashboard', { replace: true });
  }
}, [role, navigate]);
```

---

## 5. PATIENT 대시보드 라우터 추가

### 문제
- PATIENT 역할이 `/dashboard` 접근 시 "대시보드를 찾을 수 없습니다" 표시

### 해결

**파일**: `brain_tumor_front/src/pages/dashboard/DashboardRouter.tsx`

```tsx
import PatientDashboard from '@/pages/patient/PatientDashboard';

// switch 문에 추가
case 'PATIENT':
  return <PatientDashboard />;
```

---

## 6. 진료 등록 모달 브라우저 호환성

### 문제
- Chrome에서 진료 등록 모달이 화면을 초과하여 등록 버튼 클릭 불가
- Internet Explorer에서는 정상 동작

### 원인
- `.encounter-modal-content`에 `max-height` 미설정
- Chrome의 viewport 높이 계산이 더 엄격함

### 해결

**파일**: `brain_tumor_front/src/pages/encounter/EncounterCreateModal.css`

```css
.encounter-modal-content {
  ...
  max-height: 90vh;       /* 추가 */
  overflow-y: auto;       /* 추가 */
  box-sizing: border-box; /* 추가 */
}

/* 소형 화면 대응 추가 */
@media (max-height: 700px) {
  .encounter-modal-content {
    max-height: 95vh;
    padding: 1rem;
  }
}
```

### 상세 문서
[ENCOUNTER_MODAL_BROWSER_ISSUE.md](./ENCOUNTER_MODAL_BROWSER_ISSUE.md)

---

## 7. TypeScript 빌드 에러 수정

### 문제
```
Type '"stat"' is not assignable to type 'Priority | undefined'.
```

### 원인
- 샘플 데이터 타입에 `'stat'`이 포함되어 있으나 `Priority` 타입은 `'urgent' | 'normal'`만 허용

### 해결

**파일**: `brain_tumor_front/src/constants/sampleData.ts`

```typescript
// Before
priority: 'normal' | 'urgent' | 'stat';

// After
priority: 'normal' | 'urgent';
```

- `'routine'` → `'normal'` 변경 (4건)

---

## 8. MM 페이지 CSS 및 아이콘 수정

### 문제
1. MM 페이지 액션 버튼 CSS 미적용
2. 사이드바 MM 메뉴 아이콘 미표시

### 해결

**파일**: `brain_tumor_front/src/pages/ai-inference/MMInferencePage.css`

```css
/* 배경색 추가 */
.mm-inference-page {
  ...
  min-height: 100vh;  /* 100% → 100vh */
  background: #f8fafc; /* 추가 */
}

/* 새로고침 버튼 스타일 추가 */
.mm-btn-refresh { ... }
```

**파일**: `brain_tumor_front/src/pages/ai-inference/MMInferencePage.tsx`

```tsx
// 클래스명 수정 (CSS 선택자와 일치)
className="mm-btn-action view"    // mm-btn-view → view
className="mm-btn-action detail"  // mm-btn-detail → detail
className="mm-btn-action delete"  // mm-btn-delete → delete
```

**파일**: `brain_tumor_back/setup_dummy_data/setup_dummy_data_1_base.py`

```python
# 아이콘 수정 (FontAwesome 7 호환)
icon='layer-group'  # 'layers' → 'layer-group'
```

### DB 아이콘 수정 (원격 서버)

```bash
# Django 컨테이너 접속
docker exec -it <django_container_name> bash
python manage.py shell
```

```python
from apps.menus.models import Menu
Menu.objects.filter(code='AI_MM_INFERENCE').update(icon='layer-group')
exit()
```

---

## 변경된 파일 요약

### Backend
| 파일 | 변경 내용 |
|------|----------|
| `requirements.txt` | Pillow 추가 |
| `apps/accounts/views.py` | system 계정 보호 버그 수정 |
| `apps/authorization/views.py` | SYSTEMMANAGER 역할 보호 |
| `apps/reports/views.py` | EXTERNAL 보고서 접근 제한 |
| `setup_dummy_data_1_base.py` | MM 아이콘 수정 |

### Frontend
| 파일 | 변경 내용 |
|------|----------|
| `LandingPage.tsx` | 렌더링 에러 수정 |
| `DashboardRouter.tsx` | PATIENT case 추가 |
| `EncounterCreateModal.css` | 브라우저 호환성 |
| `sampleData.ts` | Priority 타입 수정 |
| `MMInferencePage.css` | 배경색, 버튼 스타일 |
| `MMInferencePage.tsx` | 버튼 클래스명 수정 |

### 문서
| 파일 | 내용 |
|------|------|
| `docs/ENCOUNTER_MODAL_BROWSER_ISSUE.md` | 모달 브라우저 이슈 상세 |
| `docs/CHANGELOG_20260129.md` | 이 문서 |
| `scripts/fix_menu_icons.sql` | DB 아이콘 수정 SQL |
