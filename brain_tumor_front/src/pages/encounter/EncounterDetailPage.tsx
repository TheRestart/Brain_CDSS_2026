/**
 * 진료 상세 페이지
 * - 주호소 (간호사가 예약 시 기입)
 * - 진료 보고서 (SOAP 노트)
 * - 처방전
 */
import { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getEncounter } from '@/services/encounter.api';
import { getPrescriptionsByEncounter } from '@/services/prescription.api';
import { LoadingSpinner } from '@/components/common';
import type { Encounter } from '@/types/encounter';
import type { PrescriptionListItem, PrescriptionItem } from '@/types/prescription';
import { FREQUENCY_LABELS, ROUTE_LABELS, STATUS_LABELS } from '@/types/prescription';
import './EncounterDetailPage.css';

export default function EncounterDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const [encounter, setEncounter] = useState<Encounter | null>(null);
  const [prescriptions, setPrescriptions] = useState<PrescriptionListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchData = async () => {
      if (!id) {
        setError('진료 ID가 없습니다.');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const [encounterData, prescriptionData] = await Promise.all([
          getEncounter(Number(id)),
          getPrescriptionsByEncounter(Number(id)),
        ]);
        setEncounter(encounterData);
        setPrescriptions(prescriptionData);
      } catch (err) {
        console.error('Failed to fetch encounter detail:', err);
        setError('진료 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [id]);

  // 날짜 포맷
  const formatDate = (dateString?: string) => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 상태 뱃지 클래스
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'badge badge-scheduled';
      case 'in_progress':
        return 'badge badge-in-progress';
      case 'completed':
        return 'badge badge-completed';
      case 'cancelled':
        return 'badge badge-cancelled';
      default:
        return 'badge';
    }
  };

  // 처방 상태 뱃지 클래스
  const getPrescriptionStatusClass = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'badge badge-draft';
      case 'ISSUED':
        return 'badge badge-issued';
      case 'DISPENSED':
        return 'badge badge-dispensed';
      case 'CANCELLED':
        return 'badge badge-cancelled';
      default:
        return 'badge';
    }
  };

  if (loading) {
    return (
      <div className="page encounter-detail-page">
        <LoadingSpinner />
      </div>
    );
  }

  if (error || !encounter) {
    return (
      <div className="page encounter-detail-page">
        <div className="error-state">
          <p>{error || '진료 정보를 찾을 수 없습니다.'}</p>
          <button className="btn" onClick={() => navigate(-1)}>
            뒤로 가기
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="page encounter-detail-page">
      {/* 헤더 */}
      <header className="detail-header no-print">
        <div className="header-left">
          <button className="btn-back" onClick={() => navigate(-1)}>
            &larr; 목록으로
          </button>
          <h1>진료 상세</h1>
          <span className={getStatusBadgeClass(encounter.status)}>
            {encounter.status_display || encounter.status}
          </span>
        </div>
        <div className="header-right">
          <span className="encounter-date">{formatDate(encounter.admission_date)}</span>
          <button className="btn btn-primary" onClick={() => window.print()}>
            PDF/인쇄
          </button>
        </div>
      </header>

      {/* 인쇄용 헤더 */}
      <header className="print-header print-only">
        <h1>진료 기록부</h1>
        <p className="print-date">출력일: {new Date().toLocaleDateString('ko-KR')}</p>
      </header>

      {/* 환자 정보 카드 */}
      <section className="detail-section patient-info-section">
        <h2>환자 정보</h2>
        <div className="info-grid">
          <div className="info-item">
            <span className="label">환자명</span>
            <span className="value">{encounter.patient_name || '-'}</span>
          </div>
          <div className="info-item">
            <span className="label">환자번호</span>
            <span className="value">{encounter.patient_number || '-'}</span>
          </div>
          <div className="info-item">
            <span className="label">진료유형</span>
            <span className="value">{encounter.encounter_type_display || encounter.encounter_type}</span>
          </div>
          <div className="info-item">
            <span className="label">진료과</span>
            <span className="value">{encounter.department_display || encounter.department || '-'}</span>
          </div>
          <div className="info-item">
            <span className="label">담당의</span>
            <span className="value">{encounter.attending_doctor_name || '-'}</span>
          </div>
        </div>
      </section>

      {/* 주호소 카드 */}
      <section className="detail-section chief-complaint-section">
        <h2>주호소</h2>
        <div className="content-box">
          {encounter.chief_complaint ? (
            <p className="chief-complaint-text">{encounter.chief_complaint}</p>
          ) : (
            <p className="empty-text">기록된 주호소가 없습니다.</p>
          )}
        </div>
        {encounter.symptoms && (
          <div className="content-box symptoms-box">
            <h3>증상</h3>
            <p>{encounter.symptoms}</p>
          </div>
        )}
      </section>

      {/* 진료 보고서 (SOAP 노트) */}
      <section className="detail-section soap-section">
        <h2>진료 보고서</h2>
        <div className="soap-grid">
          <div className="soap-item">
            <h3>S - 주관적 증상</h3>
            <div className="soap-content">
              {encounter.subjective || <span className="empty-text">기록 없음</span>}
            </div>
          </div>
          <div className="soap-item">
            <h3>O - 객관적 소견</h3>
            <div className="soap-content">
              {encounter.objective || <span className="empty-text">기록 없음</span>}
            </div>
          </div>
          <div className="soap-item">
            <h3>A - 평가/진단</h3>
            <div className="soap-content">
              {encounter.assessment || encounter.diagnosis || encounter.primary_diagnosis || (
                <span className="empty-text">기록 없음</span>
              )}
            </div>
          </div>
          <div className="soap-item">
            <h3>P - 치료 계획</h3>
            <div className="soap-content">
              {encounter.plan || <span className="empty-text">기록 없음</span>}
            </div>
          </div>
        </div>
        {encounter.notes && (
          <div className="notes-box">
            <h3>추가 메모</h3>
            <p>{encounter.notes}</p>
          </div>
        )}
      </section>

      {/* 처방전 */}
      <section className="detail-section prescription-section">
        <h2>처방전</h2>
        {prescriptions.length === 0 ? (
          <div className="empty-state">
            <p>발행된 처방전이 없습니다.</p>
          </div>
        ) : (
          <div className="prescription-list">
            {prescriptions.map((prescription) => (
              <div key={prescription.id} className="prescription-card">
                <div className="prescription-header">
                  <span className="prescription-number">
                    {prescription.prescription_number || prescription.prescription_id}
                  </span>
                  <span className={getPrescriptionStatusClass(prescription.status)}>
                    {STATUS_LABELS[prescription.status] || prescription.status_display || prescription.status}
                  </span>
                  <span className="prescription-date">{formatDate(prescription.created_at)}</span>
                </div>

                {prescription.diagnosis && (
                  <div className="prescription-diagnosis">
                    <strong>진단:</strong> {prescription.diagnosis}
                  </div>
                )}

                {prescription.items && prescription.items.length > 0 ? (
                  <table className="prescription-items-table">
                    <thead>
                      <tr>
                        <th>약품명</th>
                        <th>용량</th>
                        <th>복용법</th>
                        <th>투여경로</th>
                        <th>일수</th>
                        <th>수량</th>
                      </tr>
                    </thead>
                    <tbody>
                      {prescription.items.map((item: PrescriptionItem) => (
                        <tr key={item.id}>
                          <td>{item.medication_name}</td>
                          <td>{item.dosage}</td>
                          <td>{FREQUENCY_LABELS[item.frequency] || item.frequency_display || item.frequency}</td>
                          <td>{ROUTE_LABELS[item.route] || item.route_display || item.route}</td>
                          <td>{item.duration_days}일</td>
                          <td>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="prescription-item-count">처방 항목: {prescription.item_count}건</p>
                )}

                {prescription.notes && (
                  <div className="prescription-notes">
                    <strong>비고:</strong> {prescription.notes}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
