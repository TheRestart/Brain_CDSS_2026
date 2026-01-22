/**
 * AI 추론 전역 Context
 * - 앱 전역에서 AI 추론 작업 상태 관리
 * - WebSocket으로 실시간 결과 수신
 * - 페이지 이동해도 작업 상태 유지
 * - FastAPI 서버 상태 모니터링
 */
import { createContext, useContext, useEffect, useRef, useState, useCallback, type ReactNode } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import { api } from '@/services/api';

// ============================================================================
// Types
// ============================================================================
export type AIModelType = 'M1' | 'MG' | 'MM';
export type AIJobStatus = 'PENDING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';

export interface AIJob {
  job_id: string;
  model_type: AIModelType;
  status: AIJobStatus;
  ocs_id?: number;
  patient_name?: string;
  created_at: string;
  result?: any;
  error?: string;
  cached?: boolean;
}

export interface AIInferenceNotification {
  id: string;
  type: 'success' | 'error' | 'info' | 'warning';
  title: string;
  message: string;
  job_id?: string;
  timestamp: string;
}

// WebSocket 메시지 타입 (useAIInferenceWebSocket 호환)
export interface AIInferenceMessage {
  type: string;
  request_id?: string;
  job_id?: string;
  status: string;
  patient_id?: number;
  model_code?: string;
  result?: {
    grade?: {
      predicted_class: string;
      probability: number;
      probabilities?: Record<string, number>;
    };
    idh?: {
      predicted_class: string;
      mutant_probability: number;
    };
    mgmt?: {
      predicted_class: string;
      methylated_probability: number;
    };
    survival?: {
      risk_score: number;
      risk_category: string;
    };
    os_days?: {
      predicted_days: number;
      predicted_months: number;
    };
    processing_time_ms?: number;
  };
  error?: string;
}

interface AIInferenceContextValue {
  // 작업 상태
  jobs: Map<string, AIJob>;
  activeJobs: AIJob[];  // 진행 중인 작업들

  // 알림
  notifications: AIInferenceNotification[];
  removeNotification: (id: string) => void;

  // 연결 상태
  isConnected: boolean;
  isFastAPIAvailable: boolean;

  // WebSocket 메시지 (useAIInferenceWebSocket 호환)
  lastMessage: AIInferenceMessage | null;

  // 작업 요청
  requestInference: (modelType: AIModelType, params: any) => Promise<AIJob | null>;

  // 작업 조회
  getJob: (jobId: string) => AIJob | undefined;
  refreshJob: (jobId: string) => Promise<void>;
}

const AIInferenceContext = createContext<AIInferenceContextValue | null>(null);

// ============================================================================
// Provider
// ============================================================================
interface Props {
  children: ReactNode;
}

export function AIInferenceProvider({ children }: Props) {
  const { isAuthenticated } = useAuth();
  const wsRef = useRef<WebSocket | null>(null);
  const pingIntervalRef = useRef<number | null>(null);
  const pollingIntervalRef = useRef<number | null>(null);
  const jobsRef = useRef<Map<string, AIJob>>(new Map());  // 폴링용 ref

  const [jobs, setJobs] = useState<Map<string, AIJob>>(new Map());
  const [notifications, setNotifications] = useState<AIInferenceNotification[]>([]);
  const [isConnected, setIsConnected] = useState(false);
  const [isFastAPIAvailable, setIsFastAPIAvailable] = useState(true);
  const [lastMessage, setLastMessage] = useState<AIInferenceMessage | null>(null);

  // jobs 변경 시 ref도 동기화
  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  // 진행 중인 작업 목록
  const activeJobs = Array.from(jobs.values()).filter(
    job => job.status === 'PENDING' || job.status === 'PROCESSING'
  );

  // ========================================
  // 알림 관리
  // ========================================
  const addNotification = useCallback((
    type: AIInferenceNotification['type'],
    title: string,
    message: string,
    job_id?: string
  ) => {
    const notification: AIInferenceNotification = {
      id: `${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
      type,
      title,
      message,
      job_id,
      timestamp: new Date().toISOString(),
    };

    setNotifications(prev => [notification, ...prev].slice(0, 10));

    // 10초 후 자동 제거
    setTimeout(() => {
      setNotifications(prev => prev.filter(n => n.id !== notification.id));
    }, 10000);

    return notification;
  }, []);

  const removeNotification = useCallback((id: string) => {
    setNotifications(prev => prev.filter(n => n.id !== id));
  }, []);

  // ========================================
  // 작업 상태 업데이트
  // ========================================
  const updateJob = useCallback((jobId: string, updates: Partial<AIJob>) => {
    setJobs(prev => {
      const newJobs = new Map(prev);
      const existing = newJobs.get(jobId);
      if (existing) {
        newJobs.set(jobId, { ...existing, ...updates });
      }
      return newJobs;
    });
  }, []);

  const addJob = useCallback((job: AIJob) => {
    setJobs(prev => {
      const newJobs = new Map(prev);
      newJobs.set(job.job_id, job);
      return newJobs;
    });
  }, []);

  // ========================================
  // WebSocket 연결
  // ========================================
  const connectWebSocket = useCallback(() => {
    if (!isAuthenticated) return;
    if (wsRef.current?.readyState === WebSocket.OPEN) return;

    const token = localStorage.getItem('accessToken');
    if (!token) return;

    const wsBaseUrl = import.meta.env.VITE_WS_URL || 'ws://localhost:8000/ws';
    const wsUrl = `${wsBaseUrl}/ai-inference/?token=${token}`;

    console.log('[AI Context] WebSocket 연결 시도...');
    const ws = new WebSocket(wsUrl);

    ws.onopen = () => {
      console.log('[AI Context] WebSocket 연결됨');
      setIsConnected(true);

      // Ping every 30 seconds
      pingIntervalRef.current = window.setInterval(() => {
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ type: 'ping' }));
        }
      }, 30000);
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        console.log('[AI Context] WebSocket 메시지:', data);

        if (data.type === 'pong') return;

        // lastMessage 업데이트 (useAIInferenceWebSocket 호환)
        setLastMessage(data);

        // AI 추론 결과 수신
        if (data.type === 'AI_INFERENCE_RESULT') {
          const { job_id, status, result, error, model_type } = data;

          updateJob(job_id, {
            status: status === 'COMPLETED' ? 'COMPLETED' : 'FAILED',
            result,
            error,
          });

          // 알림
          if (status === 'COMPLETED') {
            addNotification('success', `${model_type} 추론 완료`, `작업 ${job_id}가 완료되었습니다.`, job_id);
          } else {
            addNotification('error', `${model_type} 추론 실패`, error || '알 수 없는 오류', job_id);
          }
        }
      } catch (e) {
        console.error('[AI Context] WebSocket 메시지 파싱 오류:', e);
      }
    };

    ws.onerror = () => {
      console.log('[AI Context] WebSocket 오류');
    };

    ws.onclose = () => {
      console.log('[AI Context] WebSocket 연결 종료');
      setIsConnected(false);

      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }

      // 5초 후 재연결 시도
      setTimeout(() => {
        if (isAuthenticated) {
          connectWebSocket();
        }
      }, 5000);
    };

    wsRef.current = ws;
  }, [isAuthenticated, updateJob, addNotification]);

  // ========================================
  // 폴링 (WebSocket 백업) - ref 사용으로 의존성 제거
  // ========================================
  const pollActiveJobs = useCallback(async () => {
    const currentJobs = jobsRef.current;
    const activeJobIds = Array.from(currentJobs.values())
      .filter(job => job.status === 'PENDING' || job.status === 'PROCESSING')
      .map(job => job.job_id);

    console.log('[AI Context] 폴링 실행, 진행 중인 작업:', activeJobIds);

    for (const jobId of activeJobIds) {
      try {
        const res = await api.get(`/ai/inferences/${jobId}/`);
        const data = res.data;

        if (data.status !== currentJobs.get(jobId)?.status) {
          console.log(`[AI Context] 작업 ${jobId} 상태 변경: ${data.status}`);
          updateJob(jobId, {
            status: data.status,
            result: data.result_data,
            error: data.error_message,
          });

          // 완료/실패 시 알림
          if (data.status === 'COMPLETED') {
            addNotification('success', `${data.model_type} 추론 완료`, `작업이 완료되었습니다.`, jobId);
          } else if (data.status === 'FAILED') {
            addNotification('error', `${data.model_type} 추론 실패`, data.error_message || '알 수 없는 오류', jobId);
          }
        }
      } catch (err) {
        console.error(`[AI Context] 작업 ${jobId} 상태 조회 실패:`, err);
      }
    }
  }, [updateJob, addNotification]);  // jobs 의존성 제거

  // ========================================
  // 추론 요청
  // ========================================
  const requestInference = useCallback(async (
    modelType: AIModelType,
    params: any
  ): Promise<AIJob | null> => {
    const endpoints: Record<AIModelType, string> = {
      M1: '/ai/m1/inference/',
      MG: '/ai/mg/inference/',
      MM: '/ai/mm/inference/',
    };

    try {
      const res = await api.post(endpoints[modelType], params);
      const data = res.data;

      // 캐시된 결과
      if (data.cached && data.result) {
        const job: AIJob = {
          job_id: data.job_id,
          model_type: modelType,
          status: 'COMPLETED',
          result: data.result,
          cached: true,
          created_at: new Date().toISOString(),
        };
        addJob(job);
        addNotification('info', `${modelType} 캐시 결과`, '기존 추론 결과를 반환합니다.', data.job_id);
        return job;
      }

      // 새 작업
      const job: AIJob = {
        job_id: data.job_id,
        model_type: modelType,
        status: 'PROCESSING',
        created_at: new Date().toISOString(),
      };
      addJob(job);
      addNotification('info', `${modelType} 추론 시작`, `작업 ${data.job_id}가 시작되었습니다.`, data.job_id);

      setIsFastAPIAvailable(true);
      return job;

    } catch (err: any) {
      console.error('[AI Context] 추론 요청 실패:', err);

      const status = err.response?.status;
      const detail = err.response?.data?.detail || err.message;

      // FastAPI 연결 실패 감지
      if (status === 503 || status === 502 || status === 504) {
        setIsFastAPIAvailable(false);
        addNotification(
          'error',
          'AI 서버 연결 실패',
          'FastAPI(추론 모델 서버)가 OFF 상태입니다. 서버 관리자에게 문의하세요.'
        );
      } else if (status === 403) {
        addNotification('error', '권한 없음', detail);
      } else if (status === 400) {
        addNotification('error', '요청 오류', detail);
      } else if (status === 404) {
        addNotification('error', '데이터 없음', detail);
      } else {
        addNotification('error', '추론 요청 실패', detail);
      }

      return null;
    }
  }, [addJob, addNotification]);

  // ========================================
  // 작업 조회
  // ========================================
  const getJob = useCallback((jobId: string) => {
    return jobs.get(jobId);
  }, [jobs]);

  const refreshJob = useCallback(async (jobId: string) => {
    try {
      const res = await api.get(`/ai/inferences/${jobId}/`);
      updateJob(jobId, {
        status: res.data.status,
        result: res.data.result_data,
        error: res.data.error_message,
      });
    } catch (err) {
      console.error(`[AI Context] 작업 ${jobId} 새로고침 실패:`, err);
    }
  }, [updateJob]);

  // ========================================
  // Effects
  // ========================================

  // WebSocket 연결
  useEffect(() => {
    if (isAuthenticated) {
      connectWebSocket();
    }

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
        wsRef.current = null;
      }
      if (pingIntervalRef.current) {
        clearInterval(pingIntervalRef.current);
        pingIntervalRef.current = null;
      }
    };
  }, [isAuthenticated, connectWebSocket]);

  // 폴링 (진행 중인 작업이 있을 때만)
  useEffect(() => {
    // 진행 중인 작업이 있으면 폴링 시작
    if (activeJobs.length > 0 && !pollingIntervalRef.current) {
      console.log('[AI Context] 폴링 시작, 진행 중인 작업 수:', activeJobs.length);
      // 즉시 한 번 실행
      pollActiveJobs();

      // 3초마다 폴링
      pollingIntervalRef.current = window.setInterval(pollActiveJobs, 3000);
    }

    // 진행 중인 작업이 없으면 폴링 중지
    if (activeJobs.length === 0 && pollingIntervalRef.current) {
      console.log('[AI Context] 폴링 중지, 진행 중인 작업 없음');
      clearInterval(pollingIntervalRef.current);
      pollingIntervalRef.current = null;
    }

    return () => {
      // cleanup은 컴포넌트 언마운트 시에만
    };
  }, [activeJobs.length, pollActiveJobs]);

  // 컴포넌트 언마운트 시 폴링 정리
  useEffect(() => {
    return () => {
      if (pollingIntervalRef.current) {
        clearInterval(pollingIntervalRef.current);
        pollingIntervalRef.current = null;
      }
    };
  }, []);

  // ========================================
  // Context Value
  // ========================================
  const value: AIInferenceContextValue = {
    jobs,
    activeJobs,
    notifications,
    removeNotification,
    isConnected,
    isFastAPIAvailable,
    lastMessage,
    requestInference,
    getJob,
    refreshJob,
  };

  return (
    <AIInferenceContext.Provider value={value}>
      {children}
    </AIInferenceContext.Provider>
  );
}

// ============================================================================
// Hooks
// ============================================================================
export function useAIInference() {
  const context = useContext(AIInferenceContext);
  if (!context) {
    throw new Error('useAIInference must be used within AIInferenceProvider');
  }
  return context;
}

/**
 * 특정 작업 구독 Hook
 */
export function useAIJob(jobId: string | null) {
  const { getJob, refreshJob } = useAIInference();

  const job = jobId ? getJob(jobId) : undefined;

  const refresh = useCallback(() => {
    if (jobId) {
      refreshJob(jobId);
    }
  }, [jobId, refreshJob]);

  return { job, refresh };
}
