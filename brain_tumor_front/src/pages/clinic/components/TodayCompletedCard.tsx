/**
 * 금일 진료완료 환자 카드
 * - DOCTOR: 본인에게 배정된 환자만 표시
 * - SYSTEMMANAGER/NURSE: 의사 선택 가능, 전체 보기 가능
 * - GET /api/encounters/?status=completed&encounter_date=today
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEncounters } from '@/services/encounter.api';
import { fetchUsers } from '@/services/users.api';
import { useAuth } from '@/pages/auth/AuthProvider';
import type { Encounter } from '@/types/encounter';
import type { User } from '@/types/user';

interface Doctor {
  id: number;
  name: string;
}

interface TodayCompletedCardProps {
  compact?: boolean;
  onPatientSelect?: (patientId: number) => void;
}

export default function TodayCompletedCard({ compact: _compact = false, onPatientSelect }: TodayCompletedCardProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [completedEncounters, setCompletedEncounters] = useState<Encounter[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // 의사는 본인 환자만 볼 수 있음
  const isDoctor = role === 'DOCTOR';
  const canSelectDoctor = !isDoctor;

  // 오늘 날짜
  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // 의사 목록 로드 (관리자/간호사만)
  useEffect(() => {
    if (isDoctor) {
      if (user?.id) {
        setSelectedDoctorId(user.id);
      }
      setLoadingDoctors(false);
      return;
    }

    const loadDoctors = async () => {
      setLoadingDoctors(true);
      try {
        const response = await fetchUsers({ role__code: 'DOCTOR', is_active: true });
        const doctorList = (response?.results || []).map((u: User) => ({
          id: u.id,
          name: u.name,
        }));
        setDoctors(doctorList);
      } catch (err) {
        console.error('Failed to fetch doctors:', err);
        setDoctors([]);
      } finally {
        setLoadingDoctors(false);
      }
    };

    loadDoctors();
  }, [role, user?.id, isDoctor]);

  // 진료완료 데이터 로드
  useEffect(() => {
    const fetchCompletedEncounters = async () => {
      setLoading(true);
      try {
        const response = await getEncounters({
          status: 'completed',
          encounter_date: today,
        });
        const data = Array.isArray(response) ? response : response?.results || [];
        setCompletedEncounters(data);
      } catch (err) {
        console.error('Failed to fetch completed encounters:', err);
        setCompletedEncounters([]);
      } finally {
        setLoading(false);
      }
    };

    fetchCompletedEncounters();
  }, [today]);

  // 선택된 의사로 필터링
  const filteredEncounters = useMemo(() => {
    if (selectedDoctorId === 'all') {
      return completedEncounters;
    }
    return completedEncounters.filter(
      (enc) => enc.attending_doctor === selectedDoctorId
    );
  }, [completedEncounters, selectedDoctorId]);

  // 최근 완료 순 정렬 (updated_at 기준 내림차순)
  const sortedEncounters = useMemo(() => {
    return [...filteredEncounters].sort((a, b) => {
      const timeA = a.updated_at || a.created_at || '';
      const timeB = b.updated_at || b.created_at || '';
      return timeB.localeCompare(timeA);
    });
  }, [filteredEncounters]);

  // 환자 진료 페이지로 이동
  const handleSelectPatient = (encounter: Encounter) => {
    if (onPatientSelect) {
      onPatientSelect(encounter.patient);
    } else {
      navigate(`/patientsCare?patientId=${encounter.patient}`);
    }
  };

  // 의사 선택 핸들러
  const handleDoctorChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const value = e.target.value;
    setSelectedDoctorId(value === 'all' ? 'all' : Number(value));
  };

  // 선택된 의사 이름
  const selectedDoctorName = useMemo(() => {
    if (selectedDoctorId === 'all') return '전체';
    return doctors.find((d) => d.id === selectedDoctorId)?.name || '선택됨';
  }, [selectedDoctorId, doctors]);

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">✅</span>
          금일 진료완료 환자
          <span className="appointment-count">({sortedEncounters.length})</span>
        </h3>
      </div>

      {/* 의사 선택 */}
      <div className="doctor-selector">
        <label>담당 의사</label>
        {canSelectDoctor ? (
          <>
            <select
              value={selectedDoctorId}
              onChange={handleDoctorChange}
              disabled={loadingDoctors}
            >
              <option value="all">전체 의사</option>
              {doctors.map((doctor) => (
                <option key={doctor.id} value={doctor.id}>
                  {doctor.name}
                </option>
              ))}
            </select>
            {selectedDoctorId !== 'all' && (
              <span className="selected-doctor-badge">{selectedDoctorName}</span>
            )}
          </>
        ) : (
          <span className="doctor-name-display">{user?.name || '본인'}</span>
        )}
      </div>

      <div className="clinic-card-body appointment-body">
        {loading ? (
          <div className="loading-state">
            <span>로딩 중...</span>
          </div>
        ) : sortedEncounters.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">✅</div>
            <div className="empty-state-text">
              {selectedDoctorId === 'all'
                ? '오늘 진료완료된 환자가 없습니다.'
                : `${selectedDoctorName} 선생님의 진료완료 환자가 없습니다.`}
            </div>
          </div>
        ) : (
          <div className="appointment-list">
            {sortedEncounters.map((encounter) => (
              <div
                key={encounter.id}
                className="appointment-item completed"
                onClick={() => handleSelectPatient(encounter)}
              >
                <div className="appointment-time">
                  {encounter.scheduled_time?.slice(0, 5) || '--:--'}
                </div>
                <div className="appointment-info">
                  <div className="patient-name">
                    {encounter.patient_name || `환자 #${encounter.patient}`}
                  </div>
                  <div className="appointment-meta">
                    <span className="appointment-type">
                      {encounter.encounter_type === 'outpatient' && '외래'}
                      {encounter.encounter_type === 'inpatient' && '입원'}
                      {encounter.encounter_type === 'emergency' && '응급'}
                    </span>
                    {selectedDoctorId === 'all' && encounter.attending_doctor_name && (
                      <span className="appointment-doctor">
                        {encounter.attending_doctor_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="appointment-action">
                  <button className="btn btn-sm btn-outline">상세</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .appointment-item.completed {
          background: #f5f5f5;
        }
        .appointment-item.completed:hover {
          background: #eeeeee;
        }
        .appointment-item.completed .patient-name {
          color: #666;
        }
      `}</style>
    </div>
  );
}
