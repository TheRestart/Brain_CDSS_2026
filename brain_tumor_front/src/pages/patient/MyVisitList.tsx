import { useState, useEffect } from 'react';
import { getMyEncounters } from '@/services/patient-portal.api';
import type { MyEncounter, MyEncounterListResponse } from '@/types/patient-portal';
import './MyCarePage.css';

type StatusFilter = 'ALL' | 'scheduled' | 'completed' | 'cancelled';

export default function MyVisitList() {
  const [data, setData] = useState<MyEncounterListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);

  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, [filter, page]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: {
        status?: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
        page: number;
        page_size: number;
      } = {
        page,
        page_size: pageSize,
      };
      if (filter !== 'ALL') {
        params.status = filter;
      }
      const result = await getMyEncounters(params);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch visit list:', err);
      setError('방문 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter: StatusFilter) => {
    setFilter(newFilter);
    setPage(1);
  };

  const totalPages = data ? Math.ceil(data.count / pageSize) : 0;

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled': return 'badge-scheduled';
      case 'in_progress': return 'badge-in-progress';
      case 'completed': return 'badge-completed';
      case 'cancelled': return 'badge-cancelled';
      default: return '';
    }
  };

  const getEncounterTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'outpatient': return 'badge-outpatient';
      case 'inpatient': return 'badge-inpatient';
      case 'emergency': return 'badge-emergency';
      default: return '';
    }
  };

  return (
    <div className="my-visit-list">
      <div className="section-header">
        <h2>방문 기록</h2>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => handleFilterChange('ALL')}
          >
            전체
          </button>
          <button
            className={`filter-tab ${filter === 'scheduled' ? 'active' : ''}`}
            onClick={() => handleFilterChange('scheduled')}
          >
            예약
          </button>
          <button
            className={`filter-tab ${filter === 'completed' ? 'active' : ''}`}
            onClick={() => handleFilterChange('completed')}
          >
            완료
          </button>
          <button
            className={`filter-tab ${filter === 'cancelled' ? 'active' : ''}`}
            onClick={() => handleFilterChange('cancelled')}
          >
            취소
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">방문 기록을 불러오는 중...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : !data || data.results.length === 0 ? (
        <div className="empty-state">
          <p>방문 기록이 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="visit-table-wrapper">
            <table className="visit-table">
              <thead>
                <tr>
                  <th>진료일</th>
                  <th>진료유형</th>
                  <th>상태</th>
                  <th>진료과</th>
                  <th>담당의</th>
                  <th>주호소</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((item: MyEncounter) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.admission_date)}</td>
                    <td>
                      <span className={`badge ${getEncounterTypeBadgeClass(item.encounter_type)}`}>
                        {item.encounter_type_display}
                      </span>
                    </td>
                    <td>
                      <span className={`badge ${getStatusBadgeClass(item.status)}`}>
                        {item.status_display}
                      </span>
                    </td>
                    <td>{item.department_display || '-'}</td>
                    <td>{item.attending_doctor_name}</td>
                    <td>{item.chief_complaint || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {totalPages > 1 && (
            <div className="pagination">
              <button
                className="page-btn"
                disabled={page === 1}
                onClick={() => setPage(page - 1)}
              >
                이전
              </button>
              <span className="page-info">
                {page} / {totalPages}
              </span>
              <button
                className="page-btn"
                disabled={page >= totalPages}
                onClick={() => setPage(page + 1)}
              >
                다음
              </button>
            </div>
          )}

          <div className="total-count">총 {data.count}건</div>
        </>
      )}
    </div>
  );
}
