import { useState, useRef, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import type { Encounter, SortConfig, SortField, EncounterStatus } from '@/types/encounter';
import { EncounterStatusDropdown } from '@/components/encounter';

type Props = {
  role: string;
  encounters: Encounter[];
  onEdit: (encounter: Encounter) => void;
  onDelete: (encounter: Encounter) => void;
  onResetFilters?: () => void;
  sortConfig?: SortConfig | null;
  onSort?: (field: SortField) => void;
  /** 행 클릭 시 콜백 (설정 시 기본 진료 시작 동작 대체) */
  onRowClick?: (encounter: Encounter) => void;
  /** 상태 변경 시 콜백 (간호사용) */
  onStatusChange?: (encounterId: number, newStatus: EncounterStatus) => void;
};

export default function EncounterListTable({ role, encounters, onEdit, onDelete, onResetFilters, sortConfig, onSort, onRowClick, onStatusChange }: Props) {
  const navigate = useNavigate();
  const isDoctor = role === 'DOCTOR';
  const isNurse = role === 'NURSE';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canEdit = isDoctor || isSystemManager;
  const canCreateOCS = isDoctor || isSystemManager;
  const canStartTreatment = isDoctor || isSystemManager; // Nurse는 진료 시작 불가
  const canChangeStatus = isNurse || isSystemManager; // 간호사 또는 시스템관리자만 상태 변경 가능

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

  // 행 클릭 핸들러 - 진료 상세 페이지로 이동
  const handleRowClick = (encounter: Encounter) => {
    if (onRowClick) {
      onRowClick(encounter);
    } else {
      navigate(`/encounters/${encounter.id}`);
    }
  };

  // OCS 생성 페이지로 이동
  const handleCreateOCS = (encounter: Encounter) => {
    navigate(`/ocs/create?patientId=${encounter.patient}&encounterId=${encounter.id}`);
    setOpenMenuId(null);
  };

  // 편집
  const handleEdit = (encounter: Encounter) => {
    onEdit(encounter);
    setOpenMenuId(null);
  };

  // 삭제
  const handleDelete = (encounter: Encounter) => {
    onDelete(encounter);
    setOpenMenuId(null);
  };

  // 날짜 포맷: YYYY.MM.DD 오후 HH:MM
  const formatDateTime = (dateString: string | undefined): string => {
    if (!dateString) return '-';
    const date = new Date(dateString);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const day = String(date.getDate()).padStart(2, '0');
    const hours = date.getHours();
    const minutes = String(date.getMinutes()).padStart(2, '0');
    const ampm = hours >= 12 ? '오후' : '오전';
    const hour12 = hours % 12 || 12;
    return `${year}.${month}.${day} ${ampm} ${hour12}:${minutes}`;
  };

  // 상태 Badge 클래스
  const getStatusBadgeClass = (status: string) => {
    switch (status) {
      case 'scheduled':
        return 'status-badge status-scheduled';
      case 'in_progress':
        return 'status-badge status-in-progress';
      case 'completed':
        return 'status-badge status-completed';
      case 'cancelled':
        return 'status-badge status-cancelled';
      default:
        return 'status-badge';
    }
  };

  // 진료유형 Badge 클래스
  const getTypeBadgeClass = (type: string) => {
    switch (type) {
      case 'outpatient':
        return 'type-badge type-outpatient';
      case 'inpatient':
        return 'type-badge type-inpatient';
      case 'emergency':
        return 'type-badge type-emergency';
      default:
        return 'type-badge';
    }
  };

  // 진료 시작 가능 여부
  const canStartEncounter = (status: string) => {
    return status === 'scheduled' || status === 'in_progress';
  };

  // 시간 기준 환자 구분 (과거/미래)
  const isPastPatient = (admissionDate: string | undefined): boolean => {
    if (!admissionDate) return false;
    return new Date(admissionDate) < new Date();
  };

  // 행 클래스 계산
  const getRowClass = (encounter: Encounter): string => {
    const classes = ['encounter-row'];
    if (encounter.status === 'in_progress') {
      classes.push('row-in-progress');
    }
    // 시간 기준 스타일 (완료/취소 상태는 제외)
    if (encounter.status !== 'completed' && encounter.status !== 'cancelled') {
      if (isPastPatient(encounter.admission_date)) {
        classes.push('row-past');
      } else {
        classes.push('row-future');
      }
    }
    return classes.join(' ');
  };

  // 정렬 아이콘 렌더링
  const renderSortIcon = (field: SortField) => {
    if (!sortConfig || sortConfig.field !== field) {
      return <span className="sort-icon sort-none">⇅</span>;
    }
    if (sortConfig.direction === 'asc') {
      return <span className="sort-icon sort-asc">↑</span>;
    }
    return <span className="sort-icon sort-desc">↓</span>;
  };

  // 정렬 가능한 헤더 클릭 핸들러
  const handleSortClick = (field: SortField) => {
    if (onSort) {
      onSort(field);
    }
  };

  // Handle undefined encounters
  if (!encounters) {
    return (
      <table className="table encounter-table">
        <thead>
          <tr>
            <th>환자</th>
            <th>진료유형</th>
            <th>진료과</th>
            <th>담당의사</th>
            <th>입원일시</th>
            <th>퇴원일시</th>
            <th>상태</th>
            <th>주호소</th>
            <th className="action-column">작업</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={9} style={{ textAlign: 'center', padding: '2rem' }}>
              로딩 중...
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  // Empty State
  if (encounters.length === 0) {
    return (
      <div className="empty-state">
        <div className="empty-state-icon">📋</div>
        <p className="empty-state-text">조건에 맞는 진료 기록이 없습니다.</p>
        {onResetFilters && (
          <button className="btn" onClick={onResetFilters}>
            필터 초기화
          </button>
        )}
      </div>
    );
  }

  return (
    <table className="table encounter-table">
      <thead>
        <tr>
          <th>환자</th>
          <th>진료유형</th>
          <th>진료과</th>
          <th>담당의사</th>
          <th
            className={`sortable ${sortConfig?.field === 'admission_date' ? 'sorted' : ''}`}
            onClick={() => handleSortClick('admission_date')}
          >
            입원일시 {renderSortIcon('admission_date')}
          </th>
          <th>퇴원일시</th>
          <th
            className={`sortable ${sortConfig?.field === 'status' ? 'sorted' : ''}`}
            onClick={() => handleSortClick('status')}
          >
            상태 {renderSortIcon('status')}
          </th>
          <th>주호소</th>
          <th className="action-column">작업</th>
        </tr>
      </thead>

      <tbody>
        {encounters.map((e) => (
          <tr
            key={e.id}
            className={getRowClass(e)}
            onClick={() => handleRowClick(e)}
            style={{ cursor: 'pointer' }}
          >
            {/* 환자 식별 컬럼 (통합) */}
            <td className="patient-cell">
              <div className="patient-info">
                <span className="patient-name">{e.patient_name}</span>
                <span className="patient-number">{e.patient_number}</span>
              </div>
            </td>

            {/* 진료유형 Badge */}
            <td>
              <span className={getTypeBadgeClass(e.encounter_type)}>
                {e.encounter_type_display}
              </span>
            </td>

            {/* 진료과 */}
            <td>{e.department_display}</td>

            {/* 담당의사 */}
            <td>{e.attending_doctor_name}</td>

            {/* 입원일시 */}
            <td>{formatDateTime(e.admission_date)}</td>

            {/* 퇴원일시 - 입원중이 아닌 경우만 표시 */}
            <td>
              {e.status === 'in_progress' || !e.discharge_date ? (
                <span className="discharge-pending">-</span>
              ) : (
                formatDateTime(e.discharge_date)
              )}
            </td>

            {/* 상태 Badge 또는 드롭다운 */}
            <td onClick={(ev) => canChangeStatus && ev.stopPropagation()}>
              {canChangeStatus ? (
                <EncounterStatusDropdown
                  encounterId={e.id}
                  currentStatus={e.status}
                  onStatusChange={(newStatus) => onStatusChange?.(e.id, newStatus)}
                  compact
                />
              ) : (
                <span className={getStatusBadgeClass(e.status)}>
                  {e.status === 'scheduled' && '예약'}
                  {e.status === 'in_progress' && '입원중'}
                  {e.status === 'completed' && '완료'}
                  {e.status === 'cancelled' && '취소'}
                </span>
              )}
            </td>

            {/* 주호소 (말줄임 + tooltip) */}
            <td className="chief-complaint-cell" title={e.chief_complaint}>
              {e.chief_complaint}
            </td>

            {/* Action 컬럼 */}
            <td className="action-cell" onClick={(ev) => ev.stopPropagation()}>
              <div className="action-buttons">
                {/* Primary Action: 진료 시작 (진찰 페이지로 이동) - Nurse는 비활성화 */}
                {canStartTreatment && canStartEncounter(e.status) && (
                  <button
                    className="btn primary small"
                    onClick={() => navigate(`/patientsCare?patientId=${e.patient}&encounterId=${e.id}`)}
                  >
                    진료 시작
                  </button>
                )}

                {/* 더보기 메뉴 */}
                {(canCreateOCS || canEdit) && (
                  <div className="more-menu-wrapper" ref={openMenuId === e.id ? menuRef : null}>
                    <button
                      className="btn-more"
                      onClick={() => setOpenMenuId(openMenuId === e.id ? null : e.id)}
                      aria-label="더보기"
                    >
                      ⋯
                    </button>

                    {openMenuId === e.id && (
                      <div className="more-menu">
                        {canCreateOCS && (e.status === 'in_progress' || e.status === 'scheduled') && (
                          <button
                            className="more-menu-item"
                            onClick={() => handleCreateOCS(e)}
                          >
                            OCS 생성
                          </button>
                        )}
                        {canEdit && (
                          <button
                            className="more-menu-item"
                            onClick={() => handleEdit(e)}
                          >
                            편집
                          </button>
                        )}
                        {isSystemManager && (
                          <button
                            className="more-menu-item delete"
                            onClick={() => handleDelete(e)}
                          >
                            삭제
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}
