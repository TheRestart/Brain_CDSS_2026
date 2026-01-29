# Brain Tumor Frontend

React 기반 웹 애플리케이션 (의료 영상 분석 플랫폼)

## 기술 스택

- React 19 + TypeScript
- Vite (빌드)
- React Router v7
- TanStack React Query v5
- Material-UI v7
- Cornerstone (DICOM 뷰어)
- Three.js (3D 렌더링)

## 프로젝트 구조

```
brain_tumor_front/src/
├── pages/              # 페이지 컴포넌트
│   ├── auth/           # 로그인, 비밀번호 변경
│   ├── dashboard/      # 역할별 대시보드 (doctor, nurse, ris, lis)
│   ├── ocs/            # 영상검사/검사실 상세
│   ├── patient/        # 환자 정보, 진료 기록
│   ├── admin/          # 사용자/역할 관리
│   └── ai/             # AI 추론 결과
├── components/         # 재사용 컴포넌트
│   ├── ai/             # AI 관련 (SegMRIViewer, MGResultViewer 등)
│   └── common/         # 공통 (Toast, Spinner 등)
├── services/           # API 통신 (Axios)
├── context/            # 전역 상태 (Auth, AIInference, OCS 알림)
├── hooks/              # 커스텀 훅
├── socket/             # WebSocket (OCS/권한 실시간 알림)
└── types/              # TypeScript 타입
```

## 상태 관리

| 방식 | 용도 |
|------|------|
| Context API | 인증, AI 추론 상태, OCS 알림 (전역) |
| React Query | 서버 데이터 캐싱 및 동기화 |
| useState | 컴포넌트 로컬 상태 (폼, 모달) |

## 주요 기능

- **역할 기반 UI**: 의사/간호사/RIS/LIS/환자별 맞춤 대시보드
- **DICOM 뷰어**: Cornerstone 기반 의료 영상 표시
- **AI 추론**: M1(MRI), MG(유전자), MM(멀티모달) 결과 조회
- **실시간 알림**: WebSocket으로 OCS 상태 변경 즉시 반영
- **세션 관리**: 30분 타임아웃, 자동 토큰 갱신

## API 통신

```
services/
├── api.ts          # Axios 설정 (인터셉터, 토큰 갱신)
├── auth.api.ts     # 인증 API
├── ai.api.ts       # AI 추론 API
├── ocs.api.ts      # OCS API
├── patient.api.ts  # 환자 API
└── imaging.api.ts  # 영상 API
```

## 데이터 흐름

```
┌──────────────┐    HTTP/WS    ┌─────────────────┐
│   Frontend   │──────────────▶│  Django Backend │
│  (port 5173) │◀──────────────│   (port 8000)   │
└──────────────┘               └─────────────────┘
       │
       │ DICOM Viewer
       ▼
┌──────────────┐
│   Orthanc    │
│ (DICOM 이미지)│
└──────────────┘
```
