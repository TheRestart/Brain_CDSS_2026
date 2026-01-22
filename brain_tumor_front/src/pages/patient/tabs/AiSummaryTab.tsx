interface Props {
  role: string;  // role code (DOCTOR, SYSTEMMANAGER 등)
}

export default function AISummaryTab({ role }: Props) {
  const isDoctor = role === 'DOCTOR';
  const isSystemManager = role === 'SYSTEMMANAGER';

  return (
    <div className="ai-summary-tab">

      <section className="ai-summary-section">
        <h3>AI 분석 요약</h3>
        <p className="summary-text">
          본 영상에서 좌측 전두엽 부위에 고신호 강도의 종괴가
          관찰되며, 교모세포종(Glioblastoma) 가능성이 높습니다.
          종괴는 조영 증강 소견을 보이며 주변 부종이 동반되어 있습니다.
        </p>
      </section>

      <section className="ai-findings">
        <h4>주요 소견</h4>
        <ul>
          <li>좌측 전두엽 종괴 (High confidence)</li>
          <li>조영 증강 및 주변 부종</li>
          <li>AI 신뢰도: <strong>0.87</strong></li>
        </ul>
      </section>

      {(isDoctor || isSystemManager) && (
        <section className="ai-comment">
          <h4>판독 코멘트</h4>
          <textarea
            placeholder="의사 판독 소견을 입력하세요"
            rows={4}
          />
        </section>
      )}

      <div className="ai-actions">
        <button>AI 요약 Report 삽입</button>
        <button className="primary">PDF 출력</button>
      </div>

    </div>
  );
}
