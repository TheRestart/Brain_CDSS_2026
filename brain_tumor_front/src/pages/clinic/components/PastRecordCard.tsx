/**
 * 과거 진료 기록 카드
 * - 환자의 이전 진료 기록 목록
 * - SOAP 노트 상세 보기 모달 포함
 * - 해당 진료의 처방 정보 표시
 * - GET /api/encounters/?patient=<id> 사용
 */
import { useMemo, useState, useEffect } from 'react';
import { getPrescriptionsByEncounter } from '@/services/prescription.api';
import type { Encounter } from '@/types/encounter';
import type { PrescriptionListItem } from '@/types/prescription';
import { FREQUENCY_LABELS, ROUTE_LABELS } from '@/types/prescription';

interface PastRecordCardProps {
  patientId: number;
  encounters: Encounter[];
  highlightDate?: string | null;
}

// 진료 유형
const TYPE_LABELS: Record<string, string> = {
  outpatient: '외래',
  inpatient: '입원',
  emergency: '응급',
};

// 처방 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  DRAFT: '작성중',
  ISSUED: '발행됨',
  DISPENSED: '조제완료',
  CANCELLED: '취소됨',
};

// 진료 날짜 추출 헬퍼 (admission_date 사용, encounter_date는 폴백)
const getEncounterDate = (e: Encounter): string => {
  const dateStr = e.admission_date || e.encounter_date || '';
  // ISO 형식에서 날짜 부분만 추출 (YYYY-MM-DD)
  return dateStr.slice(0, 10);
};

export default function PastRecordCard({
  patientId: _patientId,
  encounters,
  highlightDate,
}: PastRecordCardProps) {
  // 상세 보기 모달 상태
  const [selectedRecord, setSelectedRecord] = useState<Encounter | null>(null);
  // 선택된 진료의 처방 목록
  const [prescriptions, setPrescriptions] = useState<PrescriptionListItem[]>([]);
  const [loadingPrescriptions, setLoadingPrescriptions] = useState(false);

  // 완료된 진료 기록만 필터링 (최근 순 - admission_date 기준)
  const pastRecords = useMemo(() => {
    return encounters
      .filter((e) => e.status === 'completed')
      .sort((a, b) => {
        // admission_date를 우선 사용, 없으면 encounter_date 또는 created_at 사용
        const dateA = a.admission_date || a.encounter_date || a.created_at || '';
        const dateB = b.admission_date || b.encounter_date || b.created_at || '';
        // 유효하지 않은 날짜는 맨 뒤로 보냄
        const timeA = dateA ? new Date(dateA).getTime() : 0;
        const timeB = dateB ? new Date(dateB).getTime() : 0;
        // 내림차순 정렬 (최근 날짜가 먼저)
        return timeB - timeA;
      })
      .slice(0, 10);
  }, [encounters]);

  // 선택된 진료의 처방 목록 로드
  useEffect(() => {
    if (!selectedRecord) {
      setPrescriptions([]);
      return;
    }

    const loadPrescriptions = async () => {
      setLoadingPrescriptions(true);
      try {
        const data = await getPrescriptionsByEncounter(selectedRecord.id);
        setPrescriptions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('Failed to load prescriptions:', err);
        setPrescriptions([]);
      } finally {
        setLoadingPrescriptions(false);
      }
    };

    loadPrescriptions();
  }, [selectedRecord]);

  // SOAP 데이터 유무 확인
  const hasSOAP = (record: Encounter) => {
    return record.subjective || record.objective || record.assessment || record.plan;
  };

  // 상세 보기 가능 여부 (SOAP 또는 주호소가 있으면)
  const canViewDetail = (record: Encounter) => {
    return hasSOAP(record) || record.chief_complaint || record.primary_diagnosis;
  };

  // 해당 날짜에 강조 표시 여부
  const isHighlighted = (record: Encounter) => {
    if (!highlightDate) return false;
    return getEncounterDate(record) === highlightDate;
  };

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">📚</span>
          과거 진료 기록
          <span className="record-count">({pastRecords.length})</span>
        </h3>
      </div>
      <div className="clinic-card-body past-record-body">
        {pastRecords.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">📖</div>
            <div className="empty-state-text">과거 진료 기록이 없습니다.</div>
          </div>
        ) : (
          <div className="record-list">
            {pastRecords.map((record) => (
              <div
                key={record.id}
                className={`record-item ${canViewDetail(record) ? 'clickable' : ''} ${isHighlighted(record) ? 'highlighted' : ''}`}
                onClick={() => canViewDetail(record) && setSelectedRecord(record)}
              >
                <div className="record-date">
                  <span className="date-main">{getEncounterDate(record)}</span>
                  <div className="date-badges">
                    <span className="date-type">
                      {TYPE_LABELS[record.encounter_type] || record.encounter_type}
                    </span>
                    {hasSOAP(record) && <span className="soap-badge">SOAP</span>}
                  </div>
                </div>
                <div className="record-content">
                  {record.chief_complaint && (
                    <div className="record-complaint">
                      <strong>주호소:</strong> {record.chief_complaint}
                    </div>
                  )}
                  {record.primary_diagnosis && (
                    <div className="record-diagnosis">
                      <strong>진단:</strong> {record.primary_diagnosis}
                    </div>
                  )}
                  {record.subjective && (
                    <div className="record-soap-preview">
                      <strong>S:</strong> {record.subjective.slice(0, 50)}
                      {record.subjective.length > 50 ? '...' : ''}
                    </div>
                  )}
                  {!record.primary_diagnosis && !record.chief_complaint && !record.subjective && (
                    <div className="record-empty">기록 없음</div>
                  )}
                </div>
                {canViewDetail(record) && (
                  <div className="record-action">
                    <span className="view-detail">상세 보기 →</span>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* SOAP 상세 보기 모달 */}
        {selectedRecord && (
          <div className="soap-modal-backdrop" onClick={() => setSelectedRecord(null)}>
            <div className="soap-modal" onClick={(e) => e.stopPropagation()}>
              <div className="soap-modal-header">
                <h3>진료 기록 상세</h3>
                <button className="close-btn" onClick={() => setSelectedRecord(null)}>×</button>
              </div>
              <div className="soap-modal-meta">
                <span className="meta-date">{getEncounterDate(selectedRecord)}</span>
                <span className="meta-type">
                  {TYPE_LABELS[selectedRecord.encounter_type] || selectedRecord.encounter_type}
                </span>
                {selectedRecord.attending_doctor_name && (
                  <span className="meta-doctor">담당: {selectedRecord.attending_doctor_name}</span>
                )}
              </div>

              <div className="soap-modal-body">
                {selectedRecord.chief_complaint && (
                  <div className="soap-section">
                    <h4>주호소</h4>
                    <p>{selectedRecord.chief_complaint}</p>
                  </div>
                )}

                {selectedRecord.subjective && (
                  <div className="soap-section">
                    <h4>S - Subjective (주관적 소견)</h4>
                    <p>{selectedRecord.subjective}</p>
                  </div>
                )}

                {selectedRecord.objective && (
                  <div className="soap-section">
                    <h4>O - Objective (객관적 소견)</h4>
                    <p>{selectedRecord.objective}</p>
                  </div>
                )}

                {selectedRecord.assessment && (
                  <div className="soap-section">
                    <h4>A - Assessment (평가)</h4>
                    <p>{selectedRecord.assessment}</p>
                  </div>
                )}

                {selectedRecord.plan && (
                  <div className="soap-section">
                    <h4>P - Plan (계획)</h4>
                    <p>{selectedRecord.plan}</p>
                  </div>
                )}

                {selectedRecord.primary_diagnosis && (
                  <div className="soap-section">
                    <h4>진단</h4>
                    <p>{selectedRecord.primary_diagnosis}</p>
                  </div>
                )}

                {/* 처방 정보 */}
                <div className="soap-section prescription-section">
                  <h4>처방</h4>
                  {loadingPrescriptions ? (
                    <p className="loading-text">로딩 중...</p>
                  ) : prescriptions.length === 0 ? (
                    <p className="empty-text">처방 기록이 없습니다.</p>
                  ) : (
                    <div className="prescription-list">
                      {prescriptions.map((rx) => (
                        <div key={rx.id} className="prescription-item">
                          <div className="prescription-header">
                            <span className="prescription-id">#{rx.prescription_number}</span>
                            <span className={`prescription-status ${rx.status.toLowerCase()}`}>
                              {STATUS_LABELS[rx.status] || rx.status}
                            </span>
                          </div>
                          {rx.diagnosis && (
                            <div className="prescription-diagnosis">
                              <strong>처방 진단:</strong> {rx.diagnosis}
                            </div>
                          )}
                          <div className="prescription-items-list">
                            {rx.items?.map((item, idx) => (
                              <div key={idx} className="med-item">
                                <span className="med-name">{item.medication_name}</span>
                                <span className="med-detail">
                                  {item.dosage} | {FREQUENCY_LABELS[item.frequency] || item.frequency} | {ROUTE_LABELS[item.route] || item.route} | {item.duration_days}일분
                                </span>
                              </div>
                            ))}
                          </div>
                          {rx.notes && (
                            <div className="prescription-notes">
                              <strong>비고:</strong> {rx.notes}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        .record-count {
          font-size: 12px;
          font-weight: normal;
          color: var(--text-secondary, #666);
          margin-left: 4px;
        }
        .past-record-body {
          max-height: 280px;
          overflow-y: auto;
          padding: 0;
        }
        .record-list {
          padding: 0;
        }
        .record-item {
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .record-item:last-child {
          border-bottom: none;
        }
        .record-date {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 6px;
        }
        .date-main {
          font-size: 13px;
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
        }
        .date-type {
          font-size: 11px;
          padding: 2px 6px;
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 4px;
          color: var(--text-secondary, #666);
        }
        .record-content {
          font-size: 13px;
          color: var(--text-secondary, #666);
        }
        .record-diagnosis {
          margin-bottom: 4px;
          color: var(--text-primary, #1a1a1a);
        }
        .record-complaint {
          margin-bottom: 4px;
        }
        .record-notes {
          font-size: 12px;
          color: var(--text-tertiary, #999);
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
        .record-empty {
          font-size: 12px;
          color: var(--text-tertiary, #999);
          font-style: italic;
        }

        /* Clickable record item */
        .record-item.clickable {
          cursor: pointer;
          transition: background-color 0.15s ease;
        }
        .record-item.clickable:hover {
          background: var(--bg-hover, #f8f9fa);
        }

        /* Highlighted record (selected from calendar) */
        .record-item.highlighted {
          background: #e3f2fd;
          border-left: 3px solid var(--info, #5b8def);
          animation: highlight-pulse 0.5s ease;
        }
        @keyframes highlight-pulse {
          0% { background: #bbdefb; }
          100% { background: #e3f2fd; }
        }

        /* Date badges */
        .date-badges {
          display: flex;
          gap: 4px;
          align-items: center;
        }
        .soap-badge {
          font-size: 10px;
          padding: 2px 6px;
          background: #1976d2;
          color: white;
          border-radius: 4px;
          font-weight: 500;
        }

        /* SOAP preview */
        .record-soap-preview {
          font-size: 12px;
          color: var(--text-secondary, #666);
          margin-top: 4px;
        }

        /* View detail action */
        .record-action {
          margin-top: 8px;
          text-align: right;
        }
        .view-detail {
          font-size: 12px;
          color: var(--primary, #1976d2);
          font-weight: 500;
        }

        /* SOAP Modal */
        .soap-modal-backdrop {
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
        .soap-modal {
          background: white;
          border-radius: 12px;
          width: 90%;
          max-width: 600px;
          max-height: 80vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
        }
        .soap-modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .soap-modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .close-btn {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-secondary, #666);
          padding: 0;
          line-height: 1;
        }
        .close-btn:hover {
          color: var(--text-primary, #1a1a1a);
        }
        .soap-modal-meta {
          display: flex;
          gap: 12px;
          padding: 12px 20px;
          background: var(--bg-secondary, #f5f5f5);
          font-size: 13px;
        }
        .meta-date {
          font-weight: 600;
        }
        .meta-type {
          padding: 2px 8px;
          background: white;
          border-radius: 4px;
        }
        .meta-doctor {
          color: var(--text-secondary, #666);
        }
        .soap-modal-body {
          padding: 20px;
          overflow-y: auto;
          flex: 1;
        }
        .soap-section {
          margin-bottom: 20px;
        }
        .soap-section:last-child {
          margin-bottom: 0;
        }
        .soap-section h4 {
          margin: 0 0 8px 0;
          font-size: 13px;
          font-weight: 600;
          color: var(--primary, #1976d2);
        }
        .soap-section p {
          margin: 0;
          font-size: 14px;
          line-height: 1.6;
          color: var(--text-primary, #1a1a1a);
          white-space: pre-wrap;
        }

        /* Prescription Section in Modal */
        .prescription-section {
          border-top: 1px solid var(--border-color, #e0e0e0);
          padding-top: 16px;
          margin-top: 16px;
        }
        .loading-text,
        .empty-text {
          color: var(--text-secondary, #666);
          font-size: 13px;
          font-style: italic;
        }
        .prescription-list {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .prescription-item {
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 8px;
          padding: 12px;
        }
        .prescription-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .prescription-id {
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #666);
        }
        .prescription-status {
          font-size: 11px;
          padding: 2px 8px;
          border-radius: 4px;
          font-weight: 500;
        }
        .prescription-status.draft {
          background: #fff3e0;
          color: #ef6c00;
        }
        .prescription-status.issued {
          background: #e3f2fd;
          color: #1565c0;
        }
        .prescription-status.dispensed {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .prescription-status.cancelled {
          background: #ffebee;
          color: #c62828;
        }
        .prescription-diagnosis {
          font-size: 13px;
          margin-bottom: 8px;
          color: var(--text-primary, #1a1a1a);
        }
        .prescription-items-list {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .med-item {
          display: flex;
          flex-direction: column;
          gap: 2px;
          padding: 6px 8px;
          background: white;
          border-radius: 4px;
        }
        .med-name {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #1a1a1a);
        }
        .med-detail {
          font-size: 11px;
          color: var(--text-secondary, #666);
        }
        .prescription-notes {
          margin-top: 8px;
          font-size: 12px;
          color: var(--text-secondary, #666);
        }
      `}</style>
    </div>
  );
}
