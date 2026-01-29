# modAI Server

FastAPI 기반 AI 추론 서버 (뇌종양 분석 모델)

## 기술 스택

- FastAPI 0.128
- Celery + Redis (비동기 작업 큐)
- PyTorch + MONAI (딥러닝)
- pydicom / nibabel (의료 영상 처리)

## 프로젝트 구조

```
modAI/
├── main.py           # FastAPI 진입점
├── config.py         # 환경 설정
├── celery_app.py     # Celery 설정
├── routers/          # API 라우터 (m1, mg, mm)
├── services/         # 추론 로직
├── tasks/            # Celery 비동기 태스크
├── schemas/          # Pydantic 스키마
├── inference/        # 전처리 파이프라인
├── utils/            # Orthanc 클라이언트
└── model/            # AI 가중치 파일
```

## AI 모델

| 모델 | 입력 | 출력 |
|------|------|------|
| **M1** | 4채널 MRI (T1, T1CE, T2, FLAIR) | Grade, IDH, MGMT 분류 + 종양 분할 |
| **MG** | 유전자 발현 CSV | Survival Risk, Grade, Recurrence, TMZ Response |
| **MM** | MRI + Gene + Protein 특징 | Survival 위험도, Risk Group |

## API 엔드포인트

```
# M1 (MRI 분석)
POST /api/v1/m1/inference          # 추론 요청
GET  /api/v1/m1/task/{id}/status   # 상태 조회

# MG (유전자 분석)
POST /api/v1/mg/inference
GET  /api/v1/mg/task/{id}/status

# MM (멀티모달)
POST /api/v1/mm/inference
GET  /api/v1/mm/task/{id}/status
```

## 비동기 처리 구조

```
┌─────────────┐     POST      ┌─────────────┐
│   Django    │──────────────▶│   FastAPI   │
│   Backend   │               │  (port 9000)│
└─────────────┘               └──────┬──────┘
       ▲                             │
       │ callback                    │ enqueue
       │                             ▼
┌──────┴──────┐               ┌─────────────┐
│   결과 수신  │◀──────────────│   Celery    │
└─────────────┘    완료 후     │   Worker    │
                              └──────┬──────┘
                                     │
                              ┌──────▼──────┐
                              │    Redis    │
                              │ (msg broker)│
                              └─────────────┘
```

## Celery 큐 구성

- `m1_queue`: MRI 추론 (무거움)
- `mg_queue`: 유전자 추론 (가벼움)
- `mm_queue`: 멀티모달 추론

## DICOM 처리 흐름

1. Study UID로 Orthanc에서 시리즈 조회
2. T1, T1CE, T2, FLAIR 4개 모달리티 매칭
3. DICOM → 4D 볼륨 변환
4. 정규화, 리샘플링, 패딩 전처리
5. SwinUNETR 모델 추론

## 모델 가중치

```
model/
├── M1_Cls_best.pth           # 247MB (분류)
├── M1_Seg_separate_best.pth  # 245MB (분할)
├── mg_4tasks_best.pt         # 2.1MB
└── mm_best.pt                # 5.9MB
```
