/**
 * PatientAlertsSection - 환자 주의사항 섹션
 * - 알러지, 금기, 주의사항 등 표시
 * - 의사만 편집 가능
 */
import { useState } from 'react';
import type {
  PatientAlert,
  AlertType,
  AlertSeverity,
} from '@/types/patient';

interface PatientAlertsSectionProps {
  alerts: PatientAlert[];
  canEdit: boolean;
  onAddAlert: () => void;
  onEditAlert: (alert: PatientAlert) => void;
  onDeleteAlert: (alertId: number) => void;
}

// 심각도별 색상
const SEVERITY_COLORS: Record<AlertSeverity, { bg: string; text: string; border: string }> = {
  HIGH: { bg: '#ffebee', text: '#c62828', border: '#ef9a9a' },
  MEDIUM: { bg: '#fff3e0', text: '#e65100', border: '#ffcc80' },
  LOW: { bg: '#e3f2fd', text: '#1565c0', border: '#90caf9' },
};

// 타입별 아이콘
const TYPE_ICONS: Record<AlertType, string> = {
  ALLERGY: '🚨',
  CONTRAINDICATION: '⛔',
  PRECAUTION: '⚠️',
  OTHER: '📌',
};

export default function PatientAlertsSection({
  alerts,
  canEdit,
  onAddAlert,
  onEditAlert,
  onDeleteAlert,
}: PatientAlertsSectionProps) {
  const [expandedId, setExpandedId] = useState<number | null>(null);

  // 활성화된 알림만 필터링 (비활성화된 것도 의사에게는 표시)
  const activeAlerts = alerts.filter((a) => a.is_active);
  const inactiveAlerts = alerts.filter((a) => !a.is_active);

  const toggleExpand = (id: number) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const renderAlertItem = (alert: PatientAlert) => {
    const colors = SEVERITY_COLORS[alert.severity];
    const icon = TYPE_ICONS[alert.alert_type];
    const isExpanded = expandedId === alert.id;

    return (
      <div
        key={alert.id}
        className={`alert-item ${!alert.is_active ? 'inactive' : ''}`}
        style={{
          backgroundColor: alert.is_active ? colors.bg : '#f5f5f5',
          borderColor: alert.is_active ? colors.border : '#e0e0e0',
        }}
      >
        <div className="alert-header" onClick={() => toggleExpand(alert.id)}>
          <div className="alert-icon">{icon}</div>
          <div className="alert-content">
            <div className="alert-title-row">
              <span
                className="alert-type-badge"
                style={{ color: alert.is_active ? colors.text : '#999' }}
              >
                {alert.alert_type_display || alert.alert_type}
              </span>
              <span
                className="alert-severity-badge"
                style={{
                  backgroundColor: alert.is_active ? colors.text : '#999',
                  color: '#fff',
                }}
              >
                {alert.severity_display || alert.severity}
              </span>
            </div>
            <div className="alert-title">{alert.title}</div>
          </div>
          <div className="alert-actions">
            {canEdit && (
              <>
                <button
                  className="btn-icon"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEditAlert(alert);
                  }}
                  title="편집"
                >
                  ✏️
                </button>
                <button
                  className="btn-icon btn-delete"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (confirm('이 주의사항을 삭제하시겠습니까?')) {
                      onDeleteAlert(alert.id);
                    }
                  }}
                  title="삭제"
                >
                  🗑️
                </button>
              </>
            )}
            <span className="expand-icon">{isExpanded ? '▼' : '▶'}</span>
          </div>
        </div>
        {isExpanded && (
          <div className="alert-details">
            {alert.description && <p className="alert-description">{alert.description}</p>}
            <div className="alert-meta">
              <span>등록: {alert.created_by_name || '알 수 없음'}</span>
              <span>{alert.created_at?.split('T')[0]}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <section className="patient-alerts-section">
      <div className="section-header">
        <h3>
          환자 주의사항
          {activeAlerts.length > 0 && (
            <span className="alert-count">{activeAlerts.length}</span>
          )}
        </h3>
        {canEdit && (
          <button className="btn btn-sm btn-primary" onClick={onAddAlert}>
            + 추가
          </button>
        )}
      </div>

      <div className="alerts-list">
        {activeAlerts.length === 0 && inactiveAlerts.length === 0 ? (
          <div className="empty-message">등록된 주의사항이 없습니다.</div>
        ) : (
          <>
            {activeAlerts.map(renderAlertItem)}
            {canEdit && inactiveAlerts.length > 0 && (
              <div className="inactive-section">
                <div className="inactive-divider">비활성화된 주의사항 ({inactiveAlerts.length})</div>
                {inactiveAlerts.map(renderAlertItem)}
              </div>
            )}
          </>
        )}
      </div>

      <style>{`
        .patient-alerts-section {
          background: var(--bg-primary, #fff);
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          overflow: hidden;
        }
        .section-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 12px 16px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #fafafa);
        }
        .section-header h3 {
          margin: 0;
          font-size: 15px;
          font-weight: 600;
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .alert-count {
          display: inline-flex;
          align-items: center;
          justify-content: center;
          min-width: 20px;
          height: 20px;
          padding: 0 6px;
          background: #f44336;
          color: #fff;
          font-size: 11px;
          font-weight: 600;
          border-radius: 10px;
        }
        .alerts-list {
          padding: 8px;
        }
        .alert-item {
          border: 1px solid;
          border-radius: 6px;
          margin-bottom: 8px;
          overflow: hidden;
          transition: all 0.15s ease;
        }
        .alert-item:last-child {
          margin-bottom: 0;
        }
        .alert-item.inactive {
          opacity: 0.6;
        }
        .alert-header {
          display: flex;
          align-items: center;
          padding: 10px 12px;
          cursor: pointer;
          gap: 10px;
        }
        .alert-header:hover {
          filter: brightness(0.97);
        }
        .alert-icon {
          font-size: 18px;
        }
        .alert-content {
          flex: 1;
        }
        .alert-title-row {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 2px;
        }
        .alert-type-badge {
          font-size: 11px;
          font-weight: 600;
        }
        .alert-severity-badge {
          font-size: 10px;
          font-weight: 500;
          padding: 1px 6px;
          border-radius: 3px;
        }
        .alert-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-primary, #1a1a1a);
        }
        .alert-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
        .btn-icon {
          background: none;
          border: none;
          cursor: pointer;
          padding: 4px;
          font-size: 14px;
          opacity: 0.7;
          transition: opacity 0.15s;
        }
        .btn-icon:hover {
          opacity: 1;
        }
        .expand-icon {
          font-size: 10px;
          color: var(--text-secondary, #666);
          margin-left: 4px;
        }
        .alert-details {
          padding: 0 12px 12px 44px;
          border-top: 1px solid rgba(0,0,0,0.1);
          margin-top: -4px;
          padding-top: 12px;
        }
        .alert-description {
          margin: 0 0 8px 0;
          font-size: 13px;
          color: var(--text-secondary, #666);
          white-space: pre-wrap;
        }
        .alert-meta {
          display: flex;
          gap: 16px;
          font-size: 11px;
          color: var(--text-tertiary, #999);
        }
        .empty-message {
          padding: 24px;
          text-align: center;
          color: var(--text-secondary, #666);
          font-size: 13px;
        }
        .inactive-section {
          margin-top: 16px;
        }
        .inactive-divider {
          font-size: 11px;
          color: var(--text-secondary, #666);
          padding: 8px 0;
          border-top: 1px dashed var(--border-color, #e0e0e0);
          margin-bottom: 8px;
        }
      `}</style>
    </section>
  );
}
