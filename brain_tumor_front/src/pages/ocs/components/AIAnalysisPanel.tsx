/**
 * AI 분석 결과 패널 (P.82-83)
 * - AI 분석 결과 요약 표시
 * - 실제 AI API 연동
 */
import { useState, useEffect } from 'react';
import { getPatientAIRequests } from '@/services/ai.api';
import type { AIInferenceRequest, AIInferenceResult } from '@/services/ai.api';
import './AIAnalysisPanel.css';

// =============================================================================
// AI 연동 인터페이스 정의 (UI 표시용)
// =============================================================================
export interface AIAnalysisResult {
  analysis_id: string;
  analysis_date: string;
  model_version: string;
  status: 'completed' | 'processing' | 'failed' | 'pending';

  // 위험도 평가
  risk_level: 'high' | 'medium' | 'low' | 'normal';
  risk_score: number; // 0-100
  confidence: number; // 0-100

  // 주요 소견
  findings: AIFinding[];

  // 요약
  summary: string;

  // 상세 분석
  details?: AIAnalysisDetail[];

  // 시각화 이미지 경로 (썸네일용)
  visualization_paths?: string[];
}

export interface AIFinding {
  id: string;
  type: string; // 'lesion', 'abnormality', 'artifact' 등
  description: string;
  location?: string;
  severity: 'critical' | 'major' | 'minor' | 'observation';
  confidence: number;
  bbox?: { x: number; y: number; width: number; height: number };
}

export interface AIAnalysisDetail {
  category: string;
  metrics: { name: string; value: string | number; unit?: string }[];
}


// =============================================================================
// 컴포넌트
// =============================================================================
interface AIAnalysisPanelProps {
  ocsId: number;
  patientId?: number;
  jobType: string;
  compact?: boolean;
}

// AI 추론 결과를 UI 표시용 AIAnalysisResult로 변환
const convertToDisplayResult = (
  request: AIInferenceRequest,
  inferenceResult: AIInferenceResult
): AIAnalysisResult => {
  const resultData = inferenceResult.result_data || {};
  const modelCode = request.model_code;

  // M1 모델 결과 처리 (MRI 분석)
  if (modelCode === 'M1') {
    return convertM1Result(request, resultData);
  }

  // MG 모델 결과 처리 (유전자 분석)
  if (modelCode === 'MG') {
    return convertMGResult(request, resultData);
  }

  // 기본 처리 (MM 또는 기타)
  return convertGenericResult(request, inferenceResult, resultData);
};

// M1 (MRI 분석) 결과 변환
const convertM1Result = (
  request: AIInferenceRequest,
  resultData: Record<string, unknown>
): AIAnalysisResult => {
  const grade = resultData.grade as { predicted_class?: string; probabilities?: Record<string, number> } | undefined;
  const idh = resultData.idh as { predicted_class?: string; probabilities?: Record<string, number> } | undefined;
  const mgmt = resultData.mgmt as { predicted_class?: string; probabilities?: Record<string, number> } | undefined;
  const segmentation = resultData.segmentation as {
    wt_volume?: number;
    tc_volume?: number;
    et_volume?: number;
  } | undefined;

  // Grade에서 위험도 계산
  const gradeClass = grade?.predicted_class || '';
  let riskLevel: 'high' | 'medium' | 'low' | 'normal' = 'normal';
  let riskScore = 0;
  if (gradeClass === 'G4' || gradeClass === 'Grade IV') {
    riskLevel = 'high';
    riskScore = 90;
  } else if (gradeClass === 'G3' || gradeClass === 'Grade III') {
    riskLevel = 'medium';
    riskScore = 60;
  } else if (gradeClass === 'G2' || gradeClass === 'Grade II') {
    riskLevel = 'low';
    riskScore = 30;
  }

  // 신뢰도 계산 (Grade 확률에서)
  const gradeProbs = grade?.probabilities || {};
  const maxProb = Math.max(...Object.values(gradeProbs).filter((v): v is number => typeof v === 'number'), 0);
  const confidence = Math.round(maxProb * 100);

  // 요약 생성
  const summaryParts: string[] = [];
  if (gradeClass) summaryParts.push(`등급: ${gradeClass}`);
  if (idh?.predicted_class) summaryParts.push(`IDH: ${idh.predicted_class}`);
  if (mgmt?.predicted_class) summaryParts.push(`MGMT: ${mgmt.predicted_class}`);
  const summary = summaryParts.length > 0 ? summaryParts.join(' | ') : 'M1 분석 완료';

  // 소견 생성
  const findings: AIFinding[] = [];
  if (gradeClass) {
    findings.push({
      id: 'grade',
      type: 'classification',
      description: `종양 등급: ${gradeClass}`,
      severity: riskLevel === 'high' ? 'critical' : riskLevel === 'medium' ? 'major' : 'minor',
      confidence: confidence,
    });
  }
  if (idh?.predicted_class) {
    findings.push({
      id: 'idh',
      type: 'biomarker',
      description: `IDH 상태: ${idh.predicted_class}`,
      severity: idh.predicted_class === 'Mutant' ? 'minor' : 'major',
      confidence: Math.round((Math.max(...Object.values(idh.probabilities || {}).filter((v): v is number => typeof v === 'number'), 0)) * 100),
    });
  }
  if (mgmt?.predicted_class) {
    findings.push({
      id: 'mgmt',
      type: 'biomarker',
      description: `MGMT 메틸화: ${mgmt.predicted_class}`,
      severity: mgmt.predicted_class === 'Methylated' ? 'minor' : 'major',
      confidence: Math.round((Math.max(...Object.values(mgmt.probabilities || {}).filter((v): v is number => typeof v === 'number'), 0)) * 100),
    });
  }

  // 상세 정보
  const details: AIAnalysisDetail[] = [];
  if (segmentation) {
    details.push({
      category: '종양 부피',
      metrics: [
        { name: '전체 종양 (WT)', value: segmentation.wt_volume?.toFixed(2) || '0', unit: 'ml' },
        { name: '종양 핵심 (TC)', value: segmentation.tc_volume?.toFixed(2) || '0', unit: 'ml' },
        { name: '조영 증강 (ET)', value: segmentation.et_volume?.toFixed(2) || '0', unit: 'ml' },
      ],
    });
  }
  if (grade?.probabilities) {
    details.push({
      category: '등급 확률',
      metrics: Object.entries(grade.probabilities).map(([name, value]) => ({
        name,
        value: typeof value === 'number' ? `${(value * 100).toFixed(1)}%` : String(value),
      })),
    });
  }

  return {
    analysis_id: request.request_id,
    analysis_date: request.completed_at || request.created_at,
    model_version: request.model_name,
    status: 'completed',
    risk_level: riskLevel,
    risk_score: riskScore,
    confidence: confidence,
    findings: findings,
    summary: summary,
    details: details.length > 0 ? details : undefined,
    visualization_paths: [],
  };
};

// MG (유전자 분석) 결과 변환
const convertMGResult = (
  request: AIInferenceRequest,
  resultData: Record<string, unknown>
): AIAnalysisResult => {
  const survivalRisk = resultData.survival_risk as string | undefined;
  const survivalTime = resultData.survival_time as number | undefined;
  const gradeResult = resultData.grade as { predicted_class?: string } | undefined;
  const recurrence = resultData.recurrence as { predicted_class?: string } | undefined;
  const tmzResponse = resultData.tmz_response as { predicted_class?: string } | undefined;

  // 위험도 계산
  let riskLevel: 'high' | 'medium' | 'low' | 'normal' = 'normal';
  let riskScore = 0;
  if (survivalRisk === 'high') {
    riskLevel = 'high';
    riskScore = 80;
  } else if (survivalRisk === 'medium') {
    riskLevel = 'medium';
    riskScore = 50;
  } else if (survivalRisk === 'low') {
    riskLevel = 'low';
    riskScore = 20;
  }

  // 요약
  const summaryParts: string[] = [];
  if (survivalRisk) summaryParts.push(`생존 위험도: ${survivalRisk}`);
  if (survivalTime) summaryParts.push(`예상 생존: ${survivalTime}개월`);
  if (gradeResult?.predicted_class) summaryParts.push(`등급: ${gradeResult.predicted_class}`);
  const summary = summaryParts.length > 0 ? summaryParts.join(' | ') : 'MG 분석 완료';

  // 소견
  const findings: AIFinding[] = [];
  if (survivalRisk) {
    findings.push({
      id: 'survival_risk',
      type: 'prognosis',
      description: `생존 위험도: ${survivalRisk}`,
      severity: riskLevel === 'high' ? 'critical' : riskLevel === 'medium' ? 'major' : 'minor',
      confidence: 85,
    });
  }
  if (recurrence?.predicted_class) {
    findings.push({
      id: 'recurrence',
      type: 'prognosis',
      description: `재발 예측: ${recurrence.predicted_class}`,
      severity: recurrence.predicted_class === 'High' ? 'major' : 'minor',
      confidence: 80,
    });
  }
  if (tmzResponse?.predicted_class) {
    findings.push({
      id: 'tmz',
      type: 'treatment',
      description: `TMZ 반응성: ${tmzResponse.predicted_class}`,
      severity: 'observation',
      confidence: 75,
    });
  }

  return {
    analysis_id: request.request_id,
    analysis_date: request.completed_at || request.created_at,
    model_version: request.model_name,
    status: 'completed',
    risk_level: riskLevel,
    risk_score: riskScore,
    confidence: 80,
    findings: findings,
    summary: summary,
    details: undefined,
    visualization_paths: [],
  };
};

// 기본 결과 변환 (MM 또는 기타)
const convertGenericResult = (
  request: AIInferenceRequest,
  inferenceResult: AIInferenceResult,
  resultData: Record<string, unknown>
): AIAnalysisResult => {
  const riskLevel = (resultData.risk_level as string) || 'normal';
  const riskScore = typeof resultData.risk_score === 'number' ? resultData.risk_score : 0;
  const confidence = inferenceResult.confidence_score ?? (typeof resultData.confidence === 'number' ? resultData.confidence : 0);
  const summary = (resultData.summary as string) || (resultData.diagnosis as string) || '분석이 완료되었습니다.';

  const rawFindings = (resultData.findings as any[]) || [];
  const findings: AIFinding[] = rawFindings.map((f, idx) => ({
    id: `f${idx + 1}`,
    type: f.type || 'observation',
    description: f.description || f.text || '',
    location: f.location,
    severity: f.severity || 'observation',
    confidence: f.confidence ?? 0,
    bbox: f.bbox,
  }));

  const rawDetails = (resultData.details as any[]) || [];
  const details: AIAnalysisDetail[] = rawDetails.map((d) => ({
    category: d.category || d.name || '',
    metrics: (d.metrics || []).map((m: any) => ({
      name: m.name,
      value: m.value,
      unit: m.unit,
    })),
  }));

  return {
    analysis_id: request.request_id,
    analysis_date: request.completed_at || request.created_at,
    model_version: request.model_name,
    status: request.status === 'COMPLETED' ? 'completed'
      : request.status === 'PROCESSING' || request.status === 'VALIDATING' ? 'processing'
      : request.status === 'FAILED' ? 'failed' : 'pending',
    risk_level: riskLevel as 'high' | 'medium' | 'low' | 'normal',
    risk_score: riskScore,
    confidence: confidence,
    findings: findings,
    summary: summary,
    details: details.length > 0 ? details : undefined,
    visualization_paths: inferenceResult.visualization_paths || [],
  };
};

export default function AIAnalysisPanel({ ocsId, patientId, jobType: _jobType, compact = false }: AIAnalysisPanelProps) {
  const [result, setResult] = useState<AIAnalysisResult | null>(null);
  const [aiRequest, setAiRequest] = useState<AIInferenceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [showDetails, setShowDetails] = useState(false);

  useEffect(() => {
    const fetchAIResult = async () => {
      if (!patientId) {
        setLoading(false);
        setResult(null);
        return;
      }

      setLoading(true);
      try {
        // 환자의 AI 추론 요청 목록 조회
        const requests = await getPatientAIRequests(patientId);

        // 현재 OCS를 참조하는 AI 요청 찾기 (가장 최신 것)
        const matchingRequest = requests
          .filter(req => req.ocs_references?.includes(ocsId))
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0];

        if (matchingRequest && matchingRequest.has_result && matchingRequest.result) {
          setAiRequest(matchingRequest);
          const displayResult = convertToDisplayResult(matchingRequest, matchingRequest.result);
          setResult(displayResult);
        } else if (matchingRequest) {
          // 결과가 아직 없는 경우 (처리 중 등)
          setAiRequest(matchingRequest);
          setResult(null);
        } else {
          setAiRequest(null);
          setResult(null);
        }
      } catch (error) {
        console.error('Failed to fetch AI result:', error);
        setResult(null);
      } finally {
        setLoading(false);
      }
    };

    fetchAIResult();
  }, [ocsId, patientId]);

  if (loading) {
    return (
      <div className={`ai-analysis-panel ${compact ? 'compact' : ''}`}>
        <div className="loading-state">
          <div className="spinner"></div>
          <span>AI 분석 결과 로딩 중...</span>
        </div>
      </div>
    );
  }

  if (!result) {
    // AI 요청이 있지만 결과가 아직 없는 경우 (처리 중)
    if (aiRequest) {
      const statusText = aiRequest.status === 'PENDING' ? '대기 중'
        : aiRequest.status === 'VALIDATING' ? '검증 중'
        : aiRequest.status === 'PROCESSING' ? '분석 중'
        : aiRequest.status === 'FAILED' ? '분석 실패'
        : '처리 중';
      const isFailed = aiRequest.status === 'FAILED';

      return (
        <div className={`ai-analysis-panel ${compact ? 'compact' : ''}`}>
          <div className="panel-header">
            <h3>AI 분석 결과</h3>
            <span className="model-version">{aiRequest.model_name}</span>
          </div>
          <div className={`processing-state ${isFailed ? 'failed' : ''}`}>
            {!isFailed && <div className="spinner"></div>}
            <span>{statusText}</span>
            {isFailed && aiRequest.error_message && (
              <p className="error-message">{aiRequest.error_message}</p>
            )}
            <p className="processing-desc">
              {isFailed ? 'AI 분석에 실패했습니다.' : 'AI 모델이 영상을 분석하고 있습니다.'}
            </p>
          </div>
        </div>
      );
    }

    // AI 요청 자체가 없는 경우
    return (
      <div className={`ai-analysis-panel ${compact ? 'compact' : ''}`}>
        <div className="panel-header">
          <h3>AI 분석 결과</h3>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🔬</div>
          <span>AI 분석 결과 없음</span>
          <p className="empty-desc">이 검사에 대한 AI 분석이 요청되지 않았습니다.</p>
        </div>
      </div>
    );
  }

  const getRiskColor = (level: string) => {
    switch (level) {
      case 'high': return '#d32f2f';
      case 'medium': return '#f57c00';
      case 'low': return '#388e3c';
      default: return '#666';
    }
  };

  const getRiskLabel = (level: string) => {
    switch (level) {
      case 'high': return '높음';
      case 'medium': return '중간';
      case 'low': return '낮음';
      default: return '정상';
    }
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'critical': return '#d32f2f';
      case 'major': return '#f57c00';
      case 'minor': return '#fbc02d';
      default: return '#666';
    }
  };

  return (
    <div className={`ai-analysis-panel ${compact ? 'compact' : ''}`}>
      <div className="panel-header">
        <h3>AI 분석 결과</h3>
        <span className="model-version">{result.model_version}</span>
      </div>

      {/* 위험도 요약 */}
      <div className="risk-summary">
        <div className="risk-indicator" style={{ borderColor: getRiskColor(result.risk_level) }}>
          <div
            className="risk-score"
            style={{ color: getRiskColor(result.risk_level) }}
          >
            {result.risk_score}
          </div>
          <div className="risk-label">
            위험도: <strong style={{ color: getRiskColor(result.risk_level) }}>
              {getRiskLabel(result.risk_level)}
            </strong>
          </div>
        </div>
        <div className="confidence">
          <span>신뢰도</span>
          <div className="confidence-bar">
            <div
              className="confidence-fill"
              style={{ width: `${result.confidence}%` }}
            />
          </div>
          <span>{result.confidence}%</span>
        </div>
      </div>

      {/* 요약 */}
      <div className="summary-section">
        <h4>요약</h4>
        <p>{result.summary}</p>
      </div>

      {/* 주요 소견 */}
      {!compact && result.findings.length > 0 && (
        <div className="findings-section">
          <h4>주요 소견</h4>
          <ul className="findings-list">
            {result.findings.map((finding) => (
              <li key={finding.id} className="finding-item">
                <span
                  className="severity-dot"
                  style={{ background: getSeverityColor(finding.severity) }}
                />
                <div className="finding-content">
                  <p className="finding-desc">{finding.description}</p>
                  {finding.location && (
                    <span className="finding-location">{finding.location}</span>
                  )}
                </div>
                <span className="finding-confidence">{finding.confidence}%</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* 상세 분석 토글 */}
      {!compact && result.details && (
        <>
          <button
            className="toggle-details-btn"
            onClick={() => setShowDetails(!showDetails)}
          >
            {showDetails ? '상세 정보 접기' : '상세 정보 보기'}
          </button>

          {showDetails && (
            <div className="details-section">
              {result.details.map((detail, idx) => (
                <div key={idx} className="detail-category">
                  <h5>{detail.category}</h5>
                  <div className="metrics-grid">
                    {detail.metrics.map((metric, mIdx) => (
                      <div key={mIdx} className="metric-item">
                        <span className="metric-name">{metric.name}</span>
                        <span className="metric-value">
                          {metric.value} {metric.unit || ''}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {/* AI 분석 썸네일 이미지 */}
      {result.visualization_paths && result.visualization_paths.length > 0 && (
        <div className="ai-thumbnails-section">
          <h4>분석 이미지</h4>
          <div className="ai-thumbnails-grid">
            {result.visualization_paths.slice(0, 4).map((path, idx) => (
              <div key={idx} className="ai-thumbnail-item">
                <img
                  src={`${import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000'}${path}`}
                  alt={`AI 분석 결과 ${idx + 1}`}
                  onError={(e) => {
                    (e.target as HTMLImageElement).style.display = 'none';
                  }}
                />
              </div>
            ))}
          </div>
          {result.visualization_paths.length > 4 && (
            <p className="thumbnails-more">+{result.visualization_paths.length - 4}개 더 보기</p>
          )}
        </div>
      )}

      {/* 면책 조항 */}
      <div className="disclaimer">
        <p>본 AI 분석 결과는 참고 자료이며, 최종 판단은 전문 의료진의 결정에 따릅니다.</p>
      </div>
    </div>
  );
}
