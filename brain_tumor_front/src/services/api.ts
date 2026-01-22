import axios from 'axios';
import { show403Alert } from '@/utils/alert';

// 환경별 API URL 설정 (유연한 환경 대응)
const getApiBaseUrl = (): string => {
  const envUrl = import.meta.env.VITE_API_BASE_URL;

  // 환경변수가 설정되어 있으면 사용
  if (envUrl) return envUrl;

  // 프로덕션 환경에서 환경변수 누락 경고
  if (import.meta.env.PROD) {
    console.warn('[API] VITE_API_BASE_URL 환경변수가 설정되지 않았습니다. 기본값 사용.');
  }

  // 개발 환경 기본값 (다른 PC에서도 동작하도록 localhost 사용)
  return "http://localhost:8000/api";
};

// Axios 인스턴스 생성
export const api = axios.create({
  baseURL: getApiBaseUrl(),
  withCredentials: true, // 쿠키 포함 (refresh token 등)
  timeout: 30000, // 30초 타임아웃
});

// 현재 API URL 확인용 (디버깅)
export const getConfiguredApiUrl = () => getApiBaseUrl();

// 요청 인터셉터
api.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    // 반드시 Bearer 뒤에 공백 필요
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 (Race Condition 방지)
let isRefreshing = false;
let refreshPromise: Promise<string> | null = null;
let refreshQueue: ((token: string) => void)[] = [];

const subscribeTokenRefresh = (cb: (token: string) => void) => {
  refreshQueue.push(cb);
};

const onTokenRefreshed = (token: string) => {
  refreshQueue.forEach(cb => cb(token));
  refreshQueue = [];
};

api.interceptors.response.use(
  (res) => res,
  async (error) => {
    const original = error.config;
    const status = error.response?.status;

    // 401 에러 발생: token 만료
    if (status === 401 && !original._retry) {
      original._retry = true;

      // 이미 리프레시 중이면 대기
      if (isRefreshing) {
        return new Promise((resolve) => {
          subscribeTokenRefresh((token) => {
            original.headers.Authorization = `Bearer ${token}`;
            resolve(api(original));
          });
        });
      }

      // 리프레시 시작
      isRefreshing = true;

      try {
        // refresh 요청 (한 번만 실행)
        if (!refreshPromise) {
          refreshPromise = (async () => {
            const res = await api.post("/auth/refresh/");
            const newToken = res.data.access;
            localStorage.setItem("accessToken", newToken);
            if (res.data.refresh) {
              localStorage.setItem("refreshToken", res.data.refresh);
            }
            return newToken;
          })();
        }

        const newToken = await refreshPromise;
        onTokenRefreshed(newToken);

        // 원래 요청 재시도
        original.headers.Authorization = `Bearer ${newToken}`;
        return api(original);
      } catch {
        localStorage.clear();
        window.location.href = "/login";
        return Promise.reject(error);
      } finally {
        isRefreshing = false;
        refreshPromise = null;
      }
    }

    // 403 에러: 권한 없음
    if (status === 403) {
      show403Alert();
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);
