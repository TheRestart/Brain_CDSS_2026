/**
 * 환자 상세 - 요약 탭
 * - 환자 기본 정보
 * - 최근 진료 이력 (5건)
 * - OCS 이력 (최근 5건)
 * - AI 추론 이력 (최근 3건) - 의사/시스템관리자만
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatientEncounters, getEncounter } from '@/services/encounter.api';
import { getOCSByPatient } from '@/services/ocs.api';
import { getPatientAIRequests } from '@/services/ai.api';
import { getPrescriptionsByEncounter } from '@/services/prescription.api';
import type { Encounter } from '@/types/encounter';
import type { OCSListItem } from '@/types/ocs';
import type { AIInferenceRequest } from '@/services/ai.api';
import type { PrescriptionListItem } from '@/types/prescription';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api';
import '@/assets/style/patientListView.css';

type Props = {
  role: string;
  patientId?: number;
  patientName?: string;
  patientNumber?: string;
};

// 상태 뱃지 스타일
const STATUS_COLORS: Record<string, string> = {
  // Encounter status
  scheduled: '#2196f3',
  in_progress: '#ff9800',
  completed: '#4caf50',
  cancelled: '#9e9e9e',
  // OCS status
  ORDERED: '#2196f3',
  ACCEPTED: '#03a9f4',
  IN_PROGRESS: '#ff9800',
  RESULT_READY: '#8bc34a',
  CONFIRMED: '#4caf50',
  CANCELLED: '#9e9e9e',
  // AI status
  PENDING: '#9e9e9e',
  VALIDATING: '#2196f3',
  PROCESSING: '#ff9800',
  COMPLETED: '#4caf50',
  FAILED: '#f44336',
};

// 날짜 포맷
const formatDate = (dateStr?: string | null): string => {
  if (!dateStr) return '-';
  return dateStr.split('T')[0];
};

export default function SummaryTab({ role, patientId, patientName, patientNumber }: Props) {
  const navigate = useNavigate();
  const isDoctor = role === 'DOCTOR';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canViewAI = isDoctor || isSystemManager;

  // 상태
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [ocsList, setOcsList] = useState<OCSListItem[]>([]);
  const [aiRequests, setAIRequests] = useState<AIInferenceRequest[]>([]);
  const [loading, setLoading] = useState(true);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // 진료 이력 모달 상태
  const [encounterModalOpen, setEncounterModalOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);
  const [encounterPrescriptions, setEncounterPrescriptions] = useState<PrescriptionListItem[]>([]);
  const [encounterLoading, setEncounterLoading] = useState(false);

  // 가장 최근 완료된 AI 분석 결과
  const latestCompletedAI = aiRequests.find(req => req.status === 'COMPLETED');

  // 진료 이력 클릭 핸들러 - 모달로 SOAP와 처방전 표시
  const handleEncounterClick = useCallback(async (encounterId: number) => {
    setEncounterLoading(true);
    setEncounterModalOpen(true);
    try {
      // 진료 상세 정보와 처방전 목록을 병렬로 조회
      const [encounterDetail, prescriptions] = await Promise.all([
        getEncounter(encounterId),
        getPrescriptionsByEncounter(encounterId).catch(() => []),
      ]);
      setSelectedEncounter(encounterDetail);
      setEncounterPrescriptions(prescriptions);
    } catch (err) {
      console.error('Failed to fetch encounter details:', err);
      alert('진료 정보를 불러오는데 실패했습니다.');
      setEncounterModalOpen(false);
    } finally {
      setEncounterLoading(false);
    }
  }, []);

  // 진료 이력 모달 닫기
  const handleCloseEncounterModal = useCallback(() => {
    setEncounterModalOpen(false);
    setSelectedEncounter(null);
    setEncounterPrescriptions([]);
  }, []);

  // PDF 출력 핸들러
  const handleExportPDF = useCallback(async (watermarkConfig: PdfWatermarkConfig) => {
    if (!latestCompletedAI) return;

    try {
      const modelCode = latestCompletedAI.model_code;
      const baseData = {
        jobId: latestCompletedAI.request_id,
        patientName: patientName || latestCompletedAI.patient_name || '-',
        patientNumber: patientNumber || latestCompletedAI.patient_number || '-',
        createdAt: formatDate(latestCompletedAI.requested_at),
        completedAt: latestCompletedAI.completed_at ? formatDate(latestCompletedAI.completed_at) : undefined,
      };

      if (modelCode === 'M1') {
        const { generateM1ReportPDF } = await import('@/utils/exportUtils');
        const resultData = latestCompletedAI.result?.result_data as Record<string, unknown> | undefined;
        await generateM1ReportPDF({
          ...baseData,
          grade: resultData?.grade as { predicted_class: string; probability: number } | undefined,
          idh: resultData?.idh as { predicted_class: string; mutant_probability?: number } | undefined,
          mgmt: resultData?.mgmt as { predicted_class: string; methylated_probability?: number } | undefined,
          survival: resultData?.survival as { risk_score: number; risk_category: string } | undefined,
          os_days: resultData?.os_days as { predicted_days: number; predicted_months: number } | undefined,
        }, watermarkConfig);
      } else if (modelCode === 'MG') {
        const { generateMGReportPDF } = await import('@/utils/exportUtils');
        const resultData = latestCompletedAI.result?.result_data as Record<string, unknown> | undefined;
        await generateMGReportPDF({
          ...baseData,
          risk_group: resultData?.risk_group as string | undefined,
          survival_months: resultData?.survival_months as number | undefined,
          confidence: resultData?.confidence as number | undefined,
          top_genes: resultData?.top_genes as Array<{ gene: string; importance: number }> | undefined,
        }, watermarkConfig);
      } else if (modelCode === 'MM') {
        const { generateMMReportPDF } = await import('@/utils/exportUtils');
        const resultData = latestCompletedAI.result?.result_data as Record<string, unknown> | undefined;
        await generateMMReportPDF({
          ...baseData,
          modalities: {
            mri: !!resultData?.mri_used,
            gene: !!resultData?.gene_used,
            protein: !!resultData?.protein_used,
          },
          integrated_prediction: resultData?.integrated_prediction as {
            grade: { predicted_class: string; probability: number };
            survival_risk?: { risk_score: number; risk_category?: string };
            survival_time?: { predicted_days: number; predicted_months: number };
          } | undefined,
          modality_contributions: resultData?.modality_contributions as {
            mri?: { weight: number; confidence: number };
            gene?: { weight: number; confidence: number };
            protein?: { weight: number; confidence: number };
          } | undefined,
          processing_time_ms: resultData?.processing_time_ms as number | undefined,
        }, watermarkConfig);
      } else {
        // 기본 M1 형식으로 출력
        const { generateM1ReportPDF } = await import('@/utils/exportUtils');
        await generateM1ReportPDF(baseData, watermarkConfig);
      }
    } catch (err) {
      console.error('PDF 출력 실패:', err);
      alert('PDF 출력에 실패했습니다.');
    }
  }, [latestCompletedAI, patientName, patientNumber]);

  // 데이터 로드
  useEffect(() => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // 병렬로 데이터 로드
        const [encounterRes, ocsRes, aiRes] = await Promise.all([
          getPatientEncounters(patientId).catch(() => []),
          getOCSByPatient(patientId).catch(() => []),
          canViewAI ? getPatientAIRequests(patientId).catch(() => []) : Promise.resolve([]),
        ]);

        // API 응답이 배열 또는 {results: []} 형식일 수 있음
        const encounterData = Array.isArray(encounterRes) ? encounterRes : (encounterRes as any)?.results || [];
        const ocsData = Array.isArray(ocsRes) ? ocsRes : (ocsRes as any)?.results || [];
        const aiData = Array.isArray(aiRes) ? aiRes : (aiRes as any)?.results || [];

        setEncounters(encounterData.slice(0, 5));
        setOcsList(ocsData.slice(0, 5));
        setAIRequests(aiData.slice(0, 3));
      } catch (err) {
        console.error('Failed to fetch summary data:', err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [patientId, canViewAI]);

  // 로딩 상태
  if (loading) {
    return (
      <div className="summary-layout">
        <div className="loading-state">데이터 로딩 중...</div>
      </div>
    );
  }

  // 환자 ID 없음
  if (!patientId) {
    return (
      <div className="summary-layout">
        <div className="empty-state">환자 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="summary-layout">
      {/* 좌측 영역: 최근 진료 이력 */}
      <div className="summary-left">
        <div className="card">
          <h3>최근 진료 이력 ({encounters.length}건)</h3>
          {encounters.length === 0 ? (
            <div className="empty-message">진료 이력이 없습니다.</div>
          ) : (
            <table className="summary-table">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>유형</th>
                  <th>담당의</th>
                  <th>상태</th>
                  <th>주호소</th>
                </tr>
              </thead>
              <tbody>
                {encounters.map((enc) => (
                  <tr
                    key={enc.id}
                    className="clickable-row"
                    onClick={() => handleEncounterClick(enc.id)}
                  >
                    <td>{formatDate(enc.encounter_date || enc.admission_date)}</td>
                    <td>{enc.encounter_type_display || enc.encounter_type}</td>
                    <td>{enc.attending_doctor_name || '-'}</td>
                    <td>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: STATUS_COLORS[enc.status] || '#9e9e9e' }}
                      >
                        {enc.status_display || enc.status}
                      </span>
                    </td>
                    <td className="truncate">{enc.chief_complaint || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 우측 영역: OCS 이력 + AI 추론 */}
      <div className="summary-right">
        {/* OCS 이력 */}
        <div className="card">
          <h4>OCS 이력 ({ocsList.length}건)</h4>
          {ocsList.length === 0 ? (
            <div className="empty-message">OCS 이력이 없습니다.</div>
          ) : (
            <table className="summary-table compact">
              <thead>
                <tr>
                  <th>날짜</th>
                  <th>유형</th>
                  <th>상태</th>
                </tr>
              </thead>
              <tbody>
                {ocsList.map((ocs) => (
                  <tr
                    key={ocs.id}
                    className="clickable-row"
                    onClick={() => {
                      const path = ocs.job_role === 'RIS'
                        ? `/ocs/ris/${ocs.id}`
                        : `/ocs/lis/${ocs.id}`;
                      navigate(path);
                    }}
                  >
                    <td>{formatDate(ocs.created_at)}</td>
                    <td>{ocs.job_type || ocs.job_role}</td>
                    <td>
                      <span
                        className="status-badge small"
                        style={{ backgroundColor: STATUS_COLORS[ocs.ocs_status] || '#9e9e9e' }}
                      >
                        {ocs.ocs_status_display || ocs.ocs_status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        {/* AI 추론 이력 (의사/시스템관리자만) */}
        {canViewAI && (
          <div className="card ai">
            <div className="card-header-with-action">
              <h4>AI 추론 이력 ({aiRequests.length}건)</h4>
              {latestCompletedAI && (
                <button
                  className="btn-pdf-small"
                  onClick={() => setPdfPreviewOpen(true)}
                  title="최근 AI 분석 결과 PDF 출력"
                >
                  PDF 출력
                </button>
              )}
            </div>
            {aiRequests.length === 0 ? (
              <div className="empty-message">AI 추론 이력이 없습니다.</div>
            ) : (
              <table className="summary-table compact">
                <thead>
                  <tr>
                    <th>날짜</th>
                    <th>모델</th>
                    <th>상태</th>
                  </tr>
                </thead>
                <tbody>
                  {aiRequests.map((req) => (
                    <tr
                      key={req.request_id}
                      className="clickable-row"
                      onClick={() => navigate(`/ai/requests/${req.request_id}`)}
                    >
                      <td>{formatDate(req.requested_at)}</td>
                      <td>{req.model_name || req.model_code}</td>
                      <td>
                        <span
                          className="status-badge small"
                          style={{ backgroundColor: STATUS_COLORS[req.status] || '#9e9e9e' }}
                        >
                          {req.status_display || req.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        )}
      </div>

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="AI 분석 결과 PDF 미리보기"
      />

      {/* 진료 이력 모달 - SOAP & 처방전 */}
      {encounterModalOpen && (
        <div className="modal-overlay" onClick={handleCloseEncounterModal}>
          <div className="encounter-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>과거 진료 기록</h2>
              <button className="modal-close-btn" onClick={handleCloseEncounterModal}>×</button>
            </div>
            <div className="modal-body">
              {encounterLoading ? (
                <div className="loading-state">로딩 중...</div>
              ) : selectedEncounter ? (
                <>
                  {/* 진료 기본 정보 */}
                  <div className="encounter-info">
                    <div className="info-row">
                      <span className="label">진료일:</span>
                      <span>{formatDate(selectedEncounter.encounter_date || selectedEncounter.admission_date)}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">진료유형:</span>
                      <span>{selectedEncounter.encounter_type_display || selectedEncounter.encounter_type}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">담당의:</span>
                      <span>{selectedEncounter.attending_doctor_name || '-'}</span>
                    </div>
                    <div className="info-row">
                      <span className="label">상태:</span>
                      <span
                        className="status-badge"
                        style={{ backgroundColor: STATUS_COLORS[selectedEncounter.status] || '#9e9e9e' }}
                      >
                        {selectedEncounter.status_display || selectedEncounter.status}
                      </span>
                    </div>
                  </div>

                  {/* SOAP 노트 */}
                  <div className="soap-section">
                    <h3>SOAP 노트</h3>
                    <div className="soap-grid">
                      <div className="soap-item">
                        <div className="soap-label">S (Subjective) - 주관적 증상</div>
                        <div className="soap-content">{selectedEncounter.subjective || '기록 없음'}</div>
                      </div>
                      <div className="soap-item">
                        <div className="soap-label">O (Objective) - 객관적 소견</div>
                        <div className="soap-content">{selectedEncounter.objective || '기록 없음'}</div>
                      </div>
                      <div className="soap-item">
                        <div className="soap-label">A (Assessment) - 평가/진단</div>
                        <div className="soap-content">{selectedEncounter.assessment || '기록 없음'}</div>
                      </div>
                      <div className="soap-item">
                        <div className="soap-label">P (Plan) - 치료 계획</div>
                        <div className="soap-content">{selectedEncounter.plan || '기록 없음'}</div>
                      </div>
                    </div>
                  </div>

                  {/* 처방전 */}
                  <div className="prescription-section">
                    <h3>처방전 ({encounterPrescriptions.length}건)</h3>
                    {encounterPrescriptions.length === 0 ? (
                      <div className="empty-message">처방 내역이 없습니다.</div>
                    ) : (
                      <table className="prescription-table">
                        <thead>
                          <tr>
                            <th>처방번호</th>
                            <th>처방일</th>
                            <th>상태</th>
                            <th>항목수</th>
                            <th>메모</th>
                          </tr>
                        </thead>
                        <tbody>
                          {encounterPrescriptions.map((rx) => (
                            <tr key={rx.id}>
                              <td>{rx.prescription_number || rx.prescription_id}</td>
                              <td>{formatDate(rx.created_at)}</td>
                              <td>
                                <span className={`rx-status ${rx.status?.toLowerCase()}`}>
                                  {rx.status_display || rx.status}
                                </span>
                              </td>
                              <td>{rx.item_count}개</td>
                              <td>{rx.notes || '-'}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    )}
                  </div>
                </>
              ) : (
                <div className="error-state">진료 정보를 불러올 수 없습니다.</div>
              )}
            </div>
          </div>
        </div>
      )}

      <style>{`
        .summary-layout {
          display: grid;
          grid-template-columns: 1.5fr 1fr;
          gap: 20px;
          padding: 16px;
        }
        .summary-left,
        .summary-right {
          display: flex;
          flex-direction: column;
          gap: 16px;
        }
        .card {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          padding: 16px;
        }
        .card h3 {
          margin: 0 0 12px 0;
          font-size: 16px;
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
        }
        .card h4 {
          margin: 0 0 12px 0;
          font-size: 14px;
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
        }
        .card.ai {
          border-left: 3px solid #9c27b0;
        }
        .summary-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .summary-table.compact {
          font-size: 12px;
        }
        .summary-table th {
          text-align: left;
          padding: 8px 6px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          font-weight: 500;
          color: var(--text-secondary, #666);
          white-space: nowrap;
        }
        .summary-table td {
          padding: 8px 6px;
          border-bottom: 1px solid var(--border-color, #f0f0f0);
          color: var(--text-primary, #1a1a1a);
        }
        .clickable-row {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .clickable-row:hover {
          background: var(--bg-secondary, #f5f5f5);
        }
        .status-badge {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          color: #fff;
        }
        .status-badge.small {
          padding: 1px 6px;
          font-size: 10px;
        }
        .truncate {
          max-width: 150px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .empty-message {
          padding: 16px;
          text-align: center;
          color: var(--text-secondary, #666);
          font-size: 13px;
        }
        .loading-state,
        .empty-state {
          padding: 40px;
          text-align: center;
          color: var(--text-secondary, #666);
        }
        .card-header-with-action {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .card-header-with-action h4 {
          margin: 0;
        }
        .btn-pdf-small {
          padding: 4px 10px;
          font-size: 11px;
          background: #9c27b0;
          color: #fff;
          border: none;
          border-radius: 4px;
          cursor: pointer;
          transition: background 0.2s;
        }
        .btn-pdf-small:hover {
          background: #7b1fa2;
        }
        /* 진료 이력 모달 스타일 */
        .modal-overlay {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
        }
        .encounter-modal {
          background: #fff;
          border-radius: 12px;
          width: 90%;
          max-width: 700px;
          max-height: 85vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.15);
        }
        .encounter-modal .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid #e0e0e0;
          background: #f8f9fa;
        }
        .encounter-modal .modal-header h2 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: #1a1a1a;
        }
        .modal-close-btn {
          background: none;
          border: none;
          font-size: 24px;
          color: #666;
          cursor: pointer;
          padding: 0;
          line-height: 1;
        }
        .modal-close-btn:hover {
          color: #333;
        }
        .encounter-modal .modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        .encounter-info {
          display: grid;
          grid-template-columns: repeat(2, 1fr);
          gap: 12px;
          margin-bottom: 20px;
          padding: 16px;
          background: #f8f9fa;
          border-radius: 8px;
        }
        .info-row {
          display: flex;
          gap: 8px;
        }
        .info-row .label {
          color: #666;
          font-weight: 500;
        }
        .soap-section {
          margin-bottom: 24px;
        }
        .soap-section h3,
        .prescription-section h3 {
          margin: 0 0 12px 0;
          font-size: 15px;
          font-weight: 600;
          color: #1a1a1a;
          padding-bottom: 8px;
          border-bottom: 2px solid #2196f3;
        }
        .soap-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }
        .soap-item {
          background: #f8f9fa;
          border-radius: 8px;
          padding: 12px;
          border-left: 3px solid #2196f3;
        }
        .soap-label {
          font-size: 12px;
          font-weight: 600;
          color: #2196f3;
          margin-bottom: 8px;
        }
        .soap-content {
          font-size: 13px;
          color: #333;
          line-height: 1.5;
          white-space: pre-wrap;
        }
        .prescription-section {
          margin-bottom: 16px;
        }
        .prescription-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 13px;
        }
        .prescription-table th {
          text-align: left;
          padding: 10px 8px;
          background: #f5f5f5;
          border-bottom: 1px solid #ddd;
          font-weight: 500;
          color: #666;
        }
        .prescription-table td {
          padding: 10px 8px;
          border-bottom: 1px solid #eee;
        }
        .rx-status {
          display: inline-block;
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
        }
        .rx-status.draft {
          background: #fff3e0;
          color: #e65100;
        }
        .rx-status.issued {
          background: #e3f2fd;
          color: #1565c0;
        }
        .rx-status.dispensed {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .rx-status.cancelled {
          background: #ffebee;
          color: #c62828;
        }
        .error-state {
          padding: 40px;
          text-align: center;
          color: #f44336;
        }
      `}</style>
    </div>
  );
}
