// 오늘 근무 요약 (업무 부담 파악)
export default function NurseSummary() {
  return (
    <section className="summary-cards nurse">
      <SummaryCard title="근무 병동" value="7A 병동" />
      <SummaryCard title="담당 환자" value={18} />
      <SummaryCard title="처치 대기" value={4} highlight />
      <SummaryCard title="주의 환자" value={2} danger />
    </section>
  );
}

function SummaryCard({
  title,
  value,
  highlight,
  danger,
}: {
  title: string;
  value: string | number;
  highlight?: boolean;
  danger?: boolean;
}) {
  return (
    <div
      className={`card summary ${
        highlight ? 'highlight' : ''
      } ${danger ? 'danger' : ''}`}
    >
      <span className="title">{title}</span>
      <strong className="value">{value}</strong>
    </div>
  );
}
