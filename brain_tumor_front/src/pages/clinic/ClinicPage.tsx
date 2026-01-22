/**
 * Clinic 진료 페이지 (스토리보드 48p 기반)
 * 3컬럼 그리드 레이아웃 - 환자 진료 화면
 */
import { useState, useEffect, useCallback } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { getPatient } from '@/services/patient.api';
import { getOCSByPatient } from '@/services/ocs.api';
import { getEncounters, createEncounter, completeEncounter } from '@/services/encounter.api';
import { LoadingSpinner, useToast } from '@/components/common';
import { useAuth } from '@/pages/auth/AuthProvider';
import ExaminationTab from './components/ExaminationTab';
import type { OCSListItem } from '@/types/ocs';
import type { Encounter } from '@/types/encounter';
import './ClinicPage.css';

interface Patient {
  id: number;
  patient_number: string;
  name: string;
  birth_date: string;
  gender: string;
  phone?: string;
}

export default function ClinicPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const toast = useToast();
  const { role, user } = useAuth();

  // 진료 시작 가능 역할 확인 (DOCTOR, SYSTEMMANAGER)
  const canStartEncounter = role === 'DOCTOR' || role === 'SYSTEMMANAGER';

  // URL에서 환자 ID, encounter ID 추출
  const patientIdParam = searchParams.get('patientId');
  const encounterIdParam = searchParams.get('encounterId');

  // /patientsCare → /patientsCare?patientId=null 로 리다이렉트
  useEffect(() => {
    if (patientIdParam === null) {
      navigate('/patientsCare?patientId=null', { replace: true });
    }
  }, [patientIdParam, navigate]);

  // patientId=null → 환자 미선택 상태
  const isPatientSelected = patientIdParam && patientIdParam !== 'null';

  // 환자 선택하지 않기 (OCS 등에서 돌아올 때 사용)
  const handleClearPatient = () => {
    navigate('/patientsCare?patientId=null');
  };

  // 상태
  const [patient, setPatient] = useState<Patient | null>(null);
  const [ocsList, setOcsList] = useState<OCSListItem[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEncounter, setActiveEncounter] = useState<Encounter | null>(null);

  // 진료 종료 시 과거 기록 새로고침용 키
  const [recordRefreshKey, setRecordRefreshKey] = useState(0);

  // 진료 종료 버튼 로딩 상태 (중복 클릭 방지)
  const [isEndingEncounter, setIsEndingEncounter] = useState(false);

  // 진료 중 환자 변경 확인 모달
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false);
  const [pendingPatientId, setPendingPatientId] = useState<number | null>(null);

  // 환자 데이터 로드
  const loadPatientData = useCallback(async (patientId: number) => {
    setLoading(true);
    try {
      // 환자 정보 조회
      const patientData = await getPatient(patientId);
      setPatient(patientData);

      // OCS 목록 조회
      const ocsData = await getOCSByPatient(patientId);
      setOcsList(ocsData);

      // 진료 기록 조회
      const encounterData = await getEncounters({ patient: patientId });
      setEncounters(encounterData.results || []);

      // URL에서 encounterId가 있으면 해당 encounter를 activeEncounter로 설정
      // 없으면 오늘 진행 중인 진료 찾기 (in_progress 우선, 없으면 scheduled)
      const allEncounters = encounterData.results || [];
      let activeEnc: Encounter | null = null;

      if (encounterIdParam) {
        activeEnc = allEncounters.find((e: Encounter) => e.id === Number(encounterIdParam)) || null;
      }

      if (!activeEnc) {
        const today = new Date().toISOString().split('T')[0];
        const todayEncounters = allEncounters.filter(
          (e: Encounter) => {
            const admissionDate = e.admission_date?.split('T')[0];
            return admissionDate === today;
          }
        );
        // in_progress 우선, 없으면 scheduled
        activeEnc = todayEncounters.find((e: Encounter) => e.status === 'in_progress')
          || todayEncounters.find((e: Encounter) => e.status === 'scheduled')
          || null;
      }
      setActiveEncounter(activeEnc);
    } catch (err) {
      console.error('Failed to load patient data:', err);
      toast.error('환자 데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [encounterIdParam]);  // encounterIdParam 변경 시 재로드

  useEffect(() => {
    if (isPatientSelected) {
      loadPatientData(Number(patientIdParam));
    } else {
      // 환자 미선택 - 상태 초기화
      setPatient(null);
      setOcsList([]);
      setEncounters([]);
      setActiveEncounter(null);
      setLoading(false);
    }
  }, [patientIdParam, encounterIdParam, isPatientSelected, loadPatientData]);

  // 진료 시작
  const handleStartEncounter = useCallback(async () => {
    if (!patient || !user?.id) {
      toast.error('로그인 정보를 확인해주세요.');
      return;
    }

    try {
      const encounter = await createEncounter({
        patient: patient.id,
        encounter_type: 'outpatient',
        status: 'in_progress',
        attending_doctor: user.id,
      });
      setActiveEncounter(encounter);
      toast.success('진료가 시작되었습니다.');
      // 진료 목록 새로고침
      const encounterData = await getEncounters({ patient: patient.id });
      setEncounters(encounterData.results || []);
    } catch (err: any) {
      console.error('Failed to start encounter:', err);
      console.error('Error response:', err.response?.data);
      const errorMsg = err.response?.data?.attending_doctor?.[0]
        || err.response?.data?.patient?.[0]
        || err.response?.data?.detail
        || '진료 시작에 실패했습니다.';
      toast.error(errorMsg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patient, user?.id]);

  // 진료 종료 (안전 저장)
  const handleEndEncounter = useCallback(async () => {
    if (!activeEncounter || !patient || isEndingEncounter) return;

    setIsEndingEncounter(true);
    try {
      await completeEncounter(activeEncounter.id);
      setActiveEncounter(null);
      toast.success('진료가 완료되었습니다.');
      // 진료 목록 새로고침
      const encounterData = await getEncounters({ patient: patient.id });
      setEncounters(encounterData.results || []);
      // 과거 기록(진료, 처방) 새로고침 트리거
      setRecordRefreshKey((k) => k + 1);
    } catch (err: any) {
      console.error('Failed to end encounter:', err);
      const errorMsg = err.response?.data?.detail || '진료 종료에 실패했습니다.';
      toast.error(errorMsg);
    } finally {
      setIsEndingEncounter(false);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEncounter, patient, isEndingEncounter]);

  // 다른 환자 선택 시 진료 중 확인
  const handlePatientChange = useCallback((newPatientId: number) => {
    // 같은 환자면 무시
    if (patient?.id === newPatientId) return;

    // 진료 중이면 확인 모달 표시
    if (activeEncounter && activeEncounter.status === 'in_progress') {
      setPendingPatientId(newPatientId);
      setShowLeaveConfirm(true);
    } else {
      // 진료 중 아니면 바로 이동
      navigate(`/patientsCare?patientId=${newPatientId}`);
    }
  }, [patient?.id, activeEncounter, navigate]);

  // 진료 종료 후 환자 변경
  const handleEndAndChangePatient = useCallback(async () => {
    if (!activeEncounter || !patient) return;

    try {
      await completeEncounter(activeEncounter.id);
      toast.success('진료가 완료되었습니다.');
      setShowLeaveConfirm(false);
      if (pendingPatientId) {
        navigate(`/patientsCare?patientId=${pendingPatientId}`);
      }
    } catch (err: any) {
      console.error('Failed to end encounter:', err);
      const errorMsg = err.response?.data?.detail || '진료 종료에 실패했습니다.';
      toast.error(errorMsg);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeEncounter, patient, pendingPatientId]);

  // 진료 종료 없이 환자 변경 (진료 상태 유지)
  const handleChangeWithoutEnd = useCallback(() => {
    setShowLeaveConfirm(false);
    if (pendingPatientId) {
      navigate(`/patientsCare?patientId=${pendingPatientId}`);
    }
  }, [pendingPatientId, navigate]);

  // 나이 계산
  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (loading && isPatientSelected) {
    return (
      <div className="page clinic-page">
        <LoadingSpinner text="환자 정보를 불러오는 중..." />
      </div>
    );
  }

  // 환자 ID가 있는데 환자를 찾을 수 없는 경우 (잘못된 ID)
  if (isPatientSelected && !patient) {
    return (
      <div className="page clinic-page">
        <div className="no-patient">
          <h2>환자를 찾을 수 없습니다</h2>
          <button className="btn btn-primary" onClick={() => navigate('/patients')}>
            환자 목록으로 이동
          </button>
        </div>
      </div>
    );
  }

  // 환자 미선택 상태용 더미 데이터
  const displayPatient = patient || {
    id: 0,
    patient_number: '-',
    name: '환자 ID 조회필요',
    birth_date: '-',
    gender: '',
    phone: '',
  };

  return (
    <div className="page clinic-page">
      {/* 환자 정보 헤더 */}
      <header className="patient-header enhanced">
        <div className="patient-info">
          <div className={`patient-avatar ${!patient ? 'patient-avatar-empty' : ''}`}>
            {patient
              ? (patient.gender === 'M' ? '👨' : '👩')
              : '❓'}
          </div>
          <div className="patient-details">
            <div className="patient-name-row">
              <h1 className="patient-name">{displayPatient.name}</h1>
              {!patient && <span className="patient-status-badge">미선택</span>}
              {patient && activeEncounter && <span className="encounter-status-badge">진료 중</span>}
            </div>
            <div className="patient-meta">
              {patient ? (
                <>
                  <span className="patient-number">{patient.patient_number}</span>
                  <span className="divider">|</span>
                  <span>{patient.birth_date} ({calculateAge(patient.birth_date)}세)</span>
                  <span className="divider">|</span>
                  <span>{patient.gender === 'M' ? '남성' : '여성'}</span>
                  {patient.phone && (
                    <>
                      <span className="divider">|</span>
                      <span>{patient.phone}</span>
                    </>
                  )}
                </>
              ) : (
                <span>예약 목록에서 환자를 선택하거나 환자 목록에서 검색하세요.</span>
              )}
            </div>
          </div>
        </div>

        {/* 퀵 액션 및 요약 */}
        <div className="header-right">
          {patient && (
            <div className="quick-stats">
              <div className="stat-item">
                <span className="stat-label">진료 기록</span>
                <span className="stat-value">{encounters.length}회</span>
              </div>
              <div className="stat-item">
                <span className="stat-label">검사 오더</span>
                <span className="stat-value">{ocsList.length}건</span>
              </div>
            </div>
          )}
          <div className="header-actions">
            {patient && !activeEncounter && canStartEncounter && (
              <button className="btn btn-primary" onClick={handleStartEncounter}>
                진료 시작
              </button>
            )}
            {patient && activeEncounter && canStartEncounter && (
              <button
                className="btn btn-success"
                onClick={handleEndEncounter}
                disabled={isEndingEncounter}
              >
                {isEndingEncounter ? '처리 중...' : '진료 종료'}
              </button>
            )}
            {patient && (
              <>
                <button
                  className="btn btn-secondary btn-icon-text"
                  onClick={() => navigate(`/patients/${patient.id}`)}
                  title="환자 상세 정보"
                >
                  <span>상세 보기</span>
                </button>
                <button
                  className="btn btn-outline"
                  onClick={handleClearPatient}
                  title="환자 선택하지 않기"
                >
                  환자 선택 해제
                </button>
              </>
            )}
          </div>
        </div>
      </header>

      {/* 진찰 컨텐츠 */}
      <div className="clinic-tab-content">
        <ExaminationTab
          patientId={patient?.id || 0}
          encounterId={activeEncounter?.id || null}
          encounter={activeEncounter}
          ocsList={ocsList}
          encounters={encounters}
          onUpdate={() => patient && loadPatientData(patient.id)}
          recordRefreshKey={recordRefreshKey}
          onPatientChange={handlePatientChange}
        />
      </div>

      {/* 진료 중 환자 변경 확인 모달 */}
      {showLeaveConfirm && (
        <div className="modal-backdrop" onClick={() => setShowLeaveConfirm(false)}>
          <div className="modal-content confirm-modal" onClick={(e) => e.stopPropagation()}>
            <h3>진료 중인 환자가 있습니다</h3>
            <p>
              현재 <strong>{patient?.name}</strong> 환자의 진료가 진행 중입니다.<br />
              다른 환자로 이동하시겠습니까?
            </p>
            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowLeaveConfirm(false)}
              >
                취소
              </button>
              <button
                className="btn btn-outline"
                onClick={handleChangeWithoutEnd}
              >
                진료 유지하고 이동
              </button>
              <button
                className="btn btn-success"
                onClick={handleEndAndChangePatient}
              >
                진료 종료 후 이동
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
