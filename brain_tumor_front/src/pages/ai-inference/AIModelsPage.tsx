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

// AI 모델 상세 정보 (확장)
const MODEL_DETAILS: Record<string, {
  icon: string;
  category: string;
  inputDescription: string;
  outputDescription: string;
  processingTime: string;
  accuracy: string;
  // NEW: 상태, 버전, 통계 정보
  status: 'available' | 'maintenance';
  maintenanceMessage?: string;
  version: string;
  lastUpdated: string;
  weeklyUsage: number;
  successRate: number;
}> = {
  M1: {
    icon: '🧠',
    category: '영상 분석',
    inputDescription: 'MRI 4채널 영상 (T1, T2, T1C, FLAIR)',
    outputDescription: '종양 위치, 크기, 등급 예측, 세그멘테이션 마스크',
    processingTime: '약 2-5분',
    accuracy: '92.5%',
    status: 'available',
    version: 'v2.1.0',
    lastUpdated: '2025-01-10',
    weeklyUsage: 45,
    successRate: 89,
  },
  MG: {
    icon: '🧬',
    category: '유전자 분석',
    inputDescription: 'RNA 시퀀싱 데이터, 유전자 변이 정보',
    outputDescription: '유전자 마커 분석, 분자 서브타입 분류, 예후 예측',
    processingTime: '약 3-7분',
    accuracy: '88.2%',
    status: 'available',
    version: 'v1.8.2',
    lastUpdated: '2025-01-05',
    weeklyUsage: 32,
    successRate: 91,
  },
  MM: {
    icon: '🔬',
    category: '통합 분석',
    inputDescription: 'MRI 영상 + RNA_seq + 단백질 마커',
    outputDescription: '종합 진단 결과, 치료 권고, 생존율 예측',
    processingTime: '약 5-10분',
    accuracy: '95.1%',
    status: 'available',
    version: 'v3.0.1',
    lastUpdated: '2025-01-12',
    weeklyUsage: 18,
    successRate: 94,
  },
  MP: {
    icon: '🔮',
    category: '단백질 분석',
    inputDescription: '단백질 마커 데이터',
    outputDescription: '단백질 발현 패턴, 바이오마커 분석',
    processingTime: '약 2-4분',
    accuracy: '86.7%',
    status: 'maintenance',
    maintenanceMessage: '모델 업데이트 중',
    version: 'v1.5.0',
    lastUpdated: '2024-12-20',
    weeklyUsage: 8,
    successRate: 85,
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
                  {/* NEW: 사용 통계 */}
                  <div className="meta-item">
                    <span className="meta-label">금주 사용</span>
                    <span className="meta-value">{details.weeklyUsage}건</span>
                  </div>
                  <div className="meta-item">
                    <span className="meta-label">성공률</span>
                    <span className="meta-value success-rate">{details.successRate}%</span>
                  </div>
                </div>

                {/* NEW: 버전 정보 */}
                <div className="model-version-info">
                  버전: {details.version} ({details.lastUpdated} 업데이트)
                </div>

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
