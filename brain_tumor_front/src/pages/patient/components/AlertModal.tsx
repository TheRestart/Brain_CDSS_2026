/**
 * AlertModal - 환자 주의사항 추가/편집 모달
 */
import { useState, useEffect } from 'react';
import type {
  PatientAlert,
  PatientAlertCreateData,
  AlertType,
  AlertSeverity,
} from '@/types/patient';

interface AlertModalProps {
  isOpen: boolean;
  alert?: PatientAlert | null;  // null이면 새로 생성
  onClose: () => void;
  onSave: (data: PatientAlertCreateData, isUpdate: boolean, alertId?: number) => Promise<void>;
}

const ALERT_TYPES: { value: AlertType; label: string }[] = [
  { value: 'ALLERGY', label: '알러지' },
  { value: 'CONTRAINDICATION', label: '금기' },
  { value: 'PRECAUTION', label: '주의' },
  { value: 'OTHER', label: '기타' },
];

const SEVERITIES: { value: AlertSeverity; label: string; color: string }[] = [
  { value: 'HIGH', label: '높음', color: '#c62828' },
  { value: 'MEDIUM', label: '중간', color: '#e65100' },
  { value: 'LOW', label: '낮음', color: '#1565c0' },
];

export default function AlertModal({
  isOpen,
  alert,
  onClose,
  onSave,
}: AlertModalProps) {
  const [formData, setFormData] = useState<PatientAlertCreateData>({
    alert_type: 'PRECAUTION',
    severity: 'MEDIUM',
    title: '',
    description: '',
  });
  const [saving, setSaving] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  // 편집 모드일 때 기존 데이터로 초기화
  useEffect(() => {
    if (alert) {
      setFormData({
        alert_type: alert.alert_type,
        severity: alert.severity,
        title: alert.title,
        description: alert.description || '',
      });
    } else {
      setFormData({
        alert_type: 'PRECAUTION',
        severity: 'MEDIUM',
        title: '',
        description: '',
      });
    }
    setErrors({});
  }, [alert, isOpen]);

  if (!isOpen) return null;

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {};
    if (!formData.title.trim()) {
      newErrors.title = '제목을 입력하세요.';
    }
    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!validate()) return;

    setSaving(true);
    try {
      await onSave(formData, !!alert, alert?.id);
      onClose();
    } catch (err) {
      console.error('Failed to save alert:', err);
      setErrors({ submit: '저장에 실패했습니다.' });
    } finally {
      setSaving(false);
    }
  };

  const handleBackdropClick = (e: React.MouseEvent) => {
    if (e.target === e.currentTarget) {
      onClose();
    }
  };

  return (
    <div className="modal-backdrop" onClick={handleBackdropClick}>
      <div className="modal-content">
        <div className="modal-header">
          <h3>{alert ? '주의사항 편집' : '주의사항 추가'}</h3>
          <button className="btn-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {/* 타입 선택 */}
            <div className="form-group">
              <label>유형</label>
              <div className="type-buttons">
                {ALERT_TYPES.map((type) => (
                  <button
                    key={type.value}
                    type="button"
                    className={`type-btn ${formData.alert_type === type.value ? 'active' : ''}`}
                    onClick={() => setFormData({ ...formData, alert_type: type.value })}
                  >
                    {type.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 심각도 선택 */}
            <div className="form-group">
              <label>심각도</label>
              <div className="severity-buttons">
                {SEVERITIES.map((sev) => (
                  <button
                    key={sev.value}
                    type="button"
                    className={`severity-btn ${formData.severity === sev.value ? 'active' : ''}`}
                    style={{
                      '--severity-color': sev.color,
                    } as React.CSSProperties}
                    onClick={() => setFormData({ ...formData, severity: sev.value })}
                  >
                    {sev.label}
                  </button>
                ))}
              </div>
            </div>

            {/* 제목 */}
            <div className="form-group">
              <label>제목 *</label>
              <input
                type="text"
                value={formData.title}
                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                placeholder="예: 페니실린 알러지"
                className={errors.title ? 'error' : ''}
              />
              {errors.title && <span className="error-text">{errors.title}</span>}
            </div>

            {/* 설명 */}
            <div className="form-group">
              <label>상세 설명</label>
              <textarea
                value={formData.description}
                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                placeholder="추가 설명이 필요한 경우 입력..."
                rows={3}
              />
            </div>

            {errors.submit && <div className="error-banner">{errors.submit}</div>}
          </div>

          <div className="modal-footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={saving}>
              취소
            </button>
            <button type="submit" className="btn btn-primary" disabled={saving}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </form>
      </div>

      <style>{`
        .modal-backdrop {
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
        .modal-content {
          background: #fff;
          border-radius: 8px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow: hidden;
          display: flex;
          flex-direction: column;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.2);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
        }
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
        }
        .btn-close {
          background: none;
          border: none;
          font-size: 24px;
          cursor: pointer;
          color: var(--text-secondary, #666);
          padding: 0;
          line-height: 1;
        }
        .btn-close:hover {
          color: var(--text-primary, #1a1a1a);
        }
        .modal-body {
          padding: 20px;
          overflow-y: auto;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 600;
          color: var(--text-secondary, #666);
          margin-bottom: 8px;
        }
        .type-buttons,
        .severity-buttons {
          display: flex;
          gap: 8px;
        }
        .type-btn,
        .severity-btn {
          flex: 1;
          padding: 10px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          background: #fff;
          cursor: pointer;
          font-size: 13px;
          transition: all 0.15s ease;
        }
        .type-btn:hover,
        .severity-btn:hover {
          border-color: var(--primary, #1976d2);
        }
        .type-btn.active {
          background: var(--primary, #1976d2);
          border-color: var(--primary, #1976d2);
          color: #fff;
        }
        .severity-btn.active {
          background: var(--severity-color);
          border-color: var(--severity-color);
          color: #fff;
        }
        .form-group input,
        .form-group textarea {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 6px;
          font-size: 14px;
          font-family: inherit;
        }
        .form-group input:focus,
        .form-group textarea:focus {
          outline: none;
          border-color: var(--primary, #1976d2);
        }
        .form-group input.error,
        .form-group textarea.error {
          border-color: #f44336;
        }
        .form-group textarea {
          resize: vertical;
        }
        .error-text {
          display: block;
          color: #f44336;
          font-size: 12px;
          margin-top: 4px;
        }
        .error-banner {
          background: #ffebee;
          color: #c62828;
          padding: 10px 12px;
          border-radius: 4px;
          font-size: 13px;
          margin-top: 8px;
        }
        .modal-footer {
          display: flex;
          justify-content: flex-end;
          gap: 10px;
          padding: 16px 20px;
          border-top: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #fafafa);
        }
        .btn {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
          transition: all 0.15s ease;
        }
        .btn-primary {
          background: var(--primary, #1976d2);
          color: #fff;
        }
        .btn-primary:hover:not(:disabled) {
          background: #1565c0;
        }
        .btn-secondary {
          background: #e0e0e0;
          color: var(--text-primary, #1a1a1a);
        }
        .btn-secondary:hover:not(:disabled) {
          background: #bdbdbd;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
      `}</style>
    </div>
  );
}
