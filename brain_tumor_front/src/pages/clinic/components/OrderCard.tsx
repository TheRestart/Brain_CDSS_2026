/**
 * OCS 오더 목록 카드
 * - 환자의 검사 오더 목록 표시
 * - GET /api/ocs/by_patient/ 사용
 */
import { useState, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import type { OCSListItem } from '@/types/ocs';

interface OrderCardProps {
  patientId: number;
  ocsList: OCSListItem[];
  onOrderCreated: () => void;
}

// 상태 표시 텍스트
const STATUS_LABELS: Record<string, string> = {
  ORDERED: '오더됨',
  ACCEPTED: '접수됨',
  IN_PROGRESS: '진행 중',
  RESULT_READY: '결과 대기',
  CONFIRMED: '확정됨',
  CANCELLED: '취소됨',
};

// 작업 역할 표시
const JOB_ROLE_LABELS: Record<string, string> = {
  RIS: '영상',
  LIS: '검사',
};

export default function OrderCard({
  patientId,
  ocsList,
  onOrderCreated: _onOrderCreated,
}: OrderCardProps) {
  const navigate = useNavigate();
  const [filter, setFilter] = useState<'all' | 'RIS' | 'LIS'>('all');

  // 필터링된 목록
  const filteredList = useMemo(() => {
    if (filter === 'all') return ocsList;
    return ocsList.filter((ocs) => ocs.job_role === filter);
  }, [ocsList, filter]);

  // 상태별 카운트
  const statusCounts = useMemo(() => {
    return {
      pending: ocsList.filter((o) =>
        ['ORDERED', 'ACCEPTED', 'IN_PROGRESS'].includes(o.ocs_status)
      ).length,
      completed: ocsList.filter((o) =>
        ['RESULT_READY', 'CONFIRMED'].includes(o.ocs_status)
      ).length,
    };
  }, [ocsList]);

  // 새 오더 생성
  const handleNewOrder = () => {
    navigate(`/ocs/create?patientId=${patientId}`);
  };

  // 오더 상세 보기
  const handleViewOrder = (ocs: OCSListItem) => {
    if (ocs.job_role === 'RIS') {
      navigate(`/ocs/ris/${ocs.id}`);
    } else if (ocs.job_role === 'LIS') {
      navigate(`/ocs/lis/${ocs.id}`);
    }
  };

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">📋</span>
          검사 오더
          <span className="order-counts">
            <span className="pending-count">{statusCounts.pending}</span>
            /
            <span className="completed-count">{statusCounts.completed}</span>
          </span>
        </h3>
        <button className="btn btn-sm btn-primary" onClick={handleNewOrder}>
          + 새 오더
        </button>
      </div>

      {/* 필터 탭 */}
      <div className="order-filter-tabs">
        <button
          className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
          onClick={() => setFilter('all')}
        >
          전체 ({ocsList.length})
        </button>
        <button
          className={`filter-tab ${filter === 'RIS' ? 'active' : ''}`}
          onClick={() => setFilter('RIS')}
        >
          영상 ({ocsList.filter((o) => o.job_role === 'RIS').length})
        </button>
        <button
          className={`filter-tab ${filter === 'LIS' ? 'active' : ''}`}
          onClick={() => setFilter('LIS')}
        >
          검사 ({ocsList.filter((o) => o.job_role === 'LIS').length})
        </button>
      </div>

      <div className="clinic-card-body order-list-body">
        {filteredList.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📝</div>
            <div className="empty-state-text">등록된 오더가 없습니다.</div>
          </div>
        ) : (
          <div className="order-list">
            {filteredList.slice(0, 10).map((ocs) => (
              <div
                key={ocs.id}
                className="list-item order-item"
                onClick={() => handleViewOrder(ocs)}
              >
                <div className="list-item-content">
                  <div className="list-item-title">
                    <span className={`job-role-badge ${ocs.job_role.toLowerCase()}`}>
                      {JOB_ROLE_LABELS[ocs.job_role] || ocs.job_role}
                    </span>
                    {ocs.job_type}
                  </div>
                  <div className="list-item-subtitle">
                    {ocs.ocs_id} | {ocs.created_at?.slice(0, 10)}
                  </div>
                </div>
                <div className="list-item-meta">
                  <span className={`status-badge ${ocs.ocs_status.toLowerCase()}`}>
                    {STATUS_LABELS[ocs.ocs_status] || ocs.ocs_status}
                  </span>
                </div>
              </div>
            ))}
            {filteredList.length > 10 && (
              <div className="more-items">
                +{filteredList.length - 10}개 더 보기
              </div>
            )}
          </div>
        )}
      </div>

      <style>{`
        .order-counts {
          font-size: 12px;
          font-weight: normal;
          color: var(--text-secondary, #666);
          margin-left: 8px;
        }
        .pending-count {
          color: var(--warning, #f57c00);
        }
        .completed-count {
          color: var(--success, #2e7d32);
        }
        .order-filter-tabs {
          display: flex;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .filter-tab {
          flex: 1;
          padding: 8px;
          background: none;
          border: none;
          font-size: 12px;
          cursor: pointer;
          color: var(--text-secondary, #666);
          border-bottom: 2px solid transparent;
          transition: all 0.15s ease;
        }
        .filter-tab.active {
          color: var(--primary, #1976d2);
          border-bottom-color: var(--primary, #1976d2);
        }
        .filter-tab:hover:not(.active) {
          background: var(--bg-secondary, #f5f5f5);
        }
        .order-list-body {
          max-height: 300px;
          overflow-y: auto;
          padding: 0;
        }
        .order-list {
          padding: 0;
        }
        .order-item {
          padding: 10px 16px;
        }
        .job-role-badge {
          display: inline-block;
          padding: 2px 6px;
          border-radius: 4px;
          font-size: 10px;
          font-weight: 600;
          margin-right: 6px;
        }
        .job-role-badge.ris {
          background: #e3f2fd;
          color: #1565c0;
        }
        .job-role-badge.lis {
          background: #f3e5f5;
          color: #7b1fa2;
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
