// 병동 환자 상태 모니터링 (간호사 핵심 화면)
export default function PatientStatusList() {
  return (
    <section className="card patient-status">
      <header className="card-header">
        <h3>환자 상태 모니터링</h3>
      </header>

      <table className="table">
        <thead>
          <tr>
            <th>환자명</th>
            <th>병동</th>
            <th>상태</th>
            <th>최근 체크</th>
          </tr>
        </thead>
        <tbody>
          <PatientStatusRow
            name="김영희"
            ward="7A"
            status="주의"
            checked="5분 전"
          />
          <PatientStatusRow
            name="박민수"
            ward="7A"
            status="안정"
            checked="10분 전"
          />
        </tbody>
      </table>
    </section>
  );
}

function PatientStatusRow({
  name,
  ward,
  status,
  checked,
}: {
  name: string;
  ward: string;
  status: '안정' | '주의' | '위험';
  checked: string;
}) {
  return (
    <tr className="clickable">
      <td>{name}</td>
      <td>{ward}</td>
      <td>
        <span className={`badge status-${status}`}>{status}</span>
      </td>
      <td>{checked}</td>
    </tr>
  );
}
