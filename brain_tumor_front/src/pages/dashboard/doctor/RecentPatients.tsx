export function RecentPatients() {
  return (
    <section className="card recent-patients">
      <header className="card-header">
        <h3>최근 진료 환자</h3>
      </header>

      <div className="recent-list">
        <RecentPatient name="박민수" date="2025-01-22" />
        <RecentPatient name="이수진" date="2025-01-21" />
        <RecentPatient name="정현우" date="2025-01-20" />
      </div>
    </section>
  );
}

function RecentPatient({
  name,
  date,
}: {
  name: string;
  date: string;
}) {
  return (
    <div className="recent-item clickable">
      <strong>{name}</strong>
      <span>{date}</span>
    </div>
  );
}
