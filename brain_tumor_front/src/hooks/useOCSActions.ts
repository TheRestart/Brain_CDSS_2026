/**
 * OCS 상태 변경 액션 공통 Hook
 * - 접수, 시작, 저장, 제출, 확정, 취소 등
 * - 에러 처리 및 성공/실패 콜백 통합
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import {
  acceptOCS,
  startOCS,
  saveOCSResult,
  submitOCSResult,
  confirmOCS,
  cancelOCS,
} from '@/services/ocs.api';
import type { WorkerResult, Attachments } from '@/types/ocs';

export interface UseOCSActionsOptions {
  onSuccess?: (action: string, ocsId: number) => void;
  onError?: (action: string, error: unknown, serverMessage?: string) => void;
  onRefresh?: () => void;
}

export interface UseOCSActionsReturn {
  loading: boolean;
  currentAction: string | null;

  // 액션들
  accept: (ocsId: number) => Promise<boolean>;
  start: (ocsId: number) => Promise<boolean>;
  save: (
    ocsId: number,
    data: { worker_result?: Partial<WorkerResult>; attachments?: Partial<Attachments> }
  ) => Promise<boolean>;
  submit: (
    ocsId: number,
    data: { worker_result?: Partial<WorkerResult>; attachments?: Partial<Attachments> }
  ) => Promise<boolean>;
  confirm: (
    ocsId: number,
    data: { ocs_result?: boolean; worker_result?: Partial<WorkerResult> | Record<string, unknown> }
  ) => Promise<boolean>;
  cancel: (ocsId: number, reason?: string) => Promise<boolean>;
}

export function useOCSActions(options: UseOCSActionsOptions = {}): UseOCSActionsReturn {
  const { onSuccess, onError, onRefresh } = options;

  const [loading, setLoading] = useState(false);
  const [currentAction, setCurrentAction] = useState<string | null>(null);

  // useRef로 콜백 참조를 안정화 (무한 루프 방지)
  const callbacksRef = useRef({ onSuccess, onError, onRefresh });
  useEffect(() => {
    callbacksRef.current = { onSuccess, onError, onRefresh };
  }, [onSuccess, onError, onRefresh]);

  const executeAction = useCallback(
    async <T>(
      actionName: string,
      ocsId: number,
      apiCall: () => Promise<T>
    ): Promise<boolean> => {
      setLoading(true);
      setCurrentAction(actionName);

      try {
        await apiCall();
        callbacksRef.current.onSuccess?.(actionName, ocsId);
        callbacksRef.current.onRefresh?.();
        return true;
      } catch (error: unknown) {
        // 서버 에러 메시지 추출
        let errorMessage = '';
        if (error && typeof error === 'object' && 'response' in error) {
          const axiosError = error as { response?: { data?: unknown } };
          const responseData = axiosError.response?.data;
          if (responseData && typeof responseData === 'object') {
            // ValidationError 배열 또는 단일 메시지 처리
            if (Array.isArray(responseData)) {
              errorMessage = responseData.join(', ');
            } else if ('detail' in responseData) {
              errorMessage = String((responseData as { detail: unknown }).detail);
            } else if ('non_field_errors' in responseData) {
              const nfe = (responseData as { non_field_errors: unknown }).non_field_errors;
              errorMessage = Array.isArray(nfe) ? nfe.join(', ') : String(nfe);
            }
          }
        }
        console.error(`[useOCSActions] ${actionName} failed:`, error, errorMessage);
        callbacksRef.current.onError?.(actionName, error, errorMessage);
        return false;
      } finally {
        setLoading(false);
        setCurrentAction(null);
      }
    },
    [] // 의존성 배열 비움 - ref를 사용하므로 안정적
  );

  const accept = useCallback(
    (ocsId: number) => executeAction('accept', ocsId, () => acceptOCS(ocsId)),
    [executeAction]
  );

  const start = useCallback(
    (ocsId: number) => executeAction('start', ocsId, () => startOCS(ocsId)),
    [executeAction]
  );

  const save = useCallback(
    (
      ocsId: number,
      data: { worker_result?: Partial<WorkerResult>; attachments?: Partial<Attachments> }
    ) => executeAction('save', ocsId, () => saveOCSResult(ocsId, data)),
    [executeAction]
  );

  const submit = useCallback(
    (
      ocsId: number,
      data: { worker_result?: Partial<WorkerResult>; attachments?: Partial<Attachments> }
    ) => executeAction('submit', ocsId, () => submitOCSResult(ocsId, data)),
    [executeAction]
  );

  const confirm = useCallback(
    (
      ocsId: number,
      data: { ocs_result?: boolean; worker_result?: Partial<WorkerResult> | Record<string, unknown> }
    ) => executeAction('confirm', ocsId, () => confirmOCS(ocsId, data)),
    [executeAction]
  );

  const cancel = useCallback(
    (ocsId: number, reason?: string) =>
      executeAction('cancel', ocsId, () => cancelOCS(ocsId, { cancel_reason: reason })),
    [executeAction]
  );

  return {
    loading,
    currentAction,
    accept,
    start,
    save,
    submit,
    confirm,
    cancel,
  };
}
