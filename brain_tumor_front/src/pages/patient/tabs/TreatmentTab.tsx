/**
 * 환자 치료 계획 탭
 * - 치료 계획 목록 및 세션 관리
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPatientTreatmentPlans,
  createTreatmentPlan,
  startTreatmentPlan,
  completeTreatmentPlan,
  cancelTreatmentPlan,
} from '@/services/treatment.api';
import type { TreatmentPlan, TreatmentPlanCreateData } from '@/services/treatment.api';
import './TreatmentTab.css';

type Props = {
  role: string;
};

// 치료 유형 라벨
const TREATMENT_TYPE_LABELS: Record<string, string> = {
  surgery: '수술',
  radiation: '방사선 치료',
  chemotherapy: '항암 치료',
  observation: '경과 관찰',
  combined: '복합 치료',
};

// 치료 목표 라벨
const TREATMENT_GOAL_LABELS: Record<string, string> = {
  curative: '완치 목적',
  palliative: '완화 목적',
  adjuvant: '보조 요법',
  neoadjuvant: '선행 요법',
};

// 상태 라벨
const STATUS_LABELS: Record<string, string> = {
  planned: '계획됨',
  in_progress: '진행 중',
  completed: '완료',
  cancelled: '취소됨',
  on_hold: '보류 중',
};

// 상태 색상
const STATUS_COLORS: Record<string, string> = {
  planned: 'status-planned',
  in_progress: 'status-active',
  completed: 'status-completed',
  cancelled: 'status-cancelled',
  on_hold: 'status-draft',
};

export default function TreatmentTab({ role }: Props) {
  const { patientId } = useParams();
  const isDoctor = role === 'DOCTOR' || role === 'SYSTEMMANAGER';

  const [plans, setPlans] = useState<TreatmentPlan[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState<TreatmentPlan | null>(null);

  // 치료 계획 목록 조회
  const fetchPlans = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getPatientTreatmentPlans(Number(patientId));
      setPlans(data);
    } catch (err) {
      console.error('Failed to fetch treatment plans:', err);
      setError('치료 계획을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  // 치료 계획 생성
  const handleCreate = async (data: TreatmentPlanCreateData) => {
    try {
      await createTreatmentPlan({ ...data, patient: Number(patientId) });
      setShowCreateModal(false);
      fetchPlans();
    } catch (err) {
      console.error('Failed to create treatment plan:', err);
      alert('치료 계획 생성에 실패했습니다.');
    }
  };

  // 치료 시작
  const handleStart = async (id: number) => {
    if (!confirm('치료를 시작하시겠습니까?')) return;
    try {
      await startTreatmentPlan(id);
      fetchPlans();
    } catch (err) {
      console.error('Failed to start treatment:', err);
      alert('치료 시작에 실패했습니다.');
    }
  };

  // 치료 완료
  const handleComplete = async (id: number) => {
    if (!confirm('치료를 완료 처리하시겠습니까?')) return;
    try {
      await completeTreatmentPlan(id);
      fetchPlans();
    } catch (err) {
      console.error('Failed to complete treatment:', err);
      alert('치료 완료 처리에 실패했습니다.');
    }
  };

  // 치료 취소
  const handleCancel = async (id: number) => {
    if (!confirm('치료를 취소하시겠습니까?')) return;
    try {
      await cancelTreatmentPlan(id);
      fetchPlans();
    } catch (err) {
      console.error('Failed to cancel treatment:', err);
      alert('치료 취소에 실패했습니다.');
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  if (loading) {
    return <div className="treatment-tab loading">로딩 중...</div>;
  }

  if (error) {
    return <div className="treatment-tab error">{error}</div>;
  }

  return (
    <div className="treatment-tab">
      {/* 헤더 */}
      <div className="tab-header">
        <h3>치료 계획</h3>
        {isDoctor && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 새 치료 계획
          </button>
        )}
      </div>

      {/* 치료 계획 목록 */}
      {plans.length === 0 ? (
        <div className="empty-state">
          <p>등록된 치료 계획이 없습니다.</p>
          {isDoctor && <p>새 치료 계획을 생성해주세요.</p>}
        </div>
      ) : (
        <div className="plan-list">
          {plans.map((plan) => (
            <div
              key={plan.id}
              className={`plan-card ${selectedPlan?.id === plan.id ? 'selected' : ''}`}
              onClick={() => setSelectedPlan(selectedPlan?.id === plan.id ? null : plan)}
            >
              <div className="plan-header">
                <div className="plan-title">
                  <span className={`type-badge type-${plan.treatment_type}`}>
                    {TREATMENT_TYPE_LABELS[plan.treatment_type] || plan.treatment_type}
                  </span>
                  <h4>{plan.plan_summary}</h4>
                </div>
                <span className={`status-badge ${STATUS_COLORS[plan.status]}`}>
                  {STATUS_LABELS[plan.status] || plan.status}
                </span>
              </div>

              <div className="plan-info">
                <div className="info-row">
                  <span className="label">기간:</span>
                  <span>{formatDate(plan.start_date)} ~ {formatDate(plan.end_date)}</span>
                </div>
                <div className="info-row">
                  <span className="label">담당의:</span>
                  <span>{plan.planned_by_name}</span>
                </div>
                <div className="info-row">
                  <span className="label">치료 목표:</span>
                  <span>{TREATMENT_GOAL_LABELS[plan.treatment_goal] || plan.treatment_goal_display}</span>
                </div>
              </div>

              {/* 확장된 상세 정보 */}
              {selectedPlan?.id === plan.id && (
                <div className="plan-detail">
                  {plan.notes && (
                    <div className="detail-section">
                      <h5>비고</h5>
                      <p>{plan.notes}</p>
                    </div>
                  )}

                  {/* 세션 정보 */}
                  {plan.sessions && plan.sessions.length > 0 && (
                    <div className="detail-section">
                      <h5>치료 세션 ({plan.sessions.length}회)</h5>
                      <div className="session-list">
                        {plan.sessions.map((session) => (
                          <div key={session.id} className="session-item">
                            <span className="session-number">#{session.session_number}</span>
                            <span className="session-date">{formatDate(session.session_date)}</span>
                            <span className={`session-status status-${session.status}`}>
                              {session.status_display}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* 액션 버튼 */}
                  {isDoctor && (
                    <div className="plan-actions">
                      {plan.status === 'planned' && (
                        <button className="btn btn-success" onClick={() => handleStart(plan.id)}>
                          치료 시작
                        </button>
                      )}
                      {plan.status === 'in_progress' && (
                        <button className="btn btn-primary" onClick={() => handleComplete(plan.id)}>
                          치료 완료
                        </button>
                      )}
                      {['planned', 'on_hold'].includes(plan.status) && (
                        <button className="btn btn-danger" onClick={() => handleCancel(plan.id)}>
                          취소
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateTreatmentModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// 치료 계획 생성 모달
function CreateTreatmentModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: TreatmentPlanCreateData) => void;
}) {
  const [formData, setFormData] = useState<Partial<TreatmentPlanCreateData>>({
    treatment_type: 'surgery',
    treatment_goal: 'curative',
    plan_summary: '',
    notes: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.plan_summary) {
      alert('치료 계획 요약을 입력해주세요.');
      return;
    }
    if (!formData.treatment_goal) {
      alert('치료 목표를 선택해주세요.');
      return;
    }
    onCreate(formData as TreatmentPlanCreateData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>새 치료 계획</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-group">
            <label>치료 유형</label>
            <select
              value={formData.treatment_type}
              onChange={(e) => setFormData({ ...formData, treatment_type: e.target.value })}
            >
              {Object.entries(TREATMENT_TYPE_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>치료 목표 *</label>
            <select
              value={formData.treatment_goal}
              onChange={(e) => setFormData({ ...formData, treatment_goal: e.target.value })}
              required
            >
              {Object.entries(TREATMENT_GOAL_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-group">
            <label>치료 계획 요약 *</label>
            <textarea
              value={formData.plan_summary}
              onChange={(e) => setFormData({ ...formData, plan_summary: e.target.value })}
              placeholder="치료 계획 요약을 입력하세요"
              rows={3}
              required
            />
          </div>

          <div className="form-group">
            <label>비고</label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
              placeholder="추가 사항"
              rows={2}
            />
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작일</label>
              <input
                type="date"
                value={formData.start_date || ''}
                onChange={(e) => setFormData({ ...formData, start_date: e.target.value })}
              />
            </div>
            <div className="form-group">
              <label>종료일</label>
              <input
                type="date"
                value={formData.end_date || ''}
                onChange={(e) => setFormData({ ...formData, end_date: e.target.value })}
              />
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn btn-secondary" onClick={onClose}>
              취소
            </button>
            <button type="submit" className="btn btn-primary">
              생성
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
