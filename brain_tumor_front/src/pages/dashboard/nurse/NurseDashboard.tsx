/**
 * 간호사 대시보드 (진료 접수 현황 통합)
 * - 오늘 접수 요약 카드
 * - 의사별 필터
 * - 오늘 접수 / 월간 진료 현황 탭
 * - 환자 목록 위젯
 */
import { useState, useEffect, useCallback, useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { getEncounters, getTodayEncounters } from '@/services/encounter.api';
import { fetchUsers } from '@/services/users.api';
import type { Encounter, EncounterSearchParams, EncounterStatus, TimeFilter } from '@/types/encounter';
import type { User } from '@/types/user';
import Pagination from '@/layout/Pagination';
import PatientListWidget from '../common/PatientListWidget';
import { UnifiedCalendar } from '@/components/calendar/UnifiedCalendar';
import EncounterCreateModal from '@/pages/encounter/EncounterCreateModal';
import PatientCreateModal from '@/pages/patient/PatientCreateModal';
import { DashboardHeader } from '../common/DashboardHeader';
import { EncounterStatusDropdown } from '@/components/encounter';
import '@/assets/style/patientListView.css';
import './NurseDashboard.css';

// 요약 카드 필터 타입
type SummaryFilterType = 'total' | 'scheduled' | 'in_progress' | 'completed' | null;

// 요약 카드 설정
const SUMMARY_CARD_CONFIG: Record<Exclude<SummaryFilterType, null>, { title: string; statusFilter?: EncounterStatus }> = {
  total: { title: '오늘 총 접수' },
  scheduled: { title: '대기중', statusFilter: 'scheduled' },
  in_progress: { title: '진행중', statusFilter: 'in_progress' },
  completed: { title: '완료', statusFilter: 'completed' },
};

// 날짜 포맷
const formatDate = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

const formatTime = (dateStr: string | undefined): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleTimeString('ko-KR', {
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 월별 범위 계산 (offset: -1=전월, 0=당월, 1=차월)
const getMonthRange = (offset: number = 0): { start: string; end: string; month: number; year: number } => {
  const now = new Date();
  const targetMonth = now.getMonth() + offset;
  const start = new Date(now.getFullYear(), targetMonth, 1);
  const end = new Date(now.getFullYear(), targetMonth + 1, 0);
  return {
    start: start.toISOString().split('T')[0],
    end: end.toISOString().split('T')[0],
    month: start.getMonth() + 1,
    year: start.getFullYear(),
  };
};

export default function NurseDashboard() {
  const navigate = useNavigate();

  // 탭 상태
  const [activeTab, setActiveTab] = useState<'today' | 'monthly'>('today');
  const [selectedDoctorId, setSelectedDoctorId] = useState<number | 'all'>('all');
  const [monthOffset, setMonthOffset] = useState<number | null>(0);
  const [timeFilter, setTimeFilter] = useState<TimeFilter>('all');

  // 진료 등록 모달 상태
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  // 환자 등록 모달 상태
  const [isPatientCreateModalOpen, setIsPatientCreateModalOpen] = useState(false);
  // 요약 카드 클릭 시 모달 상태
  const [summaryModalFilter, setSummaryModalFilter] = useState<SummaryFilterType>(null);

  // 의사 목록
  const [doctors, setDoctors] = useState<User[]>([]);

  // 오늘 접수 데이터
  const [todayEncounters, setTodayEncounters] = useState<Encounter[]>([]);
  const [todayLoading, setTodayLoading] = useState(false);

  // 월간 데이터
  const [monthlyEncounters, setMonthlyEncounters] = useState<Encounter[]>([]);
  const [monthlyPage, setMonthlyPage] = useState(1);
  const [monthlyTotalCount, setMonthlyTotalCount] = useState(0);
  const [monthlyLoading, setMonthlyLoading] = useState(false);
  const pageSize = 10;

  // 의사 목록 로드
  useEffect(() => {
    const loadDoctors = async () => {
      try {
        const response = await fetchUsers({ role__code: 'DOCTOR', is_active: true });
        setDoctors(response.results || []);
      } catch (error) {
        console.error('Failed to fetch doctors:', error);
      }
    };
    loadDoctors();
  }, []);

  // 시간 기준 환자 구분 헬퍼
  const isPastPatient = (admissionDate: string | undefined): boolean => {
    if (!admissionDate) return false;
    return new Date(admissionDate) < new Date();
  };

  // 오늘 접수 로드
  const loadTodayEncounters = useCallback(async () => {
    setTodayLoading(true);
    try {
      let encounters = await getTodayEncounters();
      encounters = encounters.filter(enc => enc.status !== 'cancelled');

      if (selectedDoctorId !== 'all') {
        encounters = encounters.filter(enc => enc.attending_doctor === selectedDoctorId);
      }

      // 시간 필터 적용
      if (timeFilter === 'past') {
        encounters = encounters.filter(enc => isPastPatient(enc.admission_date));
      } else if (timeFilter === 'future') {
        encounters = encounters.filter(enc => !isPastPatient(enc.admission_date));
      }

      setTodayEncounters(encounters);
    } catch (error) {
      console.error('Failed to fetch today encounters:', error);
    } finally {
      setTodayLoading(false);
    }
  }, [selectedDoctorId, timeFilter]);

  // 월간 로드
  const loadMonthlyEncounters = useCallback(async () => {
    setMonthlyLoading(true);
    try {
      const params: EncounterSearchParams = {
        page: monthlyPage,
        page_size: pageSize,
      };

      if (monthOffset !== null) {
        const { start, end } = getMonthRange(monthOffset);
        params.start_date = start;
        params.end_date = end;
      }

      if (selectedDoctorId !== 'all') {
        params.attending_doctor = selectedDoctorId;
      }

      // 시간 필터 적용 (백엔드 API 사용)
      if (timeFilter !== 'all') {
        params.time_filter = timeFilter;
      }

      const response = await getEncounters(params);
      let encounters: Encounter[] = [];
      if (Array.isArray(response)) {
        encounters = response;
        setMonthlyTotalCount(response.length);
      } else {
        encounters = response.results || [];
        setMonthlyTotalCount(response.count || 0);
      }

      encounters = encounters.filter(enc => enc.status !== 'cancelled');
      setMonthlyEncounters(encounters);
    } catch (error) {
      console.error('Failed to fetch monthly encounters:', error);
    } finally {
      setMonthlyLoading(false);
    }
  }, [selectedDoctorId, monthlyPage, monthOffset, timeFilter]);

  // 현재 선택된 월 정보
  const currentMonthInfo = useMemo(() => monthOffset !== null ? getMonthRange(monthOffset) : null, [monthOffset]);

  // 탭 변경 시 데이터 로드
  useEffect(() => {
    if (activeTab === 'today') {
      loadTodayEncounters();
    } else {
      loadMonthlyEncounters();
    }
  }, [activeTab, loadTodayEncounters, loadMonthlyEncounters]);

  // 오늘 상태별 집계
  const todaySummary = useMemo(() => {
    const summary = { total: todayEncounters.length, scheduled: 0, inProgress: 0, completed: 0 };
    todayEncounters.forEach((enc) => {
      if (enc.status === 'scheduled') summary.scheduled++;
      else if (enc.status === 'in_progress') summary.inProgress++;
      else if (enc.status === 'completed') summary.completed++;
    });
    return summary;
  }, [todayEncounters]);

  // 요약 모달에 표시할 필터링된 환자 목록
  const filteredEncountersForModal = useMemo(() => {
    if (!summaryModalFilter) return [];
    if (summaryModalFilter === 'total') return todayEncounters;
    const statusFilter = SUMMARY_CARD_CONFIG[summaryModalFilter]?.statusFilter;
    if (!statusFilter) return todayEncounters;
    return todayEncounters.filter(enc => enc.status === statusFilter);
  }, [summaryModalFilter, todayEncounters]);

  // 행 클릭
  const handleRowClick = (encounter: Encounter) => {
    navigate(`/patients/${encounter.patient}`);
  };

  // 진료 등록 성공 시 데이터 새로고침
  const handleCreateSuccess = () => {
    setIsCreateModalOpen(false);
    if (activeTab === 'today') {
      loadTodayEncounters();
    } else {
      loadMonthlyEncounters();
    }
  };

  // 환자 등록 성공 시
  const handlePatientCreateSuccess = () => {
    setIsPatientCreateModalOpen(false);
    // 환자 목록 위젯이 자체적으로 새로고침됨
  };

  // 상태 변경 성공 시 데이터 새로고침
  const handleStatusChange = () => {
    loadTodayEncounters(); // 요약 카드 업데이트를 위해 항상 오늘 데이터 새로고침
    if (activeTab === 'monthly') {
      loadMonthlyEncounters();
    }
  };

  // 요약 카드 클릭 핸들러
  const handleSummaryCardClick = (filterType: SummaryFilterType) => {
    setSummaryModalFilter(filterType);
  };

  // 요약 모달 닫기
  const handleCloseSummaryModal = () => {
    setSummaryModalFilter(null);
  };

  // 행 클래스 계산 (시간 기준 스타일)
  const getRowClass = (encounter: Encounter): string => {
    const classes = ['clickable-row'];
    // 완료/취소 상태가 아닌 경우에만 시간 기준 스타일 적용
    if (encounter.status !== 'completed' && encounter.status !== 'cancelled') {
      if (isPastPatient(encounter.admission_date)) {
        classes.push('row-past');
      } else {
        classes.push('row-future');
      }
    }
    return classes.join(' ');
  };

  const monthlyTotalPages = Math.ceil(monthlyTotalCount / pageSize);

  return (
    <div className="dashboard nurse nurse-dashboard">
      <DashboardHeader role="NURSE" />
      {/* 오늘 요약 카드 */}
      <section className="summary-cards nurse-summary">
        <div
          className="card summary total clickable"
          onClick={() => handleSummaryCardClick('total')}
        >
          <span className="title">오늘 총 접수</span>
          <strong className="value">{todaySummary.total}</strong>
        </div>
        <div
          className="card summary scheduled clickable"
          onClick={() => handleSummaryCardClick('scheduled')}
        >
          <span className="title">대기중</span>
          <strong className="value">{todaySummary.scheduled}</strong>
        </div>
        <div
          className="card summary in-progress clickable"
          onClick={() => handleSummaryCardClick('in_progress')}
        >
          <span className="title">진행중</span>
          <strong className="value">{todaySummary.inProgress}</strong>
        </div>
        <div
          className="card summary completed clickable"
          onClick={() => handleSummaryCardClick('completed')}
        >
          <span className="title">완료</span>
          <strong className="value">{todaySummary.completed}</strong>
        </div>
      </section>

      {/* 의사별 필터 */}
      <section className="doctor-filter">
        <button
          className={`doctor-tab ${selectedDoctorId === 'all' ? 'active' : ''}`}
          onClick={() => setSelectedDoctorId('all')}
        >
          전체 의사
        </button>
        {doctors.map((doctor) => (
          <button
            key={doctor.id}
            className={`doctor-tab ${selectedDoctorId === doctor.id ? 'active' : ''}`}
            onClick={() => setSelectedDoctorId(doctor.id)}
          >
            {doctor.name}
          </button>
        ))}
      </section>

      {/* 탭 메뉴 */}
      <nav className="tab-nav">
        <button
          className={activeTab === 'today' ? 'active' : ''}
          onClick={() => setActiveTab('today')}
        >
          오늘 접수 ({todaySummary.total})
        </button>
        <div className="month-nav-group">
          <button
            className={`month-nav-btn ${activeTab === 'monthly' && monthOffset === null ? 'active' : ''}`}
            onClick={() => { setActiveTab('monthly'); setMonthOffset(null); setMonthlyPage(1); }}
          >
            전체
          </button>
          <button
            className={`month-nav-btn ${activeTab === 'monthly' && monthOffset === -1 ? 'active' : ''}`}
            onClick={() => { setActiveTab('monthly'); setMonthOffset(-1); setMonthlyPage(1); }}
          >
            전월 ({getMonthRange(-1).month}월)
          </button>
          <button
            className={`month-nav-btn ${activeTab === 'monthly' && monthOffset === 0 ? 'active' : ''}`}
            onClick={() => { setActiveTab('monthly'); setMonthOffset(0); setMonthlyPage(1); }}
          >
            당월 ({getMonthRange(0).month}월)
          </button>
          <button
            className={`month-nav-btn ${activeTab === 'monthly' && monthOffset === 1 ? 'active' : ''}`}
            onClick={() => { setActiveTab('monthly'); setMonthOffset(1); setMonthlyPage(1); }}
          >
            차월 ({getMonthRange(1).month}월)
          </button>
        </div>
      </nav>

      {/* 메인 콘텐츠 */}
      <div className="dashboard-main">
        {/* 접수 테이블 */}
        <section className="card reception-content">
          {/* 진료 등록 버튼 및 시간 필터 */}
          <div className="reception-header">
            <div className="time-filter-group">
              <button
                className={`time-filter-btn ${timeFilter === 'all' ? 'active' : ''}`}
                onClick={() => setTimeFilter('all')}
              >
                전체
              </button>
              <button
                className={`time-filter-btn ${timeFilter === 'past' ? 'active' : ''}`}
                onClick={() => setTimeFilter('past')}
              >
                지난 시간
              </button>
              <button
                className={`time-filter-btn ${timeFilter === 'future' ? 'active' : ''}`}
                onClick={() => setTimeFilter('future')}
              >
                이후 시간
              </button>
            </div>
            <button className="btn" onClick={() => setIsPatientCreateModalOpen(true)}>
              환자 등록
            </button>
            <button className="btn primary" onClick={() => setIsCreateModalOpen(true)}>
              진료 등록
            </button>
          </div>

          {activeTab === 'today' && (
            <div className="today-tab">
              {todayLoading ? (
                <div className="loading">로딩 중...</div>
              ) : todayEncounters.length === 0 ? (
                <div className="empty-message">오늘 접수된 환자가 없습니다.</div>
              ) : (
                <table className="table reception-table">
                  <thead>
                    <tr>
                      <th>접수 시간</th>
                      <th>환자명</th>
                      <th>환자번호</th>
                      <th>진료 유형</th>
                      <th>담당의</th>
                      <th>주호소</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {todayEncounters.map((encounter) => (
                      <tr
                        key={encounter.id}
                        onClick={() => handleRowClick(encounter)}
                        className={getRowClass(encounter)}
                      >
                        <td>{formatTime(encounter.admission_date)}</td>
                        <td className="patient-name">{encounter.patient_name}</td>
                        <td>{encounter.patient_number}</td>
                        <td>{encounter.encounter_type_display}</td>
                        <td>{encounter.attending_doctor_name}</td>
                        <td className="chief-complaint">{encounter.chief_complaint}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <EncounterStatusDropdown
                            encounterId={encounter.id}
                            currentStatus={encounter.status}
                            onStatusChange={handleStatusChange}
                            compact
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}

          {activeTab === 'monthly' && (
            <div className="monthly-tab">
              <div className="monthly-header">
                <h4>
                  {currentMonthInfo
                    ? `${currentMonthInfo.year}년 ${currentMonthInfo.month}월 진료 현황`
                    : '전체 진료 현황'}
                </h4>
                <span className="monthly-count">총 {monthlyTotalCount}건</span>
              </div>
              {monthlyLoading ? (
                <div className="loading">로딩 중...</div>
              ) : monthlyEncounters.length === 0 ? (
                <div className="empty-message">
                  {currentMonthInfo
                    ? `${currentMonthInfo.month}월 진료 환자가 없습니다.`
                    : '등록된 진료가 없습니다.'}
                </div>
              ) : (
                <>
                  <table className="table reception-table">
                    <thead>
                      <tr>
                        <th>예약일</th>
                        <th>시간</th>
                        <th>환자명</th>
                        <th>환자번호</th>
                        <th>진료 유형</th>
                        <th>담당의</th>
                        <th>상태</th>
                      </tr>
                    </thead>
                    <tbody>
                      {monthlyEncounters.map((encounter) => (
                        <tr
                          key={encounter.id}
                          onClick={() => handleRowClick(encounter)}
                          className={getRowClass(encounter)}
                        >
                          <td>{formatDate(encounter.admission_date)}</td>
                          <td>{formatTime(encounter.admission_date)}</td>
                          <td className="patient-name">{encounter.patient_name}</td>
                          <td>{encounter.patient_number}</td>
                          <td>{encounter.encounter_type_display}</td>
                          <td>{encounter.attending_doctor_name}</td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <EncounterStatusDropdown
                              encounterId={encounter.id}
                              currentStatus={encounter.status}
                              onStatusChange={handleStatusChange}
                              compact
                            />
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>

                  <Pagination
                    currentPage={monthlyPage}
                    totalPages={monthlyTotalPages}
                    onChange={setMonthlyPage}
                    pageSize={pageSize}
                  />
                </>
              )}
            </div>
          )}
        </section>

        {/* 사이드 패널: 환자 목록 + 캘린더 */}
        <div className="dashboard-sidebar">
          <PatientListWidget
            title="환자 목록"
            limit={5}
            showViewAll={true}
            compact={true}
          />
          <UnifiedCalendar title="간호사 통합 캘린더" />
        </div>
      </div>

      {/* 진료 등록 모달 */}
      {isCreateModalOpen && (
        <EncounterCreateModal
          isOpen={isCreateModalOpen}
          onClose={() => setIsCreateModalOpen(false)}
          onSuccess={handleCreateSuccess}
        />
      )}

      {/* 환자 등록 모달 */}
      {isPatientCreateModalOpen && (
        <PatientCreateModal
          isOpen={isPatientCreateModalOpen}
          onClose={() => setIsPatientCreateModalOpen(false)}
          onSuccess={handlePatientCreateSuccess}
        />
      )}

      {/* 요약 카드 클릭 시 환자 목록 모달 */}
      {summaryModalFilter && (
        <div className="modal-overlay" onClick={handleCloseSummaryModal}>
          <div className="modal-content summary-modal" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{SUMMARY_CARD_CONFIG[summaryModalFilter].title} 환자 목록</h2>
              <button className="btn-close" onClick={handleCloseSummaryModal}>
                ✕
              </button>
            </div>
            <div className="modal-body">
              {filteredEncountersForModal.length === 0 ? (
                <div className="empty-message">해당하는 환자가 없습니다.</div>
              ) : (
                <table className="table reception-table">
                  <thead>
                    <tr>
                      <th>접수 시간</th>
                      <th>환자명</th>
                      <th>환자번호</th>
                      <th>진료 유형</th>
                      <th>담당의</th>
                      <th>주호소</th>
                      <th>상태</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredEncountersForModal.map((encounter) => (
                      <tr
                        key={encounter.id}
                        onClick={() => {
                          handleCloseSummaryModal();
                          handleRowClick(encounter);
                        }}
                        className={getRowClass(encounter)}
                      >
                        <td>{formatTime(encounter.admission_date)}</td>
                        <td className="patient-name">{encounter.patient_name}</td>
                        <td>{encounter.patient_number}</td>
                        <td>{encounter.encounter_type_display}</td>
                        <td>{encounter.attending_doctor_name}</td>
                        <td className="chief-complaint">{encounter.chief_complaint}</td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <EncounterStatusDropdown
                            encounterId={encounter.id}
                            currentStatus={encounter.status}
                            onStatusChange={handleStatusChange}
                            compact
                          />
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
            <div className="modal-footer">
              <span className="patient-count">총 {filteredEncountersForModal.length}명</span>
              <button className="btn" onClick={handleCloseSummaryModal}>
                닫기
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
