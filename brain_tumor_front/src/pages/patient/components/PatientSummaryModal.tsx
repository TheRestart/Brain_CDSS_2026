/**
 * 환자 요약 모달
 * - 환자 기본 정보, 진료 이력, 검사 이력, AI 분석 이력 표시
 * - PDF/인쇄 기능 지원
 */
import { useState, useEffect, useRef, useCallback } from 'react';
import { getPatientSummary, type PatientSummary } from '@/services/patient.api';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import { DocumentPreview } from '@/components/pdf-preview';
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api';
import './PatientSummaryModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  patientId: number;
};

export default function PatientSummaryModal({ isOpen, onClose, patientId }: Props) {
  const [summary, setSummary] = useState<PatientSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen && patientId) {
      fetchSummary();
    }
  }, [isOpen, patientId]);

  const fetchSummary = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPatientSummary(patientId);
      setSummary(data);
    } catch (err) {
      console.error('Failed to fetch summary:', err);
      setError('환자 요약 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  // PDF 출력 핸들러
  const handleExportPDF = useCallback(async (watermarkConfig: PdfWatermarkConfig) => {
    if (!summary) return;

    try {
      const { generatePatientSummaryPDF } = await import('@/utils/exportUtils');
      await generatePatientSummaryPDF({
        patientName: summary.patient.name,
        patientNumber: summary.patient.patient_number,
        age: summary.patient.age,
        gender: summary.patient.gender,
        birthDate: summary.patient.birth_date,
        phone: summary.patient.phone,
        bloodType: summary.patient.blood_type ?? undefined,
        address: summary.patient.address,
        encounters: summary.encounters,
        ocsHistory: summary.ocs_history,
        aiInferences: summary.ai_inferences,
        prescriptions: summary.prescriptions,
        generatedAt: summary.generated_at,
      }, watermarkConfig);
    } catch (err) {
      console.error('PDF 출력 실패:', err);
      alert('PDF 출력에 실패했습니다.');
    }
  }, [summary]);

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content summary-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>환자 요약서</h2>
          <div className="modal-actions">
            <button
              className="btn btn-primary"
              onClick={() => setPdfPreviewOpen(true)}
              disabled={!summary}
            >
              PDF/인쇄
            </button>
            <button className="btn" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        <div className="modal-body" ref={printRef}>
          {loading ? (
            <div className="loading-state">로딩 중...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : summary ? (
            <div className="summary-content print-area">
              {/* 기본 정보 */}
              <section className="summary-section">
                <h3>기본 정보</h3>
                <table className="info-table">
                  <tbody>
                    <tr>
                      <th>환자번호</th>
                      <td>{summary.patient.patient_number}</td>
                      <th>이름</th>
                      <td>{summary.patient.name}</td>
                    </tr>
                    <tr>
                      <th>나이/성별</th>
                      <td>{summary.patient.age}세 / {summary.patient.gender === 'M' ? '남' : '여'}</td>
                      <th>생년월일</th>
                      <td>{summary.patient.birth_date}</td>
                    </tr>
                    <tr>
                      <th>연락처</th>
                      <td>{summary.patient.phone || '-'}</td>
                      <th>혈액형</th>
                      <td>{summary.patient.blood_type || '-'}</td>
                    </tr>
                    <tr>
                      <th>주소</th>
                      <td colSpan={3}>{summary.patient.address || '-'}</td>
                    </tr>
                  </tbody>
                </table>
              </section>

              {/* 진료 이력 */}
              <section className="summary-section">
                <h3>진료 이력 ({summary.encounters.length}건)</h3>
                {summary.encounters.length > 0 ? (
                  <table className="data-table">
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
                      {summary.encounters.map((enc) => (
                        <tr key={enc.id}>
                          <td>{enc.admission_date?.split('T')[0] || '-'}</td>
                          <td>{enc.encounter_type_display || enc.encounter_type}</td>
                          <td>{enc.attending_doctor_name || '-'}</td>
                          <td>{enc.status_display || enc.status}</td>
                          <td>{enc.chief_complaint || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-message">진료 이력이 없습니다.</div>
                )}
              </section>

              {/* 검사 이력 */}
              <section className="summary-section">
                <h3>검사 이력 ({summary.ocs_history.length}건)</h3>
                {summary.ocs_history.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>유형</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.ocs_history.map((ocs) => (
                        <tr key={ocs.id}>
                          <td>{ocs.created_at?.split('T')[0] || '-'}</td>
                          <td>{ocs.job_type || ocs.job_role}</td>
                          <td>{ocs.ocs_status_display || ocs.ocs_status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-message">검사 이력이 없습니다.</div>
                )}
              </section>

              {/* AI 분석 이력 */}
              <section className="summary-section">
                <h3>AI 분석 이력 ({summary.ai_inferences.length}건)</h3>
                {summary.ai_inferences.length > 0 ? (
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>모델</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.ai_inferences.map((ai) => (
                        <tr key={ai.id}>
                          <td>{ai.requested_at?.split('T')[0] || '-'}</td>
                          <td>{ai.model_name || ai.model_code}</td>
                          <td>{ai.status_display || ai.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <div className="empty-message">AI 분석 이력이 없습니다.</div>
                )}
              </section>

              {/* 처방 이력 */}
              {summary.prescriptions.length > 0 && (
                <section className="summary-section">
                  <h3>처방 이력 ({summary.prescriptions.length}건)</h3>
                  <table className="data-table">
                    <thead>
                      <tr>
                        <th>날짜</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {summary.prescriptions.map((rx) => (
                        <tr key={rx.id}>
                          <td>{rx.prescribed_at?.split('T')[0] || '-'}</td>
                          <td>{rx.status}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </section>
              )}

              {/* 생성 시간 */}
              <div className="summary-footer">
                생성일시: {summary.generated_at?.replace('T', ' ').split('.')[0]}
              </div>
            </div>
          ) : (
            <div className="error-state">요약 정보를 불러올 수 없습니다.</div>
          )}
        </div>

        {/* PDF 미리보기 모달 */}
        <PdfPreviewModal
          isOpen={pdfPreviewOpen}
          onClose={() => setPdfPreviewOpen(false)}
          onConfirm={handleExportPDF}
          title="환자 요약서 PDF 미리보기"
        >
          {summary && (
            <DocumentPreview
              title="환자 요약서"
              subtitle={`${summary.patient.name} (${summary.patient.patient_number})`}
              infoGrid={[
                { label: '환자명', value: summary.patient.name },
                { label: '환자번호', value: summary.patient.patient_number },
                { label: '나이/성별', value: `${summary.patient.age}세 / ${summary.patient.gender === 'M' ? '남' : '여'}` },
                { label: '생년월일', value: summary.patient.birth_date || '-' },
                { label: '연락처', value: summary.patient.phone || '-' },
                { label: '혈액형', value: summary.patient.blood_type || '-' },
              ]}
              sections={[
                {
                  type: 'text' as const,
                  title: `진료 이력 (${summary.encounters.length}건)`,
                  content: summary.encounters.length > 0
                    ? summary.encounters.map(enc =>
                        `${enc.admission_date?.split('T')[0] || '-'} | ${enc.encounter_type_display || enc.encounter_type} | ${enc.attending_doctor_name || '-'}`
                      ).join('\n')
                    : '진료 이력이 없습니다.',
                },
                {
                  type: 'text' as const,
                  title: `검사 이력 (${summary.ocs_history.length}건)`,
                  content: summary.ocs_history.length > 0
                    ? summary.ocs_history.map(ocs =>
                        `${ocs.created_at?.split('T')[0] || '-'} | ${ocs.job_type || ocs.job_role} | ${ocs.ocs_status_display || ocs.ocs_status}`
                      ).join('\n')
                    : '검사 이력이 없습니다.',
                },
                {
                  type: 'text' as const,
                  title: `AI 분석 이력 (${summary.ai_inferences.length}건)`,
                  content: summary.ai_inferences.length > 0
                    ? summary.ai_inferences.map(ai =>
                        `${ai.requested_at?.split('T')[0] || '-'} | ${ai.model_name || ai.model_code} | ${ai.status_display || ai.status}`
                      ).join('\n')
                    : 'AI 분석 이력이 없습니다.',
                },
              ]}
            />
          )}
        </PdfPreviewModal>
      </div>
    </div>
  );
}
