/**
 * AI 분석 결과 패널
 * - 실제 AI 분석이 완료되면 결과 표시
 * - 분석 전에는 안내 메시지 표시
 */
export default function AiResultPanel() {
  // TODO: AI 분석 결과 API 연동 후 실제 데이터로 교체
  const hasAnalysisResult = false;  // 분석 결과 여부

  if (!hasAnalysisResult) {
    return (
      <aside className="ai-panel">
        <section className="ai-empty-state">
          <div className="empty-icon">🧠</div>
          <h3>AI 분석 대기</h3>
          <p>
            AI 분석 요청을 생성하면 결과가 여기에 표시됩니다.
          </p>
          <p className="hint">
            환자 선택 → AI 분석 요청 → 결과 확인
          </p>
        </section>
      </aside>
    );
  }

  // TODO: 실제 분석 결과가 있을 때 표시할 내용
  return (
    <aside className="ai-panel">
      <section className="ai-score">
        <h3>AI Score</h3>
        <div className="score-value">-</div>
      </section>

      <section className="ai-summary-text">
        <h3>AI 요약</h3>
        <p>분석 결과가 없습니다.</p>
      </section>
    </aside>
  );
}
