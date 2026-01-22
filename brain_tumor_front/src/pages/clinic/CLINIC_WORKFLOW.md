# 진료 워크플로우 가이드

## 진료 상태 (Encounter Status)

| 상태 | 설명 |
|------|------|
| `scheduled` | 예약됨 - 진료 대기 상태 |
| `in_progress` | 진료 중 - 현재 진료가 진행 중 |
| `completed` | 완료됨 - 진료 종료, 과거 기록에 표시 |
| `cancelled` | 취소됨 |

---

## 진료 흐름

```
환자 선택 → 진료 시작 → SOAP 작성/저장 → 처방 → 진료 종료
```

### 1. 진료 시작 버튼
- **위치**: 환자 헤더 우측
- **조건**: 환자 선택 + 진행 중인 진료 없음 + DOCTOR/SYSTEMMANAGER 역할
- **동작**:
  - 새 Encounter 생성 (`status: in_progress`)
  - SOAP 노트 입력 가능

### 2. SOAP 저장 버튼
- **위치**: SOAP 노트 섹션 우측 상단
- **동작**:
  - DB에 SOAP 데이터 저장 (`PATCH /api/encounters/:id/`)
  - 진료 상태는 `in_progress` 유지
  - 여러 번 저장 가능 (수정/업데이트)
- **주의**: 저장해도 과거 진료 기록에는 표시되지 않음

### 3. 진료 종료 버튼
- **위치**: 환자 헤더 우측 (진료 시작 버튼 대신 표시)
- **조건**: 진행 중인 진료가 있을 때
- **동작**:
  - Encounter 상태를 `completed`로 변경
  - 과거 진료 기록 목록 새로고침
  - 과거 처방전 목록 새로고침
  - 캘린더에 해당 날짜 마커 추가

---

## 데이터 표시 조건

### 과거 진료 기록 (PastRecordCard)
- `status === 'completed'` 인 진료만 표시
- 최근 10건까지
- SOAP 노트가 있으면 "SOAP" 배지 표시

### 과거 처방전 (PastPrescriptionCard)
- 해당 환자의 모든 처방 표시
- 진료 종료 시 새로고침됨

---

## 관련 파일

| 파일 | 설명 |
|------|------|
| `ClinicPage.tsx` | 진료 페이지 메인, 진료 시작/종료 로직 |
| `ExaminationTab.tsx` | 진찰 탭, SOAP 입력/저장 |
| `PastRecordCard.tsx` | 과거 진료 기록 카드 |
| `PastPrescriptionCard.tsx` | 과거 처방전 카드 |

---

## API 엔드포인트

| 동작 | Method | Endpoint |
|------|--------|----------|
| 진료 생성 | POST | `/api/encounters/` |
| SOAP 저장 | PATCH | `/api/encounters/:id/` |
| 진료 종료 | POST | `/api/encounters/:id/complete/` |
| 진료 목록 조회 | GET | `/api/encounters/?patient=:patientId` |

---

## 새로고침 트리거

| 이벤트 | 새로고침 대상 |
|--------|--------------|
| SOAP 저장 | 없음 (로컬 상태만 업데이트) |
| 처방 발행 | 과거 처방전 (`prescriptionRefreshKey`) |
| 진료 종료 | 과거 진료 기록 + 과거 처방전 (`recordRefreshKey`) |
