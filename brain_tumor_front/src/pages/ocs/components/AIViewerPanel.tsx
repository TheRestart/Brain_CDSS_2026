/**
 * AI Viewer Panel
 * - AI 분석 결과 시각화
 * - M1 모델: 4개 탭 (2D, 3-Axis, 3D, 편집)
 * - 기타 모델: 이미지 뷰어
 */
import { useState, useEffect, useCallback } from 'react';
import { getPatientAIRequests, aiApi } from '@/services/ai.api';
import type { AIInferenceRequest } from '@/services/ai.api';
import SegMRIViewer, { type SegmentationData, type DiceScores, type ViewerLayout } from '@/components/ai/SegMRIViewer/SegMRIViewer';
import SegmentationEditor from '@/components/ai/SegMRIViewer/SegmentationEditor';
import type { SaveSegmentationRequest } from '@/components/ai/SegMRIViewer/types';
import './AIViewerPanel.css';

type M1ViewerTab = '2d' | '3axis' | '3d' | 'edit';

interface AIViewerPanelProps {
  ocsId: number;
  patientId?: number;
  /** 세그멘테이션 편집 가능 여부 (담당 의료진만 true) */
  canEdit?: boolean;
  /** 데이터 리프레시 트리거 (업로드 완료 시 증가시켜 새 데이터 로드) */
  refreshTrigger?: number;
}

export default function AIViewerPanel({ ocsId, patientId, canEdit = false, refreshTrigger = 0 }: AIViewerPanelProps) {
  const [aiRequest, setAiRequest] = useState<AIInferenceRequest | null>(null);
  const [loading, setLoading] = useState(true);
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const [fullscreen, setFullscreen] = useState(false);

  // M1 세그멘테이션 데이터
  const [segData, setSegData] = useState<SegmentationData | null>(null);
  const [diceScores, setDiceScores] = useState<DiceScores | null>(null);
  const [segLoading, setSegLoading] = useState(false);
  const [segError, setSegError] = useState<string | null>(null);

  // M1 뷰어 탭 (2D, 3-Axis, 3D, 편집)
  const [m1Tab, setM1Tab] = useState<M1ViewerTab>('2d');

  // 환자의 모든 M1 AI 요청 목록 (이전 기록 선택용)
  const [allM1Requests, setAllM1Requests] = useState<AIInferenceRequest[]>([]);

  const baseUrl = import.meta.env.VITE_API_BASE_URL || 'http://127.0.0.1:8000';

  // 세그멘테이션 데이터 로드 함수 (저장 후 리로드용)
  const loadSegmentationData = useCallback(async (requestId: string) => {
    setSegLoading(true);
    setSegError(null);
    setDiceScores(null); // 기존 dice scores 초기화
    try {
      const segResponse = await aiApi.getSegmentationData(requestId);
      if (segResponse && segResponse.mri && segResponse.prediction) {
        setSegData({
          mri: segResponse.mri,
          groundTruth: segResponse.groundTruth || segResponse.prediction,
          prediction: segResponse.prediction,
          shape: segResponse.shape,
          mri_channels: segResponse.mri_channels,
          volumes: segResponse.volumes,
        });
        if (segResponse.comparison_metrics) {
          setDiceScores({
            wt: segResponse.comparison_metrics.dice_wt,
            tc: segResponse.comparison_metrics.dice_tc,
            et: segResponse.comparison_metrics.dice_et,
          });
        }
      }
    } catch (err) {
      console.error('Failed to load segmentation data:', err);
      setSegError('세그멘테이션 데이터를 불러오는데 실패했습니다.');
    } finally {
      setSegLoading(false);
    }
  }, []);

  useEffect(() => {
    const fetchAIResult = async () => {
      if (!patientId) {
        setLoading(false);
        return;
      }

      setLoading(true);
      // 기존 데이터 초기화 (새로고침 시 이전 데이터 표시 방지)
      setSegData(null);
      setDiceScores(null);
      setAiRequest(null);
      setAllM1Requests([]);

      try {
        const requests = await getPatientAIRequests(patientId);

        // 환자의 모든 M1 AI 요청 (결과가 있는 것만) - 최신순 정렬
        const m1Requests = requests
          .filter(req => req.model_code === 'M1' && req.has_result)
          .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

        setAllM1Requests(m1Requests);

        // 기본 선택: 가장 최신 M1 요청 (없으면 현재 OCS에 해당하는 다른 모델 요청)
        let selectedRequest: AIInferenceRequest | null = null;

        if (m1Requests.length > 0) {
          // M1 요청이 있으면 가장 최신 것 선택
          selectedRequest = m1Requests[0];
        } else {
          // M1 요청이 없으면 현재 OCS에 대한 다른 모델 요청 선택
          selectedRequest = requests
            .filter(req => req.ocs_references?.includes(ocsId) && req.has_result)
            .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())[0] || null;
        }

        setAiRequest(selectedRequest);

        // M1 모델인 경우 세그멘테이션 데이터 로드
        if (selectedRequest?.model_code === 'M1' && selectedRequest.request_id) {
          await loadSegmentationData(selectedRequest.request_id);
        }
      } catch (error) {
        console.error('Failed to fetch AI result:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchAIResult();
  }, [ocsId, patientId, loadSegmentationData, refreshTrigger]);

  // 이전 기록 선택 핸들러
  const handleSelectHistory = useCallback(async (requestId: string) => {
    const selectedReq = allM1Requests.find(req => req.request_id === requestId);
    if (!selectedReq) return;

    setAiRequest(selectedReq);
    setSegData(null);
    setDiceScores(null);

    if (selectedReq.model_code === 'M1' && selectedReq.request_id) {
      await loadSegmentationData(selectedReq.request_id);
    }
  }, [allM1Requests, loadSegmentationData]);

  // 세그멘테이션 저장 핸들러
  const handleSaveSegmentation = useCallback(async (request: SaveSegmentationRequest) => {
    if (!aiRequest?.request_id) {
      throw new Error('AI 요청 정보가 없습니다.');
    }

    const response = await aiApi.saveSegmentationData(
      aiRequest.request_id,
      request.edited_mask,
      request.shape,
      request.comment
    );

    if (response.success) {
      // 저장 성공 후 데이터 리로드
      await loadSegmentationData(aiRequest.request_id);
      alert('세그멘테이션이 저장되었습니다.');
    } else {
      throw new Error('저장에 실패했습니다.');
    }

    return response;
  }, [aiRequest?.request_id, loadSegmentationData]);

  const visualizationPaths = aiRequest?.result?.visualization_paths || [];
  const isM1Model = aiRequest?.model_code === 'M1';

  if (loading) {
    return (
      <div className="ai-viewer-panel">
        <div className="ai-viewer-header">
          <h3>AI 분석 뷰어</h3>
        </div>
        <div className="ai-viewer-loading">
          <div className="spinner"></div>
          <span>로딩 중...</span>
        </div>
      </div>
    );
  }

  // AI 요청이 없는 경우
  if (!aiRequest) {
    return (
      <div className="ai-viewer-panel">
        <div className="ai-viewer-header">
          <h3>AI 분석 뷰어</h3>
        </div>
        <div className="ai-viewer-empty">
          <div className="empty-icon">🔬</div>
          <span>AI 분석 결과 없음</span>
          <p>이 검사에 대한 AI 분석이 요청되지 않았습니다.</p>
        </div>
      </div>
    );
  }

  // M1 모델 - 세그멘테이션 뷰어
  if (isM1Model) {
    if (segLoading) {
      return (
        <div className="ai-viewer-panel">
          <div className="ai-viewer-header">
            <h3>AI 분석 뷰어</h3>
            <span className="model-badge">{aiRequest.model_name}</span>
          </div>
          <div className="ai-viewer-loading">
            <div className="spinner"></div>
            <span>세그멘테이션 데이터 로딩 중...</span>
          </div>
        </div>
      );
    }

    if (segError || !segData) {
      return (
        <div className="ai-viewer-panel">
          <div className="ai-viewer-header">
            <h3>AI 분석 뷰어</h3>
            <span className="model-badge">{aiRequest.model_name}</span>
          </div>
          <div className="ai-viewer-empty">
            <div className="empty-icon">🧠</div>
            <span>세그멘테이션 데이터 없음</span>
            <p>{segError || '세그멘테이션 데이터를 불러올 수 없습니다.'}</p>
          </div>
        </div>
      );
    }

    // 뷰어 레이아웃 매핑
    const viewerLayoutMap: Record<M1ViewerTab, ViewerLayout> = {
      '2d': 'single',
      '3axis': 'orthogonal',
      '3d': '3d',
      'edit': 'single',
    };

    return (
      <div className="ai-viewer-panel ai-viewer-segmentation">
        <div className="ai-viewer-header">
          <h3>AI 분석 뷰어 - MRI 세그멘테이션</h3>
          <div className="ai-viewer-info">
            <span className="model-badge">{aiRequest.model_name}</span>
            <span className="job-id">{aiRequest.request_id}</span>
          </div>
        </div>
        {/* 이전 기록 선택 드롭다운 */}
        {allM1Requests.length > 1 && (
          <div className="ai-viewer-history-selector">
            <label htmlFor="history-select">분석 기록:</label>
            <select
              id="history-select"
              value={aiRequest.request_id}
              onChange={(e) => handleSelectHistory(e.target.value)}
              className="history-select"
            >
              {allM1Requests.map((req, index) => {
                const date = new Date(req.created_at);
                const isCurrentOcs = req.ocs_references?.includes(ocsId);
                const isLatest = index === 0;
                return (
                  <option key={req.request_id} value={req.request_id}>
                    {date.toLocaleString('ko-KR', {
                      year: 'numeric',
                      month: '2-digit',
                      day: '2-digit',
                      hour: '2-digit',
                      minute: '2-digit'
                    })}
                    {isLatest && ' (최신)'}
                    {isCurrentOcs && ' [현재 OCS]'}
                  </option>
                );
              })}
            </select>
            <span className="history-count">
              총 {allM1Requests.length}건의 분석 기록
            </span>
          </div>
        )}
        {/* 4개 탭: 2D, 3-Axis, 3D, 편집 */}
        <div className="ai-viewer-tabs">
          <button
            className={`ai-viewer-tab ${m1Tab === '2d' ? 'active' : ''}`}
            onClick={() => setM1Tab('2d')}
          >
            2D
          </button>
          <button
            className={`ai-viewer-tab ${m1Tab === '3axis' ? 'active' : ''}`}
            onClick={() => setM1Tab('3axis')}
          >
            3-Axis
          </button>
          <button
            className={`ai-viewer-tab ${m1Tab === '3d' ? 'active' : ''}`}
            onClick={() => setM1Tab('3d')}
          >
            3D
          </button>
          <button
            className={`ai-viewer-tab ai-viewer-tab--edit ${m1Tab === 'edit' ? 'active' : ''}`}
            onClick={() => setM1Tab('edit')}
            disabled={!canEdit}
            title={canEdit ? '세그멘테이션 편집' : '편집 권한 없음 (담당자 + IN_PROGRESS/CONFIRMED 상태 필요)'}
          >
            편집 {!canEdit && '🔒'}
          </button>
        </div>
        <div className="ai-viewer-seg-content">
          {m1Tab === 'edit' && canEdit ? (
            <SegmentationEditor
              data={segData}
              title="종양 세그멘테이션"
              jobId={aiRequest.request_id}
              canEdit={true}
              onSave={handleSaveSegmentation}
              onCancel={() => setM1Tab('2d')}
              maxCanvasSize={400}
            />
          ) : (
            <SegMRIViewer
              data={segData}
              title="종양 세그멘테이션"
              diceScores={diceScores || undefined}
              initialDisplayMode="pred_only"
              initialViewerLayout={viewerLayoutMap[m1Tab]}
              maxCanvasSize={400}
              hideLayoutTabs={true}
              key={m1Tab}
            />
          )}
        </div>
      </div>
    );
  }

  // 기타 모델 - 이미지 없으면 빈 상태
  if (visualizationPaths.length === 0) {
    return (
      <div className="ai-viewer-panel">
        <div className="ai-viewer-header">
          <h3>AI 분석 뷰어</h3>
          <span className="model-badge">{aiRequest.model_name}</span>
        </div>
        <div className="ai-viewer-empty">
          <div className="empty-icon">🔬</div>
          <span>AI 분석 결과 이미지 없음</span>
          <p>이 검사에 대한 AI 분석 이미지가 없습니다.</p>
        </div>
      </div>
    );
  }

  // 기타 모델 - 이미지 뷰어
  const currentImage = visualizationPaths[selectedImageIndex];

  return (
    <>
      <div className="ai-viewer-panel">
        <div className="ai-viewer-header">
          <h3>AI 분석 뷰어</h3>
          <div className="ai-viewer-info">
            <span className="model-badge">{aiRequest.model_name}</span>
            <span className="image-count">{visualizationPaths.length}개 이미지</span>
          </div>
        </div>

        <div className="ai-viewer-content">
          {/* 메인 이미지 영역 */}
          <div className="ai-viewer-main">
            <img
              src={`${baseUrl}${currentImage}`}
              alt={`AI 분석 결과 ${selectedImageIndex + 1}`}
              onClick={() => setFullscreen(true)}
              onError={(e) => {
                (e.target as HTMLImageElement).src = '/placeholder-image.png';
              }}
            />
            <div className="image-controls">
              <button
                className="nav-btn prev"
                onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                disabled={selectedImageIndex === 0}
              >
                &lt;
              </button>
              <span className="image-indicator">
                {selectedImageIndex + 1} / {visualizationPaths.length}
              </span>
              <button
                className="nav-btn next"
                onClick={() => setSelectedImageIndex(Math.min(visualizationPaths.length - 1, selectedImageIndex + 1))}
                disabled={selectedImageIndex === visualizationPaths.length - 1}
              >
                &gt;
              </button>
              <button className="fullscreen-btn" onClick={() => setFullscreen(true)} title="전체화면">
                ⛶
              </button>
            </div>
          </div>

          {/* 썸네일 목록 */}
          {visualizationPaths.length > 1 && (
            <div className="ai-viewer-thumbnails">
              {visualizationPaths.map((path, idx) => (
                <div
                  key={idx}
                  className={`thumbnail-item ${idx === selectedImageIndex ? 'active' : ''}`}
                  onClick={() => setSelectedImageIndex(idx)}
                >
                  <img
                    src={`${baseUrl}${path}`}
                    alt={`썸네일 ${idx + 1}`}
                    onError={(e) => {
                      (e.target as HTMLImageElement).style.display = 'none';
                    }}
                  />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* AI 결과 요약 정보 */}
        {aiRequest.result && (
          <div className="ai-viewer-summary">
            <div className="summary-item">
              <label>신뢰도</label>
              <span>{aiRequest.result.confidence_score ?? '-'}%</span>
            </div>
            <div className="summary-item">
              <label>검토 상태</label>
              <span className={`review-status ${aiRequest.result.review_status}`}>
                {aiRequest.result.review_status_display}
              </span>
            </div>
            <div className="summary-item">
              <label>분석 완료</label>
              <span>{aiRequest.completed_at ? new Date(aiRequest.completed_at).toLocaleString('ko-KR') : '-'}</span>
            </div>
          </div>
        )}
      </div>

      {/* 전체화면 모달 */}
      {fullscreen && (
        <div className="ai-viewer-fullscreen" onClick={() => setFullscreen(false)}>
          <div className="fullscreen-content" onClick={(e) => e.stopPropagation()}>
            <button className="close-btn" onClick={() => setFullscreen(false)}>
              &times;
            </button>
            <img
              src={`${baseUrl}${currentImage}`}
              alt={`AI 분석 결과 ${selectedImageIndex + 1}`}
            />
            <div className="fullscreen-controls">
              <button
                className="nav-btn"
                onClick={() => setSelectedImageIndex(Math.max(0, selectedImageIndex - 1))}
                disabled={selectedImageIndex === 0}
              >
                &larr; 이전
              </button>
              <span>{selectedImageIndex + 1} / {visualizationPaths.length}</span>
              <button
                className="nav-btn"
                onClick={() => setSelectedImageIndex(Math.min(visualizationPaths.length - 1, selectedImageIndex + 1))}
                disabled={selectedImageIndex === visualizationPaths.length - 1}
              >
                다음 &rarr;
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
