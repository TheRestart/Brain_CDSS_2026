/**
 * AboutHospitalPage - 환자 전용 병원 소개 페이지
 *
 * 표시 내용:
 * - 병원 소개
 * - 진료과목
 * - 의료진 소개
 * - 진료 시간
 * - 오시는 길
 */
import '@/assets/style/patient-portal.css';

export default function AboutHospitalPage() {
  return (
    <div className="patient-portal-page">
      <div className="page-header">
        <h1>병원 소개</h1>
      </div>

      <div className="hospital-info-container">
        {/* 병원 소개 섹션 */}
        <section className="hospital-section">
          <h2>NeuroNova 병원</h2>
          <p className="hospital-description">
            NeuroNova 병원은 첨단 의료 기술과 AI 기반 진단 시스템을 통해
            환자분들께 최상의 의료 서비스를 제공합니다.
            특히 뇌종양 진단 분야에서 국내 최고 수준의 전문성을 갖추고 있습니다.
          </p>
        </section>

        {/* 진료과목 섹션 */}
        <section className="hospital-section">
          <h2>진료과목</h2>
          <div className="department-grid">
            <div className="department-item">
              <span className="dept-icon">🧠</span>
              <span className="dept-name">신경외과</span>
            </div>
            <div className="department-item">
              <span className="dept-icon">🏥</span>
              <span className="dept-name">신경과</span>
            </div>
            <div className="department-item">
              <span className="dept-icon">📷</span>
              <span className="dept-name">영상의학과</span>
            </div>
            <div className="department-item">
              <span className="dept-icon">🔬</span>
              <span className="dept-name">병리과</span>
            </div>
          </div>
        </section>

        {/* 진료 시간 섹션 */}
        <section className="hospital-section">
          <h2>진료 시간</h2>
          <div className="schedule-table">
            <div className="schedule-row">
              <span className="day">평일</span>
              <span className="time">09:00 - 18:00</span>
            </div>
            <div className="schedule-row">
              <span className="day">토요일</span>
              <span className="time">09:00 - 13:00</span>
            </div>
            <div className="schedule-row">
              <span className="day">점심시간</span>
              <span className="time">12:30 - 13:30</span>
            </div>
            <div className="schedule-row holiday">
              <span className="day">일요일/공휴일</span>
              <span className="time">휴진</span>
            </div>
          </div>
        </section>

        {/* 연락처 섹션 */}
        <section className="hospital-section">
          <h2>연락처</h2>
          <div className="contact-info">
            <div className="contact-row">
              <span className="contact-label">대표전화</span>
              <a href="tel:02-1234-5678" className="contact-value phone">02-1234-5678</a>
            </div>
            <div className="contact-row">
              <span className="contact-label">예약문의</span>
              <a href="tel:02-1234-5679" className="contact-value phone">02-1234-5679</a>
            </div>
            <div className="contact-row">
              <span className="contact-label">팩스</span>
              <span className="contact-value">02-1234-5680</span>
            </div>
          </div>
        </section>

        {/* 오시는 길 섹션 */}
        <section className="hospital-section">
          <h2>오시는 길</h2>
          <div className="location-info">
            <p className="address">서울특별시 강남구 테헤란로 123 NeuroNova 빌딩</p>
            <div className="transport-info">
              <div className="transport-item">
                <span className="transport-label">지하철</span>
                <span className="transport-value">2호선 강남역 3번 출구 도보 5분</span>
              </div>
              <div className="transport-item">
                <span className="transport-label">버스</span>
                <span className="transport-value">간선: 140, 144, 145 / 지선: 3412, 4412</span>
              </div>
              <div className="transport-item">
                <span className="transport-label">주차</span>
                <span className="transport-value">건물 지하 1~3층 (3시간 무료)</span>
              </div>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
