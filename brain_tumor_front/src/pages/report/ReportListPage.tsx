/**
 * 최종 보고서 목록 페이지
 * - 보고서 목록 조회
 * - 상태/유형별 필터링
 * - 보고서 생성 링크
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getFinalReportList, type FinalReportListItem, type ReportStatus, type FinalReportType } from '@/services/report.api';
import { LoadingSpinner, EmptyState } from '@/components/common';
import Pagination from '@/layout/Pagination';
import './ReportListPage.css';

// 상태 라벨
const STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: '작성 중',
  PENDING_REVIEW: '검토 대기',
  APPROVED: '승인됨',
  FINALIZED: '최종 확정',
  CANCELLED: '취소됨',
};

// 상태 색상
const STATUS_COLORS: Record<ReportStatus, string> = {
  DRAFT: 'status-draft',
  PENDING_REVIEW: 'status-pending',
  APPROVED: 'status-approved',
  FINALIZED: 'status-finalized',
  CANCELLED: 'status-cancelled',
};

// 보고서 유형 라벨
const TYPE_LABELS: Record<FinalReportType, string> = {
  INITIAL: '초진 보고서',
  FOLLOWUP: '경과 보고서',
  DISCHARGE: '퇴원 보고서',
  FINAL: '최종 보고서',
};

export default function ReportListPage() {
  const navigate = useNavigate();

  // 데이터 상태
  const [reports, setReports] = useState<FinalReportListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터 상태
  const [statusFilter, setStatusFilter] = useState<ReportStatus | ''>('');
  const [typeFilter, setTypeFilter] = useState<FinalReportType | ''>('');
  const [searchQuery, setSearchQuery] = useState('');

  // 페이지네이션
  const [page, setPage] = useState(1);
  const pageSize = 20;

  // 데이터 조회
  const fetchReports = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getFinalReportList({
        status: statusFilter || undefined,
        report_type: typeFilter || undefined,
      });
      setReports(data);
    } catch (err) {
      setError('보고서 목록을 불러오는데 실패했습니다.');
      console.error('Failed to fetch reports:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, typeFilter]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 검색 필터링 (클라이언트 사이드)
  const filteredReports = reports.filter(report => {
    if (!searchQuery) return true;
    const query = searchQuery.toLowerCase();
    return (
      report.patient_name?.toLowerCase().includes(query) ||
      report.patient_number?.toLowerCase().includes(query) ||
      report.report_id?.toLowerCase().includes(query) ||
      report.primary_diagnosis?.toLowerCase().includes(query)
    );
  });

  // 페이지네이션 적용
  const totalPages = Math.ceil(filteredReports.length / pageSize);
  const paginatedReports = filteredReports.slice((page - 1) * pageSize, page * pageSize);

  // 행 클릭 핸들러
  const handleRowClick = useCallback(
    (report: FinalReportListItem) => {
      navigate(`/reports/${report.id}`);
    },
    [navigate]
  );

  // 새 보고서 작성
  const handleCreateReport = useCallback(() => {
    navigate('/reports/create');
  }, [navigate]);

  // 시간 포맷
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="page report-list-page">
      {/* 헤더 */}
      <header className="page-header">
        <h2>최종 보고서 관리</h2>
        <span className="subtitle">진료 보고서를 조회하고 관리합니다</span>
      </header>

      {/* 필터 영역 */}
      <section className="filter-bar">
        <div className="filter-left">
          <strong className="report-count">
            총 <span>{filteredReports.length}</span>건의 보고서
          </strong>
          <button className="btn btn-primary" onClick={handleCreateReport}>
            + 새 보고서 작성
          </button>
        </div>
        <div className="filter-right">
          <input
            type="text"
            className="search-input"
            placeholder="환자명, 환자번호, 진단명 검색"
            value={searchQuery}
            onChange={(e) => {
              setSearchQuery(e.target.value);
              setPage(1);
            }}
          />

          <select
            value={statusFilter}
            onChange={(e) => {
              setStatusFilter(e.target.value as ReportStatus | '');
              setPage(1);
            }}
          >
            <option value="">전체 상태</option>
            {Object.entries(STATUS_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <select
            value={typeFilter}
            onChange={(e) => {
              setTypeFilter(e.target.value as FinalReportType | '');
              setPage(1);
            }}
          >
            <option value="">전체 유형</option>
            {Object.entries(TYPE_LABELS).map(([value, label]) => (
              <option key={value} value={value}>
                {label}
              </option>
            ))}
          </select>

          <button className="btn btn-secondary" onClick={fetchReports}>
            새로고침
          </button>
        </div>
      </section>

      {/* 보고서 목록 */}
      <section className="content">
        {loading ? (
          <LoadingSpinner text="보고서 목록을 불러오는 중..." />
        ) : error ? (
          <div className="error-state">
            <p>{error}</p>
            <button className="btn btn-primary" onClick={fetchReports}>
              다시 시도
            </button>
          </div>
        ) : paginatedReports.length === 0 ? (
          <EmptyState
            icon="document"
            title="보고서가 없습니다"
            description="새 보고서를 작성하거나 필터 조건을 변경해주세요."
            action={{ label: '새 보고서 작성', onClick: handleCreateReport }}
          />
        ) : (
          <table className="report-table">
            <thead>
              <tr>
                <th>보고서 ID</th>
                <th>환자</th>
                <th>유형</th>
                <th>주 진단명</th>
                <th>진단일</th>
                <th>상태</th>
                <th>작성자</th>
                <th>작성일</th>
              </tr>
            </thead>
            <tbody>
              {paginatedReports.map((report) => (
                <tr
                  key={report.id}
                  onClick={() => handleRowClick(report)}
                  className="clickable"
                >
                  <td className="report-id">{report.report_id}</td>
                  <td>
                    <div className="patient-info">
                      <span className="patient-name">{report.patient_name}</span>
                      <span className="patient-number">{report.patient_number}</span>
                    </div>
                  </td>
                  <td>{report.report_type_display || TYPE_LABELS[report.report_type]}</td>
                  <td className="diagnosis">{report.primary_diagnosis}</td>
                  <td>{formatDate(report.diagnosis_date)}</td>
                  <td>
                    <span className={`status-badge ${STATUS_COLORS[report.status]}`}>
                      {report.status_display || STATUS_LABELS[report.status]}
                    </span>
                  </td>
                  <td>
                    <div className="author-info">
                      <span className="author-name">{report.created_by_name}</span>
                      {report.author_department && (
                        <span className="author-dept">{report.author_department}</span>
                      )}
                    </div>
                  </td>
                  <td>{formatDateTime(report.created_at)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </section>

      {/* 페이지네이션 */}
      {totalPages > 1 && (
        <section className="pagination-bar">
          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onChange={setPage}
            pageSize={pageSize}
          />
        </section>
      )}
    </div>
  );
}
