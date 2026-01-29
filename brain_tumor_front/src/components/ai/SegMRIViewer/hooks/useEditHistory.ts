import { useState, useCallback, useRef } from 'react'
import type { EditAction, EditHistoryState } from '../types'

const MAX_HISTORY_SIZE = 50

interface UseEditHistoryReturn {
  canUndo: boolean
  canRedo: boolean
  historyLength: number
  pushAction: (action: EditAction) => void
  undo: (mask: number[][][]) => number[][][] | null
  redo: (mask: number[][][]) => number[][][] | null
  clear: () => void
}

/**
 * 세그멘테이션 편집 Undo/Redo 관리 Hook
 */
export function useEditHistory(): UseEditHistoryReturn {
  const [history, setHistory] = useState<EditHistoryState>({
    past: [],
    future: [],
  })

  // 현재 히스토리 상태 참조 (콜백에서 최신 값 접근용)
  const historyRef = useRef(history)
  historyRef.current = history

  // 액션 추가
  const pushAction = useCallback((action: EditAction) => {
    setHistory(prev => {
      const newPast = [...prev.past, action]

      // 최대 히스토리 크기 제한
      if (newPast.length > MAX_HISTORY_SIZE) {
        newPast.shift()
      }

      return {
        past: newPast,
        future: [], // 새 액션 추가 시 redo 스택 초기화
      }
    })
  }, [])

  // Undo: 마지막 액션 취소
  const undo = useCallback((mask: number[][][]): number[][][] | null => {
    const { past, future } = historyRef.current

    if (past.length === 0) return null

    const lastAction = past[past.length - 1]
    const newMask = applyReverseAction(mask, lastAction)

    setHistory({
      past: past.slice(0, -1),
      future: [lastAction, ...future],
    })

    return newMask
  }, [])

  // Redo: 취소한 액션 다시 적용
  const redo = useCallback((mask: number[][][]): number[][][] | null => {
    const { past, future } = historyRef.current

    if (future.length === 0) return null

    const nextAction = future[0]
    const newMask = applyAction(mask, nextAction)

    setHistory({
      past: [...past, nextAction],
      future: future.slice(1),
    })

    return newMask
  }, [])

  // 히스토리 초기화
  const clear = useCallback(() => {
    setHistory({ past: [], future: [] })
  }, [])

  return {
    canUndo: history.past.length > 0,
    canRedo: history.future.length > 0,
    historyLength: history.past.length,
    pushAction,
    undo,
    redo,
    clear,
  }
}

/**
 * 액션 적용 (Redo용)
 */
function applyAction(mask: number[][][], action: EditAction): number[][][] {
  const newMask = cloneMask3D(mask)

  for (const voxel of action.affectedVoxels) {
    const [x, y, z] = voxel.coord
    if (isValidCoord(newMask, x, y, z)) {
      newMask[x][y][z] = voxel.newValue
    }
  }

  return newMask
}

/**
 * 액션 역적용 (Undo용)
 */
function applyReverseAction(mask: number[][][], action: EditAction): number[][][] {
  const newMask = cloneMask3D(mask)

  for (const voxel of action.affectedVoxels) {
    const [x, y, z] = voxel.coord
    if (isValidCoord(newMask, x, y, z)) {
      newMask[x][y][z] = voxel.previousValue
    }
  }

  return newMask
}

/**
 * 3D 마스크 복사
 */
function cloneMask3D(mask: number[][][]): number[][][] {
  return mask.map(plane => plane.map(row => [...row]))
}

/**
 * 좌표 유효성 검사
 */
function isValidCoord(mask: number[][][], x: number, y: number, z: number): boolean {
  return (
    x >= 0 && x < mask.length &&
    y >= 0 && y < mask[0].length &&
    z >= 0 && z < mask[0][0].length
  )
}

export default useEditHistory
