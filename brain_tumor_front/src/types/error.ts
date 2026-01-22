/**
 * 에러 타입 정의
 * - API 에러 및 일반 에러 처리를 위한 타입
 */

// API 에러 응답 구조
export interface AppError {
  message: string;
  code?: string;
  response?: {
    status?: number;
    data?: {
      error?: string;
      detail?: string;
      message?: string;
    };
  };
}

// Axios 에러 구조
export interface AxiosErrorLike {
  message: string;
  response?: {
    status: number;
    data?: {
      error?: string;
      detail?: string;
      message?: string;
    };
  };
  request?: unknown;
  config?: unknown;
}

/**
 * unknown 타입의 에러에서 메시지를 추출하는 유틸리티 함수
 * catch 블록에서 error: unknown 사용 시 활용
 */
export function getErrorMessage(error: unknown): string {
  // Error 인스턴스인 경우
  if (error instanceof Error) {
    return error.message;
  }

  // Axios 에러 또는 AppError 형태인 경우
  if (typeof error === 'object' && error !== null) {
    const e = error as AppError;

    // 응답 데이터에서 에러 메시지 추출
    if (e.response?.data) {
      const data = e.response.data;
      if (data.detail) return data.detail;
      if (data.error) return data.error;
      if (data.message) return data.message;
    }

    // 기본 message 필드
    if (e.message) return e.message;
  }

  // 문자열인 경우
  if (typeof error === 'string') {
    return error;
  }

  // 기타 - 문자열로 변환
  return String(error);
}

/**
 * 에러가 AppError 타입인지 확인하는 타입 가드
 */
export function isAppError(error: unknown): error is AppError {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    typeof (error as AppError).message === 'string'
  );
}

/**
 * 에러가 Axios 에러인지 확인하는 타입 가드
 */
export function isAxiosError(error: unknown): error is AxiosErrorLike {
  return (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    ('response' in error || 'request' in error || 'config' in error)
  );
}
