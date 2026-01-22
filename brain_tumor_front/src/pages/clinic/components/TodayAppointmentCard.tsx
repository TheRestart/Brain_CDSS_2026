/**
 * 금일 예약 환자 카드
 * - DOCTOR: 본인에게 배정된 환자만 표시 (선택 불가)
 * - SYSTEMMANAGER/NURSE: 의사 선택 가능, 전체 보기 가능
 * - GET /api/encounters/today/ 또는 필터 사용
 */
import { useState, useEffect, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEncounters, getTodayEncounters } from '@/services/encounter.api';
import { fetchUsers } from '@/services/users.api';
import { useAuth } from '@/pages/auth/AuthProvider';
import type { Encounter } from '@/types/encounter';
import type { User } from '@/types/user';

interface Doctor {
  id: number;
  name: string;
}

interface TodayAppointmentCardProps {
  compact?: boolean; // 사이드바용 컴팩트 모드
  onPatientSelect?: (patientId: number) => void; // 환자 선택 핸들러 (진료 중 확인용)
}

export default function TodayAppointmentCard({ compact: _compact = false, onPatientSelect }: TodayAppointmentCardProps) {
  const navigate = useNavigate();
  const { user, role } = useAuth();

  const [appointments, setAppointments] = useState<Encounter[]>([]);
  const [doctors, setDoctors] = useState<Doctor[]>([]);
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | 'all'>('all');
  const [loading, setLoading] = useState(true);
  const [loadingDoctors, setLoadingDoctors] = useState(true);

  // 의사는 본인 환자만 볼 수 있음
  const isDoctor = role === 'DOCTOR';
  const canSelectDoctor = !isDoctor; // SYSTEMMANAGER, NURSE 등은 의사 선택 가능

  // 오늘 날짜
  const today = useMemo(() => {
    return new Date().toISOString().split('T')[0];
  }, []);

  // 의사 목록 로드 (관리자/간호사만)
  useEffect(() => {
    // 의사는 본인만 선택되므로 목록 불필요
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
        // DOCTOR 역할을 가진 사용자 목록 조회
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

  // 예약 데이터 로드
  useEffect(() => {
    const fetchAppointments = async () => {
      setLoading(true);
      try {
        let data: Encounter[] = [];

        // 1차: /encounters/today/ 엔드포인트 시도
        try {
          const response = await getTodayEncounters();
          data = Array.isArray(response) ? response : [];
        } catch {
          // fallback: 기존 필터 방식 사용
          const response = await getEncounters({
            status: 'scheduled',
            encounter_date: today,
          });
          data = Array.isArray(response) ? response : response?.results || [];
        }

        setAppointments(data);
      } catch (err) {
        console.error('Failed to fetch appointments:', err);
        setAppointments([]);
      } finally {
        setLoading(false);
      }
    };

    fetchAppointments();
  }, [today]);

  // 선택된 의사로 필터링
  const filteredAppointments = useMemo(() => {
    if (selectedDoctorId === 'all') {
      return appointments;
    }
    return appointments.filter(
      (apt) => apt.attending_doctor === selectedDoctorId
    );
  }, [appointments, selectedDoctorId]);

  // 시간 순 정렬
  const sortedAppointments = useMemo(() => {
    return [...filteredAppointments].sort((a, b) => {
      const timeA = a.scheduled_time || '00:00';
      const timeB = b.scheduled_time || '00:00';
      return timeA.localeCompare(timeB);
    });
  }, [filteredAppointments]);

  // 환자 진료 페이지로 이동
  const handleSelectPatient = (encounter: Encounter) => {
    if (onPatientSelect) {
      // 진료 중 확인 로직 사용 (부모에서 처리)
      onPatientSelect(encounter.patient);
    } else {
      // 기본 동작: 바로 이동
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
          <span className="card-icon">📋</span>
          금일 예약 환자
          <span className="appointment-count">({sortedAppointments.length})</span>
        </h3>
      </div>

      {/* 의사 선택 - 관리자/간호사만 선택 가능, 의사는 본인 이름만 표시 */}
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
        ) : sortedAppointments.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📅</div>
            <div className="empty-state-text">
              {selectedDoctorId === 'all'
                ? '오늘 예약된 환자가 없습니다.'
                : `${selectedDoctorName} 선생님께 배정된 환자가 없습니다.`}
            </div>
          </div>
        ) : (
          <div className="appointment-list">
            {sortedAppointments.map((appointment) => (
              <div
                key={appointment.id}
                className="appointment-item"
                onClick={() => handleSelectPatient(appointment)}
              >
                <div className="appointment-time">
                  {appointment.scheduled_time?.slice(0, 5) || '--:--'}
                </div>
                <div className="appointment-info">
                  <div className="patient-name">
                    {appointment.patient_name || `환자 #${appointment.patient}`}
                  </div>
                  <div className="appointment-meta">
                    <span className="appointment-type">
                      {appointment.encounter_type === 'outpatient' && '외래'}
                      {appointment.encounter_type === 'inpatient' && '입원'}
                      {appointment.encounter_type === 'emergency' && '응급'}
                    </span>
                    {selectedDoctorId === 'all' && appointment.attending_doctor_name && (
                      <span className="appointment-doctor">
                        {appointment.attending_doctor_name}
                      </span>
                    )}
                  </div>
                </div>
                <div className="appointment-action">
                  <button className="btn btn-sm btn-primary">진료</button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      <style>{`
        .appointment-count {
          font-size: 12px;
          font-weight: normal;
          color: var(--text-secondary, #666);
          margin-left: 4px;
        }
        .doctor-selector {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #f5f5f5);
        }
        .doctor-selector label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary, #666);
          white-space: nowrap;
        }
        .doctor-selector select {
          flex: 1;
          padding: 6px 10px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 13px;
          background: white;
          cursor: pointer;
        }
        .doctor-selector select:focus {
          outline: none;
          border-color: var(--primary, #1976d2);
        }
        .selected-doctor-badge {
          font-size: 11px;
          padding: 4px 8px;
          background: var(--primary, #1976d2);
          color: white;
          border-radius: 12px;
          white-space: nowrap;
        }
        .doctor-name-display {
          font-size: 14px;
          font-weight: 600;
          color: var(--primary, #1976d2);
          padding: 6px 12px;
          background: #e3f2fd;
          border-radius: 6px;
        }
        .appointment-body {
          max-height: 500px;
          overflow-y: auto;
          padding: 0;
        }
        .loading-state {
          padding: 32px;
          text-align: center;
          color: var(--text-secondary, #666);
        }
        .appointment-list {
          padding: 0;
        }
        .appointment-item {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .appointment-item:last-child {
          border-bottom: none;
        }
        .appointment-item:hover {
          background: var(--bg-secondary, #f5f5f5);
        }
        .appointment-time {
          font-size: 16px;
          font-weight: 600;
          font-family: monospace;
          color: var(--primary, #1976d2);
          min-width: 50px;
        }
        .appointment-info {
          flex: 1;
        }
        .patient-name {
          font-size: 14px;
          font-weight: 500;
          color: var(--text-primary, #1a1a1a);
        }
        .appointment-meta {
          display: flex;
          gap: 8px;
          margin-top: 2px;
        }
        .appointment-type {
          font-size: 12px;
          color: var(--text-secondary, #666);
        }
        .appointment-doctor {
          font-size: 11px;
          padding: 1px 6px;
          background: #e3f2fd;
          color: #1565c0;
          border-radius: 4px;
        }
        .appointment-action {
          flex-shrink: 0;
        }
      `}</style>
    </div>
  );
}
