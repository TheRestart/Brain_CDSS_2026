/**
 * PatientDashboard - 환자 포털 메인 페이지
 * - 내 정보, 진료 이력, 검사 결과 탭
 * - PATIENT 역할만 접근 가능
 */
import { useState, useEffect } from 'react';
import {
  getMyPatientInfo,
  getMyEncounters,
  getMyOCS,
  getMyAlerts,
} from '@/services/patient-portal.api';
import type {
  MyPatientInfo,
  MyEncounter,
  MyOCSItem,
  MyAlert,
} from '@/types/patient-portal';

interface OCSResults {
  ris: MyOCSItem[];
  lis: MyOCSItem[];
}
import './PatientDashboard.css';

type TabType = 'info' | 'encounters' | 'results';

export default function PatientDashboard() {
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 데이터 상태
  const [patientInfo, setPatientInfo] = useState<MyPatientInfo | null>(null);
  const [encounters, setEncounters] = useState<MyEncounter[]>([]);
  const [ocsResults, setOcsResults] = useState<OCSResults>({ ris: [], lis: [] });
  const [alerts, setAlerts] = useState<MyAlert[]>([]);

  // 데이터 로드
  useEffect(() => {
    loadAllData();
  }, []);

  const loadAllData = async () => {
    setLoading(true);
    setError(null);
    try {
      const [infoData, encountersData, risData, lisData, alertsData] = await Promise.all([
        getMyPatientInfo(),
        getMyEncounters(),
        getMyOCS({ job_role: 'RIS' }),
        getMyOCS({ job_role: 'LIS' }),
        getMyAlerts(),
      ]);
      setPatientInfo(infoData);
      setEncounters(encountersData.results || []);
      setOcsResults({
        ris: risData.results || [],
        lis: lisData.results || [],
      });
      setAlerts(alertsData);
    } catch (err: any) {
      console.error('데이터 로드 실패:', err);
      setError('데이터를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="patient-dashboard">
        <div className="loading-state">데이터를 불러오는 중...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-dashboard">
        <div className="error-state">
          <p>{error}</p>
          <button className="btn btn-primary" onClick={loadAllData}>
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="patient-dashboard">
      <header className="dashboard-header">
        <h1>내 건강정보</h1>
        <p className="subtitle">
          {patientInfo?.name}님의 건강정보를 확인하세요
        </p>
      </header>

      {/* 탭 네비게이션 */}
      <nav className="dashboard-tabs">
        <button
          className={`tab ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          내 정보
        </button>
        <button
          className={`tab ${activeTab === 'encounters' ? 'active' : ''}`}
          onClick={() => setActiveTab('encounters')}
        >
          진료 이력
        </button>
        <button
          className={`tab ${activeTab === 'results' ? 'active' : ''}`}
          onClick={() => setActiveTab('results')}
        >
          검사 결과
        </button>
      </nav>

      {/* 탭 내용 */}
      <main className="dashboard-content">
        {activeTab === 'info' && (
          <MyInfoTab patientInfo={patientInfo} alerts={alerts} />
        )}
        {activeTab === 'encounters' && (
          <MyEncountersTab encounters={encounters} />
        )}
        {activeTab === 'results' && (
          <MyTestResultsTab ocsResults={ocsResults} />
        )}
      </main>
    </div>
  );
}

// ============================================================================
// 내 정보 탭
// ============================================================================
interface MyInfoTabProps {
  patientInfo: MyPatientInfo | null;
  alerts: MyAlert[];
}

function MyInfoTab({ patientInfo, alerts }: MyInfoTabProps) {
  if (!patientInfo) {
    return <div className="empty-state">정보를 불러올 수 없습니다.</div>;
  }

  const activeAlerts = alerts.filter((a) => a.is_active);

  return (
    <div className="tab-content">
      {/* 기본 정보 카드 */}
      <section className="info-card">
        <h2>기본 정보</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>이름</label>
            <span>{patientInfo.name}</span>
          </div>
          <div className="info-item">
            <label>환자번호</label>
            <span className="patient-number">{patientInfo.patient_number}</span>
          </div>
          <div className="info-item">
            <label>생년월일</label>
            <span>{patientInfo.birth_date}</span>
          </div>
          <div className="info-item">
            <label>성별</label>
            <span>{patientInfo.gender === 'M' ? '남성' : '여성'}</span>
          </div>
          <div className="info-item">
            <label>나이</label>
            <span>{patientInfo.age}세</span>
          </div>
          <div className="info-item">
            <label>혈액형</label>
            <span>{patientInfo.blood_type || '-'}</span>
          </div>
          <div className="info-item">
            <label>연락처</label>
            <span>{patientInfo.phone || '-'}</span>
          </div>
          <div className="info-item">
            <label>등록일</label>
            <span>{new Date(patientInfo.registered_at).toLocaleDateString('ko-KR')}</span>
          </div>
        </div>
      </section>

      {/* 건강 정보 카드 */}
      <section className="info-card">
        <h2>건강 정보</h2>
        <div className="health-info">
          <div className="health-item">
            <label>알레르기</label>
            <div className="tag-list">
              {patientInfo.allergies.length > 0 ? (
                patientInfo.allergies.map((allergy, i) => (
                  <span key={i} className="tag tag-warning">
                    {allergy}
                  </span>
                ))
              ) : (
                <span className="no-data">없음</span>
              )}
            </div>
          </div>
          <div className="health-item">
            <label>만성질환</label>
            <div className="tag-list">
              {patientInfo.chronic_diseases.length > 0 ? (
                patientInfo.chronic_diseases.map((disease, i) => (
                  <span key={i} className="tag tag-info">
                    {disease}
                  </span>
                ))
              ) : (
                <span className="no-data">없음</span>
              )}
            </div>
          </div>
        </div>
      </section>

      {/* 주의사항 카드 */}
      {activeAlerts.length > 0 && (
        <section className="info-card alerts-card">
          <h2>주의사항</h2>
          <div className="alerts-list">
            {activeAlerts.map((alert) => (
              <div
                key={alert.id}
                className={`alert-item severity-${alert.severity.toLowerCase()}`}
              >
                <div className="alert-header">
                  <span className="alert-type">{alert.alert_type_display}</span>
                  <span className="alert-severity">{alert.severity_display}</span>
                </div>
                <div className="alert-title">{alert.title}</div>
                {alert.description && (
                  <div className="alert-description">{alert.description}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ============================================================================
// 진료 이력 탭
// ============================================================================
interface MyEncountersTabProps {
  encounters: MyEncounter[];
}

function MyEncountersTab({ encounters }: MyEncountersTabProps) {
  if (encounters.length === 0) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <p>진료 이력이 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      <section className="info-card">
        <h2>진료 이력</h2>
        <div className="encounters-list">
          {encounters.map((encounter) => (
            <div key={encounter.id} className="encounter-item">
              <div className="encounter-date">
                {new Date(encounter.admission_date).toLocaleDateString('ko-KR')}
              </div>
              <div className="encounter-info">
                <div className="encounter-type">
                  <span className="badge">{encounter.encounter_type_display}</span>
                  <span className={`status status-${encounter.status_display}`}>
                    {encounter.status_display}
                  </span>
                </div>
                <div className="encounter-doctor">
                  담당의: {encounter.attending_doctor_name}
                  {encounter.department_display && ` (${encounter.department_display})`}
                </div>
                {encounter.chief_complaint && (
                  <div className="encounter-complaint">
                    주호소: {encounter.chief_complaint}
                  </div>
                )}
                {encounter.primary_diagnosis && (
                  <div className="encounter-diagnosis">
                    진단: {encounter.primary_diagnosis}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

// ============================================================================
// 검사 결과 탭
// ============================================================================
interface MyTestResultsTabProps {
  ocsResults: OCSResults;
}

function MyTestResultsTab({ ocsResults }: MyTestResultsTabProps) {
  const risList = ocsResults.ris;
  const lisList = ocsResults.lis;

  if (risList.length === 0 && lisList.length === 0) {
    return (
      <div className="tab-content">
        <div className="empty-state">
          <div className="empty-icon">🔬</div>
          <p>검사 결과가 없습니다.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="tab-content">
      {/* 영상검사 (RIS) */}
      {risList.length > 0 && (
        <section className="info-card">
          <h2>영상검사 (RIS)</h2>
          <div className="results-list">
            {risList.map((item) => (
              <div key={item.id} className="result-item">
                <div className="result-header">
                  <span className="result-type">{item.job_type}</span>
                  <span className="result-date">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div className="result-status">{item.ocs_status_display}</div>
                {item.ocs_result && (
                  <div className="result-summary">{item.ocs_result}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 혈액검사 (LIS) */}
      {lisList.length > 0 && (
        <section className="info-card">
          <h2>혈액검사 (LIS)</h2>
          <div className="results-list">
            {lisList.map((item) => (
              <div key={item.id} className="result-item">
                <div className="result-header">
                  <span className="result-type">{item.job_type}</span>
                  <span className="result-date">
                    {new Date(item.created_at).toLocaleDateString('ko-KR')}
                  </span>
                </div>
                <div className="result-status">{item.ocs_status_display}</div>
                {item.ocs_result && (
                  <div className="result-summary">{item.ocs_result}</div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}
