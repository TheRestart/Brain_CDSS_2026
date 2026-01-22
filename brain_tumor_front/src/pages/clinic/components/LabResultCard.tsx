/**
 * 검사 결과 카드
 * - 환자의 LIS 검사 결과 목록
 * - GET /api/ocs/?job_role=LIS 필터링 사용
 */
import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OCSListItem } from '@/types/ocs';

interface LabResultCardProps {
  patientId: number;
  lisResults: OCSListItem[];
}

// 검사 유형 라벨
const JOB_TYPE_LABELS: Record<string, string> = {
  BLOOD: '혈액검사',
  URINE: '소변검사',
  GENETIC: '유전자검사',
  PROTEIN: '단백질검사',
  PATHOLOGY: '병리검사',
};

// 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  ORDERED: '오더됨',
  ACCEPTED: '접수됨',
  IN_PROGRESS: '진행 중',
  RESULT_READY: '결과 대기',
  CONFIRMED: '확정됨',
  CANCELLED: '취소됨',
};

export default function LabResultCard({
  patientId,
  lisResults,
}: LabResultCardProps) {
  const navigate = useNavigate();

  // 최근 확정된 결과 우선 정렬
  const sortedResults = useMemo(() => {
    return [...lisResults].sort((a, b) => {
      // 확정된 결과 우선
      if (a.ocs_status === 'CONFIRMED' && b.ocs_status !== 'CONFIRMED') return -1;
      if (b.ocs_status === 'CONFIRMED' && a.ocs_status !== 'CONFIRMED') return 1;
      // 날짜순
      return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
    });
  }, [lisResults]);

  // 결과 상세 보기
  const handleViewResult = (ocs: OCSListItem) => {
    navigate(`/ocs/lis/${ocs.id}`);
  };

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">🔬</span>
          검사 결과
          <span className="result-count">({lisResults.length})</span>
        </h3>
      </div>
      <div className="clinic-card-body lab-result-body">
        {sortedResults.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">🧪</div>
            <div className="empty-state-text">검사 결과가 없습니다.</div>
          </div>
        ) : (
          <div className="result-list">
            {sortedResults.slice(0, 8).map((result) => (
              <div
                key={result.id}
                className="list-item result-item"
                onClick={() => handleViewResult(result)}
              >
                <div className="list-item-content">
                  <div className="list-item-title">
                    {JOB_TYPE_LABELS[result.job_type] || result.job_type}
                  </div>
                  <div className="list-item-subtitle">
                    {result.ocs_id} | {result.created_at?.slice(0, 10)}
                  </div>
                </div>
                <div className="list-item-meta">
                  <span className={`status-badge ${result.ocs_status.toLowerCase()}`}>
                    {STATUS_LABELS[result.ocs_status] || result.ocs_status}
                  </span>
                </div>
              </div>
            ))}
            {sortedResults.length > 8 && (
              <div className="more-items" onClick={() => navigate(`/lab?patientId=${patientId}`)}>
                +{sortedResults.length - 8}개 더 보기
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .result-count {
          font-size: 12px;
          font-weight: normal;
          color: var(--text-secondary, #666);
          margin-left: 4px;
        }
        .lab-result-body {
          max-height: 280px;
          overflow-y: auto;
          padding: 0;
        }
        .result-list {
          padding: 0;
        }
        .result-item {
          padding: 10px 16px;
        }
        .more-items {
          padding: 12px;
          text-align: center;
          font-size: 12px;
          color: var(--primary, #1976d2);
          cursor: pointer;
        }
        .more-items:hover {
          background: var(--bg-secondary, #f5f5f5);
        }
      `}</style>
    </div>
  );
}
