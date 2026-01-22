import ReactDom from 'react-dom/client';
import {QueryClient, QueryClientProvider} from '@tanstack/react-query';
import { BrowserRouter } from 'react-router-dom';
import App from './app/App';
import { AuthProvider } from '@/pages/auth/AuthProvider';
import { ThumbnailCacheProvider } from '@/context/ThumbnailCacheContext';
import '@/assets/style/variables.css'; // CSS 변수
import '@/assets/style/common.css'; // 공통 컴포넌트 스타일 (버튼, 폼, 모달 등)
import '@/assets/style/cdssCommonStyle.css'; // CDSS 레이아웃 스타일
import '@/assets/style/layout.css'; // 레이아웃 스타일 적용
import '@fortawesome/fontawesome-free/css/all.min.css'; // FontAwesome 아이콘 스타일
import '@/assets/style/commingSoon.css';
import '@/assets/style/dashboard.css';

// React Query 세팅
const queryClient = new QueryClient();

ReactDom.createRoot(document.getElementById('root')!).render(
  // <React.StrictMode> // 실시간 기능으로 인해 주석처리
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ThumbnailCacheProvider>
          <BrowserRouter>
            <App/>
          </BrowserRouter>
        </ThumbnailCacheProvider>
      </AuthProvider>
    </QueryClientProvider>
  // </React.StrictMode>
);