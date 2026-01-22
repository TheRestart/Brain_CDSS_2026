/**
 *  클릭 시 영상 뷰어, AI Summary로 점프해야 함
 */
export function AiAlertPanel() {
  return (
    <section className="card ai-alert">
      <header className="card-header">
        <h3>AI 분석 알림</h3>
      </header>

      <ul className="ai-alert-list">
        <AiAlertItem
          patient="홍길동"
          message="출혈 의심 영역 탐지"
          level="critical"
        />
        <AiAlertItem
          patient="김영희"
          message="종양 크기 증가"
          level="warning"
        />
      </ul>
    </section>
  );
}

function AiAlertItem({
  patient,
  message,
  level,
}: {
  patient: string;
  message: string;
  level: 'critical' | 'warning';
}) {
  return (
    <li className={`ai-alert-item ${level}`}>
      <strong>{patient}</strong>
      <span>{message}</span>
    </li>
  );
}
