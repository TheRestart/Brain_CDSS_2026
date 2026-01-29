# M1 세그멘테이션 편집 기능 문서

## 1. 개요

RIS(영상의학정보시스템)에서 M1 AI 모델이 생성한 뇌종양 세그멘테이션 결과를 담당 의료진이 수정할 수 있는 기능입니다.

### 주요 기능
- **편집 도구**: 브러시(1-20px), 지우개, 다각형 선택, 영역 채우기 (Flood Fill)
- **레이블**: NCR/NET(빨강, 1), ED(초록, 2), ET(파랑, 3)
- **Undo/Redo**: 최대 50개 액션 스택
- **백업**: 수정 시 원본 자동 백업
- **볼륨 재계산**: 저장 시 WT, TC, ET, NCR, ED 볼륨 자동 계산

---

## 2. 파일 구조

```
brain_tumor_front/src/components/ai/SegMRIViewer/
├── index.ts                          # 모듈 export
├── SegMRIViewer.tsx                  # 기존 뷰어 (읽기 전용)
├── SegmentationEditor.tsx            # 편집 컴포넌트 (메인)
├── SegmentationEditor.css            # 편집 UI 스타일
├── types.ts                          # 타입 정의 및 유틸리티
└── hooks/
    ├── useSegmentationEditor.ts      # 편집 상태 관리
    └── useEditHistory.ts             # Undo/Redo 스택

brain_tumor_front/src/pages/ocs/
├── RISStudyDetailPage.tsx            # canEditSegmentation 권한 체크
└── components/
    ├── AIViewerPanel.tsx             # SegmentationEditor 통합
    └── AIViewerPanel.css             # edit-badge 스타일

brain_tumor_front/src/services/
└── ai.api.ts                         # saveSegmentationData API 함수

brain_tumor_back/apps/ai_inference/
└── views.py                          # PUT /api/ai/inferences/<job_id>/segmentation/
```

---

## 3. 프론트엔드 구현

### 3.1 타입 정의 (types.ts)

```typescript
// 편집 도구
export type EditTool = 'brush' | 'eraser' | 'polygon' | 'fill' | 'select'

// 세그멘테이션 레이블 (BraTS 표준)
export type SegmentationLabel = 0 | 1 | 2 | 3
// 0: 배경, 1: NCR/NET, 2: ED, 3: ET

// 레이블 정보
export const LABEL_INFO = {
  0: { name: '배경', color: 'transparent', rgb: [0, 0, 0] },
  1: { name: 'NCR/NET', color: '#ff0000', rgb: [255, 0, 0] },
  2: { name: 'ED', color: '#00ff00', rgb: [0, 255, 0] },
  3: { name: 'ET', color: '#0000ff', rgb: [0, 0, 255] },
}

// 3D 좌표
export type Coord3D = [number, number, number]

// 편집 액션 (Undo/Redo용)
export interface EditAction {
  type: EditTool
  label: SegmentationLabel
  affectedVoxels: Array<{
    coord: Coord3D
    previousValue: number
    newValue: number
  }>
  timestamp: number
}
```

### 3.2 좌표 변환 (types.ts)

캔버스 2D 좌표 ↔ 3D 볼륨 좌표 변환:

```typescript
// Canvas → 3D Volume
export function canvasTo3DCoord(
  canvasX: number,
  canvasY: number,
  sliceIdx: number,
  viewMode: ViewMode,
  shape: Coord3D
): Coord3D {
  const [X, Y, Z] = shape
  switch (viewMode) {
    case 'axial':    return [canvasX, Y - 1 - canvasY, sliceIdx]
    case 'sagittal': return [sliceIdx, Y - 1 - canvasY, Z - 1 - canvasX]
    case 'coronal':  return [canvasX, sliceIdx, Z - 1 - canvasY]
  }
}

// 3D Volume → Canvas
export function coord3DToCanvas(
  x: number, y: number, z: number,
  viewMode: ViewMode,
  shape: Coord3D
): { canvasX: number; canvasY: number; sliceIdx: number } {
  const [X, Y, Z] = shape
  switch (viewMode) {
    case 'axial':    return { canvasX: x, canvasY: Y - 1 - y, sliceIdx: z }
    case 'sagittal': return { canvasX: Z - 1 - z, canvasY: Y - 1 - y, sliceIdx: x }
    case 'coronal':  return { canvasX: x, canvasY: Z - 1 - z, sliceIdx: y }
  }
}
```

### 3.3 편집 상태 관리 (useSegmentationEditor.ts)

```typescript
interface UseSegmentationEditorReturn {
  // 상태
  editorState: EditorState
  editedMask: number[][][]
  polygon: PolygonState

  // 도구 선택
  setTool: (tool: EditTool) => void
  setBrushSize: (size: number) => void
  setSelectedLabel: (label: 1 | 2 | 3) => void

  // 마우스 이벤트
  handleMouseDown, handleMouseMove, handleMouseUp

  // 폴리곤 도구
  handlePolygonClick, completePolygon, cancelPolygon

  // Undo/Redo
  canUndo, canRedo, undo, redo

  // 저장/취소
  hasChanges, resetToOriginal, getEditedMask
}
```

### 3.4 UI 레이아웃 (SegmentationEditor.tsx)

```
┌─────────────────────────────────────────────┐
│ 세그멘테이션 편집              [편집] 버튼  │
├─────────────────────────────────────────────┤
│ [🖌️] [🧹] [⬡] [🪣]  크기: [===●===] 5px   │
│ ● NCR(빨강) ○ ED(초록) ○ ET(파랑)         │
│ [↩ Undo] [↪ Redo]                          │
├─────────────────────────────────────────────┤
│ [Axial] [Sagittal] [Coronal]  투명도: ===  │
├─────────────────────────────────────────────┤
│                                             │
│              Canvas 영역                    │
│         (마우스 드래그로 편집)              │
│                                             │
├─────────────────────────────────────────────┤
│ 슬라이스: 64 / 128  [================]      │
├─────────────────────────────────────────────┤
│                      [저장] [취소]          │
└─────────────────────────────────────────────┘
```

---

## 4. 백엔드 구현

### 4.1 PUT API (views.py)

```
PUT /api/ai/inferences/<job_id>/segmentation/

Request:
{
  "edited_mask": "<base64 encoded uint8 array>",
  "shape": [128, 128, 128],
  "comment": "종양 경계 조정"
}

Response:
{
  "success": true,
  "backup_path": "backups/m1_segmentation_backup_20260129_143022.npz",
  "new_volumes": {
    "wt_volume": 45.2,
    "tc_volume": 23.1,
    "et_volume": 12.5,
    "ncr_volume": 10.6,
    "ed_volume": 22.1
  }
}
```

### 4.2 처리 흐름

```
1. 권한 검증
   - 담당 의료진(worker) 또는 superuser만 가능
   - OCS 상태: ACCEPTED, IN_PROGRESS, RESULT_READY

2. Base64 디코딩 → numpy array 변환

3. 원본 백업
   - backups/m1_segmentation_backup_{timestamp}.npz

4. 볼륨 재계산
   - NCR = (mask == 1).sum() * voxel_volume
   - ED  = (mask == 2).sum() * voxel_volume
   - ET  = (mask == 3).sum() * voxel_volume
   - WT  = NCR + ED + ET
   - TC  = NCR + ET

5. NPZ 파일 업데이트
   - mask: 수정된 마스크
   - *_volume: 재계산된 볼륨
   - _edited: True
   - _edited_at: ISO timestamp
   - _edited_by: user.id

6. 실패 시 백업에서 복원
```

### 4.3 파일 구조

```
CDSS_STORAGE/AI/<job_id>/
├── m1_segmentation.npz       # 현재 버전 (수정 시 덮어쓰기)
├── input.npz                 # 원본 MRI 데이터
└── backups/
    ├── m1_segmentation_backup_20260129_100000.npz  # 1차 수정 전
    ├── m1_segmentation_backup_20260129_143022.npz  # 2차 수정 전
    └── ...
```

---

## 5. 권한 체크

### 프론트엔드 (RISStudyDetailPage.tsx:689)

```typescript
const canEditSegmentation =
  ocsDetail.worker?.id === user?.id &&  // 담당 의료진
  ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY'].includes(ocsDetail.ocs_status)
```

### 백엔드 (views.py:1057-1073)

```python
# 담당자 또는 superuser만 수정 가능
is_worker = ocs.worker_id == user.id
is_superuser = user.is_superuser

if not (is_worker or is_superuser):
    return Response({'detail': '담당 의료진만 수정할 수 있습니다.'}, status=403)

# OCS 상태 검증
allowed_statuses = ['ACCEPTED', 'IN_PROGRESS', 'RESULT_READY']
if ocs.ocs_status not in allowed_statuses:
    return Response({'detail': f'현재 상태에서는 수정할 수 없습니다.'}, status=400)
```

---

## 6. 데이터 흐름

```
[사용자 편집]
     ↓
[SegmentationEditor] → handleSave()
     ↓
[encodeMaskToBase64()] → base64 인코딩
     ↓
[aiApi.saveSegmentationData()] → PUT 요청
     ↓
[Backend PUT API]
  ├─ 백업 생성
  ├─ 볼륨 재계산
  └─ NPZ 저장
     ↓
[Response: success, new_volumes]
     ↓
[loadSegmentationData()] → 데이터 리로드
     ↓
[UI 갱신]
```

---

## 7. 향후 개선 방향

### 7.1 기능 확장
- [ ] 3D 브러시 (여러 슬라이스 동시 편집)
- [ ] Magic Wand (유사 영역 자동 선택)
- [ ] 영역 복사/붙여넣기
- [ ] 편집 이력 시각화 (타임라인)
- [ ] 협업 편집 (실시간 동기화)

### 7.2 성능 최적화
- [ ] Web Worker를 이용한 마스크 연산
- [ ] 압축 전송 (gzip/brotli)
- [ ] 증분 저장 (변경된 부분만)

### 7.3 UX 개선
- [ ] 키보드 단축키 (B: 브러시, E: 지우개, Ctrl+Z: Undo)
- [ ] 줌/팬 기능
- [ ] 브러시 미리보기 커서
- [ ] 편집 전/후 비교 뷰

### 7.4 백업 관리
- [ ] 백업 목록 조회 API
- [ ] 특정 백업으로 복원 기능
- [ ] 백업 자동 정리 (30일 이상 삭제)

---

## 8. 관련 파일 목록

| 파일 | 역할 |
|------|------|
| `SegMRIViewer/types.ts` | 타입 정의, 좌표 변환, Base64 인코딩 |
| `SegMRIViewer/hooks/useEditHistory.ts` | Undo/Redo 스택 관리 |
| `SegMRIViewer/hooks/useSegmentationEditor.ts` | 편집 상태, 도구 로직 |
| `SegMRIViewer/SegmentationEditor.tsx` | 편집 UI 컴포넌트 |
| `SegMRIViewer/SegmentationEditor.css` | 다크 테마 스타일 |
| `pages/ocs/components/AIViewerPanel.tsx` | 편집기 통합 |
| `pages/ocs/RISStudyDetailPage.tsx` | 권한 체크 |
| `services/ai.api.ts` | saveSegmentationData API |
| `apps/ai_inference/views.py` | PUT 엔드포인트 |

---

## 9. 복구 방법

백업에서 복원이 필요한 경우:

```bash
# 백업 파일 확인
ls CDSS_STORAGE/AI/<job_id>/backups/

# 특정 백업으로 복원
cp CDSS_STORAGE/AI/<job_id>/backups/m1_segmentation_backup_YYYYMMDD_HHMMSS.npz \
   CDSS_STORAGE/AI/<job_id>/m1_segmentation.npz
```

---

*문서 작성일: 2026-01-29*
*작성자: Claude Code*
