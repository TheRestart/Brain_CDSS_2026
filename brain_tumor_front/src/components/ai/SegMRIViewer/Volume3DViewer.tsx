/**
 * Volume3DViewer - Three.js 기반 3D 볼륨 렌더링 컴포넌트
 * MRI 세그멘테이션 데이터를 3D로 시각화
 * - MRI 뇌 형태 배경 표시 (반투명)
 * - 종양 세그멘테이션 오버레이
 * - 레이저 치료 시뮬레이션 (다중 레이저 조사 애니메이션)
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

/** 레이저 위치 정보 */
interface LaserPosition {
  id: number
  origin: THREE.Vector3      // 레이저 발사 위치
  target: THREE.Vector3      // 종양 타겟 위치
  color: THREE.Color         // 레이저 색상
  coordinates: string        // 좌표 문자열
}

// 레이블 색상 정의
const LABEL_COLORS = {
  1: new THREE.Color(1, 0, 0),      // Red - NCR/NET
  2: new THREE.Color(0, 1, 0),      // Green - ED
  3: new THREE.Color(0, 0, 1),      // Blue - ET
}

// 레이저 색상 팔레트 (6~8개 레이저용)
const LASER_COLORS = [
  new THREE.Color(1, 0.1, 0.1),     // 빨강
  new THREE.Color(0.1, 1, 0.1),     // 초록
  new THREE.Color(0.3, 0.3, 1),     // 파랑
  new THREE.Color(1, 1, 0.1),       // 노랑
  new THREE.Color(1, 0.1, 1),       // 마젠타
  new THREE.Color(0.1, 1, 1),       // 시안
  new THREE.Color(1, 0.5, 0.1),     // 주황
  new THREE.Color(0.7, 0.1, 1),     // 보라
]

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
  const [lesionOpacity, setLesionOpacity] = useState(0.8)  // 병변 투명도
  const [isFullscreen, setIsFullscreen] = useState(false)

  // 레이저 치료 관련 상태
  const [laserCount, setLaserCount] = useState(6)           // 레이저 개수 (6~8)
  const [showLaserPanel, setShowLaserPanel] = useState(false) // 레이저 패널 표시
  const [laserActive, setLaserActive] = useState(false)     // 레이저 활성화 상태 (토글)
  const [laserPositions, setLaserPositions] = useState<LaserPosition[]>([]) // 레이저 위치들
  const [laserAnimationProgress, setLaserAnimationProgress] = useState(0) // 애니메이션 진행률
  const [, setLaserHoldTime] = useState(0)     // 완료 후 대기 시간
  const laserMeshesRef = useRef<THREE.Object3D[]>([])       // 레이저 메시들
  const laserLabelsRef = useRef<THREE.Sprite[]>([])         // 좌표 라벨 스프라이트
  const laserGlowRef = useRef<THREE.Points | null>(null)    // 조사점 글로우 효과
  const tumorCenterRef = useRef<THREE.Vector3>(new THREE.Vector3(0, 0, 0)) // 종양 중심

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

  /** 종양 중심점 계산 */
  const calculateTumorCenter = useCallback((): THREE.Vector3 => {
    const [X, Y, Z] = shape
    let sumX = 0, sumY = 0, sumZ = 0, count = 0

    // 모든 종양 레이블(1, 2, 3)에서 중심 계산
    for (let x = 0; x < X; x++) {
      for (let y = 0; y < Y; y++) {
        for (let z = 0; z < Z; z++) {
          const label = segmentationVolume[x]?.[y]?.[z] || 0
          if (label > 0) {
            sumX += x
            sumY += y
            sumZ += z
            count++
          }
        }
      }
    }

    if (count === 0) return new THREE.Vector3(0, 0, 0)

    // 정규화된 좌표 (-0.5 ~ 0.5)
    return new THREE.Vector3(
      (sumX / count / X) - 0.5,
      (sumY / count / Y) - 0.5,
      (sumZ / count / Z) - 0.5
    )
  }, [segmentationVolume, shape])

  /** 레이저 위치 계산 (구형 분포로 종양 주변 배치) */
  const calculateLaserPositions = useCallback((count: number, tumorCenter: THREE.Vector3): LaserPosition[] => {
    const positions: LaserPosition[] = []
    const radius = 0.8 // 뇌 외부에서 발사

    // 황금 나선으로 균등 분포
    const goldenRatio = (1 + Math.sqrt(5)) / 2
    const angleIncrement = Math.PI * 2 * goldenRatio

    for (let i = 0; i < count; i++) {
      // 피보나치 격자로 균등 분포
      const t = i / count
      const inclination = Math.acos(1 - 2 * t)
      const azimuth = angleIncrement * i

      // 구면 좌표 -> 직교 좌표
      const x = radius * Math.sin(inclination) * Math.cos(azimuth)
      const y = radius * Math.sin(inclination) * Math.sin(azimuth)
      const z = radius * Math.cos(inclination)

      const origin = new THREE.Vector3(x, y, z)

      // 실제 MRI 좌표계 변환 (mm 단위 가정, 복셀 크기 1mm)
      const [X, Y, Z] = shape
      const realX = ((origin.x + 0.5) * X).toFixed(1)
      const realY = ((origin.y + 0.5) * Y).toFixed(1)
      const realZ = ((origin.z + 0.5) * Z).toFixed(1)

      positions.push({
        id: i + 1,
        origin,
        target: tumorCenter.clone(),
        color: LASER_COLORS[i % LASER_COLORS.length].clone(),
        coordinates: `L${i + 1}: (${realX}, ${realY}, ${realZ})mm`
      })
    }

    return positions
  }, [shape])

  /** 레이저 관련 모든 메시 정리 */
  const clearLaserMeshes = useCallback(() => {
    if (!groupRef.current) return

    // 기존 레이저 메시 제거
    laserMeshesRef.current.forEach(mesh => {
      groupRef.current?.remove(mesh)
      if (mesh instanceof THREE.Mesh || mesh instanceof THREE.Line) {
        mesh.geometry.dispose()
        if (mesh.material instanceof THREE.Material) {
          mesh.material.dispose()
        }
      }
    })
    laserMeshesRef.current = []

    // 기존 라벨 스프라이트 제거
    laserLabelsRef.current.forEach(sprite => {
      groupRef.current?.remove(sprite)
      if (sprite.material instanceof THREE.Material) {
        sprite.material.dispose()
      }
    })
    laserLabelsRef.current = []

    // 글로우 효과 제거
    if (laserGlowRef.current) {
      groupRef.current.remove(laserGlowRef.current)
      laserGlowRef.current.geometry.dispose()
      if (laserGlowRef.current.material instanceof THREE.Material) {
        laserGlowRef.current.material.dispose()
      }
      laserGlowRef.current = null
    }
  }, [])

  /** 레이저 빔 메시 생성 */
  const createLaserBeams = useCallback(() => {
    // 먼저 기존 메시들 모두 정리
    clearLaserMeshes()

    // 레이저가 비활성화되었거나 위치가 없으면 여기서 종료
    if (!groupRef.current || !laserActive || laserPositions.length === 0) return

    const glowPositions: number[] = []
    const glowColors: number[] = []

    laserPositions.forEach((laser) => {
      // 레이저 빔 방향 계산
      const direction = new THREE.Vector3()
        .subVectors(laser.target, laser.origin)
        .normalize()

      // 애니메이션 진행에 따른 빔 길이
      const fullLength = laser.origin.distanceTo(laser.target)
      const currentLength = fullLength * laserAnimationProgress

      // 레이저 빔 시작점과 끝점
      const endPoint = new THREE.Vector3()
        .copy(laser.origin)
        .addScaledVector(direction, currentLength)

      // 메인 레이저 빔 (실린더) - 더 가늘게
      const beamGeometry = new THREE.CylinderGeometry(0.002, 0.003, currentLength, 6)
      const beamMaterial = new THREE.MeshBasicMaterial({
        color: laser.color,
        transparent: true,
        opacity: 0.95,
      })
      const beam = new THREE.Mesh(beamGeometry, beamMaterial)

      // 빔 위치 및 방향 설정
      const midPoint = new THREE.Vector3()
        .addVectors(laser.origin, endPoint)
        .multiplyScalar(0.5)
      beam.position.copy(midPoint)
      beam.lookAt(laser.target)
      beam.rotateX(Math.PI / 2)

      groupRef.current?.add(beam)
      laserMeshesRef.current.push(beam)

      // 외부 글로우 빔 - 더 가늘게
      const glowGeometry = new THREE.CylinderGeometry(0.006, 0.008, currentLength, 6)
      const glowMaterial = new THREE.MeshBasicMaterial({
        color: laser.color,
        transparent: true,
        opacity: 0.25,
      })
      const glow = new THREE.Mesh(glowGeometry, glowMaterial)
      glow.position.copy(midPoint)
      glow.lookAt(laser.target)
      glow.rotateX(Math.PI / 2)

      groupRef.current?.add(glow)
      laserMeshesRef.current.push(glow)

      // 발사점 표시 (구체) - 더 작게
      const originSphereGeometry = new THREE.SphereGeometry(0.012, 12, 12)
      const originSphereMaterial = new THREE.MeshBasicMaterial({
        color: laser.color,
        transparent: true,
        opacity: 0.8,
      })
      const originSphere = new THREE.Mesh(originSphereGeometry, originSphereMaterial)
      originSphere.position.copy(laser.origin)
      groupRef.current?.add(originSphere)
      laserMeshesRef.current.push(originSphere)

      // 좌표 라벨 스프라이트 생성
      const canvas = document.createElement('canvas')
      canvas.width = 256
      canvas.height = 64
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)'
        ctx.fillRect(0, 0, 256, 64)
        ctx.fillStyle = `rgb(${Math.floor(laser.color.r * 255)}, ${Math.floor(laser.color.g * 255)}, ${Math.floor(laser.color.b * 255)})`
        ctx.font = 'bold 20px Arial'
        ctx.textAlign = 'center'
        ctx.fillText(laser.coordinates, 128, 40)
      }

      const texture = new THREE.CanvasTexture(canvas)
      const spriteMaterial = new THREE.SpriteMaterial({
        map: texture,
        transparent: true,
      })
      const sprite = new THREE.Sprite(spriteMaterial)
      sprite.position.copy(laser.origin)
      sprite.position.y += 0.08
      sprite.scale.set(0.3, 0.075, 1)

      groupRef.current?.add(sprite)
      laserLabelsRef.current.push(sprite)

      // 글로우 포인트 (종양 히트 지점)
      if (laserAnimationProgress >= 1) {
        glowPositions.push(laser.target.x, laser.target.y, laser.target.z)
        glowColors.push(laser.color.r, laser.color.g, laser.color.b)
      }
    })

    // 종양 히트 글로우 효과
    if (glowPositions.length > 0 && laserAnimationProgress >= 1) {
      const glowGeometry = new THREE.BufferGeometry()
      glowGeometry.setAttribute('position', new THREE.Float32BufferAttribute(glowPositions, 3))
      glowGeometry.setAttribute('color', new THREE.Float32BufferAttribute(glowColors, 3))

      const glowMaterial = new THREE.PointsMaterial({
        size: 0.05 + Math.sin(Date.now() * 0.01) * 0.02, // 펄스 효과
        vertexColors: true,
        transparent: true,
        opacity: 0.8,
        sizeAttenuation: true,
      })

      const glowPoints = new THREE.Points(glowGeometry, glowMaterial)
      groupRef.current?.add(glowPoints)
      laserGlowRef.current = glowPoints
    }
  }, [laserPositions, laserActive, laserAnimationProgress, clearLaserMeshes])

  /** 레이저 토글 (ON/OFF) */
  const toggleLaserTreatment = useCallback(() => {
    if (laserActive) {
      // OFF - 레이저 끄기 (모든 흔적 제거)
      clearLaserMeshes()
      setLaserActive(false)
      setLaserAnimationProgress(0)
      setLaserHoldTime(0)
      setLaserPositions([])
      setShowLaserPanel(false) // 설정 패널도 닫기
    } else {
      // ON - 레이저 켜기
      const center = calculateTumorCenter()
      tumorCenterRef.current = center
      const positions = calculateLaserPositions(laserCount, center)
      setLaserPositions(positions)
      setLaserAnimationProgress(0)
      setLaserHoldTime(0)
      setLaserActive(true)
    }
  }, [laserActive, laserCount, calculateTumorCenter, calculateLaserPositions, clearLaserMeshes])

  /** 레이저 치료 중지 */
  const stopLaserTreatment = useCallback(() => {
    clearLaserMeshes()
    setLaserActive(false)
    setLaserAnimationProgress(0)
    setLaserHoldTime(0)
    setLaserPositions([])
    setShowLaserPanel(false)
  }, [clearLaserMeshes])

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

    // 색상 배열 생성 (흰색에 가까운 밝은 회색)
    const colors: number[] = []
    for (let i = 0; i < intensities.length; i++) {
      const intensity = intensities[i]
      // 흰색에 가까운 밝은 gray (0.75~0.95 범위)
      const gray = 0.75 + intensity * 0.2
      colors.push(gray, gray, gray)
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
        opacity: lesionOpacity, // 병변 투명도 적용
        sizeAttenuation: true,
      })

      const points = new THREE.Points(geometry, material)
      groupRef.current?.add(points)
      meshesRef.current.push(points)
    })

  }, [segmentationVolume, showLabels, opacity, lesionOpacity, extractSurfacePoints])

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

    // 레이저 애니메이션 업데이트 (천천히 + 반복)
    if (laserActive) {
      if (laserAnimationProgress < 1) {
        // 천천히 진행 (0.005로 느리게)
        setLaserAnimationProgress(prev => Math.min(1, prev + 0.005))
      } else {
        // 완료 후 잠시 대기 후 다시 시작
        setLaserHoldTime(prev => {
          if (prev >= 60) { // 약 1초 대기 (60프레임)
            setLaserAnimationProgress(0) // 다시 시작
            return 0
          }
          return prev + 1
        })
      }
    }

    // 글로우 펄스 효과 업데이트
    if (laserGlowRef.current && laserAnimationProgress >= 1) {
      const material = laserGlowRef.current.material as THREE.PointsMaterial
      material.size = 0.05 + Math.sin(Date.now() * 0.005) * 0.02
    }

    rendererRef.current.render(sceneRef.current, cameraRef.current)
  }, [isRotating, rotationSpeed, zoom, laserActive, laserAnimationProgress])

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

  /** 레이저 빔 업데이트 */
  useEffect(() => {
    if (groupRef.current) {
      createLaserBeams()
    }
  }, [createLaserBeams])

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

      <div className="volume-3d-viewer__speed">
        <span>병변 투명도:</span>
        <input
          type="range"
          min="0.2"
          max="1"
          step="0.1"
          value={lesionOpacity}
          onChange={(e) => setLesionOpacity(Number(e.target.value))}
        />
      </div>

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
          setLesionOpacity(0.8)
          stopLaserTreatment()
        }}
      >
        초기화
      </button>

      {/* 레이저 치료 ON/OFF 토글 */}
      <button
        className={`volume-3d-viewer__laser-toggle ${laserActive ? 'active' : ''}`}
        onClick={toggleLaserTreatment}
      >
        {laserActive ? '⚡ 레이저 OFF' : '🔬 레이저 ON'}
      </button>

      {/* 레이저 설정 패널 토글 */}
      {laserActive && (
        <button
          className={`volume-3d-viewer__laser-settings ${showLaserPanel ? 'active' : ''}`}
          onClick={() => setShowLaserPanel(prev => !prev)}
        >
          ⚙️
        </button>
      )}
    </div>
  )

  // 레이저 컨트롤 패널 JSX (설정 패널)
  const laserControlPanel = showLaserPanel && laserActive && (
    <div className="volume-3d-viewer__laser-panel">
      <div className="volume-3d-viewer__laser-header">
        <span>⚡ 레이저 설정</span>
        <button
          className="volume-3d-viewer__laser-close"
          onClick={() => setShowLaserPanel(false)}
        >
          ✕
        </button>
      </div>

      <div className="volume-3d-viewer__laser-controls">
        <div className="volume-3d-viewer__laser-count">
          <label>레이저 개수: {laserCount}개</label>
          <input
            type="range"
            min="6"
            max="8"
            value={laserCount}
            onChange={(e) => {
              const newCount = Number(e.target.value)
              setLaserCount(newCount)
              // 레이저 개수 변경 시 위치 재계산
              const positions = calculateLaserPositions(newCount, tumorCenterRef.current)
              setLaserPositions(positions)
            }}
          />
          <div className="volume-3d-viewer__laser-count-labels">
            <span>6</span>
            <span>7</span>
            <span>8</span>
          </div>
        </div>

        {/* 진행률 표시 */}
        <div className="volume-3d-viewer__laser-progress">
          <div className="volume-3d-viewer__laser-progress-bar">
            <div
              className="volume-3d-viewer__laser-progress-fill"
              style={{ width: `${laserAnimationProgress * 100}%` }}
            />
          </div>
          <span>{(laserAnimationProgress * 100).toFixed(0)}%</span>
        </div>
      </div>

      {/* 레이저 좌표 목록 */}
      {laserPositions.length > 0 && (
        <div className="volume-3d-viewer__laser-coords">
          <div className="volume-3d-viewer__laser-coords-title">
            📍 레이저 발사 좌표 (MRI 기준)
          </div>
          <div className="volume-3d-viewer__laser-coords-list">
            {laserPositions.map((laser) => (
              <div
                key={laser.id}
                className="volume-3d-viewer__laser-coord-item"
                style={{
                  borderLeft: `4px solid rgb(${Math.floor(laser.color.r * 255)}, ${Math.floor(laser.color.g * 255)}, ${Math.floor(laser.color.b * 255)})`
                }}
              >
                {laser.coordinates}
              </div>
            ))}
          </div>
        </div>
      )}
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
          {laserControlPanel}
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

            {/* 레이저 컨트롤 패널 */}
            {laserControlPanel}

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
