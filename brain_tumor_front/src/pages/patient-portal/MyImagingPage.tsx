/**
 * MyImagingPage - 환자 전용 영상 검사 결과 페이지
 *
 * 핵심 기능:
 * - 본인 영상 검사 목록 조회
 * - 판독문 조회 (모달)
 * - DICOM 뷰어 연결 (PC 권장 안내)
 */
import { useState, useEffect } from 'react';
import ReportModal from './components/ReportModal';
import MobileViewerWarning from './components/MobileViewerWarning';
import '@/assets/style/patient-portal.css';
import { getMyOCS } from '@/services/patient-portal.api';
import type { MyOCSItem } from '@/types/patient-portal';

export default function MyImagingPage() {
  const [studies, setStudies] = useState<MyOCSItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selectedReportId, setSelectedReportId] = useState<number | null>(null);
  const [showViewerWarning, setShowViewerWarning] = useState(false);
  const [pendingStudyId, setPendingStudyId] = useState<number | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchStudies = async () => {
      try {
        setError(null);
        const ocsResult = await getMyOCS({ job_role: 'RIS' });
        setStudies(ocsResult.results || []);
        setTotalCount(ocsResult.count || 0);
      } catch (err) {
        console.error('Failed to fetch imaging studies:', err);
        setError('영상 검사 결과를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchStudies();
  }, []);

  // 판독문 보기
  const handleViewReport = (ocsId: number) => {
    setSelectedReportId(ocsId);
  };

  // DICOM 뷰어 열기 (모바일 경고 표시)
  const handleViewDicom = (ocsId: number) => {
    // 모바일 기기 감지
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);

    if (isMobile) {
      setPendingStudyId(ocsId);
      setShowViewerWarning(true);
    } else {
      openViewer(ocsId);
    }
  };

  // 실제 뷰어 열기
  const openViewer = (ocsId: number) => {
    const viewerUrl = `/ocs/ris/${ocsId}`;
    window.open(viewerUrl, '_blank');
  };

  // 모바일 경고 확인 후 뷰어 열기
  const handleConfirmViewer = () => {
    if (pendingStudyId) {
      openViewer(pendingStudyId);
    }
    setShowViewerWarning(false);
    setPendingStudyId(null);
  };

  if (loading) {
    return (
      <div className="patient-portal-page">
        <div className="loading-state">영상 검사 결과를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-portal-page">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="patient-portal-page">
      <div className="page-header">
        <h1>내 영상 결과</h1>
        <span className="result-count">{totalCount}건</span>
      </div>

      {studies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <div className="empty-text">영상 검사 결과가 없습니다.</div>
        </div>
      ) : (
        <div className="imaging-list">
          {studies.map((study) => (
            <div key={study.id} className="imaging-card">
              <div className="imaging-header">
                <div className="imaging-modality">{study.job_type}</div>
                <div className="imaging-date">{study.created_at?.split('T')[0]}</div>
              </div>

              <div className="imaging-body">
                <div className="imaging-info">
                  <div className="info-row">
                    <span className="label">상태</span>
                    <span className={`status-badge status-${study.ocs_status === 'CONFIRMED' ? 'completed' : 'pending'}`}>
                      {study.ocs_status_display}
                    </span>
                  </div>
                  <div className="info-row">
                    <span className="label">담당의</span>
                    <span className="value">{study.doctor_name}</span>
                  </div>
                </div>
              </div>

              <div className="imaging-actions">
                <button
                  className="btn btn-secondary"
                  onClick={() => handleViewReport(study.id)}
                  disabled={study.ocs_status !== 'CONFIRMED'}
                >
                  판독문 보기
                </button>
                <button
                  className="btn btn-primary"
                  onClick={() => handleViewDicom(study.id)}
                >
                  검사 상세
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 판독문 모달 */}
      {selectedReportId && (
        <ReportModal
          reportId={selectedReportId}
          onClose={() => setSelectedReportId(null)}
        />
      )}

      {/* 모바일 뷰어 경고 모달 */}
      {showViewerWarning && (
        <MobileViewerWarning
          onConfirm={handleConfirmViewer}
          onCancel={() => {
            setShowViewerWarning(false);
            setPendingStudyId(null);
          }}
        />
      )}
    </div>
  );
}
