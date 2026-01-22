import { useState, useEffect } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import { getImagingWorklist } from '@/services/imaging.api';
import type { ImagingStudy, ImagingStudySearchParams, ImagingModality } from '@/types/imaging';
import ImagingListTable from './ImagingListTable';
import Pagination from '@/layout/Pagination';
import '@/assets/style/encounterListView.css';

export default function ImagingWorklistPage() {
  const { role } = useAuth();

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters
  const [modalityFilter, setModalityFilter] = useState<ImagingModality | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // Fetch worklist
  const fetchWorklist = async () => {
    setLoading(true);
    try {
      const params: ImagingStudySearchParams = {
        page,
        page_size: pageSize,
        ...(searchQuery && { q: searchQuery }),
        ...(modalityFilter && { modality: modalityFilter }),
      };

      console.log('Fetching worklist with params:', params);
      const response = await getImagingWorklist(params);
      console.log('Worklist response:', response);

      if (Array.isArray(response)) {
        setStudies(response);
        setTotalCount(response.length);
      } else {
        setStudies(response.results || []);
        setTotalCount(response.count || 0);
      }
    } catch (error: any) {
      console.error('Failed to fetch worklist:', error);
      alert(`워크리스트를 불러오는데 실패했습니다.\n${error.response?.data?.detail || error.message || '알 수 없는 오류'}`);
      setStudies([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorklist();
  }, [page, searchQuery, modalityFilter]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchWorklist();
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setModalityFilter('');
    setPage(1);
  };

  return (
    <div className="page">
      <div className="page-header">
        <h1>RIS 워크리스트</h1>
        <p className="subtitle">검사 대기 중인 영상 검사 목록 (오더 생성 · 예약 · 수행 중)</p>
      </div>

      <div className="content">
        {/* Filter Bar */}
        <div className="filter-bar">
          <div className="filter-left">
            <form onSubmit={handleSearch} style={{ display: 'flex', gap: '0.5rem' }}>
              <input
                type="text"
                placeholder="환자명, 환자번호 검색"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                style={{ minWidth: '250px' }}
              />
              <button type="submit" className="btn primary">검색</button>
            </form>

            <select
              value={modalityFilter}
              onChange={(e) => {
                setModalityFilter(e.target.value as ImagingModality | '');
                setPage(1);
              }}
            >
              <option value="">전체 검사종류</option>
              <option value="CT">CT</option>
              <option value="MRI">MRI</option>
              <option value="PET">PET</option>
              <option value="X-RAY">X-Ray</option>
            </select>

            <button className="btn" onClick={handleResetFilters}>
              필터 초기화
            </button>
          </div>

          <div className="filter-right">
            <button className="btn" onClick={fetchWorklist} disabled={loading}>
              {loading ? '새로고침 중...' : '새로고침'}
            </button>
          </div>
        </div>

        {/* Statistics Cards */}
        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '1.5rem'
        }}>
          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>전체 대기 검사</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>{totalCount}</div>
          </div>

          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>오더 생성</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
              {studies.filter(s => s.status === 'ordered').length}
            </div>
          </div>

          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #4facfe 0%, #00f2fe 100%)',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>검사 예약</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
              {studies.filter(s => s.status === 'scheduled').length}
            </div>
          </div>

          <div style={{
            padding: '1.5rem',
            background: 'linear-gradient(135deg, #43e97b 0%, #38f9d7 100%)',
            borderRadius: '12px',
            color: 'white',
            boxShadow: '0 4px 6px rgba(0,0,0,0.1)'
          }}>
            <div style={{ fontSize: '0.875rem', opacity: 0.9 }}>수행 중</div>
            <div style={{ fontSize: '2rem', fontWeight: 'bold', marginTop: '0.5rem' }}>
              {studies.filter(s => s.status === 'in_progress').length}
            </div>
          </div>
        </div>

        {/* Priority Notice */}
        {studies.some(s => s.encounter_type === 'emergency') && (
          <div style={{
            padding: '1rem',
            backgroundColor: '#fff3cd',
            border: '1px solid #ffc107',
            borderRadius: '8px',
            marginBottom: '1rem',
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem'
          }}>
            <span style={{ fontSize: '1.5rem' }}>⚠️</span>
            <div>
              <strong>응급 검사 포함:</strong>
              <span style={{ marginLeft: '0.5rem' }}>
                {studies.filter(s => s.encounter_type === 'emergency').length}건의 응급 검사가 대기 중입니다.
              </span>
            </div>
          </div>
        )}

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
        ) : studies.length === 0 ? (
          <div style={{
            textAlign: 'center',
            padding: '3rem',
            backgroundColor: '#f8f9fa',
            borderRadius: '8px'
          }}>
            <div style={{ fontSize: '3rem', marginBottom: '1rem' }}>✅</div>
            <h3>대기 중인 검사가 없습니다</h3>
            <p style={{ color: '#666', marginTop: '0.5rem' }}>
              모든 검사가 완료되었거나 판독이 완료되었습니다.
            </p>
          </div>
        ) : (
          <>
            <ImagingListTable
              role={role || ''}
              studies={studies}
              onEdit={() => {}}
              onDelete={() => {}}
              onRefresh={fetchWorklist}
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
