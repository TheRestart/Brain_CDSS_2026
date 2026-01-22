/**
 * DicomViewerPopup - DICOM 영상 조회 팝업
 * RISStudyDetailPage에서 '영상 조회' 버튼 클릭 시 세로 팝업으로 표시
 * - 스플리터로 좌측(입력)/우측(뷰어) 비율 조정 가능
 * - 다중 뷰어 지원 (각각 독립적인 시리즈 선택)
 */
import { useState, useCallback, useRef, useEffect } from 'react';
import UploadSection from './UploadSection';
import PacsSelector from './PacsSelector';
import ViewerSection from './ViewerSection';
import './DicomViewerPopup.css';

interface Selection {
  patientId?: string;
  studyId?: string;
  studyInstanceUID?: string;
  baseSeriesId?: string;
  baseSeriesName?: string;
  overlaySeriesId?: string;
  overlaySeriesName?: string;
}

interface OcsPatientInfo {
  ocsId: number;
  patientNumber: string;
  patientName: string;
}

// 기존 업로드된 Study 정보 (worker_result.orthanc에서 추출)
export interface ExistingStudyInfo {
  orthanc_study_id: string;
  study_uid: string;
  patient_id: string;
  series_count: number;
  instance_count: number;
  uploaded_at: string;
}

// 업로드 결과 정보 (Orthanc 응답)
export interface UploadResult {
  patientId: string;
  studyUid: string;
  studyId: string;               // DICOM StudyID (UUID)
  orthancStudyId: string | null; // Orthanc Internal Study ID (for API calls)
  studyDescription: string;
  ocsId: number | null;
  uploaded: number;
  failedFiles: string[];
  orthancSeriesIds: string[];
}

interface DicomViewerPopupProps {
  open: boolean;
  onClose: () => void;
  ocsInfo?: OcsPatientInfo;
  existingStudy?: ExistingStudyInfo;  // 기존 업로드된 Study 정보
  onUploadComplete?: (result: UploadResult) => void;  // 업로드 완료 콜백
  onStudyDeleted?: () => void;  // 기존 Study 삭제 완료 콜백
  isMyWork?: boolean;  // 본인 담당 오더 여부
  workerName?: string;  // 담당자 이름 (본인이 아닐 때 표시)
}

// 뷰어 인스턴스 타입
interface ViewerInstance {
  id: number;
  selection: Selection;
}

export default function DicomViewerPopup({ open, onClose, ocsInfo, existingStudy, onUploadComplete, onStudyDeleted, isMyWork = true, workerName }: DicomViewerPopupProps) {
  const [refreshKey, setRefreshKey] = useState(0);

  // 스플리터 상태
  const [leftWidth, setLeftWidth] = useState(360);
  const [isDragging, setIsDragging] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // 다중 뷰어 상태
  const [viewers, setViewers] = useState<ViewerInstance[]>([
    { id: 1, selection: {} }
  ]);
  const [activeViewerId, setActiveViewerId] = useState(1);
  const nextViewerIdRef = useRef(2);

  // 모든 뷰어 동시 Play 상태
  const [allPlaying, setAllPlaying] = useState(false);

  // 모든 뷰어 인스턴스=0 리셋용 키 (값 변경 시 리셋 트리거)
  const [resetKey, setResetKey] = useState(0);

  const onUploaded = useCallback(async (result?: UploadResult) => {
    setRefreshKey((k) => k + 1);
    // 업로드 완료 시 부모 컴포넌트에 알림
    if (result && onUploadComplete) {
      onUploadComplete(result);
    }
  }, [onUploadComplete]);

  // 활성 뷰어의 selection 업데이트
  const handleSelectionChange = useCallback((newSelection: Selection) => {
    setViewers(prev => prev.map(v =>
      v.id === activeViewerId ? { ...v, selection: newSelection } : v
    ));
  }, [activeViewerId]);

  // 뷰어 추가
  const addViewer = useCallback(() => {
    if (viewers.length >= 4) return; // 최대 4개
    const newId = nextViewerIdRef.current++;
    setViewers(prev => [...prev, { id: newId, selection: {} }]);
    setActiveViewerId(newId);
  }, [viewers.length]);

  // 뷰어 제거
  const removeViewer = useCallback((id: number) => {
    if (viewers.length <= 1) return; // 최소 1개 유지
    setViewers(prev => prev.filter(v => v.id !== id));
    if (activeViewerId === id) {
      setActiveViewerId(viewers.find(v => v.id !== id)?.id || 1);
    }
  }, [viewers, activeViewerId]);

  // 스플리터 드래그 핸들러
  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  useEffect(() => {
    if (!isDragging) return;

    const handleMouseMove = (e: MouseEvent) => {
      if (!containerRef.current) return;
      const containerRect = containerRef.current.getBoundingClientRect();
      const newWidth = e.clientX - containerRect.left - 16; // padding 보정
      // 최소 200px, 최대 600px
      setLeftWidth(Math.max(200, Math.min(600, newWidth)));
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging]);

  // 활성 뷰어 가져오기
  const activeViewer = viewers.find(v => v.id === activeViewerId);

  if (!open) return null;

  return (
    <div className="dicom-popup-overlay" onClick={onClose}>
      <div
        className="dicom-popup-container"
        onClick={(e) => e.stopPropagation()}
        ref={containerRef}
      >
        {/* 헤더 */}
        <header className="dicom-popup-header">
          <h2>DICOM 영상 조회</h2>
          <div className="header-controls">
            {/* 뷰어 탭 */}
            <div className="viewer-tabs">
              {viewers.map((v, idx) => (
                <button
                  key={v.id}
                  className={`viewer-tab ${v.id === activeViewerId ? 'active' : ''}`}
                  onClick={() => setActiveViewerId(v.id)}
                >
                  V{idx + 1}
                  {viewers.length > 1 && (
                    <span
                      className="tab-close"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeViewer(v.id);
                      }}
                    >
                      ×
                    </span>
                  )}
                </button>
              ))}
              {viewers.length < 4 && (
                <button className="viewer-tab add-tab" onClick={addViewer} title="뷰어 추가">
                  +
                </button>
              )}
            </div>
            {/* All Play 버튼 */}
            <button
              className={`all-play-btn ${allPlaying ? 'playing' : ''}`}
              onClick={() => setAllPlaying(prev => !prev)}
              title={allPlaying ? '모든 뷰어 정지' : '모든 뷰어 재생'}
            >
              {allPlaying ? '⏹ All Stop' : '▶ All Play'}
            </button>
            {/* Set 버튼: 모든 뷰어 인스턴스=0 */}
            <button
              className="all-set-btn"
              onClick={() => setResetKey(prev => prev + 1)}
              title="모든 뷰어를 인스턴스 0으로 이동"
            >
              ⏮ Set
            </button>
            <button className="dicom-popup-close" onClick={onClose}>
              &times;
            </button>
          </div>
        </header>

        {/* 본문 */}
        <div className={`dicom-popup-body ${isDragging ? 'dragging' : ''}`}>
          <aside
            className="dicom-popup-left"
            style={{ width: leftWidth }}
          >
            <div className="dicom-popup-stack">
              <UploadSection
                onUploaded={onUploaded}
                ocsInfo={ocsInfo}
                existingStudy={existingStudy}
                onStudyDeleted={onStudyDeleted}
                isMyWork={isMyWork}
                workerName={workerName}
              />
              <PacsSelector
                key={`${refreshKey}-${activeViewerId}`}
                onChange={handleSelectionChange}
                ocsInfo={ocsInfo}
                initialSelection={activeViewer?.selection}
              />
            </div>
          </aside>

          {/* 스플리터 핸들 */}
          <div
            className={`splitter-handle ${isDragging ? 'active' : ''}`}
            onMouseDown={handleMouseDown}
          >
            <div className="splitter-line" />
          </div>

          <main className="dicom-popup-right">
            {/* 단일 뷰어 모드 */}
            {viewers.length === 1 ? (
              <ViewerSection
                studyInstanceUID={activeViewer?.selection.studyInstanceUID}
                baseSeriesId={activeViewer?.selection.baseSeriesId}
                baseSeriesName={activeViewer?.selection.baseSeriesName}
                overlaySeriesId={activeViewer?.selection.overlaySeriesId}
                overlaySeriesName={activeViewer?.selection.overlaySeriesName}
                externalPlaying={allPlaying}
                externalResetKey={resetKey}
              />
            ) : (
              /* 다중 뷰어 모드: 그리드 레이아웃 */
              <div className={`viewer-grid grid-${viewers.length}`}>
                {viewers.map((v, idx) => (
                  <div
                    key={v.id}
                    className={`viewer-cell ${v.id === activeViewerId ? 'active' : ''}`}
                    onClick={() => setActiveViewerId(v.id)}
                  >
                    <div className="viewer-cell-header">
                      <span>V{idx + 1}</span>
                      {v.selection.baseSeriesName && (
                        <span className="series-name">{v.selection.baseSeriesName}</span>
                      )}
                    </div>
                    <ViewerSection
                      studyInstanceUID={v.selection.studyInstanceUID}
                      baseSeriesId={v.selection.baseSeriesId}
                      baseSeriesName={v.selection.baseSeriesName}
                      overlaySeriesId={v.selection.overlaySeriesId}
                      overlaySeriesName={v.selection.overlaySeriesName}
                      externalPlaying={allPlaying}
                      externalResetKey={resetKey}
                    />
                  </div>
                ))}
              </div>
            )}
          </main>
        </div>
      </div>
    </div>
  );
}
