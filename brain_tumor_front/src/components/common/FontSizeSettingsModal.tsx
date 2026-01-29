import { useFontSize, type FontSizeScale, FONT_SIZE_LABELS } from '@/context/FontSizeContext';
import './FontSizeSettingsModal.css';

interface Props {
  isOpen: boolean;
  onClose: () => void;
}

export default function FontSizeSettingsModal({ isOpen, onClose }: Props) {
  const { fontSize, setFontSize } = useFontSize();

  if (!isOpen) return null;

  const sizes: FontSizeScale[] = ['small', 'medium', 'large', 'xlarge'];

  return (
    <div className="settings-modal-overlay" onClick={onClose}>
      <div className="settings-modal" onClick={(e) => e.stopPropagation()}>
        <div className="settings-modal-header">
          <h3>
            <i className="fa-solid fa-gear"></i>
            화면 설정
          </h3>
          <button className="btn-close" onClick={onClose}>
            <i className="fa-solid fa-xmark"></i>
          </button>
        </div>

        <div className="settings-modal-body">
          <div className="settings-section">
            <label className="settings-label">
              <i className="fa-solid fa-font"></i>
              글자 크기
            </label>
            <div className="font-size-options">
              {sizes.map((size) => (
                <button
                  key={size}
                  className={`font-size-option ${fontSize === size ? 'active' : ''}`}
                  onClick={() => setFontSize(size)}
                >
                  <span className={`font-size-preview font-size-${size}`}>가</span>
                  <span className="font-size-label">{FONT_SIZE_LABELS[size]}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="settings-preview">
            <p className="preview-title">미리보기</p>
            <div className="preview-content">
              <p>환자명: 홍길동</p>
              <p>진단명: 뇌종양 (Brain Tumor)</p>
              <p className="preview-small">등록일: 2024-01-15</p>
            </div>
          </div>
        </div>

        <div className="settings-modal-footer">
          <button className="btn" onClick={onClose}>
            닫기
          </button>
        </div>
      </div>
    </div>
  );
}
