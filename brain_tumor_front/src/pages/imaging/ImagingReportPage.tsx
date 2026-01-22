import { useState, useEffect } from 'react';
import { getImagingStudies } from '@/services/imaging.api';
import type { ImagingStudy, ImagingStudySearchParams } from '@/types/imaging';
import ImagingListTable from './ImagingListTable';
import ImagingReportModal from './ImagingReportModal';
import Pagination from '@/layout/Pagination';
import '@/assets/style/encounterListView.css';

export default function ImagingReportPage() {
  // Pagination
  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(false);

  // Filters - 판독 상태 필터
  const [reportStatusFilter, setReportStatusFilter] = useState<'pending' | 'completed' | 'all'>('all');

  // Modal
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);

  // Fetch imaging studies for reporting
  const fetchStudies = async () => {
    setLoading(true);
    try {
      const params: ImagingStudySearchParams = {
        page,
        page_size: pageSize,
        status: 'completed', // 완료된 검사만
      };

      // 판독 상태 필터 적용
      if (reportStatusFilter === 'pending') {
        params.has_report = false; // 판독 대기
      } else if (reportStatusFilter === 'completed') {
        params.has_report = true; // 판독 완료
      }

      const response = await getImagingStudies(params);

      if (Array.isArray(response)) {
        setStudies(response);
        setTotalCount(response.length);
      } else {
        setStudies(response.results || []);
        setTotalCount(response.count || 0);
      }
    } catch (error: any) {
      console.error('Failed to fetch imaging studies:', error);
      alert(`영상 검사 목록을 불러오는데 실패했습니다.\n${error.response?.data?.detail || error.message || '알 수 없는 오류'}`);
      setStudies([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStudies();
  }, [page, reportStatusFilter]);

  // Handle report creation/edit
  const handleOpenReportModal = (study: ImagingStudy) => {
    setSelectedStudy(study);
    setIsReportModalOpen(true);
  };

  const handleCloseReportModal = () => {
    setIsReportModalOpen(false);
    setSelectedStudy(null);
    fetchStudies(); // Refresh list after report created/updated
  };

  return (
    <div className="page encounter-list-page">
      <header className="page-header">
        <h1>판독 관리</h1>
        <div className="filter-group">
          <select
            className="filter-select"
            value={reportStatusFilter}
            onChange={(e) => {
              setReportStatusFilter(e.target.value as 'pending' | 'completed' | 'all');
              setPage(1);
            }}
          >
            <option value="all">전체</option>
            <option value="pending">판독 대기</option>
            <option value="completed">판독 완료</option>
          </select>
        </div>
      </header>

      <section className="list-section">
        {loading ? (
          <div className="loading-container">
            <p>로딩 중...</p>
          </div>
        ) : studies.length === 0 ? (
          <div className="empty-container">
            <p>검사 결과가 없습니다.</p>
          </div>
        ) : (
          <>
            <ImagingListTable
              role=""
              studies={studies}
              onEdit={handleOpenReportModal}
              onDelete={() => {}} // 판독 페이지에서는 삭제 불가
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
      </section>

      {/* Report Modal */}
      {isReportModalOpen && selectedStudy && (
        <ImagingReportModal
          isOpen={isReportModalOpen}
          study={selectedStudy}
          onClose={handleCloseReportModal}
          onSuccess={() => {
            handleCloseReportModal();
            fetchStudies();
          }}
        />
      )}
    </div>
  );
}
