import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOCSList } from '@/services/ocs.api';
import type { OCSListItem, OcsStatus, OCSSearchParams } from '@/types/ocs';

const STATUS_OPTIONS: { value: OcsStatus | ''; label: string }[] = [
  { value: '', label: '전체 상태' },
  { value: 'ORDERED', label: '오더 생성' },
  { value: 'ACCEPTED', label: '접수 완료' },
  { value: 'IN_PROGRESS', label: '분석 중' },
  { value: 'RESULT_READY', label: '결과 대기' },
  { value: 'CONFIRMED', label: '확정 완료' },
];

type SortField = 'created_at' | 'patient_name' | 'job_type' | 'status';
type SortDirection = 'asc' | 'desc';

export function LISWorklist() {
  const navigate = useNavigate();
  const [ocsList, setOcsList] = useState<OCSListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState<OcsStatus | ''>('');
  const [searchQuery, setSearchQuery] = useState('');
  const [sortField, setSortField] = useState<SortField>('created_at');
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc');

  const fetchWorklist = useCallback(async () => {
    setLoading(true);
    try {
      const params: OCSSearchParams = {
        job_role: 'LIS',
        page: 1,
        page_size: 20,
      };

      if (statusFilter) {
        params.ocs_status = statusFilter;
      }
      if (searchQuery.trim()) {
        params.q = searchQuery.trim();
      }

      const response = await getOCSList(params);
      let data = Array.isArray(response) ? response : response.results || [];

      // 클라이언트 사이드 정렬
      data = sortData(data, sortField, sortDirection);

      setOcsList(data);
    } catch (error) {
      console.error('Failed to fetch LIS worklist:', error);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, searchQuery, sortField, sortDirection]);

  useEffect(() => {
    fetchWorklist();
  }, [fetchWorklist]);

  const sortData = (data: OCSListItem[], field: SortField, direction: SortDirection) => {
    return [...data].sort((a, b) => {
      let compareA: string | number;
      let compareB: string | number;

      switch (field) {
        case 'patient_name':
          compareA = a.patient.name;
          compareB = b.patient.name;
          break;
        case 'job_type':
          compareA = a.job_type;
          compareB = b.job_type;
          break;
        case 'status':
          compareA = a.ocs_status;
          compareB = b.ocs_status;
          break;
        case 'created_at':
        default:
          compareA = new Date(a.created_at).getTime();
          compareB = new Date(b.created_at).getTime();
          break;
      }

      if (typeof compareA === 'string') {
        const result = compareA.localeCompare(compareB as string);
        return direction === 'asc' ? result : -result;
      } else {
        const result = compareA - (compareB as number);
        return direction === 'asc' ? result : -result;
      }
    });
  };

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('desc');
    }
  };

  const handleViewAll = () => {
    navigate('/ocs/lis-worklist');
  };

  const handleRowClick = (ocs: OCSListItem) => {
    navigate(`/patients/${ocs.patient.id}`);
  };

  const handleRefresh = () => {
    fetchWorklist();
  };

  const getStatusBadgeClass = (status: OcsStatus) => {
    const classes: Record<OcsStatus, string> = {
      ORDERED: 'ordered',
      ACCEPTED: 'accepted',
      IN_PROGRESS: 'in_progress',
      RESULT_READY: 'result_ready',
      CONFIRMED: 'confirmed',
      CANCELLED: 'cancelled',
    };
    return classes[status] || '';
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  const getSortIcon = (field: SortField) => {
    if (sortField !== field) return '↕';
    return sortDirection === 'asc' ? '↑' : '↓';
  };

  return (
    <section className="card lis-worklist">
      <header className="card-header">
        <h3>병리 작업 목록</h3>
        <div className="header-actions">
          <button className="btn-icon" onClick={handleRefresh} title="새로고침">
            ↻
          </button>
          <button className="btn-link" onClick={handleViewAll}>
            전체 보기 →
          </button>
        </div>
      </header>

      {/* 필터 영역 */}
      <div className="worklist-filters">
        <div className="filter-group">
          <input
            type="text"
            className="search-input"
            placeholder="환자명, 검사유형 검색..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <select
            className="filter-select"
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value as OcsStatus | '')}
          >
            {STATUS_OPTIONS.map(opt => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
        </div>
      </div>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : ocsList.length === 0 ? (
        <div className="empty-state">
          {searchQuery || statusFilter
            ? '검색 결과가 없습니다.'
            : '병리 대기 목록이 없습니다.'}
        </div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th className="sortable" onClick={() => handleSort('patient_name')}>
                환자 {getSortIcon('patient_name')}
              </th>
              <th className="sortable" onClick={() => handleSort('job_type')}>
                검사 {getSortIcon('job_type')}
              </th>
              <th className="sortable" onClick={() => handleSort('status')}>
                상태 {getSortIcon('status')}
              </th>
              <th className="sortable" onClick={() => handleSort('created_at')}>
                접수시간 {getSortIcon('created_at')}
              </th>
            </tr>
          </thead>
          <tbody>
            {ocsList.map((ocs) => (
              <tr
                key={ocs.id}
                className="clickable"
                onClick={() => handleRowClick(ocs)}
              >
                <td>
                  <span className="patient-name">{ocs.patient.name}</span>
                  {ocs.priority === 'urgent' && (
                    <span className="badge badge-danger" style={{ marginLeft: '4px', fontSize: '10px' }}>긴급</span>
                  )}
                </td>
                <td>{ocs.job_type}</td>
                <td>
                  <span className={`badge ${getStatusBadgeClass(ocs.ocs_status)}`}>
                    {ocs.ocs_status_display}
                  </span>
                </td>
                <td>{formatTime(ocs.created_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </section>
  );
}
