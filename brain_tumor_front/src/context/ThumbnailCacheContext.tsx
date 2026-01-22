/**
 * 썸네일 캐시 Context
 * - 방문한 보고서의 썸네일 URL만 캐시
 * - /reports 목록에서는 캐시된 것만 썸네일로 표시, 나머지는 아이콘
 */
import { createContext, useContext, useState, useCallback, type ReactNode } from 'react';

interface ThumbnailCacheContextType {
  // 캐시된 보고서 ID Set
  cachedReportIds: Set<string>;
  // 보고서 ID를 캐시에 추가
  markAsCached: (reportId: string) => void;
  // 캐시 여부 확인
  isCached: (reportId: string) => boolean;
  // 캐시 초기화
  clearCache: () => void;
}

const ThumbnailCacheContext = createContext<ThumbnailCacheContextType | null>(null);

export function ThumbnailCacheProvider({ children }: { children: ReactNode }) {
  const [cachedReportIds, setCachedReportIds] = useState<Set<string>>(() => {
    // localStorage에서 초기값 로드
    try {
      const saved = localStorage.getItem('thumbnailCache');
      if (saved) {
        return new Set(JSON.parse(saved));
      }
    } catch {
      // ignore
    }
    return new Set();
  });

  const markAsCached = useCallback((reportId: string) => {
    setCachedReportIds(prev => {
      const next = new Set(prev);
      next.add(reportId);
      // localStorage에 저장 (최대 100개 유지)
      const arr = Array.from(next).slice(-100);
      localStorage.setItem('thumbnailCache', JSON.stringify(arr));
      return new Set(arr);
    });
  }, []);

  const isCached = useCallback((reportId: string) => {
    return cachedReportIds.has(reportId);
  }, [cachedReportIds]);

  const clearCache = useCallback(() => {
    setCachedReportIds(new Set());
    localStorage.removeItem('thumbnailCache');
  }, []);

  return (
    <ThumbnailCacheContext.Provider value={{ cachedReportIds, markAsCached, isCached, clearCache }}>
      {children}
    </ThumbnailCacheContext.Provider>
  );
}

export function useThumbnailCache() {
  const context = useContext(ThumbnailCacheContext);
  if (!context) {
    throw new Error('useThumbnailCache must be used within ThumbnailCacheProvider');
  }
  return context;
}
