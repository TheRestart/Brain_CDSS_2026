import { useState } from 'react';
import { deletePatient } from '@/services/patient.api';
import type { Patient } from '@/types/patient';
import './PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PatientDeleteModal({ isOpen, patient, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen || !patient) return null;

  const handleDelete = async () => {
    setError('');
    setLoading(true);

    try {
      await deletePatient(patient.id);
      onSuccess();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || '환자 삭제에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-small" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>환자 삭제 확인</h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="delete-confirm-content">
            <div className="warning-icon">
              ⚠️
            </div>
            <p className="confirm-message">
              정말로 다음 환자를 삭제하시겠습니까?
            </p>
            <div className="patient-info-box">
              <div className="info-row">
                <span className="label">환자번호:</span>
                <span className="value">{patient.patient_number}</span>
              </div>
              <div className="info-row">
                <span className="label">이름:</span>
                <span className="value">{patient.name}</span>
              </div>
              <div className="info-row">
                <span className="label">생년월일:</span>
                <span className="value">{patient.birth_date} ({patient.age}세)</span>
              </div>
              <div className="info-row">
                <span className="label">연락처:</span>
                <span className="value">{patient.phone}</span>
              </div>
            </div>
            <p className="warning-text">
              ℹ️ 이 작업은 소프트 삭제(Soft Delete)로 처리되어 복구가 가능합니다.
            </p>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
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
