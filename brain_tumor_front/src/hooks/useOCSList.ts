/**
 * OCS 목록 조회 공통 Hook
 * - 페이지네이션, 필터링, 검색 기능 통합
 * - RIS/LIS/Doctor 워크리스트에서 공통 사용
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { getOCSList } from '@/services/ocs.api';
import type {
  OCSListItem,
  OCSSearchParams,
  OcsStatus,
  Priority,
  JobRole,
} from '@/types/ocs';

export interface UseOCSListOptions {
  jobRole?: JobRole;
  doctorId?: number;
  initialPageSize?: number;
  autoFetch?: boolean;
}

export interface UseOCSListFilters {
  status: OcsStatus | '';
  priority: Priority | '';
  modality: string;
  unassignedOnly: boolean;
  myWorkOnly: boolean;
  searchQuery: string;
}

export interface UseOCSListReturn {
  // 데이터
  ocsList: OCSListItem[];
  totalCount: number;
  loading: boolean;
  error: string | null;

  // 페이지네이션
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number) => void;

  // 필터
  filters: UseOCSListFilters;
  setStatusFilter: (status: OcsStatus | '') => void;
  setPriorityFilter: (priority: Priority | '') => void;
  setModalityFilter: (modality: string) => void;
  setUnassignedOnly: (value: boolean) => void;
  setMyWorkOnly: (value: boolean) => void;
  setSearchQuery: (query: string) => void;
  resetFilters: () => void;

  // 액션
  refresh: () => void;

  // 상태별 카운트 (6개 상태)
  statusCounts: {
    ordered: number;
    accepted: number;
    inProgress: number;
    resultReady: number;
    confirmed: number;
    cancelled: number;
  };
}

const DEFAULT_PAGE_SIZE = 20;

const initialFilters: UseOCSListFilters = {
  status: '',
  priority: '',
  modality: '',
  unassignedOnly: false,
  myWorkOnly: false,
  searchQuery: '',
};

export function useOCSList(
  userId: number | undefined,
  options: UseOCSListOptions = {}
): UseOCSListReturn {
  const {
    jobRole,
    doctorId,
    initialPageSize = DEFAULT_PAGE_SIZE,
    autoFetch = true,
  } = options;

  // 상태
  const [ocsList, setOcsList] = useState<OCSListItem[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [page, setPage] = useState(1);
  const [pageSize] = useState(initialPageSize);
  const [refreshKey, setRefreshKey] = useState(0);
  const [filters, setFilters] = useState<UseOCSListFilters>(initialFilters);

  // 목록 조회
  const fetchList = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const params: OCSSearchParams = {
        page,
        page_size: pageSize,
      };

      if (jobRole) params.job_role = jobRole;
      if (doctorId) params.doctor_id = doctorId;
      if (filters.status) params.ocs_status = filters.status;
      if (filters.priority) params.priority = filters.priority;
      if (filters.unassignedOnly) params.unassigned = true;
      if (filters.myWorkOnly && userId) params.worker_id = userId;
      if (filters.searchQuery) params.q = filters.searchQuery;

      const response = await getOCSList(params);

      let results: OCSListItem[];
      if (Array.isArray(response)) {
        results = response as unknown as OCSListItem[];
        setTotalCount(results.length);
      } else {
        results = response.results;
        setTotalCount(response.count);
      }

      // Modality 필터링 (클라이언트 사이드 - RIS용)
      if (filters.modality) {
        results = results.filter(
          (ocs) => ocs.job_type.toUpperCase() === filters.modality.toUpperCase()
        );
      }

      setOcsList(results);
    } catch (err) {
      console.error('[useOCSList] Failed to fetch:', err);
      setError('목록을 불러오는데 실패했습니다.');
      setOcsList([]);
    } finally {
      setLoading(false);
    }
  }, [page, pageSize, jobRole, doctorId, filters, userId]);

  // 자동 조회
  useEffect(() => {
    if (autoFetch) {
      fetchList();
    }
  }, [fetchList, autoFetch, refreshKey]);

  // 필터 변경 시 페이지 리셋
  const setFilterWithPageReset = useCallback(
    <K extends keyof UseOCSListFilters>(key: K, value: UseOCSListFilters[K]) => {
      setFilters((prev) => ({ ...prev, [key]: value }));
      setPage(1);
    },
    []
  );

  // 필터 핸들러
  const setStatusFilter = useCallback(
    (status: OcsStatus | '') => setFilterWithPageReset('status', status),
    [setFilterWithPageReset]
  );

  const setPriorityFilter = useCallback(
    (priority: Priority | '') => setFilterWithPageReset('priority', priority),
    [setFilterWithPageReset]
  );

  const setModalityFilter = useCallback(
    (modality: string) => setFilterWithPageReset('modality', modality),
    [setFilterWithPageReset]
  );

  const setUnassignedOnly = useCallback(
    (value: boolean) => {
      setFilters((prev) => ({
        ...prev,
        unassignedOnly: value,
        myWorkOnly: value ? false : prev.myWorkOnly,
      }));
      setPage(1);
    },
    []
  );

  const setMyWorkOnly = useCallback(
    (value: boolean) => {
      setFilters((prev) => ({
        ...prev,
        myWorkOnly: value,
        unassignedOnly: value ? false : prev.unassignedOnly,
      }));
      setPage(1);
    },
    []
  );

  const setSearchQuery = useCallback(
    (query: string) => setFilterWithPageReset('searchQuery', query),
    [setFilterWithPageReset]
  );

  const resetFilters = useCallback(() => {
    setFilters(initialFilters);
    setPage(1);
  }, []);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  // 상태별 카운트 계산 (6개 상태)
  const statusCounts = useMemo(() => ({
    ordered: ocsList.filter((o) => o.ocs_status === 'ORDERED').length,
    accepted: ocsList.filter((o) => o.ocs_status === 'ACCEPTED').length,
    inProgress: ocsList.filter((o) => o.ocs_status === 'IN_PROGRESS').length,
    resultReady: ocsList.filter((o) => o.ocs_status === 'RESULT_READY').length,
    confirmed: ocsList.filter((o) => o.ocs_status === 'CONFIRMED').length,
    cancelled: ocsList.filter((o) => o.ocs_status === 'CANCELLED').length,
  }), [ocsList]);

  const totalPages = Math.ceil(totalCount / pageSize);

  return {
    ocsList,
    totalCount,
    loading,
    error,
    page,
    pageSize,
    totalPages,
    setPage,
    filters,
    setStatusFilter,
    setPriorityFilter,
    setModalityFilter,
    setUnassignedOnly,
    setMyWorkOnly,
    setSearchQuery,
    resetFilters,
    refresh,
    statusCounts,
  };
}
