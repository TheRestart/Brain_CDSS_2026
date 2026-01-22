import { useState, useEffect } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import { getImagingStudies } from '@/services/imaging.api';
import type { ImagingStudy, ImagingStudySearchParams, ImagingModality, ImagingStatus } from '@/types/imaging';
import ImagingListTable from './ImagingListTable';
import ImagingCreateModal from './ImagingCreateModal';
import ImagingEditModal from './ImagingEditModal';
import ImagingDeleteModal from './ImagingDeleteModal';
import Pagination from '@/layout/Pagination';
import '@/assets/style/encounterListView.css';
import '@/assets/style/summaryCard.css';

export default function ImagingListPage() {
  const { role } = useAuth();
  const isDoctor = role === 'DOCTOR';
  const isRIS = role === 'RIS';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canCreate = isDoctor || isRIS || isSystemManager;

  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [modalityFilter, setModalityFilter] = useState<ImagingModality | ''>('');
  const [statusFilter, setStatusFilter] = useState<ImagingStatus | ''>('');
  const [hasReportFilter, setHasReportFilter] = useState<'all' | 'with' | 'without'>('all');

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);

  // Fetch imaging studies
  const fetchStudies = async () => {
    setLoading(true);
    try {
      const params: ImagingStudySearchParams = {
        page,
        page_size: pageSize,
        ...(searchQuery && { q: searchQuery }),
        ...(modalityFilter && { modality: modalityFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(hasReportFilter !== 'all' && { has_report: hasReportFilter === 'with' }),
      };

      console.log('Fetching imaging studies with params:', params);
      const response = await getImagingStudies(params);
      console.log('Imaging studies response:', response);

      // Handle both paginated and non-paginated responses
      if (Array.isArray(response)) {
        setStudies(response);
        setTotalCount(response.length);
      } else {
        setStudies(response.results || []);
        setTotalCount(response.count || 0);
      }
    } catch (error: any) {
      console.error('Failed to fetch imaging studies:', error);
      console.error('Error details:', error.response?.data);
      alert(`영상 검사 목록을 불러오는데 실패했습니다.\n${error.response?.data?.detail || error.message || '알 수 없는 오류'}`);
      setStudies([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudies();
  }, [page, searchQuery, modalityFilter, statusFilter, hasReportFilter]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchStudies();
  };

  // Handle create
  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchStudies();
  };

  // Handle edit
  const handleEditClick = (study: ImagingStudy) => {
    setSelectedStudy(study);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedStudy(null);
    fetchStudies();
  };

  // Handle delete
  const handleDeleteClick = (study: ImagingStudy) => {
    setSelectedStudy(study);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    setSelectedStudy(null);
    fetchStudies();
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setModalityFilter('');
    setStatusFilter('');
    setHasReportFilter('all');
    setPage(1);
  };

  return (
    <div className="page">
      {/* <div className="page-header">
        <h1>영상 검사 목록</h1>
        <p className="subtitle">CT, MRI, PET, X-Ray 검사 오더 관리</p>
      </div> */}

      <div className="">
        <div style={{ display: 'flex', gap: '1rem', marginBottom: '1rem' }}>
          <div className="summary-card total">
            <div className="label">총 검사</div>
            <div className="count">{totalCount}</div>
          </div>
          <div className="summary-card waiting">
            <div className="label">판독 대기</div>
            <div className="count">
              {studies.filter(s => s.status === 'completed' && !s.has_report).length}
            </div>
          </div>
          <div className="summary-card confirmed">
            <div className="label">판독 완료</div>
            <div className="count">
              {studies.filter(s => s.has_report).length}
            </div>
          </div>
        </div>
      </div>

      <div className="content">
        {/* Statistics Summary */}
        
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
            <div style={{ fontSize: '0.875rem', color: '#666' }}>판독 대기</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ff6b6b' }}>
              {studies.filter(s => s.status === 'completed' && !s.has_report).length}
            </div>
          </div>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <div style={{ fontSize: '0.875rem', color: '#666' }}>판독 완료</div>
            <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#51cf66' }}>
              {studies.filter(s => s.has_report).length}
            </div>
          </div>
        </div> */}

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

            <select
              value={statusFilter}
              onChange={(e) => {
                setStatusFilter(e.target.value as ImagingStatus | '');
                setPage(1);
              }}
            >
              <option value="">전체 상태</option>
              <option value="ordered">오더 생성</option>
              <option value="scheduled">검사 예약</option>
              <option value="in_progress">검사 수행 중</option>
              <option value="completed">검사 완료</option>
              <option value="reported">판독 완료</option>
              <option value="cancelled">취소</option>
            </select>

            <select
              value={hasReportFilter}
              onChange={(e) => {
                setHasReportFilter(e.target.value as 'all' | 'with' | 'without');
                setPage(1);
              }}
            >
              <option value="all">전체 (판독문)</option>
              <option value="with">판독문 있음</option>
              <option value="without">판독문 없음</option>
            </select>

            <button className="btn" onClick={handleResetFilters}>
              필터 초기화
            </button>
          </div>

          <div className="filter-right">
            {canCreate && (
              <button className="btn primary" onClick={handleCreateClick}>
                검사 오더 생성
              </button>
            )}
          </div>
        </div>

        <section className='page-header'>
          <span className="subtitle">CT, MRI, PET, X-Ray 검사 오더 관리</span>
        </section>

        {/* Table */}
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem' }}>로딩 중...</div>
        ) : (
          <>
            <ImagingListTable
              role={role || ''}
              studies={studies}
              onEdit={handleEditClick}
              onDelete={handleDeleteClick}
              onRefresh={fetchStudies}
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

      {/* Modals */}
      {isCreateModalOpen && (
        <ImagingCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {isEditModalOpen && selectedStudy && (
        <ImagingEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedStudy(null);
          }}
          onSuccess={handleEditSuccess}
          study={selectedStudy}
        />
      )}

      {isDeleteModalOpen && selectedStudy && (
        <ImagingDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedStudy(null);
          }}
          onSuccess={handleDeleteSuccess}
          study={selectedStudy}
        />
      )}
    </div>
  );
}
