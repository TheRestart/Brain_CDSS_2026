import { useState, useEffect } from 'react';
import PatientListTable from './PatientListTable';
import PatientCreateModal from './PatientCreateModal';
import PatientEditModal from './PatientEditModal';
import PatientDeleteModal from './PatientDeleteModal';
import Pagination from '@/layout/Pagination';
import { useAuth } from '../auth/AuthProvider';
import { getPatients } from '@/services/patient.api';
import type { Patient, PatientSearchParams, Gender, PatientStatus } from '@/types/patient';
import '@/assets/style/patientListView.css';

export default function PatientListPage() {
  const { role } = useAuth();
  const isSystemManager = role === 'SYSTEMMANAGER';

  const [page, setPage] = useState(1);
  const [pageSize] = useState(20);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(false);

  // Filter states
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<PatientStatus | ''>('');
  const [genderFilter, setGenderFilter] = useState<Gender | ''>('');

  // Modal states
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);

  if (!role) {
    return <div>접근 권한 정보 없음</div>;
  }

  // Fetch patients
  const fetchPatients = async () => {
    setLoading(true);
    try {
      const params: PatientSearchParams = {
        page,
        page_size: pageSize,
      };

      if (searchQuery) params.q = searchQuery;
      if (statusFilter) params.status = statusFilter as PatientStatus;
      if (genderFilter) params.gender = genderFilter as Gender;

      const response = await getPatients(params);
      setPatients(response?.results ?? []);
      setTotalCount(response?.count ?? 0);
    } catch (error) {
      console.error('Failed to fetch patients:', error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPatients();
  }, [page, searchQuery, statusFilter, genderFilter]);

  const totalPages = Math.ceil(totalCount / pageSize);

  const handleSearch = (e: React.ChangeEvent<HTMLInputElement>) => {
    setSearchQuery(e.target.value);
    setPage(1); // Reset to first page on search
  };

  const handleStatusChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setStatusFilter(e.target.value as PatientStatus | '');
    setPage(1);
  };

  const handleGenderChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    setGenderFilter(e.target.value as Gender | '');
    setPage(1);
  };

  // 필터 초기화
  const handleResetFilters = () => {
    setSearchQuery('');
    setStatusFilter('');
    setGenderFilter('');
    setPage(1);
  };

  // Modal handlers
  const handleEdit = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsEditModalOpen(true);
  };

  const handleDelete = (patient: Patient) => {
    setSelectedPatient(patient);
    setIsDeleteModalOpen(true);
  };

  const handleModalSuccess = () => {
    fetchPatients();
  };

  // Excel 내보내기
  const handleExportExcel = async () => {
    try {
      const { exportPatientList } = await import('@/utils/exportUtils');
      await exportPatientList(patients);
    } catch (error) {
      console.error('Excel 내보내기 실패:', error);
      alert('Excel 내보내기에 실패했습니다. xlsx 패키지가 설치되어 있는지 확인하세요.');
    }
  };

  return (
    <div className="page patient-list">
      {/* 검색 / 필터 영역 (환자 외의 역할에만 표시) */}
      {role !== 'PATIENT' && (
        <section className="filter-bar">
          <div className="filter-left">
            <strong className="patient-count">
              총 <span>{totalCount}</span>명의 환자
            </strong>
            <input
              placeholder="환자명 / 환자번호 / 전화번호"
              value={searchQuery}
              onChange={handleSearch}
            />
            <select value={statusFilter} onChange={handleStatusChange}>
              <option value="">전체 상태</option>
              <option value="active">활성</option>
              <option value="deceased">사망</option>
            </select>
            <select value={genderFilter} onChange={handleGenderChange}>
              <option value="">전체 성별</option>
              <option value="M">남성</option>
              <option value="F">여성</option>
              <option value="O">기타</option>
            </select>
          </div>
          <div className="filter-right">
            {isSystemManager && (
              <button className="btn secondary" onClick={handleExportExcel}>
                Excel 내보내기
              </button>
            )}
            {(role === 'DOCTOR' || role === 'NURSE' || isSystemManager) && (
              <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}>
                환자 등록
              </button>
            )}
          </div>
        </section>
      )}

      {/* 환자 리스트 테이블 */}
      <section className="content">
        {loading ? (
          <div>로딩 중...</div>
        ) : (
          <PatientListTable
            role={role}
            patients={patients}
            onEdit={handleEdit}
            onDelete={handleDelete}
            onResetFilters={handleResetFilters}
          />
        )}
      </section>

      {/* 페이징 */}
      <section className="pagination-bar">
        <Pagination
          currentPage={page}
          totalPages={totalPages}
          onChange={setPage}
          pageSize={pageSize}
        />
      </section>

      {/* 환자 등록 모달 */}
      <PatientCreateModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleModalSuccess}
      />

      {/* 환자 수정 모달 */}
      <PatientEditModal
        isOpen={isEditModalOpen}
        patient={selectedPatient}
        onClose={() => {
          setIsEditModalOpen(false);
          setSelectedPatient(null);
        }}
        onSuccess={handleModalSuccess}
      />

      {/* 환자 삭제 확인 모달 */}
      <PatientDeleteModal
        isOpen={isDeleteModalOpen}
        patient={selectedPatient}
        onClose={() => {
          setIsDeleteModalOpen(false);
          setSelectedPatient(null);
        }}
        onSuccess={handleModalSuccess}
      />

    </div>
  );
}
