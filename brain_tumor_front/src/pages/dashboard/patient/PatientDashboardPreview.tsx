/**
 * PatientDashboardPreview - 시스템관리자용 환자 대시보드 미리보기
 * - 실제 API 호출 없이 샘플 데이터로 UI 확인
 */
import { useState } from 'react';
import { DashboardHeader } from '../common/DashboardHeader';
import '@/pages/patient/PatientDashboard.css';

type TabType = 'info' | 'encounters' | 'results';

export default function PatientDashboardPreview() {
  const [activeTab, setActiveTab] = useState<TabType>('info');

  return (
    <div className="patient-dashboard">
      <DashboardHeader
        role="PATIENT"
        customSubtitle="환자 대시보드 미리보기 (샘플 데이터)"
      />

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
        {activeTab === 'info' && <MyInfoTab />}
        {activeTab === 'encounters' && <MyEncountersTab />}
        {activeTab === 'results' && <MyTestResultsTab />}

        <div style={{
          marginTop: 24,
          padding: 16,
          background: '#fff3cd',
          borderRadius: 8,
          fontSize: 14,
          color: '#856404'
        }}>
          ⚠️ 이 화면은 시스템관리자용 미리보기입니다.
          실제 환자 데이터는 PATIENT 역할로 로그인해야 확인할 수 있습니다.
        </div>
      </main>
    </div>
  );
}

// 내 정보 탭
function MyInfoTab() {
  return (
    <div className="tab-content">
      {/* 기본 정보 카드 */}
      <section className="info-card">
        <h2>기본 정보</h2>
        <div className="info-grid">
          <div className="info-item">
            <label>이름</label>
            <span>홍길동</span>
          </div>
          <div className="info-item">
            <label>환자번호</label>
            <span className="patient-number">P2024-0001</span>
          </div>
          <div className="info-item">
            <label>생년월일</label>
            <span>1990-01-15</span>
          </div>
          <div className="info-item">
            <label>성별</label>
            <span>남성</span>
          </div>
          <div className="info-item">
            <label>나이</label>
            <span>35세</span>
          </div>
          <div className="info-item">
            <label>혈액형</label>
            <span>A+</span>
          </div>
          <div className="info-item">
            <label>연락처</label>
            <span>010-1234-5678</span>
          </div>
          <div className="info-item">
            <label>등록일</label>
            <span>2024-01-10</span>
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
              <span className="tag tag-warning">페니실린</span>
              <span className="tag tag-warning">해산물</span>
            </div>
          </div>
          <div className="health-item">
            <label>만성질환</label>
            <div className="tag-list">
              <span className="tag tag-info">고혈압</span>
              <span className="tag tag-info">당뇨</span>
            </div>
          </div>
        </div>
      </section>

      {/* 주의사항 카드 */}
      <section className="info-card alerts-card">
        <h2>주의사항</h2>
        <div className="alerts-list">
          <div className="alert-item severity-high">
            <div className="alert-header">
              <span className="alert-type">약물 알레르기</span>
              <span className="alert-severity">높음</span>
            </div>
            <div className="alert-title">페니실린 계열 약물 주의</div>
            <div className="alert-description">
              과거 페니실린 투여 시 아나필락시스 반응 이력 있음
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

// 진료 이력 탭
function MyEncountersTab() {
  const sampleEncounters = [
    {
      id: 1,
      encounter_date: '2024-01-10',
      encounter_type_display: '외래',
      status_display: '완료',
      attending_doctor_name: '김의사',
      department_display: '신경외과',
      chief_complaint: '두통, 어지러움',
      primary_diagnosis: '편두통',
    },
    {
      id: 2,
      encounter_date: '2024-01-05',
      encounter_type_display: '외래',
      status_display: '완료',
      attending_doctor_name: '이의사',
      department_display: '신경과',
      chief_complaint: '수면 장애',
      primary_diagnosis: '불면증',
    },
    {
      id: 3,
      encounter_date: '2023-12-20',
      encounter_type_display: '입원',
      status_display: '완료',
      attending_doctor_name: '박의사',
      department_display: '신경외과',
      chief_complaint: '뇌종양 수술 후 경과 관찰',
      primary_diagnosis: '뇌종양 (양성)',
    },
  ];

  return (
    <div className="tab-content">
      <section className="info-card">
        <h2>진료 이력</h2>
        <div className="encounters-list">
          {sampleEncounters.map((encounter) => (
            <div key={encounter.id} className="encounter-item">
              <div className="encounter-date">
                {new Date(encounter.encounter_date).toLocaleDateString('ko-KR')}
              </div>
              <div className="encounter-info">
                <div className="encounter-type">
                  <span className="badge">{encounter.encounter_type_display}</span>
                  <span className="status status-완료">
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

// 검사 결과 탭
function MyTestResultsTab() {
  const sampleRIS = [
    {
      id: 1,
      job_type: 'Brain MRI',
      ocs_status_display: '완료',
      created_at: '2024-01-08',
      result_summary: '좌측 측두엽에 1.2cm 크기의 종괴 확인. 양성 소견.',
    },
    {
      id: 2,
      job_type: 'Brain CT',
      ocs_status_display: '완료',
      created_at: '2023-12-15',
      result_summary: '특이 소견 없음.',
    },
  ];

  const sampleLIS = [
    {
      id: 1,
      job_type: '일반 혈액검사 (CBC)',
      ocs_status_display: '완료',
      created_at: '2024-01-10',
      result_summary: 'WBC 7.2, RBC 4.8, Hb 14.5, Plt 250 - 정상 범위',
    },
    {
      id: 2,
      job_type: '간기능 검사',
      ocs_status_display: '완료',
      created_at: '2024-01-10',
      result_summary: 'AST 25, ALT 30, ALP 70 - 정상 범위',
    },
    {
      id: 3,
      job_type: '신장 기능 검사',
      ocs_status_display: '완료',
      created_at: '2024-01-10',
      result_summary: 'BUN 15, Creatinine 1.0 - 정상 범위',
    },
  ];

  return (
    <div className="tab-content">
      {/* 영상검사 (RIS) */}
      <section className="info-card">
        <h2>영상검사 (RIS)</h2>
        <div className="results-list">
          {sampleRIS.map((item) => (
            <div key={item.id} className="result-item">
              <div className="result-header">
                <span className="result-type">{item.job_type}</span>
                <span className="result-date">
                  {new Date(item.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="result-status">{item.ocs_status_display}</div>
              {item.result_summary && (
                <div className="result-summary">{item.result_summary}</div>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* 혈액검사 (LIS) */}
      <section className="info-card">
        <h2>혈액검사 (LIS)</h2>
        <div className="results-list">
          {sampleLIS.map((item) => (
            <div key={item.id} className="result-item">
              <div className="result-header">
                <span className="result-type">{item.job_type}</span>
                <span className="result-date">
                  {new Date(item.created_at).toLocaleDateString('ko-KR')}
                </span>
              </div>
              <div className="result-status">{item.ocs_status_display}</div>
              {item.result_summary && (
                <div className="result-summary">{item.result_summary}</div>
              )}
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
