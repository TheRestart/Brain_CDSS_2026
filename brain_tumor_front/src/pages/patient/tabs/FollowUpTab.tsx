/**
 * 환자 경과 추적 탭
 * - 경과 기록 목록 및 추가
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'react-router-dom';
import {
  getPatientFollowUps,
  createFollowUp,
  deleteFollowUp,
} from '@/services/followup.api';
import type { FollowUp, FollowUpCreateData } from '@/services/followup.api';
import './FollowUpTab.css';

type Props = {
  role: string;
};

// 경과 유형 라벨 (백엔드와 일치)
const FOLLOWUP_TYPE_LABELS: Record<string, string> = {
  routine: '정기 추적',
  symptom_based: '증상 기반',
  post_treatment: '치료 후 추적',
  emergency: '응급 내원',
};

// 임상 상태 라벨 (백엔드와 일치)
const CLINICAL_STATUS_LABELS: Record<string, string> = {
  stable: '안정',
  improved: '호전',
  deteriorated: '악화',
  recurrence: '재발',
  progression: '진행',
  remission: '관해',
};

// 임상 상태 색상
const CLINICAL_STATUS_COLORS: Record<string, string> = {
  stable: 'status-stable',
  improved: 'status-improved',
  deteriorated: 'status-deteriorated',
  recurrence: 'status-recurrence',
  progression: 'status-deteriorated',
  remission: 'status-improved',
};

export default function FollowUpTab({ role }: Props) {
  const { patientId } = useParams();
  const isDoctor = role === 'DOCTOR' || role === 'SYSTEMMANAGER';

  const [followUps, setFollowUps] = useState<FollowUp[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [selectedRecord, setSelectedRecord] = useState<FollowUp | null>(null);

  // 경과 기록 목록 조회
  const fetchFollowUps = useCallback(async () => {
    if (!patientId) return;

    setLoading(true);
    setError(null);

    try {
      const data = await getPatientFollowUps(Number(patientId));
      setFollowUps(data);
    } catch (err) {
      console.error('Failed to fetch follow-ups:', err);
      setError('경과 기록을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [patientId]);

  useEffect(() => {
    fetchFollowUps();
  }, [fetchFollowUps]);

  // 경과 기록 생성
  const handleCreate = async (data: FollowUpCreateData) => {
    try {
      await createFollowUp({ ...data, patient: Number(patientId) });
      setShowCreateModal(false);
      fetchFollowUps();
    } catch (err) {
      console.error('Failed to create follow-up:', err);
      alert('경과 기록 생성에 실패했습니다.');
    }
  };

  // 경과 기록 삭제
  const handleDelete = async (id: number) => {
    if (!confirm('이 경과 기록을 삭제하시겠습니까?')) return;
    try {
      await deleteFollowUp(id);
      setSelectedRecord(null);
      fetchFollowUps();
    } catch (err) {
      console.error('Failed to delete follow-up:', err);
      alert('경과 기록 삭제에 실패했습니다.');
    }
  };

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
    });
  };

  if (loading) {
    return <div className="followup-tab loading">로딩 중...</div>;
  }

  if (error) {
    return <div className="followup-tab error">{error}</div>;
  }

  return (
    <div className="followup-tab">
      {/* 헤더 */}
      <div className="tab-header">
        <h3>경과 추적</h3>
        {isDoctor && (
          <button className="btn btn-primary" onClick={() => setShowCreateModal(true)}>
            + 경과 기록 추가
          </button>
        )}
      </div>

      {/* 경과 기록 목록 */}
      {followUps.length === 0 ? (
        <div className="empty-state">
          <p>등록된 경과 기록이 없습니다.</p>
          {isDoctor && <p>새 경과 기록을 추가해주세요.</p>}
        </div>
      ) : (
        <div className="followup-timeline">
          {followUps.map((record) => (
            <div
              key={record.id}
              className={`timeline-item ${selectedRecord?.id === record.id ? 'selected' : ''}`}
              onClick={() => setSelectedRecord(selectedRecord?.id === record.id ? null : record)}
            >
              <div className="timeline-marker"></div>
              <div className="timeline-content">
                <div className="record-header">
                  <div className="record-date">{formatDate(record.followup_date)}</div>
                  <div className="record-badges">
                    <span className="type-badge">
                      {FOLLOWUP_TYPE_LABELS[record.followup_type] || record.followup_type_display || record.followup_type}
                    </span>
                    <span className={`status-badge ${CLINICAL_STATUS_COLORS[record.clinical_status]}`}>
                      {CLINICAL_STATUS_LABELS[record.clinical_status] || record.clinical_status_display || record.clinical_status}
                    </span>
                  </div>
                </div>

                <div className="record-info">
                  {/* 활력 징후 */}
                  <div className="vitals-row">
                    {record.kps_score !== null && (
                      <span className="vital-item">KPS: {record.kps_score}</span>
                    )}
                    {record.ecog_score !== null && (
                      <span className="vital-item">ECOG: {record.ecog_score}</span>
                    )}
                    {record.weight_kg !== null && (
                      <span className="vital-item">체중: {record.weight_kg}kg</span>
                    )}
                    {record.vitals && Object.keys(record.vitals).length > 0 && (
                      <>
                        {record.vitals.bp_systolic && record.vitals.bp_diastolic && (
                          <span className="vital-item">
                            BP: {String(record.vitals.bp_systolic)}/{String(record.vitals.bp_diastolic)}
                          </span>
                        )}
                      </>
                    )}
                  </div>

                  {record.symptoms && record.symptoms.length > 0 && (
                    <div className="info-row">
                      <span className="label">증상:</span>
                      <span>{Array.isArray(record.symptoms) ? record.symptoms.join(', ') : record.symptoms}</span>
                    </div>
                  )}

                  <div className="info-row">
                    <span className="label">기록자:</span>
                    <span>{record.recorded_by_name}</span>
                  </div>
                </div>

                {/* 확장된 상세 정보 */}
                {selectedRecord?.id === record.id && (
                  <div className="record-detail">
                    {record.note && (
                      <div className="detail-section">
                        <h5>경과 기록</h5>
                        <p>{record.note}</p>
                      </div>
                    )}
                    {record.next_followup_date && (
                      <div className="detail-section">
                        <h5>다음 방문 예정</h5>
                        <p>{formatDate(record.next_followup_date)}</p>
                      </div>
                    )}

                    {/* 액션 버튼 */}
                    {isDoctor && (
                      <div className="record-actions">
                        <button
                          className="btn btn-danger btn-sm"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(record.id);
                          }}
                        >
                          삭제
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* 생성 모달 */}
      {showCreateModal && (
        <CreateFollowUpModal
          onClose={() => setShowCreateModal(false)}
          onCreate={handleCreate}
        />
      )}
    </div>
  );
}

// 경과 기록 생성 모달
function CreateFollowUpModal({
  onClose,
  onCreate,
}: {
  onClose: () => void;
  onCreate: (data: FollowUpCreateData) => void;
}) {
  const [formData, setFormData] = useState<Partial<FollowUpCreateData>>({
    followup_date: new Date().toISOString().split('T')[0],
    followup_type: 'routine',
    clinical_status: 'stable',
    note: '',
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.followup_date) {
      alert('경과 기록 날짜를 입력해주세요.');
      return;
    }
    if (!formData.clinical_status) {
      alert('임상 상태를 선택해주세요.');
      return;
    }
    onCreate(formData as FollowUpCreateData);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <h3>경과 기록 추가</h3>
        <form onSubmit={handleSubmit}>
          <div className="form-row">
            <div className="form-group">
              <label>날짜 *</label>
              <input
                type="datetime-local"
                value={formData.followup_date}
                onChange={(e) => setFormData({ ...formData, followup_date: e.target.value })}
                required
              />
            </div>
            <div className="form-group">
              <label>유형</label>
              <select
                value={formData.followup_type}
                onChange={(e) => setFormData({ ...formData, followup_type: e.target.value })}
              >
                {Object.entries(FOLLOWUP_TYPE_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>임상 상태 *</label>
            <select
              value={formData.clinical_status}
              onChange={(e) => setFormData({ ...formData, clinical_status: e.target.value })}
              required
            >
              {Object.entries(CLINICAL_STATUS_LABELS).map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>KPS 점수</label>
              <input
                type="number"
                min="0"
                max="100"
                step="10"
                value={formData.kps_score || ''}
                onChange={(e) => setFormData({ ...formData, kps_score: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0-100"
              />
            </div>
            <div className="form-group">
              <label>ECOG 점수</label>
              <input
                type="number"
                min="0"
                max="5"
                value={formData.ecog_score || ''}
                onChange={(e) => setFormData({ ...formData, ecog_score: e.target.value ? Number(e.target.value) : undefined })}
                placeholder="0-5"
              />
            </div>
          </div>

          <div className="form-group">
            <label>체중 (kg)</label>
            <input
              type="number"
              step="0.1"
              value={formData.weight_kg || ''}
              onChange={(e) => setFormData({ ...formData, weight_kg: e.target.value ? Number(e.target.value) : undefined })}
            />
          </div>

          <div className="form-group">
            <label>경과 기록</label>
            <textarea
              value={formData.note || ''}
              onChange={(e) => setFormData({ ...formData, note: e.target.value })}
              placeholder="경과 내용을 기록하세요"
              rows={3}
            />
          </div>

          <div className="form-group">
            <label>다음 방문 예정일</label>
            <input
              type="date"
              value={formData.next_followup_date || ''}
              onChange={(e) => setFormData({ ...formData, next_followup_date: e.target.value })}
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
