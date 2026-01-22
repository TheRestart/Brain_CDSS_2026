/**
 * AI 추론 요청 상세 페이지
 * - 요청 정보 조회
 * - 처리 상태 모니터링
 * - 결과 확인 및 검토
 */
import { useState, useCallback, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { useAIRequestDetail } from '@/hooks';
import { LoadingSpinner, useToast } from '@/components/common';
import type { AIInferenceLog } from '@/services/ai.api';
import './AIRequestDetailPage.css';

// 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  PENDING: '대기 중',
  VALIDATING: '검증 중',
  PROCESSING: '처리 중',
  COMPLETED: '완료',
  FAILED: '실패',
  CANCELLED: '취소됨',
};

// 검토 상태 라벨
const REVIEW_STATUS_LABELS: Record<string, string> = {
  pending: '검토 대기',
  approved: '승인됨',
  rejected: '반려됨',
};

export default function AIRequestDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { user: _user } = useAuth();
  const toast = useToast();

  // 상태
  const [showReviewModal, setShowReviewModal] = useState(false);
  const [reviewStatus, setReviewStatus] = useState<'approved' | 'rejected'>('approved');
  const [reviewComment, setReviewComment] = useState('');
  const [showLogs, setShowLogs] = useState(false);

  // 데이터 조회 (URL의 id는 job_id)
  const { request, loading, error, refresh, cancel, review } = useAIRequestDetail(
    id ?? null
  );

  // 모델별 상세 페이지로 리다이렉트
  useEffect(() => {
    if (!request?.model_code || !request?.request_id) return;

    const modelCode = request.model_code;
    const requestId = request.request_id;

    if (modelCode === 'M1') {
      navigate(`/ai/m1/${requestId}`, { replace: true });
    } else if (modelCode === 'MG') {
      navigate(`/ai/mg/${requestId}`, { replace: true });
    } else if (modelCode === 'MM') {
      navigate(`/ai/mm/${requestId}`, { replace: true });
    }
  }, [request?.model_code, request?.request_id, navigate]);

  // 시간 포맷
  const formatDateTime = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  };

  // 처리 시간 포맷
  const formatProcessingTime = (seconds: number | null) => {
    if (seconds === null) return '-';
    if (seconds < 60) return `${seconds}초`;
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins}분 ${secs}초`;
  };

  // 취소 처리
  const handleCancel = useCallback(async () => {
    if (!confirm('AI 분석 요청을 취소하시겠습니까?')) return;

    try {
      await cancel();
      toast.success('AI 분석 요청이 취소되었습니다.');
    } catch (err) {
      toast.error('취소에 실패했습니다.');
    }
  }, [cancel, toast]);

  // 검토 제출
  const handleReviewSubmit = useCallback(async () => {
    try {
      await review(reviewStatus, reviewComment || undefined);
      toast.success(`결과가 ${reviewStatus === 'approved' ? '승인' : '반려'}되었습니다.`);
      setShowReviewModal(false);
      setReviewComment('');
    } catch (err) {
      toast.error('검토 처리에 실패했습니다.');
    }
  }, [review, reviewStatus, reviewComment, toast]);

  // 뒤로 가기
  const handleBack = useCallback(() => {
    navigate('/ai/requests');
  }, [navigate]);

  if (loading && !request) {
    return (
      <div className="page ai-request-detail">
        <LoadingSpinner text="AI 분석 요청을 불러오는 중..." />
      </div>
    );
  }

  if (error || !request) {
    return (
      <div className="page ai-request-detail">
        <div className="error-state">
          <p>{error || 'AI 분석 요청을 찾을 수 없습니다.'}</p>
          <button className="btn btn-primary" onClick={handleBack}>
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const isProcessing = ['PENDING', 'VALIDATING', 'PROCESSING'].includes(request.status);
  const canCancel = ['PENDING', 'VALIDATING'].includes(request.status);
  const canReview = request.has_result && request.result?.review_status === 'pending';

  return (
    <div className="page ai-request-detail">
      {/* 헤더 */}
      <header className="page-header">
        <button className="btn btn-back" onClick={handleBack}>
          &larr; 목록
        </button>
        <div className="header-content">
          <h2>AI 분석 요청 상세</h2>
          <span className="request-id">{request.request_id}</span>
        </div>
        <div className="header-actions">
          {canCancel && (
            <button className="btn btn-danger" onClick={handleCancel}>
              요청 취소
            </button>
          )}
          <button className="btn btn-secondary" onClick={refresh}>
            새로고침
          </button>
        </div>
      </header>

      {/* 상태 배너 */}
      <div className={`status-banner status-${request.status.toLowerCase()}`}>
        <span className="status-label">{STATUS_LABELS[request.status]}</span>
        {isProcessing && <span className="processing-indicator"></span>}
        {request.error_message && (
          <span className="error-message">{request.error_message}</span>
        )}
      </div>

      <div className="content-grid">
        {/* 요청 정보 */}
        <section className="info-card">
          <h3>요청 정보</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>환자</label>
              <span>{request.patient_name} ({request.patient_number})</span>
            </div>
            <div className="info-item">
              <label>분석 모델</label>
              <span>{request.model_name} ({request.model_code})</span>
            </div>
            <div className="info-item">
              <label>요청자</label>
              <span>{request.requested_by_name}</span>
            </div>
            <div className="info-item">
              <label>우선순위</label>
              <span className={`priority-badge priority-${request.priority}`}>
                {request.priority_display}
              </span>
            </div>
            <div className="info-item">
              <label>요청일시</label>
              <span>{formatDateTime(request.requested_at)}</span>
            </div>
            <div className="info-item">
              <label>시작일시</label>
              <span>{formatDateTime(request.started_at)}</span>
            </div>
            <div className="info-item">
              <label>완료일시</label>
              <span>{formatDateTime(request.completed_at)}</span>
            </div>
            <div className="info-item">
              <label>처리시간</label>
              <span>{formatProcessingTime(request.processing_time)}</span>
            </div>
          </div>
        </section>

        {/* 입력 데이터 */}
        <section className="info-card">
          <h3>입력 데이터</h3>
          <div className="input-data">
            {Object.entries(request.input_data).length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    <th>키</th>
                    <th>값</th>
                  </tr>
                </thead>
                <tbody>
                  {Object.entries(request.input_data).map(([key, value]) => (
                    <tr key={key}>
                      <td className="key">{key}</td>
                      <td className="value">
                        {typeof value === 'object' ? JSON.stringify(value) : String(value)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="empty">입력 데이터가 없습니다.</p>
            )}
          </div>
        </section>

        {/* 분석 결과 */}
        {request.has_result && request.result && (
          <section className="info-card result-card">
            <div className="card-header">
              <h3>분석 결과</h3>
              {canReview && (
                <button
                  className="btn btn-primary"
                  onClick={() => setShowReviewModal(true)}
                >
                  결과 검토
                </button>
              )}
            </div>

            {/* 신뢰도 점수 */}
            {request.result.confidence_score !== null && (
              <div className="confidence-section">
                <label>신뢰도 점수</label>
                <div className="confidence-bar-container">
                  <div
                    className="confidence-bar"
                    style={{ width: `${request.result.confidence_score}%` }}
                  />
                  <span className="confidence-value">{request.result.confidence_score}%</span>
                </div>
              </div>
            )}

            {/* 검토 상태 */}
            <div className="review-status">
              <label>검토 상태</label>
              <span className={`review-badge review-${request.result.review_status}`}>
                {REVIEW_STATUS_LABELS[request.result.review_status]}
              </span>
              {request.result.reviewed_by_name && (
                <span className="reviewer">
                  검토자: {request.result.reviewed_by_name} ({formatDateTime(request.result.reviewed_at)})
                </span>
              )}
              {request.result.review_comment && (
                <p className="review-comment">"{request.result.review_comment}"</p>
              )}
            </div>

            {/* 결과 데이터 */}
            <div className="result-data">
              <h4>결과 데이터</h4>
              <pre className="json-view">
                {JSON.stringify(request.result.result_data, null, 2)}
              </pre>
            </div>

            {/* 시각화 경로 */}
            {request.result.visualization_paths.length > 0 && (
              <div className="visualization-paths">
                <h4>시각화 이미지</h4>
                <ul>
                  {request.result.visualization_paths.map((path, idx) => (
                    <li key={idx}>
                      <a href={path} target="_blank" rel="noopener noreferrer">
                        {path}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </section>
        )}

        {/* 처리 로그 */}
        {request.logs && request.logs.length > 0 && (
          <section className="info-card logs-card">
            <div className="card-header">
              <h3>처리 로그</h3>
              <button
                className="btn btn-text"
                onClick={() => setShowLogs(!showLogs)}
              >
                {showLogs ? '접기' : '펼치기'}
              </button>
            </div>

            {showLogs && (
              <div className="logs-list">
                {request.logs.map((log: AIInferenceLog) => (
                  <div key={log.id} className="log-item">
                    <span className="log-time">
                      {formatDateTime(log.created_at)}
                    </span>
                    <span className="log-action">{log.action_display}</span>
                    <span className="log-message">{log.message}</span>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* 검토 모달 */}
      {showReviewModal && (
        <div className="modal-overlay" onClick={() => setShowReviewModal(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h3>결과 검토</h3>

            <div className="review-options">
              <button
                className={`review-option ${reviewStatus === 'approved' ? 'selected' : ''}`}
                onClick={() => setReviewStatus('approved')}
              >
                <span className="icon icon-approve">&#10003;</span>
                <span>승인</span>
              </button>
              <button
                className={`review-option ${reviewStatus === 'rejected' ? 'selected' : ''}`}
                onClick={() => setReviewStatus('rejected')}
              >
                <span className="icon icon-reject">&#10007;</span>
                <span>반려</span>
              </button>
            </div>

            <div className="review-comment-input">
              <label>검토 의견 (선택)</label>
              <textarea
                value={reviewComment}
                onChange={(e) => setReviewComment(e.target.value)}
                placeholder="검토 의견을 입력하세요..."
                rows={3}
              />
            </div>

            <div className="modal-actions">
              <button
                className="btn btn-secondary"
                onClick={() => setShowReviewModal(false)}
              >
                취소
              </button>
              <button className="btn btn-primary" onClick={handleReviewSubmit}>
                제출
              </button>
            </div>
          </div>
        </div>
      )}

      <toast.ToastContainer position="top-right" />
    </div>
  );
}
