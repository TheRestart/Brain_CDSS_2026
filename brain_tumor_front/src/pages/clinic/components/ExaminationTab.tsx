/**
 * ExaminationTab - 진찰 탭 (ClinicPage용)
 * - 환자 주의사항 표시
 * - SOAP 노트 입력/표시
 * - 처방 및 오더 관리
 * - 검사 결과 확인
 * - 최근 진료/검사 이력
 * - AI 분석 요약
 */
import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  getExaminationSummary,
  getPatientAlerts,
  createPatientAlert,
  updatePatientAlert,
  deletePatientAlert,
} from '@/services/patient.api';
import { updateEncounter } from '@/services/encounter.api';
import type {
  PatientAlert,
  PatientAlertCreateData,
  ExaminationSummary,
  AlertType,
  AlertSeverity,
} from '@/types/patient';
import type { OCSListItem } from '@/types/ocs';
import type { Encounter } from '@/types/encounter';
import { getPatientAIRequests, type AIInferenceRequest } from '@/services/ai.api';
import PrescriptionCard from './DiagnosisPrescriptionCard';
import TodayAppointmentCard from './TodayAppointmentCard';
import TodayCompletedCard from './TodayCompletedCard';
import PastRecordCard from './PastRecordCard';
import CalendarCard from './CalendarCard';
import PastPrescriptionCard from './PastPrescriptionCard';
import { AIAnalysisPopup } from '@/components/AIAnalysisPopup';
import './ExaminationTab.css';

interface ExaminationTabProps {
  patientId: number;
  encounterId: number | null;
  encounter: Encounter | null;
  ocsList: OCSListItem[];
  encounters: Encounter[];
  onUpdate: () => void;
  recordRefreshKey?: number;  // 진료 종료 시 과거 기록 새로고침용
  onPatientChange?: (patientId: number) => void;  // 다른 환자 선택 시 (진료 중 확인용)
}

// 심각도 색상
const SEVERITY_COLORS: Record<AlertSeverity, string> = {
  HIGH: '#d32f2f',
  MEDIUM: '#f57c00',
  LOW: '#1976d2',
};

// 타입 아이콘
const ALERT_TYPE_ICONS: Record<AlertType, string> = {
  ALLERGY: '⚠️',
  CONTRAINDICATION: '🚫',
  PRECAUTION: '⚡',
  OTHER: 'ℹ️',
};

interface SOAPData {
  subjective: string;
  objective: string;
  assessment: string;
  plan: string;
}

// 상태 표시 텍스트
const OCS_STATUS_LABELS: Record<string, string> = {
  ORDERED: '오더됨',
  ACCEPTED: '접수됨',
  IN_PROGRESS: '진행 중',
  RESULT_READY: '결과 대기',
  CONFIRMED: '확정됨',
  CANCELLED: '취소됨',
};

// 작업 역할 표시
const JOB_ROLE_LABELS: Record<string, string> = {
  RIS: '영상',
  LIS: '검사',
};

// 검사 유형 라벨
const JOB_TYPE_LABELS: Record<string, string> = {
  BLOOD: '혈액검사',
  URINE: '소변검사',
  GENETIC: '유전자검사',
  PROTEIN: '단백질검사',
  PATHOLOGY: '병리검사',
};

export default function ExaminationTab({
  patientId,
  encounterId,
  encounter,
  ocsList,
  encounters,
  onUpdate: _onUpdate,
  recordRefreshKey = 0,
  onPatientChange,
}: ExaminationTabProps) {
  const navigate = useNavigate();

  // 캘린더에서 선택한 날짜 (과거 진료 기록 강조용)
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [summary, setSummary] = useState<ExaminationSummary | null>(null);
  const [alerts, setAlerts] = useState<PatientAlert[]>([]);
  const [soapData, setSOAPData] = useState<SOAPData>({
    subjective: '',
    objective: '',
    assessment: '',
    plan: '',
  });
  const [savingSOAP, setSavingSOAP] = useState(false);
  const [soapSaved, setSOAPSaved] = useState(false);

  // 주호소 (읽기 전용 - SOAP Subjective에서 입력)
  const [chiefComplaint, setChiefComplaint] = useState('');

  // Alert 모달 상태
  const [showAlertModal, setShowAlertModal] = useState(false);
  const [editingAlert, setEditingAlert] = useState<PatientAlert | null>(null);

  // 토스트 메시지
  const [toastMessage, setToastMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // AI 추론 관련 상태 (읽기 전용 - 결과 조회용)
  const [aiRequests, setAIRequests] = useState<AIInferenceRequest[]>([]);

  // 새 분석 요청 모달 상태
  const [showAnalysisPopup, setShowAnalysisPopup] = useState(false);

  // 처방 새로고침 키 (처방 발행 시 PastPrescriptionCard 새로고침용)
  const [prescriptionRefreshKey, setPrescriptionRefreshKey] = useState(0);

  // 토스트 표시 헬퍼
  const showToast = (type: 'success' | 'error', text: string) => {
    setToastMessage({ type, text });
    setTimeout(() => setToastMessage(null), 3000);
  };

  // 데이터 로드
  const loadData = useCallback(async () => {
    // patientId가 유효하지 않으면 API 호출하지 않음
    if (!patientId || patientId <= 0) {
      setLoading(false);
      setSummary(null);
      setAlerts([]);
      return;
    }

    setLoading(true);
    try {
      const [summaryData, alertsData, aiRequestsData] = await Promise.all([
        getExaminationSummary(patientId).catch(() => null),
        getPatientAlerts(patientId).catch(() => []),
        getPatientAIRequests(patientId).catch(() => []),
      ]);

      if (summaryData) {
        setSummary(summaryData);
        // 현재 진료의 SOAP 데이터 로드
        if (summaryData.current_encounter) {
          setSOAPData({
            subjective: summaryData.current_encounter.subjective || '',
            objective: summaryData.current_encounter.objective || '',
            assessment: summaryData.current_encounter.assessment || '',
            plan: summaryData.current_encounter.plan || '',
          });
        }
        // 주호소 초기화 (현재 진료 > 환자 기본)
        setChiefComplaint(
          summaryData.current_encounter?.chief_complaint ||
          summaryData.patient?.chief_complaint ||
          ''
        );
      }
      setAlerts(alertsData);
      setAIRequests(aiRequestsData);
    } catch (err) {
      console.error('Failed to load examination data:', err);
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // SOAP 저장
  const handleSaveSOAP = async () => {
    if (!encounterId) return;

    setSavingSOAP(true);
    setSOAPSaved(false);
    try {
      await updateEncounter(encounterId, soapData);
      setSOAPSaved(true);
      showToast('success', 'SOAP 노트가 저장되었습니다.');
      setTimeout(() => setSOAPSaved(false), 3000);
      // onUpdate() 호출하지 않음 - 전체 리로드 시 SOAP 데이터가 덮어써짐
    } catch (err) {
      console.error('Failed to save SOAP:', err);
      showToast('error', 'SOAP 저장에 실패했습니다.');
    } finally {
      setSavingSOAP(false);
    }
  };

  // Alert 추가
  const handleAddAlert = () => {
    setEditingAlert(null);
    setShowAlertModal(true);
  };

  // Alert 편집
  const handleEditAlert = (alert: PatientAlert) => {
    setEditingAlert(alert);
    setShowAlertModal(true);
  };

  // Alert 삭제
  const handleDeleteAlert = async (alertId: number) => {
    if (!confirm('이 주의사항을 삭제하시겠습니까?')) return;

    try {
      await deletePatientAlert(patientId, alertId);
      setAlerts((prev) => prev.filter((a) => a.id !== alertId));
      showToast('success', '주의사항이 삭제되었습니다.');
    } catch (err) {
      console.error('Failed to delete alert:', err);
      showToast('error', '삭제에 실패했습니다.');
    }
  };

  // RIS 검사결과 (Orthanc 뷰어) 열기
  const handleOpenDicomViewer = (ocsId: number) => {
    navigate(`/ocs/ris/${ocsId}?openViewer=true`);
  };

  // OCS의 AI 결과 조회
  const getAIResultsForOCS = (ocsId: number) => {
    return aiRequests.filter(req =>
      req.ocs_references?.includes(ocsId) && req.status === 'COMPLETED'
    );
  };

  // Alert 저장
  const handleSaveAlert = async (data: PatientAlertCreateData) => {
    try {
      if (editingAlert) {
        const updated = await updatePatientAlert(patientId, editingAlert.id, data);
        setAlerts((prev) => prev.map((a) => (a.id === editingAlert.id ? updated : a)));
        showToast('success', '주의사항이 수정되었습니다.');
      } else {
        const created = await createPatientAlert(patientId, data);
        setAlerts((prev) => [created, ...prev]);
        showToast('success', '주의사항이 추가되었습니다.');
      }
      setShowAlertModal(false);
    } catch (err) {
      console.error('Failed to save alert:', err);
      showToast('error', '저장에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="examination-tab loading">로딩 중...</div>;
  }

  const activeAlerts = alerts.filter((a) => a.is_active);

  return (
    <div className="examination-tab enhanced">
      {/* 토스트 메시지 */}
      {toastMessage && (
        <div className={`toast-message toast-${toastMessage.type}`}>
          {toastMessage.text}
        </div>
      )}

      {/* 상단 요약 영역: 주의사항 + 기본정보 */}
      <div className="top-summary-row">
        {/* 환자 주의사항 */}
        <section className="exam-section alert-section compact">
          <div className="section-header">
            <h4>
              <span className="section-icon warning">!</span>
              주의사항
              {activeAlerts.length > 0 && (
                <span className="alert-count">{activeAlerts.length}</span>
              )}
            </h4>
            <button
              className="btn btn-sm btn-outline"
              onClick={handleAddAlert}
              disabled={!patientId || patientId <= 0}
            >
              + 추가
            </button>
          </div>
          {activeAlerts.length === 0 ? (
            <div className="empty-message small">등록된 주의사항이 없습니다.</div>
          ) : (
            <div className="alert-list horizontal">
              {activeAlerts.slice(0, 3).map((alert) => (
                <div
                  key={alert.id}
                  className="alert-chip"
                  style={{ borderColor: SEVERITY_COLORS[alert.severity] }}
                  onClick={() => handleEditAlert(alert)}
                  title={alert.description || alert.title}
                >
                  <span className="alert-icon">{ALERT_TYPE_ICONS[alert.alert_type]}</span>
                  <span className="alert-title">{alert.title}</span>
                  <button
                    className="btn-remove"
                    onClick={(e) => { e.stopPropagation(); handleDeleteAlert(alert.id); }}
                  >
                    ×
                  </button>
                </div>
              ))}
              {activeAlerts.length > 3 && (
                <span className="more-alerts">+{activeAlerts.length - 3}개</span>
              )}
            </div>
          )}
        </section>

        {/* 환자 기본정보 - 간소화 */}
        {summary?.patient && (
          <section className="exam-section info-section compact">
            <h4>
              <span className="section-icon info">i</span>
              기본정보
            </h4>
            <div className="info-chips">
              <span className="info-chip">
                <span className="chip-label">혈액형</span>
                <span className="chip-value">{summary.patient.blood_type || '-'}</span>
              </span>
              <span className="info-chip">
                <span className="chip-label">알레르기</span>
                <span className="chip-value">
                  {summary.patient.allergies?.length > 0
                    ? summary.patient.allergies.slice(0, 2).join(', ')
                    : '-'}
                </span>
              </span>
              <span className="info-chip">
                <span className="chip-label">기저질환</span>
                <span className="chip-value">
                  {summary.patient.chronic_diseases?.length > 0
                    ? summary.patient.chronic_diseases.slice(0, 2).join(', ')
                    : '-'}
                </span>
              </span>
              {chiefComplaint && (
                <span className="info-chip highlight">
                  <span className="chip-label">주호소</span>
                  <span className="chip-value">{chiefComplaint}</span>
                </span>
              )}
            </div>
          </section>
        )}
      </div>

      {/* 메인 컨텐츠: 3컬럼 그리드 */}
      <div className="main-content-grid three-column">
        {/* 컬럼 1: SOAP 노트 + 검사 오더 */}
        <div className="content-column soap-column">
          <section className="exam-section soap-section">
            <div className="section-header">
              <h4>
                <span className="section-icon edit">S</span>
                SOAP 노트
              </h4>
              <button
                className={`btn btn-sm ${soapSaved ? 'btn-success' : 'btn-primary'}`}
                onClick={handleSaveSOAP}
                disabled={savingSOAP || !encounterId}
              >
                {savingSOAP ? '저장 중...' : soapSaved ? '저장됨 ✓' : '저장'}
              </button>
            </div>
            {!encounterId ? (
              <div className="empty-message">진료 시작 후 작성 가능</div>
            ) : (
              <div className="soap-form compact">
                <div className="soap-field">
                  <label>S - 주관적 소견</label>
                  <textarea
                    value={soapData.subjective}
                    onChange={(e) => setSOAPData({ ...soapData, subjective: e.target.value })}
                    placeholder="환자가 호소하는 증상..."
                  />
                </div>
                <div className="soap-field">
                  <label>O - 객관적 소견</label>
                  <textarea
                    value={soapData.objective}
                    onChange={(e) => setSOAPData({ ...soapData, objective: e.target.value })}
                    placeholder="검사 결과, 관찰 소견..."
                  />
                </div>
                <div className="soap-field">
                  <label>A - 평가</label>
                  <textarea
                    value={soapData.assessment}
                    onChange={(e) => setSOAPData({ ...soapData, assessment: e.target.value })}
                    placeholder="진단, 감별진단..."
                  />
                </div>
                <div className="soap-field">
                  <label>P - 계획</label>
                  <textarea
                    value={soapData.plan}
                    onChange={(e) => setSOAPData({ ...soapData, plan: e.target.value })}
                    placeholder="치료 계획, 처방..."
                  />
                </div>
              </div>
            )}
          </section>

          {/* 검사 오더 - SOAP 아래로 이동 */}
          <section className="exam-section order-card">
            <div className="section-header">
              <h4>
                <span className="card-icon">📋</span>
                검사 오더
                <span className="order-counts">
                  <span className="pending-count">
                    {ocsList.filter(o => ['ORDERED', 'ACCEPTED', 'IN_PROGRESS'].includes(o.ocs_status)).length}
                  </span>
                  /
                  <span className="completed-count">
                    {ocsList.filter(o => ['RESULT_READY', 'CONFIRMED'].includes(o.ocs_status)).length}
                  </span>
                </span>
              </h4>
              <button
                className="btn btn-sm btn-primary"
                onClick={() => navigate(`/ocs/create?patientId=${patientId}`)}
                disabled={!patientId || patientId <= 0}
              >
                + 새 오더
              </button>
            </div>
            {ocsList.length === 0 ? (
              <div className="empty-message">등록된 오더가 없습니다.</div>
            ) : (
              <div className="order-list">
                {ocsList.slice(0, 6).map((ocs) => {
                  const isConfirmed = ocs.ocs_status === 'CONFIRMED';
                  const ocsAIResults = getAIResultsForOCS(ocs.id);

                  return (
                    <div key={ocs.id} className="order-item-wrapper">
                      <div
                        className="order-item"
                        onClick={() => {
                          if (ocs.job_role === 'RIS') {
                            navigate(`/ocs/ris/${ocs.id}`);
                          } else if (ocs.job_role === 'LIS') {
                            navigate(`/ocs/lis/${ocs.id}`);
                          }
                        }}
                      >
                        <div className="order-item-content">
                          <div className="order-item-title">
                            <span className={`job-role-badge ${ocs.job_role.toLowerCase()}`}>
                              {JOB_ROLE_LABELS[ocs.job_role] || ocs.job_role}
                            </span>
                            {JOB_TYPE_LABELS[ocs.job_type] || ocs.job_type}
                          </div>
                          <div className="order-item-subtitle">
                            {ocs.ocs_id} | {ocs.created_at?.slice(0, 10)}
                          </div>
                        </div>
                        <span className={`status-badge ${ocs.ocs_status.toLowerCase()}`}>
                          {OCS_STATUS_LABELS[ocs.ocs_status] || ocs.ocs_status}
                        </span>
                      </div>

                      {/* CONFIRMED 상태일 때 검사결과/AI결과 버튼 표시 */}
                      {isConfirmed && (
                        <div className="order-item-actions">
                          {ocs.job_role === 'RIS' && (
                            <button
                              className="btn btn-sm btn-outline"
                              onClick={(e) => {
                                e.stopPropagation();
                                handleOpenDicomViewer(ocs.id);
                              }}
                            >
                              영상 조회
                            </button>
                          )}
                          <button
                            className="btn btn-sm btn-outline"
                            onClick={(e) => {
                              e.stopPropagation();
                              if (ocs.job_role === 'RIS') {
                                navigate(`/ocs/ris/${ocs.id}?tab=result`);
                              } else {
                                navigate(`/ocs/lis/${ocs.id}?tab=result`);
                              }
                            }}
                          >
                            검사결과
                          </button>
                          {ocsAIResults.length > 0 && (
                            <button
                              className="btn btn-sm btn-primary"
                              onClick={(e) => {
                                e.stopPropagation();
                                navigate(`/ai/requests/${ocsAIResults[0].request_id}`);
                              }}
                            >
                              AI결과 ({ocsAIResults.length})
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
                {ocsList.length > 6 && (
                  <div className="more-link" onClick={() => navigate(`/ocs/manage?patientId=${patientId}`)}>
                    +{ocsList.length - 6}개 더 보기
                  </div>
                )}
              </div>
            )}
          </section>

          {/* AI 추론 섹션 (읽기 전용) */}
          <section className="exam-section ai-inference-card">
            <div className="section-header">
              <h4>
                <span className="card-icon">🤖</span>
                AI 추론
              </h4>
            </div>

            {/* 수동 추론 요청 버튼 */}
            <div className="ai-action-button">
              <button
                className="btn btn-primary btn-block"
                onClick={() => setShowAnalysisPopup(true)}
                disabled={!patientId || patientId <= 0}
              >
                수동 추론 요청
              </button>
              <p className="ai-action-hint">
                검사 완료 시 AI 추론이 자동으로 실행됩니다.
                수동으로 추론 요청이 필요한 경우 위 버튼을 클릭하세요.
              </p>
            </div>

            {/* AI 최근 추론 결과 (읽기 전용) */}
            <div className="ai-results-list">
              <h5 className="subsection-title">
                <span className="subsection-icon ai">AI</span>
                AI 최근 추론 결과
                <span className="subsection-count">({aiRequests.length})</span>
              </h5>
              {aiRequests.length === 0 ? (
                <div className="empty-message small">AI 추론 이력이 없습니다.</div>
              ) : (
                <div className="result-list compact">
                  {aiRequests.slice(0, 5).map((req) => (
                    <div
                      key={req.request_id}
                      className="result-item ai-request-item"
                      onClick={() => navigate(`/ai/requests/${req.request_id}`)}
                    >
                      <div className="result-item-content">
                        <span className="result-type">{req.model_name}</span>
                        <span className="result-date">{req.requested_at?.slice(0, 10)}</span>
                      </div>
                      <span className={`status-badge mini ${req.status.toLowerCase()}`}>
                        {req.status_display}
                      </span>
                    </div>
                  ))}
                  {aiRequests.length > 5 && (
                    <div
                      className="more-link"
                      onClick={() => navigate(`/ai/requests?patientId=${patientId}`)}
                    >
                      +{aiRequests.length - 5}건 더 보기
                    </div>
                  )}
                </div>
              )}
            </div>
          </section>
        </div>

        <div className="content-column middle-column">
          {/* 처방 카드 */}
          <PrescriptionCard
            patientId={patientId}
            encounter={encounter}
            onPrescriptionCreated={() => setPrescriptionRefreshKey((k) => k + 1)}
          />

          
          {/* 최근 이력 - 검사 오더 위치로 이동 */}
          {summary && (
            <section className="exam-section history-section compact">
              <h4>
                <span className="section-icon history">H</span>
                최근 이력
              </h4>
              <div className="history-tabs">
                <div className="history-tab-content">
                  {/* 최근 진료 */}
                  <div className="history-mini-list">
                    <h5>진료 ({summary.recent_encounters?.length || 0})</h5>
                    {summary.recent_encounters?.length === 0 ? (
                      <div className="empty-message small">기록 없음</div>
                    ) : (
                      <ul className="history-list mini">
                        {summary.recent_encounters?.slice(0, 3).map((enc) => (
                          <li key={enc.id}>
                            <span className="date">{enc.encounter_date?.split('T')[0]}</span>
                            <span className="type">{enc.encounter_type_display}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* 최근 검사 */}
                  <div className="history-mini-list">
                    <h5>검사</h5>
                    <div className="ocs-inline">
                      <span className="ocs-badge ris">RIS {summary.recent_ocs?.ris?.length || 0}</span>
                      <span className="ocs-badge lis">LIS {summary.recent_ocs?.lis?.length || 0}</span>
                    </div>
                  </div>
                </div>
              </div>
            </section>
          )}  
          
        </div>

        <div className="content-column past-column">
          
          {/* 진료 캘린더 */}
          <CalendarCard
            patientId={patientId}
            encounters={encounters}
            onDateSelect={setSelectedDate}
            selectedDate={selectedDate}
          />
          
          <div className="past-column-header">
            <h4>과거 기록</h4>
          </div>
          {patientId > 0 ? (
            <>
              {/* 과거 진료 기록 */}
              <PastRecordCard
                patientId={patientId}
                encounters={encounters}
                highlightDate={selectedDate}
              />

              {/* 과거 처방 기록 */}
              <PastPrescriptionCard patientId={patientId} refreshKey={prescriptionRefreshKey + recordRefreshKey} />
            </>
          ) : (
            <div className="empty-column-message">
              환자를 선택하면 과거 기록이 표시됩니다.
            </div>
          )}
        </div>
        
        <div className="content-column order-column">
          {/* 금일 예약 환자 목록 */}
          <section className="exam-section appointment-card">
            <TodayAppointmentCard onPatientSelect={onPatientChange} />
          </section>

          {/* 금일 진료완료 환자 목록 */}
          <section className="exam-section appointment-card">
            <TodayCompletedCard onPatientSelect={onPatientChange} />
          </section>
        </div>

      </div>

      {/* Alert 추가/편집 모달 */}
      {showAlertModal && (
        <AlertModal
          alertData={editingAlert}
          onClose={() => setShowAlertModal(false)}
          onSave={handleSaveAlert}
        />
      )}

      {/* AI 분석 요청 모달 */}
      <AIAnalysisPopup
        isOpen={showAnalysisPopup}
        onClose={() => setShowAnalysisPopup(false)}
        patientId={patientId}
      />
    </div>
  );
}

// Alert 모달 컴포넌트 (인라인)
interface AlertModalProps {
  alertData: PatientAlert | null;
  onClose: () => void;
  onSave: (data: PatientAlertCreateData) => void;
}

function AlertModal({ alertData, onClose, onSave }: AlertModalProps) {
  const [formData, setFormData] = useState<PatientAlertCreateData>({
    alert_type: alertData?.alert_type || 'PRECAUTION',
    severity: alertData?.severity || 'MEDIUM',
    title: alertData?.title || '',
    description: alertData?.description || '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.title.trim()) {
      window.alert('제목을 입력하세요.');
      return;
    }
    onSave(formData);
  };

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>{alertData ? '주의사항 편집' : '주의사항 추가'}</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>유형</label>
            <select
              value={formData.alert_type}
              onChange={(e) => setFormData({ ...formData, alert_type: e.target.value as AlertType })}
            >
              <option value="ALLERGY">알러지</option>
              <option value="CONTRAINDICATION">금기</option>
              <option value="PRECAUTION">주의</option>
              <option value="OTHER">기타</option>
            </select>
          </div>
          <div className="form-group">
            <label>심각도</label>
            <select
              value={formData.severity}
              onChange={(e) => setFormData({ ...formData, severity: e.target.value as AlertSeverity })}
            >
              <option value="HIGH">높음</option>
              <option value="MEDIUM">중간</option>
              <option value="LOW">낮음</option>
            </select>
          </div>
          <div className="form-group">
            <label>제목 *</label>
            <input
              type="text"
              value={formData.title}
              onChange={(e) => setFormData({ ...formData, title: e.target.value })}
              placeholder="예: 페니실린 알러지"
            />
          </div>
          <div className="form-group">
            <label>설명</label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData({ ...formData, description: e.target.value })}
              placeholder="추가 설명..."
              rows={3}
            />
          </div>
          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              저장
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
