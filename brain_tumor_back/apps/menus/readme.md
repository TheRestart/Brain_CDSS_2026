# Menus App
분석만 해보고 지나갑니다. 0109_20:20

사이드바 메뉴를 권한 기반으로 동적 생성하는 앱

---

## 목표

1. **권한 기반 메뉴 접근 제어**: 사용자의 역할(Role)에 따라 접근 가능한 메뉴만 표시
2. **동적 메뉴 트리 구성**: DB에서 메뉴 구조를 관리하여 코드 수정 없이 메뉴 변경 가능
3. **역할별 라벨 커스터마이징**: 같은 메뉴도 역할에 따라 다른 이름으로 표시 (예: NURSE는 "검사 현황", DOCTOR는 "검사 오더")

---

## 모델 구조

```
Menu (메뉴)
├── id (PK, BigAutoField)
├── code (고유 식별자: DASHBOARD, OCS_RIS 등)
├── path (URL 경로: /dashboard, /ocs/ris)
├── icon (FontAwesome 아이콘명)
├── group_label (그룹 메뉴 라벨: 영상, 검사)
├── breadcrumb_only (true면 사이드바 숨김, 상세 페이지용)
├── parent (부모 메뉴 FK - 트리 구조)
├── order (정렬 순서)
└── is_active (활성화 여부)

MenuLabel (역할별 라벨)
├── menu (FK → Menu)
├── role (역할코드: DOCTOR, NURSE, DEFAULT)
└── text (표시 텍스트)

MenuPermission (메뉴-권한 매핑)
├── menu (FK → Menu)
└── permission (FK → accounts.Permission)
```

---

## 핵심 로직

### 1. 메뉴 조회 흐름

```
[사용자 로그인]
    ↓
[사용자.role → role.permissions]
    ↓
[MenuPermission에서 권한에 매핑된 메뉴 조회]
    ↓
[부모 메뉴까지 재귀적으로 포함]
    ↓
[트리 구조로 변환]
    ↓
[프론트엔드 사이드바 렌더링]
```

### 2. 주요 함수

| 함수 | 위치 | 기능 |
|------|------|------|
| `get_user_menus(user)` | services.py | 사용자의 접근 가능 메뉴 조회 |
| `build_menu_tree(menus)` | utils.py | 평면 메뉴 → 트리 구조 변환 |
| `UserMenuView` | views.py | GET /api/menus/ 엔드포인트 |

---

## 파일 구조

```
apps/menus/
├── models.py        # Menu, MenuLabel, MenuPermission 모델
├── services.py      # 메뉴 조회 비즈니스 로직
├── utils.py         # 트리 변환 유틸리티
├── views.py         # API 뷰 (UserMenuView)
├── serializers.py   # DRF 직렬화 (미사용)
├── admin.py         # Django Admin 등록
└── readme.md        # 이 파일
```

---

## 현재 예상되는 문제점

### 1. urls.py 미등록 (Critical)

- **문제**: `views.py`에 `UserMenuView`가 정의되어 있지만 `urls.py`가 없어서 API 엔드포인트가 등록되지 않음
- **영향**: `/api/menus/` 호출 불가
- **해결**: urls.py 생성 후 config/urls.py에 등록 필요

```python
# apps/menus/urls.py (생성 필요)
from django.urls import path
from .views import UserMenuView

urlpatterns = [
    path('', UserMenuView, name='user-menus'),
]

# config/urls.py에 추가 필요
path('api/menus/', include('apps.menus.urls')),
```

### 2. serializers.py 오류 (Medium)

- **문제**: 삭제된 `MenuRole` 모델을 import 중
- **영향**: serializers.py import 시 오류 발생
- **해결**: MenuRole 관련 코드 제거 또는 파일 삭제 (현재 미사용)

```python
# 현재 (오류)
from .models import Menu, MenuLabel, MenuRole  # MenuRole 없음!

# 수정 필요
from .models import Menu, MenuLabel, MenuPermission
```

### 3. MenuRole 모델 주석 처리 (Low)

- **상태**: `MenuRole`이 주석 처리되고 `MenuPermission`으로 대체됨
- **사유**: 역할 기반 → 권한 기반 접근 제어로 변경
- **영향**: 없음 (정상적인 설계 변경)

---

## 개발 단계

### Phase 1: 기본 구현 (완료)

- [x] Menu 모델 설계
- [x] MenuLabel 모델 (역할별 라벨)
- [x] MenuPermission 모델 (권한 매핑)
- [x] 메뉴 조회 서비스 (services.py)
- [x] 트리 변환 유틸리티 (utils.py)
- [x] API 뷰 (views.py)

### Phase 2: API 등록 (미완료)

- [ ] urls.py 생성
- [ ] config/urls.py에 등록
- [ ] serializers.py 오류 수정

### Phase 3: 프론트엔드 연동 (완료)

- [x] AuthProvider에서 메뉴 데이터 사용
- [x] Sidebar 컴포넌트에서 메뉴 렌더링
- [x] 역할별 라벨 표시

### Phase 4: 고급 기능 (미정)

- [ ] 메뉴 권한 관리 UI (Admin 페이지)
- [ ] 메뉴 순서 드래그앤드롭
- [ ] 메뉴 아이콘 선택기

---

## 데이터 시드

메뉴 데이터는 `setup_dummy_data.py`의 `load_menu_permission_seed()` 함수에서 생성됩니다.

```bash
# 메뉴 데이터 생성/업데이트
python setup_dummy_data.py
```

---

## 관련 문서

- [좌측 네비게이션.md](../../../좌측%20네비게이션.md) - 메뉴 구조 및 설정 방법
- [routeMap.tsx](../../../brain_tumor_front/src/router/routeMap.tsx) - 프론트엔드 라우트 매핑
