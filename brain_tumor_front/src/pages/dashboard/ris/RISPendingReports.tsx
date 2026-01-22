import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getImagingStudies } from '@/services/imaging.api';
import type { ImagingStudy } from '@/types/imaging';

export function RISPendingReports() {
  const navigate = useNavigate();
  const [pendingStudies, setPendingStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchPendingReports();
  }, []);

  const fetchPendingReports = async () => {
    setLoading(true);
    try {
      // 판독 대기 (검사 완료되었지만 판독문 없음)
      const response = await getImagingStudies({
        status: 'completed',
        has_report: false,
        page: 1,
        page_size: 5,
      });
      const data = Array.isArray(response) ? response : response.results || [];
      setPendingStudies(data);
    } catch (error) {
      console.error('Failed to fetch pending reports:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleViewStudy = (studyId: number) => {
    navigate(`/imaging/studies?id=${studyId}`);
  };

  const getDaysAgo = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffTime = Math.abs(now.getTime() - date.getTime());
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    return diffDays === 0 ? '오늘' : `${diffDays}일 전`;
  };

  return (
    <section className="pending-reports-panel">
      <div className="panel-header">
        <h3>판독 대기 목록</h3>
        <span className="badge badge-warning">{pendingStudies.length}</span>
      </div>

      <div className="pending-list">
        {loading ? (
          <div className="loading">로딩 중...</div>
        ) : pendingStudies.length === 0 ? (
          <div className="empty-state">
            판독 대기 중인 검사가 없습니다.
          </div>
        ) : (
          <ul>
            {pendingStudies.map((study) => (
              <li
                key={study.id}
                className="pending-item"
                onClick={() => handleViewStudy(study.id)}
              >
                <div className="pending-item-header">
                  <span className="patient-name">{study.patient_name}</span>
                  <span className={`badge badge-${study.modality === 'MRI' ? 'success' : 'primary'}`}>
                    {study.modality}
                  </span>
                </div>
                <div className="pending-item-body">
                  <span className="body-part">{study.body_part}</span>
                  {study.clinical_info && (
                    <span className="clinical-info">{study.clinical_info}</span>
                  )}
                </div>
                <div className="pending-item-footer">
                  <span className="performed-date">
                    검사 완료: {study.performed_at ? getDaysAgo(study.performed_at) : '-'}
                  </span>
                  {study.special_instruction?.includes('응급') && (
                    <span className="badge badge-danger">응급</span>
                  )}
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </section>
  );
}
