# 결함 수정 계획서

작성일: 2026-01-29

---

## 결함 목록 요약

| # | 결함 | 우선순위 | 예상 난이도 |
|---|------|----------|-------------|
| 2 | OCS 취소 버튼 미구현 | 중간 | 낮음 |
| 3 | M1 종양 크기 상세/보고서 미표시 | 높음 | 중간 |
| 4 | admin의 system 권한 수정 제한 | 낮음 | 낮음 |
| 5 | 워터마크 버튼 투명 문제 | 낮음 | 낮음 |
| 6 | 외부 환자 study_id 중복 | 중간 | 중간 |
| 7 | 같은 MRI 중복 AI 추론 (더블클릭) | 중간 | 낮음 |
| 8 | 뷰어 길이/면적 편집 기능 | 낮음 | 높음 |

---

## #2. OCS 취소 버튼 미구현

### 현상
- 작업자(RIS)의 접수 취소 기능 백엔드는 구현됨
- 프론트엔드 취소 버튼 누락

### 해결 방안

#### 수정 파일
- `brain_tumor_front/src/pages/ocs/RISStudyDetailPage.tsx`

#### 구현 내용
```typescript
// 1. 취소 핸들러 추가
const handleCancelAcceptance = async () => {
  if (!confirm('접수를 취소하시겠습니까?')) return;

  try {
    await cancelOCSAcceptance(ocsDetail.id);  // API 호출
    alert('접수가 취소되었습니다.');
    navigate('/ocs/ris');  // 목록으로 이동
  } catch (error) {
    alert('접수 취소에 실패했습니다.');
  }
};

// 2. 버튼 추가 (헤더 영역)
{canEdit && ocsDetail.ocs_status === 'ACCEPTED' && (
  <button className="btn btn-danger" onClick={handleCancelAcceptance}>
    접수 취소
  </button>
)}
```

#### 필요 API 확인
- `POST /api/ocs/{id}/cancel-acceptance/` 존재 여부 확인
- 없으면 백엔드 API 추가 필요

---

## #3. M1 종양 크기 상세/보고서 미표시

### 현상
- 추론 직후에는 종양 크기(볼륨) 표시됨
- OCS 상세 페이지, M1 보고서에서 볼륨 정보 누락

### 원인 분석
1. 추론 완료 시 `result_data`에 볼륨 저장 여부 확인 필요
2. 프론트엔드에서 볼륨 데이터 조회/표시 로직 누락

### 해결 방안

#### Step 1: 백엔드 확인
```python
# views.py - M1 추론 완료 시 result_data에 볼륨 저장 확인
result_data = {
    'wt_volume': float(wt_volume),
    'tc_volume': float(tc_volume),
    'et_volume': float(et_volume),
    'ncr_volume': float(ncr_volume),
    'ed_volume': float(ed_volume),
    # ...
}
inference.result_data = result_data
inference.save()
```

#### Step 2: API 응답에 볼륨 포함 확인
```python
# GET /api/ai/inferences/<job_id>/ 응답에 포함되는지 확인
{
    "job_id": "...",
    "result": {
        "wt_volume": 45.2,
        "tc_volume": 23.1,
        ...
    }
}
```

#### Step 3: 프론트엔드 표시
```typescript
// AIAnalysisPanel.tsx 또는 관련 컴포넌트
// 볼륨 정보 표시 섹션 추가
{aiResult?.result?.wt_volume && (
  <div className="volume-info">
    <h4>종양 볼륨</h4>
    <div>WT (전체): {aiResult.result.wt_volume} ml</div>
    <div>TC (코어): {aiResult.result.tc_volume} ml</div>
    <div>ET (강화): {aiResult.result.et_volume} ml</div>
  </div>
)}
```

#### Step 4: 보고서에 볼륨 포함
- M1 보고서 템플릿에 볼륨 섹션 추가

---

## #4. admin의 system 권한 수정 제한

### 현상
- admin이 system 계정의 권한을 수정할 수 있음
- system 계정은 보호되어야 함

### 해결 방안

#### 백엔드 수정
```python
# accounts/views.py 또는 관련 뷰
class UserUpdateView(APIView):
    def put(self, request, user_id):
        target_user = User.objects.get(id=user_id)

        # system 계정 보호
        if target_user.username == 'system':
            return Response(
                {'detail': 'system 계정은 수정할 수 없습니다.'},
                status=status.HTTP_403_FORBIDDEN
            )

        # ... 기존 로직
```

#### 프론트엔드 수정
```typescript
// 사용자 관리 페이지에서 system 계정 편집 버튼 숨김
{user.username !== 'system' && (
  <button onClick={() => handleEdit(user)}>편집</button>
)}
```

---

## #5. 워터마크 버튼 투명 문제

### 현상
- PDF 인쇄 시 워터마크 설정의 txt/이미지 버튼이 투명하게 보임

### 해결 방안

#### CSS 수정
```css
/* PdfPreviewModal.css 또는 관련 스타일 */
.watermark-type-btn {
  background-color: #fff;  /* 배경색 명시 */
  opacity: 1;              /* 투명도 제거 */
  border: 1px solid #ccc;
}

.watermark-type-btn.active {
  background-color: #1976d2;
  color: #fff;
}
```

---

## #6. 외부 환자 study_id 중복

### 현상
- 외부 환자는 명명 규칙이 달라서 같은 환자에 2개 OCS 생성 시
- Orthanc에 저장은 되나 study_id가 같아서 1개만 불러옴

### 원인
- 외부 환자 DICOM의 StudyInstanceUID가 동일하거나 충돌

### 해결 방안

#### 옵션 A: 업로드 시 StudyInstanceUID 재생성
```python
# DICOM 업로드 시 새 StudyInstanceUID 할당
import pydicom
from pydicom.uid import generate_uid

def modify_study_uid(dicom_file, ocs_id):
    ds = pydicom.dcmread(dicom_file)
    # OCS ID 기반으로 고유 UID 생성
    new_study_uid = generate_uid(prefix=f"1.2.3.{ocs_id}.")
    ds.StudyInstanceUID = new_study_uid
    ds.save_as(dicom_file)
```

#### 옵션 B: OCS별 Study 매핑 테이블
```python
# 모델 추가
class OCSStudyMapping(models.Model):
    ocs = models.ForeignKey(OCS, on_delete=models.CASCADE)
    original_study_uid = models.CharField(max_length=255)
    orthanc_study_id = models.CharField(max_length=255)
    created_at = models.DateTimeField(auto_now_add=True)
```

---

## #7. 같은 MRI 중복 AI 추론 (더블클릭)

### 현상
- 버튼 더블클릭 시 같은 MRI에 대해 여러 AI 추론 요청 생성

### 해결 방안

#### 프론트엔드: 버튼 비활성화
```typescript
const [isRequesting, setIsRequesting] = useState(false);

const handleRequestAI = async () => {
  if (isRequesting) return;  // 중복 방지

  setIsRequesting(true);
  try {
    await aiApi.requestM1Inference(ocsId);
  } finally {
    setIsRequesting(false);
  }
};

<button
  onClick={handleRequestAI}
  disabled={isRequesting}
>
  {isRequesting ? '요청 중...' : 'M1 추론'}
</button>
```

#### 백엔드: 중복 체크
```python
# views.py
def request_inference(request, ocs_id):
    # 진행 중인 추론이 있는지 확인
    existing = AIInference.objects.filter(
        mri_ocs_id=ocs_id,
        status__in=['PENDING', 'PROCESSING']
    ).exists()

    if existing:
        return Response(
            {'detail': '이미 진행 중인 추론이 있습니다.'},
            status=status.HTTP_409_CONFLICT
        )
```

---

## #8. 뷰어 길이/면적 편집 기능

### 현상
- Orthanc/AI 뷰어에서 길이, 면적 등 측정 도구 없음

### 해결 방안 (장기 과제)

#### 옵션 A: Cornerstone.js 도구 활용
- 이미 사용 중인 Cornerstone.js의 측정 도구 활성화
- Length Tool, Area Tool, Angle Tool 등

#### 옵션 B: 커스텀 측정 도구
```typescript
// MeasurementTools.tsx
interface Measurement {
  type: 'length' | 'area' | 'angle';
  points: Point[];
  value: number;
  unit: string;
}

// 캔버스에 측정 오버레이 렌더링
const renderMeasurements = (ctx, measurements) => {
  measurements.forEach(m => {
    if (m.type === 'length') {
      // 두 점 사이 선 그리기
      // 거리 계산 및 표시
    }
  });
};
```

### 참고
- 이 기능은 복잡도가 높아 별도 스프린트로 진행 권장
- OHIF Viewer 또는 다른 의료 영상 뷰어 라이브러리 검토

---

## 구현 순서 권장

### Phase 1 (즉시)
1. **#7** 더블클릭 방지 - 간단한 수정
2. **#4** system 권한 보호 - 보안 관련
3. **#5** 워터마크 CSS - UI 수정

### Phase 2 (이번 주)
4. **#2** OCS 취소 버튼 - 기능 완성
5. **#3** M1 볼륨 표시 - 핵심 기능

### Phase 3 (다음 주)
6. **#6** study_id 중복 - 설계 필요

### Phase 4 (별도 계획)
7. **#8** 측정 도구 - 대규모 기능

---

## 작업 체크리스트

- [ ] #7 더블클릭 방지
- [ ] #4 system 계정 보호
- [ ] #5 워터마크 CSS 수정
- [ ] #2 OCS 취소 버튼 추가
- [ ] #3 M1 볼륨 표시 (백엔드 확인)
- [ ] #3 M1 볼륨 표시 (프론트엔드)
- [ ] #3 M1 보고서에 볼륨 추가
- [ ] #6 study_id 중복 해결 설계
- [ ] #6 study_id 중복 해결 구현
- [ ] #8 측정 도구 요구사항 정의

---

*작성자: Claude Code*
