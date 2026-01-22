// src/api/http.js
import axios from "axios";

export const http = axios.create({
  baseURL: import.meta.env.VITE_API_BASE_URL || "http://127.0.0.1:8000/api",
  timeout: 60000,
  withCredentials: true,
});

// 요청 인터셉터 - JWT 토큰 추가
http.interceptors.request.use((config) => {
  const token = localStorage.getItem("accessToken");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// 응답 인터셉터 - 에러 처리
http.interceptors.response.use(
  (res) => res,
  (err) => {
    // 401 에러 시 로그인 페이지로 리다이렉트
    if (err.response?.status === 401) {
      console.warn("Orthanc API: Unauthorized - token may be expired");
    }
    return Promise.reject(err);
  }
);
