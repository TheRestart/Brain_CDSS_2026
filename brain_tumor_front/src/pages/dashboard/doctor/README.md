# Doctor Dashboard 데이터 흐름

## 개요

의사 대시보드는 오늘 진료 예정 환자 정보를 요약 카드와 테이블 형태로 표시합니다.

## 컴포넌트 구조

```
DoctorDashboard
├── DoctorSummaryCards    # 상단 요약 카드 (KPI)
├── DoctorWorklist        # 금일 예약 환자 테이블
├── UnifiedCalendar       # 캘린더
├── AiAlertPanel          # AI 알림 패널
└── PatientListWidget     # 최근 환자 위젯
```

## 데이터 소스

### API 엔드포인트

```
GET /dashboard/doctor/stats/
```

### 응답 타입 (DoctorStats)

```typescript
type DoctorStats = {
  today_appointments: Array<{
    encounter_id: number;
    patient_id: number;
    patient_name: string;
    patient_number: string;
    scheduled_time: string;
    status: string;          // 'scheduled' | 'in_progress' | 'completed'
    encounter_type: string;  // 'outpatient' | 'inpatient' | 'emergency'
  }>;
  stats: {
    total_today: number;     // 오늘 전체 예약 수
    completed: number;       // 완료된 진료
    in_progress: number;     // 진료 중
    waiting: number;         // 대기 중
  };
}
```

## 컴포넌트별 데이터 사용

### DoctorSummaryCards

| 카드 | 데이터 소스 |
|------|-------------|
| 오늘 진료 예정 | `stats.total_today` |
| 진료 중 | `stats.in_progress` |
| AI Alert | 별도 API 필요 (현재 하드코딩) |
| 완료 | `stats.completed` |

### DoctorWorklist

| 항목 | 데이터 소스 |
|------|-------------|
| 요약 통계 (총 N명, 대기, 진료중, 완료) | `stats.*` |
| 환자 테이블 | `today_appointments` (최대 5명 표시) |

## 데이터 일관성

두 컴포넌트 모두 동일한 API(`getDoctorStats`)를 호출하여 데이터 일관성을 보장합니다.

- **DoctorSummaryCards**: `stats` 필드 사용
- **DoctorWorklist**: `stats` + `today_appointments` 필드 사용

## 상태 값 매핑

### 진료 상태 (status)

| API 값 | 한글 표시 | 배지 클래스 |
|--------|-----------|-------------|
| `scheduled` | 대기 | `scheduled` |
| `in_progress` | 진료중 | `in_progress` |
| `completed` | 완료 | `completed` |

### 진료 유형 (encounter_type)

| API 값 | 한글 표시 |
|--------|-----------|
| `outpatient` | 외래 |
| `inpatient` | 입원 |
| `emergency` | 응급 |

## 향후 개선 사항

- [ ] AI Alert 카드에 실제 API 데이터 연동
- [ ] 두 컴포넌트 간 API 호출 중복 제거 (상위 컴포넌트에서 데이터 fetch 후 props로 전달)
