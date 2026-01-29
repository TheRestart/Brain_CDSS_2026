/**
 * 세그멘테이션 편집 관련 타입 정의
 */

// 편집 도구 타입
export type EditTool = 'brush' | 'eraser' | 'polygon' | 'fill' | 'select'

// 세그멘테이션 레이블 (BraTS 표준)
export type SegmentationLabel = 0 | 1 | 2 | 3
// 0: 배경, 1: NCR/NET (Necrotic Core), 2: ED (Edema), 3: ET (Enhancing Tumor)

// 레이블 정보
export const LABEL_INFO: Record<SegmentationLabel, { name: string; color: string; rgb: [number, number, number] }> = {
  0: { name: '배경', color: 'transparent', rgb: [0, 0, 0] },
  1: { name: 'NCR/NET', color: '#ff0000', rgb: [255, 0, 0] },
  2: { name: 'ED', color: '#00ff00', rgb: [0, 255, 0] },
  3: { name: 'ET', color: '#0000ff', rgb: [0, 0, 255] },
}

// 뷰 모드
export type ViewMode = 'axial' | 'sagittal' | 'coronal'

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

// 편집 상태
export interface EditorState {
  tool: EditTool
  brushSize: number          // 1-20
  selectedLabel: 1 | 2 | 3   // 0 제외 (배경은 지우개로)
  isDrawing: boolean
  hasChanges: boolean
}

// 폴리곤 상태
export interface PolygonState {
  points: Array<{ x: number; y: number }>
  isComplete: boolean
}

// 편집 이력 상태
export interface EditHistoryState {
  past: EditAction[]
  future: EditAction[]
}

// 편집된 마스크 저장 요청
export interface SaveSegmentationRequest {
  edited_mask: string  // base64
  shape: Coord3D
  edit_summary?: {
    tool_used: EditTool[]
    labels_modified: SegmentationLabel[]
    voxels_changed: number
  }
  comment?: string
}

// 저장 응답
export interface SaveSegmentationResponse {
  success: boolean
  backup_path: string
  new_volumes: {
    wt_volume: number
    tc_volume: number
    et_volume: number
    ncr_volume: number
    ed_volume: number
  }
  edit_history_id?: number
}

// 볼륨 데이터 타입
export interface VolumeData {
  wt_volume?: number  // Whole Tumor
  tc_volume?: number  // Tumor Core
  et_volume?: number  // Enhancing Tumor
  ncr_volume?: number // NCR/NET
  ed_volume?: number  // Edema
}

// SegmentationEditor Props
export interface SegmentationEditorProps {
  // 기존 SegMRIViewer props
  data: {
    mri: number[][][]
    groundTruth: number[][][]
    prediction: number[][][]
    shape: Coord3D
    mri_channels?: {
      t1?: number[][][]
      t1ce?: number[][][]
      t2?: number[][][]
      flair?: number[][][]
    }
    volumes?: VolumeData  // 예측 볼륨 정보
  }
  title?: string
  initialViewMode?: ViewMode
  maxCanvasSize?: number

  // 편집 관련 props
  jobId: string
  canEdit: boolean
  onSave?: (request: SaveSegmentationRequest) => Promise<SaveSegmentationResponse>
  onCancel?: () => void
}

// 좌표 변환 유틸리티
export function canvasTo3DCoord(
  canvasX: number,
  canvasY: number,
  sliceIdx: number,
  viewMode: ViewMode,
  shape: Coord3D
): Coord3D {
  const [, Y, Z] = shape

  switch (viewMode) {
    case 'axial':
      // canvas[y][x] → volume[x][Y-1-y][sliceIdx]
      return [canvasX, Y - 1 - canvasY, sliceIdx]
    case 'sagittal':
      // canvas[z][y] → volume[sliceIdx][Y-1-y][Z-1-z]
      return [sliceIdx, Y - 1 - canvasY, Z - 1 - canvasX]
    case 'coronal':
      // canvas[z][x] → volume[x][sliceIdx][Z-1-z]
      return [canvasX, sliceIdx, Z - 1 - canvasY]
  }
}

// 3D 좌표를 캔버스 좌표로 변환 (역변환)
export function coord3DToCanvas(
  x: number,
  y: number,
  z: number,
  viewMode: ViewMode,
  shape: Coord3D
): { canvasX: number; canvasY: number; sliceIdx: number } {
  const [, Y, Z] = shape

  switch (viewMode) {
    case 'axial':
      return { canvasX: x, canvasY: Y - 1 - y, sliceIdx: z }
    case 'sagittal':
      return { canvasX: Z - 1 - z, canvasY: Y - 1 - y, sliceIdx: x }
    case 'coronal':
      return { canvasX: x, canvasY: Z - 1 - z, sliceIdx: y }
  }
}

// 브러시 범위 내 좌표 계산
export function getBrushCoords(
  centerX: number,
  centerY: number,
  sliceIdx: number,
  brushSize: number,
  viewMode: ViewMode,
  shape: Coord3D
): Coord3D[] {
  const coords: Coord3D[] = []
  const radius = Math.floor(brushSize / 2)

  for (let dy = -radius; dy <= radius; dy++) {
    for (let dx = -radius; dx <= radius; dx++) {
      // 원형 브러시
      if (dx * dx + dy * dy <= radius * radius) {
        const canvasX = centerX + dx
        const canvasY = centerY + dy

        // 캔버스 범위 체크
        const [X, Y, Z] = shape
        let maxX: number, maxY: number

        switch (viewMode) {
          case 'axial':
            maxX = X
            maxY = Y
            break
          case 'sagittal':
            maxX = Z
            maxY = Y
            break
          case 'coronal':
            maxX = X
            maxY = Z
            break
        }

        if (canvasX >= 0 && canvasX < maxX && canvasY >= 0 && canvasY < maxY) {
          coords.push(canvasTo3DCoord(canvasX, canvasY, sliceIdx, viewMode, shape))
        }
      }
    }
  }

  return coords
}

// 3D 마스크 깊은 복사
export function cloneMask(mask: number[][][]): number[][][] {
  return mask.map(plane => plane.map(row => [...row]))
}

// 3D 마스크를 base64로 인코딩
export function encodeMaskToBase64(mask: number[][][]): string {
  const shape = [mask.length, mask[0].length, mask[0][0].length]
  const flat = new Uint8Array(shape[0] * shape[1] * shape[2])

  let idx = 0
  for (let x = 0; x < shape[0]; x++) {
    for (let y = 0; y < shape[1]; y++) {
      for (let z = 0; z < shape[2]; z++) {
        flat[idx++] = mask[x][y][z]
      }
    }
  }

  // Uint8Array를 base64로 변환
  let binary = ''
  for (let i = 0; i < flat.length; i++) {
    binary += String.fromCharCode(flat[i])
  }
  return btoa(binary)
}
