/**
 * MyVisitsPage - 환자 전용 진료 기록 페이지
 *
 * 표시 내용:
 * - 과거 진료 기록 목록
 * - 진료 일자, 진료과, 담당의, 진단명
 */
import { useState, useEffect } from 'react';
import '@/assets/style/patient-portal.css';
import { getMyEncounters } from '@/services/patient-portal.api';
import type { MyEncounter } from '@/types/patient-portal';

export default function MyVisitsPage() {
  const [visits, setVisits] = useState<MyEncounter[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState(0);

  useEffect(() => {
    const fetchVisits = async () => {
      try {
        setError(null);
        const encountersResult = await getMyEncounters();
        setVisits(encountersResult.results || []);
        setTotalCount(encountersResult.count || 0);
      } catch (err) {
        console.error('Failed to fetch visits:', err);
        setError('진료 기록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchVisits();
  }, []);

  if (loading) {
    return (
      <div className="patient-portal-page">
        <div className="loading-state">진료 기록을 불러오는 중...</div>
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

  return (
    <div className="patient-portal-page">
      <div className="page-header">
        <h1>진료 기록</h1>
        <span className="result-count">{totalCount}건</span>
      </div>

      {visits.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <div className="empty-text">진료 기록이 없습니다.</div>
        </div>
      ) : (
        <div className="visit-list">
          {visits.map((visit) => (
            <div key={visit.id} className="visit-card">
              <div className="visit-header">
                <div className="visit-date">{visit.admission_date?.split('T')[0]}</div>
                <div className={`visit-status status-${visit.status === 'completed' ? 'completed' : 'scheduled'}`}>
                  {visit.status_display}
                </div>
              </div>
              <div className="visit-body">
                <div className="visit-info">
                  <span className="department">{visit.department_display || visit.encounter_type_display}</span>
                  <span className="doctor">{visit.attending_doctor_name} 선생님</span>
                </div>
                {visit.primary_diagnosis && (
                  <div className="diagnosis">
                    <span className="label">진단</span>
                    <span className="value">{visit.primary_diagnosis}</span>
                  </div>
                )}
                {visit.chief_complaint && (
                  <div className="diagnosis">
                    <span className="label">주소</span>
                    <span className="value">{visit.chief_complaint}</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
