/**
 * MySummaryPage - 환자 전용 내 정보 요약 페이지
 *
 * 표시 내용:
 * - 기본 프로필 정보
 * - 다음 예약 일정
 * - 최근 검사 결과 요약
 */
import { useState, useEffect } from 'react';
import '@/assets/style/patient-portal.css';
import { getMyPatientInfo, getMyOCS, getMyEncounters } from '@/services/patient-portal.api';
import type { MyPatientInfo, MyEncounter } from '@/types/patient-portal';

interface NextAppointment {
  date: string;
  department: string;
  doctor: string;
}

interface OCSCounts {
  ris: number;
  lis: number;
}

export default function MySummaryPage() {
  const [patientInfo, setPatientInfo] = useState<MyPatientInfo | null>(null);
  const [ocsCounts, setOcsCounts] = useState<OCSCounts>({ ris: 0, lis: 0 });
  const [nextAppointment, setNextAppointment] = useState<NextAppointment | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchSummary = async () => {
      try {
        setError(null);
        // 병렬로 API 호출
        const [patient, risOcs, lisOcs, encounters] = await Promise.all([
          getMyPatientInfo(),
          getMyOCS({ job_role: 'RIS' }),
          getMyOCS({ job_role: 'LIS' }),
          getMyEncounters(),
        ]);

        setPatientInfo(patient);
        setOcsCounts({
          ris: risOcs.count || 0,
          lis: lisOcs.count || 0,
        });

        // 가장 최근 예정된 진료 찾기
        const scheduled = (encounters.results || []).find((e: MyEncounter) => e.status === 'scheduled');
        if (scheduled) {
          setNextAppointment({
            date: scheduled.admission_date,
            department: scheduled.department_display || '미정',
            doctor: scheduled.attending_doctor_name,
          });
        }
      } catch (err) {
        console.error('Failed to fetch summary:', err);
        setError('정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchSummary();
  }, []);

  if (loading) {
    return (
      <div className="patient-portal-page">
        <div className="loading-state">정보를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-portal-page">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  const genderDisplay = patientInfo?.gender === 'M' ? '남성' : patientInfo?.gender === 'F' ? '여성' : '-';

  return (
    <div className="patient-portal-page">
      <div className="page-header">
        <h1>내 정보</h1>
      </div>

      <div className="summary-grid">
        {/* 기본 정보 카드 */}
        <div className="summary-card profile-card">
          <div className="card-header">
            <h3>기본 정보</h3>
          </div>
          <div className="card-body">
            <div className="info-row">
              <span className="label">이름</span>
              <span className="value">{patientInfo?.name || '-'}</span>
            </div>
            <div className="info-row">
              <span className="label">생년월일</span>
              <span className="value">{patientInfo?.birth_date || '-'}</span>
            </div>
            <div className="info-row">
              <span className="label">성별</span>
              <span className="value">{genderDisplay}</span>
            </div>
            <div className="info-row">
              <span className="label">연락처</span>
              <span className="value">{patientInfo?.phone || '-'}</span>
            </div>
          </div>
        </div>

        {/* 다음 예약 카드 */}
        <div className="summary-card appointment-card">
          <div className="card-header">
            <h3>다음 예약</h3>
          </div>
          <div className="card-body">
            {nextAppointment ? (
              <>
                <div className="appointment-date">
                  {nextAppointment.date}
                </div>
                <div className="appointment-info">
                  <span>{nextAppointment.department}</span>
                  <span>{nextAppointment.doctor} 선생님</span>
                </div>
              </>
            ) : (
              <div className="empty-state">예정된 예약이 없습니다.</div>
            )}
          </div>
        </div>

        {/* 검사 결과 요약 카드 */}
        <div className="summary-card results-card">
          <div className="card-header">
            <h3>검사 결과</h3>
          </div>
          <div className="card-body">
            <div className="result-counts">
              <div className="result-item">
                <span className="count">{ocsCounts.ris}</span>
                <span className="label">영상 검사</span>
              </div>
              <div className="result-item">
                <span className="count">{ocsCounts.lis}</span>
                <span className="label">검사 결과</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
