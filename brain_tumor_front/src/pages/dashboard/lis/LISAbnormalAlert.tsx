import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getOCSList } from '@/services/ocs.api';
import type { OCSListItem } from '@/types/ocs';

interface CriticalAlert {
  id: number;
  patientId: number;
  patientName: string;
  jobType: string;
  priority: string;
  createdAt: string;
}

export function LISAbnormalAlert() {
  const navigate = useNavigate();
  const [alerts, setAlerts] = useState<CriticalAlert[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchCriticalAlerts();
  }, []);

  const fetchCriticalAlerts = async () => {
    setLoading(true);
    try {
      // 긴급 우선순위의 LIS OCS 목록 조회
      const response = await getOCSList({
        job_role: 'LIS',
        priority: 'urgent',
        page: 1,
        page_size: 10,
      });
      const data = Array.isArray(response) ? response : response.results || [];

      const criticalAlerts: CriticalAlert[] = data.map((ocs: OCSListItem) => ({
        id: ocs.id,
        patientId: ocs.patient.id,
        patientName: ocs.patient.name,
        jobType: ocs.job_type,
        priority: ocs.priority_display,
        createdAt: ocs.created_at,
      }));

      setAlerts(criticalAlerts);
    } catch (error) {
      console.error('Failed to fetch critical alerts:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleAlertClick = (alert: CriticalAlert) => {
    navigate(`/patients/${alert.patientId}`);
  };

  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', { hour: '2-digit', minute: '2-digit' });
  };

  return (
    <section className="card alert critical">
      <header className="card-header">
        <h3>긴급 알림</h3>
        {alerts.length > 0 && (
          <span className="badge badge-danger">{alerts.length}</span>
        )}
      </header>

      {loading ? (
        <div className="loading">로딩 중...</div>
      ) : alerts.length === 0 ? (
        <div className="empty-state">긴급 알림이 없습니다.</div>
      ) : (
        <ul className="alert-list">
          {alerts.map((alert) => (
            <li
              key={alert.id}
              className="alert-item critical"
              onClick={() => handleAlertClick(alert)}
            >
              <div className="alert-content">
                <strong>{alert.patientName}</strong>
                <span className="alert-detail">
                  {alert.jobType} – {alert.priority}
                </span>
              </div>
              <span className="alert-time">{formatTime(alert.createdAt)}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
