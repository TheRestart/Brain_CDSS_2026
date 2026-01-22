/**
 * MobileViewerWarning - 모바일에서 DICOM 뷰어 열기 전 경고 모달
 *
 * 모바일 기기에서 DICOM 뷰어 성능 이슈 안내
 */
import '@/assets/style/patient-portal.css';

interface MobileViewerWarningProps {
  onConfirm: () => void;
  onCancel: () => void;
}

export default function MobileViewerWarning({ onConfirm, onCancel }: MobileViewerWarningProps) {
  // 모달 외부 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onCancel();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content warning-modal">
        <div className="warning-icon">⚠️</div>

        <h2>안내</h2>

        <div className="warning-message">
          <p>
            DICOM 영상은 <strong>PC 브라우저</strong>에서<br />
            조회하시는 것을 권장합니다.
          </p>
          <p className="sub-message">
            모바일에서는 영상 로딩이 느리거나<br />
            화면이 작아 상세 확인이 어려울 수 있습니다.
          </p>
        </div>

        <div className="warning-actions">
          <button className="btn btn-secondary" onClick={onCancel}>
            취소
          </button>
          <button className="btn btn-primary" onClick={onConfirm}>
            그래도 열기
          </button>
        </div>
      </div>
    </div>
  );
}
