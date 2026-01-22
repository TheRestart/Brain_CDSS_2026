/**
 * 진찰 탭 (Option C: 환자 주의사항 + 진료별 SOAP 노트)
 * - 환자 주의사항 (알러지, 금기, 주의사항)
 * - 진료별 SOAP 기록 표시/편집
 * - AI 분석 결과 표시
 * - 모든 권한 읽기 가능, 의사/시스템관리자만 수정 가능
 */
import { useState, useEffect, useCallback } from 'react';
import { getPatientAIRequests, type AIInferenceRequest } from '@/services/ai.api';
import { getPatientAlerts, createPatientAlert, updatePatientAlert, deletePatientAlert } from '@/services/patient.api';
import { getPatientEncounters, updateEncounter } from '@/services/encounter.api';
import type { PatientAlert, PatientAlertCreateData } from '@/types/patient';
import type { Encounter } from '@/types/encounter';
import PatientAlertsSection from '../components/PatientAlertsSection';
import EncounterNoteCard, { type SOAPData } from '../components/EncounterNoteCard';
import AlertModal from '../components/AlertModal';
import '@/assets/style/patientListView.css';

interface Props {
  role: string;
  patientId?: number;
}

export default function ExaminationTab({ role, patientId }: Props) {
  const isDoctor = role === 'DOCTOR';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canEdit = isDoctor || isSystemManager;

  // 상태
  const [loading, setLoading] = useState(true);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [aiRequests, setAIRequests] = useState<AIInferenceRequest[]>([]);

  // 모달 상태
  const [alertModalOpen, setAlertModalOpen] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PatientAlert | null>(null);

  // 데이터 로딩
  const loadData = useCallback(async () => {
    if (!patientId) {
      setLoading(false);
      return;
    }

    setLoading(true);
    try {
      const [alertsData, encountersData, aiData] = await Promise.all([
        getPatientAlerts(patientId).catch(() => []),
        getPatientEncounters(patientId).catch(() => []),
        getPatientAIRequests(patientId).catch(() => []),
      ]);

      setAlerts(alertsData);
      setEncounters(encountersData);
      const aiList = Array.isArray(aiData) ? aiData : (aiData as any)?.results || [];
      setAIRequests(aiList.slice(0, 5));
    } catch (err) {
      console.error('Failed to fetch data:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // 주의사항 핸들러
  const handleAddAlert = () => {
    setEditingAlert(null);
    setAlertModalOpen(true);
  };

  const handleEditAlert = (alert: PatientAlert) => {
    setEditingAlert(alert);
    setAlertModalOpen(true);
  };

  const handleDeleteAlert = async (alertId: number) => {
    if (!patientId) return;
    try {
      await deletePatientAlert(patientId, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
    } catch (err) {
      console.error('Failed to delete alert:', err);
      alert('삭제에 실패했습니다.');
    }
  };

  const handleSaveAlert = async (data: PatientAlertCreateData, isUpdate: boolean, alertId?: number) => {
    if (!patientId) return;

    if (isUpdate && alertId) {
      const updated = await updatePatientAlert(patientId, alertId, data);
      setAlerts((prev) => prev.map((a) => (a.id === alertId ? updated : a)));
    } else {
      const created = await createPatientAlert(patientId, data);
      setAlerts((prev) => [created, ...prev]);
    }
  };

  // SOAP 저장 핸들러
  const handleSaveSOAP = async (encounterId: number, data: SOAPData) => {
    const updated = await updateEncounter(encounterId, data);
    setEncounters((prev) => prev.map((e) => (e.id === encounterId ? updated : e)));
  };

  if (loading) {
    return (
      <div className="examination-tab">
        <div className="loading-state">데이터 로딩 중...</div>
      </div>
    );
  }

  if (!patientId) {
    return (
      <div className="examination-tab">
        <div className="empty-state">환자 정보를 찾을 수 없습니다.</div>
      </div>
    );
  }

  return (
    <div className="examination-tab">
      {/* 환자 주의사항 */}
      <PatientAlertsSection
        alerts={alerts}
        canEdit={canEdit}
        onAddAlert={handleAddAlert}
        onEditAlert={handleEditAlert}
        onDeleteAlert={handleDeleteAlert}
      />

      {/* 진료별 SOAP 노트 */}
      <section className="exam-section">
        <h3>진료 기록 ({encounters.length}건)</h3>
        {encounters.length === 0 ? (
          <div className="empty-message">진료 기록이 없습니다.</div>
        ) : (
          <div className="encounters-list">
            {encounters.map((encounter) => (
              <EncounterNoteCard
                key={encounter.id}
                encounter={encounter}
                canEdit={canEdit}
                onSave={handleSaveSOAP}
              />
            ))}
          </div>
        )}
      </section>

      {/* AI 분석 결과 */}
      <section className="exam-section">
        <h3>AI 분석 이력 ({aiRequests.length}건)</h3>
        {aiRequests.length === 0 ? (
          <div className="empty-message">AI 분석 이력이 없습니다.</div>
        ) : (
          <div className="ai-requests-list">
            {aiRequests.map((req) => (
              <div key={req.request_id} className="ai-request-card">
                <div className="ai-request-header">
                  <span className="model-name">{req.model_name || req.model_code}</span>
                  <span className={`status-badge status-${req.status.toLowerCase()}`}>
                    {req.status_display || req.status}
                  </span>
                </div>
                <div className="ai-request-meta">
                  <span>요청일: {req.requested_at?.split('T')[0]}</span>
                  {req.completed_at && (
                    <span>완료일: {req.completed_at?.split('T')[0]}</span>
                  )}
                </div>
                {req.has_result && req.result && (
                  <div className="ai-result-preview">
                    <strong>신뢰도: {((req.result.confidence_score ?? 0) * 100).toFixed(1)}%</strong>
                    {req.result.review_status && (
                      <span className={`review-badge review-${req.result.review_status}`}>
                        {req.result.review_status_display}
                      </span>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>

      {/* 주의사항 추가/편집 모달 */}
      <AlertModal
        isOpen={alertModalOpen}
        alert={editingAlert}
        onClose={() => setAlertModalOpen(false)}
        onSave={handleSaveAlert}
      />

      <style>{`
        .examination-tab {
          padding: 16px;
          display: flex;
          flex-direction: column;
          gap: 20px;
        }
        .exam-section {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .exam-section h3 {
          margin: 0;
          padding: 12px 16px;
          font-size: 15px;
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
          background: var(--bg-secondary, #fafafa);
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .encounters-list {
          padding: 12px;
        }
        .ai-requests-list {
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }
        .ai-request-card {
          padding: 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          background: var(--bg-secondary, #fafafa);
        }
        .ai-request-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .model-name {
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
        }
        .status-badge {
          padding: 2px 8px;
          border-radius: 4px;
          font-size: 11px;
          font-weight: 500;
          color: #fff;
        }
        .status-pending { background: #9e9e9e; }
        .status-validating { background: #2196f3; }
        .status-processing { background: #ff9800; }
        .status-completed { background: #4caf50; }
        .status-failed { background: #f44336; }
        .ai-request-meta {
          font-size: 12px;
          color: var(--text-secondary, #666);
          display: flex;
          gap: 16px;
        }
        .ai-result-preview {
          margin-top: 8px;
          padding: 8px;
          background: #fff;
          border-radius: 4px;
          font-size: 13px;
          display: flex;
          align-items: center;
          gap: 12px;
        }
        .review-badge {
          padding: 2px 6px;
          border-radius: 3px;
          font-size: 10px;
          font-weight: 500;
        }
        .review-pending { background: #e0e0e0; color: #666; }
        .review-approved { background: #c8e6c9; color: #2e7d32; }
        .review-rejected { background: #ffcdd2; color: #c62828; }
        .empty-message {
          padding: 24px;
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
      `}</style>
    </div>
  );
}
