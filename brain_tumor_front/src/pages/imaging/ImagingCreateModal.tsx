import { useState, useEffect } from 'react';
import { createImagingStudy } from '@/services/imaging.api';
import { getPatients } from '@/services/patient.api';
import { getEncounters } from '@/services/encounter.api';
import { api } from '@/services/api';
import type { ImagingStudyCreateData } from '@/types/imaging';
import type { Patient } from '@/types/patient';
import type { Encounter } from '@/types/encounter';
import '@/pages/patient/PatientCreateModal.css';
import '@/pages/encounter/EncounterCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type Doctor = {
  id: number;
  name: string;
  email: string;
};

export default function ImagingCreateModal({ isOpen, onClose, onSuccess }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [patients, setPatients] = useState<Patient[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [filteredEncounters, setFilteredEncounters] = useState<Encounter[]>([]);

  const [formData, setFormData] = useState<ImagingStudyCreateData>({
    patient: 0,
    encounter: 0,
    modality: 'MRI',
    body_part: 'brain',
    scheduled_at: '',
    clinical_info: '',
    special_instruction: '',
  });

  const [patientSearch, setPatientSearch] = useState('');
  const [doctorSearch, setDoctorSearch] = useState('');
  const [selectedDoctor, setSelectedDoctor] = useState<number>(0);

  // 환자, 의사 및 진료 목록 로드
  useEffect(() => {
    if (isOpen) {
      loadPatients();
      loadDoctors();
      loadEncounters();
    }
  }, [isOpen]);

  // 환자 선택 시 해당 환자의 진료만 필터링
  useEffect(() => {
    if (formData.patient) {
      const patientEncounters = encounters.filter(
        (e) => e.patient === formData.patient && e.status !== 'cancelled'
      );
      setFilteredEncounters(patientEncounters);
      // 진료가 1개면 자동 선택
      if (patientEncounters.length === 1) {
        setFormData(prev => ({ ...prev, encounter: patientEncounters[0].id }));
      } else {
        setFormData(prev => ({ ...prev, encounter: 0 }));
      }
    } else {
      setFilteredEncounters([]);
    }
  }, [formData.patient, encounters]);

  const loadPatients = async () => {
    try {
      const response = await getPatients({ page: 1, page_size: 1000, status: 'active' });
      const patientList = Array.isArray(response) ? response : response.results || [];
      setPatients(patientList);
    } catch (err) {
      console.error('환자 목록 로드 실패:', err);
    }
  };

  const loadDoctors = async () => {
    try {
      const response = await api.get('/users/', {
        params: { page_size: 1000 }
      });
      const userList = Array.isArray(response.data) ? response.data : response.data.results || [];
      const doctorList = userList.filter((user: any) => user.role?.code === 'DOCTOR');
      setDoctors(doctorList);
    } catch (err) {
      console.error('의사 목록 로드 실패:', err);
    }
  };

  const loadEncounters = async () => {
    try {
      const response = await getEncounters({ page: 1, page_size: 1000 });
      const encounterList = Array.isArray(response) ? response : response.results || [];
      setEncounters(encounterList);
    } catch (err) {
      console.error('진료 목록 로드 실패:', err);
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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    // Validation
    if (!formData.patient) {
      setError('환자를 선택해주세요.');
      return;
    }
    // encounter는 외부 환자의 경우 선택하지 않아도 됨
    if (!formData.modality) {
      setError('검사 종류를 선택해주세요.');
      return;
    }

    setLoading(true);
    try {
      // encounter가 0이면 null로 변환하여 전송
      const submitData = {
        ...formData,
        encounter: formData.encounter || null,
      };
      await createImagingStudy(submitData);
      alert('영상 검사 오더가 생성되었습니다.');
      onSuccess();
    } catch (err: any) {
      console.error('영상 검사 오더 생성 실패:', err);
      setError(err.response?.data?.detail || err.response?.data?.error || '오더 생성에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: name === 'patient' || name === 'encounter' ? parseInt(value) || 0 : value
    }));
  };

  const handleClose = () => {
    if (!loading) {
      onClose();
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal-content encounter-modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>영상 검사 오더 생성</h2>
          <button className="modal-close" onClick={handleClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

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
                    name="patient"
                    value={formData.patient || ''}
                    onChange={handleChange}
                    required
                    size={5}
                    className="searchable-select"
                  >
                    <option value="">환자를 선택하세요</option>
                    {filteredPatients.map((patient) => (
                      <option key={patient.id} value={patient.id}>
                        {patient.patient_number} - {patient.name} ({patient.gender === 'M' ? '남' : '여'}, {patient.age}세)
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>오더 의사 선택</label>
                  <input
                    type="text"
                    placeholder="의사 검색 (이름 또는 이메일)"
                    value={doctorSearch}
                    onChange={(e) => setDoctorSearch(e.target.value)}
                    className="search-input"
                  />
                  <select
                    value={selectedDoctor || ''}
                    onChange={(e) => setSelectedDoctor(Number(e.target.value))}
                    size={5}
                    className="searchable-select"
                  >
                    <option value="">로그인 사용자로 자동 설정</option>
                    {filteredDoctors.map((doctor) => (
                      <option key={doctor.id} value={doctor.id}>
                        [ID: {doctor.id}] {doctor.name} ({doctor.email || '이메일 없음'})
                      </option>
                    ))}
                  </select>
                  <small style={{ color: '#666', fontSize: '0.85rem', marginTop: '0.25rem', display: 'block' }}>
                    선택하지 않으면 현재 로그인한 사용자로 설정됩니다.
                  </small>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="encounter">진료 선택 (외부환자는 생략 가능)</label>
                  <select
                    id="encounter"
                    name="encounter"
                    value={formData.encounter || 0}
                    onChange={handleChange}
                    disabled={!formData.patient}
                    size={3}
                    className="searchable-select"
                  >
                    <option value={0}>진료 없음 (외부 환자)</option>
                    {filteredEncounters.map((e) => (
                      <option key={e.id} value={e.id}>
                        {e.encounter_type_display} - {e.admission_date ? new Date(e.admission_date).toLocaleDateString('ko-KR') : '-'} - {e.chief_complaint}
                      </option>
                    ))}
                  </select>
                  {formData.patient && filteredEncounters.length === 0 && (
                    <small style={{ color: '#ff9800' }}>
                      선택한 환자에게 진행 중인 진료가 없습니다. 외부 환자로 오더를 생성합니다.
                    </small>
                  )}
                </div>
              </div>
            </div>

            <div className="form-section">
              <h3>검사 정보</h3>
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="modality">검사 종류 *</label>
                  <select
                    id="modality"
                    name="modality"
                    value={formData.modality}
                    onChange={handleChange}
                    required
                  >
                    <option value="MRI">MRI (Magnetic Resonance Imaging)</option>
                    <option value="CT">CT (Computed Tomography)</option>
                    <option value="PET">PET (Positron Emission Tomography)</option>
                    <option value="X-RAY">X-Ray</option>
                  </select>
                </div>

                <div className="form-group">
                  <label htmlFor="body_part">촬영 부위</label>
                  <input
                    type="text"
                    id="body_part"
                    name="body_part"
                    value={formData.body_part}
                    onChange={handleChange}
                    placeholder="예: brain, chest, abdomen"
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="scheduled_at">검사 예약 일시</label>
                  <input
                    type="datetime-local"
                    id="scheduled_at"
                    name="scheduled_at"
                    value={formData.scheduled_at}
                    onChange={handleChange}
                  />
                </div>
              </div>

              <div className="form-group">
                <label htmlFor="clinical_info">임상 정보</label>
                <textarea
                  id="clinical_info"
                  name="clinical_info"
                  value={formData.clinical_info}
                  onChange={handleChange}
                  rows={3}
                  placeholder="예: Headache, rule out brain tumor"
                />
              </div>

              <div className="form-group">
                <label htmlFor="special_instruction">특별 지시사항</label>
                <textarea
                  id="special_instruction"
                  name="special_instruction"
                  value={formData.special_instruction}
                  onChange={handleChange}
                  rows={2}
                  placeholder="검사 시 특별히 주의할 사항"
                />
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={handleClose} disabled={loading}>
              취소
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? '생성 중...' : '오더 생성'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
