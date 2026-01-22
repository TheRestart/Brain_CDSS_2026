import { useState, useEffect, useRef } from 'react';
import { useAuth } from '../auth/AuthProvider';
import {
  getOCS,
  acceptOCS,
  startOCS,
  submitOCSResult,
  confirmOCS,
  cancelOCS,
} from '@/services/ocs.api';
import type { OCSDetail, OCSHistory, LISWorkerResult, RISWorkerResult } from '@/types/ocs';
import { isRISWorkerResult, isLISWorkerResult } from '@/types/ocs';

// worker_result에 저장되는 확장 필드 (LIS 상세 페이지에서 저장)
interface LISExtendedResult extends LISWorkerResult {
  labResults?: {
    testName: string;
    value: string;
    unit: string;
    refRange: string;
    flag: 'normal' | 'abnormal' | 'critical';
  }[];
  notes?: string;
  _verifiedBy?: string;
}

// worker_result에 저장되는 확장 필드 (RIS)
interface RISExtendedResult extends RISWorkerResult {
  _verifiedBy?: string;
}
import '@/pages/patient/PatientCreateModal.css';
import './OCSDetailModalReport.css';

type Props = {
  isOpen: boolean;
  ocsId: number;
  onClose: () => void;
  onSuccess: () => void;
};

// 검사 결과 요약 정보 타입
interface ResultSummary {
  testName: string;
  totalMarkers: number;
  abnormalCount: number;
  status: 'normal' | 'caution' | 'critical';
  completedAt: string | null;
}

// 검사 결과 아이템 타입 (테이블 표시용)
interface ResultItem {
  markerName: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'normal' | 'abnormal' | 'critical';
}

// AI 해석 요약 타입
interface AIInterpretation {
  summary: string[];
  recommendations: string[];
}

// 날짜 포맷
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 날짜만 포맷
const formatDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

// 파일 크기 포맷
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

// 검사 결과 요약 계산 함수
const calculateResultSummary = (ocs: OCSDetail): ResultSummary => {
  const workerResult = ocs.worker_result as LISWorkerResult | RISWorkerResult;
  let totalMarkers = 0;
  let abnormalCount = 0;

  // LIS 검사 결과
  if (ocs.job_role === 'LIS') {
    const lisResult = workerResult as LISWorkerResult;

    // protein_markers (RPPA 등)
    if (lisResult?.protein_markers?.length) {
      totalMarkers = lisResult.protein_markers.length;
      abnormalCount = lisResult.protein_markers.filter(m => m.is_abnormal).length;
    }
    // test_results (일반 검사)
    else if (lisResult?.test_results?.length) {
      totalMarkers = lisResult.test_results.length;
      abnormalCount = lisResult.test_results.filter(r => r.is_abnormal).length;
    }
    // gene_mutations (유전자 검사)
    else if (lisResult?.gene_mutations?.length) {
      totalMarkers = lisResult.gene_mutations.length;
      abnormalCount = lisResult.gene_mutations.filter(m =>
        m.clinical_significance === 'pathogenic' || m.clinical_significance === 'likely_pathogenic'
      ).length;
    }
  }
  // RIS 영상 결과
  else if (ocs.job_role === 'RIS') {
    const risResult = workerResult as RISWorkerResult;
    if (risResult?.imageResults?.length) {
      totalMarkers = risResult.imageResults.length;
      abnormalCount = risResult.imageResults.filter(r => r.flag !== 'normal').length;
    }
  }

  let status: 'normal' | 'caution' | 'critical' = 'normal';
  if (abnormalCount > 0) {
    status = abnormalCount >= 3 ? 'critical' : 'caution';
  }

  return {
    testName: ocs.job_type,
    totalMarkers,
    abnormalCount,
    status,
    completedAt: ocs.confirmed_at || ocs.result_ready_at,
  };
};

// 구조화된 검사 결과 추출
const extractResultItems = (ocs: OCSDetail): ResultItem[] => {
  const workerResult = ocs.worker_result as LISWorkerResult | RISWorkerResult;
  const items: ResultItem[] = [];

  if (ocs.job_role === 'LIS') {
    const lisResult = workerResult as LISWorkerResult;

    // protein_markers
    if (lisResult?.protein_markers?.length) {
      lisResult.protein_markers.forEach(m => {
        items.push({
          markerName: m.marker_name,
          value: m.value,
          unit: m.unit || '',
          refRange: m.reference_range || '-',
          flag: m.is_abnormal ? 'abnormal' : 'normal',
        });
      });
    }
    // test_results
    else if (lisResult?.test_results?.length) {
      lisResult.test_results.forEach(r => {
        items.push({
          markerName: r.name,
          value: r.value,
          unit: r.unit,
          refRange: r.reference,
          flag: r.is_abnormal ? 'abnormal' : 'normal',
        });
      });
    }
  } else if (ocs.job_role === 'RIS') {
    const risResult = workerResult as RISWorkerResult;
    if (risResult?.imageResults?.length) {
      risResult.imageResults.forEach(r => {
        items.push({
          markerName: r.itemName,
          value: r.value,
          unit: r.unit,
          refRange: r.refRange,
          flag: r.flag,
        });
      });
    }
  }

  return items;
};

// AI 해석 추출
const extractAIInterpretation = (ocs: OCSDetail): AIInterpretation | null => {
  const workerResult = ocs.worker_result as LISWorkerResult | RISWorkerResult;
  const summary: string[] = [];
  const recommendations: string[] = [];

  if (ocs.job_role === 'LIS') {
    const lisResult = workerResult as LISWorkerResult;
    if (lisResult?.interpretation) {
      summary.push(lisResult.interpretation);
    }
    if (lisResult?.summary) {
      summary.push(lisResult.summary);
    }
  } else if (ocs.job_role === 'RIS') {
    const risResult = workerResult as RISWorkerResult;
    if (risResult?.impression) {
      summary.push(risResult.impression);
    }
    if (risResult?.findings) {
      summary.push(risResult.findings);
    }
    if (risResult?.recommendation) {
      recommendations.push(risResult.recommendation);
    }
  }

  if (summary.length === 0 && recommendations.length === 0) {
    return null;
  }

  return { summary, recommendations };
};

export default function OCSDetailModal({ isOpen, ocsId, onClose, onSuccess }: Props) {
  const { role, user } = useAuth();
  const [ocs, setOcs] = useState<OCSDetail | null>(null);
  const [loading, setLoading] = useState(false);
  const [actionLoading, setActionLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<'info' | 'result' | 'ai' | 'attachments' | 'raw' | 'history' | 'report'>('info');
  const [cancelReason, setCancelReason] = useState('');
  const [isRequestExpanded, setIsRequestExpanded] = useState(false);
  const [isResultExpanded, setIsResultExpanded] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && ocsId) {
      fetchOCSDetail();
    }
  }, [isOpen, ocsId]);

  const fetchOCSDetail = async () => {
    setLoading(true);
    try {
      const data = await getOCS(ocsId);
      setOcs(data);
    } catch (error) {
      console.error('Failed to fetch OCS detail:', error);
    } finally {
      setLoading(false);
    }
  };

  if (!isOpen) return null;

  // 권한 체크
  const isDoctor = ocs?.doctor.id === user?.id;
  const isWorker = ocs?.worker?.id === user?.id;
  const isAdmin = ['SYSTEMMANAGER', 'ADMIN'].includes(role || '');
  const canAccept =
    ocs?.ocs_status === 'ORDERED' &&
    !ocs?.worker &&
    (role === ocs?.job_role || isAdmin);
  const canStart = ocs?.ocs_status === 'ACCEPTED' && isWorker;
  const canSubmit = ocs?.ocs_status === 'IN_PROGRESS' && isWorker;
  const canConfirm = ocs?.ocs_status === 'RESULT_READY' && isDoctor;
  const canCancel =
    ocs?.is_editable &&
    (isDoctor || isWorker) &&
    ocs?.ocs_status !== 'CONFIRMED' &&
    ocs?.ocs_status !== 'CANCELLED';

  // 액션 핸들러들
  const handleAccept = async () => {
    if (!ocs) return;
    setActionLoading(true);
    try {
      await acceptOCS(ocs.id);
      await fetchOCSDetail();
      onSuccess();
    } catch (error) {
      console.error('Failed to accept OCS:', error);
      alert('접수에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleStart = async () => {
    if (!ocs) return;
    setActionLoading(true);
    try {
      await startOCS(ocs.id);
      await fetchOCSDetail();
      onSuccess();
    } catch (error) {
      console.error('Failed to start OCS:', error);
      alert('작업 시작에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleSubmit = async () => {
    if (!ocs) return;
    setActionLoading(true);
    try {
      await submitOCSResult(ocs.id, {
        worker_result: ocs.worker_result,
        attachments: ocs.attachments,
      });
      await fetchOCSDetail();
      onSuccess();
    } catch (error) {
      console.error('Failed to submit OCS result:', error);
      alert('결과 제출에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleConfirm = async (result: boolean) => {
    if (!ocs) return;
    setActionLoading(true);
    try {
      await confirmOCS(ocs.id, { ocs_result: result });
      await fetchOCSDetail();
      onSuccess();
    } catch (error) {
      console.error('Failed to confirm OCS:', error);
      alert('확정에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  const handleCancel = async () => {
    if (!ocs) return;
    if (!confirm('정말 취소하시겠습니까?')) return;
    setActionLoading(true);
    try {
      await cancelOCS(ocs.id, { cancel_reason: cancelReason });
      await fetchOCSDetail();
      onSuccess();
      setCancelReason('');
    } catch (error) {
      console.error('Failed to cancel OCS:', error);
      alert('취소에 실패했습니다.');
    } finally {
      setActionLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-xl" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>OCS 상세 정보</h2>
          <button className="close-btn" onClick={onClose}>
            &times;
          </button>
        </div>

        {loading ? (
          <div className="modal-body">로딩 중...</div>
        ) : ocs ? (
          <>
            {/* 상단 요약 영역 */}
            {ocs.worker_result && Object.keys(ocs.worker_result).length > 0 && (
              <div className="summary-header">
                {(() => {
                  const summary = calculateResultSummary(ocs);
                  return (
                    <>
                      <div className="summary-item">
                        <span className="summary-label">검사명</span>
                        <span className="summary-value">{summary.testName}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">총 마커 수</span>
                        <span className="summary-value">{summary.totalMarkers}</span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">이상 소견</span>
                        <span className={`summary-value ${summary.abnormalCount > 0 ? 'highlight-abnormal' : ''}`}>
                          {summary.abnormalCount}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">판정 상태</span>
                        <span className={`status-indicator status-${summary.status}`}>
                          {summary.status === 'normal' ? '정상' : summary.status === 'caution' ? '주의 필요' : '위험'}
                        </span>
                      </div>
                      <div className="summary-item">
                        <span className="summary-label">검사 완료</span>
                        <span className="summary-value">{formatDate(summary.completedAt)}</span>
                      </div>
                    </>
                  );
                })()}
              </div>
            )}

            {/* 탭 메뉴 */}
            <div className="tab-menu">
              <button
                className={activeTab === 'info' ? 'active' : ''}
                onClick={() => setActiveTab('info')}
              >
                기본 정보
              </button>
              <button
                className={activeTab === 'result' ? 'active' : ''}
                onClick={() => setActiveTab('result')}
              >
                검사 결과
              </button>
              <button
                className={activeTab === 'ai' ? 'active' : ''}
                onClick={() => setActiveTab('ai')}
              >
                AI 해석
              </button>
              <button
                className={activeTab === 'attachments' ? 'active' : ''}
                onClick={() => setActiveTab('attachments')}
              >
                첨부 파일
              </button>
              <button
                className={activeTab === 'raw' ? 'active' : ''}
                onClick={() => setActiveTab('raw')}
              >
                원본 데이터
              </button>
              <button
                className={activeTab === 'history' ? 'active' : ''}
                onClick={() => setActiveTab('history')}
              >
                이력
              </button>
              <button
                className={activeTab === 'report' ? 'active' : ''}
                onClick={() => setActiveTab('report')}
              >
                보고서
              </button>
            </div>

            <div className="modal-body">
              {/* 기본 정보 탭 */}
              {activeTab === 'info' && (
                <div className="info-grid">
                  <div className="info-row">
                    <label>OCS ID:</label>
                    <span>{ocs.ocs_id}</span>
                  </div>
                  <div className="info-row">
                    <label>상태:</label>
                    <span className={`status-badge status-${ocs.ocs_status.toLowerCase()}`}>
                      {ocs.ocs_status_display}
                    </span>
                  </div>
                  <div className="info-row">
                    <label>우선순위:</label>
                    <span className={`priority-badge priority-${ocs.priority}`}>
                      {ocs.priority_display}
                    </span>
                  </div>
                  <div className="info-row">
                    <label>환자:</label>
                    <span>{ocs.patient.name} ({ocs.patient.patient_number})</span>
                  </div>
                  <div className="info-row">
                    <label>처방 의사:</label>
                    <span>{ocs.doctor.name}</span>
                  </div>
                  <div className="info-row">
                    <label>작업자:</label>
                    <span>{ocs.worker ? ocs.worker.name : '미배정'}</span>
                  </div>
                  <div className="info-row">
                    <label>작업 역할:</label>
                    <span>{ocs.job_role}</span>
                  </div>
                  <div className="info-row">
                    <label>작업 유형:</label>
                    <span>{ocs.job_type}</span>
                  </div>
                  <div className="info-row">
                    <label>생성일시:</label>
                    <span>{formatDate(ocs.created_at)}</span>
                  </div>
                  <div className="info-row">
                    <label>접수일시:</label>
                    <span>{formatDate(ocs.accepted_at)}</span>
                  </div>
                  <div className="info-row">
                    <label>진행시작:</label>
                    <span>{formatDate(ocs.in_progress_at)}</span>
                  </div>
                  <div className="info-row">
                    <label>결과대기:</label>
                    <span>{formatDate(ocs.result_ready_at)}</span>
                  </div>
                  <div className="info-row">
                    <label>확정일시:</label>
                    <span>{formatDate(ocs.confirmed_at)}</span>
                  </div>
                  {ocs.ocs_status === 'CONFIRMED' && (
                    <div className="info-row">
                      <label>결과:</label>
                      <span>{ocs.ocs_result ? '정상' : '비정상'}</span>
                    </div>
                  )}
                  {ocs.cancel_reason && (
                    <div className="info-row">
                      <label>취소 사유:</label>
                      <span>{ocs.cancel_reason}</span>
                    </div>
                  )}
                </div>
              )}

              {/* 검사 결과 탭 - 구조화된 테이블 */}
              {activeTab === 'result' && (
                <div className="result-section structured-result">
                  {/* 의사 요청 사항 */}
                  {ocs.doctor_request && Object.keys(ocs.doctor_request).length > 0 && (
                    <div className="request-summary-box">
                      <h4>의사 요청 사항</h4>
                      <div className="request-details">
                        {ocs.doctor_request.chief_complaint && (
                          <div className="request-row">
                            <label>주소(Chief Complaint)</label>
                            <span>{ocs.doctor_request.chief_complaint}</span>
                          </div>
                        )}
                        {ocs.doctor_request.clinical_info && (
                          <div className="request-row">
                            <label>임상 정보</label>
                            <span>{ocs.doctor_request.clinical_info}</span>
                          </div>
                        )}
                        {ocs.doctor_request.request_detail && (
                          <div className="request-row">
                            <label>요청 내용</label>
                            <span>{ocs.doctor_request.request_detail}</span>
                          </div>
                        )}
                        {ocs.doctor_request.special_instruction && (
                          <div className="request-row">
                            <label>특별 지시</label>
                            <span>{ocs.doctor_request.special_instruction}</span>
                          </div>
                        )}
                      </div>
                    </div>
                  )}

                  {/* 구조화된 검사 결과 테이블 */}
                  <h4>검사 결과</h4>
                  {(() => {
                    const resultItems = extractResultItems(ocs);
                    if (resultItems.length > 0) {
                      return (
                        <table className="result-data-table">
                          <thead>
                            <tr>
                              <th>마커명</th>
                              <th>측정값</th>
                              <th>단위</th>
                              <th>기준 범위</th>
                              <th>판정</th>
                            </tr>
                          </thead>
                          <tbody>
                            {resultItems.map((item, idx) => (
                              <tr key={idx} className={item.flag !== 'normal' ? `row-${item.flag}` : ''}>
                                <td>{item.markerName}</td>
                                <td className={item.flag !== 'normal' ? 'value-highlight' : ''}>
                                  {item.value}
                                </td>
                                <td>{item.unit}</td>
                                <td>{item.refRange}</td>
                                <td>
                                  <span className={`flag-badge flag-${item.flag}`}>
                                    {item.flag === 'normal' ? '정상' :
                                     item.flag === 'abnormal' ? '이상' : '위험'}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      );
                    } else {
                      // 구조화되지 않은 결과 - RIS 소견 등
                      const workerResult = ocs.worker_result as RISWorkerResult;
                      if (ocs.job_role === 'RIS' && (workerResult?.findings || workerResult?.impression)) {
                        return (
                          <div className="text-result-section">
                            {workerResult.findings && (
                              <div className="result-block">
                                <h5>소견 (Findings)</h5>
                                <p className="result-text">{workerResult.findings}</p>
                              </div>
                            )}
                            {workerResult.impression && (
                              <div className="result-block">
                                <h5>인상 (Impression)</h5>
                                <p className="result-text">{workerResult.impression}</p>
                              </div>
                            )}
                          </div>
                        );
                      }
                      return <p className="no-data">아직 검사 결과가 없습니다.</p>;
                    }
                  })()}
                </div>
              )}

              {/* AI 해석 탭 */}
              {activeTab === 'ai' && (
                <div className="ai-interpretation-section">
                  <h4>AI 해석 요약</h4>
                  {(() => {
                    const aiInterpretation = extractAIInterpretation(ocs);
                    if (aiInterpretation) {
                      return (
                        <>
                          {aiInterpretation.summary.length > 0 && (
                            <div className="ai-summary-box">
                              <ul className="ai-summary-list">
                                {aiInterpretation.summary.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                          {aiInterpretation.recommendations.length > 0 && (
                            <div className="ai-recommendations-box">
                              <h5>권고 사항</h5>
                              <ul className="ai-recommendations-list">
                                {aiInterpretation.recommendations.map((item, idx) => (
                                  <li key={idx}>{item}</li>
                                ))}
                              </ul>
                            </div>
                          )}
                        </>
                      );
                    } else {
                      return <p className="no-data">AI 해석 결과가 없습니다.</p>;
                    }
                  })()}
                </div>
              )}

              {/* 첨부 파일 탭 */}
              {activeTab === 'attachments' && (
                <div className="attachments-section">
                  <h4>첨부 파일 정보</h4>
                  {ocs.attachments?.files && ocs.attachments.files.length > 0 ? (
                    <>
                      <table className="attachments-detail-table">
                        <thead>
                          <tr>
                            <th>파일명</th>
                            <th>유형</th>
                            <th>크기</th>
                            <th>업로드 시간</th>
                            <th>기능</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocs.attachments.files.map((file, idx) => (
                            <tr key={idx}>
                              <td className="file-name-cell">{file.name}</td>
                              <td>{file.type}</td>
                              <td>{formatFileSize(file.size)}</td>
                              <td>{formatDate(ocs.attachments.last_modified)}</td>
                              <td className="action-cell">
                                <button className="btn-small btn-download">다운로드</button>
                                {file.preview !== 'none' && file.preview !== 'download' && (
                                  <button className="btn-small btn-preview">미리보기</button>
                                )}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ocs.attachments.total_size > 0 && (
                        <div className="attachments-total">
                          총 {ocs.attachments.files.length}개 파일 |
                          전체 크기: {formatFileSize(ocs.attachments.total_size)}
                        </div>
                      )}
                    </>
                  ) : (
                    <p className="no-data">첨부된 파일이 없습니다.</p>
                  )}
                </div>
              )}

              {/* 원본 데이터(JSON) 탭 */}
              {activeTab === 'raw' && (
                <div className="raw-data-section">
                  <div className="raw-data-header">
                    <h4>원본 데이터 (JSON)</h4>
                    <span className="raw-data-notice">개발자 / 관리자 / AI 검증용</span>
                  </div>

                  <div className="collapsible-section">
                    <button
                      className={`collapsible-toggle ${isRequestExpanded ? 'expanded' : ''}`}
                      onClick={() => setIsRequestExpanded(!isRequestExpanded)}
                    >
                      {isRequestExpanded ? '접기' : '펼치기'} - 의사 요청 (doctor_request)
                    </button>
                    {isRequestExpanded && (
                      <pre className="json-viewer">
                        {JSON.stringify(ocs.doctor_request, null, 2)}
                      </pre>
                    )}
                  </div>

                  <div className="collapsible-section">
                    <button
                      className={`collapsible-toggle ${isResultExpanded ? 'expanded' : ''}`}
                      onClick={() => setIsResultExpanded(!isResultExpanded)}
                    >
                      {isResultExpanded ? '접기' : '펼치기'} - 작업 결과 (worker_result)
                    </button>
                    {isResultExpanded && (
                      <pre className="json-viewer">
                        {JSON.stringify(ocs.worker_result, null, 2)}
                      </pre>
                    )}
                  </div>
                </div>
              )}

              {/* 이력 탭 */}
              {activeTab === 'history' && (
                <div className="history-section">
                  <table className="history-table">
                    <thead>
                      <tr>
                        <th>일시</th>
                        <th>액션</th>
                        <th>수행자</th>
                        <th>상태 변경</th>
                        <th>사유</th>
                      </tr>
                    </thead>
                    <tbody>
                      {ocs.history.map((h: OCSHistory) => (
                        <tr key={h.id}>
                          <td>{formatDate(h.created_at)}</td>
                          <td>{h.action_display}</td>
                          <td>
                            {h.actor
                              ? h.actor.name
                              : '-'}
                          </td>
                          <td>
                            {h.from_status && h.to_status
                              ? `${h.from_status} → ${h.to_status}`
                              : h.to_status || '-'}
                          </td>
                          <td>{h.reason || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}

              {/* 보고서 탭 - 항상 렌더링하되, 인쇄용으로도 사용 */}
              <div
                className={`report-tab-section ${activeTab !== 'report' ? 'screen-hidden' : ''}`}
                ref={reportRef}
              >
                  {/* 보고서 헤더 */}
                  <div className="report-tab-header">
                    <h3>검사 결과 보고서</h3>
                    <div className="report-meta">
                      <span className="report-id">{ocs.ocs_id}</span>
                      <span className={`report-type-badge ${ocs.job_role.toLowerCase()}`}>
                        {ocs.job_role === 'RIS' ? '영상검사' :
                         ocs.job_role === 'LIS' ? '임상검사' :
                         ocs.job_role}
                      </span>
                    </div>
                    <button className="btn btn-primary print-btn" onClick={() => window.print()}>
                      PDF/인쇄
                    </button>
                  </div>

                  {/* 환자 정보 */}
                  <div className="report-section">
                    <h4>환자 정보</h4>
                    <div className="report-info-grid">
                      <div className="report-info-item">
                        <label>환자번호</label>
                        <span>{ocs.patient.patient_number}</span>
                      </div>
                      <div className="report-info-item">
                        <label>환자명</label>
                        <span>{ocs.patient.name}</span>
                      </div>
                      <div className="report-info-item">
                        <label>검사일</label>
                        <span>{formatDateOnly(ocs.in_progress_at || ocs.accepted_at)}</span>
                      </div>
                      <div className="report-info-item">
                        <label>보고일</label>
                        <span>{formatDateOnly(ocs.confirmed_at)}</span>
                      </div>
                    </div>
                  </div>

                  {/* 검사 정보 */}
                  <div className="report-section">
                    <h4>검사 정보</h4>
                    <div className="report-info-grid">
                      <div className="report-info-item">
                        <label>검사 유형</label>
                        <span>{ocs.job_type}</span>
                      </div>
                      <div className="report-info-item">
                        <label>처방 의사</label>
                        <span>{ocs.doctor.name}</span>
                      </div>
                      <div className="report-info-item">
                        <label>검사 담당자</label>
                        <span>{ocs.worker?.name || '-'}</span>
                      </div>
                      <div className="report-info-item">
                        <label>우선순위</label>
                        <span className={`priority-tag priority-${ocs.priority}`}>
                          {ocs.priority_display}
                        </span>
                      </div>
                    </div>

                    {/* 의사 요청 사항 */}
                    {ocs.doctor_request && Object.keys(ocs.doctor_request).length > 0 && (
                      <div className="request-info-box">
                        <h5>의사 요청 사항</h5>
                        {ocs.doctor_request.clinical_info && (
                          <div className="request-item">
                            <label>임상 정보:</label>
                            <p>{ocs.doctor_request.clinical_info}</p>
                          </div>
                        )}
                        {ocs.doctor_request.special_instruction && (
                          <div className="request-item">
                            <label>특별 지시:</label>
                            <p>{ocs.doctor_request.special_instruction}</p>
                          </div>
                        )}
                      </div>
                    )}
                  </div>

                  {/* 검사 결과 */}
                  <div className="report-section">
                    <h4>검사 결과</h4>

                    {/* LIS 결과 - 테이블 형식 */}
                    {ocs.job_role === 'LIS' && isLISWorkerResult(ocs.worker_result) && (ocs.worker_result as LISExtendedResult).labResults && (ocs.worker_result as LISExtendedResult).labResults!.length > 0 && (
                      <div className="lab-results-table">
                        <table className="report-result-table">
                          <thead>
                            <tr>
                              <th>검사 항목</th>
                              <th>결과</th>
                              <th>단위</th>
                              <th>참고치</th>
                              <th>판정</th>
                            </tr>
                          </thead>
                          <tbody>
                            {((ocs.worker_result as LISExtendedResult).labResults || []).map((item, index) => (
                              <tr
                                key={index}
                                className={
                                  item.flag === 'critical' ? 'row-critical' :
                                  item.flag === 'abnormal' ? 'row-abnormal' : ''
                                }
                              >
                                <td>{item.testName}</td>
                                <td className="result-value">{item.value}</td>
                                <td>{item.unit}</td>
                                <td>{item.refRange}</td>
                                <td>
                                  <span className={`flag-badge flag-${item.flag}`}>
                                    {item.flag === 'normal' ? '정상' :
                                     item.flag === 'abnormal' ? '비정상' :
                                     item.flag === 'critical' ? '위험' : item.flag}
                                  </span>
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}

                    {/* RIS 결과 - 텍스트 형식 */}
                    {ocs.job_role === 'RIS' && isRISWorkerResult(ocs.worker_result) && (
                      <div className="imaging-results">
                        {ocs.worker_result.findings && (
                          <div className="result-block">
                            <h5>소견 (Findings)</h5>
                            <p className="result-text">{ocs.worker_result.findings}</p>
                          </div>
                        )}
                        {ocs.worker_result.impression && (
                          <div className="result-block">
                            <h5>인상 (Impression)</h5>
                            <p className="result-text">{ocs.worker_result.impression}</p>
                          </div>
                        )}
                        {ocs.worker_result.recommendation && (
                          <div className="result-block">
                            <h5>권고 사항 (Recommendation)</h5>
                            <p className="result-text">{ocs.worker_result.recommendation}</p>
                          </div>
                        )}
                      </div>
                    )}

                    {/* 해석/종합 소견 */}
                    {isLISWorkerResult(ocs.worker_result) && ocs.worker_result.interpretation && (
                      <div className="result-block interpretation">
                        <h5>의학적 해석</h5>
                        <p className="result-text">{ocs.worker_result.interpretation}</p>
                      </div>
                    )}

                    {/* 비고 */}
                    {isLISWorkerResult(ocs.worker_result) && (ocs.worker_result as LISExtendedResult).notes && (
                      <div className="result-block notes-block">
                        <h5>비고</h5>
                        <p className="result-text">{(ocs.worker_result as LISExtendedResult).notes}</p>
                      </div>
                    )}

                    {/* 결과가 없는 경우 JSON 표시 */}
                    {ocs.worker_result && (() => {
                      const hasLabResults = isLISWorkerResult(ocs.worker_result) && (ocs.worker_result as LISExtendedResult).labResults?.length;
                      const hasFindings = isRISWorkerResult(ocs.worker_result) && ocs.worker_result.findings;
                      const hasImpression = isRISWorkerResult(ocs.worker_result) && ocs.worker_result.impression;
                      const hasInterpretation = isLISWorkerResult(ocs.worker_result) && ocs.worker_result.interpretation;
                      return !hasLabResults && !hasFindings && !hasImpression && !hasInterpretation;
                    })() && (
                      <div className="raw-result">
                        <h5>검사 결과 데이터</h5>
                        <pre className="json-viewer">
                          {JSON.stringify(ocs.worker_result, null, 2)}
                        </pre>
                      </div>
                    )}

                    {/* 결과가 없는 경우 */}
                    {(!ocs.worker_result || Object.keys(ocs.worker_result).length === 0) && (
                      <p className="no-data">아직 검사 결과가 없습니다.</p>
                    )}
                  </div>

                  {/* 첨부파일 섹션 */}
                  {ocs.attachments && ocs.attachments.files && ocs.attachments.files.length > 0 && (
                    <div className="report-section">
                      <h4>첨부파일</h4>
                      <table className="attachments-table">
                        <thead>
                          <tr>
                            <th>파일명</th>
                            <th>유형</th>
                            <th>크기</th>
                          </tr>
                        </thead>
                        <tbody>
                          {ocs.attachments.files.map((file, index) => (
                            <tr key={index}>
                              <td className="file-name">{file.name}</td>
                              <td>{file.type}</td>
                              <td>{formatFileSize(file.size)}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                      {ocs.attachments.total_size > 0 && (
                        <div className="attachments-summary">
                          <span>총 {ocs.attachments.files.length}개 파일</span>
                          <span>전체 크기: {formatFileSize(ocs.attachments.total_size)}</span>
                        </div>
                      )}
                    </div>
                  )}

                  {/* 확정 정보 */}
                  {ocs.ocs_status === 'CONFIRMED' && (
                    <div className="report-section confirmation-section">
                      <div className="confirmation-info">
                        <div className="confirmation-item">
                          <label>확정일시</label>
                          <span>{formatDate(ocs.confirmed_at)}</span>
                        </div>
                        <div className="confirmation-item">
                          <label>확정자</label>
                          <span>{(() => {
                            if (isRISWorkerResult(ocs.worker_result)) {
                              return (ocs.worker_result as RISExtendedResult)._verifiedBy || ocs.worker?.name || '-';
                            }
                            if (isLISWorkerResult(ocs.worker_result)) {
                              return (ocs.worker_result as LISExtendedResult)._verifiedBy || ocs.worker?.name || '-';
                            }
                            return ocs.worker?.name || '-';
                          })()}</span>
                        </div>
                        <div className="confirmation-item">
                          <label>결과 상태</label>
                          <span className={`result-status-badge ${ocs.ocs_result ? 'normal' : 'abnormal'}`}>
                            {ocs.ocs_result ? '정상' : '비정상'}
                          </span>
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 보고서 푸터 */}
                  <div className="report-footer">
                    <p>본 보고서는 의료 목적으로만 사용되어야 하며, 의료 전문가의 해석이 필요합니다.</p>
                    <p className="print-date">출력일시: {new Date().toLocaleString('ko-KR')}</p>
                  </div>
              </div>
            </div>

            {/* 액션 버튼 */}
            <div className="modal-footer">
              {canCancel && (
                <div className="cancel-section">
                  <input
                    type="text"
                    placeholder="취소 사유 (선택)"
                    value={cancelReason}
                    onChange={(e) => setCancelReason(e.target.value)}
                  />
                  <button
                    className="btn danger"
                    onClick={handleCancel}
                    disabled={actionLoading}
                  >
                    취소
                  </button>
                </div>
              )}

              <div className="action-buttons">
                {canAccept && (
                  <button
                    className="btn primary"
                    onClick={handleAccept}
                    disabled={actionLoading}
                  >
                    접수하기
                  </button>
                )}
                {canStart && (
                  <button
                    className="btn primary"
                    onClick={handleStart}
                    disabled={actionLoading}
                  >
                    작업 시작
                  </button>
                )}
                {canSubmit && (
                  <button
                    className="btn primary"
                    onClick={handleSubmit}
                    disabled={actionLoading}
                  >
                    결과 제출
                  </button>
                )}
                {canConfirm && (
                  <>
                    <button
                      className="btn success"
                      onClick={() => handleConfirm(true)}
                      disabled={actionLoading}
                    >
                      정상 확정
                    </button>
                    <button
                      className="btn warning"
                      onClick={() => handleConfirm(false)}
                      disabled={actionLoading}
                    >
                      비정상 확정
                    </button>
                  </>
                )}
                <button className="btn secondary" onClick={onClose}>
                  닫기
                </button>
              </div>
            </div>
          </>
        ) : (
          <div className="modal-body">OCS 정보를 불러올 수 없습니다.</div>
        )}
      </div>
    </div>
  );
}
