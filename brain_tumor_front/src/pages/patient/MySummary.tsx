import { useState, useEffect } from 'react';
import { getMyPatientInfo, getMyTodaySchedule, getMyAlerts } from '@/services/patient-portal.api';
import type { MyPatientInfo, MyEncounter, MyAlert } from '@/types/patient-portal';
import './MyCarePage.css';

export default function MySummary() {
  const [patientInfo, setPatientInfo] = useState<MyPatientInfo | null>(null);
  const [todaySchedule, setTodaySchedule] = useState<MyEncounter[]>([]);
  const [alerts, setAlerts] = useState<MyAlert[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [info, schedule, alertList] = await Promise.all([
        getMyPatientInfo(),
        getMyTodaySchedule(),
        getMyAlerts(),
      ]);
      setPatientInfo(info);
      setTodaySchedule(schedule);
      setAlerts(alertList);
    } catch (err) {
      console.error('Failed to fetch patient summary:', err);
      setError('정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  const formatTime = (timeStr?: string) => {
    if (!timeStr) return '';
    // timeStr이 HH:MM:SS 형식이면 HH:MM만 추출
    const parts = timeStr.split(':');
    return `${parts[0]}:${parts[1]}`;
  };

  const getGenderDisplay = (gender: string) => {
    return gender === 'M' ? '남성' : '여성';
  };

  const getSeverityClass = (severity: string) => {
    switch (severity) {
      case 'high': return 'severity-high';
      case 'medium': return 'severity-medium';
      case 'low': return 'severity-low';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="my-summary">
        <div className="loading-state">정보를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="my-summary">
        <div className="error-state">{error}</div>
      </div>
    );
  }

  return (
    <div className="my-summary">
      {/* 환자 기본 정보 */}
      {patientInfo && (
        <div className="patient-info-card">
          <h2>내 정보</h2>
          <div className="info-grid">
            <div className="info-item">
              <span className="info-label">이름</span>
              <span className="info-value">{patientInfo.name}</span>
            </div>
            <div className="info-item">
              <span className="info-label">환자번호</span>
              <span className="info-value">{patientInfo.patient_number}</span>
            </div>
            <div className="info-item">
              <span className="info-label">생년월일</span>
              <span className="info-value">
                {formatDate(patientInfo.birth_date)} ({patientInfo.age}세)
              </span>
            </div>
            <div className="info-item">
              <span className="info-label">성별</span>
              <span className="info-value">{getGenderDisplay(patientInfo.gender)}</span>
            </div>
            {patientInfo.blood_type && (
              <div className="info-item">
                <span className="info-label">혈액형</span>
                <span className="info-value">{patientInfo.blood_type}</span>
              </div>
            )}
            {patientInfo.phone && (
              <div className="info-item">
                <span className="info-label">연락처</span>
                <span className="info-value">{patientInfo.phone}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 오늘 진료 예약 */}
      <div className="today-schedule">
        <h3>오늘의 진료 예약</h3>
        {todaySchedule.length === 0 ? (
          <div className="no-schedule">오늘 예약된 진료가 없습니다.</div>
        ) : (
          todaySchedule.map((schedule) => (
            <div key={schedule.id} className="schedule-item">
              <span className="schedule-time">
                {formatTime(schedule.scheduled_time) || '시간 미정'}
              </span>
              <span className="schedule-info">
                {schedule.department_display || '진료'} - {schedule.attending_doctor_name} 선생님
              </span>
              {schedule.chief_complaint && (
                <div className="schedule-complaint">
                  주호소: {schedule.chief_complaint}
                </div>
              )}
            </div>
          ))
        )}
      </div>

      {/* 주의사항 */}
      {alerts.length > 0 && (
        <div className="alerts-section">
          <h3>주의사항</h3>
          <div className="alerts-list">
            {alerts.map((alert) => (
              <div key={alert.id} className={`alert-item ${getSeverityClass(alert.severity)}`}>
                <div className="alert-header">
                  <span className="alert-type">{alert.alert_type_display}</span>
                  <span className={`alert-severity ${getSeverityClass(alert.severity)}`}>
                    {alert.severity_display}
                  </span>
                </div>
                <div className="alert-title">{alert.title}</div>
                {alert.description && (
                  <div className="alert-description">{alert.description}</div>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
