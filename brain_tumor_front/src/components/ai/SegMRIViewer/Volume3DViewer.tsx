/**
 * Volume3DViewer - Three.js 기반 3D 볼륨 렌더링 컴포넌트
 * MRI 세그멘테이션 데이터를 3D로 시각화
 * - MRI 뇌 형태 배경 표시 (반투명)
 * - 종양 세그멘테이션 오버레이
 */

import React, { useRef, useEffect, useState, useCallback } from 'react'
import * as THREE from 'three'

// ============== Types ==============

export interface Volume3DViewerProps {
  /** 세그멘테이션 데이터 (prediction 볼륨) */
  segmentationVolume: number[][][]
  /** MRI 볼륨 (배경 표시용) */
  mriVolume?: number[][][]
  /** 볼륨 shape [X, Y, Z] */
  shape: [number, number, number]
  /** 컨테이너 너비 */
  width?: number
  /** 컨테이너 높이 */
  height?: number
  /** 레이블 표시 설정 */
  showLabels?: {
    ncr?: boolean  // Label 1: Necrotic Core
    ed?: boolean   // Label 2: Edema
    et?: boolean   // Label 3: Enhancing Tumor
  }
  /** 투명도 (0-1) */
  opacity?: number
}

// 레이블 색상 정의
const LABEL_COLORS = {
  1: new THREE.Color(1, 0, 0),      // Red - NCR/NET
  2: new THREE.Color(0, 1, 0),      // Green - ED
  3: new THREE.Color(0, 0, 1),      // Blue - ET
}

// ============== Component ==============

const Volume3DViewer: React.FC<Volume3DViewerProps> = ({
  segmentationVolume,
  mriVolume,
  shape,
  width = 400,
  height = 400,
  showLabels = { ncr: true, ed: true, et: true },
  opacity = 0.6,
}) => {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null)
  const sceneRef = useRef<THREE.Scene | null>(null)
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null)
  const meshesRef = useRef<THREE.Points[]>([])
  const brainMeshRef = useRef<THREE.Points | null>(null)
  const animationRef = useRef<number>(0)
  const groupRef = useRef<THREE.Group | null>(null)

  const [isRotating, setIsRotating] = useState(true)
  const [rotationSpeed] = useState(0.005)
  const [zoom, setZoom] = useState(1)
  const [showBrain, setShowBrain] = useState(true)
  const [brainOpacity, setBrainOpacity] = useState(0.15)
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 마우스 드래그 상태
  const isDraggingRef = useRef(false)
  const wasDraggingRef = useRef(false)
  const previousMouseRef = useRef({ x: 0, y: 0 })
  const rotationRef = useRef({ x: 0, y: 0 })

  /** MRI 볼륨에서 뇌 표면 추출 (threshold 기반) */
  const extractBrainSurface = useCallback((
    volume: number[][][],
    subsample: number = 3
  ): { positions: number[], intensities: number[] } => {
    const positions: number[] = []
    const intensities: number[] = []
    const [X, Y, Z] = shape

    // MRI 값 범위 계산
    let minVal = Infinity
    let maxVal = -Infinity
    for (let x = 0; x < X; x += subsample) {
      for (let y = 0; y < Y; y += subsample) {
        for (let z = 0; z < Z; z += subsample) {
          const val = volume[x]?.[y]?.[z] || 0
          if (val > 0) {
            if (val < minVal) minVal = val
            if (val > maxVal) maxVal = val
          }
        }
      }
    }

    const range = maxVal - minVal
    const threshold = minVal + range * 0.15 // 하위 15% 이상만 표시

    // 표면 복셀만 추출
    for (let x = 0; x < X; x += subsample) {
      for (let y = 0; y < Y; y += subsample) {
        for (let z = 0; z < Z; z += subsample) {
          const val = volume[x]?.[y]?.[z] || 0
          if (val < threshold) continue

          // 표면 체크: 6방향 이웃 중 하나라도 threshold 미만이면 표면
          const neighbors = [
            volume[x-subsample]?.[y]?.[z] || 0,
            volume[x+subsample]?.[y]?.[z] || 0,
            volume[x]?.[y-subsample]?.[z] || 0,
            volume[x]?.[y+subsample]?.[z] || 0,
            volume[x]?.[y]?.[z-subsample] || 0,
            volume[x]?.[y]?.[z+subsample] || 0,
          ]

          const isSurface = neighbors.some(n => n < threshold)

          if (isSurface) {
            positions.push(
              (x / X) - 0.5,
              (y / Y) - 0.5,
              (z / Z) - 0.5
            )
            // 정규화된 강도값 (0~1)
            const normalizedIntensity = range > 0 ? (val - minVal) / range : 0.5
            intensities.push(normalizedIntensity)
          }
        }
      }
    }

    return { positions, intensities }
  }, [shape])

  /** 볼륨에서 세그멘테이션 표면 포인트 추출 */
  const extractSurfacePoints = useCallback((
    volume: number[][][],
    targetLabel: number,
    subsample: number = 1
  ): { positions: number[], colors: number[] } => {
    const positions: number[] = []
    const colors: number[] = []
    const [X, Y, Z] = shape
    const color = LABEL_COLORS[targetLabel as keyof typeof LABEL_COLORS]

    for (let x = 0; x < X; x += subsample) {
      for (let y = 0; y < Y; y += subsample) {
        for (let z = 0; z < Z; z += subsample) {
          const label = volume[x]?.[y]?.[z] || 0
          if (label !== targetLabel) continue

          // 표면 체크
          const isSurface =
            (volume[x-1]?.[y]?.[z] || 0) !== targetLabel ||
            (volume[x+1]?.[y]?.[z] || 0) !== targetLabel ||
            (volume[x]?.[y-1]?.[z] || 0) !== targetLabel ||
            (volume[x]?.[y+1]?.[z] || 0) !== targetLabel ||
            (volume[x]?.[y]?.[z-1] || 0) !== targetLabel ||
            (volume[x]?.[y]?.[z+1] || 0) !== targetLabel

          if (isSurface) {
            positions.push(
              (x / X) - 0.5,
              (y / Y) - 0.5,
              (z / Z) - 0.5
            )
            colors.push(color.r, color.g, color.b)
          }
        }
      }
    }

    return { positions, colors }
  }, [shape])

  /** 3D 씬 초기화 */
  const initScene = useCallback(() => {
    if (!containerRef.current) return

    // Scene 생성
    const scene = new THREE.Scene()
    scene.background = new THREE.Color(0x1a1a2e)
    sceneRef.current = scene

    // 그룹 생성 (모든 메시를 담을 컨테이너)
    const group = new THREE.Group()
    scene.add(group)
    groupRef.current = group

    // Camera 생성
    const camera = new THREE.PerspectiveCamera(50, width / height, 0.1, 1000)
    camera.position.z = 2
    cameraRef.current = camera

    // Renderer 생성
    const renderer = new THREE.WebGLRenderer({ antialias: true })
    renderer.setSize(width, height)
    renderer.setPixelRatio(window.devicePixelRatio)
    containerRef.current.appendChild(renderer.domElement)
    rendererRef.current = renderer

    // 조명 추가
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.6)
    scene.add(ambientLight)

    const directionalLight = new THREE.DirectionalLight(0xffffff, 0.8)
    directionalLight.position.set(1, 1, 1)
    scene.add(directionalLight)

    const directionalLight2 = new THREE.DirectionalLight(0xffffff, 0.4)
    directionalLight2.position.set(-1, -1, -1)
    scene.add(directionalLight2)

    // 축 헬퍼 (작게)
    const axesHelper = new THREE.AxesHelper(0.3)
    axesHelper.position.set(-0.6, -0.6, -0.6)
    scene.add(axesHelper)

  }, [width, height])

  /** MRI 뇌 메시 생성 */
  const createBrainMesh = useCallback(() => {
    if (!groupRef.current || !mriVolume) return

    // 기존 뇌 메시 제거
    if (brainMeshRef.current) {
      groupRef.current.remove(brainMeshRef.current)
      brainMeshRef.current.geometry.dispose()
      if (brainMeshRef.current.material instanceof THREE.Material) {
        brainMeshRef.current.material.dispose()
      }
      brainMeshRef.current = null
    }

    if (!showBrain) return

    const { positions, intensities } = extractBrainSurface(mriVolume, 2)

    if (positions.length === 0) return

    // 색상 배열 생성 (회색 계열)
    const colors: number[] = []
    for (let i = 0; i < intensities.length; i++) {
      const intensity = intensities[i]
      // 회백색 계열로 표시
      const gray = 0.3 + intensity * 0.5
      colors.push(gray, gray * 0.95, gray)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

    const material = new THREE.PointsMaterial({
      size: 0.008,
      vertexColors: true,
      transparent: true,
      opacity: brainOpacity,
      sizeAttenuation: true,
      depthWrite: false, // 투명 오브젝트 렌더링 개선
    })

    const points = new THREE.Points(geometry, material)
    groupRef.current.add(points)
    brainMeshRef.current = points

  }, [mriVolume, showBrain, brainOpacity, extractBrainSurface])

  /** 세그멘테이션 메시 생성 */
  const createSegmentationMeshes = useCallback(() => {
    if (!groupRef.current) return

    // 기존 메시 제거
    meshesRef.current.forEach(mesh => {
      groupRef.current?.remove(mesh)
      mesh.geometry.dispose()
      if (mesh.material instanceof THREE.Material) {
        mesh.material.dispose()
      }
    })
    meshesRef.current = []

    // 각 레이블별 포인트 클라우드 생성
    const labelsToShow: number[] = []
    if (showLabels.ncr) labelsToShow.push(1)
    if (showLabels.ed) labelsToShow.push(2)
    if (showLabels.et) labelsToShow.push(3)

    labelsToShow.forEach(label => {
      const { positions, colors } = extractSurfacePoints(segmentationVolume, label, 1)

      if (positions.length === 0) return

      const geometry = new THREE.BufferGeometry()
      geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
      geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))

      const material = new THREE.PointsMaterial({
        size: 0.012,
        vertexColors: true,
        transparent: true,
        opacity: Math.min(1, opacity + 0.2), // 종양은 더 불투명하게
        sizeAttenuation: true,
      })

      const points = new THREE.Points(geometry, material)
      groupRef.current?.add(points)
      meshesRef.current.push(points)
    })

  }, [segmentationVolume, showLabels, opacity, extractSurfacePoints])

  /** 애니메이션 루프 */
  const animate = useCallback(() => {
    animationRef.current = requestAnimationFrame(animate)

    if (!rendererRef.current || !sceneRef.current || !cameraRef.current || !groupRef.current) return

    // 자동 회전
    if (isRotating) {
      rotationRef.current.y += rotationSpeed
    }

    // 그룹 전체에 회전 적용
    groupRef.current.rotation.x = rotationRef.current.x
    groupRef.current.rotation.y = rotationRef.current.y

    // 줌 적용
    cameraRef.current.position.z = 2 / zoom

    rendererRef.current.render(sceneRef.current, cameraRef.current)
  }, [isRotating, rotationSpeed, zoom])

  /** 마우스 이벤트 핸들러 */
  const handleMouseDown = (e: React.MouseEvent) => {
    if (!isFullscreen) return  // 일반 모드에서는 드래그 비활성화
    isDraggingRef.current = true
    wasDraggingRef.current = false
    previousMouseRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseMove = (e: React.MouseEvent) => {
    if (!isDraggingRef.current) return

    const deltaX = e.clientX - previousMouseRef.current.x
    const deltaY = e.clientY - previousMouseRef.current.y

    // 약간의 움직임이 있으면 드래그로 간주
    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
      wasDraggingRef.current = true
    }

    rotationRef.current.y += deltaX * 0.01
    rotationRef.current.x += deltaY * 0.01

    previousMouseRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = () => {
    isDraggingRef.current = false
  }

  const handleCanvasClick = () => {
    // 드래그 중이었으면 클릭으로 처리하지 않음
    if (wasDraggingRef.current) {
      wasDraggingRef.current = false
      return
    }

    if (!isFullscreen) {
      setIsFullscreen(true)
    } else {
      setIsRotating(prev => !prev)
    }
  }

  const handleWheel = useCallback((e: WheelEvent) => {
    e.preventDefault()
    const newZoom = zoom * (e.deltaY > 0 ? 0.9 : 1.1)
    setZoom(Math.max(0.5, Math.min(3, newZoom)))
  }, [zoom])

  /** 초기화 및 정리 */
  useEffect(() => {
    initScene()

    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
      meshesRef.current.forEach(mesh => {
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
      })
      if (brainMeshRef.current) {
        brainMeshRef.current.geometry.dispose()
        if (brainMeshRef.current.material instanceof THREE.Material) {
          brainMeshRef.current.material.dispose()
        }
      }
      if (rendererRef.current) {
        rendererRef.current.dispose()
        rendererRef.current.domElement.remove()
      }
    }
  }, [initScene])

  /** wheel 이벤트 리스너 (passive: false로 등록) */
  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    container.addEventListener('wheel', handleWheel, { passive: false })

    return () => {
      container.removeEventListener('wheel', handleWheel)
    }
  }, [handleWheel])

  /** 뇌 메시 생성 */
  useEffect(() => {
    if (groupRef.current) {
      createBrainMesh()
    }
  }, [createBrainMesh])

  /** 세그멘테이션 메시 생성 */
  useEffect(() => {
    if (groupRef.current) {
      createSegmentationMeshes()
    }
  }, [createSegmentationMeshes])

  /** 애니메이션 시작 */
  useEffect(() => {
    animate()
    return () => {
      if (animationRef.current) {
        cancelAnimationFrame(animationRef.current)
      }
    }
  }, [animate])

  /** ESC 키로 전체화면 닫기 */
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false)
      }
    }

    if (isFullscreen) {
      window.addEventListener('keydown', handleKeyDown)
      return () => window.removeEventListener('keydown', handleKeyDown)
    }
  }, [isFullscreen])

  /** 전체화면 모드 변경 시 캔버스 크기 조정 및 DOM 이동 */
  useEffect(() => {
    if (!rendererRef.current || !cameraRef.current) return

    const newWidth = isFullscreen ? Math.min(window.innerWidth * 0.85, 1200) : width
    const newHeight = isFullscreen ? Math.min(window.innerHeight * 0.75, 800) : height

    rendererRef.current.setSize(newWidth, newHeight)
    cameraRef.current.aspect = newWidth / newHeight
    cameraRef.current.updateProjectionMatrix()

    // 캔버스 DOM을 새 컨테이너로 이동
    if (containerRef.current && rendererRef.current.domElement.parentElement !== containerRef.current) {
      containerRef.current.appendChild(rendererRef.current.domElement)
    }
  }, [isFullscreen, width, height])

  // 컨트롤 패널 JSX (재사용)
  const controlsPanel = (
    <div className="volume-3d-viewer__controls">
      <label className="volume-3d-viewer__checkbox">
        <input
          type="checkbox"
          checked={showBrain}
          onChange={(e) => setShowBrain(e.target.checked)}
        />
        뇌 표시
      </label>

      {showBrain && (
        <div className="volume-3d-viewer__speed">
          <span>뇌 투명도:</span>
          <input
            type="range"
            min="0.05"
            max="0.4"
            step="0.05"
            value={brainOpacity}
            onChange={(e) => setBrainOpacity(Number(e.target.value))}
          />
        </div>
      )}

      <label className="volume-3d-viewer__checkbox">
        <input
          type="checkbox"
          checked={isRotating}
          onChange={(e) => setIsRotating(e.target.checked)}
        />
        자동 회전
      </label>

      <div className="volume-3d-viewer__zoom">
        <span>확대: {(zoom * 100).toFixed(0)}%</span>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={zoom}
          onChange={(e) => setZoom(Number(e.target.value))}
        />
      </div>

      <button
        className="volume-3d-viewer__reset-btn"
        onClick={() => {
          rotationRef.current = { x: 0, y: 0 }
          setZoom(1)
          setIsRotating(true)
          setShowBrain(true)
          setBrainOpacity(0.15)
        }}
      >
        초기화
      </button>
    </div>
  )

  // 범례 JSX (재사용)
  const legendPanel = (
    <div className="volume-3d-viewer__legend">
      <div className="volume-3d-viewer__legend-item">
        <span className="volume-3d-viewer__legend-color" style={{ background: 'rgba(180, 180, 180, 0.5)' }} />
        Brain
      </div>
      {showLabels.ncr && (
        <div className="volume-3d-viewer__legend-item">
          <span className="volume-3d-viewer__legend-color" style={{ background: '#ff0000' }} />
          NCR/NET
        </div>
      )}
      {showLabels.ed && (
        <div className="volume-3d-viewer__legend-item">
          <span className="volume-3d-viewer__legend-color" style={{ background: '#00ff00' }} />
          Edema
        </div>
      )}
      {showLabels.et && (
        <div className="volume-3d-viewer__legend-item">
          <span className="volume-3d-viewer__legend-color" style={{ background: '#0000ff' }} />
          Enhancing
        </div>
      )}
    </div>
  )

  return (
    <>
      {/* 일반 모드 */}
      {!isFullscreen && (
        <div className="volume-3d-viewer">
          <div
            ref={containerRef}
            className="volume-3d-viewer__canvas"
            style={{ width, height, cursor: 'pointer' }}
            onClick={handleCanvasClick}
          />
          {controlsPanel}
          {legendPanel}
          <div className="volume-3d-viewer__hint">
            클릭: 전체화면 | 스크롤: 확대/축소
          </div>
        </div>
      )}

      {/* 전체화면 모달 */}
      {isFullscreen && (
        <div className="volume-3d-viewer__fullscreen-overlay">
          {/* 배경 (클릭하면 닫힘) */}
          <div
            className="volume-3d-viewer__fullscreen-backdrop"
            onClick={() => setIsFullscreen(false)}
          />

          {/* 모달 컨텐츠 */}
          <div className="volume-3d-viewer__fullscreen-content">
            {/* 닫기 버튼 */}
            <button
              className="volume-3d-viewer__fullscreen-close"
              onClick={() => setIsFullscreen(false)}
              title="닫기 (ESC)"
            >
              ✕
            </button>

            {/* 3D 캔버스 - 전체화면 */}
            <div
              ref={containerRef}
              className="volume-3d-viewer__canvas volume-3d-viewer__canvas--fullscreen"
              style={{ cursor: isDraggingRef.current ? 'grabbing' : 'grab' }}
              onClick={handleCanvasClick}
              onMouseDown={handleMouseDown}
              onMouseMove={handleMouseMove}
              onMouseUp={handleMouseUp}
              onMouseLeave={handleMouseUp}
            />

            {/* 컨트롤 패널 */}
            {controlsPanel}

            {/* 범례 */}
            {legendPanel}

            {/* 조작 힌트 */}
            <div className="volume-3d-viewer__hint">
              클릭: 회전 {isRotating ? '정지' : '시작'} | 드래그: 회전 | 스크롤: 확대/축소
            </div>
          </div>
        </div>
      )}
    </>
  )
}

export default Volume3DViewer
