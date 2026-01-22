import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/pages/auth/AuthProvider';
import { getPatients } from '@/services/patient.api';
import type { Patient } from '@/types/patient';

type Props = {
  title?: string;
  limit?: number;
  showViewAll?: boolean;
  compact?: boolean;
};

/**
 * Dashboard용 환자 목록 위젯
 * - title: 카드 제목 (기본: "환자 목록")
 * - limit: 표시할 환자 수 (기본: 5)
 * - showViewAll: "전체 보기" 버튼 표시 여부 (기본: true)
 * - compact: 간소화 모드 (기본: false)
 */
export default function PatientListWidget({
  title = '환자 목록',
  limit = 5,
  showViewAll = true,
  compact = false,
}: Props) {
  const navigate = useNavigate();
  const { role } = useAuth();
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(true);

  const canStartCare = role === 'DOCTOR' || role === 'SYSTEMMANAGER';

  useEffect(() => {
    const fetchPatients = async () => {
      try {
        const response = await getPatients({ page: 1, page_size: limit });
        setPatients(response.results || []);
      } catch (error) {
        console.error('Failed to fetch patients:', error);
      } finally {
        setLoading(false);
      }
    };
    fetchPatients();
  }, [limit]);

  const getGenderShort = (gender: string) => {
    const genderMap: Record<string, string> = { 'M': '남', 'F': '여', 'O': '기타' };
    return genderMap[gender] || gender;
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'active': return { icon: '🟢', text: '활성' };
      case 'inactive': return { icon: '⚪', text: '비활성' };
      case 'deceased': return { icon: '🔴', text: '사망' };
      default: return { icon: '⚪', text: status };
    }
  };

  const getBloodTypeStyle = (bloodType: string | null) => {
    if (!bloodType) return { backgroundColor: '#f5f5f5', color: '#999' };
    const type = bloodType.replace(/[+-]/, '');
    const colorMap: Record<string, { bg: string; color: string }> = {
      'A': { bg: '#e3f2fd', color: '#1976d2' },
      'B': { bg: '#fff3e0', color: '#f57c00' },
      'O': { bg: '#e8f5e9', color: '#388e3c' },
      'AB': { bg: '#fce4ec', color: '#c2185b' },
    };
    return {
      backgroundColor: colorMap[type]?.bg || '#f5f5f5',
      color: colorMap[type]?.color || '#666',
    };
  };

  const handleStartCare = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    navigate(`/patientsCare?patientId=${patient.id}`);
  };

  return (
    <section className="card patient-list-widget">
      <header className="card-header" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <h3>{title}</h3>
        {showViewAll && (
          <button
            className="btn small"
            onClick={() => navigate('/patients')}
            style={{ fontSize: '0.8rem' }}
          >
            전체 보기
          </button>
        )}
      </header>

      <div className="widget-content">
        {loading ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            로딩 중...
          </div>
        ) : patients.length === 0 ? (
          <div style={{ textAlign: 'center', padding: '2rem', color: '#666' }}>
            등록된 환자가 없습니다.
          </div>
        ) : (
          <table className="table patient-widget-table">
            <thead>
              <tr>
                <th>환자 정보</th>
                {!compact && <th>성별/나이</th>}
                {!compact && <th>혈액형</th>}
                <th>상태</th>
                {canStartCare && <th style={{ textAlign: 'right' }}>작업</th>}
              </tr>
            </thead>
            <tbody>
              {patients.map(p => {
                const statusInfo = getStatusIcon(p.status);
                const bloodTypeStyle = getBloodTypeStyle(p.blood_type);

                return (
                  <tr
                    key={p.id}
                    className="patient-widget-row"
                    onClick={() => navigate(`/patients/${p.id}`)}
                    style={{ cursor: 'pointer' }}
                  >
                    {/* 환자 정보 */}
                    <td>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                        <span style={{ fontWeight: 600, color: '#1f2937' }}>{p.name}</span>
                        <span style={{ fontSize: '0.75rem', color: '#6b7280' }}>
                          {p.patient_number}
                          {compact && ` · ${getGenderShort(p.gender)}/${p.age}세`}
                        </span>
                      </div>
                    </td>

                    {/* 성별/나이 */}
                    {!compact && (
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {getGenderShort(p.gender)}/{p.age}세
                      </td>
                    )}

                    {/* 혈액형 */}
                    {!compact && (
                      <td>
                        <span
                          style={{
                            ...bloodTypeStyle,
                            display: 'inline-block',
                            padding: '3px 8px',
                            borderRadius: '10px',
                            fontSize: '0.75rem',
                            fontWeight: 600,
                          }}
                        >
                          {p.blood_type || '-'}
                        </span>
                      </td>
                    )}

                    {/* 상태 */}
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '4px', fontSize: '0.8rem' }}>
                        <span style={{ fontSize: '0.65rem' }}>{statusInfo.icon}</span>
                        {!compact && <span>{statusInfo.text}</span>}
                      </span>
                    </td>

                    {/* 작업 */}
                    {canStartCare && (
                      <td style={{ textAlign: 'right' }}>
                        <div onClick={(e) => e.stopPropagation()}>
                          {p.status === 'active' && (
                            <button
                              className="btn small primary"
                              onClick={(e) => handleStartCare(e, p)}
                              style={{ fontSize: '0.75rem', padding: '0.3rem 0.6rem' }}
                            >
                              진료
                            </button>
                          )}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </section>
  );
}
