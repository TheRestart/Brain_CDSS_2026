/**
 * AI 페이지 - 드롭다운 네비게이션 기반 구성
 * - AI 요청 목록 (/ai/requests)
 * - AI 처리 현황 (/ai/process-status)
 * - AI 모델 정보 (/ai/models)
 */
import { useState } from 'react';
import { useAuth } from '../auth/AuthProvider';
import './AISummaryPage.css';

type AIViewType = 'requests' | 'process-status' | 'models';

// AI 모델 정보 (AI_MODELS.md 기준)
const AI_MODELS = [
  {
    code: 'M1',
    name: 'MRI 4-Channel Analysis',
    description: 'MRI 영상 기반 뇌종양 분석 (T1, T2, T1C, FLAIR)',
    ocsSource: 'RIS',
    trigger: 'RIS 결과 제출 시 자동',
    input: 'T1, T2, T1C, FLAIR (4채널 MRI)',
    output: '종양 위치, 크기, 등급 예측',
    status: 'active',
  },
  {
    code: 'MG',
    name: 'Genetic Analysis',
    description: '유전자 분석 기반 종양 특성 예측 (RNA_seq)',
    ocsSource: 'LIS (GENETIC)',
    trigger: 'LIS GENETIC 결과 제출 시 자동',
    input: 'RNA_seq, gene_mutations',
    output: '유전자 마커 분석, 예후 예측',
    status: 'active',
  },
  {
    code: 'MM',
    name: 'Multimodal Analysis',
    description: '영상 + 유전 + 단백질 통합 분석',
    ocsSource: 'RIS + LIS',
    trigger: '수동 요청만',
    input: 'MRI 영상 + RNA_seq + protein_markers',
    output: '종합 진단 결과, 치료 권고',
    status: 'active',
  },
];

export default function AiSummaryPage() {
  const { user } = useAuth();
  const role = user?.role?.code;
  const [activeView, setActiveView] = useState<AIViewType>('requests');

  if (!role) return <div>접근 권한 정보 없음</div>;

  const viewLabels: Record<AIViewType, string> = {
    requests: 'AI 요청 목록',
    'process-status': 'AI 처리 현황',
    models: 'AI 모델 정보',
  };

  return (
    <div className="page ai-summary-page">
      {/* 헤더 + 드롭다운 네비게이션 */}
      <header className="ai-header">
        <div className="ai-header-left">
          <h1>AI 분석</h1>
          <div className="ai-nav-dropdown">
            <select
              value={activeView}
              onChange={(e) => setActiveView(e.target.value as AIViewType)}
              className="ai-view-select"
            >
              <option value="requests">AI 요청 목록</option>
              <option value="process-status">AI 처리 현황</option>
              <option value="models">AI 모델 정보</option>
            </select>
          </div>
        </div>
        <div className="ai-header-right">
          <span className="current-view-badge">{viewLabels[activeView]}</span>
        </div>
      </header>

      {/* 컨텐츠 영역 */}
      <div className="ai-content">
        {activeView === 'requests' && (
          <div className="ai-requests-view">
            <div className="ai-section-header">
              <h2>AI 요청 목록</h2>
              <p className="section-desc">환자별 AI 추론 요청 내역을 확인합니다.</p>
            </div>
            <div className="ai-placeholder">
              <div className="placeholder-icon">📋</div>
              <p>AI 요청 목록은 <strong>/ai-inference/requests</strong> 페이지에서 확인하세요.</p>
              <a href="/ai-inference/requests" className="btn btn-primary">
                AI 요청 목록 바로가기
              </a>
            </div>
          </div>
        )}

        {activeView === 'process-status' && (
          <div className="ai-process-view">
            <div className="ai-section-header">
              <h2>AI 처리 현황</h2>
              <p className="section-desc">AI 추론 처리 상태를 모니터링합니다.</p>
            </div>
            <div className="ai-status-cards">
              <div className="ai-status-card pending">
                <span className="status-icon">⏳</span>
                <span className="status-label">대기중</span>
                <span className="status-value">-</span>
              </div>
              <div className="ai-status-card processing">
                <span className="status-icon">🔄</span>
                <span className="status-label">처리중</span>
                <span className="status-value">-</span>
              </div>
              <div className="ai-status-card completed">
                <span className="status-icon">✅</span>
                <span className="status-label">완료</span>
                <span className="status-value">-</span>
              </div>
              <div className="ai-status-card failed">
                <span className="status-icon">❌</span>
                <span className="status-label">실패</span>
                <span className="status-value">-</span>
              </div>
            </div>
            <div className="ai-placeholder">
              <p>상세 처리 현황은 추후 API 연동 예정입니다.</p>
            </div>
          </div>
        )}

        {activeView === 'models' && (
          <div className="ai-models-view">
            <div className="ai-section-header">
              <h2>AI 모델 정보</h2>
              <p className="section-desc">Brain Tumor CDSS에서 사용하는 AI 추론 모델입니다.</p>
            </div>
            <div className="ai-models-grid">
              {AI_MODELS.map((model) => (
                <div key={model.code} className={`ai-model-card ${model.status}`}>
                  <div className="model-header">
                    <span className="model-code">{model.code}</span>
                    <span className={`model-status ${model.status}`}>
                      {model.status === 'active' ? '활성' : '비활성'}
                    </span>
                  </div>
                  <h3 className="model-name">{model.name}</h3>
                  <p className="model-desc">{model.description}</p>
                  <div className="model-details">
                    <div className="detail-row">
                      <span className="detail-label">OCS 소스</span>
                      <span className="detail-value">{model.ocsSource}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">트리거</span>
                      <span className="detail-value">{model.trigger}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">입력</span>
                      <span className="detail-value">{model.input}</span>
                    </div>
                    <div className="detail-row">
                      <span className="detail-label">출력</span>
                      <span className="detail-value">{model.output}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
