import { useNavigate } from 'react-router-dom';
import './HighRiskAlerts.css';

interface HighRiskPatient {
  patient_id: number;
  patient_name: string;
  risk_level: string;
  analysis_date: string;
}

interface HighRiskAlertsProps {
  patients: HighRiskPatient[];
  loading?: boolean;
}

const RISK_COLORS: Record<string, string> = {
  high: '#f44336',
  medium: '#ff9800',
  low: '#4caf50',
  G4: '#f44336',
  G3: '#ff9800',
  G2: '#4caf50',
};

export default function HighRiskAlerts({ patients, loading = false }: HighRiskAlertsProps) {
  const navigate = useNavigate();

  if (loading) {
    return (
      <div className="high-risk-alerts__loading">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="high-risk-alerts__skeleton" />
        ))}
      </div>
    );
  }

  if (patients.length === 0) {
    return (
      <div className="high-risk-alerts__empty">
        <span className="material-icons">verified_user</span>
        <p>고위험 환자가 없습니다</p>
      </div>
    );
  }

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()}`;
  };

  const handlePatientClick = (patientId: number) => {
    navigate(`/patients/${patientId}`);
  };

  return (
    <div className="high-risk-alerts">
      <ul className="high-risk-alerts__list">
        {patients.slice(0, 5).map((patient) => (
          <li
            key={`${patient.patient_id}-${patient.analysis_date}`}
            className="high-risk-alerts__item"
            onClick={() => handlePatientClick(patient.patient_id)}
          >
            <div className="high-risk-alerts__icon">
              <span className="material-icons">warning</span>
            </div>
            <div className="high-risk-alerts__content">
              <span className="high-risk-alerts__name">{patient.patient_name}</span>
              <span className="high-risk-alerts__date">{formatDate(patient.analysis_date)}</span>
            </div>
            <span
              className="high-risk-alerts__badge"
              style={{ backgroundColor: RISK_COLORS[patient.risk_level] || '#f44336' }}
            >
              {patient.risk_level}
            </span>
          </li>
        ))}
      </ul>
      {patients.length > 5 && (
        <div className="high-risk-alerts__more">
          <span>+{patients.length - 5}명 더 보기</span>
        </div>
      )}
    </div>
  );
}
