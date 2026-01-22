import SummaryCard from "@/pages/common/SummaryCard";
export function RISSummary() {
  return (
    <section className="summary-cards ris">
      <SummaryCard title="판독 대기" value={8} />
      <SummaryCard title="판독 중" value={2} highlight />
      <SummaryCard title="AI Flag" value={3} danger />
      <SummaryCard title="완료" value={12} />
    </section>
  );
}
