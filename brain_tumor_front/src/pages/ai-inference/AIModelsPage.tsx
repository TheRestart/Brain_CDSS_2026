/**
 * AI 모델 정보 페이지
 * - 사용 가능한 AI 모델 목록
 * - 모델별 상세 정보 및 요구사항
 */
import { useState } from 'react';
import { useAIModels } from '@/hooks';
import { LoadingSpinner } from '@/components/common';
import { AIAnalysisPopup } from '@/components/AIAnalysisPopup';
import './AIModelsPage.css';

// AI 모델 상세 정보 (실제 운영 모델 기준)
const MODEL_DETAILS: Record<string, {
  icon: string;
  category: string;
  inputDescription: string;
  outputDescription: string;
  processingTime: string;
  accuracy: string;
  // 상태, 버전, 통계 정보
  status: 'available' | 'maintenance';
  maintenanceMessage?: string;
  version: string;
  lastUpdated: string;
  weeklyUsage: number;
  successRate: number;
  // 추가 성능 지표
  detailedMetrics?: string;
  trainingData?: string;
}> = {
  M1: {
    icon: '🧠',
    category: 'MRI 분류',
    inputDescription: 'MRI 768-dim features (M1-Seg encoder 출력)',
    outputDescription: 'Grade (II/III/IV), IDH (Mutant/Wildtype), MGMT (Methylated/Unmethylated), Survival Risk',
    processingTime: 'GPU: ~5초 / CPU: ~40초',
    accuracy: 'Grade 83.8%',
    detailedMetrics: 'IDH AUC: 0.878, MGMT AUC: 0.568, C-Index: 0.660',
    trainingData: 'BraTS2021 1,242명',
    status: 'available',
    version: '-',
    lastUpdated: '-',
    weeklyUsage: 0,
    successRate: 0,
  },
  MG: {
    icon: '🧬',
    category: '유전자 발현 분석',
    inputDescription: '2000개 유전자 발현값 + DEG score (4-dim)',
    outputDescription: 'Survival Risk (High/Low), Grade (II/III/IV), Survival Time (일수), Recurrence (재발 여부), 64-dim gene_latent',
    processingTime: '< 5초',
    accuracy: 'Grade 62.3%',
    detailedMetrics: 'C-Index: 0.761, Recurrence AUC: 0.848',
    trainingData: 'CGGA 1,018명',
    status: 'available',
    version: '-',
    lastUpdated: '-',
    weeklyUsage: 0,
    successRate: 0,
  },
  MM: {
    icon: '🔬',
    category: '멀티모달 융합 분석',
    inputDescription: 'MRI (768) + Gene (64) + Protein (229) = 1,061 dim',
    outputDescription: 'Survival (hazard ratio), Recurrence (재발 확률), Risk Group (Low/Medium/High)',
    processingTime: '< 5초',
    accuracy: 'C-Index 0.610',
    detailedMetrics: 'Recurrence AUC: 0.400, Risk AUC: 0.491',
    trainingData: 'TCGA 72명 (5-Fold CV)',
    status: 'available',
    version: '-',
    lastUpdated: '-',
    weeklyUsage: 0,
    successRate: 0,
  },
};

export default function AIModelsPage() {
  const { models, loading, error } = useAIModels();
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);
  const [initialTab, setInitialTab] = useState<'m1' | 'mg' | 'mm'>('m1');

  // 모달 열기 (모델 코드에 따라 초기 탭 설정)
  const openAnalysisPopup = (modelCode?: string) => {
    if (modelCode === 'M1') setInitialTab('m1');
    else if (modelCode === 'MG') setInitialTab('mg');
    else if (modelCode === 'MM') setInitialTab('mm');
    else setInitialTab('m1');
    setShowAnalysisPopup(true);
  };

  if (loading) {
    return (
      <div className="ai-models-page loading">
        <LoadingSpinner />
      </div>
    );
  }

  if (error) {
    return (
      <div className="ai-models-page error-state">
        <p>모델 정보를 불러오는 중 오류가 발생했습니다.</p>
      </div>
    );
  }

  return (
    <div className="ai-models-page">
      {/* 헤더 */}
      <header className="page-header">
        <div>
          <h2>AI 모델 정보</h2>
          <p className="subtitle">사용 가능한 AI 분석 모델 목록 및 상세 정보</p>
        </div>
        <div className="header-actions">
          <button className="btn btn-primary" onClick={() => openAnalysisPopup()}>
            새 분석 요청
          </button>
        </div>
      </header>

      {/* 모델 목록 */}
      <section className="models-section">
        <div className="models-grid">
          {models.map((model) => {
            const details = MODEL_DETAILS[model.code] || {
              icon: '🤖',
              category: 'AI 분석',
              inputDescription: model.description,
              outputDescription: '분석 결과',
              processingTime: '약 3-5분',
              accuracy: '-',
              status: 'available' as const,
              version: '-',
              lastUpdated: '-',
              weeklyUsage: 0,
              successRate: 0,
            };

            const isAvailable = details.status === 'available';

            return (
              <div
                key={model.code}
                className={`model-card ${selectedModel === model.code ? 'selected' : ''} ${!isAvailable ? 'maintenance' : ''}`}
                onClick={() => setSelectedModel(selectedModel === model.code ? null : model.code)}
              >
                <div className="model-header">
                  <div className="model-icon">{details.icon}</div>
                  <div className="model-title">
                    <h3>{model.name}</h3>
                    <span className="model-code">{model.code}</span>
                  </div>
                  {/* NEW: 상태 배지 */}
                  <span className={`model-status-badge status-${details.status}`}>
                    {isAvailable ? '가용' : '점검 중'}
                  </span>
                </div>

                <p className="model-description">{model.description}</p>

                {/* 점검 중일 경우 메시지 표시 */}
                {!isAvailable && details.maintenanceMessage && (
                  <div className="maintenance-notice">
                    {details.maintenanceMessage}
                  </div>
                )}

                <div className="model-meta">
                  <div className="meta-item">
                    <span className="meta-label">처리 시간</span>
                    <span className="meta-value">{details.processingTime}</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">정확도</span>
                    <span className="meta-value accuracy">{details.accuracy}</span>
                  </div>
                  {/* 상세 성능 지표 */}
                  {details.detailedMetrics && (
                    <div className="meta-item full-width">
                      <span className="meta-label">상세 지표</span>
                      <span className="meta-value small">{details.detailedMetrics}</span>
                    </div>
                  )}
                </div>

                {/* 학습 데이터 정보 */}
                {details.trainingData && (
                  <div className="model-version-info">
                    학습 데이터: {details.trainingData}
                  </div>
                )}

                {/* 확장된 상세 정보 */}
                {selectedModel === model.code && (
                  <div className="model-details">
                    <div className="detail-section">
                      <h4>입력 데이터</h4>
                      <p>{details.inputDescription}</p>
                    </div>
                    <div className="detail-section">
                      <h4>출력 결과</h4>
                      <p>{details.outputDescription}</p>
                    </div>
                    <div className="detail-section">
                      <h4>필요 데이터</h4>
                      <div className="required-keys">
                        {Object.keys(model.required_keys || {}).map((key) => (
                          <span key={key} className="key-badge">{key}</span>
                        ))}
                      </div>
                    </div>
                    <button
                      className="btn btn-primary btn-block"
                      onClick={(e) => {
                        e.stopPropagation();
                        openAnalysisPopup(model.code);
                      }}
                    >
                      이 모델로 분석 요청
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>

      {/* 모델 비교 표 */}
      <section className="comparison-section">
        <h3>모델 비교</h3>
        <div className="comparison-table-wrapper">
          <table className="comparison-table">
            <thead>
              <tr>
                <th>모델</th>
                <th>카테고리</th>
                <th>필요 데이터</th>
                <th>처리 시간</th>
                <th>정확도</th>
                <th>동작</th>
              </tr>
            </thead>
            <tbody>
              {models.map((model) => {
                const details = MODEL_DETAILS[model.code] || {
                  icon: '🤖',
                  category: 'AI 분석',
                  processingTime: '약 3-5분',
                  accuracy: '-',
                  status: 'available' as const,
                  version: '-',
                  successRate: 0,
                };

                const isAvailable = details.status === 'available';

                return (
                  <tr key={model.code} className={!isAvailable ? 'maintenance-row' : ''}>
                    <td>
                      <div className="model-cell">
                        <span className="model-icon-small">{details.icon}</span>
                        <div>
                          <div className="model-name">{model.name}</div>
                          <div className="model-code">{model.code}</div>
                        </div>
                        {/* 테이블에도 상태 표시 */}
                        <span className={`table-status-badge status-${details.status}`}>
                          {isAvailable ? '가용' : '점검 중'}
                        </span>
                      </div>
                    </td>
                    <td>{details.category}</td>
                    <td>
                      <div className="required-keys compact">
                        {Object.keys(model.required_keys || {}).slice(0, 3).map((key) => (
                          <span key={key} className="key-badge small">{key}</span>
                        ))}
                        {Object.keys(model.required_keys || {}).length > 3 && (
                          <span className="key-badge small more">+{Object.keys(model.required_keys || {}).length - 3}</span>
                        )}
                      </div>
                    </td>
                    <td>{details.processingTime}</td>
                    <td className="accuracy-cell">{details.accuracy}</td>
                    <td>
                      <button
                        className="btn btn-sm btn-outline"
                        onClick={() => openAnalysisPopup(model.code)}
                      >
                        분석 요청
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      {/* 안내 섹션 */}
      <section className="info-section">
        <div className="info-card">
          <div className="info-icon">ℹ️</div>
          <div className="info-content">
            <h4>AI 분석 요청 안내</h4>
            <p>
              AI 분석을 요청하려면 환자의 해당 검사 데이터가 필요합니다.
              영상 분석(M1)의 경우 RIS에서 MRI 영상이 업로드되어야 하며,
              유전자 분석(MG)의 경우 LIS에서 유전자 검사 결과가 등록되어야 합니다.
            </p>
            <p>
              통합 분석(MM)은 영상, 유전자, 단백질 데이터가 모두 필요하므로
              해당 검사들이 완료된 후 요청하시기 바랍니다.
            </p>
          </div>
        </div>
      </section>

      {/* 새 분석 요청 모달 */}
      <AIAnalysisPopup
        isOpen={showAnalysisPopup}
        onClose={() => setShowAnalysisPopup(false)}
        initialTab={initialTab}
      />
    </div>
  );
}
