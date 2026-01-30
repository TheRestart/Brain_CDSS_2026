/**
 * 통합 보고서 대시보드 페이지
 * - 모든 보고서(OCS, AI, Final)를 썸네일 카드 형태로 표시
 * - 필터링: 유형별, 환자별, 날짜별
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { getReportDashboard, type UnifiedReport, type ReportDashboardParams } from '@/services/report.api';
import ReportCard from './components/ReportCard';
import './ReportDashboardPage.css';

// 보고서 유형 필터 옵션
const REPORT_TYPE_OPTIONS = [
  { value: '', label: '전체' },
  { value: 'OCS_RIS', label: '영상검사 (RIS)' },
  { value: 'OCS_LIS', label: '임상검사 (LIS)' },
  { value: 'AI_M1', label: 'AI MRI 분석' },
  { value: 'AI_MG', label: 'AI 유전자 분석' },
  { value: 'AI_MM', label: 'AI 멀티모달' },
  { value: 'FINAL', label: '최종 보고서' },
];

export default function ReportDashboardPage() {
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();

  const [reports, setReports] = useState<UnifiedReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [totalCount, setTotalCount] = useState(0);

  // 필터 상태
  const [reportType, setReportType] = useState(searchParams.get('type') || '');
  const [dateFrom, setDateFrom] = useState(searchParams.get('from') || '');
  const [dateTo, setDateTo] = useState(searchParams.get('to') || '');
  const [searchPatient, setSearchPatient] = useState(searchParams.get('patient') || '');

  // 데이터 조회
  const fetchReports = useCallback(async () => {
    setLoading(true);
    try {
      const params: ReportDashboardParams = {
        limit: 100,
      };

      if (reportType) {
        params.report_type = reportType as ReportDashboardParams['report_type'];
      }
      if (dateFrom) {
        params.date_from = dateFrom;
      }
      if (dateTo) {
        params.date_to = dateTo;
      }

      const data = await getReportDashboard(params);

      // 환자 이름/번호로 클라이언트 사이드 필터링
      let filtered = data.reports;
      if (searchPatient) {
        const query = searchPatient.toLowerCase();
        filtered = filtered.filter(r =>
          r.patient_name?.toLowerCase().includes(query) ||
          r.patient_number?.toLowerCase().includes(query)
        );
      }

      setReports(filtered);
      setTotalCount(data.count);
    } catch (error) {
      console.error('Failed to fetch reports:', error);
    } finally {
      setLoading(false);
    }
  }, [reportType, dateFrom, dateTo, searchPatient]);

  useEffect(() => {
    fetchReports();
  }, [fetchReports]);

  // 필터 변경 시 URL 파라미터 업데이트
  useEffect(() => {
    const params = new URLSearchParams();
    if (reportType) params.set('type', reportType);
    if (dateFrom) params.set('from', dateFrom);
    if (dateTo) params.set('to', dateTo);
    if (searchPatient) params.set('patient', searchPatient);
    setSearchParams(params, { replace: true });
  }, [reportType, dateFrom, dateTo, searchPatient, setSearchParams]);

  // 카드 클릭 핸들러
  const handleCardClick = (report: UnifiedReport) => {
    navigate(report.link);
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setReportType('');
    setDateFrom('');
    setDateTo('');
    setSearchPatient('');
  };

  return (
    <div className="report-dashboard-page">
      {/* 헤더 */}
      {/* <header className="page-header">
        <h1>보고서 대시보드</h1>
        <p className="subtitle">모든 검사 결과와 AI 분석을 한눈에 확인하세요</p>
      </header> */}

      {/* 필터 영역 */}
      <section className="filter-section">
        <div className="filter-row">
          {/* 유형 필터 */}
          <div className="filter-group">
            <label>보고서 유형</label>
            <select
              value={reportType}
              onChange={(e) => setReportType(e.target.value)}
            >
              {REPORT_TYPE_OPTIONS.map(opt => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          {/* 환자 검색 */}
          <div className="filter-group">
            <label>환자 검색</label>
            <input
              type="text"
              placeholder="환자명 또는 환자번호"
              value={searchPatient}
              onChange={(e) => setSearchPatient(e.target.value)}
            />
          </div>

          {/* 날짜 필터 */}
          <div className="filter-group">
            <label>기간</label>
            <div className="date-range">
              <input
                type="date"
                value={dateFrom}
                onChange={(e) => setDateFrom(e.target.value)}
              />
              <span>~</span>
              <input
                type="date"
                value={dateTo}
                onChange={(e) => setDateTo(e.target.value)}
              />
            </div>
          </div>

          {/* 필터 초기화 */}
          <button className="btn-reset" onClick={handleResetFilters}>
            초기화
          </button>
        </div>

        {/* 결과 카운트 */}
        <div className="result-count">
          총 <strong>{reports.length}</strong>건의 보고서
          {totalCount !== reports.length && ` (전체 ${totalCount}건)`}
        </div>
      </section>

      <section className='page-header'>
        <span className="subtitle">모든 검사 결과와 AI 분석을 한눈에 확인하세요</span>
      </section>

      {/* 보고서 그리드 */}
      <section className="report-grid-section">
        {loading ? (
          <div className="loading-state">
            <div className="spinner" />
            <p>보고서를 불러오는 중...</p>
          </div>
        ) : reports.length === 0 ? (
          <div className="empty-state">
            <p>조회된 보고서가 없습니다.</p>
          </div>
        ) : (
          <div className="report-grid">
            {reports.map(report => (
              <ReportCard
                key={report.id}
                report={report}
                onClick={() => handleCardClick(report)}
              />
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
