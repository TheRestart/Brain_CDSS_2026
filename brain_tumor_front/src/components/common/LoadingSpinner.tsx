/**
 * 로딩 스피너 컴포넌트
 */
import './LoadingSpinner.css';

interface LoadingSpinnerProps {
  size?: 'small' | 'medium' | 'large';
  text?: string;
  fullPage?: boolean;
}

export default function LoadingSpinner({
  size = 'medium',
  text = '로딩 중...',
  fullPage = false,
}: LoadingSpinnerProps) {
  const spinner = (
    <div className={`loading-spinner-container ${fullPage ? 'full-page' : ''}`}>
      <div className={`loading-spinner spinner-${size}`}>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
        <div className="spinner-ring"></div>
      </div>
      {text && <span className="loading-text">{text}</span>}
    </div>
  );

  return spinner;
}
