import { useState } from 'react';
import { deleteImagingStudy } from '@/services/imaging.api';
import type { ImagingStudy } from '@/types/imaging';
import '@/pages/patient/PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  study: ImagingStudy;
};

export default function ImagingDeleteModal({ isOpen, onClose, onSuccess, study }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleDelete = async () => {
    setError('');
    setLoading(true);

    try {
      await deleteImagingStudy(study.id);
      alert('영상 검사가 삭제되었습니다.');
      onSuccess();
    } catch (err: any) {
      console.error('영상 검사 삭제 실패:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || '삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>영상 검사 삭제</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
              {error}
            </div>
          )}

          <div style={{ padding: '1rem 0' }}>
            <p style={{ marginBottom: '1rem' }}>다음 영상 검사를 삭제하시겠습니까?</p>

            <div style={{
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              borderLeft: '4px solid #dc3545'
            }}>
              <p><strong>환자:</strong> {study.patient_name} ({study.patient_number})</p>
              <p><strong>검사종류:</strong> {study.modality_display}</p>
              <p><strong>촬영부위:</strong> {study.body_part}</p>
              <p><strong>오더일시:</strong> {new Date(study.ordered_at).toLocaleString('ko-KR')}</p>
              <p><strong>상태:</strong> {study.status_display}</p>
            </div>

            <p style={{ marginTop: '1rem', color: '#dc3545', fontSize: '0.875rem' }}>
              ⚠️ 이 작업은 Soft Delete이며, 실제로는 삭제되지 않고 숨김 처리됩니다.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose} disabled={loading}>
            취소
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={handleDelete}
            disabled={loading}
          >
            {loading ? '삭제 중...' : '삭제'}
          </button>
        </div>
      </div>
    </div>
  );
}
