import { useState, useCallback, useRef } from 'react'
import type {
  EditTool,
  EditorState,
  PolygonState,
  ViewMode,
  Coord3D,
  EditAction,
  SegmentationLabel,
} from '../types'
import { canvasTo3DCoord, getBrushCoords, cloneMask } from '../types'
import { useEditHistory } from './useEditHistory'

interface UseSegmentationEditorProps {
  initialMask: number[][][]
  shape: Coord3D
  enabled: boolean
}

interface UseSegmentationEditorReturn {
  // 상태
  editorState: EditorState
  editedMask: number[][][]
  polygon: PolygonState

  // 도구 선택
  setTool: (tool: EditTool) => void
  setBrushSize: (size: number) => void
  setSelectedLabel: (label: 1 | 2 | 3) => void

  // 마우스 이벤트 핸들러
  handleMouseDown: (canvasX: number, canvasY: number, sliceIdx: number, viewMode: ViewMode) => void
  handleMouseMove: (canvasX: number, canvasY: number, sliceIdx: number, viewMode: ViewMode) => void
  handleMouseUp: () => void

  // 폴리곤 도구
  handlePolygonClick: (canvasX: number, canvasY: number, sliceIdx: number, viewMode: ViewMode) => void
  completePolygon: (sliceIdx: number, viewMode: ViewMode) => void
  cancelPolygon: () => void

  // Undo/Redo
  canUndo: boolean
  canRedo: boolean
  undo: () => void
  redo: () => void

  // 저장/취소
  hasChanges: boolean
  resetToOriginal: () => void
  getEditedMask: () => number[][][]
}

export function useSegmentationEditor({
  initialMask,
  shape,
  enabled,
}: UseSegmentationEditorProps): UseSegmentationEditorReturn {
  // 편집 상태
  const [editorState, setEditorState] = useState<EditorState>({
    tool: 'brush',
    brushSize: 5,
    selectedLabel: 1,
    isDrawing: false,
    hasChanges: false,
  })

  // 편집된 마스크 (원본 복사본)
  const [editedMask, setEditedMask] = useState<number[][][]>(() => cloneMask(initialMask))

  // 폴리곤 상태
  const [polygon, setPolygon] = useState<PolygonState>({
    points: [],
    isComplete: false,
  })

  // 현재 액션의 영향받은 복셀들 (드래그 중 수집)
  const currentActionVoxels = useRef<EditAction['affectedVoxels']>([])
  const currentActionType = useRef<EditTool>('brush')

  // Undo/Redo 히스토리
  const { canUndo, canRedo, pushAction, undo: historyUndo, redo: historyRedo, clear: clearHistory } = useEditHistory()

  // 도구 설정
  const setTool = useCallback((tool: EditTool) => {
    setEditorState(prev => ({ ...prev, tool }))
    // 폴리곤 도구가 아니면 폴리곤 초기화
    if (tool !== 'polygon') {
      setPolygon({ points: [], isComplete: false })
    }
  }, [])

  const setBrushSize = useCallback((size: number) => {
    setEditorState(prev => ({ ...prev, brushSize: Math.max(1, Math.min(20, size)) }))
  }, [])

  const setSelectedLabel = useCallback((label: 1 | 2 | 3) => {
    setEditorState(prev => ({ ...prev, selectedLabel: label }))
  }, [])

  // 단일 복셀 또는 브러시 영역 수정
  const applyBrush = useCallback((
    canvasX: number,
    canvasY: number,
    sliceIdx: number,
    viewMode: ViewMode,
    label: SegmentationLabel
  ) => {
    const coords = getBrushCoords(canvasX, canvasY, sliceIdx, editorState.brushSize, viewMode, shape)

    setEditedMask(prevMask => {
      const newMask = cloneMask(prevMask)

      for (const [x, y, z] of coords) {
        if (x >= 0 && x < shape[0] && y >= 0 && y < shape[1] && z >= 0 && z < shape[2]) {
          const prevValue = prevMask[x][y][z]
          if (prevValue !== label) {
            newMask[x][y][z] = label

            // 액션 기록용
            currentActionVoxels.current.push({
              coord: [x, y, z],
              previousValue: prevValue,
              newValue: label,
            })
          }
        }
      }

      return newMask
    })
  }, [editorState.brushSize, shape])

  // 마우스 이벤트 핸들러
  const handleMouseDown = useCallback((
    canvasX: number,
    canvasY: number,
    sliceIdx: number,
    viewMode: ViewMode
  ) => {
    if (!enabled) return

    const { tool, selectedLabel } = editorState

    if (tool === 'brush' || tool === 'eraser') {
      setEditorState(prev => ({ ...prev, isDrawing: true }))
      currentActionVoxels.current = []
      currentActionType.current = tool

      const label: SegmentationLabel = tool === 'eraser' ? 0 : selectedLabel
      applyBrush(canvasX, canvasY, sliceIdx, viewMode, label)
    } else if (tool === 'fill') {
      // Flood Fill
      performFloodFill(canvasX, canvasY, sliceIdx, viewMode, selectedLabel)
    }
  }, [enabled, editorState, applyBrush])

  const handleMouseMove = useCallback((
    canvasX: number,
    canvasY: number,
    sliceIdx: number,
    viewMode: ViewMode
  ) => {
    if (!enabled || !editorState.isDrawing) return

    const { tool, selectedLabel } = editorState

    if (tool === 'brush' || tool === 'eraser') {
      const label: SegmentationLabel = tool === 'eraser' ? 0 : selectedLabel
      applyBrush(canvasX, canvasY, sliceIdx, viewMode, label)
    }
  }, [enabled, editorState, applyBrush])

  const handleMouseUp = useCallback(() => {
    if (!editorState.isDrawing) return

    setEditorState(prev => ({ ...prev, isDrawing: false, hasChanges: true }))

    // 액션 히스토리에 추가
    if (currentActionVoxels.current.length > 0) {
      pushAction({
        type: currentActionType.current,
        label: editorState.selectedLabel,
        affectedVoxels: [...currentActionVoxels.current],
        timestamp: Date.now(),
      })
      currentActionVoxels.current = []
    }
  }, [editorState.isDrawing, editorState.selectedLabel, pushAction])

  // Flood Fill 알고리즘
  const performFloodFill = useCallback((
    startX: number,
    startY: number,
    sliceIdx: number,
    viewMode: ViewMode,
    fillLabel: SegmentationLabel
  ) => {
    const coord = canvasTo3DCoord(startX, startY, sliceIdx, viewMode, shape)
    const [x, y, z] = coord

    if (x < 0 || x >= shape[0] || y < 0 || y >= shape[1] || z < 0 || z >= shape[2]) {
      return
    }

    setEditedMask(prevMask => {
      const newMask = cloneMask(prevMask)
      const targetLabel = prevMask[x][y][z]

      if (targetLabel === fillLabel) return prevMask

      const affectedVoxels: EditAction['affectedVoxels'] = []
      const stack: Coord3D[] = [[x, y, z]]
      const visited = new Set<string>()

      // 2D Flood Fill (현재 슬라이스만)
      while (stack.length > 0) {
        const [cx, cy, cz] = stack.pop()!
        const key = `${cx},${cy},${cz}`

        if (visited.has(key)) continue
        visited.add(key)

        // 범위 체크
        if (cx < 0 || cx >= shape[0] || cy < 0 || cy >= shape[1] || cz < 0 || cz >= shape[2]) {
          continue
        }

        // 같은 슬라이스만 처리 (2D Fill)
        const currentCoord = canvasTo3DCoord(startX, startY, sliceIdx, viewMode, shape)
        // viewMode에 따라 고정 축 확인
        let isSameSlice = false
        switch (viewMode) {
          case 'axial': isSameSlice = cz === currentCoord[2]; break
          case 'sagittal': isSameSlice = cx === currentCoord[0]; break
          case 'coronal': isSameSlice = cy === currentCoord[1]; break
        }
        if (!isSameSlice) continue

        if (newMask[cx][cy][cz] !== targetLabel) continue

        // 채우기
        newMask[cx][cy][cz] = fillLabel
        affectedVoxels.push({
          coord: [cx, cy, cz],
          previousValue: targetLabel,
          newValue: fillLabel,
        })

        // 4방향 이웃 추가 (2D)
        switch (viewMode) {
          case 'axial':
            stack.push([cx + 1, cy, cz], [cx - 1, cy, cz], [cx, cy + 1, cz], [cx, cy - 1, cz])
            break
          case 'sagittal':
            stack.push([cx, cy + 1, cz], [cx, cy - 1, cz], [cx, cy, cz + 1], [cx, cy, cz - 1])
            break
          case 'coronal':
            stack.push([cx + 1, cy, cz], [cx - 1, cy, cz], [cx, cy, cz + 1], [cx, cy, cz - 1])
            break
        }

        // 안전장치: 최대 복셀 수 제한
        if (affectedVoxels.length > 100000) break
      }

      // 히스토리에 추가
      if (affectedVoxels.length > 0) {
        pushAction({
          type: 'fill',
          label: fillLabel,
          affectedVoxels,
          timestamp: Date.now(),
        })
        setEditorState(prev => ({ ...prev, hasChanges: true }))
      }

      return newMask
    })
  }, [shape, pushAction])

  // 폴리곤 도구
  const handlePolygonClick = useCallback((
    canvasX: number,
    canvasY: number,
    _sliceIdx: number,
    _viewMode: ViewMode
  ) => {
    if (!enabled || editorState.tool !== 'polygon') return

    setPolygon(prev => ({
      ...prev,
      points: [...prev.points, { x: canvasX, y: canvasY }],
    }))
  }, [enabled, editorState.tool])

  const completePolygon = useCallback((sliceIdx: number, viewMode: ViewMode) => {
    if (polygon.points.length < 3) {
      setPolygon({ points: [], isComplete: false })
      return
    }

    // 폴리곤 내부 채우기 (Scanline 알고리즘)
    const affectedVoxels: EditAction['affectedVoxels'] = []
    const { selectedLabel } = editorState

    setEditedMask(prevMask => {
      const newMask = cloneMask(prevMask)

      // 폴리곤 바운딩 박스
      const minX = Math.floor(Math.min(...polygon.points.map(p => p.x)))
      const maxX = Math.ceil(Math.max(...polygon.points.map(p => p.x)))
      const minY = Math.floor(Math.min(...polygon.points.map(p => p.y)))
      const maxY = Math.ceil(Math.max(...polygon.points.map(p => p.y)))

      // 각 픽셀에 대해 폴리곤 내부인지 확인
      for (let cy = minY; cy <= maxY; cy++) {
        for (let cx = minX; cx <= maxX; cx++) {
          if (isPointInPolygon(cx, cy, polygon.points)) {
            const [x, y, z] = canvasTo3DCoord(cx, cy, sliceIdx, viewMode, shape)

            if (x >= 0 && x < shape[0] && y >= 0 && y < shape[1] && z >= 0 && z < shape[2]) {
              const prevValue = prevMask[x][y][z]
              if (prevValue !== selectedLabel) {
                newMask[x][y][z] = selectedLabel
                affectedVoxels.push({
                  coord: [x, y, z],
                  previousValue: prevValue,
                  newValue: selectedLabel,
                })
              }
            }
          }
        }
      }

      return newMask
    })

    // 히스토리에 추가
    if (affectedVoxels.length > 0) {
      pushAction({
        type: 'polygon',
        label: editorState.selectedLabel,
        affectedVoxels,
        timestamp: Date.now(),
      })
      setEditorState(prev => ({ ...prev, hasChanges: true }))
    }

    // 폴리곤 초기화
    setPolygon({ points: [], isComplete: false })
  }, [polygon.points, editorState.selectedLabel, shape, pushAction])

  const cancelPolygon = useCallback(() => {
    setPolygon({ points: [], isComplete: false })
  }, [])

  // Undo
  const undo = useCallback(() => {
    const newMask = historyUndo(editedMask)
    if (newMask) {
      setEditedMask(newMask)
    }
  }, [editedMask, historyUndo])

  // Redo
  const redo = useCallback(() => {
    const newMask = historyRedo(editedMask)
    if (newMask) {
      setEditedMask(newMask)
    }
  }, [editedMask, historyRedo])

  // 원본으로 리셋
  const resetToOriginal = useCallback(() => {
    setEditedMask(cloneMask(initialMask))
    clearHistory()
    setEditorState(prev => ({ ...prev, hasChanges: false }))
    setPolygon({ points: [], isComplete: false })
  }, [initialMask, clearHistory])

  // 편집된 마스크 반환
  const getEditedMask = useCallback(() => {
    return editedMask
  }, [editedMask])

  return {
    editorState,
    editedMask,
    polygon,
    setTool,
    setBrushSize,
    setSelectedLabel,
    handleMouseDown,
    handleMouseMove,
    handleMouseUp,
    handlePolygonClick,
    completePolygon,
    cancelPolygon,
    canUndo,
    canRedo,
    undo,
    redo,
    hasChanges: editorState.hasChanges,
    resetToOriginal,
    getEditedMask,
  }
}

/**
 * 점이 폴리곤 내부에 있는지 확인 (Ray Casting)
 */
function isPointInPolygon(x: number, y: number, polygon: Array<{ x: number; y: number }>): boolean {
  let inside = false
  const n = polygon.length

  for (let i = 0, j = n - 1; i < n; j = i++) {
    const xi = polygon[i].x, yi = polygon[i].y
    const xj = polygon[j].x, yj = polygon[j].y

    if (((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi)) {
      inside = !inside
    }
  }

  return inside
}

export default useSegmentationEditor
