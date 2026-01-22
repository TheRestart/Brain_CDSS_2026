import { useState } from 'react';
import { createPatient } from '@/services/patient.api';
import type { PatientCreateData, PatientSeverity } from '@/types/patient';
import { PATIENT_SEVERITY_LABELS } from '@/types/patient';
import PhoneInput from '@/pages/common/PhoneInput';
import './PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

export default function PatientCreateModal({ isOpen, onClose, onSuccess }: Props) {
  const [formData, setFormData] = useState<PatientCreateData>({
    name: '',
    birth_date: '',
    gender: 'M',
    phone: '',
    email: '',
    address: '',
    ssn: '',
    blood_type: undefined,
    allergies: [],
    chronic_diseases: [],
    severity: 'normal',
  });

  const [allergyInput, setAllergyInput] = useState('');
  const [diseaseInput, setDiseaseInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!isOpen) return null;

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
      if (!formData.name || !formData.birth_date || !formData.phone || !formData.ssn) {
        setError('필수 항목을 모두 입력해주세요.');
        setLoading(false);
        return;
      }

      // Validate SSN format (13 digits)
      if (!/^\d{13}$/.test(formData.ssn.replace(/-/g, ''))) {
        setError('주민등록번호는 13자리 숫자여야 합니다.');
        setLoading(false);
        return;
      }

      // Validate phone format
      if (!/^\d{2,3}-\d{3,4}-\d{4}$/.test(formData.phone)) {
        setError('전화번호 형식이 올바르지 않습니다. (예: 010-1234-5678)');
        setLoading(false);
        return;
      }

      await createPatient(formData);
      onSuccess();
      handleClose();
    } catch (err: any) {
      setError(err.response?.data?.error || '환자 등록에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleClose = () => {
    setFormData({
      name: '',
      birth_date: '',
      gender: 'M',
      phone: '',
      email: '',
      address: '',
      ssn: '',
      blood_type: undefined,
      allergies: [],
      chronic_diseases: [],
      severity: 'normal',
    });
    setAllergyInput('');
    setDiseaseInput('');
    setError('');
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>환자 등록</h2>
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
                <label>생년월일 <span className="required">*</span></label>
                <input
                  type="date"
                  name="birth_date"
                  value={formData.birth_date}
                  onChange={handleChange}
                  required
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>성별 <span className="required">*</span></label>
                <select
                  name="gender"
                  value={formData.gender}
                  onChange={handleChange}
                  required
                >
                  <option value="M">남성</option>
                  <option value="F">여성</option>
                  <option value="O">기타</option>
                </select>
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
            </div>

            <div className="form-group">
              <label>주민등록번호 <span className="required">*</span></label>
              <PhoneInput
                value={formData.ssn}
                onChange={(v) => setFormData(prev => ({ ...prev, ssn: v }))}
                segments={[6, 7]}
              />
            </div>
          </div>

          <div className="form-section">
            <h3>연락처 정보</h3>

            <div className="form-group">
              <label>전화번호 <span className="required">*</span></label>
              <PhoneInput
                value={formData.phone}
                onChange={(v) => setFormData(prev => ({ ...prev, phone: v }))}
                segments={[3, 4, 4]}
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
              {loading ? '등록 중...' : '환자 등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
