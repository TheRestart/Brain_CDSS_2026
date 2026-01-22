import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import PatientDetailTabs from './PatientDetailTabs';
import PatientDetailContent from './PatientDetailContent';
import PatientSummaryModal from './components/PatientSummaryModal';
import { useEffect, useState } from 'react';
import { getPatient } from '@/services/patient.api';
import type { Patient } from '@/types/patient';
import '@/assets/style/patientDetailView.css';

export default function PatientDetailPage() {
  const { role } = useAuth();
  const { patientId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();

  // 의사/시스템관리자만 OCS 생성 및 진료 가능
  const canCreateOCS = role === 'DOCTOR' || role === 'SYSTEMMANAGER';
  const canStartCare = role === 'DOCTOR' || role === 'SYSTEMMANAGER';

  const [patient, setPatient] = useState<Patient | null>(null);
  const [loading, setLoading] = useState(true);
  const [isSummaryModalOpen, setIsSummaryModalOpen] = useState(false);

  // 탭 파라미터가 없으면 기본값 설정 (최초 1회만)
  const currentTab = params.get('tab');
  useEffect(() => {
    if (!currentTab) {
      setParams({ tab: 'summary' }, { replace: true });
    }
  }, [currentTab, setParams]);

  useEffect(() => {
    const fetchPatient = async () => {
      if (!patientId) {
        console.log('patientId가 없습니다');
        setLoading(false);
        return;
      }

      console.log('환자 데이터 로딩 시작, patientId:', patientId);

      try {
        const data = await getPatient(Number(patientId));
        console.log('환자 데이터 로딩 성공:', data);
        setPatient(data);
      } catch (err) {
        console.error('환자 데이터 로딩 실패:', err);
        alert(`환자 정보를 불러오는데 실패했습니다: ${err}`);
      } finally {
        setLoading(false);
        console.log('로딩 완료');
      }
    };

    fetchPatient();
  }, [patientId]);

  // 접근 권한 체크
  if (!role) return <div>접근 권한 정보 없음</div>;

  if (loading) {
    return (
      <div className="page patient-detail">
        <div>로딩 중...</div>
      </div>
    );
  }

  if (!patient) {
    return (
      <div className="page patient-detail">
        <div>환자를 찾을 수 없습니다.</div>
      </div>
    );
  }

  const getGenderDisplay = (gender: string) => {
    const genderMap: Record<string, string> = {
      M: '남성',
      F: '여성',
      O: '기타',
    };
    return genderMap[gender] || gender;
  };

  return (
    <div className="page patient-detail">
      {/* Header 영역 - 환자 기본 정보 */}
      <section className="page-header">
        <div className="header-right">
          <button className="btn" onClick={() => setIsSummaryModalOpen(true)}>
            환자 요약
          </button>
          {canCreateOCS && (
            <button
              className="btn"
              onClick={() => navigate(`/ocs/create?patientId=${patientId}`)}
            >
              OCS 생성
            </button>
          )}
          {canStartCare && (
            <button
              className="btn btn-primary"
              onClick={() => navigate(`/patientsCare?patientId=${patientId}`)}
            >
              진료하기
            </button>
          )}
        </div>
      </section>

      {/* 환자 정보 */}
      <section className="patient-info-bar">
        <div className="info-item">
          <span>환자번호:</span>
          <span>{patient.patient_number}</span>
        </div>
        <div className="info-item">
          <span>이름:</span>
          <span>{patient.name}</span>
        </div>
        <div className="info-item">
          <span>나이:</span>
          <span>{patient.age}세</span>
        </div>
        <div className="info-item">
          <span>성별:</span>
          <span>{getGenderDisplay(patient.gender)}</span>
        </div>
      </section>

      <PatientDetailTabs role={role} />
      <PatientDetailContent role={role} patientName={patient.name} patientNumber={patient.patient_number} />

      {/* 환자 요약 모달 */}
      <PatientSummaryModal
        isOpen={isSummaryModalOpen}
        onClose={() => setIsSummaryModalOpen(false)}
        patientId={Number(patientId)}
      />
    </div>
  );
}
