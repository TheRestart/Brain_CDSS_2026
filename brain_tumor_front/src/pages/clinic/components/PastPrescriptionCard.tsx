/**
 * 과거 처방전 카드
 * - SYSTEMMANAGER: 모든 환자 처방 표시
 * - 그 외: 선택된 환자의 처방만 표시
 * - GET /api/prescriptions/?patient_id= 연동
 */
import { useState, useEffect } from 'react';
import { getPrescriptionsByPatient, getPrescriptions } from '@/services/prescription.api';
import { useAuth } from '@/pages/auth/AuthProvider';
import type { PrescriptionListItem } from '@/types/prescription';
import { STATUS_LABELS } from '@/types/prescription';
import PrescriptionDetailModal from './PrescriptionDetailModal';

interface PastPrescriptionCardProps {
  patientId?: number;
  refreshKey?: number; // 처방 발행 시 새로고침 트리거
}

export default function PastPrescriptionCard({
  patientId,
  refreshKey,
}: PastPrescriptionCardProps) {
  const { role } = useAuth();
  const isSystemManager = role === 'SYSTEMMANAGER';

  const [prescriptions, setPrescriptions] = useState<PrescriptionListItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selectedPrescriptionId, setSelectedPrescriptionId] = useState<number | null>(null);

  useEffect(() => {
    // SYSTEMMANAGER가 아닌 경우 patientId가 필수
    if (!isSystemManager && !patientId) return;

    const fetchPrescriptions = async () => {
      setLoading(true);
      setError(null);
      try {
        let data: PrescriptionListItem[];
        if (isSystemManager && !patientId) {
          // SYSTEMMANAGER: 모든 처방 조회
          data = await getPrescriptions();
        } else {
          // 특정 환자의 처방 조회
          data = await getPrescriptionsByPatient(patientId!);
        }
        // data가 배열인지 확인
        setPrescriptions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error('처방 목록 조회 실패:', err);
        setError('처방 목록을 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchPrescriptions();
  }, [patientId, isSystemManager, refreshKey]);

  // 상태별 스타일 클래스
  const getStatusClass = (status: string) => {
    switch (status) {
      case 'DRAFT':
        return 'status-draft';
      case 'ISSUED':
        return 'status-issued';
      case 'DISPENSED':
        return 'status-dispensed';
      case 'CANCELLED':
        return 'status-cancelled';
      default:
        return '';
    }
  };

  // 날짜 포맷팅
  const formatDate = (dateStr: string) => {
    return dateStr?.slice(0, 10) || '-';
  };

  // 전체 보기 모드 여부 (SYSTEMMANAGER이고 patientId가 없는 경우)
  const showAllPatients = isSystemManager && !patientId;

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">💊</span>
          {showAllPatients ? '전체 처방전' : '과거 처방전'}
          {prescriptions.length > 0 && (
            <span className="prescription-count">({prescriptions.length})</span>
          )}
        </h3>
      </div>
      <div className="clinic-card-body prescription-body">
        {loading ? (
          <div className="loading-state">불러오는 중...</div>
        ) : error ? (
          <div className="error-state">{error}</div>
        ) : prescriptions.length === 0 ? (
          <div className="empty-state">
            <div className="empty-state-icon">💊</div>
            <div className="empty-state-text">처방 기록이 없습니다.</div>
          </div>
        ) : (
          <div className="prescription-list">
            {prescriptions.slice(0, 10).map((rx) => (
              <div
                key={rx.id}
                className="list-item prescription-item clickable"
                onClick={() => setSelectedPrescriptionId(rx.id)}
              >
                <div className="list-item-content">
                  <div className="list-item-title">
                    <span className="rx-id">{rx.prescription_id}</span>
                    {showAllPatients && rx.patient_name && (
                      <span className="rx-patient">{rx.patient_name}</span>
                    )}
                    {rx.diagnosis && (
                      <span className="rx-diagnosis">{rx.diagnosis}</span>
                    )}
                  </div>
                  <div className="list-item-subtitle">
                    <span className="rx-date">{formatDate(rx.created_at)}</span>
                    <span className="rx-divider">|</span>
                    <span className="rx-items">{rx.item_count}개 약품</span>
                    {rx.doctor_name && (
                      <>
                        <span className="rx-divider">|</span>
                        <span className="rx-doctor">{rx.doctor_name}</span>
                      </>
                    )}
                  </div>
                </div>
                <div className="list-item-meta">
                  <span className={`status-badge ${getStatusClass(rx.status)}`}>
                    {STATUS_LABELS[rx.status] || rx.status_display || rx.status}
                  </span>
                  <span className="view-detail">보기 →</span>
                </div>
              </div>
            ))}
            {prescriptions.length > 10 && (
              <div className="more-items">
                +{prescriptions.length - 10}개 더 보기
              </div>
            )}
          </div>
        )}

        {/* 처방전 상세 모달 */}
        {selectedPrescriptionId && (
          <PrescriptionDetailModal
            prescriptionId={selectedPrescriptionId}
            onClose={() => setSelectedPrescriptionId(null)}
          />
        )}
      </div>

      <style>{`
        .prescription-body {
          min-height: 150px;
          max-height: 300px;
          overflow-y: auto;
          padding: 0;
        }
        .prescription-count {
          font-size: 12px;
          font-weight: normal;
          color: var(--text-secondary, #666);
          margin-left: 6px;
        }
        .loading-state,
        .error-state {
          display: flex;
          align-items: center;
          justify-content: center;
          height: 100px;
          color: var(--text-secondary, #666);
          font-size: 13px;
        }
        .error-state {
          color: var(--error, #c62828);
        }
        .prescription-list {
          padding: 0;
        }
        .prescription-item {
          padding: 10px 16px;
        }
        .prescription-item.clickable {
          cursor: pointer;
          transition: background 0.15s ease;
        }
        .prescription-item.clickable:hover {
          background: var(--bg-secondary, #f5f5f5);
        }
        .list-item-meta {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 4px;
        }
        .view-detail {
          font-size: 11px;
          color: var(--primary, #1976d2);
          opacity: 0;
          transition: opacity 0.15s ease;
        }
        .prescription-item:hover .view-detail {
          opacity: 1;
        }
        .rx-id {
          font-family: monospace;
          font-size: 12px;
          color: var(--primary, #1976d2);
          margin-right: 8px;
        }
        .rx-patient {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #1a1a1a);
          margin-right: 8px;
        }
        .rx-diagnosis {
          font-size: 13px;
          color: var(--text-primary, #1a1a1a);
        }
        .rx-date,
        .rx-items,
        .rx-doctor {
          font-size: 12px;
        }
        .rx-divider {
          margin: 0 6px;
          color: var(--border-color, #e0e0e0);
        }
        .status-badge.status-draft {
          background: #fff3e0;
          color: #e65100;
        }
        .status-badge.status-issued {
          background: #e3f2fd;
          color: #1565c0;
        }
        .status-badge.status-dispensed {
          background: #e8f5e9;
          color: #2e7d32;
        }
        .status-badge.status-cancelled {
          background: #ffebee;
          color: #c62828;
        }
        .more-items {
          padding: 12px;
          text-align: center;
          font-size: 12px;
          color: var(--primary, #1976d2);
          cursor: pointer;
        }
        .more-items:hover {
          background: var(--bg-secondary, #f5f5f5);
        }
      `}</style>
    </div>
  );
}
