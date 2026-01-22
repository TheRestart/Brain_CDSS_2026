# AI 페이지 정리 가이드

## 1. 현황 분석

### 1.1 파일 구조
```
src/
├── pages/
│   ├── ai/                          # AI 메인 페이지
│   │   ├── AISummaryPage.tsx        # AI 대시보드 (드롭다운 네비)
│   │   ├── AISummaryPage.css
│   │   ├── AiViewer.tsx             # 영상 뷰어 (스텁)
│   │   ├── AiResultPanel.tsx        # 결과 패널 (스텁)
│   │   └── AiLesionList.tsx         # 병변 목록 (스텁)
│   │
│   ├── ai-inference/                # AI 추론 요청 관리
│   │   ├── AIRequestListPage.tsx    # 요청 목록
│   │   ├── AIRequestListPage.css
│   │   ├── AIRequestCreatePage.tsx  # 요청 생성 마법사
│   │   ├── AIRequestCreatePage.css
│   │   ├── AIRequestDetailPage.tsx  # 요청 상세
│   │   ├── AIRequestDetailPage.css
│   │   └── index.ts
│   │
│   ├── ocs/components/
│   │   ├── AIAnalysisPanel.tsx      # OCS AI 분석 패널
│   │   └── AIAnalysisPanel.css
│   │
│   ├── patient/tabs/
│   │   └── AiSummaryTab.tsx         # 환자 AI 요약 탭
│   │
│   └── dashboard/
│       ├── doctor/AiAlertPanel.tsx  # 의사 대시보드 알림
│       └── ris/RISAIFlagPanel.tsx   # RIS AI 플래그
│
└── services/
    └── ai.api.ts                    # AI API 클라이언트
```

### 1.2 문제점

#### 코드 중복
| 항목 | 중복 위치 | 설명 |
|------|----------|------|
| AI 모델 정보 | `AISummaryPage.tsx` (하드코딩) vs `ai.api.ts` (API) | 모델 정보가 두 곳에 정의됨 |
| 상태 라벨/색상 | `AIRequestListPage.tsx`, `AIRequestDetailPage.css` | STATUS_LABELS, STATUS_COLORS 중복 |
| 우선순위 배지 | 여러 CSS 파일 | .priority-badge 스타일 중복 |
| 날짜 포맷 함수 | 여러 컴포넌트 | formatDate, formatDateTime 중복 |

#### 스텁 컴포넌트
| 컴포넌트 | 상태 | 설명 |
|----------|------|------|
| AiViewer.tsx | 스텁 | OHIF/medDream 연동 필요 |
| AiResultPanel.tsx | 스텁 | AI 분석 결과 API 연동 필요 |
| AiLesionList.tsx | 스텁 | 하드코딩된 목업 데이터 |
| AiSummaryTab.tsx | 스텁 | 하드코딩된 분석 결과 |

#### 기능 분산
- `pages/ai/` - 메인 대시보드 (드롭다운으로 뷰 전환)
- `pages/ai-inference/` - 실제 요청 관리 페이지
- 두 영역이 분리되어 있어 혼란 야기

---

## 2. 정리 권고사항

### 2.1 코드 정리

#### 공통 상수 추출 (`src/constants/ai.constants.ts`)
```typescript
// AI 상태 정의
export const AI_STATUS = {
  PENDING: { label: '대기 중', color: 'status-pending', bg: '#fef3c7', text: '#92400e' },
  VALIDATING: { label: '검증 중', color: 'status-validating', bg: '#dbeafe', text: '#1e40af' },
  PROCESSING: { label: '처리 중', color: 'status-processing', bg: '#d1fae5', text: '#065f46' },
  COMPLETED: { label: '완료', color: 'status-completed', bg: '#d1fae5', text: '#065f46' },
  FAILED: { label: '실패', color: 'status-failed', bg: '#fee2e2', text: '#991b1b' },
  CANCELLED: { label: '취소됨', color: 'status-cancelled', bg: '#f3f4f6', text: '#6b7280' },
} as const;

// AI 우선순위 정의
export const AI_PRIORITY = {
  low: { label: '낮음', color: 'priority-low' },
  normal: { label: '보통', color: 'priority-normal' },
  high: { label: '높음', color: 'priority-high' },
  urgent: { label: '긴급', color: 'priority-urgent' },
} as const;
```

#### 공통 유틸 추출 (`src/utils/date.utils.ts`)
```typescript
export const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export const formatProcessingTime = (seconds: number | null): string => {
  if (seconds === null) return '-';
  if (seconds < 60) return `${seconds}초`;
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}분 ${secs}초`;
};
```

### 2.2 스타일 정리

#### 공통 AI 스타일 (`src/assets/style/ai-common.css`)
```css
/* AI 상태 배지 (통합) */
.ai-status-badge { /* ... */ }
.ai-status-badge.status-pending { /* ... */ }
.ai-status-badge.status-processing { /* ... */ }
/* ... */

/* AI 우선순위 배지 (통합) */
.ai-priority-badge { /* ... */ }
.ai-priority-badge.priority-low { /* ... */ }
/* ... */

/* AI 카드 공통 스타일 */
.ai-card { /* ... */ }
.ai-card-header { /* ... */ }
/* ... */
```

### 2.3 기능 통합

#### 권장 구조
```
src/pages/ai/
├── index.ts                    # 전체 export
├── AIDashboardPage.tsx         # 통합 대시보드 (기존 AISummaryPage 개선)
├── AIRequestListPage.tsx       # ai-inference에서 이동
├── AIRequestCreatePage.tsx     # ai-inference에서 이동
├── AIRequestDetailPage.tsx     # ai-inference에서 이동
├── components/
│   ├── AIViewer.tsx            # 영상 뷰어
│   ├── AIResultPanel.tsx       # 결과 패널
│   ├── AIAnalysisPanel.tsx     # ocs/components에서 이동
│   ├── AIStatusCard.tsx        # 상태 카드 (신규)
│   └── AIModelCard.tsx         # 모델 카드 (신규)
├── hooks/
│   └── useAIRequest.ts         # AI 요청 관련 훅
└── styles/
    └── ai.css                  # 통합 스타일
```

---

## 3. 삭제 가능 파일

| 파일 | 사유 | 조치 |
|------|------|------|
| `AiLesionList.tsx` | 미사용 스텁 | 삭제 권장 |
| `pages/ai-inference/` 폴더 | `pages/ai/`로 통합 시 | 이동 후 삭제 |

---

## 4. API 연동 현황

### 4.1 구현된 API (`ai.api.ts`)
| 함수 | 설명 | 상태 |
|------|------|------|
| `getAIModels()` | AI 모델 목록 | 구현됨 |
| `getAIModel(code)` | 모델 상세 | 구현됨 |
| `getAIRequests()` | 요청 목록 (필터) | 구현됨 |
| `getAIRequest(id)` | 요청 상세 | 구현됨 |
| `createAIRequest()` | 요청 생성 | 구현됨 |
| `cancelAIRequest()` | 요청 취소 | 구현됨 |
| `getAIRequestStatus()` | 상태 폴링 | 구현됨 |
| `validateAIData()` | 데이터 검증 | 구현됨 |
| `reviewAIResult()` | 결과 리뷰 | 구현됨 |
| `getPatientAIRequests()` | 환자별 요청 | 구현됨 |
| `getPatientAvailableModels()` | 환자별 가용 모델 | 구현됨 |

### 4.2 미연동 컴포넌트
| 컴포넌트 | 필요 API | 비고 |
|----------|----------|------|
| AiViewer | DICOM 뷰어 연동 | OHIF/medDream |
| AiResultPanel | 분석 결과 조회 | `getAIRequest().result` 사용 |
| AiSummaryTab | 환자별 AI 요약 | `getPatientAIRequests()` 사용 |
| AIAnalysisPanel | OCS 연계 분석 | OCS ID 기반 조회 필요 |

---

## 5. 라우팅 정리

### 현재 라우트
| 경로 | 컴포넌트 | 비고 |
|------|----------|------|
| `/ai-summary` | AISummaryPage | 메인 대시보드 |
| `/ai-inference/requests` | AIRequestListPage | 요청 목록 |
| `/ai-inference/requests/create` | AIRequestCreatePage | 요청 생성 |
| `/ai-inference/requests/:id` | AIRequestDetailPage | 요청 상세 |

### 권장 라우트 (통합 후)
| 경로 | 컴포넌트 | 비고 |
|------|----------|------|
| `/ai` | AIDashboardPage | 메인 대시보드 |
| `/ai/requests` | AIRequestListPage | 요청 목록 |
| `/ai/requests/create` | AIRequestCreatePage | 요청 생성 |
| `/ai/requests/:id` | AIRequestDetailPage | 요청 상세 |
| `/ai/models` | AIModelsPage | 모델 관리 (선택) |

---

## 6. 체크리스트

### 코드 정리
- [ ] 공통 상수 파일 생성 (`ai.constants.ts`)
- [ ] 공통 유틸 추출 (`date.utils.ts`)
- [ ] 중복 코드 제거
- [ ] 스텁 컴포넌트 실제 구현 또는 삭제

### 스타일 정리
- [ ] 공통 AI 스타일 파일 생성
- [ ] 중복 CSS 클래스 통합
- [ ] 일관된 색상/크기 적용

### 기능 통합
- [ ] `pages/ai-inference/` → `pages/ai/`로 이동
- [ ] 라우트 경로 통합
- [ ] 미사용 파일 삭제

### API 연동
- [ ] AiViewer DICOM 연동
- [ ] AiResultPanel API 연동
- [ ] AiSummaryTab API 연동
- [ ] AIAnalysisPanel OCS 연계

---

## 7. 참고 문서
- [AI_INTEGRATION.md](../ocs/docs/AI_INTEGRATION.md) - AI 연동 인터페이스 정의
- [ai.api.ts](../../services/ai.api.ts) - AI API 클라이언트
