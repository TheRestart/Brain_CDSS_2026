# AI 분석 연동 가이드

## 개요

RIS 페이지의 AI 분석 기능은 현재 **목업 데이터**로 구현되어 있습니다.
실제 AI 서비스 연동 시 이 문서를 참고하여 구현하세요.

---

## 인터페이스 정의

### AIAnalysisResult

```typescript
interface AIAnalysisResult {
  analysis_id: string;           // AI 분석 고유 ID
  analysis_date: string;         // 분석 일시 (ISO 8601)
  model_version: string;         // AI 모델 버전
  status: 'completed' | 'processing' | 'failed' | 'pending';

  // 위험도 평가
  risk_level: 'high' | 'medium' | 'low' | 'normal';
  risk_score: number;            // 0-100
  confidence: number;            // 0-100 (모델 신뢰도)

  // 주요 소견
  findings: AIFinding[];

  // 요약
  summary: string;

  // 상세 분석 (옵션)
  details?: AIAnalysisDetail[];
}
```

### AIFinding

```typescript
interface AIFinding {
  id: string;
  type: string;                  // 'lesion', 'abnormality', 'artifact' 등
  description: string;           // 소견 설명
  location?: string;             // 해부학적 위치
  severity: 'critical' | 'major' | 'minor' | 'observation';
  confidence: number;            // 0-100
  bbox?: {                       // 이미지 내 바운딩 박스 (옵션)
    x: number;
    y: number;
    width: number;
    height: number;
  };
}
```

### AIAnalysisDetail

```typescript
interface AIAnalysisDetail {
  category: string;              // 카테고리명
  metrics: {
    name: string;
    value: string | number;
    unit?: string;
  }[];
}
```

---

## API 엔드포인트 (제안)

### 1. AI 분석 요청

```
POST /api/ai/analyze/
```

**Request:**
```json
{
  "ocs_id": 123,
  "study_uid": "1.2.3.4.5...",
  "modality": "MRI",
  "priority": "normal"
}
```

**Response:**
```json
{
  "analysis_id": "AI-20240115-001",
  "status": "processing",
  "estimated_time": 30
}
```

### 2. AI 분석 결과 조회

```
GET /api/ai/results/{ocs_id}/
```

**Response:** `AIAnalysisResult` 객체

### 3. AI 분석 상태 확인

```
GET /api/ai/status/{analysis_id}/
```

**Response:**
```json
{
  "analysis_id": "AI-20240115-001",
  "status": "completed",
  "progress": 100
}
```

---

## 프론트엔드 연동 방법

### 1. API 서비스 추가

`src/services/ai.api.ts` 파일 생성:

```typescript
import api from './api';
import type { AIAnalysisResult } from '@/pages/ocs/components/AIAnalysisPanel';

export const requestAIAnalysis = async (ocsId: number): Promise<{ analysis_id: string }> => {
  const response = await api.post('/ai/analyze/', { ocs_id: ocsId });
  return response.data;
};

export const getAIAnalysisResult = async (ocsId: number): Promise<AIAnalysisResult> => {
  const response = await api.get(`/ai/results/${ocsId}/`);
  return response.data;
};

export const getAIAnalysisStatus = async (analysisId: string): Promise<{ status: string; progress: number }> => {
  const response = await api.get(`/ai/status/${analysisId}/`);
  return response.data;
};
```

### 2. AIAnalysisPanel 수정

`src/pages/ocs/components/AIAnalysisPanel.tsx`에서 목업 코드를 실제 API 호출로 교체:

```typescript
useEffect(() => {
  const fetchAIResult = async () => {
    setLoading(true);
    try {
      // 실제 API 호출
      const data = await getAIAnalysisResult(ocsId);
      setResult(data);
    } catch (error) {
      console.error('Failed to fetch AI result:', error);
      setResult(null);
    } finally {
      setLoading(false);
    }
  };

  fetchAIResult();
}, [ocsId]);
```

---

## 백엔드 연동 포인트

### Django 모델 (제안)

```python
class AIAnalysis(models.Model):
    ocs = models.ForeignKey('ocs.OCS', on_delete=models.CASCADE, related_name='ai_analyses')
    analysis_id = models.CharField(max_length=50, unique=True)
    status = models.CharField(max_length=20, choices=[
        ('pending', 'Pending'),
        ('processing', 'Processing'),
        ('completed', 'Completed'),
        ('failed', 'Failed'),
    ])
    model_version = models.CharField(max_length=50)
    risk_level = models.CharField(max_length=20)
    risk_score = models.IntegerField()
    confidence = models.IntegerField()
    summary = models.TextField()
    findings = models.JSONField(default=list)
    details = models.JSONField(default=list, null=True)
    created_at = models.DateTimeField(auto_now_add=True)
    completed_at = models.DateTimeField(null=True)
```

### AI 서비스 연동

실제 AI 분석은 다음 방식 중 선택:

1. **동기 방식**: API 호출 시 즉시 분석 후 결과 반환
2. **비동기 방식**: Celery 태스크로 처리, 폴링 또는 WebSocket으로 결과 알림
3. **외부 서비스**: 외부 AI API 호출 (예: Azure Health Insights, AWS HealthLake)

---

## 주의사항

1. **의료 면책 조항 필수**: AI 결과는 참고용이며 최종 판단은 의료진이 수행
2. **개인정보 보호**: DICOM 익명화 후 AI 서비스 전송
3. **감사 로그**: 모든 AI 분석 요청/결과 이력 보관
4. **폴백 처리**: AI 서비스 장애 시 수동 판독 워크플로우 유지

---

## 참고 파일

- `src/pages/ocs/components/AIAnalysisPanel.tsx` - AI 패널 컴포넌트
- `src/pages/ocs/RISStudyDetailPage.tsx` - AI 패널 사용처
- `src/types/ocs.ts` - RIS 관련 타입 정의
