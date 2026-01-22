/**
 * AICompareViewer Component
 * 두 AI 분석 결과를 나란히 또는 오버레이로 비교하는 뷰어
 * 담당자 A: AI 결과 비교 기능
 */

import React, { useState, useEffect } from 'react'
import { aiApi } from '@/services/ai.api'
import './AICompareViewer.css'

interface InferenceDetail {
  id: number
  job_id: string
  model_type: string
  status: string
  patient_name: string
  patient_number: string
  result_data: {
    segmentation?: {
      wt_volume?: number
      tc_volume?: number
      et_volume?: number
    }
    grade?: {
      predicted_class?: string
      probability?: number
    }
  } | null
  created_at: string
  completed_at: string | null
}

interface SegmentationData {
  mri: number[][][] | null
  prediction: number[][][] | null
  shape: [number, number, number]
}

interface AICompareViewerProps {
  job1: InferenceDetail
  job2: InferenceDetail
  viewMode: 'side' | 'overlay'
}

const AICompareViewer: React.FC<AICompareViewerProps> = ({ job1, job2, viewMode }) => {
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string>('')
  const [seg1, setSeg1] = useState<SegmentationData | null>(null)
  const [seg2, setSeg2] = useState<SegmentationData | null>(null)
  const [sliceIndex, setSliceIndex] = useState(64)
  const [sliceAxis, setSliceAxis] = useState<'axial' | 'coronal' | 'sagittal'>('axial')
  const [syncSlice, setSyncSlice] = useState(true)

  // 세그멘테이션 데이터 로드
  useEffect(() => {
    loadSegmentationData()
  }, [job1.job_id, job2.job_id])

  const loadSegmentationData = async () => {
    try {
      setLoading(true)
      setError('')

      const [data1, data2] = await Promise.all([
        aiApi.getSegmentationData(job1.job_id),
        aiApi.getSegmentationData(job2.job_id),
      ])

      setSeg1(data1)
      setSeg2(data2)

      // 중간 슬라이스로 초기화
      if (data1?.shape) {
        setSliceIndex(Math.floor(data1.shape[2] / 2))
      }
    } catch (err: any) {
      console.error('Failed to load segmentation data:', err)
      setError('세그멘테이션 데이터를 불러올 수 없습니다.')
    } finally {
      setLoading(false)
    }
  }

  // 슬라이스 변경 핸들러
  const handleSliceChange = (value: number) => {
    setSliceIndex(value)
  }

  // 2D 슬라이스 추출
  const getSlice = (
    volume: number[][][] | null,
    axis: 'axial' | 'coronal' | 'sagittal',
    index: number
  ): number[][] | null => {
    if (!volume) return null

    const [dimX, dimY, dimZ] = [volume.length, volume[0]?.length || 0, volume[0]?.[0]?.length || 0]

    try {
      switch (axis) {
        case 'axial':
          // XY plane at Z index
          return volume.map((row) => row.map((col) => col[Math.min(index, dimZ - 1)] || 0))
        case 'coronal':
          // XZ plane at Y index
          return volume.map((row) => row[Math.min(index, dimY - 1)] || [])
        case 'sagittal':
          // YZ plane at X index
          return volume[Math.min(index, dimX - 1)] || []
        default:
          return null
      }
    } catch {
      return null
    }
  }

  // 슬라이스를 캔버스에 렌더링
  const renderSliceToCanvas = (
    canvasId: string,
    mriSlice: number[][] | null,
    segSlice: number[][] | null,
    showOverlay: boolean = true
  ) => {
    const canvas = document.getElementById(canvasId) as HTMLCanvasElement
    if (!canvas || !mriSlice) return

    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const height = mriSlice.length
    const width = mriSlice[0]?.length || 0

    canvas.width = width
    canvas.height = height

    const imageData = ctx.createImageData(width, height)

    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const idx = (y * width + x) * 4

        // MRI 강도 정규화 (0-255)
        const mriValue = Math.min(255, Math.max(0, Math.round((mriSlice[y]?.[x] || 0) * 255)))

        // 기본 회색조 MRI
        imageData.data[idx] = mriValue
        imageData.data[idx + 1] = mriValue
        imageData.data[idx + 2] = mriValue
        imageData.data[idx + 3] = 255

        // 세그멘테이션 오버레이
        if (showOverlay && segSlice) {
          const segValue = segSlice[y]?.[x] || 0

          if (segValue > 0) {
            // 세그멘테이션 영역별 색상
            // 1: NCR (빨강), 2: ED (노랑), 3: ET (파랑)
            let r = mriValue,
              g = mriValue,
              b = mriValue
            const alpha = 0.5

            if (segValue === 1 || segValue === 4) {
              // NCR/NET - 빨강
              r = Math.round(mriValue * (1 - alpha) + 255 * alpha)
              g = Math.round(mriValue * (1 - alpha) + 100 * alpha)
              b = Math.round(mriValue * (1 - alpha) + 100 * alpha)
            } else if (segValue === 2) {
              // ED - 노랑
              r = Math.round(mriValue * (1 - alpha) + 255 * alpha)
              g = Math.round(mriValue * (1 - alpha) + 255 * alpha)
              b = Math.round(mriValue * (1 - alpha) + 0 * alpha)
            } else if (segValue === 3) {
              // ET - 파랑
              r = Math.round(mriValue * (1 - alpha) + 100 * alpha)
              g = Math.round(mriValue * (1 - alpha) + 149 * alpha)
              b = Math.round(mriValue * (1 - alpha) + 237 * alpha)
            }

            imageData.data[idx] = r
            imageData.data[idx + 1] = g
            imageData.data[idx + 2] = b
          }
        }
      }
    }

    ctx.putImageData(imageData, 0, 0)
  }

  // 렌더링 업데이트
  useEffect(() => {
    if (!seg1 || !seg2) return

    const mriSlice1 = getSlice(seg1.mri, sliceAxis, sliceIndex)
    const segSlice1 = getSlice(seg1.prediction, sliceAxis, sliceIndex)
    const mriSlice2 = getSlice(seg2.mri, sliceAxis, sliceIndex)
    const segSlice2 = getSlice(seg2.prediction, sliceAxis, sliceIndex)

    renderSliceToCanvas('compare-canvas-1', mriSlice1, segSlice1)
    renderSliceToCanvas('compare-canvas-2', mriSlice2, segSlice2)
  }, [seg1, seg2, sliceIndex, sliceAxis])

  const maxSlice = seg1?.shape?.[2] || 128

  if (loading) {
    return (
      <div className="ai-compare-viewer ai-compare-viewer--loading">
        <div className="ai-compare-viewer__spinner" />
        <span>세그멘테이션 데이터 로딩 중...</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="ai-compare-viewer ai-compare-viewer--error">
        <span className="material-icons">error_outline</span>
        <span>{error}</span>
      </div>
    )
  }

  return (
    <div className="ai-compare-viewer">
      {/* 컨트롤 바 */}
      <div className="ai-compare-viewer__controls">
        <div className="ai-compare-viewer__control-group">
          <label>축:</label>
          <select
            value={sliceAxis}
            onChange={(e) => setSliceAxis(e.target.value as 'axial' | 'coronal' | 'sagittal')}
            className="ai-compare-viewer__select"
          >
            <option value="axial">Axial (Z)</option>
            <option value="coronal">Coronal (Y)</option>
            <option value="sagittal">Sagittal (X)</option>
          </select>
        </div>

        <div className="ai-compare-viewer__control-group ai-compare-viewer__slider-group">
          <label>슬라이스: {sliceIndex}</label>
          <input
            type="range"
            min={0}
            max={maxSlice - 1}
            value={sliceIndex}
            onChange={(e) => handleSliceChange(Number(e.target.value))}
            className="ai-compare-viewer__slider"
          />
        </div>

        <div className="ai-compare-viewer__control-group">
          <label className="ai-compare-viewer__checkbox-label">
            <input
              type="checkbox"
              checked={syncSlice}
              onChange={(e) => setSyncSlice(e.target.checked)}
            />
            동기화
          </label>
        </div>
      </div>

      {/* 뷰어 영역 */}
      <div
        className={`ai-compare-viewer__panels ${viewMode === 'overlay' ? 'ai-compare-viewer__panels--overlay' : ''}`}
      >
        {/* 왼쪽 (이전) */}
        <div className="ai-compare-viewer__panel">
          <div className="ai-compare-viewer__panel-header">
            <span className="ai-compare-viewer__panel-label">이전</span>
            <span className="ai-compare-viewer__panel-date">
              {new Date(job1.created_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <div className="ai-compare-viewer__canvas-wrapper">
            <canvas id="compare-canvas-1" className="ai-compare-viewer__canvas" />
          </div>
          <div className="ai-compare-viewer__panel-info">
            <span>WT: {job1.result_data?.segmentation?.wt_volume?.toFixed(2) || '-'} ml</span>
            <span>TC: {job1.result_data?.segmentation?.tc_volume?.toFixed(2) || '-'} ml</span>
            <span>ET: {job1.result_data?.segmentation?.et_volume?.toFixed(2) || '-'} ml</span>
          </div>
        </div>

        {/* 오른쪽 (현재) */}
        <div className="ai-compare-viewer__panel">
          <div className="ai-compare-viewer__panel-header">
            <span className="ai-compare-viewer__panel-label">현재</span>
            <span className="ai-compare-viewer__panel-date">
              {new Date(job2.created_at).toLocaleDateString('ko-KR')}
            </span>
          </div>
          <div className="ai-compare-viewer__canvas-wrapper">
            <canvas id="compare-canvas-2" className="ai-compare-viewer__canvas" />
          </div>
          <div className="ai-compare-viewer__panel-info">
            <span>WT: {job2.result_data?.segmentation?.wt_volume?.toFixed(2) || '-'} ml</span>
            <span>TC: {job2.result_data?.segmentation?.tc_volume?.toFixed(2) || '-'} ml</span>
            <span>ET: {job2.result_data?.segmentation?.et_volume?.toFixed(2) || '-'} ml</span>
          </div>
        </div>
      </div>

      {/* 범례 */}
      <div className="ai-compare-viewer__legend">
        <div className="ai-compare-viewer__legend-item">
          <span className="ai-compare-viewer__legend-color ai-compare-viewer__legend-color--ncr" />
          <span>NCR/NET (괴사핵)</span>
        </div>
        <div className="ai-compare-viewer__legend-item">
          <span className="ai-compare-viewer__legend-color ai-compare-viewer__legend-color--ed" />
          <span>ED (부종)</span>
        </div>
        <div className="ai-compare-viewer__legend-item">
          <span className="ai-compare-viewer__legend-color ai-compare-viewer__legend-color--et" />
          <span>ET (조영증강)</span>
        </div>
      </div>
    </div>
  )
}

export default AICompareViewer
