/**
 * OCS 생성 페이지
 * - /ocs/create
 * - URL 파라미터: patientId (선택), encounterId (선택)
 * - 환자 선택, 검사 유형 선택, 우선순위 설정 후 OCS 생성
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { createOCS, createExternalPatientOCS } from '@/services/ocs.api';
import { getPatients, getPatient } from '@/services/patient.api';
import { fetchExternalInstitutions, type ExternalInstitution } from '@/services/users.api';
import type { Patient } from '@/types/patient';
import type { OCSCreateData, JobRole, Priority } from '@/types/ocs';
import { JOB_ROLE_LABELS, PRIORITY_LABELS } from '@/types/ocs';
import './OCSCreatePage.css';

// 작업 유형 옵션
const JOB_TYPE_OPTIONS: Record<JobRole, { code: string; name: string }[]> = {
  RIS: [
    { code: 'CT', name: 'CT (컴퓨터 단층촬영)' },
    { code: 'MRI', name: 'MRI (자기공명영상)' },
    { code: 'PET', name: 'PET (양전자방출단층촬영)' },
    { code: 'X-RAY', name: 'X-RAY (일반촬영)' },
    { code: 'Ultrasound', name: 'Ultrasound (초음파)' },
    { code: 'Mammography', name: 'Mammography (유방촬영)' },
    { code: 'Fluoroscopy', name: 'Fluoroscopy (투시촬영)' },
  ],
  LIS: [
    // 혈액 검사 (BLOOD)
    { code: 'CBC', name: 'CBC (일반혈액검사)' },
    { code: 'BMP', name: 'BMP (기초대사패널)' },
    { code: 'CMP', name: 'CMP (종합대사패널)' },
    { code: 'Lipid Panel', name: 'Lipid Panel (지질검사)' },
    { code: 'LFT', name: 'LFT (간기능검사)' },
    { code: 'RFT', name: 'RFT (신장기능검사)' },
    { code: 'Thyroid Panel', name: 'Thyroid Panel (갑상선패널)' },
    { code: 'Coagulation', name: 'Coagulation (응고검사)' },
    { code: 'Urinalysis', name: 'Urinalysis (소변검사)' },
    { code: 'Tumor Markers', name: 'Tumor Markers (종양표지자)' },
    // 유전자 검사 (GENETIC)
    { code: 'GENETIC', name: 'GENETIC (유전자검사)' },
    { code: 'RNA_SEQ', name: 'RNA_SEQ (RNA 시퀀싱)' },
    { code: 'DNA_SEQ', name: 'DNA_SEQ (DNA 시퀀싱)' },
    { code: 'GENE_PANEL', name: 'GENE_PANEL (유전자패널)' },
    // 단백질 검사 (PROTEIN)
    { code: 'PROTEIN', name: 'PROTEIN (단백질검사)' },
    { code: 'PROTEIN_PANEL', name: 'PROTEIN_PANEL (단백질패널)' },
    { code: 'BIOMARKER', name: 'BIOMARKER (바이오마커)' },
  ],
  TREATMENT: [
    { code: 'Chemotherapy', name: 'Chemotherapy (화학요법)' },
    { code: 'Radiation', name: 'Radiation (방사선치료)' },
    { code: 'Surgery', name: 'Surgery (수술)' },
    { code: 'Biopsy', name: 'Biopsy (조직검사)' },
    { code: 'Injection', name: 'Injection (주사)' },
  ],
  CONSULT: [
    { code: 'Neurology', name: 'Neurology (신경과)' },
    { code: 'Oncology', name: 'Oncology (종양과)' },
    { code: 'Radiology', name: 'Radiology (영상의학과)' },
    { code: 'Pathology', name: 'Pathology (병리과)' },
  ],
};

export default function OCSCreatePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();

  // URL에서 patientId, encounterId 가져오기
  const urlPatientId = searchParams.get('patientId');
  const urlEncounterId = searchParams.get('encounterId');

  // 폼 상태
  const [formData, setFormData] = useState<Partial<OCSCreateData>>({
    job_role: 'RIS',
    job_type: '',
    priority: 'normal',
    patient_id: 0,
    encounter_id: urlEncounterId ? parseInt(urlEncounterId) : undefined,
  });

  // 환자 검색 상태
  const [patientSearchQuery, setPatientSearchQuery] = useState('');
  const [patientSearchResults, setPatientSearchResults] = useState<Patient[]>([]);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [isSearching, setIsSearching] = useState(false);
  const [showPatientDropdown, setShowPatientDropdown] = useState(false);

  // 검사 유형 검색
  const [jobTypeSearch, setJobTypeSearch] = useState('');

  // 제출 상태
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 임상 정보
  const [clinicalInfo, setClinicalInfo] = useState('');
  const [specialInstruction, setSpecialInstruction] = useState('');

  // 외부기관 상태
  const [isExternalInstitution, setIsExternalInstitution] = useState(false);
  const [selectedInstitution, setSelectedInstitution] = useState<ExternalInstitution | null>(null);
  const [institutions, setInstitutions] = useState<ExternalInstitution[]>([]);
  const [institutionSearch, setInstitutionSearch] = useState('');
  const [showInstitutionDropdown, setShowInstitutionDropdown] = useState(false);

  // 외부환자 정보 상태
  const [externalPatientName, setExternalPatientName] = useState('');
  const [externalPatientBirthDate, setExternalPatientBirthDate] = useState('');
  const [externalPatientGender, setExternalPatientGender] = useState<'M' | 'F' | 'O'>('M');

  // URL에서 patientId가 있으면 해당 환자 정보 로드
  useEffect(() => {
    if (urlPatientId) {
      const loadPatient = async () => {
        try {
          const patient = await getPatient(parseInt(urlPatientId));
          setSelectedPatient(patient);
          setFormData(prev => ({ ...prev, patient_id: patient.id }));
          setPatientSearchQuery(`${patient.name} (${patient.patient_number})`);
        } catch (error) {
          console.error('Failed to load patient:', error);
        }
      };
      loadPatient();
    }
  }, [urlPatientId]);

  // 외부기관 목록 로드
  useEffect(() => {
    const loadInstitutions = async () => {
      try {
        const data = await fetchExternalInstitutions();
        setInstitutions(data);
      } catch (error) {
        console.error('Failed to load institutions:', error);
      }
    };
    loadInstitutions();
  }, []);

  // 환자 검색
  const searchPatients = useCallback(async (query: string) => {
    if (!query || query.length < 1) {
      setPatientSearchResults([]);
      setShowPatientDropdown(false);
      return;
    }

    setIsSearching(true);
    try {
      const response = await getPatients({ q: query, page_size: 10 });
      setPatientSearchResults(response.results);
      setShowPatientDropdown(true);
    } catch (error) {
      console.error('Failed to search patients:', error);
      setPatientSearchResults([]);
    } finally {
      setIsSearching(false);
    }
  }, []);

  // 검색어 변경 시 디바운스 적용
  useEffect(() => {
    // URL에서 환자가 이미 선택된 경우 검색하지 않음
    if (selectedPatient) return;

    const timer = setTimeout(() => {
      searchPatients(patientSearchQuery);
    }, 300);

    return () => clearTimeout(timer);
  }, [patientSearchQuery, searchPatients, selectedPatient]);

  // 환자 선택
  const handlePatientSelect = (patient: Patient) => {
    setSelectedPatient(patient);
    setFormData(prev => ({ ...prev, patient_id: patient.id }));
    setPatientSearchQuery(`${patient.name} (${patient.patient_number})`);
    setShowPatientDropdown(false);
  };

  // 환자 선택 해제
  const handlePatientClear = () => {
    setSelectedPatient(null);
    setFormData(prev => ({ ...prev, patient_id: 0 }));
    setPatientSearchQuery('');
    setPatientSearchResults([]);
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // 외부기관 검사인 경우
    if (isExternalInstitution) {
      // 외부기관 선택 필수
      if (!selectedInstitution) {
        alert('외부기관을 선택해주세요.');
        return;
      }
      // 외부환자 정보 필수
      if (!externalPatientName.trim()) {
        alert('외부 환자 이름을 입력해주세요.');
        return;
      }
      if (!externalPatientBirthDate) {
        alert('외부 환자 생년월일을 입력해주세요.');
        return;
      }
      // 검사 유형 필수
      if (!formData.job_type) {
        alert('검사 유형을 선택해주세요.');
        return;
      }

      setIsSubmitting(true);
      try {
        // 외부환자 + OCS 통합 생성 API 호출
        const response = await createExternalPatientOCS({
          patient: {
            name: externalPatientName.trim(),
            birth_date: externalPatientBirthDate,
            gender: externalPatientGender,
            institution_id: selectedInstitution.id,
          },
          ocs: {
            job_role: formData.job_role as string,
            job_type: formData.job_type,
            priority: formData.priority as string,
            encounter_id: formData.encounter_id,
            doctor_request: {
              clinical_info: clinicalInfo,
              request_detail: `${formData.job_type} 검사 요청`,
              special_instruction: specialInstruction,
            },
          },
        });

        alert(`외부환자 등록 및 OCS 생성이 완료되었습니다.\n환자번호: ${response.patient.patient_number}`);
        navigate('/ocs/status');
      } catch (error) {
        console.error('Failed to create external patient OCS:', error);
        alert('외부환자 등록 및 OCS 생성에 실패했습니다.');
      } finally {
        setIsSubmitting(false);
      }
      return;
    }

    // 내부환자인 경우 (기존 로직)
    if (!formData.patient_id || !formData.job_type) {
      alert('환자와 검사 유형을 선택해주세요.');
      return;
    }

    setIsSubmitting(true);
    try {
      const createData: OCSCreateData = {
        patient_id: formData.patient_id,
        job_role: formData.job_role as JobRole,
        job_type: formData.job_type,
        priority: formData.priority as Priority,
        encounter_id: formData.encounter_id,
        doctor_request: {
          _template: 'default',
          _version: '1.0',
          clinical_info: clinicalInfo,
          request_detail: `${formData.job_type} 검사 요청`,
          special_instruction: specialInstruction,
        },
      };

      await createOCS(createData);
      alert('OCS가 생성되었습니다.');

      // 이전 페이지로 돌아가거나 OCS 목록으로 이동
      if (urlPatientId) {
        navigate(-1); // 진료 페이지에서 왔으면 뒤로가기
      } else {
        navigate('/ocs/status'); // OCS 현황 목록으로 이동
      }
    } catch (error) {
      console.error('Failed to create OCS:', error);
      alert('OCS 생성에 실패했습니다.');
    } finally {
      setIsSubmitting(false);
    }
  };

  // 취소
  const handleCancel = () => {
    navigate(-1);
  };

  // 현재 선택된 job_role에 따른 검사 유형 필터링
  const filteredJobTypes = (JOB_TYPE_OPTIONS[formData.job_role as JobRole] || [])
    .filter(type =>
      type.code.toLowerCase().includes(jobTypeSearch.toLowerCase()) ||
      type.name.toLowerCase().includes(jobTypeSearch.toLowerCase())
    );

  return (
    <div className="page ocs-create-page">
      <div className="page-header">
        <h1>OCS 생성</h1>
        <p className="page-subtitle">새로운 검사/처치 오더를 생성합니다</p>
      </div>

      <form className="ocs-create-form" onSubmit={handleSubmit}>
        {/* 환자 선택 섹션 - 외부기관 검사가 아닐 때만 표시 */}
        {!isExternalInstitution && (
        <section className="form-section">
          <h2>환자 정보</h2>

          <div className="form-group">
            <label>환자 선택 <span className="required">*</span></label>
            <div className="patient-search-container">
              <div className="search-input-wrapper">
                <input
                  type="text"
                  value={patientSearchQuery}
                  onChange={(e) => {
                    setPatientSearchQuery(e.target.value);
                    if (selectedPatient) {
                      setSelectedPatient(null);
                      setFormData(prev => ({ ...prev, patient_id: 0 }));
                    }
                  }}
                  onFocus={() => {
                    if (patientSearchResults.length > 0 && !selectedPatient) {
                      setShowPatientDropdown(true);
                    }
                  }}
                  placeholder="환자명 또는 환자번호로 검색"
                  className={selectedPatient ? 'selected' : ''}
                  disabled={!!urlPatientId}
                />
                {selectedPatient && !urlPatientId && (
                  <button
                    type="button"
                    className="clear-btn"
                    onClick={handlePatientClear}
                  >
                    &times;
                  </button>
                )}
                {isSearching && <span className="searching-indicator">검색 중...</span>}
              </div>

              {/* 검색 결과 드롭다운 */}
              {showPatientDropdown && patientSearchResults.length > 0 && !selectedPatient && (
                <ul className="patient-dropdown">
                  {patientSearchResults.map((patient) => (
                    <li
                      key={patient.id}
                      onClick={() => handlePatientSelect(patient)}
                      className="patient-item"
                    >
                      <span className="patient-name">{patient.name}</span>
                      <span className="patient-info">
                        {patient.patient_number} | {patient.gender === 'M' ? '남' : patient.gender === 'F' ? '여' : '기타'} | {patient.age}세
                      </span>
                    </li>
                  ))}
                </ul>
              )}

              {showPatientDropdown && patientSearchQuery && patientSearchResults.length === 0 && !isSearching && !selectedPatient && (
                <div className="no-results">검색 결과가 없습니다.</div>
              )}
            </div>

            {selectedPatient && (
              <div className="selected-patient-card">
                <div className="patient-avatar">
                  {selectedPatient.name.charAt(0)}
                </div>
                <div className="patient-details">
                  <strong>{selectedPatient.name}</strong>
                  <span>{selectedPatient.patient_number}</span>
                  <span>{selectedPatient.gender === 'M' ? '남' : selectedPatient.gender === 'F' ? '여' : '기타'}</span>
                  <span>{selectedPatient.age}세</span>
                  <span>{selectedPatient.phone}</span>
                </div>
              </div>
            )}
          </div>
        </section>
        )}

        {/* 검사 정보 섹션 */}
        <section className="form-section">
          <h2>검사 정보</h2>

          <div className="form-row">
            <div className="form-group">
              <label>검사 분류 <span className="required">*</span></label>
              <div className="job-role-buttons">
                {Object.entries(JOB_ROLE_LABELS).map(([value, label]) => (
                  <button
                    key={value}
                    type="button"
                    className={`role-btn ${formData.job_role === value ? 'active' : ''}`}
                    onClick={() => {
                      setFormData(prev => ({ ...prev, job_role: value as JobRole, job_type: '' }));
                      setJobTypeSearch('');
                    }}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>

            <div className="form-group">
              <label>우선순위</label>
              <select
                value={formData.priority}
                onChange={(e) => {
                  setFormData(prev => ({
                    ...prev,
                    priority: e.target.value as Priority,
                  }));
                }}
              >
                {Object.entries(PRIORITY_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* 외부기관 체크박스 */}
          <div className="form-group external-institution-group">
            <label className="checkbox-label">
              <input
                type="checkbox"
                checked={isExternalInstitution}
                onChange={(e) => {
                  setIsExternalInstitution(e.target.checked);
                  if (!e.target.checked) {
                    setSelectedInstitution(null);
                    setInstitutionSearch('');
                    setShowInstitutionDropdown(false);
                  }
                }}
              />
              <span>외부기관 검사</span>
            </label>
          </div>

          {/* 외부기관 선택 드롭다운 */}
          {isExternalInstitution && (
            <div className="form-group">
              <label>외부기관 선택 <span className="required">*</span></label>
              <div className="institution-search-container">
                <div className="search-input-wrapper">
                  <input
                    type="text"
                    value={institutionSearch}
                    onChange={(e) => {
                      setInstitutionSearch(e.target.value);
                      setShowInstitutionDropdown(true);
                      if (selectedInstitution) {
                        setSelectedInstitution(null);
                      }
                    }}
                    onFocus={() => setShowInstitutionDropdown(true)}
                    placeholder="기관명 또는 기관코드 검색"
                    className={selectedInstitution ? 'selected' : ''}
                  />
                  {selectedInstitution && (
                    <button
                      type="button"
                      className="clear-btn"
                      onClick={() => {
                        setSelectedInstitution(null);
                        setInstitutionSearch('');
                        setShowInstitutionDropdown(false);
                      }}
                    >
                      &times;
                    </button>
                  )}
                </div>

                {showInstitutionDropdown && !selectedInstitution && (
                  <ul className="institution-dropdown">
                    {institutions
                      .filter(inst =>
                        inst.name.toLowerCase().includes(institutionSearch.toLowerCase()) ||
                        inst.code.toLowerCase().includes(institutionSearch.toLowerCase())
                      )
                      .map(inst => (
                        <li
                          key={inst.id}
                          onClick={() => {
                            setSelectedInstitution(inst);
                            setInstitutionSearch(`${inst.name} (${inst.code})`);
                            setShowInstitutionDropdown(false);
                          }}
                          className="institution-item"
                        >
                          <span className="institution-name">{inst.name}</span>
                          <span className="institution-code">{inst.code}</span>
                        </li>
                      ))}
                    {institutions.filter(inst =>
                      inst.name.toLowerCase().includes(institutionSearch.toLowerCase()) ||
                      inst.code.toLowerCase().includes(institutionSearch.toLowerCase())
                    ).length === 0 && (
                      <div className="no-results">검색 결과가 없습니다.</div>
                    )}
                  </ul>
                )}
              </div>
            </div>
          )}

          {/* 외부환자 정보 입력 */}
          {isExternalInstitution && selectedInstitution && (
            <div className="external-patient-form">
              <h3>외부 환자 정보</h3>
              <p className="form-hint">
                환자번호는 자동 생성됩니다: {selectedInstitution.code}-{new Date().toISOString().slice(0, 10).replace(/-/g, '')}-001
              </p>
              <div className="form-row three-cols">
                <div className="form-group">
                  <label>환자명 <span className="required">*</span></label>
                  <input
                    type="text"
                    value={externalPatientName}
                    onChange={(e) => setExternalPatientName(e.target.value)}
                    placeholder="환자 이름 입력"
                  />
                </div>
                <div className="form-group">
                  <label>생년월일 <span className="required">*</span></label>
                  <input
                    type="date"
                    value={externalPatientBirthDate}
                    onChange={(e) => setExternalPatientBirthDate(e.target.value)}
                  />
                </div>
                <div className="form-group">
                  <label>성별 <span className="required">*</span></label>
                  <select
                    value={externalPatientGender}
                    onChange={(e) => setExternalPatientGender(e.target.value as 'M' | 'F' | 'O')}
                  >
                    <option value="M">남성</option>
                    <option value="F">여성</option>
                    <option value="O">기타</option>
                  </select>
                </div>
              </div>
            </div>
          )}

          <div className="form-group">
            <label>검사 유형 <span className="required">*</span></label>
            <input
              type="text"
              placeholder="검사 유형 검색 (예: CT, MRI, CBC...)"
              value={jobTypeSearch}
              onChange={(e) => setJobTypeSearch(e.target.value)}
              className="search-input"
            />
            <div className="job-type-grid">
              {filteredJobTypes.map((type) => (
                <button
                  key={type.code}
                  type="button"
                  className={`job-type-btn ${formData.job_type === type.code ? 'selected' : ''}`}
                  onClick={() => setFormData(prev => ({ ...prev, job_type: type.code }))}
                >
                  <span className="job-type-code">{type.code}</span>
                  <span className="job-type-name">{type.name}</span>
                </button>
              ))}
              {filteredJobTypes.length === 0 && (
                <div className="no-job-types">검색 결과가 없습니다.</div>
              )}
            </div>
          </div>
        </section>

        {/* 추가 정보 섹션 */}
        <section className="form-section">
          <h2>추가 정보</h2>

          <div className="form-group">
            <label>임상 정보</label>
            <textarea
              value={clinicalInfo}
              onChange={(e) => setClinicalInfo(e.target.value)}
              placeholder="환자의 증상, 병력 등 임상 정보를 입력하세요"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>특별 지시사항</label>
            <textarea
              value={specialInstruction}
              onChange={(e) => setSpecialInstruction(e.target.value)}
              placeholder="검사 시 특별히 주의할 사항을 입력하세요 (예: 조영제 사용, 공복 필요 등)"
              rows={2}
            />
          </div>
        </section>

        {/* 액션 버튼 */}
        <div className="form-actions">
          <button type="button" className="btn secondary" onClick={handleCancel}>
            취소
          </button>
          <button
            type="submit"
            className="btn primary"
            disabled={
              isSubmitting ||
              !formData.job_type ||
              (isExternalInstitution
                ? !selectedInstitution || !externalPatientName.trim() || !externalPatientBirthDate
                : !formData.patient_id)
            }
          >
            {isSubmitting ? '생성 중...' : isExternalInstitution ? '외부환자 등록 + OCS 생성' : 'OCS 생성'}
          </button>
        </div>
      </form>
    </div>
  );
}
