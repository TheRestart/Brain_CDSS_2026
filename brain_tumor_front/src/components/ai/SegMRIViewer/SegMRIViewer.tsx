/**
 * SegMRIViewer - Standalone Segmentation Comparison Component
 * MRI 세그멘테이션 GT vs Prediction 비교 뷰어
 *
 * 사용법:
 * 1. SegMRIViewer.tsx와 SegMRIViewer.css 두 파일을 프로젝트에 복사
 * 2. import SegMRIViewer from './SegMRIViewer'
 * 3. <SegMRIViewer data={segmentationData} diceScores={diceScores} />
 *
 * 의존성: React만 필요 (MUI, 기타 라이브러리 불필요)
 */

import React, { useState, useEffect, useRef, useCallback, lazy, Suspense } from 'react'
import './SegMRIViewer.css'

// 3D 뷰어 동적 로딩 (Three.js 번들 분리)
const Volume3DViewer = lazy(() => import('./Volume3DViewer'))

// ============== Types (Inline) ==============

/** 3D 볼륨 슬라이스 매핑 정보 */
export interface SliceMapping {
  axial_mapping?: { original_idx_nearest: number }[]
  sagittal_mapping?: { original_idx_nearest: number }[]
  coronal_mapping?: { original_idx_nearest: number }[]
}

/** MRI 채널 타입 */
export type MRIChannel = 't1' | 't1ce' | 't2' | 'flair'

/** 세그멘테이션 데이터 */
export interface SegmentationData {
  mri: number[][][]           // 3D MRI 볼륨 [X][Y][Z] (기본: T1CE)
  groundTruth: number[][][]   // 3D GT 레이블 볼륨
  prediction: number[][][]    // 3D 예측 레이블 볼륨
  shape: [number, number, number]  // [X, Y, Z] 크기
  sliceMapping?: SliceMapping      // 원본 슬라이스 매핑 (선택)
  mri_channels?: {            // 4채널 MRI 데이터 (선택)
    t1?: number[][][]
    t1ce?: number[][][]
    t2?: number[][][]
    flair?: number[][][]
  }
}

/** Dice Score */
export interface DiceScores {
  wt?: number  // Whole Tumor
  tc?: number  // Tumor Core
  et?: number  // Enhancing Tumor
}

/** 뷰 모드 */
export type ViewMode = 'axial' | 'sagittal' | 'coronal'

/** 뷰어 레이아웃 모드 */
export type ViewerLayout = 'single' | 'orthogonal' | '3d'

/** 디스플레이 모드 */
export type DisplayMode = 'difference' | 'gt_only' | 'pred_only' | 'overlay'

// ============== Component Props ==============

/** Compare 요청 결과 타입 */
export interface CompareResult {
  groundTruth: number[][][]
  diceScores?: DiceScores
}

export interface SegMRIViewerProps {
  /** 세그멘테이션 데이터 (MRI, GT, Prediction 볼륨) */
  data: SegmentationData
  /** 컴포넌트 제목 */
  title?: string
  /** Dice 점수 (WT, TC, ET) */
  diceScores?: DiceScores
  /** 초기 뷰 모드 */
  initialViewMode?: ViewMode
  /** 초기 디스플레이 모드 */
  initialDisplayMode?: DisplayMode
  /** 캔버스 최대 크기 (px) */
  maxCanvasSize?: number
  /** Compare 탭 활성화 여부 */
  enableCompareTab?: boolean
  /** Compare 탭 클릭 시 GT 데이터 로드 콜백 */
  onCompareRequest?: () => Promise<CompareResult | null>
}

// ============== Constants ==============

/** BraTS 레이블 컬러 */
const LABEL_COLORS = {
  1: { r: 255, g: 0, b: 0, name: 'NCR/NET' },   // Red - Necrotic Core
  2: { r: 0, g: 255, b: 0, name: 'ED' },        // Green - Edema
  3: { r: 0, g: 0, b: 255, name: 'ET' },        // Blue - Enhancing Tumor
}

/** Diff 모드 컬러 */
const DIFF_COLORS = {
  TP: { r: 0, g: 200, b: 0 },      // Green - True Positive
  FN: { r: 255, g: 100, b: 100 },  // Red - False Negative
  FP: { r: 100, g: 100, b: 255 },  // Blue - False Positive
}

// ============== Component ==============

const SegMRIViewer: React.FC<SegMRIViewerProps> = ({
  data,
  title = 'Segmentation Comparison',
  diceScores,
  initialViewMode = 'axial',
  initialDisplayMode = 'pred_only',
  maxCanvasSize = 450,
  enableCompareTab = false,
  onCompareRequest,
}) => {
  // Canvas refs (최대 4개 뷰어)
  const canvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null, null])
  // Orthogonal view용 캔버스 refs (Axial, Sagittal, Coronal)
  const orthoCanvasRefs = useRef<(HTMLCanvasElement | null)[]>([null, null, null])

  // 최대 뷰어 수
  const MAX_VIEWERS = 4

  // State
  const [currentSlice, setCurrentSlice] = useState(0)
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode)
  const [displayMode, _setDisplayMode] = useState<DisplayMode>(initialDisplayMode)
  // Note: setDisplayMode is available as _setDisplayMode for future UI controls
  const [initialized, setInitialized] = useState(false)
  const [sliceDims, setSliceDims] = useState({ width: 128, height: 128 })

  // Play 상태
  const [isPlaying, setIsPlaying] = useState(false)

  // 뷰어 레이아웃 모드
  const [viewerLayout, setViewerLayout] = useState<ViewerLayout>('single')

  // Orthogonal view용 각 축별 슬라이스 인덱스
  const [orthoSlices, setOrthoSlices] = useState({ axial: 0, sagittal: 0, coronal: 0 })

  // 멀티 뷰어 상태: 각 뷰어별 MRI 채널
  const [viewers, setViewers] = useState<MRIChannel[]>(['t1ce'])

  // Display options
  const [showMRI, setShowMRI] = useState(true)
  const [showGroundTruth, setShowGroundTruth] = useState(true)
  const [showPrediction, setShowPrediction] = useState(true)
  const [segOpacity, setSegOpacity] = useState(0.7)

  // Label visibility
  const [showNCR, setShowNCR] = useState(true)
  const [showED, setShowED] = useState(true)
  const [showET, setShowET] = useState(true)

  // Compare 모드 상태
  const [isCompareMode, setIsCompareMode] = useState(false)
  const [loadingCompare, setLoadingCompare] = useState(false)
  const [compareGT, setCompareGT] = useState<number[][][] | null>(null)
  const [compareDiceScores, setCompareDiceScores] = useState<DiceScores | undefined>()

  // ============== Helper Functions ==============

  const isLabelVisible = (label: number): boolean => {
    if (label === 1) return showNCR
    if (label === 2) return showED
    if (label === 3) return showET
    return false
  }

  /** 사용 가능한 MRI 채널 목록 */
  const getAvailableChannels = useCallback((): MRIChannel[] => {
    if (!data.mri_channels) return []
    const channels: MRIChannel[] = []
    if (data.mri_channels.t1) channels.push('t1')
    if (data.mri_channels.t1ce) channels.push('t1ce')
    if (data.mri_channels.t2) channels.push('t2')
    if (data.mri_channels.flair) channels.push('flair')
    return channels
  }, [data.mri_channels])

  /** 3D 볼륨에서 2D 슬라이스 추출 */
  const getSlice = useCallback((volume: number[][][], sliceIdx: number, mode: ViewMode): number[][] | null => {
    if (!volume || volume.length === 0) return null

    const [X, Y, Z] = [volume.length, volume[0]?.length || 0, volume[0]?.[0]?.length || 0]

    switch (mode) {
      case 'axial': {
        if (sliceIdx >= Z) return null
        const slice: number[][] = []
        for (let y = 0; y < Y; y++) {
          const row: number[] = []
          for (let x = 0; x < X; x++) {
            row.push(volume[x]?.[Y - 1 - y]?.[sliceIdx] || 0)
          }
          slice.push(row)
        }
        return slice
      }
      case 'sagittal': {
        if (sliceIdx >= X) return null
        const slice: number[][] = []
        for (let z = 0; z < Z; z++) {
          const row: number[] = []
          for (let y = 0; y < Y; y++) {
            row.push(volume[sliceIdx]?.[Y - 1 - y]?.[Z - 1 - z] || 0)
          }
          slice.push(row)
        }
        return slice
      }
      case 'coronal': {
        if (sliceIdx >= Y) return null
        const slice: number[][] = []
        for (let z = 0; z < Z; z++) {
          const row: number[] = []
          for (let x = 0; x < X; x++) {
            row.push(volume[x]?.[sliceIdx]?.[Z - 1 - z] || 0)
          }
          slice.push(row)
        }
        return slice
      }
      default:
        return null
    }
  }, [])

  /** 현재 뷰 모드의 최대 슬라이스 수 */
  const getMaxSlices = useCallback((): number => {
    if (!data.shape) return 128
    switch (viewMode) {
      case 'axial': return data.shape[2]
      case 'sagittal': return data.shape[0]
      case 'coronal': return data.shape[1]
      default: return data.shape[2]
    }
  }, [data.shape, viewMode])

  /** 디스플레이 크기 계산 */
  const getDisplaySize = useCallback((): { width: number; height: number } => {
    const { width: sliceW, height: sliceH } = sliceDims
    const aspectRatio = sliceW / sliceH

    if (aspectRatio >= 1) {
      return { width: maxCanvasSize, height: Math.round(maxCanvasSize / aspectRatio) }
    } else {
      return { width: Math.round(maxCanvasSize * aspectRatio), height: maxCanvasSize }
    }
  }, [sliceDims, maxCanvasSize])

  /** 원본 슬라이스 번호 가져오기 */
  const getOriginalSliceNum = useCallback((): number => {
    let originalSliceNum = currentSlice + 1
    if (data.sliceMapping) {
      const mappingKey = `${viewMode}_mapping` as keyof SliceMapping
      const mapping = data.sliceMapping[mappingKey]
      if (mapping && mapping[currentSlice]) {
        originalSliceNum = mapping[currentSlice].original_idx_nearest + 1
      }
    }
    return originalSliceNum
  }, [currentSlice, viewMode, data.sliceMapping])

  // ============== Effects ==============

  /** 초기화: 중간 슬라이스로 설정 */
  useEffect(() => {
    if (data.shape && !initialized) {
      const [X, Y, Z] = data.shape
      setCurrentSlice(Math.floor(Z / 2))
      // Orthogonal view용 초기화
      setOrthoSlices({
        axial: Math.floor(Z / 2),
        sagittal: Math.floor(X / 2),
        coronal: Math.floor(Y / 2),
      })
      setInitialized(true)
    }
  }, [data.shape, initialized])

  /** Play 기능: 200ms 간격으로 슬라이스 자동 이동 */
  useEffect(() => {
    if (!isPlaying) return

    const maxSlices = getMaxSlices()
    const intervalId = setInterval(() => {
      setCurrentSlice((prev) => {
        const next = prev + 1
        if (next >= maxSlices) {
          return 0 // 끝에 도달하면 처음으로 돌아감
        }
        return next
      })
    }, 200)

    return () => clearInterval(intervalId)
  }, [isPlaying, getMaxSlices])

  /** 특정 채널의 MRI 볼륨 가져오기 */
  const getMriVolumeByChannel = useCallback((channel: MRIChannel): number[][][] | null => {
    if (data.mri_channels) {
      const channelData = data.mri_channels[channel]
      if (channelData) return channelData
    }
    return data.mri
  }, [data.mri, data.mri_channels])

  /** 캔버스 렌더링 함수 (특정 캔버스, 특정 채널, 뷰 모드, 슬라이스 인덱스) */
  const renderCanvasWithParams = useCallback((
    canvas: HTMLCanvasElement | null,
    channel: MRIChannel,
    mode: ViewMode,
    sliceIdx: number
  ) => {
    if (!canvas) return

    const mriVolume = getMriVolumeByChannel(channel)
    if (!mriVolume) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const mriSlice = getSlice(mriVolume, sliceIdx, mode)
    if (!mriSlice) return

    const height = mriSlice.length
    const width = mriSlice[0]?.length || 0

    // 슬라이스 크기 업데이트 (첫 번째 뷰어 기준)
    if (canvas === canvasRefs.current[0]) {
      setSliceDims(prev =>
        prev.width !== width || prev.height !== height
          ? { width, height }
          : prev
      )
    }

    canvas.width = width
    canvas.height = height

    const imageData = ctx.createImageData(width, height)

    // MRI 배경 렌더링
    if (showMRI) {
      let minVal = Infinity
      let maxVal = -Infinity
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const val = mriSlice[y]?.[x] || 0
          if (val < minVal) minVal = val
          if (val > maxVal) maxVal = val
        }
      }

      const range = maxVal - minVal
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const idx = (y * width + x) * 4
          const val = mriSlice[y]?.[x] || 0
          const normalized = range > 0 ? Math.floor(((val - minVal) / range) * 255) : 0
          imageData.data[idx] = normalized
          imageData.data[idx + 1] = normalized
          imageData.data[idx + 2] = normalized
          imageData.data[idx + 3] = 255
        }
      }
    } else {
      for (let i = 0; i < imageData.data.length; i += 4) {
        imageData.data[i] = 0
        imageData.data[i + 1] = 0
        imageData.data[i + 2] = 0
        imageData.data[i + 3] = 255
      }
    }

    ctx.putImageData(imageData, 0, 0)

    // 세그멘테이션 오버레이
    // Compare 모드일 때는 compareGT 사용, 아니면 data.groundTruth 사용
    const gtVolume = isCompareMode && compareGT ? compareGT : data.groundTruth
    const gtSlice = gtVolume ? getSlice(gtVolume, sliceIdx, mode) : null
    const predSlice = data.prediction ? getSlice(data.prediction, sliceIdx, mode) : null

    ctx.globalAlpha = segOpacity

    if (displayMode === 'difference' && gtSlice && predSlice) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const gtLabel = gtSlice[y]?.[x] || 0
          const predLabel = predSlice[y]?.[x] || 0

          if (gtLabel === 0 && predLabel === 0) continue
          if (gtLabel > 0 && !isLabelVisible(gtLabel)) continue
          if (predLabel > 0 && !isLabelVisible(predLabel)) continue

          let color
          if (gtLabel > 0 && predLabel > 0 && gtLabel === predLabel) {
            color = DIFF_COLORS.TP
          } else if (gtLabel > 0 && (predLabel === 0 || gtLabel !== predLabel)) {
            color = DIFF_COLORS.FN
          } else if (predLabel > 0 && (gtLabel === 0 || gtLabel !== predLabel)) {
            color = DIFF_COLORS.FP
          }

          if (color) {
            ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
            ctx.fillRect(x, y, 1, 1)
          }
        }
      }
    } else if (displayMode === 'gt_only' && gtSlice) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const label = gtSlice[y]?.[x] || 0
          if (label > 0 && isLabelVisible(label)) {
            const color = LABEL_COLORS[label as keyof typeof LABEL_COLORS]
            if (color) {
              ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
              ctx.fillRect(x, y, 1, 1)
            }
          }
        }
      }
    } else if (displayMode === 'pred_only' && predSlice) {
      for (let y = 0; y < height; y++) {
        for (let x = 0; x < width; x++) {
          const label = predSlice[y]?.[x] || 0
          if (label > 0 && isLabelVisible(label)) {
            const color = LABEL_COLORS[label as keyof typeof LABEL_COLORS]
            if (color) {
              ctx.fillStyle = `rgb(${color.r}, ${color.g}, ${color.b})`
              ctx.fillRect(x, y, 1, 1)
            }
          }
        }
      }
    } else if (displayMode === 'overlay') {
      if (showGroundTruth && gtSlice) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const label = gtSlice[y]?.[x] || 0
            if (label > 0 && isLabelVisible(label)) {
              const color = LABEL_COLORS[label as keyof typeof LABEL_COLORS]
              if (color) {
                ctx.fillStyle = `rgba(${color.r}, ${color.g}, ${color.b}, 0.7)`
                ctx.fillRect(x, y, 1, 1)
              }
            }
          }
        }
      }
      if (showPrediction && predSlice) {
        for (let y = 0; y < height; y++) {
          for (let x = 0; x < width; x++) {
            const label = predSlice[y]?.[x] || 0
            if (label > 0 && isLabelVisible(label)) {
              const color = LABEL_COLORS[label as keyof typeof LABEL_COLORS]
              if (color) {
                ctx.fillStyle = `rgba(${Math.min(255, color.r + 80)}, ${Math.min(255, color.g + 80)}, ${Math.min(255, color.b + 80)}, 0.5)`
                ctx.fillRect(x, y, 1, 1)
              }
            }
          }
        }
      }
    }

    ctx.globalAlpha = 1
  }, [data, displayMode, showGroundTruth, showPrediction, showMRI, segOpacity, getSlice, showNCR, showED, showET, getMriVolumeByChannel, isCompareMode, compareGT])

  /** 싱글 뷰어용 래퍼 함수 */
  const renderCanvas = useCallback((canvas: HTMLCanvasElement | null, channel: MRIChannel) => {
    renderCanvasWithParams(canvas, channel, viewMode, currentSlice)
  }, [renderCanvasWithParams, viewMode, currentSlice])

  /** 모든 뷰어 캔버스 렌더링 (Single 모드) */
  useEffect(() => {
    if (viewerLayout !== 'single') return
    viewers.forEach((channel, index) => {
      renderCanvas(canvasRefs.current[index], channel)
    })
  }, [viewers, renderCanvas, viewerLayout])

  /** Orthogonal 뷰 렌더링 */
  useEffect(() => {
    if (viewerLayout !== 'orthogonal') return
    const channel = viewers[0] || 't1ce'
    // Axial
    renderCanvasWithParams(orthoCanvasRefs.current[0], channel, 'axial', orthoSlices.axial)
    // Sagittal
    renderCanvasWithParams(orthoCanvasRefs.current[1], channel, 'sagittal', orthoSlices.sagittal)
    // Coronal
    renderCanvasWithParams(orthoCanvasRefs.current[2], channel, 'coronal', orthoSlices.coronal)
  }, [viewerLayout, viewers, orthoSlices, renderCanvasWithParams])

  // ============== Handlers ==============

  const handleViewModeChange = (mode: ViewMode) => {
    setViewMode(mode)
    let maxSlices = 128
    if (data.shape) {
      switch (mode) {
        case 'axial': maxSlices = data.shape[2]; break
        case 'sagittal': maxSlices = data.shape[0]; break
        case 'coronal': maxSlices = data.shape[1]; break
      }
    }
    setCurrentSlice(Math.floor(maxSlices / 2))
  }

  // 뷰어 추가
  const handleAddViewer = () => {
    if (viewers.length >= MAX_VIEWERS) return
    const availableChannels = getAvailableChannels()
    // 아직 사용하지 않는 채널 찾기
    const unusedChannel = availableChannels.find(ch => !viewers.includes(ch))
    const newChannel = unusedChannel || availableChannels[0] || 't1ce'
    setViewers([...viewers, newChannel])
  }

  // 뷰어 제거
  const handleRemoveViewer = (index: number) => {
    if (viewers.length <= 1) return
    setViewers(viewers.filter((_, i) => i !== index))
  }

  // 특정 뷰어의 채널 변경
  const handleViewerChannelChange = (index: number, channel: MRIChannel) => {
    const newViewers = [...viewers]
    newViewers[index] = channel
    setViewers(newViewers)
  }

  // Compare 탭 클릭 핸들러
  const handleCompareClick = async () => {
    if (isCompareMode) {
      // 이미 Compare 모드면 원래 모드로 복귀
      setIsCompareMode(false)
      _setDisplayMode(initialDisplayMode)
      return
    }

    if (!onCompareRequest) return

    setLoadingCompare(true)
    try {
      const result = await onCompareRequest()
      if (result) {
        setCompareGT(result.groundTruth)
        setCompareDiceScores(result.diceScores)
        setIsCompareMode(true)
        _setDisplayMode('difference')
      }
    } catch (err) {
      console.error('Compare data load failed:', err)
    } finally {
      setLoadingCompare(false)
    }
  }

  const displaySize = getDisplaySize()

  // ============== Render ==============

  return (
    <div className="seg-mri-viewer">
      {/* Header */}
      <div className="seg-mri-viewer__header">
        <h3 className="seg-mri-viewer__title">
          <span className="seg-mri-viewer__title-icon">MRI</span>
          {title}
        </h3>
        <div className="seg-mri-viewer__header-right">
          {/* 뷰어 레이아웃 탭 */}
          <div className="seg-mri-viewer__layout-tabs">
            <button
              className={`seg-mri-viewer__layout-tab ${viewerLayout === 'single' ? 'seg-mri-viewer__layout-tab--active' : ''}`}
              onClick={() => setViewerLayout('single')}
              title="2D 슬라이스 뷰"
            >
              2D
            </button>
            <button
              className={`seg-mri-viewer__layout-tab ${viewerLayout === 'orthogonal' ? 'seg-mri-viewer__layout-tab--active' : ''}`}
              onClick={() => setViewerLayout('orthogonal')}
              title="3축 동시 보기"
            >
              3-Axis
            </button>
            <button
              className={`seg-mri-viewer__layout-tab ${viewerLayout === '3d' ? 'seg-mri-viewer__layout-tab--active' : ''}`}
              onClick={() => setViewerLayout('3d')}
              title="3D 볼륨 렌더링"
            >
              3D
            </button>
            {/* Compare 탭 */}
            {enableCompareTab && (
              <button
                className={`seg-mri-viewer__layout-tab ${isCompareMode ? 'seg-mri-viewer__layout-tab--active seg-mri-viewer__layout-tab--compare' : ''}`}
                onClick={handleCompareClick}
                title="GT vs Prediction 비교"
                disabled={loadingCompare}
              >
                {loadingCompare ? '...' : 'Compare'}
              </button>
            )}
          </div>
          {/* Dice Scores - Compare 모드일 때는 compareDiceScores 표시 */}
          {(() => {
            const displayDiceScores = isCompareMode ? compareDiceScores : diceScores
            return displayDiceScores && (
              <div className="seg-mri-viewer__dice-scores">
                {displayDiceScores.wt !== undefined && (
                  <span className="seg-mri-viewer__dice-chip seg-mri-viewer__dice-chip--wt">
                    WT: {(displayDiceScores.wt * 100).toFixed(1)}%
                  </span>
                )}
                {displayDiceScores.tc !== undefined && (
                  <span className="seg-mri-viewer__dice-chip seg-mri-viewer__dice-chip--tc">
                    TC: {(displayDiceScores.tc * 100).toFixed(1)}%
                  </span>
                )}
                {displayDiceScores.et !== undefined && (
                  <span className="seg-mri-viewer__dice-chip seg-mri-viewer__dice-chip--et">
                    ET: {(displayDiceScores.et * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            )
          })()}
        </div>
      </div>

      {/* Body */}
      <div className="seg-mri-viewer__body">
        {/* Canvas Section */}
        <div className="seg-mri-viewer__canvas-section">
          {/* ===== Single (2D) 모드 ===== */}
          {viewerLayout === 'single' && (
            <>
              {/* Multi Viewer Grid */}
              <div className={`seg-mri-viewer__multi-grid seg-mri-viewer__multi-grid--${viewers.length}`}>
                {viewers.map((channel, index) => (
                  <div key={index} className="seg-mri-viewer__viewer-item">
                    <div className="seg-mri-viewer__viewer-header">
                      <select
                        className="seg-mri-viewer__channel-select"
                        value={channel}
                        onChange={(e) => handleViewerChannelChange(index, e.target.value as MRIChannel)}
                      >
                        {(['t1', 't1ce', 't2', 'flair'] as MRIChannel[]).map((ch) => {
                          const isAvailable = getAvailableChannels().includes(ch) || !data.mri_channels
                          return (
                            <option key={ch} value={ch} disabled={!isAvailable}>
                              {ch.toUpperCase()}
                            </option>
                          )
                        })}
                      </select>
                      {viewers.length > 1 && (
                        <button
                          className="seg-mri-viewer__remove-btn"
                          onClick={() => handleRemoveViewer(index)}
                          title="뷰어 제거"
                        >
                          −
                        </button>
                      )}
                    </div>
                    <div className="seg-mri-viewer__canvas-container">
                      <canvas
                        ref={(el) => { canvasRefs.current[index] = el }}
                        className="seg-mri-viewer__canvas"
                        style={{
                          width: `${viewers.length > 2 ? displaySize.width * 0.7 : displaySize.width}px`,
                          height: `${viewers.length > 2 ? displaySize.height * 0.7 : displaySize.height}px`,
                        }}
                      />
                    </div>
                  </div>
                ))}
              </div>

              {/* 뷰어 추가 버튼 */}
              {getAvailableChannels().length > 0 && viewers.length < MAX_VIEWERS && (
                <button
                  className="seg-mri-viewer__add-viewer-btn"
                  onClick={handleAddViewer}
                  title="뷰어 추가 (최대 4개)"
                >
                  + 채널 뷰어 추가
                </button>
              )}

              {/* Slice Control */}
              <div className="seg-mri-viewer__slice-control">
                <div className="seg-mri-viewer__slice-header">
                  <div className="seg-mri-viewer__slice-label">
                    Slice: {currentSlice + 1} / {getMaxSlices()}
                    {data.sliceMapping && (
                      <span>(Original: {getOriginalSliceNum()})</span>
                    )}
                  </div>
                  <button
                    className={`seg-mri-viewer__play-btn ${isPlaying ? 'seg-mri-viewer__play-btn--playing' : ''}`}
                    onClick={() => setIsPlaying(!isPlaying)}
                    title={isPlaying ? '정지' : '자동 재생 (200ms)'}
                  >
                    {isPlaying ? '⏸' : '▶'}
                  </button>
                </div>
                <input
                  type="range"
                  className="seg-mri-viewer__slider"
                  value={currentSlice}
                  onChange={(e) => {
                    setIsPlaying(false)
                    setCurrentSlice(Number(e.target.value))
                  }}
                  min={0}
                  max={getMaxSlices() - 1}
                />
              </div>

              {/* View Mode Buttons */}
              <div className="seg-mri-viewer__view-buttons">
                {(['axial', 'sagittal', 'coronal'] as ViewMode[]).map((mode) => (
                  <button
                    key={mode}
                    className={`seg-mri-viewer__view-btn ${viewMode === mode ? 'seg-mri-viewer__view-btn--active' : ''}`}
                    onClick={() => handleViewModeChange(mode)}
                  >
                    {mode.charAt(0).toUpperCase() + mode.slice(1)}
                  </button>
                ))}
              </div>
            </>
          )}

          {/* ===== Orthogonal (3축 동시) 모드 ===== */}
          {viewerLayout === 'orthogonal' && (
            <>
              {/* 채널 선택 */}
              <div className="seg-mri-viewer__ortho-channel">
                <label>MRI Channel:</label>
                <select
                  className="seg-mri-viewer__channel-select"
                  value={viewers[0] || 't1ce'}
                  onChange={(e) => handleViewerChannelChange(0, e.target.value as MRIChannel)}
                >
                  {(['t1', 't1ce', 't2', 'flair'] as MRIChannel[]).map((ch) => {
                    const isAvailable = getAvailableChannels().includes(ch) || !data.mri_channels
                    return (
                      <option key={ch} value={ch} disabled={!isAvailable}>
                        {ch.toUpperCase()}
                      </option>
                    )
                  })}
                </select>
              </div>

              {/* 3축 뷰어 그리드 */}
              <div className="seg-mri-viewer__ortho-grid">
                {/* Axial */}
                <div className="seg-mri-viewer__ortho-item">
                  <div className="seg-mri-viewer__ortho-label">Axial (Z)</div>
                  <div className="seg-mri-viewer__canvas-container seg-mri-viewer__canvas-container--ortho">
                    <canvas
                      ref={(el) => { orthoCanvasRefs.current[0] = el }}
                      className="seg-mri-viewer__canvas"
                      style={{ width: '200px', height: '200px' }}
                    />
                  </div>
                  <input
                    type="range"
                    className="seg-mri-viewer__slider seg-mri-viewer__slider--ortho"
                    value={orthoSlices.axial}
                    onChange={(e) => setOrthoSlices(prev => ({ ...prev, axial: Number(e.target.value) }))}
                    min={0}
                    max={data.shape ? data.shape[2] - 1 : 127}
                  />
                  <span className="seg-mri-viewer__ortho-slice-num">{orthoSlices.axial + 1}/{data.shape?.[2] || 128}</span>
                </div>

                {/* Sagittal */}
                <div className="seg-mri-viewer__ortho-item">
                  <div className="seg-mri-viewer__ortho-label">Sagittal (X)</div>
                  <div className="seg-mri-viewer__canvas-container seg-mri-viewer__canvas-container--ortho">
                    <canvas
                      ref={(el) => { orthoCanvasRefs.current[1] = el }}
                      className="seg-mri-viewer__canvas"
                      style={{ width: '200px', height: '200px' }}
                    />
                  </div>
                  <input
                    type="range"
                    className="seg-mri-viewer__slider seg-mri-viewer__slider--ortho"
                    value={orthoSlices.sagittal}
                    onChange={(e) => setOrthoSlices(prev => ({ ...prev, sagittal: Number(e.target.value) }))}
                    min={0}
                    max={data.shape ? data.shape[0] - 1 : 127}
                  />
                  <span className="seg-mri-viewer__ortho-slice-num">{orthoSlices.sagittal + 1}/{data.shape?.[0] || 128}</span>
                </div>

                {/* Coronal */}
                <div className="seg-mri-viewer__ortho-item">
                  <div className="seg-mri-viewer__ortho-label">Coronal (Y)</div>
                  <div className="seg-mri-viewer__canvas-container seg-mri-viewer__canvas-container--ortho">
                    <canvas
                      ref={(el) => { orthoCanvasRefs.current[2] = el }}
                      className="seg-mri-viewer__canvas"
                      style={{ width: '200px', height: '200px' }}
                    />
                  </div>
                  <input
                    type="range"
                    className="seg-mri-viewer__slider seg-mri-viewer__slider--ortho"
                    value={orthoSlices.coronal}
                    onChange={(e) => setOrthoSlices(prev => ({ ...prev, coronal: Number(e.target.value) }))}
                    min={0}
                    max={data.shape ? data.shape[1] - 1 : 127}
                  />
                  <span className="seg-mri-viewer__ortho-slice-num">{orthoSlices.coronal + 1}/{data.shape?.[1] || 128}</span>
                </div>
              </div>
            </>
          )}

          {/* ===== 3D 볼륨 렌더링 모드 ===== */}
          {viewerLayout === '3d' && (
            <div className="seg-mri-viewer__3d-wrapper">
              {/* 레이블 토글 */}
              <div className="seg-mri-viewer__3d-labels">
                <label className="seg-mri-viewer__3d-label-toggle">
                  <input
                    type="checkbox"
                    checked={showNCR}
                    onChange={(e) => setShowNCR(e.target.checked)}
                  />
                  <span className="seg-mri-viewer__3d-label-color" style={{ background: '#ff0000' }} />
                  NCR/NET
                </label>
                <label className="seg-mri-viewer__3d-label-toggle">
                  <input
                    type="checkbox"
                    checked={showED}
                    onChange={(e) => setShowED(e.target.checked)}
                  />
                  <span className="seg-mri-viewer__3d-label-color" style={{ background: '#00ff00' }} />
                  Edema
                </label>
                <label className="seg-mri-viewer__3d-label-toggle">
                  <input
                    type="checkbox"
                    checked={showET}
                    onChange={(e) => setShowET(e.target.checked)}
                  />
                  <span className="seg-mri-viewer__3d-label-color" style={{ background: '#0000ff' }} />
                  Enhancing
                </label>
              </div>

              {/* 3D 뷰어 */}
              <Suspense fallback={
                <div className="volume-3d-viewer__loading">
                  <div className="spinner"></div>
                  <span>3D 뷰어 로딩 중...</span>
                </div>
              }>
                <Volume3DViewer
                  segmentationVolume={data.prediction}
                  mriVolume={getMriVolumeByChannel(viewers[0] || 't1ce') || undefined}
                  shape={data.shape}
                  width={Math.min(500, maxCanvasSize + 50)}
                  height={Math.min(450, maxCanvasSize)}
                  showLabels={{
                    ncr: showNCR,
                    ed: showED,
                    et: showET,
                  }}
                  opacity={segOpacity}
                />
              </Suspense>
            </div>
          )}

          <div className="seg-mri-viewer__canvas-info">
            * Preprocessed model input region (Foreground Crop applied)
          </div>
        </div>

        {/* Controls Panel */}
        <div className="seg-mri-viewer__controls">
          {/* Diff Legend */}
          {displayMode === 'difference' && (
            <div className="seg-mri-viewer__legend">
              <div className="seg-mri-viewer__legend-title">Difference Legend</div>
              <div className="seg-mri-viewer__legend-item">
                <div className="seg-mri-viewer__legend-color seg-mri-viewer__legend-color--tp" />
                <span>Match (TP)</span>
              </div>
              <div className="seg-mri-viewer__legend-item">
                <div className="seg-mri-viewer__legend-color seg-mri-viewer__legend-color--fn" />
                <span>Missed (FN)</span>
              </div>
              <div className="seg-mri-viewer__legend-item">
                <div className="seg-mri-viewer__legend-color seg-mri-viewer__legend-color--fp" />
                <span>Wrong (FP)</span>
              </div>
            </div>
          )}

          <div className="seg-mri-viewer__divider" />

          {/* MRI Background */}
          <label className="seg-mri-viewer__checkbox">
            <input
              type="checkbox"
              checked={showMRI}
              onChange={(e) => setShowMRI(e.target.checked)}
            />
            MRI Background
          </label>

          {/* Opacity */}
          <div className="seg-mri-viewer__opacity-control">
            <span className="seg-mri-viewer__opacity-label">
              Segmentation Opacity: {Math.round(segOpacity * 100)}%
            </span>
            <input
              type="range"
              className="seg-mri-viewer__slider"
              value={segOpacity}
              onChange={(e) => setSegOpacity(Number(e.target.value))}
              min={0.1}
              max={1}
              step={0.1}
            />
          </div>

          {/* Overlay Options */}
          {displayMode === 'overlay' && (
            <div className="seg-mri-viewer__overlay-options">
              <label className="seg-mri-viewer__checkbox">
                <input
                  type="checkbox"
                  checked={showGroundTruth}
                  onChange={(e) => setShowGroundTruth(e.target.checked)}
                />
                Ground Truth
              </label>
              <label className="seg-mri-viewer__checkbox">
                <input
                  type="checkbox"
                  checked={showPrediction}
                  onChange={(e) => setShowPrediction(e.target.checked)}
                />
                Prediction
              </label>
            </div>
          )}

          <div className="seg-mri-viewer__divider" />

          {/* Labels */}
          <div>
            <h4 className="seg-mri-viewer__section-title">Show Labels</h4>
            <div className="seg-mri-viewer__labels">
              <label className="seg-mri-viewer__checkbox">
                <input
                  type="checkbox"
                  checked={showNCR}
                  onChange={(e) => setShowNCR(e.target.checked)}
                />
                <div className="seg-mri-viewer__label-item">
                  <div className="seg-mri-viewer__label-color seg-mri-viewer__label-color--ncr" />
                  <span className="seg-mri-viewer__label-text">NCR/NET - Necrotic Core</span>
                </div>
              </label>
              <label className="seg-mri-viewer__checkbox">
                <input
                  type="checkbox"
                  checked={showED}
                  onChange={(e) => setShowED(e.target.checked)}
                />
                <div className="seg-mri-viewer__label-item">
                  <div className="seg-mri-viewer__label-color seg-mri-viewer__label-color--ed" />
                  <span className="seg-mri-viewer__label-text">ED - Peritumoral Edema</span>
                </div>
              </label>
              <label className="seg-mri-viewer__checkbox">
                <input
                  type="checkbox"
                  checked={showET}
                  onChange={(e) => setShowET(e.target.checked)}
                />
                <div className="seg-mri-viewer__label-item">
                  <div className="seg-mri-viewer__label-color seg-mri-viewer__label-color--et" />
                  <span className="seg-mri-viewer__label-text">ET - Enhancing Tumor</span>
                </div>
              </label>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

export default SegMRIViewer
