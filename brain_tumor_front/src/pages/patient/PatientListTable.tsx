import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Patient, PatientStatus, PatientSeverity } from '@/types/patient';
import { PATIENT_STATUS_LABELS, PATIENT_SEVERITY_LABELS } from '@/types/patient';

type Props = {
  role: string;
  patients: Patient[];
  onEdit: (patient: Patient) => void;
  onDelete: (patient: Patient) => void;
  onResetFilters?: () => void;
};

// role에 따른 테이블 컬럼 매핑 컴포넌트
export default function PatientListTable({ role, patients, onEdit, onDelete, onResetFilters }: Props) {
  const navigate = useNavigate();
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canEdit = role === 'DOCTOR' || role === 'NURSE' || isSystemManager;
  const canStartCare = role === 'DOCTOR' || isSystemManager;

  // 더보기 메뉴 상태
  const [openMenuId, setOpenMenuId] = useState<number | null>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // 외부 클릭 시 메뉴 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpenMenuId(null);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const getGenderShort = (gender: string) => {
    const genderMap: Record<string, string> = {
      'M': '남',
      'F': '여',
      'O': '기타',
    };
    return genderMap[gender] || gender;
  };

  const getStatusInfo = (status: PatientStatus) => {
    const statusConfig: Record<PatientStatus, { icon: string; className: string }> = {
      active: { icon: '🟢', className: 'status-active' },
      discharged: { icon: '🔵', className: 'status-discharged' },
      transferred: { icon: '🟡', className: 'status-transferred' },
      deceased: { icon: '🔴', className: 'status-deceased' },
    };
    return {
      ...statusConfig[status],
      text: PATIENT_STATUS_LABELS[status] || status,
    };
  };

  const getSeverityInfo = (severity: PatientSeverity) => {
    const severityConfig: Record<PatientSeverity, { color: string; bgColor: string }> = {
      normal: { color: '#388e3c', bgColor: '#e8f5e9' },
      mild: { color: '#1976d2', bgColor: '#e3f2fd' },
      moderate: { color: '#f57c00', bgColor: '#fff3e0' },
      severe: { color: '#d32f2f', bgColor: '#ffebee' },
      critical: { color: '#7b1fa2', bgColor: '#f3e5f5' },
    };
    return {
      ...severityConfig[severity],
      text: PATIENT_SEVERITY_LABELS[severity] || severity,
    };
  };

  const getBloodTypeStyle = (bloodType: string | null) => {
    if (!bloodType) return { backgroundColor: '#f5f5f5', color: '#999' };

    const type = bloodType.replace(/[+-]/, '');
    const colorMap: Record<string, { bg: string; color: string }> = {
      'A': { bg: '#e3f2fd', color: '#1976d2' },
      'B': { bg: '#fff3e0', color: '#f57c00' },
      'O': { bg: '#e8f5e9', color: '#388e3c' },
      'AB': { bg: '#fce4ec', color: '#c2185b' },
    };
    return {
      backgroundColor: colorMap[type]?.bg || '#f5f5f5',
      color: colorMap[type]?.color || '#666',
    };
  };

  const handleMenuToggle = (e: React.MouseEvent, patientId: number) => {
    e.stopPropagation();
    setOpenMenuId(openMenuId === patientId ? null : patientId);
  };

  const handleStartCare = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    navigate(`/patientsCare?patientId=${patient.id}`);
  };

  const handleEditClick = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onEdit(patient);
  };

  const handleDeleteClick = (e: React.MouseEvent, patient: Patient) => {
    e.stopPropagation();
    setOpenMenuId(null);
    onDelete(patient);
  };

  // 빈 상태 UI
  if (patients.length === 0) {
    return (
      <div className="patient-empty-state">
        <div className="empty-icon">📋</div>
        <h3 className="empty-title">등록된 환자가 없습니다</h3>
        <p className="empty-description">
          검색 조건을 변경하거나 새 환자를 등록해보세요.
        </p>
        {onResetFilters && (
          <button className="btn secondary" onClick={onResetFilters}>
            필터 초기화
          </button>
        )}
      </div>
    );
  }

  return (
    <table className="table patient-table">
      {/* 컬럼 폭 고정을 위한 colgroup */}
      <colgroup>
        <col className="col-patient-info" />
        <col className="col-gender-age" />
        <col className="col-phone" />
        <col className="col-blood-type" />
        <col className="col-severity" />
        <col className="col-status" />
        <col className="col-date" />
        <col className="col-actions" />
      </colgroup>
      <thead>
        <tr>
          <th>환자 정보</th>
          <th>성별/나이</th>
          <th>연락처</th>
          <th>혈액형</th>
          <th>중증도</th>
          <th>상태</th>
          <th>등록일</th>
          <th>작업</th>
        </tr>
      </thead>

      <tbody>
        {patients.map(p => {
          const statusInfo = getStatusInfo(p.status);
          const severityInfo = getSeverityInfo(p.severity);
          const bloodTypeStyle = getBloodTypeStyle(p.blood_type);

          const handleRowClick = () => navigate(`/patients/${p.id}`);

          return (
            <tr
              key={p.id}
              className="patient-row clickable-row"
            >
              {/* 환자 정보 (이름 + 번호) */}
              <td onClick={handleRowClick}>
                <div className="patient-info-cell">
                  <span className="patient-name">{p.name}</span>
                  <span className="patient-number">{p.patient_number}</span>
                </div>
              </td>

              {/* 성별/나이 */}
              <td onClick={handleRowClick}>
                <div className="gender-age-cell">
                  <span className="gender">{getGenderShort(p.gender)}</span>
                  <span className="separator">/</span>
                  <span className="age">{p.age}세</span>
                </div>
              </td>

              {/* 연락처 */}
              <td onClick={handleRowClick}>{p.phone}</td>

              {/* 혈액형 Badge */}
              <td onClick={handleRowClick}>
                <span
                  className="blood-type-badge"
                  style={bloodTypeStyle}
                >
                  {p.blood_type || '-'}
                </span>
              </td>

              {/* 중증도 Badge */}
              <td onClick={handleRowClick}>
                <span
                  className="severity-badge"
                  style={{
                    backgroundColor: severityInfo.bgColor,
                    color: severityInfo.color,
                  }}
                >
                  {severityInfo.text}
                </span>
              </td>

              {/* 상태 (아이콘 + 텍스트) */}
              <td onClick={handleRowClick}>
                <span className={`patient-status ${statusInfo.className}`}>
                  <span className="status-icon">{statusInfo.icon}</span>
                  <span className="status-text">{statusInfo.text}</span>
                </span>
              </td>

              {/* 등록일 */}
              <td className="date-cell" onClick={handleRowClick}>
                {new Date(p.created_at).toLocaleDateString('ko-KR')}
              </td>

              {/* 작업 영역 - 클릭 이벤트 없음 */}
              <td>
                <div className="action-buttons">
                  {/* 진료 시작 버튼 (주요 액션) */}
                  {canStartCare && p.status === 'active' && (
                    <button
                      className="btn small primary"
                      onClick={(e) => handleStartCare(e, p)}
                    >
                      진료 시작
                    </button>
                  )}

                  {/* 더보기 메뉴 */}
                  {canEdit && (
                    <div className="more-menu-container" ref={openMenuId === p.id ? menuRef : null}>
                      <button
                        className="btn small more-menu-btn"
                        onClick={(e) => handleMenuToggle(e, p.id)}
                        aria-label="더보기"
                      >
                        ⋯
                      </button>

                      {openMenuId === p.id && (
                        <div className="more-menu-dropdown">
                          <button
                            className="menu-item"
                            onClick={(e) => handleEditClick(e, p)}
                          >
                            ✏️ 편집
                          </button>
                          <button
                            className="menu-item danger"
                            onClick={(e) => handleDeleteClick(e, p)}
                          >
                            🗑️ 삭제
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}
