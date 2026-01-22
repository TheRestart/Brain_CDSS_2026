import { useState, useEffect } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import { getOCSList } from '@/services/ocs.api';
import type { OCSListItem, OCSSearchParams, OcsStatus } from '@/types/ocs';
// OCS_STATUS_LABELS removed - not used in this file
import LabListTable from './LabListTable';
import Pagination from '@/layout/Pagination';
import '@/assets/style/encounterListView.css';
import '@/assets/style/summaryCard.css';

// 검사 유형 정의
type LabTestType = 'BLOOD' | 'GENETIC' | 'PROTEIN' | 'URINE' | 'CSF' | 'BIOPSY' | '';

export default function LabListPage() {
  const { role } = useAuth();

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [labOrders, setLabOrders] = useState<OCSListItem[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [testTypeFilter, setTestTypeFilter] = useState<LabTestType>('');
  const [statusFilter, setStatusFilter] = useState<OcsStatus | ''>('');

  // Fetch lab orders (LIS type OCS)
  const fetchLabOrders = async () => {
    setLoading(true);
    try {
      const params: OCSSearchParams = {
        job_role: 'LIS',
        page,
        page_size: pageSize,
        ...(searchQuery && { q: searchQuery }),
        ...(statusFilter && { ocs_status: statusFilter }),
      };

      console.log('Fetching lab orders with params:', params);
      const response = await getOCSList(params);
      console.log('Lab orders response:', response);

      // Filter by test type if selected
      let results = response.results || [];
      if (testTypeFilter) {
        results = results.filter(item =>
          item.job_type.toUpperCase().includes(testTypeFilter)
        );
      }

      setLabOrders(results);
      setTotalCount(response.count || 0);
    } catch (error: any) {
      console.error('Failed to fetch lab orders:', error);
      console.error('Error details:', error.response?.data);
      alert(`검사 목록을 불러오는데 실패했습니다.\n${error.response?.data?.detail || error.message || '알 수 없는 오류'}`);
      setLabOrders([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLabOrders();
  }, [page, searchQuery, testTypeFilter, statusFilter]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchLabOrders();
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setTestTypeFilter('');
    setStatusFilter('');
    setPage(1);
  };

  // 상태별 통계 계산
  const getStatusCount = (status: OcsStatus) => {
    return labOrders.filter(order => order.ocs_status === status).length;
  };

  return (
    <div className="page">
      {/* <div className="page-header">
        <h1>검사 결과 조회</h1>
        <p className="subtitle">혈액, 유전자, 단백질, 조직 검사 결과 관리</p>
      </div> */}

      {/* Statistics Summary */}
      <div className="summary-container">
        <div className="summary-card total">
          <div className="label">총 검사</div>
          <div className="count">{totalCount}</div>
        </div>
        <div className="summary-card in-progress">
          <div className="label">진행 중</div>
          <div className="count">{getStatusCount('IN_PROGRESS')}</div>
        </div>
        <div className="summary-card waiting">
          <div className="label">결과 대기</div>
          <div className="count">{getStatusCount('RESULT_READY')}</div>
        </div>
        <div className="summary-card confirmed">
          <div className="label">확정 완료</div>
          <div className="count">{getStatusCount('CONFIRMED')}</div>
        </div>
      </div>
        {/* <div style={{
          display: 'flex',
          gap: '1rem',
          marginBottom: '1rem',
          padding: '1rem',
          background: '#f8f9fa',
          borderRadius: '8px'
        }}>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>총 검사</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#333' }}>{totalCount}</div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>진행 중</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#339af0' }}>
              {getStatusCount('IN_PROGRESS')}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>결과 대기</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff6b6b' }}>
              {getStatusCount('RESULT_READY')}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>확정 완료</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#51cf66' }}>
              {getStatusCount('CONFIRMED')}
            </div>
          </div>
        </div> */}

      <div className="content">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="filter-left">
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="환자명, 환자번호, OCS ID 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ minWidth: '250px' }}
              />
              <button type="submit" className="btn primary">검색</button>
            </form>

            <select
              value={testTypeFilter}
              onChange={(e) => {
                setTestTypeFilter(e.target.value as LabTestType);
                setPage(1);
              }}
            >
              <option value="">전체 검사종류</option>
              <option value="BLOOD">혈액 검사</option>
              <option value="GENETIC">유전자 검사</option>
              <option value="PROTEIN">단백질 검사</option>
              <option value="URINE">소변 검사</option>
              <option value="CSF">뇌척수액 검사</option>
              <option value="BIOPSY">조직 검사</option>
            </select>

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as OcsStatus | '');
                setPage(1);
              }}
            >
              <option value="">전체 상태</option>
              <option value="ORDERED">오더 생성</option>
              <option value="ACCEPTED">접수 완료</option>
              <option value="IN_PROGRESS">진행 중</option>
              <option value="RESULT_READY">결과 대기</option>
              <option value="CONFIRMED">확정 완료</option>
              <option value="CANCELLED">취소됨</option>
            </select>

            <button className="btn" onClick={handleResetFilters}>
              필터 초기화
            </button>
          </div>
        </div>

        <section className='page-header'>
          <span className="subtitle">혈액, 유전자, 단백질, 조직 검사 결과 관리</span>
        </section>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
        ) : (
          <>
            <LabListTable
              role={role || ''}
              labOrders={labOrders}
              onRefresh={fetchLabOrders}
            />

            <Pagination
              currentPage={page}
              totalCount={totalCount}
              pageSize={pageSize}
              onPageChange={setPage}
            />
          </>
        )}
      </div>
    </div>
  );
}
