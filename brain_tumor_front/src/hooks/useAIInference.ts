/**
 * AI 추론 요청 관리 Hook
 * - 추론 요청 목록 조회, 생성, 상태 모니터링
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import {
  getAIRequests,
  getAIRequest,
  createAIRequest,
  cancelAIRequest,
  validateAIData,
  reviewAIResult,
  getPatientAvailableModels,
  getAIModels,
} from '@/services/ai.api';
import type {
  AIInferenceRequest,
  AIModel,
  AvailableModel,
  DataValidationResult,
} from '@/services/ai.api';

// =============================================================================
// AI 요청 목록 Hook
// =============================================================================
export interface UseAIRequestListOptions {
  patientId?: number;
  modelCode?: string;
  status?: string;
  myOnly?: boolean;
  autoFetch?: boolean;
  pollingInterval?: number; // 상태 폴링 간격 (ms)
}

export interface UseAIRequestListReturn {
  requests: AIInferenceRequest[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAIRequestList(options: UseAIRequestListOptions = {}): UseAIRequestListReturn {
  const { patientId, modelCode, status, myOnly, autoFetch = true, pollingInterval } = options;

  const [requests, setRequests] = useState<AIInferenceRequest[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    setError(null);

    try {
      const data = await getAIRequests({
        patient_id: patientId,
        model_code: modelCode,
        status,
        my_only: myOnly,
      });
      setRequests(data);
    } catch (err: any) {
      // 404는 API가 아직 구현되지 않은 경우 - 조용히 빈 배열 반환
      if (err?.response?.status === 404) {
        setRequests([]);
        return;
      }
      console.error('[useAIRequestList] Failed to fetch:', err);
      setError('AI 추론 요청 목록을 불러오는데 실패했습니다.');
      setRequests([]);
    } finally {
      setLoading(false);
    }
  }, [patientId, modelCode, status, myOnly]);

  useEffect(() => {
    if (autoFetch) {
      fetchRequests();
    }
  }, [fetchRequests, autoFetch, refreshKey]);

  // 폴링 (처리 중인 요청 상태 업데이트)
  useEffect(() => {
    if (!pollingInterval) return;

    const hasProcessing = requests.some((r) =>
      ['PENDING', 'VALIDATING', 'PROCESSING'].includes(r.status)
    );

    if (!hasProcessing) return;

    const timer = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, pollingInterval);

    return () => clearInterval(timer);
  }, [requests, pollingInterval]);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  return { requests, loading, error, refresh };
}

// =============================================================================
// AI 요청 상세 Hook
// =============================================================================
export interface UseAIRequestDetailReturn {
  request: AIInferenceRequest | null;
  loading: boolean;
  error: string | null;
  refresh: () => void;
  cancel: () => Promise<void>;
  review: (status: 'approved' | 'rejected', comment?: string) => Promise<void>;
}

export function useAIRequestDetail(jobId: string | null): UseAIRequestDetailReturn {
  const [request, setRequest] = useState<AIInferenceRequest | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const fetchDetail = useCallback(async () => {
    if (!jobId) {
      setRequest(null);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const data = await getAIRequest(jobId);
      setRequest(data);
    } catch (err) {
      console.error('[useAIRequestDetail] Failed to fetch:', err);
      setError('AI 추론 요청을 불러오는데 실패했습니다.');
      setRequest(null);
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    fetchDetail();
  }, [fetchDetail, refreshKey]);

  // 처리 중일 때 자동 폴링
  useEffect(() => {
    if (!request) return;

    const isProcessing = ['PENDING', 'VALIDATING', 'PROCESSING'].includes(request.status);
    if (!isProcessing) return;

    const timer = setInterval(() => {
      setRefreshKey((prev) => prev + 1);
    }, 3000); // 3초마다 상태 확인

    return () => clearInterval(timer);
  }, [request]);

  const refresh = useCallback(() => {
    setRefreshKey((prev) => prev + 1);
  }, []);

  const cancel = useCallback(async () => {
    if (!jobId) return;

    try {
      await cancelAIRequest(jobId);
      refresh();
    } catch (err) {
      console.error('[useAIRequestDetail] Failed to cancel:', err);
      throw err;
    }
  }, [jobId, refresh]);

  const review = useCallback(
    async (status: 'approved' | 'rejected', comment?: string) => {
      if (!jobId) return;

      try {
        await reviewAIResult(jobId, {
          review_status: status,
          review_comment: comment,
        });
        refresh();
      } catch (err) {
        console.error('[useAIRequestDetail] Failed to review:', err);
        throw err;
      }
    },
    [jobId, refresh]
  );

  return { request, loading, error, refresh, cancel, review };
}

// =============================================================================
// AI 모델 목록 Hook
// =============================================================================
export function useAIModels() {
  const [models, setModels] = useState<AIModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchModels = async () => {
      setLoading(true);
      try {
        const data = await getAIModels();
        setModels(data.filter((m) => m.is_active));
      } catch (err: any) {
        // 404는 API가 아직 구현되지 않은 경우 - 조용히 빈 배열 반환
        if (err?.response?.status === 404) {
          setModels([]);
          return;
        }
        console.error('[useAIModels] Failed to fetch:', err);
        setError('AI 모델 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, []);

  return { models, loading, error };
}

// =============================================================================
// 환자별 사용 가능 모델 Hook
// =============================================================================
export function usePatientAvailableModels(patientId: number | null) {
  const [models, setModels] = useState<AvailableModel[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!patientId) {
      setModels([]);
      return;
    }

    const fetchModels = async () => {
      setLoading(true);
      try {
        const data = await getPatientAvailableModels(patientId);
        setModels(data);
      } catch (err) {
        console.error('[usePatientAvailableModels] Failed to fetch:', err);
        setError('사용 가능한 모델 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchModels();
  }, [patientId]);

  const availableModels = useMemo(() => models.filter((m) => m.is_available), [models]);
  const unavailableModels = useMemo(() => models.filter((m) => !m.is_available), [models]);

  return { models, availableModels, unavailableModels, loading, error };
}

// =============================================================================
// AI 추론 요청 생성 Hook
// =============================================================================
export interface UseCreateAIRequestReturn {
  create: (patientId: number, modelCode: string, priority?: string, ocsIds?: number[]) => Promise<AIInferenceRequest>;
  validate: (patientId: number, modelCode: string) => Promise<DataValidationResult>;
  creating: boolean;
  validating: boolean;
  error: string | null;
}

export function useCreateAIRequest(): UseCreateAIRequestReturn {
  const [creating, setCreating] = useState(false);
  const [validating, setValidating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const validate = useCallback(async (patientId: number, modelCode: string) => {
    setValidating(true);
    setError(null);

    try {
      const result = await validateAIData({ patient_id: patientId, model_code: modelCode });
      return result;
    } catch (err) {
      console.error('[useCreateAIRequest] Validation failed:', err);
      setError('데이터 검증에 실패했습니다.');
      throw err;
    } finally {
      setValidating(false);
    }
  }, []);

  const create = useCallback(
    async (patientId: number, modelCode: string, priority?: string, ocsIds?: number[]) => {
      setCreating(true);
      setError(null);

      try {
        const result = await createAIRequest({
          patient_id: patientId,
          model_code: modelCode,
          priority,
          ocs_ids: ocsIds,
        });
        return result;
      } catch (err) {
        console.error('[useCreateAIRequest] Creation failed:', err);
        setError('AI 추론 요청 생성에 실패했습니다.');
        throw err;
      } finally {
        setCreating(false);
      }
    },
    []
  );

  return { create, validate, creating, validating, error };
}
