import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getDoctorStats } from '@/services/dashboard.api';
import type { DoctorStats } from '@/services/dashboard.api';

export function DoctorWorklist() {
  const navigate = useNavigate();
  const [data, setData] = useState<DoctorStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadData = async () => {
      try {
        const result = await getDoctorStats();
        setData(result);
      } catch (err) {
        console.error('Failed to load doctor stats:', err);
        setError('데이터를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, []);

  // 환자 클릭 시 진료 페이지로 이동
  const handlePatientClick = (patientId: number) => {
    navigate(`/patientsCare?patientId=${patientId}`);
  };

  // 상태별 배지 클래스
  const getStatusClass = (status: string): string => {
    switch (status) {
      case 'in_progress':
        return 'in_progress';
      case 'completed':
        return 'completed';
      case 'scheduled':
        return 'scheduled';
      default:
        return '';
    }
  };

  // 상태 한글 변환
  const getStatusLabel = (status: string): string => {
    switch (status) {
      case 'in_progress':
        return '진료중';
      case 'completed':
        return '완료';
      case 'scheduled':
        return '대기';
      default:
        return status;
    }
  };

  // 진료 유형 한글 변환
  const getTypeLabel = (type: string): string => {
    switch (type) {
      case 'outpatient':
        return '외래';
      case 'inpatient':
        return '입원';
      case 'emergency':
        return '응급';
      default:
        return type;
    }
  };

  return (
    <section className="card worklist">
      <header className="card-header">
        <h3>금일 예약 환자</h3>
        <a href="/patientsCare">전체 보기</a>
      </header>

      {loading ? (
        <div className="loading-state">로딩 중...</div>
      ) : error ? (
        <div className="error-state">{error}</div>
      ) : !data || data.today_appointments.length === 0 ? (
        <div className="empty-state">오늘 예약된 환자가 없습니다.</div>
      ) : (
        <>
          {/* 요약 통계 */}
          <div className="worklist-stats">
            <span className="stat">총 {data.stats.total_today}명</span>
            <span className="stat waiting">대기 {data.stats.waiting}</span>
            <span className="stat in-progress">진료중 {data.stats.in_progress}</span>
            <span className="stat completed">완료 {data.stats.completed}</span>
          </div>

          <table className="table">
            <thead>
              <tr>
                <th>환자명</th>
                <th>상태</th>
                <th>진료 유형</th>
                <th>예약 시간</th>
              </tr>
            </thead>
            <tbody>
              {data.today_appointments.slice(0, 5).map((appointment) => (
                <tr
                  key={appointment.encounter_id}
                  className="clickable"
                  onClick={() => handlePatientClick(appointment.patient_id)}
                >
                  <td>
                    <div className="patient-cell">
                      <span className="patient-name">{appointment.patient_name}</span>
                      <span className="patient-number">{appointment.patient_number}</span>
                    </div>
                  </td>
                  <td>
                    <span className={`badge ${getStatusClass(appointment.status)}`}>
                      {getStatusLabel(appointment.status)}
                    </span>
                  </td>
                  <td>{getTypeLabel(appointment.encounter_type)}</td>
                  <td>{appointment.scheduled_time?.slice(0, 5) || '--:--'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}

      <style>{`
        .worklist-stats {
          display: flex;
          gap: 16px;
          padding: 12px 16px;
          background: var(--bg-secondary, #f5f5f5);
          border-bottom: 1px solid var(--border, #e0e0e0);
          font-size: 13px;
        }
        .worklist-stats .stat {
          color: var(--text-secondary, #666);
        }
        .worklist-stats .stat.waiting {
          color: var(--warning, #f2a65a);
        }
        .worklist-stats .stat.in-progress {
          color: var(--info, #5b8def);
        }
        .worklist-stats .stat.completed {
          color: var(--success, #5fb3a2);
        }
        .patient-cell {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .patient-cell .patient-name {
          font-weight: 500;
          color: var(--text-main, #1f2937);
        }
        .patient-cell .patient-number {
          font-size: 11px;
          color: var(--text-sub, #6b7280);
          font-family: monospace;
        }
        .loading-state, .error-state, .empty-state {
          padding: 32px;
          text-align: center;
          color: var(--text-sub, #6b7280);
        }
        .error-state {
          color: var(--danger, #e56b6f);
        }
        .badge.scheduled {
          background: #fef4e6;
          color: var(--warning, #f2a65a);
        }
        .badge.completed {
          background: #e8f8f0;
          color: var(--success, #5fb3a2);
        }
      `}</style>
    </section>
  );
}
