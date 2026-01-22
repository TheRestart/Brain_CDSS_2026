/**
 * EncounterNoteCard - 진료 SOAP 노트 카드
 * - 진료별 SOAP 기록 표시/편집
 * - 의사만 편집 가능
 */
import { useState } from 'react';
import type { Encounter } from '@/types/encounter';

interface EncounterNoteCardProps {
  encounter: Encounter;
  canEdit: boolean;
  onSave: (encounterId: number, data: SOAPData) => Promise<void>;
}

export interface SOAPData {
  subjective?: string;
  objective?: string;
  assessment?: string;
  plan?: string;
}

const SOAP_FIELDS = [
  { key: 'subjective' as const, label: 'S - 주관적 증상', placeholder: '환자가 호소하는 증상...' },
  { key: 'objective' as const, label: 'O - 객관적 소견', placeholder: '검사 결과, 관찰 소견...' },
  { key: 'assessment' as const, label: 'A - 평가', placeholder: '진단, 감별진단...' },
  { key: 'plan' as const, label: 'P - 계획', placeholder: '치료 계획, 처방...' },
];

export default function EncounterNoteCard({
  encounter,
  canEdit,
  onSave,
}: EncounterNoteCardProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formData, setFormData] = useState<SOAPData>({
    subjective: encounter.subjective || '',
    objective: encounter.objective || '',
    assessment: encounter.assessment || '',
    plan: encounter.plan || '',
  });

  // SOAP 내용이 있는지 확인
  const hasContent = encounter.subjective || encounter.objective || encounter.assessment || encounter.plan;

  const handleSave = async () => {
    setSaving(true);
    try {
      await onSave(encounter.id, formData);
      setIsEditing(false);
    } catch (err) {
      console.error('Failed to save SOAP note:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  const handleCancel = () => {
    setFormData({
      subjective: encounter.subjective || '',
      objective: encounter.objective || '',
      assessment: encounter.assessment || '',
      plan: encounter.plan || '',
    });
    setIsEditing(false);
  };

  const formatDate = (dateStr?: string) => {
    if (!dateStr) return '-';
    return dateStr.split('T')[0];
  };

  return (
    <div className={`encounter-note-card ${isExpanded ? 'expanded' : ''}`}>
      {/* 헤더 */}
      <div className="card-header" onClick={() => setIsExpanded(!isExpanded)}>
        <div className="header-left">
          <span className={`status-dot ${encounter.status}`}></span>
          <div className="encounter-info">
            <span className="encounter-date">{formatDate(encounter.encounter_date || encounter.admission_date)}</span>
            <span className="encounter-type">{encounter.encounter_type_display || encounter.encounter_type}</span>
            {encounter.attending_doctor_name && (
              <span className="doctor-name">{encounter.attending_doctor_name}</span>
            )}
          </div>
        </div>
        <div className="header-right">
          {hasContent && <span className="has-note-badge">SOAP</span>}
          <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
        </div>
      </div>

      {/* 확장된 내용 */}
      {isExpanded && (
        <div className="card-content">
          {/* 주호소 */}
          {encounter.chief_complaint && (
            <div className="chief-complaint">
              <strong>주호소:</strong> {encounter.chief_complaint}
            </div>
          )}

          {/* SOAP 섹션 */}
          {isEditing ? (
            <div className="soap-form">
              {SOAP_FIELDS.map((field) => (
                <div key={field.key} className="soap-field">
                  <label>{field.label}</label>
                  <textarea
                    value={formData[field.key] || ''}
                    onChange={(e) =>
                      setFormData({ ...formData, [field.key]: e.target.value })
                    }
                    placeholder={field.placeholder}
                    rows={3}
                  />
                </div>
              ))}
              <div className="form-actions">
                <button
                  className="btn btn-secondary"
                  onClick={handleCancel}
                  disabled={saving}
                >
                  취소
                </button>
                <button
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving ? '저장 중...' : '저장'}
                </button>
              </div>
            </div>
          ) : (
            <div className="soap-view">
              {SOAP_FIELDS.map((field) => {
                const value = encounter[field.key];
                if (!value && !canEdit) return null;
                return (
                  <div key={field.key} className="soap-item">
                    <div className="soap-label">{field.label}</div>
                    <div className="soap-value">
                      {value || <span className="empty-value">-</span>}
                    </div>
                  </div>
                );
              })}
              {canEdit && (
                <div className="view-actions">
                  <button
                    className="btn btn-sm btn-outline"
                    onClick={() => setIsEditing(true)}
                  >
                    편집
                  </button>
                </div>
              )}
              {!hasContent && !canEdit && (
                <div className="empty-message">SOAP 기록이 없습니다.</div>
              )}
            </div>
          )}
        </div>
      )}

      <style>{`
        .encounter-note-card {
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          margin-bottom: 8px;
          background: var(--bg-primary, #fff);
          overflow: hidden;
          transition: all 0.15s ease;
        }
        .encounter-note-card:hover {
          border-color: var(--primary, #1976d2);
        }
        .encounter-note-card.expanded {
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }
        .card-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 14px;
          cursor: pointer;
          background: var(--bg-secondary, #fafafa);
        }
        .card-header:hover {
          background: #f0f0f0;
        }
        .header-left {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .status-dot {
          width: 8px;
          height: 8px;
          border-radius: 50%;
          background: #9e9e9e;
        }
        .status-dot.completed {
          background: #4caf50;
        }
        .status-dot.in_progress {
          background: #ff9800;
        }
        .status-dot.scheduled {
          background: #2196f3;
        }
        .status-dot.cancelled {
          background: #f44336;
        }
        .encounter-info {
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 13px;
        }
        .encounter-date {
          font-weight: 600;
          color: var(--text-primary, #1a1a1a);
        }
        .encounter-type {
          color: var(--text-secondary, #666);
          padding: 2px 6px;
          background: #e3f2fd;
          border-radius: 3px;
          font-size: 11px;
        }
        .doctor-name {
          color: var(--text-secondary, #666);
        }
        .header-right {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .has-note-badge {
          font-size: 10px;
          font-weight: 600;
          padding: 2px 6px;
          background: #c8e6c9;
          color: #2e7d32;
          border-radius: 3px;
        }
        .expand-icon {
          font-size: 10px;
          color: var(--text-secondary, #666);
        }
        .card-content {
          padding: 16px;
          border-top: 1px solid var(--border-color, #e0e0e0);
        }
        .chief-complaint {
          font-size: 13px;
          padding: 10px 12px;
          background: #fff8e1;
          border-radius: 4px;
          margin-bottom: 16px;
        }
        .chief-complaint strong {
          color: #f57c00;
        }
        .soap-form {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .soap-field label {
          display: block;
          font-size: 12px;
          font-weight: 600;
          color: var(--text-secondary, #666);
          margin-bottom: 4px;
        }
        .soap-field textarea {
          width: 100%;
          padding: 10px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 4px;
          font-size: 13px;
          font-family: inherit;
          resize: vertical;
        }
        .soap-field textarea:focus {
          outline: none;
          border-color: var(--primary, #1976d2);
        }
        .form-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          margin-top: 8px;
        }
        .soap-view {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .soap-item {
          border-left: 3px solid var(--primary, #1976d2);
          padding-left: 12px;
        }
        .soap-label {
          font-size: 11px;
          font-weight: 600;
          color: var(--primary, #1976d2);
          margin-bottom: 2px;
        }
        .soap-value {
          font-size: 13px;
          color: var(--text-primary, #1a1a1a);
          white-space: pre-wrap;
        }
        .empty-value {
          color: var(--text-tertiary, #999);
        }
        .view-actions {
          display: flex;
          justify-content: flex-end;
          margin-top: 8px;
        }
        .btn-outline {
          background: transparent;
          border: 1px solid var(--primary, #1976d2);
          color: var(--primary, #1976d2);
        }
        .btn-outline:hover {
          background: #e3f2fd;
        }
        .empty-message {
          text-align: center;
          color: var(--text-secondary, #666);
          padding: 16px;
          font-size: 13px;
        }
      `}</style>
    </div>
  );
}
