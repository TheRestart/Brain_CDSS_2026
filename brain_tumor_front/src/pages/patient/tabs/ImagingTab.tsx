/**
 * 영상 탭
 * - 환자의 영상 검사 메타정보 목록 표시
 * - DICOM 영상 조회 버튼
 */
import { useState, useEffect } from 'react';
import { getPatientImagingHistory } from '@/services/imaging.api';
import type { ImagingStudy } from '@/types/imaging';

type Props = {
  role: string;
  patientId?: number;
};

export default function ImagingTab({ role: _role, patientId }: Props) {
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const fetchStudies = async () => {
      try {
        const response = await getPatientImagingHistory(patientId);
        const data = Array.isArray(response) ? response : response?.results || [];
        setStudies(data);
      } catch (err) {
        console.error('Failed to fetch imaging studies:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchStudies();
  }, [patientId]);

  // DICOM Viewer 열기
  const handleViewDicom = (study: ImagingStudy) => {
    if (study.study_uid) {
      // OHIF Viewer 또는 내부 뷰어 페이지로 이동
      const viewerUrl = `/imaging/viewer?studyUid=${study.study_uid}`;
      window.open(viewerUrl, '_blank');
    } else {
      alert('영상 데이터가 없습니다.');
    }
  };

  if (loading) {
    return <div className="loading-state">영상 정보 로딩 중...</div>;
  }

  if (!patientId) {
    return <div className="empty-state">환자 정보를 찾을 수 없습니다.</div>;
  }

  return (
    <div className="imaging-tab">
      <div className="tab-header">
        <h3>영상 검사 이력 ({studies.length}건)</h3>
      </div>

      {studies.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">🖼️</div>
          <div className="empty-text">영상 검사 이력이 없습니다.</div>
        </div>
      ) : (
        <div className="imaging-list">
          {studies.map((study) => (
            <div key={study.id} className="imaging-card">
              <div className="imaging-header">
                <div className="imaging-modality">{study.modality_display || study.modality}</div>
                <div className="imaging-date">{study.ordered_at?.split('T')[0]}</div>
              </div>

              <div className="imaging-body">
                <div className="imaging-info">
                  <div className="info-row">
                    <span className="label">검사 부위</span>
                    <span className="value">{study.body_part || '-'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">처방의</span>
                    <span className="value">{study.ordered_by_name || '-'}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">Series / Images</span>
                    <span className="value">{study.series_count || 0} / {study.instance_count || 0}</span>
                  </div>
                  <div className="info-row">
                    <span className="label">상태</span>
                    <span className={`status-badge status-${study.status}`}>
                      {study.status_display || study.status}
                    </span>
                  </div>
                </div>

                {study.clinical_info && (
                  <div className="clinical-info">
                    <span className="label">임상 정보</span>
                    <p>{study.clinical_info}</p>
                  </div>
                )}
              </div>

              <div className="imaging-actions">
                {study.has_report && (
                  <button className="btn">
                    판독문 보기
                  </button>
                )}
                <button
                  className="btn btn-primary"
                  onClick={() => handleViewDicom(study)}
                  disabled={!study.study_uid && study.status !== 'completed' && study.status !== 'reported'}
                >
                  DICOM 영상 조회
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      <style>{`
        .imaging-tab {
          padding: 16px;
        }
        .tab-header {
          margin-bottom: 16px;
        }
        .tab-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
        }
        .imaging-list {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .imaging-card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .imaging-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          background: var(--bg-secondary, #f5f5f5);
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .imaging-modality {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary, #1976d2);
          background: var(--primary-light, #e3f2fd);
          padding: 4px 12px;
          border-radius: 4px;
        }
        .imaging-date {
          font-size: 14px;
          color: var(--text-secondary, #666);
        }
        .imaging-body {
          padding: 16px;
        }
        .imaging-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
        }
        .info-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }
        .info-row .label {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }
        .info-row .value {
          font-size: 14px;
          color: var(--text-primary, #1a1a1a);
        }
        .clinical-info {
          margin-top: 12px;
          padding-top: 12px;
          border-top: 1px solid var(--border-color, #f0f0f0);
        }
        .clinical-info .label {
          font-size: 12px;
          color: var(--text-secondary, #666);
          display: block;
          margin-bottom: 4px;
        }
        .clinical-info p {
          margin: 0;
          font-size: 14px;
          color: var(--text-primary, #1a1a1a);
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 12px;
          font-weight: 500;
        }
        .status-badge.status-completed,
        .status-badge.status-reported {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .status-badge.status-in_progress {
          background: #fff3e0;
          color: #f57c00;
        }
        .status-badge.status-scheduled,
        .status-badge.status-ordered {
          background: #e3f2fd;
          color: #1976d2;
        }
        .status-badge.status-cancelled {
          background: #fce4ec;
          color: #c62828;
        }
        .imaging-actions {
          padding: 12px 16px;
          border-top: 1px solid var(--border-color, #e0e0e0);
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }
        .imaging-actions .btn {
          padding: 8px 16px;
          font-size: 13px;
        }
        .loading-state,
        .empty-state {
          padding: 60px 40px;
          text-align: center;
          color: var(--text-secondary, #666);
        }
        .empty-icon {
          font-size: 48px;
          margin-bottom: 16px;
        }
        .empty-text {
          font-size: 14px;
        }
      `}</style>
    </div>
  );
}
