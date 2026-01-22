/**
 * 처방전 상세 보기 모달
 * - 처방전 양식 표시
 * - 인쇄 기능 포함
 */
import { useState, useEffect, useRef } from 'react';
import { getPrescription } from '@/services/prescription.api';
import type { Prescription } from '@/types/prescription';
import { FREQUENCY_LABELS, ROUTE_LABELS, STATUS_LABELS } from '@/types/prescription';

interface PrescriptionDetailModalProps {
  prescriptionId: number;
  onClose: () => void;
}

export default function PrescriptionDetailModal({
  prescriptionId,
  onClose,
}: PrescriptionDetailModalProps) {
  const [prescription, setPrescription] = useState<Prescription | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const loadPrescription = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPrescription(prescriptionId);
        setPrescription(data);
      } catch (err) {
        console.error('처방전 조회 실패:', err);
        setError('처방전을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    loadPrescription();
  }, [prescriptionId]);

  // 인쇄 기능
  const handlePrint = () => {
    const printContent = printRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>처방전 - ${prescription?.prescription_id}</title>
        <style>
          * {
            margin: 0;
            padding: 0;
            box-sizing: border-box;
          }
          body {
            font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
            font-size: 12pt;
            line-height: 1.5;
            padding: 20mm;
          }
          .prescription-form {
            max-width: 210mm;
            margin: 0 auto;
            border: 2px solid #000;
            padding: 15mm;
          }
          .prescription-header {
            text-align: center;
            border-bottom: 2px solid #000;
            padding-bottom: 10px;
            margin-bottom: 15px;
          }
          .prescription-title {
            font-size: 24pt;
            font-weight: bold;
            letter-spacing: 10px;
          }
          .prescription-subtitle {
            font-size: 10pt;
            color: #666;
            margin-top: 5px;
          }
          .info-section {
            display: flex;
            border: 1px solid #000;
            margin-bottom: 15px;
          }
          .info-column {
            flex: 1;
            padding: 10px;
          }
          .info-column:first-child {
            border-right: 1px solid #000;
          }
          .info-row {
            display: flex;
            margin-bottom: 8px;
          }
          .info-label {
            width: 80px;
            font-weight: bold;
            flex-shrink: 0;
          }
          .info-value {
            flex: 1;
            border-bottom: 1px solid #ccc;
            padding-left: 5px;
          }
          .diagnosis-section {
            border: 1px solid #000;
            padding: 10px;
            margin-bottom: 15px;
          }
          .diagnosis-section h3 {
            font-size: 11pt;
            margin-bottom: 8px;
            border-bottom: 1px solid #ccc;
            padding-bottom: 5px;
          }
          .medication-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 15px;
          }
          .medication-table th,
          .medication-table td {
            border: 1px solid #000;
            padding: 8px;
            text-align: center;
            font-size: 10pt;
          }
          .medication-table th {
            background: #f0f0f0;
            font-weight: bold;
          }
          .medication-table td.med-name {
            text-align: left;
          }
          .notes-section {
            border: 1px solid #000;
            padding: 10px;
            margin-bottom: 15px;
            min-height: 50px;
          }
          .notes-section h3 {
            font-size: 11pt;
            margin-bottom: 8px;
          }
          .footer-section {
            display: flex;
            justify-content: space-between;
            margin-top: 20px;
            padding-top: 15px;
          }
          .issue-info {
            font-size: 10pt;
          }
          .stamp-area {
            width: 150px;
            text-align: center;
          }
          .stamp-area .doctor-name {
            font-size: 14pt;
            font-weight: bold;
            margin-bottom: 10px;
          }
          .stamp-area .stamp-placeholder {
            width: 60px;
            height: 60px;
            border: 1px dashed #999;
            margin: 0 auto;
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 10pt;
            color: #999;
          }
          .hospital-info {
            text-align: center;
            margin-top: 20px;
            padding-top: 15px;
            border-top: 1px solid #ccc;
            font-size: 10pt;
            color: #666;
          }
          @media print {
            body {
              padding: 0;
            }
            .prescription-form {
              border: none;
              padding: 0;
            }
          }
        </style>
      </head>
      <body>
        ${printContent.innerHTML}
      </body>
      </html>
    `);

    printWindow.document.close();
    printWindow.focus();
    setTimeout(() => {
      printWindow.print();
      printWindow.close();
    }, 250);
  };

  // 날짜 포맷
  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return `${date.getFullYear()}년 ${date.getMonth() + 1}월 ${date.getDate()}일`;
  };

  // 성별 표시
  const formatGender = (gender?: string) => {
    if (gender === 'M') return '남';
    if (gender === 'F') return '여';
    return '-';
  };

  // 나이 계산
  const calculateAge = (birthDate?: string) => {
    if (!birthDate) return '-';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age}세`;
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-container" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>처방전</h2>
          <div className="modal-actions">
            {prescription && prescription.status !== 'DRAFT' && (
              <button className="btn btn-primary" onClick={handlePrint}>
                인쇄
              </button>
            )}
            <button className="btn btn-secondary" onClick={onClose}>
              닫기
            </button>
          </div>
        </div>

        <div className="modal-body">
          {loading ? (
            <div className="loading-state">로딩 중...</div>
          ) : error ? (
            <div className="error-state">{error}</div>
          ) : prescription ? (
            <div className="prescription-preview" ref={printRef}>
              <div className="prescription-form">
                {/* 헤더 */}
                <div className="prescription-header">
                  <div className="prescription-title">처 방 전</div>
                  <div className="prescription-subtitle">PRESCRIPTION</div>
                  <div className="prescription-number">
                    처방전 번호: {prescription.prescription_id}
                  </div>
                </div>

                {/* 환자/의료기관 정보 */}
                <div className="info-section">
                  <div className="info-column patient-info">
                    <div className="column-title">환자 정보</div>
                    <div className="info-row">
                      <span className="info-label">성 명</span>
                      <span className="info-value">{prescription.patient_name || '-'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">환자번호</span>
                      <span className="info-value">{prescription.patient_number || '-'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">생년월일</span>
                      <span className="info-value">
                        {prescription.patient_birth_date || '-'}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">성별/나이</span>
                      <span className="info-value">
                        {formatGender(prescription.patient_gender)} / {calculateAge(prescription.patient_birth_date)}
                      </span>
                    </div>
                  </div>
                  <div className="info-column hospital-info-col">
                    <div className="column-title">의료기관 정보</div>
                    <div className="info-row">
                      <span className="info-label">의료기관</span>
                      <span className="info-value">Brain Tumor CDSS Hospital</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">담당의사</span>
                      <span className="info-value">{prescription.doctor_name || '-'}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">발행일자</span>
                      <span className="info-value">{formatDate(prescription.issued_at || prescription.created_at)}</span>
                    </div>
                    <div className="info-row">
                      <span className="info-label">상 태</span>
                      <span className={`info-value status-${prescription.status.toLowerCase()}`}>
                        {STATUS_LABELS[prescription.status] || prescription.status}
                      </span>
                    </div>
                  </div>
                </div>

                {/* 진단명 */}
                {prescription.diagnosis && (
                  <div className="diagnosis-section">
                    <h3>진단명 (Diagnosis)</h3>
                    <div className="diagnosis-content">{prescription.diagnosis}</div>
                  </div>
                )}

                {/* 처방 약품 */}
                <div className="medication-section">
                  <h3>처방 내역</h3>
                  <table className="medication-table">
                    <thead>
                      <tr>
                        <th style={{ width: '40px' }}>No.</th>
                        <th>약품명</th>
                        <th style={{ width: '80px' }}>용량</th>
                        <th style={{ width: '80px' }}>용법</th>
                        <th style={{ width: '70px' }}>투여경로</th>
                        <th style={{ width: '60px' }}>일수</th>
                        <th style={{ width: '60px' }}>총량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescription.items.map((item, index) => (
                        <tr key={item.id}>
                          <td>{index + 1}</td>
                          <td className="med-name">
                            {item.medication_name}
                            {item.instructions && (
                              <div className="med-instructions">{item.instructions}</div>
                            )}
                          </td>
                          <td>{item.dosage}</td>
                          <td>{FREQUENCY_LABELS[item.frequency] || item.frequency}</td>
                          <td>{ROUTE_LABELS[item.route] || item.route}</td>
                          <td>{item.duration_days}일</td>
                          <td>{item.quantity}개</td>
                        </tr>
                      ))}
                      {prescription.items.length === 0 && (
                        <tr>
                          <td colSpan={7} className="empty-row">처방 항목이 없습니다.</td>
                        </tr>
                      )}
                    </tbody>
                  </table>
                </div>

                {/* 비고 */}
                {prescription.notes && (
                  <div className="notes-section">
                    <h3>비고 (Notes)</h3>
                    <div className="notes-content">{prescription.notes}</div>
                  </div>
                )}

                {/* 푸터: 서명 영역 */}
                <div className="footer-section">
                  <div className="issue-info">
                    <div>발행일: {formatDate(prescription.issued_at || prescription.created_at)}</div>
                    {prescription.dispensed_at && (
                      <div>조제일: {formatDate(prescription.dispensed_at)}</div>
                    )}
                    {prescription.cancelled_at && (
                      <div className="cancelled-info">
                        취소일: {formatDate(prescription.cancelled_at)}
                        {prescription.cancel_reason && ` (사유: ${prescription.cancel_reason})`}
                      </div>
                    )}
                  </div>
                  <div className="stamp-area">
                    <div className="doctor-name">{prescription.doctor_name || '담당의사'}</div>
                    <div className="stamp-placeholder">(인)</div>
                  </div>
                </div>

                {/* 병원 정보 */}
                <div className="hospital-footer">
                  <div className="hospital-name">Brain Tumor CDSS Hospital</div>
                  <div className="hospital-address">서울특별시 강남구 의료로 123</div>
                  <div className="hospital-contact">Tel: 02-1234-5678 | Fax: 02-1234-5679</div>
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <style>{`
        .modal-backdrop {
          position: fixed;
          top: 0;
          left: 0;
          right: 0;
          bottom: 0;
          background: rgba(0, 0, 0, 0.6);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }
        .modal-container {
          background: #fff;
          border-radius: 12px;
          width: 100%;
          max-width: 800px;
          max-height: 90vh;
          display: flex;
          flex-direction: column;
          overflow: hidden;
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #f5f5f5);
        }
        .modal-header h2 {
          margin: 0;
          font-size: 14px;
        }
        .modal-actions {
          display: flex;
          gap: 8px;
        }
        .modal-body {
          flex: 1;
          overflow-y: auto;
          padding: 20px;
          background: #e0e0e0;
        }
        .loading-state,
        .error-state {
          display: flex;
          align-items: center;
          justify-content: center;
          min-height: 200px;
          color: var(--text-secondary, #666);
        }
        .error-state {
          color: var(--error, #c62828);
        }

        /* 처방전 미리보기 */
        .prescription-preview {
          background: #fff;
          padding: 20px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          font-size: 11px;
        }
        .prescription-form {
          font-family: 'Malgun Gothic', '맑은 고딕', sans-serif;
        }

        /* 헤더 */
        .prescription-header {
          text-align: center;
          border-bottom: 2px solid #333;
          padding-bottom: 12px;
          margin-bottom: 16px;
        }
        .prescription-title {
          font-size: 20px;
          font-weight: bold;
          letter-spacing: 10px;
          margin-bottom: 4px;
        }
        .prescription-subtitle {
          font-size: 10px;
          color: #666;
          letter-spacing: 2px;
        }
        .prescription-number {
          margin-top: 8px;
          font-size: 11px;
          color: #666;
        }

        /* 정보 섹션 */
        .info-section {
          display: flex;
          gap: 16px;
          margin-bottom: 16px;
        }
        .info-column {
          flex: 1;
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 12px;
        }
        .column-title {
          font-size: 11px;
          font-weight: 600;
          color: #333;
          margin-bottom: 10px;
          padding-bottom: 6px;
          border-bottom: 1px solid #eee;
        }
        .info-row {
          display: flex;
          margin-bottom: 6px;
          font-size: 11px;
        }
        .info-label {
          width: 60px;
          color: #666;
          flex-shrink: 0;
        }
        .info-value {
          flex: 1;
          font-weight: 500;
          color: #1a1a1a;
        }
        .info-value.status-draft {
          color: #ef6c00;
        }
        .info-value.status-issued {
          color: #1565c0;
        }
        .info-value.status-dispensed {
          color: #2e7d32;
        }
        .info-value.status-cancelled {
          color: #c62828;
        }

        /* 진단 섹션 */
        .diagnosis-section {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .diagnosis-section h3,
        .medication-section h3,
        .notes-section h3 {
          font-size: 11px;
          font-weight: 600;
          color: #333;
          margin: 0 0 8px 0;
        }
        .diagnosis-content {
          font-size: 11px;
          color: #1a1a1a;
        }

        /* 약품 테이블 */
        .medication-section {
          margin-bottom: 16px;
        }
        .medication-table {
          width: 100%;
          border-collapse: collapse;
          font-size: 10px;
        }
        .medication-table th,
        .medication-table td {
          border: 1px solid #ddd;
          padding: 6px 4px;
          text-align: center;
        }
        .medication-table th {
          background: #f5f5f5;
          font-weight: 600;
          color: #333;
        }
        .medication-table td.med-name {
          text-align: left;
        }
        .med-instructions {
          font-size: 9px;
          color: #666;
          margin-top: 2px;
        }
        .empty-row {
          color: #999;
          font-style: italic;
        }

        /* 비고 */
        .notes-section {
          border: 1px solid #ddd;
          border-radius: 6px;
          padding: 12px;
          margin-bottom: 16px;
        }
        .notes-content {
          font-size: 11px;
          color: #1a1a1a;
          white-space: pre-wrap;
        }

        /* 푸터 */
        .footer-section {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          padding-top: 16px;
          margin-top: 16px;
          border-top: 1px solid #ddd;
        }
        .issue-info {
          font-size: 10px;
          color: #666;
          line-height: 1.6;
        }
        .cancelled-info {
          color: #c62828;
        }
        .stamp-area {
          text-align: center;
        }
        .doctor-name {
          font-size: 12px;
          font-weight: 600;
          margin-bottom: 8px;
        }
        .stamp-placeholder {
          width: 50px;
          height: 50px;
          border: 2px dashed #ccc;
          border-radius: 50%;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          color: #999;
          font-size: 11px;
        }

        /* 병원 정보 */
        .hospital-footer {
          text-align: center;
          margin-top: 20px;
          padding-top: 12px;
          border-top: 1px solid #eee;
          font-size: 10px;
          color: #666;
        }
        .hospital-name {
          font-weight: 600;
          color: #333;
          margin-bottom: 2px;
        }

        /* 버튼 */
        .btn {
          padding: 6px 12px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }
        .btn-primary {
          background: var(--primary, #1976d2);
          color: white;
        }
        .btn-primary:hover {
          background: #1565c0;
        }
        .btn-secondary {
          background: #f5f5f5;
          color: #333;
          border: 1px solid #ddd;
        }
        .btn-secondary:hover {
          background: #e0e0e0;
        }
      `}</style>
    </div>
  );
}
