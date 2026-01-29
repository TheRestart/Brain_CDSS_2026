import React, { useRef, useEffect, useState, useCallback } from 'react'
import type {
  SegmentationEditorProps,
  ViewMode,
  EditTool,
  SaveSegmentationRequest,
} from './types'
import { LABEL_INFO, encodeMaskToBase64 } from './types'
import { useSegmentationEditor } from './hooks/useSegmentationEditor'
import './SegmentationEditor.css'

// 레이블 컬러 (기존 SegMRIViewer와 동일)
const LABEL_COLORS: Record<number, { r: number; g: number; b: number }> = {
  1: { r: 255, g: 0, b: 0 },    // NCR/NET - Red
  2: { r: 0, g: 255, b: 0 },    // ED - Green
  3: { r: 0, g: 0, b: 255 },    // ET - Blue
}

/**
 * 세그멘테이션 편집 컴포넌트
 * 기존 SegMRIViewer를 확장하여 편집 기능 추가
 */
const SegmentationEditor: React.FC<SegmentationEditorProps> = ({
  data,
  title = '세그멘테이션 편집',
  initialViewMode = 'axial',
  maxCanvasSize = 450,
  jobId: _jobId,
  canEdit,
  onSave,
  onCancel,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [currentSlice, setCurrentSlice] = useState(0)
  const [segOpacity, setSegOpacity] = useState(0.6)
  const [isEditMode, setIsEditMode] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  // 슬라이스 수 계산
  const getMaxSlice = useCallback(() => {
    const [X, Y, Z] = data.shape
    switch (viewMode) {
      case 'axial': return Z - 1
      case 'sagittal': return X - 1
      case 'coronal': return Y - 1
    }
  }, [data.shape, viewMode])

  // 편집 Hook
  const editor = useSegmentationEditor({
    initialMask: data.prediction,
    shape: data.shape,
    enabled: isEditMode && canEdit,
  })

  // 뷰모드 변경 시 슬라이스 초기화
  useEffect(() => {
    const maxSlice = getMaxSlice()
    setCurrentSlice(Math.floor(maxSlice / 2))
  }, [viewMode, getMaxSlice])

  // 캔버스 크기 계산
  const getCanvasSize = useCallback(() => {
    const [X, Y, Z] = data.shape
    let width: number, height: number

    switch (viewMode) {
      case 'axial':
        width = X
        height = Y
        break
      case 'sagittal':
        width = Z
        height = Y
        break
      case 'coronal':
        width = X
        height = Z
        break
    }

    const scale = Math.min(maxCanvasSize / width, maxCanvasSize / height)
    return {
      width: Math.floor(width * scale),
      height: Math.floor(height * scale),
      scaleX: scale,
      scaleY: scale,
      rawWidth: width,
      rawHeight: height,
    }
  }, [data.shape, viewMode, maxCanvasSize])

  // 2D 슬라이스 추출
  const getSlice = useCallback((volume: number[][][], sliceIdx: number): number[][] | null => {
    if (!volume || volume.length === 0) return null

    const [X, Y, Z] = data.shape

    switch (viewMode) {
      case 'axial': {
        if (sliceIdx < 0 || sliceIdx >= Z) return null
        const slice: number[][] = []
        for (let y = 0; y < Y; y++) {
          slice[y] = []
          for (let x = 0; x < X; x++) {
            slice[y][x] = volume[x][Y - 1 - y][sliceIdx]
          }
        }
        return slice
      }
      case 'sagittal': {
        if (sliceIdx < 0 || sliceIdx >= X) return null
        const slice: number[][] = []
        for (let y = 0; y < Y; y++) {
          slice[y] = []
          for (let z = 0; z < Z; z++) {
            slice[y][z] = volume[sliceIdx][Y - 1 - y][Z - 1 - z]
          }
        }
        return slice
      }
      case 'coronal': {
        if (sliceIdx < 0 || sliceIdx >= Y) return null
        const slice: number[][] = []
        for (let z = 0; z < Z; z++) {
          slice[z] = []
          for (let x = 0; x < X; x++) {
            slice[z][x] = volume[x][sliceIdx][Z - 1 - z]
          }
        }
        return slice
      }
    }
  }, [data.shape, viewMode])

  // 캔버스 렌더링
  const renderCanvas = useCallback(() => {
    const canvas = canvasRef.current
    if (!canvas) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const { width, height, rawWidth, rawHeight } = getCanvasSize()
    canvas.width = rawWidth
    canvas.height = rawHeight
    canvas.style.width = `${width}px`
    canvas.style.height = `${height}px`

    // MRI 채널 선택 (T1CE 우선)
    const mriVolume = data.mri_channels?.t1ce || data.mri_channels?.t1 || data.mri

    // MRI 슬라이스 가져오기
    const mriSlice = getSlice(mriVolume, currentSlice)
    if (!mriSlice) return

    // MRI 정규화 및 렌더링
    let minVal = Infinity, maxVal = -Infinity
    for (let y = 0; y < rawHeight; y++) {
      for (let x = 0; x < rawWidth; x++) {
        const val = mriSlice[y]?.[x] ?? 0
        if (val < minVal) minVal = val
        if (val > maxVal) maxVal = val
      }
    }
    const range = maxVal - minVal || 1

    const imageData = ctx.createImageData(rawWidth, rawHeight)

    for (let y = 0; y < rawHeight; y++) {
      for (let x = 0; x < rawWidth; x++) {
        const idx = (y * rawWidth + x) * 4
        const val = mriSlice[y]?.[x] ?? 0
        const normalized = Math.floor(((val - minVal) / range) * 255)

        imageData.data[idx] = normalized
        imageData.data[idx + 1] = normalized
        imageData.data[idx + 2] = normalized
        imageData.data[idx + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)

    // 세그멘테이션 오버레이 (편집 모드면 editedMask 사용)
    const maskVolume = isEditMode ? editor.editedMask : data.prediction
    const maskSlice = getSlice(maskVolume, currentSlice)
    if (!maskSlice) return

    ctx.globalAlpha = segOpacity

    for (let y = 0; y < rawHeight; y++) {
      for (let x = 0; x < rawWidth; x++) {
        const label = maskSlice[y]?.[x] ?? 0
        if (label > 0 && LABEL_COLORS[label]) {
          const color = LABEL_COLORS[label]
          ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
          ctx.fillRect(x, y, 1, 1)
        }
      }
    }

    ctx.globalAlpha = 1.0

    // 폴리곤 점들 표시 (편집 모드일 때)
    if (isEditMode && editor.polygon.points.length > 0) {
      ctx.strokeStyle = '#ffff00'
      ctx.lineWidth = 2
      ctx.setLineDash([5, 5])

      ctx.beginPath()
      const points = editor.polygon.points
      ctx.moveTo(points[0].x, points[0].y)
      for (let i = 1; i < points.length; i++) {
        ctx.lineTo(points[i].x, points[i].y)
      }
      ctx.stroke()

      // 점 표시
      ctx.fillStyle = '#ffff00'
      for (const point of points) {
        ctx.beginPath()
        ctx.arc(point.x, point.y, 3, 0, Math.PI * 2)
        ctx.fill()
      }

      ctx.setLineDash([])
    }
  }, [data, currentSlice, viewMode, segOpacity, isEditMode, editor.editedMask, editor.polygon.points, getSlice, getCanvasSize])

  // 렌더링 갱신
  useEffect(() => {
    renderCanvas()
  }, [renderCanvas])

  // 마우스 이벤트 핸들러
  const getCanvasCoords = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current
    if (!canvas) return null

    const rect = canvas.getBoundingClientRect()
    const { scaleX, scaleY } = getCanvasSize()

    const canvasX = Math.floor((e.clientX - rect.left) / scaleX * (canvas.width / rect.width * scaleX))
    const canvasY = Math.floor((e.clientY - rect.top) / scaleY * (canvas.height / rect.height * scaleY))

    return { canvasX, canvasY }
  }, [getCanvasSize])

  const handleCanvasMouseDown = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditMode) return

    const coords = getCanvasCoords(e)
    if (!coords) return

    const { tool } = editor.editorState

    if (tool === 'polygon') {
      editor.handlePolygonClick(coords.canvasX, coords.canvasY, currentSlice, viewMode)
    } else {
      editor.handleMouseDown(coords.canvasX, coords.canvasY, currentSlice, viewMode)
    }
  }, [isEditMode, getCanvasCoords, currentSlice, viewMode, editor])

  const handleCanvasMouseMove = useCallback((e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isEditMode) return

    const coords = getCanvasCoords(e)
    if (!coords) return

    editor.handleMouseMove(coords.canvasX, coords.canvasY, currentSlice, viewMode)
  }, [isEditMode, getCanvasCoords, currentSlice, viewMode, editor])

  const handleCanvasMouseUp = useCallback(() => {
    if (!isEditMode) return
    editor.handleMouseUp()
  }, [isEditMode, editor])

  // 저장
  const handleSave = useCallback(async () => {
    if (!onSave) return

    setIsSaving(true)
    try {
      const editedMask = editor.getEditedMask()
      const request: SaveSegmentationRequest = {
        edited_mask: encodeMaskToBase64(editedMask),
        shape: data.shape,
        comment: '세그멘테이션 수정',
      }

      await onSave(request)
      setIsEditMode(false)
    } catch (err) {
      console.error('저장 실패:', err)
      alert('저장에 실패했습니다.')
    } finally {
      setIsSaving(false)
    }
  }, [onSave, editor, data.shape])

  // 취소
  const handleCancel = useCallback(() => {
    if (editor.hasChanges) {
      if (!window.confirm('변경사항이 있습니다. 취소하시겠습니까?')) {
        return
      }
    }
    editor.resetToOriginal()
    setIsEditMode(false)
    onCancel?.()
  }, [editor, onCancel])

  // 도구 버튼 렌더링
  const renderToolButton = (tool: EditTool, icon: string, label: string) => (
    <button
      key={tool}
      className={`seg-editor__tool-btn ${editor.editorState.tool === tool ? 'active' : ''}`}
      onClick={() => editor.setTool(tool)}
      title={label}
    >
      {icon}
    </button>
  )

  return (
    <div className="seg-editor">
      {/* 헤더 */}
      <div className="seg-editor__header">
        <h3 className="seg-editor__title">{title}</h3>

        {/* 볼륨 정보 */}
        {data.volumes && (data.volumes.wt_volume !== undefined || data.volumes.tc_volume !== undefined || data.volumes.et_volume !== undefined) && (
          <div className="seg-editor__volumes">
            {data.volumes.wt_volume !== undefined && (
              <span className="seg-editor__volume-chip seg-editor__volume-chip--wt">
                WT: {data.volumes.wt_volume.toFixed(1)}ml
              </span>
            )}
            {data.volumes.tc_volume !== undefined && (
              <span className="seg-editor__volume-chip seg-editor__volume-chip--tc">
                TC: {data.volumes.tc_volume.toFixed(1)}ml
              </span>
            )}
            {data.volumes.et_volume !== undefined && (
              <span className="seg-editor__volume-chip seg-editor__volume-chip--et">
                ET: {data.volumes.et_volume.toFixed(1)}ml
              </span>
            )}
          </div>
        )}

        {canEdit && !isEditMode && (
          <button
            className="seg-editor__edit-btn"
            onClick={() => setIsEditMode(true)}
          >
            편집
          </button>
        )}
      </div>

      {/* 편집 툴바 */}
      {isEditMode && (
        <div className="seg-editor__toolbar">
          <div className="seg-editor__tools">
            {renderToolButton('brush', '🖌️', '브러시')}
            {renderToolButton('eraser', '🧹', '지우개')}
            {renderToolButton('polygon', '⬡', '다각형')}
            {renderToolButton('fill', '🪣', '채우기')}
          </div>

          <div className="seg-editor__brush-size">
            <span>크기:</span>
            <input
              type="range"
              min={1}
              max={20}
              value={editor.editorState.brushSize}
              onChange={(e) => editor.setBrushSize(Number(e.target.value))}
            />
            <span>{editor.editorState.brushSize}px</span>
          </div>

          <div className="seg-editor__labels">
            {([1, 2, 3] as const).map((label) => (
              <label key={label} className="seg-editor__label-option">
                <input
                  type="radio"
                  name="label"
                  checked={editor.editorState.selectedLabel === label}
                  onChange={() => editor.setSelectedLabel(label)}
                />
                <span
                  className="seg-editor__label-color"
                  style={{ backgroundColor: LABEL_INFO[label].color }}
                />
                {LABEL_INFO[label].name}
              </label>
            ))}
          </div>

          <div className="seg-editor__actions">
            <button
              className="seg-editor__action-btn"
              onClick={editor.undo}
              disabled={!editor.canUndo}
              title="실행 취소"
            >
              ↩
            </button>
            <button
              className="seg-editor__action-btn"
              onClick={editor.redo}
              disabled={!editor.canRedo}
              title="다시 실행"
            >
              ↪
            </button>
          </div>

          {editor.editorState.tool === 'polygon' && editor.polygon.points.length >= 3 && (
            <div className="seg-editor__polygon-actions">
              <button
                className="seg-editor__polygon-btn"
                onClick={() => editor.completePolygon(currentSlice, viewMode)}
              >
                완료
              </button>
              <button
                className="seg-editor__polygon-btn cancel"
                onClick={editor.cancelPolygon}
              >
                취소
              </button>
            </div>
          )}
        </div>
      )}

      {/* 뷰 컨트롤 */}
      <div className="seg-editor__controls">
        <div className="seg-editor__view-modes">
          {(['axial', 'sagittal', 'coronal'] as ViewMode[]).map((mode) => (
            <button
              key={mode}
              className={`seg-editor__view-btn ${viewMode === mode ? 'active' : ''}`}
              onClick={() => setViewMode(mode)}
            >
              {mode.charAt(0).toUpperCase() + mode.slice(1)}
            </button>
          ))}
        </div>

        <div className="seg-editor__opacity">
          <span>투명도:</span>
          <input
            type="range"
            min={0}
            max={100}
            value={segOpacity * 100}
            onChange={(e) => setSegOpacity(Number(e.target.value) / 100)}
          />
        </div>
      </div>

      {/* 캔버스 */}
      <div className="seg-editor__canvas-container">
        <canvas
          ref={canvasRef}
          className={`seg-editor__canvas ${isEditMode ? 'editing' : ''}`}
          onMouseDown={handleCanvasMouseDown}
          onMouseMove={handleCanvasMouseMove}
          onMouseUp={handleCanvasMouseUp}
          onMouseLeave={handleCanvasMouseUp}
        />
      </div>

      {/* 슬라이스 슬라이더 */}
      <div className="seg-editor__slider">
        <span>슬라이스: {currentSlice + 1} / {getMaxSlice() + 1}</span>
        <input
          type="range"
          min={0}
          max={getMaxSlice()}
          value={currentSlice}
          onChange={(e) => setCurrentSlice(Number(e.target.value))}
        />
      </div>

      {/* 저장/취소 버튼 */}
      {isEditMode && (
        <div className="seg-editor__footer">
          <button
            className="seg-editor__save-btn"
            onClick={handleSave}
            disabled={!editor.hasChanges || isSaving}
          >
            {isSaving ? '저장 중...' : '저장'}
          </button>
          <button
            className="seg-editor__cancel-btn"
            onClick={handleCancel}
            disabled={isSaving}
          >
            취소
          </button>
        </div>
      )}
    </div>
  )
}

export default SegmentationEditor
