/**
 * ReportModal - 판독문 조회 모달
 *
 * 표시 내용:
 * - 검사명, 검사일
 * - 판독의, 판독일
 * - 소견 (Findings)
 * - 결론 (Conclusion)
 * - PDF 다운로드 버튼
 */
import { useState, useEffect } from 'react';
import '@/assets/style/patient-portal.css';

interface ReportData {
  id: number;
  studyName: string;
  studyDate: string;
  radiologist: string;
  reportDate: string;
  findings: string;
  conclusion: string;
}

interface ReportModalProps {
  reportId: number;
  onClose: () => void;
}

export default function ReportModal({ reportId, onClose }: ReportModalProps) {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchReport = async () => {
      try {
        // TODO: API 연동 - 실제 API: /api/imaging/reports/{reportId}/
        // 현재는 더미 데이터
        setReport({
          id: reportId,
          studyName: 'CT Brain without contrast',
          studyDate: '2026-01-10',
          radiologist: '박민수',
          reportDate: '2026-01-10',
          findings: `Brain parenchyma shows no abnormal lesion.
No evidence of acute infarction or hemorrhage.
Ventricles and sulci are within normal limits.
No midline shift.
Paranasal sinuses and mastoid air cells are clear.`,
          conclusion: '정상 소견입니다. 특이 병변 없음.',
        });
      } catch (err) {
        console.error('Failed to fetch report:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [reportId]);

  // PDF 다운로드
  const handleDownloadPdf = () => {
    // TODO: 실제 PDF 다운로드 구현
    alert('PDF 다운로드 기능은 준비 중입니다.');
  };

  // 모달 외부 클릭 시 닫기
  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content report-modal">
        <div className="modal-header">
          <h2>판독문</h2>
          <button className="close-btn" onClick={onClose}>×</button>
        </div>

        {loading ? (
          <div className="modal-body">
            <div className="loading-state">판독문을 불러오는 중...</div>
          </div>
        ) : report ? (
          <>
            <div className="modal-body">
              {/* 검사 정보 */}
              <div className="report-info">
                <div className="info-row">
                  <span className="label">검사명</span>
                  <span className="value">{report.studyName}</span>
                </div>
                <div className="info-row">
                  <span className="label">검사일</span>
                  <span className="value">{report.studyDate}</span>
                </div>
                <div className="info-row">
                  <span className="label">판독의</span>
                  <span className="value">{report.radiologist}</span>
                </div>
                <div className="info-row">
                  <span className="label">판독일</span>
                  <span className="value">{report.reportDate}</span>
                </div>
              </div>

              <hr className="divider" />

              {/* 소견 */}
              <div className="report-section">
                <h3>소견 (Findings)</h3>
                <pre className="report-text">{report.findings}</pre>
              </div>

              {/* 결론 */}
              <div className="report-section">
                <h3>결론 (Conclusion)</h3>
                <p className="report-conclusion">{report.conclusion}</p>
              </div>
            </div>

            <div className="modal-footer">
              <button className="btn btn-secondary" onClick={onClose}>
                닫기
              </button>
              <button className="btn btn-primary" onClick={handleDownloadPdf}>
                PDF 다운로드
              </button>
            </div>
          </>
        ) : (
          <div className="modal-body">
            <div className="error-state">판독문을 불러올 수 없습니다.</div>
          </div>
        )}
      </div>
    </div>
  );
}
