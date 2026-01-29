# Brain Tumor Backend

Django 기반 REST API 서버 (뇌종양 진단 지원 시스템 CDSS)

## 기술 스택

- Django 5.2 + Django REST Framework
- JWT 인증 (SimpleJWT)
- WebSocket (Django Channels + Redis)
- pydicom (DICOM 처리)

## 프로젝트 구조

```
brain_tumor_back/
├── config/           # Django 설정 (base, dev, prod)
├── apps/             # Django 앱들
│   ├── accounts/     # 사용자/역할 관리 (RBAC)
│   ├── ai_inference/ # AI 추론 요청/결과 (modAI 연동)
│   ├── ocs/          # Order Communication System
│   ├── patients/     # 환자 관리
│   ├── imaging/      # 영상 검사 메타데이터
│   ├── encounters/   # 진료 기록
│   ├── treatment/    # 치료 관리
│   ├── followup/     # 경과 추적
│   └── orthancproxy/ # DICOM 서버 프록시
└── utils/            # 공통 유틸리티
```

## 핵심 앱 역할

| 앱 | 역할 |
|----|------|
| accounts | 사용자 인증, 역할 기반 권한 (ADMIN, DOCTOR, NURSE, RIS, LIS) |
| ai_inference | AI 추론 요청 → modAI 호출 → 결과 콜백 수신 |
| ocs | 의사→작업자 오더 관리 (ORDERED→ACCEPTED→COMPLETED→CONFIRMED) |
| imaging | DICOM Study 메타데이터 관리 |
| orthancproxy | Orthanc DICOM 서버 프록시 API |

## 외부 서비스 연동

```
┌─────────────────┐     HTTP      ┌─────────────┐
│  Django Back    │──────────────▶│   modAI     │
│  (port 8000)    │◀──callback────│ (port 9000) │
└─────────────────┘               └─────────────┘
        │
        │ DICOM API
        ▼
┌─────────────────┐
│    Orthanc      │
│  (DICOM 서버)   │
└─────────────────┘
```

## AI 추론 흐름

1. 의사가 AI 추론 요청 (M1/MG/MM)
2. Backend → modAI POST 요청
3. modAI 비동기 처리 (Celery)
4. 완료 후 callback으로 결과 수신
5. AIInference 테이블에 결과 저장

## 주요 API 엔드포인트

```
/api/auth/          # 인증
/api/patients/      # 환자 관리
/api/ocs/           # OCS 관리
/api/ai/            # AI 추론 (m1, mg, mm)
/api/imaging/       # 영상 관리
/api/orthanc/       # DICOM 프록시
```

## 저장소 구조

```
CDSS_STORAGE/
├── AI/     # modAI 추론 결과
├── RIS/    # 영상 관련 파일
└── LIS/    # 검사실 관련 파일
```
