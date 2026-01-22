import { useState } from 'react';
import type { ImagingStudy } from '@/types/imaging';
import { completeImagingStudy, cancelImagingStudy } from '@/services/imaging.api';
import ImagingReportModal from './ImagingReportModal';

type Props = {
  role: string;
  studies: ImagingStudy[];
  onEdit: (study: ImagingStudy) => void;
  onDelete: (study: ImagingStudy) => void;
  onRefresh: () => void;
};

export default function ImagingListTable({ role, studies, onEdit, onDelete, onRefresh }: Props) {
  const isDoctor = role === 'DOCTOR';
  const isRIS = role === 'RIS';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canEdit = isDoctor || isRIS || isSystemManager;
  const canViewReport = isDoctor || isRIS || isSystemManager;

  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [selectedStudy, setSelectedStudy] = useState<ImagingStudy | null>(null);

  if (!studies) {
    return (
      <table className="table encounter-table">
        <thead>
          <tr>
            <th>환자명</th>
            <th>환자번호</th>
            <th>검사종류</th>
            <th>촬영부위</th>
            <th>오더의사</th>
            <th>오더일시</th>
            <th>검사일시</th>
            <th>판독의</th>
            <th>상태</th>
            <th>판독</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
              로딩 중...
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'ordered':
        return 'status-badge status-scheduled';
      case 'scheduled':
        return 'status-badge status-scheduled';
      case 'in_progress':
        return 'status-badge status-in_progress';
      case 'completed':
        return 'status-badge status-completed';
      case 'reported':
        return 'status-badge status-completed';
      case 'cancelled':
        return 'status-badge status-cancelled';
      default:
        return 'status-badge';
    }
  };

  const getModalityColor = (modality: string) => {
    switch (modality) {
      case 'CT':
        return '#1976d2';
      case 'MRI':
        return '#7b1fa2';
      case 'PET':
        return '#d32f2f';
      case 'X-RAY':
        return '#388e3c';
      default:
        return '#666';
    }
  };

  const handleComplete = async (study: ImagingStudy) => {
    if (!confirm('이 검사를 완료 처리하시겠습니까?')) return;

    try {
      await completeImagingStudy(study.id);
      alert('검사가 완료 처리되었습니다.');
      onRefresh();
    } catch (error: any) {
      console.error('Failed to complete study:', error);
      alert(`검사 완료 처리에 실패했습니다.\n${error.response?.data?.detail || error.message}`);
    }
  };

  const handleCancel = async (study: ImagingStudy) => {
    if (!confirm('이 검사를 취소하시겠습니까?')) return;

    try {
      await cancelImagingStudy(study.id);
      alert('검사가 취소되었습니다.');
      onRefresh();
    } catch (error: any) {
      console.error('Failed to cancel study:', error);
      alert(`검사 취소에 실패했습니다.\n${error.response?.data?.detail || error.message}`);
    }
  };

  const handleViewReport = (study: ImagingStudy) => {
    setSelectedStudy(study);
    setIsReportModalOpen(true);
  };

  const handleReportSuccess = () => {
    setIsReportModalOpen(false);
    setSelectedStudy(null);
    onRefresh();
  };

  return (
    <>
      <table className="table encounter-table">
        <thead>
          <tr>
            <th>환자명</th>
            <th>환자번호</th>
            <th>검사종류</th>
            <th>촬영부위</th>
            <th>오더의사</th>
            <th>오더일시</th>
            <th>검사일시</th>
            <th>판독의</th>
            <th>상태</th>
            <th>판독</th>
            <th>작업</th>
          </tr>
        </thead>

        <tbody>
          {studies.length === 0 ? (
            <tr>
              <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
                등록된 영상 검사가 없습니다.
              </td>
            </tr>
          ) : (
            studies.map((study) => (
              <tr key={study.id}>
                <td>{study.patient_name}</td>
                <td>{study.patient_number}</td>
                <td>
                  <span style={{
                    color: getModalityColor(study.modality),
                    fontWeight: 600
                  }}>
                    {study.modality_display}
                  </span>
                </td>
                <td>{study.body_part}</td>
                <td>{study.ordered_by_name}</td>
                <td>{formatDateTime(study.ordered_at)}</td>
                <td>
                  {study.performed_at ? (
                    formatDateTime(study.performed_at)
                  ) : (
                    <span style={{ color: '#999' }}>-</span>
                  )}
                </td>
                <td>
                  {study.radiologist_name || (
                    <span style={{ color: '#999' }}>미배정</span>
                  )}
                </td>
                <td>
                  <span className={getStatusBadgeClass(study.status)}>
                    {study.status_display}
                  </span>
                </td>
                <td>
                  {study.has_report ? (
                    <button
                      className="btn small primary"
                      onClick={() => handleViewReport(study)}
                      style={{ fontSize: '0.75rem' }}
                    >
                      판독문 보기
                    </button>
                  ) : study.is_completed ? (
                    canViewReport && (
                      <button
                        className="btn small"
                        onClick={() => handleViewReport(study)}
                        style={{ fontSize: '0.75rem', backgroundColor: '#ff9800', color: 'white' }}
                      >
                        판독 작성
                      </button>
                    )
                  ) : (
                    <span style={{ color: '#999', fontSize: '0.875rem' }}>대기중</span>
                  )}
                </td>
                <td>
                  <div className="action-buttons" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'nowrap' }}>
                    {canEdit && study.status !== 'cancelled' ? (
                      <>
                        {/* 완료/취소 버튼 영역 - 고정 너비로 정렬 유지 */}
                        <span style={{ minWidth: '45px', display: 'inline-block' }}>
                          {study.status === 'in_progress' && (
                            <button
                              className="btn small"
                              onClick={() => handleComplete(study)}
                              style={{ fontSize: '0.75rem', backgroundColor: '#4caf50', color: 'white' }}
                            >
                              완료
                            </button>
                          )}
                          {(study.status === 'ordered' || study.status === 'scheduled') && (
                            <button
                              className="btn small btn-danger"
                              onClick={() => handleCancel(study)}
                              style={{ fontSize: '0.75rem' }}
                            >
                              취소
                            </button>
                          )}
                        </span>
                        <button
                          className="btn small primary"
                          onClick={() => onEdit(study)}
                          style={{ fontSize: '0.75rem' }}
                        >
                          편집
                        </button>
                        {isSystemManager && (
                          <button
                            className="btn small btn-danger"
                            onClick={() => onDelete(study)}
                            style={{ fontSize: '0.75rem' }}
                          >
                            삭제
                          </button>
                        )}
                      </>
                    ) : null}
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>

      {/* Report Modal */}
      {isReportModalOpen && selectedStudy && (
        <ImagingReportModal
          isOpen={isReportModalOpen}
          onClose={() => {
            setIsReportModalOpen(false);
            setSelectedStudy(null);
          }}
          onSuccess={handleReportSuccess}
          study={selectedStudy}
        />
      )}
    </>
  );
}
