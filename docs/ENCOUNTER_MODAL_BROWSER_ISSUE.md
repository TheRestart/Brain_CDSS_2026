# 진료 등록 모달 브라우저 호환성 이슈

## 문제 현상
- **증상**: 크롬에서 진료 등록 모달이 화면보다 크게 표시되어 등록 버튼 클릭 불가
- **정상 동작**: Internet Explorer에서는 정상 표시
- **영향 범위**: `EncounterCreateModal` 컴포넌트

## 원인 분석

### 1. CSS 파일 충돌

진료 등록 모달은 3개의 CSS 파일에서 스타일을 상속받음:

| 파일 | 클래스 | 설정값 |
|------|--------|--------|
| `common.css` | `.modal-content` | `max-height: 85vh`, `overflow-y: auto` |
| `PatientCreateModal.css` | `.encounter-modal-content` | `width: 75vw`, `max-width: 950px` |
| `EncounterCreateModal.css` | `.encounter-modal-content` | `width: 90vw`, `max-width: 1200px`, `padding: 2rem` |

**문제점**: `.encounter-modal-content`에 `max-height`가 설정되지 않아 `common.css`의 `85vh` 제한이 무시됨

### 2. CSS 로드 순서

```tsx
// EncounterCreateModal.tsx
import '@/pages/patient/PatientCreateModal.css';  // 먼저 로드
import './EncounterCreateModal.css';              // 나중에 로드 (덮어씀)
```

`EncounterCreateModal.css`가 나중에 로드되어 `PatientCreateModal.css`의 `.encounter-modal-content` 스타일을 덮어씀

### 3. 브라우저별 차이

| 브라우저 | vh 계산 | overflow 처리 | CSS 변수 지원 |
|---------|---------|--------------|--------------|
| Chrome | 엄격 (주소창 제외) | 엄격 | 완전 지원 |
| IE/Edge Legacy | 관대 (주소창 포함) | 관대 | 미지원 (폴백 사용) |

Chrome은 viewport 높이를 더 엄격하게 계산하여 모달이 화면을 넘어감

### 4. 누락된 스타일

`EncounterCreateModal.css`에서 누락된 설정:
- `max-height` 제한 없음
- `overflow-y` 설정 없음
- 모바일/소형 화면 대응 없음

## 해결 방안

### EncounterCreateModal.css 수정

```css
/* 수정 전 */
.encounter-modal-content {
  width: 90vw;
  max-width: 1200px;
  min-width: 600px;
  padding: 2rem;
}

/* 수정 후 */
.encounter-modal-content {
  width: 90vw;
  max-width: 1200px;
  min-width: 600px;
  max-height: 90vh;           /* 추가: 화면 높이 제한 */
  overflow-y: auto;           /* 추가: 스크롤 가능 */
  padding: 2rem;
  box-sizing: border-box;     /* 추가: padding 포함 크기 계산 */
}

/* 추가: 소형 화면 대응 */
@media (max-height: 700px) {
  .encounter-modal-content {
    max-height: 95vh;
    padding: 1rem;
  }
}
```

## 적용된 변경사항

1. `max-height: 90vh` 추가 - 화면 높이의 90%로 제한
2. `overflow-y: auto` 추가 - 내용이 넘칠 경우 스크롤 표시
3. `box-sizing: border-box` 추가 - padding을 포함한 크기 계산
4. 미디어 쿼리 추가 - 소형 화면(700px 이하) 대응

## 테스트 체크리스트

- [ ] Chrome에서 모달이 화면 내에 표시되는지 확인
- [ ] 등록/취소 버튼이 클릭 가능한지 확인
- [ ] 내용이 많을 경우 스크롤이 정상 동작하는지 확인
- [ ] Firefox, Safari에서도 정상 동작 확인
- [ ] 1080p, 768p 등 다양한 해상도에서 확인
