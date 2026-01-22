/**
 * 의사용 검사 오더 관리 페이지
 * - 오더 조회, 확정, 취소
 * - 오더 생성은 /orders/create 페이지로 이동
 */
import { useState, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import Pagination from '@/layout/Pagination';
import { useOCSList } from '@/hooks/useOCSList';
import { useOCSActions } from '@/hooks/useOCSActions';
import { useOCSEventCallback } from '@/context/OCSNotificationContext';
import { LoadingSpinner, EmptyState, useToast } from '@/components/common';
import {
  OCS_STATUS_LABELS,
  PRIORITY_LABELS,
  JOB_ROLE_LABELS,
} from '@/types/ocs';
import type { OCSListItem, JobRole } from '@/types/ocs';
import OCSListTable from './OCSListTable';
import OCSDetailModal from './OCSDetailModal';
import './DoctorOrderPage.css';

export default function DoctorOrderPage() {
  const navigate = useNavigate();
  const { role, user } = useAuth();
  const toast = useToast();

  // 검색 입력 상태
  const [searchInput, setSearchInput] = useState('');

  // JobRole 필터 (의사 페이지 전용)
  const [jobRoleFilter, setJobRoleFilter] = useState<JobRole | ''>('');

  // Modal states
  const [isDetailModalOpen, setIsDetailModalOpen] = useState(false);
  const [selectedOcsId, setSelectedOcsId] = useState<number | null>(null);

  // OCS 목록 훅 (의사인 경우 자신의 오더만)
  const {
    ocsList,
    totalCount,
    loading,
    page,
    pageSize,
    totalPages,
    setPage,
    filters,
    setStatusFilter,
    setPriorityFilter,
    setSearchQuery,
    refresh,
  } = useOCSList(user?.id, {
    doctorId: role === 'DOCTOR' ? user?.id : undefined,
  });

  // OCS 액션 훅
  // DB 트랜잭션 완료를 위해 300ms 딜레이 추가
  const { confirm: _confirm, cancel: _cancel } = useOCSActions({
    onSuccess: (action) => {
      const messages: Record<string, string> = {
        confirm: '오더를 확정했습니다.',
        cancel: '오더를 취소했습니다.',
      };
      toast.success(messages[action] || '작업이 완료되었습니다.');
      setTimeout(() => refresh(), 300);
    },
    onError: (action, _error, serverMessage) => {
      const defaultMessages: Record<string, string> = {
        confirm: '확정에 실패했습니다.',
        cancel: '취소에 실패했습니다.',
      };
      const message = serverMessage || defaultMessages[action] || '작업에 실패했습니다.';
      toast.error(message);
      setTimeout(() => refresh(), 300);
    },
  });

  // WebSocket 이벤트 콜백 (전역 Context 사용)
  // DB 트랜잭션 완료를 위해 300ms 딜레이 추가
  useOCSEventCallback({
    autoRefresh: () => setTimeout(() => refresh(), 300),
  });

  // JobRole 필터 적용된 목록
  const filteredOcsList = jobRoleFilter
    ? ocsList.filter((ocs) => ocs.job_role === jobRoleFilter)
    : ocsList;

  const handleJobRoleChange = useCallback((e: React.ChangeEvent<HTMLSelectElement>) => {
    setJobRoleFilter(e.target.value as JobRole | '');
  }, []);

  const handleRowClick = useCallback((ocs: OCSListItem) => {
    setSelectedOcsId(ocs.id);
    setIsDetailModalOpen(true);
  }, []);

  const handleModalClose = useCallback(() => {
    setIsDetailModalOpen(false);
    setSelectedOcsId(null);
  }, []);

  const handleModalSuccess = useCallback(() => {
    refresh();
  }, [refresh]);

  // 오더 생성 페이지로 이동
  const handleCreateOrder = useCallback(() => {
    navigate('/orders/create');
  }, [navigate]);

  // 검색
  const handleSearch = useCallback(() => {
    setSearchQuery(searchInput);
  }, [searchInput, setSearchQuery]);

  const handleClearSearch = useCallback(() => {
    setSearchInput('');
    setSearchQuery('');
  }, [setSearchQuery]);

  return (
    <div className="page doctor-order">
      {/* 헤더 */}
      <header className="page-header">
        <h2>검사 오더 관리</h2>
        <span className="subtitle">검사 오더를 조회하고 관리합니다</span>
      </header>

      {/* 필터 영역 */}
      <section className="filter-bar">
        <div className="filter-left">
          <strong className="ocs-count">
            총 <span>{totalCount}</span>건의 오더
          </strong>
          <button className="btn btn-primary" onClick={handleCreateOrder}>
            + 오더 생성
          </button>
        </div>
        <div className="filter-right">
          {/* 검색 */}
          <div className="search-box">
            <input
              type="text"
              placeholder="환자명 / 환자번호 / OCS ID 검색"
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') handleSearch();
              }}
            />
            <button className="btn btn-search" onClick={handleSearch}>
              검색
            </button>
            {filters.searchQuery && (
              <button className="btn btn-clear" onClick={handleClearSearch}>
                초기화
              </button>
            )}
          </div>

          <select value={filters.status} onChange={(e) => setStatusFilter(e.target.value as any)}>
            <option value="">전체 상태</option>
            {Object.entries(OCS_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select value={jobRoleFilter} onChange={handleJobRoleChange}>
            <option value="">전체 역할</option>
            {Object.entries(JOB_ROLE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select value={filters.priority} onChange={(e) => setPriorityFilter(e.target.value as any)}>
            <option value="">전체 우선순위</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>
        </div>
      </section>

      {/* OCS 리스트 */}
      <section className="content">
        {loading ? (
          <LoadingSpinner text="오더 목록을 불러오는 중..." />
        ) : filteredOcsList.length === 0 ? (
          <EmptyState
            icon="📋"
            title="오더가 없습니다"
            description="새 오더를 생성하거나 필터 조건을 변경해주세요."
            action={{ label: '오더 생성', onClick: handleCreateOrder }}
          />
        ) : (
          <OCSListTable role={role || ''} ocsList={filteredOcsList} onRowClick={handleRowClick} />
        )}
      </section>

      {/* 페이징 */}
      <section className="pagination-bar">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onChange={setPage}
          pageSize={pageSize}
        />
      </section>

      {/* OCS 상세 모달 */}
      {selectedOcsId && (
        <OCSDetailModal
          isOpen={isDetailModalOpen}
          ocsId={selectedOcsId}
          onClose={handleModalClose}
          onSuccess={handleModalSuccess}
        />
      )}

      {/* Toast 컨테이너 */}
      <toast.ToastContainer position="top-right" />
    </div>
  );
}
