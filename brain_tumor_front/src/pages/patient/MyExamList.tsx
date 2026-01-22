import { useState, useEffect } from 'react';
import { getMyOCS } from '@/services/patient-portal.api';
import type { MyOCSItem, MyOCSListResponse } from '@/types/patient-portal';
import './MyCarePage.css';

type JobRoleFilter = 'ALL' | 'RIS' | 'LIS';

export default function MyExamList() {
  const [data, setData] = useState<MyOCSListResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<JobRoleFilter>('ALL');
  const [page, setPage] = useState(1);

  const pageSize = 10;

  useEffect(() => {
    fetchData();
  }, [filter, page]);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const params: { job_role?: 'RIS' | 'LIS'; page: number; page_size: number } = {
        page,
        page_size: pageSize,
      };
      if (filter !== 'ALL') {
        params.job_role = filter;
      }
      const result = await getMyOCS(params);
      setData(result);
    } catch (err) {
      console.error('Failed to fetch exam list:', err);
      setError('검사 결과를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleFilterChange = (newFilter: JobRoleFilter) => {
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

  const getJobRoleLabel = (jobRole: string) => {
    switch (jobRole) {
      case 'RIS': return '영상검사';
      case 'LIS': return '병리검사';
      default: return jobRole;
    }
  };

  const getJobRoleBadgeClass = (jobRole: string) => {
    switch (jobRole) {
      case 'RIS': return 'badge-ris';
      case 'LIS': return 'badge-lis';
      default: return '';
    }
  };

  return (
    <div className="my-exam-list">
      <div className="section-header">
        <h2>내 검사 결과</h2>
        <div className="filter-tabs">
          <button
            className={`filter-tab ${filter === 'ALL' ? 'active' : ''}`}
            onClick={() => handleFilterChange('ALL')}
          >
            전체
          </button>
          <button
            className={`filter-tab ${filter === 'RIS' ? 'active' : ''}`}
            onClick={() => handleFilterChange('RIS')}
          >
            영상검사
          </button>
          <button
            className={`filter-tab ${filter === 'LIS' ? 'active' : ''}`}
            onClick={() => handleFilterChange('LIS')}
          >
            병리검사
          </button>
        </div>
      </div>

      {loading ? (
        <div className="loading-state">검사 결과를 불러오는 중...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : !data || data.results.length === 0 ? (
        <div className="empty-state">
          <p>확정된 검사 결과가 없습니다.</p>
        </div>
      ) : (
        <>
          <div className="exam-table-wrapper">
            <table className="exam-table">
              <thead>
                <tr>
                  <th>검사일</th>
                  <th>검사종류</th>
                  <th>검사항목</th>
                  <th>담당의</th>
                  <th>확정일</th>
                </tr>
              </thead>
              <tbody>
                {data.results.map((item: MyOCSItem) => (
                  <tr key={item.id}>
                    <td>{formatDate(item.created_at)}</td>
                    <td>
                      <span className={`badge ${getJobRoleBadgeClass(item.job_role)}`}>
                        {getJobRoleLabel(item.job_role)}
                      </span>
                    </td>
                    <td>{item.job_type}</td>
                    <td>{item.doctor_name}</td>
                    <td>{formatDate(item.confirmed_at)}</td>
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
