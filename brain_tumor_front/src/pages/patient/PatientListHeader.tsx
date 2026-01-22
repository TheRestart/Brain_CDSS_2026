// role에 따른 header 제목 매핑 컴포넌트
const TITLE_BY_ROLE: Record<string, string> = {
  SYSTEMMANAGER: '환자 관리',
  DOCTOR: '환자 목록',
  NURSE: '환자 관리',
  ADMIN: '환자 관리',
  RIS: '환자 목록',
  LIS: '환자 목록',
  PATIENT: '내 진료 기록',
};

export default function PatientListHeader({ role }: { role: string }) {
  return (
    <header className="page-header">


     <div className="header-inner">
      <div className="header-left">
        <h2>{TITLE_BY_ROLE[role] || '환자 목록'}</h2>
      </div>

      <div className="header-right">
        {(role === 'DOCTOR' || role === 'NURSE') && (
          <button className="btn primary">환자 등록</button>
        )}
      </div>
    </div>

    </header>
  );
}
