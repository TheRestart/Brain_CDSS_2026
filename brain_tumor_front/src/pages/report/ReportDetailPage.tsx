/**
 * 최종 보고서 상세 페이지
 * - 보고서 상세 정보 조회
 * - 상태 변경 (검토 제출, 승인, 최종 확정)
 * - 수정/삭제
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  getFinalReportDetail,
  updateFinalReport,
  deleteFinalReport,
  submitFinalReport,
  approveFinalReport,
  finalizeFinalReport,
  type FinalReportDetail,
  type FinalReportUpdateData,
  type ReportStatus,
  type FinalReportType,
} from '@/services/report.api';
import { LoadingSpinner } from '@/components/common';
import { useThumbnailCache } from '@/context/ThumbnailCacheContext';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api';
import { DocumentPreview } from '@/components/pdf-preview';
import './ReportDetailPage.css';

// 상태 라벨
const STATUS_LABELS: Record<ReportStatus, string> = {
  DRAFT: '작성 중',
  PENDING_REVIEW: '검토 대기',
  APPROVED: '승인됨',
  FINALIZED: '최종 확정',
  CANCELLED: '취소됨',
};

// 보고서 유형 옵션
const REPORT_TYPE_OPTIONS: { value: FinalReportType; label: string }[] = [
  { value: 'INITIAL', label: '초진 보고서' },
  { value: 'FOLLOWUP', label: '경과 보고서' },
  { value: 'DISCHARGE', label: '퇴원 보고서' },
  { value: 'FINAL', label: '최종 보고서' },
];

export default function ReportDetailPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id: string }>();
  const { markAsCached } = useThumbnailCache();

  // 데이터 상태
  const [report, setReport] = useState<FinalReportDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 편집 모드
  const [isEditing, setIsEditing] = useState(false);
  const [editData, setEditData] = useState<FinalReportUpdateData>({});
  const [secondaryInput, setSecondaryInput] = useState('');

  // 처리 상태
  const [processing, setProcessing] = useState(false);
  const [showLogs, setShowLogs] = useState(false);

  // PDF 미리보기 모달
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // 데이터 조회
  const fetchReport = useCallback(async () => {
    if (!id) return;

    setLoading(true);
    setError(null);
    try {
      const data = await getFinalReportDetail(parseInt(id, 10));
      setReport(data);
      // 보고서 방문 시 캐시에 등록 (목록 페이지에서 썸네일 표시용)
      markAsCached(`final_${id}`);
      setEditData({
        report_type: data.report_type,
        primary_diagnosis: data.primary_diagnosis,
        secondary_diagnoses: data.secondary_diagnoses,
        diagnosis_date: data.diagnosis_date,
        treatment_summary: data.treatment_summary,
        treatment_plan: data.treatment_plan,
        ai_analysis_summary: data.ai_analysis_summary,
        clinical_findings: data.clinical_findings,
        doctor_opinion: data.doctor_opinion,
        recommendations: data.recommendations,
        prognosis: data.prognosis,
      });
    } catch (err) {
      setError('보고서를 불러오는데 실패했습니다.');
      console.error('Failed to fetch report:', err);
    } finally {
      setLoading(false);
    }
  }, [id, markAsCached]);

  useEffect(() => {
    fetchReport();
  }, [fetchReport]);

  // 시간 포맷
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  const formatDateTime = (dateStr: string | null) => {
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

  // 입력 변경 핸들러
  const handleInputChange = useCallback((
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value } = e.target;
    setEditData(prev => ({ ...prev, [name]: value }));
  }, []);

  // 부 진단명 추가
  const handleAddSecondary = useCallback(() => {
    if (secondaryInput.trim()) {
      setEditData(prev => ({
        ...prev,
        secondary_diagnoses: [...(prev.secondary_diagnoses || []), secondaryInput.trim()],
      }));
      setSecondaryInput('');
    }
  }, [secondaryInput]);

  // 부 진단명 삭제
  const handleRemoveSecondary = useCallback((index: number) => {
    setEditData(prev => ({
      ...prev,
      secondary_diagnoses: prev.secondary_diagnoses?.filter((_, i) => i !== index),
    }));
  }, []);

  // 저장
  const handleSave = useCallback(async () => {
    if (!report) return;

    setProcessing(true);
    try {
      const updated = await updateFinalReport(report.id, editData);
      setReport(updated);
      setIsEditing(false);
    } catch (err: any) {
      alert(err.response?.data?.detail || '저장에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [report, editData]);

  // 삭제
  const handleDelete = useCallback(async () => {
    if (!report) return;
    if (!confirm('보고서를 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return;

    setProcessing(true);
    try {
      await deleteFinalReport(report.id);
      navigate('/reports/list');
    } catch (err: any) {
      alert(err.response?.data?.detail || '삭제에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [report, navigate]);

  // 검토 제출
  const handleSubmit = useCallback(async () => {
    if (!report) return;
    if (!confirm('보고서를 검토 제출하시겠습니까?')) return;

    setProcessing(true);
    try {
      const updated = await submitFinalReport(report.id);
      setReport(updated);
    } catch (err: any) {
      alert(err.response?.data?.detail || '제출에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [report]);

  // 승인
  const handleApprove = useCallback(async () => {
    if (!report) return;
    if (!confirm('보고서를 승인하시겠습니까?')) return;

    setProcessing(true);
    try {
      const updated = await approveFinalReport(report.id);
      setReport(updated);
    } catch (err: any) {
      alert(err.response?.data?.detail || '승인에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [report]);

  // 최종 확정
  const handleFinalize = useCallback(async () => {
    if (!report) return;
    if (!confirm('보고서를 최종 확정하시겠습니까? 확정 후에는 수정할 수 없습니다.')) return;

    setProcessing(true);
    try {
      const updated = await finalizeFinalReport(report.id);
      setReport(updated);
    } catch (err: any) {
      alert(err.response?.data?.detail || '확정에 실패했습니다.');
    } finally {
      setProcessing(false);
    }
  }, [report]);

  // 뒤로 가기
  const handleBack = useCallback(() => {
    navigate('/reports/list');
  }, [navigate]);

  // 편집 취소
  const handleCancelEdit = useCallback(() => {
    if (report) {
      setEditData({
        report_type: report.report_type,
        primary_diagnosis: report.primary_diagnosis,
        secondary_diagnoses: report.secondary_diagnoses,
        diagnosis_date: report.diagnosis_date,
        treatment_summary: report.treatment_summary,
        treatment_plan: report.treatment_plan,
        ai_analysis_summary: report.ai_analysis_summary,
        clinical_findings: report.clinical_findings,
        doctor_opinion: report.doctor_opinion,
        recommendations: report.recommendations,
        prognosis: report.prognosis,
      });
    }
    setIsEditing(false);
  }, [report]);

  // PDF 미리보기 열기
  const handleOpenPdfPreview = useCallback(() => {
    setPdfPreviewOpen(true);
  }, []);

  // PDF 출력 (워터마크 설정 적용)
  const handleExportPDF = useCallback(async (watermarkConfig: PdfWatermarkConfig) => {
    if (!report) return;

    try {
      const { generateFinalReportPDF } = await import('@/utils/exportUtils');
      await generateFinalReportPDF({
        reportId: report.report_id,
        patientName: report.patient_name,
        patientNumber: report.patient_number,
        reportType: report.report_type_display,
        status: report.status,
        diagnosisDate: report.diagnosis_date ? formatDate(report.diagnosis_date) : undefined,
        primaryDiagnosis: report.primary_diagnosis || undefined,
        secondaryDiagnoses: report.secondary_diagnoses,
        clinicalFindings: report.clinical_findings || undefined,
        treatmentSummary: report.treatment_summary || undefined,
        treatmentPlan: report.treatment_plan || undefined,
        aiAnalysisSummary: report.ai_analysis_summary || undefined,
        doctorOpinion: report.doctor_opinion || undefined,
        recommendations: report.recommendations || undefined,
        prognosis: report.prognosis || undefined,
        createdByName: report.created_by_name || undefined,
        createdAt: formatDateTime(report.created_at),
        reviewedByName: report.reviewed_by_name || undefined,
        reviewedAt: report.reviewed_at ? formatDateTime(report.reviewed_at) : undefined,
        approvedByName: report.approved_by_name || undefined,
        approvedAt: report.approved_at ? formatDateTime(report.approved_at) : undefined,
        finalizedAt: report.finalized_at ? formatDateTime(report.finalized_at) : undefined,
      }, watermarkConfig);
    } catch (err) {
      console.error('PDF 출력 실패:', err);
      alert('PDF 출력에 실패했습니다.');
    }
  }, [report]);

  if (loading) {
    return (
      <div className="page report-detail-page">
        <LoadingSpinner text="보고서를 불러오는 중..." />
      </div>
    );
  }

  if (error || !report) {
    return (
      <div className="page report-detail-page">
        <div className="error-state">
          <p>{error || '보고서를 찾을 수 없습니다.'}</p>
          <button className="btn btn-primary" onClick={handleBack}>
            목록으로 돌아가기
          </button>
        </div>
      </div>
    );
  }

  const canEdit = report.status === 'DRAFT';
  const canSubmit = report.status === 'DRAFT';
  const canApprove = report.status === 'PENDING_REVIEW';
  const canFinalize = report.status === 'APPROVED';
  const canDelete = report.status === 'DRAFT';

  return (
    <div className="page report-detail-page">
      {/* 헤더 */}
      <header className="page-header">
        <button className="btn btn-back" onClick={handleBack}>
          &larr; 목록
        </button>
        <div className="header-content">
          <h2>보고서 상세</h2>
          <span className="report-id">{report.report_id}</span>
        </div>
        <div className="header-actions">
          {isEditing ? (
            <>
              <button className="btn btn-secondary" onClick={handleCancelEdit} disabled={processing}>
                취소
              </button>
              <button className="btn btn-primary" onClick={handleSave} disabled={processing}>
                {processing ? '저장 중...' : '저장'}
              </button>
            </>
          ) : (
            <>
              <button className="btn btn-secondary" onClick={handleOpenPdfPreview}>
                PDF 출력
              </button>
              {canDelete && (
                <button className="btn btn-danger" onClick={handleDelete} disabled={processing}>
                  삭제
                </button>
              )}
              {canEdit && (
                <button className="btn btn-secondary" onClick={() => setIsEditing(true)}>
                  수정
                </button>
              )}
              {canSubmit && (
                <button className="btn btn-primary" onClick={handleSubmit} disabled={processing}>
                  검토 제출
                </button>
              )}
              {canApprove && (
                <button className="btn btn-primary" onClick={handleApprove} disabled={processing}>
                  승인
                </button>
              )}
              {canFinalize && (
                <button className="btn btn-success" onClick={handleFinalize} disabled={processing}>
                  최종 확정
                </button>
              )}
            </>
          )}
        </div>
      </header>

      {/* 상태 배너 */}
      <div className={`status-banner status-${report.status.toLowerCase()}`}>
        <span className="status-label">{STATUS_LABELS[report.status]}</span>
        {report.status === 'FINALIZED' && report.finalized_at && (
          <span className="finalized-info">확정일: {formatDateTime(report.finalized_at)}</span>
        )}
      </div>

      <div className="content-grid">
        {/* 기본 정보 */}
        <section className="info-card">
          <h3>기본 정보</h3>
          <div className="info-grid">
            <div className="info-item">
              <label>환자</label>
              <span>{report.patient_name} ({report.patient_number})</span>
            </div>
            <div className="info-item">
              <label>보고서 유형</label>
              {isEditing ? (
                <select name="report_type" value={editData.report_type} onChange={handleInputChange}>
                  {REPORT_TYPE_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : (
                <span>{report.report_type_display}</span>
              )}
            </div>
            <div className="info-item">
              <label>진단일</label>
              {isEditing ? (
                <input
                  type="date"
                  name="diagnosis_date"
                  value={editData.diagnosis_date}
                  onChange={handleInputChange}
                />
              ) : (
                <span>{formatDate(report.diagnosis_date)}</span>
              )}
            </div>
            <div className="info-item">
              <label>작성자</label>
              <span>
                {report.created_by_name}
                {report.author_department && ` (${report.author_department})`}
              </span>
            </div>
            <div className="info-item">
              <label>작성일</label>
              <span>{formatDateTime(report.created_at)}</span>
            </div>
            <div className="info-item">
              <label>수정일</label>
              <span>{formatDateTime(report.updated_at)}</span>
            </div>
          </div>
        </section>

        {/* 진단 정보 */}
        <section className="info-card">
          <h3>진단 정보</h3>

          <div className="field-group">
            <label>주 진단명</label>
            {isEditing ? (
              <input
                type="text"
                name="primary_diagnosis"
                value={editData.primary_diagnosis || ''}
                onChange={handleInputChange}
              />
            ) : (
              <p className="field-value">{report.primary_diagnosis || '-'}</p>
            )}
          </div>

          <div className="field-group">
            <label>부 진단명</label>
            {isEditing ? (
              <div className="secondary-diagnoses">
                <div className="add-secondary">
                  <input
                    type="text"
                    value={secondaryInput}
                    onChange={(e) => setSecondaryInput(e.target.value)}
                    placeholder="부 진단명 추가"
                    onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), handleAddSecondary())}
                  />
                  <button type="button" className="btn btn-add" onClick={handleAddSecondary}>
                    추가
                  </button>
                </div>
                {editData.secondary_diagnoses && editData.secondary_diagnoses.length > 0 && (
                  <ul className="secondary-list">
                    {editData.secondary_diagnoses.map((diag, index) => (
                      <li key={index}>
                        <span>{diag}</span>
                        <button type="button" className="btn-remove" onClick={() => handleRemoveSecondary(index)}>
                          &times;
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ) : (
              <div className="field-value">
                {report.secondary_diagnoses && report.secondary_diagnoses.length > 0 ? (
                  <ul className="diagnosis-list">
                    {report.secondary_diagnoses.map((diag, idx) => (
                      <li key={idx}>{diag}</li>
                    ))}
                  </ul>
                ) : '-'}
              </div>
            )}
          </div>

          <div className="field-group">
            <label>임상 소견</label>
            {isEditing ? (
              <textarea
                name="clinical_findings"
                value={editData.clinical_findings || ''}
                onChange={handleInputChange}
                rows={4}
              />
            ) : (
              <p className="field-value pre-wrap">{report.clinical_findings || '-'}</p>
            )}
          </div>
        </section>

        {/* 치료 정보 */}
        <section className="info-card">
          <h3>치료 정보</h3>

          <div className="field-group">
            <label>치료 요약</label>
            {isEditing ? (
              <textarea
                name="treatment_summary"
                value={editData.treatment_summary || ''}
                onChange={handleInputChange}
                rows={4}
              />
            ) : (
              <p className="field-value pre-wrap">{report.treatment_summary || '-'}</p>
            )}
          </div>

          <div className="field-group">
            <label>향후 치료 계획</label>
            {isEditing ? (
              <textarea
                name="treatment_plan"
                value={editData.treatment_plan || ''}
                onChange={handleInputChange}
                rows={4}
              />
            ) : (
              <p className="field-value pre-wrap">{report.treatment_plan || '-'}</p>
            )}
          </div>
        </section>

        {/* AI 분석 및 의사 소견 */}
        <section className="info-card">
          <h3>AI 분석 및 의사 소견</h3>

          <div className="field-group">
            <label>AI 분석 요약</label>
            {isEditing ? (
              <textarea
                name="ai_analysis_summary"
                value={editData.ai_analysis_summary || ''}
                onChange={handleInputChange}
                rows={4}
              />
            ) : (
              <p className="field-value pre-wrap">{report.ai_analysis_summary || '-'}</p>
            )}
          </div>

          <div className="field-group">
            <label>의사 소견</label>
            {isEditing ? (
              <textarea
                name="doctor_opinion"
                value={editData.doctor_opinion || ''}
                onChange={handleInputChange}
                rows={4}
              />
            ) : (
              <p className="field-value pre-wrap">{report.doctor_opinion || '-'}</p>
            )}
          </div>

          <div className="field-group">
            <label>권고 사항</label>
            {isEditing ? (
              <textarea
                name="recommendations"
                value={editData.recommendations || ''}
                onChange={handleInputChange}
                rows={4}
              />
            ) : (
              <p className="field-value pre-wrap">{report.recommendations || '-'}</p>
            )}
          </div>

          <div className="field-group">
            <label>예후</label>
            {isEditing ? (
              <textarea
                name="prognosis"
                value={editData.prognosis || ''}
                onChange={handleInputChange}
                rows={3}
              />
            ) : (
              <p className="field-value pre-wrap">{report.prognosis || '-'}</p>
            )}
          </div>
        </section>

        {/* 승인 정보 */}
        {(report.reviewed_by || report.approved_by) && (
          <section className="info-card">
            <h3>승인 정보</h3>
            <div className="info-grid">
              {report.reviewed_by && (
                <>
                  <div className="info-item">
                    <label>검토자</label>
                    <span>{report.reviewed_by_name}</span>
                  </div>
                  <div className="info-item">
                    <label>검토일</label>
                    <span>{formatDateTime(report.reviewed_at)}</span>
                  </div>
                </>
              )}
              {report.approved_by && (
                <>
                  <div className="info-item">
                    <label>승인자</label>
                    <span>{report.approved_by_name}</span>
                  </div>
                  <div className="info-item">
                    <label>승인일</label>
                    <span>{formatDateTime(report.approved_at)}</span>
                  </div>
                </>
              )}
            </div>
          </section>
        )}

        {/* 변경 로그 */}
        {report.logs && report.logs.length > 0 && (
          <section className="info-card logs-card">
            <div className="card-header">
              <h3>변경 이력</h3>
              <button
                className="btn btn-text"
                onClick={() => setShowLogs(!showLogs)}
              >
                {showLogs ? '접기' : '펼치기'}
              </button>
            </div>

            {showLogs && (
              <div className="logs-list">
                {report.logs.map((log) => (
                  <div key={log.id} className="log-item">
                    <span className="log-time">{formatDateTime(log.created_at)}</span>
                    <span className="log-action">{log.action_display}</span>
                    <span className="log-message">{log.message}</span>
                    {log.actor_name && (
                      <span className="log-actor">by {log.actor_name}</span>
                    )}
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </div>

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="최종 보고서 PDF 미리보기"
      >
        {report && (
          <DocumentPreview
            title="최종 보고서"
            subtitle={`${report.report_type_display} | ${report.report_id}`}
            infoGrid={[
              { label: '환자번호', value: report.patient_number },
              { label: '환자명', value: report.patient_name },
              { label: '보고서 유형', value: report.report_type_display },
              { label: '상태', value: STATUS_LABELS[report.status] },
              { label: '진단일', value: formatDate(report.diagnosis_date) },
              { label: '작성일', value: formatDateTime(report.created_at) },
            ]}
            sections={[
              // 진단 정보
              ...(report.primary_diagnosis ? [{
                type: 'text' as const,
                title: '주 진단명',
                content: report.primary_diagnosis,
              }] : []),
              ...(report.secondary_diagnoses && report.secondary_diagnoses.length > 0 ? [{
                type: 'text' as const,
                title: '부 진단명',
                content: report.secondary_diagnoses.join('\n'),
              }] : []),
              ...(report.clinical_findings ? [{
                type: 'text' as const,
                title: '임상 소견',
                content: report.clinical_findings,
              }] : []),
              // 치료 정보
              ...(report.treatment_summary ? [{
                type: 'text' as const,
                title: '치료 요약',
                content: report.treatment_summary,
              }] : []),
              ...(report.treatment_plan ? [{
                type: 'text' as const,
                title: '향후 치료 계획',
                content: report.treatment_plan,
              }] : []),
              // AI 분석 및 의사 소견
              ...(report.ai_analysis_summary ? [{
                type: 'text' as const,
                title: 'AI 분석 요약',
                content: report.ai_analysis_summary,
              }] : []),
              ...(report.doctor_opinion ? [{
                type: 'text' as const,
                title: '의사 소견',
                content: report.doctor_opinion,
              }] : []),
              ...(report.recommendations ? [{
                type: 'text' as const,
                title: '권고 사항',
                content: report.recommendations,
              }] : []),
              ...(report.prognosis ? [{
                type: 'text' as const,
                title: '예후',
                content: report.prognosis,
              }] : []),
              // 승인 정보
              ...((report.reviewed_by || report.approved_by) ? [{
                type: 'table' as const,
                title: '승인 정보',
                columns: ['구분', '담당자', '일시'],
                rows: [
                  ...(report.reviewed_by ? [{
                    '구분': '검토',
                    '담당자': report.reviewed_by_name || '-',
                    '일시': formatDateTime(report.reviewed_at),
                  }] : []),
                  ...(report.approved_by ? [{
                    '구분': '승인',
                    '담당자': report.approved_by_name || '-',
                    '일시': formatDateTime(report.approved_at),
                  }] : []),
                  ...(report.finalized_at ? [{
                    '구분': '최종 확정',
                    '담당자': '-',
                    '일시': formatDateTime(report.finalized_at),
                  }] : []),
                ],
              }] : []),
            ]}
            signature={{ label: '작성자', name: report.created_by_name || '-' }}
          />
        )}
      </PdfPreviewModal>
    </div>
  );
}
