import { useState, useEffect } from 'react';
import { useAuth } from '@/pages/auth/AuthProvider';
import { getEncounters } from '@/services/encounter.api';
import type { Encounter, EncounterSearchParams, EncounterType, EncounterStatus, Department, SortConfig, SortField, TimeFilter } from '@/types/encounter';
import EncounterListTable from './EncounterListTable';
import EncounterCreateModal from './EncounterCreateModal';
import EncounterEditModal from './EncounterEditModal';
import EncounterDeleteModal from './EncounterDeleteModal';
import Pagination from '@/layout/Pagination';

export type WidgetSize = 'compact' | 'medium' | 'full';

export interface EncounterListWidgetProps {
  /** 위젯 제목 (기본값: 진료 목록) */
  title?: string;
  /** 위젯 크기: compact(5행), medium(10행), full(20행) */
  size?: WidgetSize;
  /** 페이지네이션 표시 여부 */
  showPagination?: boolean;
  /** 필터바 표시 여부 */
  showFilters?: boolean;
  /** 생성 버튼 표시 여부 */
  showCreateButton?: boolean;
  /** 정렬 기능 활성화 */
  sortable?: boolean;
  /** 초기 필터: 진료유형 */
  defaultEncounterType?: EncounterType;
  /** 초기 필터: 상태 */
  defaultStatus?: EncounterStatus;
  /** 초기 필터: 진료과 */
  defaultDepartment?: Department;
  /** 초기 필터: 환자 ID */
  patientId?: number;
  /** 초기 필터: 담당의사 ID */
  attendingDoctorId?: number;
  /** 카드 스타일 적용 */
  asCard?: boolean;
  /** 외부 클래스명 */
  className?: string;
  /** 데이터 변경 시 콜백 */
  onDataChange?: (encounters: Encounter[]) => void;
  /** 행 클릭 시 콜백 */
  onRowClick?: (encounter: Encounter) => void;
}

const PAGE_SIZE_MAP: Record<WidgetSize, number> = {
  compact: 5,
  medium: 10,
  full: 20,
};

export default function EncounterListWidget({
  title = '진료 목록',
  size = 'full',
  showPagination = true,
  showFilters = true,
  showCreateButton = true,
  sortable = true,
  defaultEncounterType,
  defaultStatus,
  defaultDepartment,
  patientId,
  attendingDoctorId,
  asCard = false,
  className = '',
  onDataChange,
  onRowClick,
}: EncounterListWidgetProps) {
  const { role } = useAuth();
  const isDoctor = role === 'DOCTOR';
  const isNurse = role === 'NURSE';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canCreate = showCreateButton && (isDoctor || isNurse || isSystemManager);

  // Pagination
  const pageSize = PAGE_SIZE_MAP[size];
  const [page, setPage] = useState(1);
  const [totalCount, setTotalCount] = useState(0);

  // Data
  const [encounters, setEncounters] = useState<Encounter[]>([]);
  const [loading, setLoading] = useState(false);

  // Search & Filters
  const [searchQuery, setSearchQuery] = useState('');
  const [encounterTypeFilter, setEncounterTypeFilter] = useState<EncounterType | ''>(defaultEncounterType || '');
  const [statusFilter, setStatusFilter] = useState<EncounterStatus | ''>(defaultStatus || '');
  const [departmentFilter, setDepartmentFilter] = useState<Department | ''>(defaultDepartment || '');
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // Sorting
  const [sortConfig, setSortConfig] = useState<SortConfig | null>(null);

  // Modals
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedEncounter, setSelectedEncounter] = useState<Encounter | null>(null);

  // Fetch encounters
  const fetchEncounters = async () => {
    setLoading(true);
    try {
      let ordering: string | undefined;
      if (sortConfig) {
        ordering = sortConfig.direction === 'desc' ? `-${sortConfig.field}` : sortConfig.field;
      }

      const params: EncounterSearchParams = {
        page,
        page_size: pageSize,
        ...(searchQuery && { q: searchQuery }),
        ...(encounterTypeFilter && { encounter_type: encounterTypeFilter }),
        ...(statusFilter && { status: statusFilter }),
        ...(departmentFilter && { department: departmentFilter }),
        ...(patientId && { patient: patientId }),
        ...(attendingDoctorId && { attending_doctor: attendingDoctorId }),
        ...(ordering && { ordering }),
        ...(timeFilter !== 'all' && { time_filter: timeFilter }),
      };

      const response = await getEncounters(params);

      let data: Encounter[] = [];
      let count = 0;

      if (Array.isArray(response)) {
        data = response;
        count = response.length;
      } else {
        data = response.results || [];
        count = response.count || 0;
      }

      setEncounters(data);
      setTotalCount(count);
      onDataChange?.(data);
    } catch (error: any) {
      console.error('Failed to fetch encounters:', error);
      setEncounters([]);
      setTotalCount(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEncounters();
  }, [page, searchQuery, encounterTypeFilter, statusFilter, departmentFilter, sortConfig, patientId, attendingDoctorId, timeFilter]);

  // Handle search
  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    fetchEncounters();
  };

  // Handle create
  const handleCreateClick = () => {
    setIsCreateModalOpen(true);
  };

  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    fetchEncounters();
  };

  // Handle edit
  const handleEditClick = (encounter: Encounter) => {
    setSelectedEncounter(encounter);
    setIsEditModalOpen(true);
  };

  const handleEditSuccess = () => {
    setIsEditModalOpen(false);
    setSelectedEncounter(null);
    fetchEncounters();
  };

  // Handle delete
  const handleDeleteClick = (encounter: Encounter) => {
    setSelectedEncounter(encounter);
    setIsDeleteModalOpen(true);
  };

  const handleDeleteSuccess = () => {
    setIsDeleteModalOpen(false);
    setSelectedEncounter(null);
    fetchEncounters();
  };

  // Reset filters
  const handleResetFilters = () => {
    setSearchQuery('');
    setEncounterTypeFilter(defaultEncounterType || '');
    setStatusFilter(defaultStatus || '');
    setDepartmentFilter(defaultDepartment || '');
    setTimeFilter('all');
    setSortConfig(null);
    setPage(1);
  };

  // Handle status change (간호사용)
  const handleStatusChange = () => {
    // 상태 변경 후 목록 새로고침
    fetchEncounters();
  };

  // Handle sort
  const handleSort = (field: SortField) => {
    if (!sortable) return;
    setSortConfig((prev) => {
      if (prev?.field === field) {
        if (prev.direction === 'asc') {
          return { field, direction: 'desc' };
        }
        return null;
      }
      return { field, direction: 'asc' };
    });
    setPage(1);
  };

  const wrapperClass = [
    'encounter-widget',
    asCard ? 'encounter-widget-card' : '',
    `encounter-widget-${size}`,
    className,
  ].filter(Boolean).join(' ');

  return (
    <div className={wrapperClass}>
      {/* Header */}
      {(title || showFilters || canCreate) && (
        <div className="encounter-widget-header">
          {title && <h3 className="encounter-widget-title">{title}</h3>}

          {showFilters && (
            <div className="encounter-widget-filters">
              <form onSubmit={handleSearch} className="encounter-widget-search">
                <input
                  type="text"
                  placeholder="환자명, 환자번호, 주호소 검색"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                />
                <button type="submit" className="btn primary small">검색</button>
              </form>

              <select
                value={encounterTypeFilter}
                onChange={(e) => {
                  setEncounterTypeFilter(e.target.value as EncounterType | '');
                  setPage(1);
                }}
              >
                <option value="">전체 진료유형</option>
                <option value="outpatient">외래</option>
                <option value="inpatient">입원</option>
                <option value="emergency">응급</option>
              </select>

              <select
                value={statusFilter}
                onChange={(e) => {
                  setStatusFilter(e.target.value as EncounterStatus | '');
                  setPage(1);
                }}
              >
                <option value="">전체 상태</option>
                <option value="scheduled">예정</option>
                <option value="in_progress">진행중</option>
                <option value="completed">완료</option>
                <option value="cancelled">취소</option>
              </select>

              <select
                value={departmentFilter}
                onChange={(e) => {
                  setDepartmentFilter(e.target.value as Department | '');
                  setPage(1);
                }}
              >
                <option value="">전체 진료과</option>
                <option value="neurology">신경과</option>
                <option value="neurosurgery">신경외과</option>
              </select>

              <select
                value={timeFilter}
                onChange={(e) => {
                  setTimeFilter(e.target.value as TimeFilter);
                  setPage(1);
                }}
              >
                <option value="all">전체 시간</option>
                <option value="past">지난 시간</option>
                <option value="future">이후 시간</option>
              </select>

              <button className="btn small" onClick={handleResetFilters}>
                필터 초기화
              </button>
            </div>
          )}

          {canCreate && (
            <button className="btn primary" onClick={handleCreateClick}>
              진료 등록
            </button>
          )}
        </div>
      )}

      {/* Content */}
      <div className="encounter-widget-content">
        {loading ? (
          <div className="encounter-widget-loading">로딩 중...</div>
        ) : (
          <EncounterListTable
            role={role || ''}
            encounters={encounters}
            onEdit={handleEditClick}
            onDelete={handleDeleteClick}
            onResetFilters={handleResetFilters}
            sortConfig={sortable ? sortConfig : null}
            onSort={sortable ? handleSort : undefined}
            onRowClick={onRowClick}
            onStatusChange={handleStatusChange}
          />
        )}
      </div>

      {/* Footer */}
      {showPagination && totalCount > pageSize && (
        <div className="encounter-widget-footer">
          <Pagination
            currentPage={page}
            totalCount={totalCount}
            pageSize={pageSize}
            onPageChange={setPage}
          />
        </div>
      )}

      {/* Modals */}
      {isCreateModalOpen && (
        <EncounterCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {isEditModalOpen && selectedEncounter && (
        <EncounterEditModal
          isOpen={isEditModalOpen}
          onClose={() => {
            setIsEditModalOpen(false);
            setSelectedEncounter(null);
          }}
          onSuccess={handleEditSuccess}
          encounter={selectedEncounter}
        />
      )}

      {isDeleteModalOpen && selectedEncounter && (
        <EncounterDeleteModal
          isOpen={isDeleteModalOpen}
          onClose={() => {
            setIsDeleteModalOpen(false);
            setSelectedEncounter(null);
          }}
          onSuccess={handleDeleteSuccess}
          encounter={selectedEncounter}
        />
      )}
    </div>
  );
}
