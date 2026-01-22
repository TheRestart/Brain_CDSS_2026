import { useState, useEffect } from 'react';
import { createEncounter } from '@/services/encounter.api';
import { getPatients } from '@/services/patient.api';
import { api } from '@/services/api';
import type { EncounterCreateData, EncounterType, EncounterStatus, Department } from '@/types/encounter';
import '@/pages/patient/PatientCreateModal.css';
import './EncounterCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type Patient = {
  id: number;
  patient_number: string;
  name: string;
};

type Doctor = {
  id: number;
  name: string;
  email: string;
};

export default function EncounterCreateModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);

  const [formData, setFormData] = useState<EncounterCreateData>({
    patient: 0,
    encounter_type: 'outpatient',
    status: 'scheduled',
    attending_doctor: 0,
    department: 'neurology',
    admission_date: '',
    discharge_date: null,
    chief_complaint: '',
    primary_diagnosis: '',
    secondary_diagnoses: [],
  });

  const [diagnosisInput, setDiagnosisInput] = useState('');
  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');

  // 환자 및 의사 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadPatients();
      loadDoctors();
    }
  }, [isOpen]);

  const loadPatients = async () => {
    try {
      const response = await getPatients({ page: 1, page_size: 1000 });
      const patientList = Array.isArray(response) ? response : response.results || [];
      setPatients(patientList);
    } catch (err) {
      console.error('환자 목록 로드 실패:', err);
    }
  };

  const loadDoctors = async () => {
    try {
      // 모든 사용자 조회 후 DOCTOR role만 필터링
      const response = await api.get('/users/', {
        params: { page_size: 1000 }
      });
      console.log('User API response:', response.data);

      const userList = Array.isArray(response.data) ? response.data : response.data.results || [];

      // DOCTOR role만 필터링
      const doctorList = userList.filter((user: any) => user.role?.code === 'DOCTOR');
      console.log('Doctor list:', doctorList);

      setDoctors(doctorList);
    } catch (err) {
      console.error('의사 목록 로드 실패:', err);
    }
  };

  // 검색된 환자 목록 필터링
  const filteredPatients = patients.filter(patient => {
    const searchLower = patientSearch.toLowerCase();
    return (
      patient.patient_number.toLowerCase().includes(searchLower) ||
      patient.name.toLowerCase().includes(searchLower)
    );
  });

  // 검색된 의사 목록 필터링
  const filteredDoctors = doctors.filter(doctor => {
    const searchLower = doctorSearch.toLowerCase();
    return (
      doctor.name.toLowerCase().includes(searchLower) ||
      (doctor.email && doctor.email.toLowerCase().includes(searchLower))
    );
  });

  if (!isOpen) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.patient || !formData.attending_doctor || !formData.admission_date || !formData.chief_complaint) {
      setError('필수 항목을 모두 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      await createEncounter(formData);
      alert('진료가 등록되었습니다.');
      onSuccess();
    } catch (err: any) {
      console.error('진료 등록 에러:', err.response?.data);
      const errorMessage = err.response?.data?.detail
        || err.response?.data?.error
        || JSON.stringify(err.response?.data)
        || '진료 등록에 실패했습니다.';
      setError(errorMessage);
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
      <div className="modal-content encounter-modal-content" onClick={(e) => e.stopPropagation()}>
        <h2>진료 등록</h2>

        {error && <div className="error-message">{error}</div>}

        <form onSubmit={handleSubmit}>
          <div className="form-section">
            <h3>기본 정보</h3>
            <div className="form-row">
              <div className="form-group">
                <label>환자 선택 *</label>
                <input
                  type="text"
                  placeholder="환자 검색 (환자번호 또는 이름)"
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="search-input"
                />
                <select
                  value={formData.patient || ''}
                  onChange={(e) => setFormData({ ...formData, patient: Number(e.target.value) })}
                  required
                  size={5}
                  className="searchable-select"
                >
                  <option value="">환자를 선택하세요 (예: P2026-0001)</option>
                  {filteredPatients.map((patient) => (
                    <option key={patient.id} value={patient.id}>
                      {patient.patient_number} - {patient.name}
                    </option>
                  ))}
                </select>
              </div>
              <div className="form-group">
                <label>담당 의사 선택 *</label>
                <input
                  type="text"
                  placeholder="의사 검색 (이름 또는 이메일)"
                  value={doctorSearch}
                  onChange={(e) => setDoctorSearch(e.target.value)}
                  className="search-input"
                />
                <select
                  value={formData.attending_doctor || ''}
                  onChange={(e) => setFormData({ ...formData, attending_doctor: Number(e.target.value) })}
                  required
                  size={5}
                  className="searchable-select"
                >
                  <option value="">담당 의사를 선택하세요</option>
                  {filteredDoctors.map((doctor) => (
                    <option key={doctor.id} value={doctor.id}>
                      [ID: {doctor.id}] {doctor.name} ({doctor.email || '이메일 없음'})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>진료 유형 *</label>
                <select
                  value={formData.encounter_type}
                  onChange={(e) => setFormData({ ...formData, encounter_type: e.target.value as EncounterType })}
                  required
                >
                  <option value="outpatient">외래</option>
                  <option value="inpatient">입원</option>
                  <option value="emergency">응급</option>
                </select>
              </div>
              <div className="form-group">
                <label>진료과 *</label>
                <select
                  value={formData.department}
                  onChange={(e) => setFormData({ ...formData, department: e.target.value as Department })}
                  required
                >
                  <option value="neurology">신경과</option>
                  <option value="neurosurgery">신경외과</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>상태 *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as EncounterStatus })}
                  required
                >
                  <option value="scheduled">예정</option>
                  <option value="in_progress">진행중</option>
                  <option value="completed">완료</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>일시 정보</h3>
            <div className="form-row">
              <div className="form-group">
                <label>입원/진료 일시 *</label>
                <input
                  type="datetime-local"
                  value={formData.admission_date}
                  onChange={(e) => {
                    setFormData({
                      ...formData,
                      admission_date: e.target.value
                    });
                  }}
                  required
                />
              </div>
              <div className="form-group">
                <label>퇴원 일시</label>
                <input
                  type="datetime-local"
                  value={formData.discharge_date || ''}
                  onChange={(e) => setFormData({ ...formData, discharge_date: e.target.value || null })}
                />
                <small style={{ color: '#1976d2', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                  💡 퇴원 일시 = 입원 일시로 설정하면 '입원중'으로 표시됩니다
                </small>
              </div>
            </div>
          </div>

          <div className="form-section">
            <h3>진료 내용</h3>
            <div className="form-group">
              <label>주 호소 *</label>
              <textarea
                value={formData.chief_complaint}
                onChange={(e) => setFormData({ ...formData, chief_complaint: e.target.value })}
                rows={3}
                required
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
              {loading ? '등록 중...' : '등록'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
