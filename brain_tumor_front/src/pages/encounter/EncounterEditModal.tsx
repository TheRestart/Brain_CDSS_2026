import { useState, useEffect } from 'react';
import { updateEncounter } from '@/services/encounter.api';
import type { Encounter, EncounterUpdateData, EncounterStatus, Department } from '@/types/encounter';
import '@/pages/patient/PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  encounter: Encounter;
};

export default function EncounterEditModal({ isOpen, onClose, onSuccess, encounter }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<EncounterUpdateData>({
    status: encounter.status,
    attending_doctor: encounter.attending_doctor,
    department: encounter.department,
    admission_date: (encounter.admission_date || '').slice(0, 16),
    discharge_date: encounter.discharge_date ? encounter.discharge_date.slice(0, 16) : null,
    chief_complaint: encounter.chief_complaint,
    primary_diagnosis: encounter.primary_diagnosis,
    secondary_diagnoses: encounter.secondary_diagnoses || [],
  });

  const [diagnosisInput, setDiagnosisInput] = useState('');

  useEffect(() => {
    if (encounter) {
      setFormData({
        status: encounter.status,
        attending_doctor: encounter.attending_doctor,
        department: encounter.department,
        admission_date: (encounter.admission_date || '').slice(0, 16),
        discharge_date: encounter.discharge_date ? encounter.discharge_date.slice(0, 16) : null,
        chief_complaint: encounter.chief_complaint,
        primary_diagnosis: encounter.primary_diagnosis,
        secondary_diagnoses: encounter.secondary_diagnoses || [],
      });
    }
  }, [encounter]);

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    setLoading(true);
    try {
      await updateEncounter(encounter.id, formData);
      alert('진료가 수정되었습니다.');
      onSuccess();
    } catch (err: any) {
      setError(err.response?.data?.detail || err.response?.data?.error || '진료 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  const addDiagnosis = () => {
    if (diagnosisInput.trim()) {
      setFormData({
        ...formData,
        secondary_diagnoses: [...(formData.secondary_diagnoses || []), diagnosisInput.trim()],
      });
      setDiagnosisInput('');
    }
  };

  const removeDiagnosis = (index: number) => {
    setFormData({
      ...formData,
      secondary_diagnoses: formData.secondary_diagnoses?.filter((_, i) => i !== index) || [],
    });
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <h2>진료 수정</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>환자 정보 (수정 불가)</h3>
            <p><strong>환자:</strong> {encounter.patient_name} ({encounter.patient_number})</p>
          </div>

          <div className="form-section">
            <h3>기본 정보</h3>
            <div className="form-row">
              <div className="form-group">
                <label>담당 의사 ID</label>
                <input
                  type="number"
                  value={formData.attending_doctor || ''}
                  onChange={(e) => setFormData({ ...formData, attending_doctor: Number(e.target.value) })}
                />
              </div>
              <div className="form-group">
                <label>진료과</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                >
                  <option value="neurology">신경과</option>
                  <option value="neurosurgery">신경외과</option>
                </select>
              </div>
            </div>

            <div className="form-group">
              <label>상태</label>
              <select
                value={formData.status}
                onChange={(e) => setFormData({ ...formData, status: e.target.value as EncounterStatus })}
              >
                <option value="scheduled">예정</option>
                <option value="in_progress">진행중</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>일시 정보</h3>
            <div className="form-row">
              <div className="form-group">
                <label>입원/진료 일시</label>
                <input
                  type="datetime-local"
                  value={formData.admission_date || ''}
                  onChange={(e) => setFormData({ ...formData, admission_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>퇴원 일시</label>
                <input
                  type="datetime-local"
                  value={formData.discharge_date || ''}
                  onChange={(e) => setFormData({ ...formData, discharge_date: e.target.value || null })}
                />
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>진료 내용</h3>
            <div className="form-group">
              <label>주 호소</label>
              <textarea
                value={formData.chief_complaint}
                onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                rows={3}
              />
            </div>

            <div className="form-group">
              <label>주 진단명</label>
              <input
                type="text"
                value={formData.primary_diagnosis}
                onChange={(e) => setFormData({ ...formData, primary_diagnosis: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>부 진단명</label>
              <div className="tag-input">
                <input
                  type="text"
                  placeholder="진단명 입력 후 추가 버튼 클릭"
                  value={diagnosisInput}
                  onChange={(e) => setDiagnosisInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDiagnosis();
                    }
                  }}
                />
                <button type="button" onClick={addDiagnosis} className="btn small">
                  추가
                </button>
              </div>
              <div className="tag-list">
                {formData.secondary_diagnoses?.map((diagnosis, index) => (
                  <span key={index} className="tag">
                    {diagnosis}
                    <button type="button" onClick={() => removeDiagnosis(index)}>×</button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={handleClose} disabled={loading}>
              취소
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? '수정 중...' : '수정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
