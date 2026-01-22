import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import path from 'path'
import fs from 'fs'

// WSL 환경에서 dist 폴더 생성 문제 해결용 플러그인
const ensureDistDir = () => ({
  name: 'ensure-dist-dir',
  config() {
    // config 훅은 Vite 설정 단계에서 실행되어 prepareOutDir보다 먼저 실행됨
    const distPath = path.resolve(__dirname, 'dist')
    if (!fs.existsSync(distPath)) {
      fs.mkdirSync(distPath, { recursive: true })
    }
  }
})

// https://vite.dev/config/
export default defineConfig({
  plugins: [ensureDistDir(), react()],
  resolve : {
    alias : {
      '@' : path.resolve(__dirname, 'src'), // @를 src 폴더로 mapping 해줌
    },
  },
  // vite.config.ts
  server: {
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        timeout: 60000,
        configure: (proxy) => {
          proxy.on('error', (err, req, _res) => {
            console.error('[Vite Proxy Error]', err.message, req.url);
          });
          proxy.on('proxyReq', (_proxyReq, req) => {
            console.log('[Proxy Request]', req.method, req.url);
          });
        },
      },
      '/ws': {
        target: 'ws://localhost:8000',
        ws: true,
      },
    },
  },
  build: {
    rollupOptions: {
      output: {
        manualChunks: {
          // 벤더 라이브러리 분리
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // 대형 라이브러리 분리
          sweetalert: ['sweetalert2'],
          query: ['@tanstack/react-query'],
        }
      }
    }
  }
})
