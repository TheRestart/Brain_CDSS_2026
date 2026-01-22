import { useState, useEffect } from 'react';
import { updatePatient } from '@/services/patient.api';
import type { Patient, PatientUpdateData, PatientStatus, PatientSeverity } from '@/types/patient';
import { PATIENT_STATUS_LABELS, PATIENT_SEVERITY_LABELS } from '@/types/patient';
import './PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  patient: Patient | null;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PatientEditModal({ isOpen, patient, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState<PatientUpdateData>({
    name: '',
    phone: '',
    email: '',
    address: '',
    blood_type: undefined,
    allergies: [],
    chronic_diseases: [],
    status: 'active',
    severity: 'normal',
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [diseaseInput, setDiseaseInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Load patient data when modal opens
  useEffect(() => {
    if (isOpen && patient) {
      setFormData({
        name: patient.name,
        phone: patient.phone,
        email: patient.email || '',
        address: patient.address,
        blood_type: patient.blood_type || undefined,
        allergies: patient.allergies || [],
        chronic_diseases: patient.chronic_diseases || [],
        status: patient.status,
        severity: patient.severity,
      });
    }
  }, [isOpen, patient]);

  if (!isOpen || !patient) return null;

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value,
    }));
  };

  const addAllergy = () => {
    if (allergyInput.trim()) {
      setFormData(prev => ({
        ...prev,
        allergies: [...(prev.allergies || []), allergyInput.trim()],
      }));
      setAllergyInput('');
    }
  };

  const removeAllergy = (index: number) => {
    setFormData(prev => ({
      ...prev,
      allergies: prev.allergies?.filter((_, i) => i !== index) || [],
    }));
  };

  const addDisease = () => {
    if (diseaseInput.trim()) {
      setFormData(prev => ({
        ...prev,
        chronic_diseases: [...(prev.chronic_diseases || []), diseaseInput.trim()],
      }));
      setDiseaseInput('');
    }
  };

  const removeDisease = (index: number) => {
    setFormData(prev => ({
      ...prev,
      chronic_diseases: prev.chronic_diseases?.filter((_, i) => i !== index) || [],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // Validate required fields
      if (!formData.name || !formData.phone) {
        setError('필수 항목을 모두 입력해주세요.');
        setLoading(false);
        return;
      }

      // Validate phone format
      if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(formData.phone)) {
        setError('전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
        setLoading(false);
        return;
      }

      await updatePatient(patient.id, formData);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || '환자 정보 수정에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setError('');
    setAllergyInput('');
    setDiseaseInput('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>환자 정보 수정</h2>
          <button className="btn-close" onClick={handleClose}>
            ✕
          </button>
        </div>

        <form onSubmit={handleSubmit} className="modal-body">
          {error && (
            <div className="alert alert-error">
              {error}
            </div>
          )}

          <div className="form-section">
            <h3>기본 정보</h3>

            <div className="form-row">
              <div className="form-group">
                <label>환자번호</label>
                <input
                  type="text"
                  value={patient.patient_number}
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
              </div>

              <div className="form-group">
                <label>생년월일 (나이: {patient.age}세)</label>
                <input
                  type="text"
                  value={patient.birth_date}
                  disabled
                  style={{ backgroundColor: '#f5f5f5', cursor: 'not-allowed' }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>이름 <span className="required">*</span></label>
                <input
                  type="text"
                  name="name"
                  value={formData.name}
                  onChange={handleChange}
                  required
                  placeholder="환자 이름"
                />
              </div>

              <div className="form-group">
                <label>혈액형</label>
                <select
                  name="blood_type"
                  value={formData.blood_type || ''}
                  onChange={handleChange}
                >
                  <option value="">선택 안함</option>
                  <option value="A+">A+</option>
                  <option value="A-">A-</option>
                  <option value="B+">B+</option>
                  <option value="B-">B-</option>
                  <option value="O+">O+</option>
                  <option value="O-">O-</option>
                  <option value="AB+">AB+</option>
                  <option value="AB-">AB-</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>중증도</label>
                <select
                  name="severity"
                  value={formData.severity || 'normal'}
                  onChange={handleChange}
                >
                  {(Object.entries(PATIENT_SEVERITY_LABELS) as [PatientSeverity, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label>상태 <span className="required">*</span></label>
                <select
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  required
                >
                  {(Object.entries(PATIENT_STATUS_LABELS) as [PatientStatus, string][]).map(([value, label]) => (
                    <option key={value} value={value}>{label}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>연락처 정보</h3>

            <div className="form-group">
              <label>전화번호 <span className="required">*</span></label>
              <input
                type="tel"
                name="phone"
                value={formData.phone}
                onChange={handleChange}
                required
                placeholder="010-1234-5678"
              />
            </div>

            <div className="form-group">
              <label>이메일</label>
              <input
                type="email"
                name="email"
                value={formData.email}
                onChange={handleChange}
                placeholder="example@email.com"
              />
            </div>

            <div className="form-group">
              <label>주소</label>
              <textarea
                name="address"
                value={formData.address}
                onChange={handleChange}
                rows={2}
                placeholder="환자 주소"
              />
            </div>
          </div>

          <div className="form-section">
            <h3>의료 정보</h3>

            <div className="form-group">
              <label>알레르기</label>
              <div className="tag-input">
                <input
                  type="text"
                  value={allergyInput}
                  onChange={(e) => setAllergyInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addAllergy();
                    }
                  }}
                  placeholder="알레르기 항목 입력 후 Enter"
                />
                <button type="button" onClick={addAllergy} className="btn small">
                  추가
                </button>
              </div>
              <div className="tag-list">
                {formData.allergies?.map((allergy, index) => (
                  <span key={index} className="tag">
                    {allergy}
                    <button type="button" onClick={() => removeAllergy(index)}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>기저질환</label>
              <div className="tag-input">
                <input
                  type="text"
                  value={diseaseInput}
                  onChange={(e) => setDiseaseInput(e.target.value)}
                  onKeyPress={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      addDisease();
                    }
                  }}
                  placeholder="기저질환 입력 후 Enter"
                />
                <button type="button" onClick={addDisease} className="btn small">
                  추가
                </button>
              </div>
              <div className="tag-list">
                {formData.chronic_diseases?.map((disease, index) => (
                  <span key={index} className="tag">
                    {disease}
                    <button type="button" onClick={() => removeDisease(index)}>
                      ✕
                    </button>
                  </span>
                ))}
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={handleClose}>
              취소
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? '수정 중...' : '정보 수정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
