/**
 * RIS 작업자용 영상 워크리스트 페이지 (P.74)
 * - 영상 오더 접수, 작업, 결과 제출
 * - Modality 필터, 검색 기능
 * - 상세 페이지로 이동
 * - 실시간 OCS 상태 변경 알림
 */
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import Pagination from '@/layout/Pagination';
import { useOCSList } from '@/hooks/useOCSList';
import { useOCSActions } from '@/hooks/useOCSActions';
import { useOCSEventCallback } from '@/context/OCSNotificationContext';
import { LoadingSpinner, EmptyState } from '@/components/common';
import {
  formatDate,
  getStatusClass,
  getPriorityClass,
  MODALITY_OPTIONS,
} from '@/utils/ocs.utils';
import { OCS_STATUS_LABELS, PRIORITY_LABELS } from '@/types/ocs';
import type { OCSListItem } from '@/types/ocs';
import './RISWorklistPage.css';

export default function RISWorklistPage() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // 검색 입력 상태 (실제 검색과 분리)
  const [searchInput, setSearchInput] = useState('');

  // OCS 목록 훅
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
    setModalityFilter,
    setUnassignedOnly,
    setMyWorkOnly,
    setSearchQuery,
    refresh,
    statusCounts,
  } = useOCSList(user?.id, { jobRole: 'RIS' });

  // OCS 액션 훅
  // 성공/실패 모두 새로고침 (WebSocket 알림과 별개로 즉시 반영)
  // DB 트랜잭션 완료를 위해 300ms 딜레이 추가
  const { accept, start } = useOCSActions({
    onSuccess: () => {
      setTimeout(() => refresh(), 300);
    },
    onError: (action, _error, serverMessage) => {
      const defaultMessages: Record<string, string> = {
        accept: '접수에 실패했습니다.',
        start: '작업 시작에 실패했습니다.',
      };
      const message = serverMessage || defaultMessages[action] || '작업에 실패했습니다.';
      alert(message);
      setTimeout(() => refresh(), 300);
    },
  });

  // 실시간 알림 (전역 Context 사용)
  // DB 트랜잭션 완료를 위해 300ms 딜레이 추가
  useOCSEventCallback({
    autoRefresh: () => setTimeout(() => refresh(), 300),
  });

  // 오더 접수
  const handleAccept = async (ocsId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await accept(ocsId);
  };

  // 작업 시작
  const handleStart = async (ocsId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    await start(ocsId);
  };

  // 행 클릭 → 상세 페이지로 이동
  const handleRowClick = (ocs: OCSListItem) => {
    navigate(`/ocs/ris/${ocs.id}`);
  };

  // 검색
  const handleSearch = () => {
    setSearchQuery(searchInput);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchQuery('');
  };

  return (
    <div className="page ris-worklist">

      {/* 요약 카드 (6개 상태) */}
      <section className="summary-cards">
        <div className="summary-card ordered">
          <span className="count">{statusCounts.ordered}</span>
          <span className="label">요청됨</span>
        </div>
        <div className="summary-card accepted">
          <span className="count">{statusCounts.accepted}</span>
          <span className="label">접수됨</span>
        </div>
        <div className="summary-card in-progress">
          <span className="count">{statusCounts.inProgress}</span>
          <span className="label">판독중</span>
        </div>
        <div className="summary-card result-ready">
          <span className="count">{statusCounts.resultReady}</span>
          <span className="label">결과대기</span>
        </div>
        <div className="summary-card confirmed">
          <span className="count">{statusCounts.confirmed}</span>
          <span className="label">확정</span>
        </div>
        <div className="summary-card cancelled">
          <span className="count">{statusCounts.cancelled}</span>
          <span className="label">취소</span>
        </div>
      </section>

      {/* 필터 영역 */}
      <section className="filter-bar">
        <div className="filter-left">
          <strong className="ocs-count">
            전체 <span>{totalCount}</span>건
          </strong>
        </div>
        <div className="filter-right">
          {/* 검색 */}
          <div className="search-box">
            <input
              type="text"
              placeholder="환자명 / 환자번호 검색"
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

          {/* Modality 필터 */}
          <select
            value={filters.modality}
            onChange={(e) => setModalityFilter(e.target.value)}
          >
            <option value="">전체 Modality</option>
            {MODALITY_OPTIONS.map((m) => (
              <option key={m} value={m}>
                {m}
              </option>
            ))}
          </select>

          {/* 상태 필터 */}
          <select
            value={filters.status}
            onChange={(e) => setStatusFilter(e.target.value as any)}
          >
            <option value="">전체 상태</option>
            {Object.entries(OCS_STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          {/* 우선순위 필터 */}
          <select
            value={filters.priority}
            onChange={(e) => setPriorityFilter(e.target.value as any)}
          >
            <option value="">전체 우선순위</option>
            {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.unassignedOnly}
              onChange={(e) => setUnassignedOnly(e.target.checked)}
            />
            미배정만
          </label>

          <label className="checkbox-label">
            <input
              type="checkbox"
              checked={filters.myWorkOnly}
              onChange={(e) => setMyWorkOnly(e.target.checked)}
            />
            내 작업만
          </label>
        </div>
      </section>

      <section className="page-header">
        <span className="subtitle">담당 영상 검사 목록을 확인하고 판독을 진행합니다</span>
      </section>

      {/* 워크리스트 테이블 */}
      <section className="content">
        {loading ? (
          <LoadingSpinner text="목록을 불러오는 중..." />
        ) : !ocsList || ocsList.length === 0 ? (
          <EmptyState
            icon="🔍"
            title="검색 결과가 없습니다"
            description="필터 조건을 변경하거나 검색어를 확인해주세요."
          />
        ) : (
          <table className="ocs-table worklist-table">
            <thead>
              <tr>
                <th>OCS ID</th>
                <th>상태</th>
                <th>우선순위</th>
                <th>Modality</th>
                <th>환자명</th>
                <th>환자번호</th>
                <th>요청의사</th>
                <th>작업자</th>
                <th>생성일시</th>
                <th>액션</th>
              </tr>
            </thead>
            <tbody>
              {ocsList.map((ocs) => (
                <tr
                  key={ocs.id}
                  onClick={() => handleRowClick(ocs)}
                  className={`clickable-row ${ocs.priority === 'urgent' ? 'urgent-row' : ''}`}
                >
                  <td>{ocs.ocs_id}</td>
                  <td>
                    <span className={`status-badge ${getStatusClass(ocs.ocs_status)}`}>
                      {ocs.ocs_status_display}
                    </span>
                  </td>
                  <td>
                    <span className={`priority-badge ${getPriorityClass(ocs.priority)}`}>
                      {ocs.priority_display}
                    </span>
                  </td>
                  <td>
                    <span className="modality-badge">{ocs.job_type}</span>
                  </td>
                  <td>{ocs.patient.name}</td>
                  <td>{ocs.patient.patient_number}</td>
                  <td>{ocs.doctor.name}</td>
                  <td>{ocs.worker?.name || <span className="unassigned">미배정</span>}</td>
                  <td>{formatDate(ocs.created_at)}</td>
                  <td onClick={(e) => e.stopPropagation()}>
                    {ocs.ocs_status === 'ORDERED' && (
                      <button
                        className="btn btn-sm btn-primary"
                        onClick={(e) => handleAccept(ocs.id, e)}
                      >
                        접수
                      </button>
                    )}
                    {ocs.ocs_status === 'ACCEPTED' && ocs.worker?.id === user?.id && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={(e) => handleStart(ocs.id, e)}
                      >
                        판독 시작
                      </button>
                    )}
                    {ocs.ocs_status === 'IN_PROGRESS' && ocs.worker?.id === user?.id && (
                      <button
                        className="btn btn-sm btn-info"
                        onClick={() => handleRowClick(ocs)}
                      >
                        판독 계속
                      </button>
                    )}
                    {ocs.ocs_status === 'RESULT_READY' && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleRowClick(ocs)}
                      >
                        조회
                      </button>
                    )}
                    {ocs.ocs_status === 'CONFIRMED' && (
                      <button
                        className="btn btn-sm btn-success"
                        onClick={() => navigate(`/ocs/report/${ocs.id}`)}
                      >
                        결과 보기
                      </button>
                    )}
                    {ocs.ocs_status === 'CANCELLED' && (
                      <button
                        className="btn btn-sm btn-secondary"
                        onClick={() => handleRowClick(ocs)}
                      >
                        조회
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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

      {/* OCS 실시간 알림 Toast는 AppLayout에서 전역 렌더링 */}
    </div>
  );
}
