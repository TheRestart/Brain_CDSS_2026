/**
 * 의사 일정 캘린더
 * - 의사 개인 일정 CRUD
 * - 회의, 휴가, 교육, 개인, 기타 일정 관리
 *
 * UX 규칙:
 * - 배경색으로 상태 표시 (점보다 배경이 먼저)
 * - 복수 일정시 개수 Badge 표시
 * - 오늘은 항상 식별 가능
 * - 캘린더는 판단 UI
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import {
  getScheduleCalendar,
  createSchedule,
  updateSchedule,
  deleteSchedule,
} from '@/services/schedule.api';
import type {
  CalendarScheduleItem,
  DoctorScheduleCreateRequest,
  DoctorScheduleUpdateRequest,
  ScheduleType,
} from '@/types/schedule';
import { SCHEDULE_TYPE_LABELS, SCHEDULE_TYPE_COLORS } from '@/types/schedule';

interface ScheduleModalData {
  mode: 'create' | 'edit';
  schedule?: CalendarScheduleItem;
  date?: string;
}

// 일정 유형별 배경색 (연한 버전)
const SCHEDULE_BG_COLORS: Record<ScheduleType, string> = {
  meeting: '#e8f0fe',      // 연한 파랑
  leave: '#fce8e8',        // 연한 빨강
  training: '#fef4e6',     // 연한 주황
  personal: '#e6f7f4',     // 연한 청록
  announcement: '#fff8e6', // 연한 노랑
  event: '#f0e6ff',        // 연한 보라
  other: '#f3f4f6',        // 연한 회색
  patient: '#e6ffe6',      // 연한 초록
};

export function DoctorScheduleCalendar() {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [schedules, setSchedules] = useState<CalendarScheduleItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [modalData, setModalData] = useState<ScheduleModalData | null>(null);
  const [selectedDay, setSelectedDay] = useState<number | null>(null);

  // 데이터 로드
  const loadSchedules = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getScheduleCalendar({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      setSchedules(data);
    } catch (err) {
      console.error('Failed to load schedules:', err);
      setError('일정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [currentDate]);

  useEffect(() => {
    loadSchedules();
    setSelectedDay(null); // 월 변경시 선택 해제
  }, [loadSchedules]);

  // 현재 월의 첫째 날과 마지막 날
  const { firstDay, daysInMonth } = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const first = new Date(year, month, 1);
    const last = new Date(year, month + 1, 0);
    return {
      firstDay: first.getDay(),
      daysInMonth: last.getDate(),
    };
  }, [currentDate]);

  // 날짜별 일정 맵
  const schedulesByDate = useMemo(() => {
    const map: Record<number, CalendarScheduleItem[]> = {};
    schedules.forEach((s) => {
      const start = new Date(s.start);
      const end = new Date(s.end);
      const year = currentDate.getFullYear();
      const month = currentDate.getMonth();

      // 일정이 걸치는 모든 날짜에 추가
      for (let d = new Date(start); d <= end; d.setDate(d.getDate() + 1)) {
        if (d.getFullYear() === year && d.getMonth() === month) {
          const day = d.getDate();
          if (!map[day]) map[day] = [];
          if (!map[day].some((item) => item.id === s.id)) {
            map[day].push(s);
          }
        }
      }
    });
    return map;
  }, [schedules, currentDate]);

  // 네비게이션
  const prevMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1));
  };

  const nextMonth = () => {
    setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1));
  };

  const goToToday = () => {
    setCurrentDate(new Date());
  };

  // 캘린더 그리드 생성
  const calendarDays = useMemo(() => {
    const days: (number | null)[] = [];
    for (let i = 0; i < firstDay; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(i);
    return days;
  }, [firstDay, daysInMonth]);

  const today = new Date();
  const isToday = (day: number) => {
    return (
      day === today.getDate() &&
      currentDate.getMonth() === today.getMonth() &&
      currentDate.getFullYear() === today.getFullYear()
    );
  };

  // 날짜의 우선 일정 색상 (배경색 결정)
  const getPrimaryScheduleColor = (day: number): string | null => {
    const daySchedules = schedulesByDate[day];
    if (!daySchedules || daySchedules.length === 0) return null;

    // 우선순위: leave > meeting > training > personal > other
    const priority: ScheduleType[] = ['leave', 'meeting', 'training', 'personal', 'other'];
    for (const type of priority) {
      const found = daySchedules.find(s => s.schedule_type === type);
      if (found) return found.color;
    }
    return daySchedules[0].color;
  };

  // 날짜 클릭 - 선택/해제 또는 새 일정 생성
  const handleDayClick = (day: number | null) => {
    if (!day) return;

    if (selectedDay === day) {
      // 같은 날짜 다시 클릭시 새 일정 생성
      const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
      setModalData({ mode: 'create', date: dateStr });
    } else {
      setSelectedDay(day);
    }
  };

  // 일정 클릭 - 수정/삭제
  const handleScheduleClick = (schedule: CalendarScheduleItem) => {
    setModalData({ mode: 'edit', schedule });
  };

  // 새 일정 추가 버튼
  const handleAddSchedule = () => {
    if (!selectedDay) return;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(selectedDay).padStart(2, '0')}`;
    setModalData({ mode: 'create', date: dateStr });
  };

  // 모달 닫기
  const closeModal = () => {
    setModalData(null);
  };

  // 요일 헤더
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 선택된 날짜의 일정 목록
  const selectedDaySchedules = selectedDay ? schedulesByDate[selectedDay] || [] : [];

  // 이번 달 일정이 없는지 확인
  const hasNoSchedules = schedules.length === 0;

  return (
    <section className="card doctor-schedule-calendar">
      <header className="card-header">
        <h3>의사 일정 캘린더</h3>
        <button className="btn btn-sm btn-secondary" onClick={goToToday}>
          오늘
        </button>
      </header>

      <div className="calendar-body">
        {/* 월 네비게이션 */}
        <div className="calendar-nav">
          <button className="nav-btn" onClick={prevMonth}>
            &lt;
          </button>
          <span className="nav-title">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </span>
          <button className="nav-btn" onClick={nextMonth}>
            &gt;
          </button>
        </div>

        {error && <div className="error-message">{error}</div>}

        {loading ? (
          <div className="loading-state">로딩 중...</div>
        ) : (
          <>
            {/* 요일 헤더 */}
            <div className="calendar-weekdays">
              {weekDays.map((day, idx) => (
                <div
                  key={day}
                  className={`weekday ${idx === 0 ? 'sun' : ''} ${idx === 6 ? 'sat' : ''}`}
                >
                  {day}
                </div>
              ))}
            </div>

            {/* 날짜 그리드 */}
            <div className="calendar-grid">
              {calendarDays.map((day, idx) => {
                const daySchedules = day ? schedulesByDate[day] : null;
                const scheduleCount = daySchedules?.length || 0;
                const primaryColor = day ? getPrimaryScheduleColor(day) : null;
                const isTodayCell = day ? isToday(day) : false;
                const isSelected = day === selectedDay;

                // 인라인 스타일로 실제 일정 색상 적용
                const cellStyle = primaryColor
                  ? { '--schedule-color': primaryColor } as React.CSSProperties
                  : undefined;

                return (
                  <div
                    key={idx}
                    className={`calendar-day ${day ? 'clickable' : 'empty'} ${isTodayCell ? 'today' : ''} ${isSelected ? 'selected' : ''} ${scheduleCount > 0 ? 'has-schedule' : ''}`}
                    style={cellStyle}
                    onClick={() => handleDayClick(day)}
                  >
                    {day && (
                      <>
                        <span className={`day-number ${scheduleCount > 0 ? 'bold' : ''}`}>
                          {day}
                        </span>
                        {/* 복수 일정시 Badge 표시 */}
                        {scheduleCount > 1 && (
                          <span className="schedule-badge" style={{ backgroundColor: primaryColor || '#5b8def' }}>
                            {scheduleCount}
                          </span>
                        )}
                        {/* 단일 일정시 색상 dot 표시 */}
                        {scheduleCount === 1 && primaryColor && (
                          <span
                            className="schedule-type-dot"
                            style={{ backgroundColor: primaryColor }}
                          />
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 범례 */}
            <div className="calendar-legend">
              {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map((type) => (
                <div key={type} className="legend-item">
                  <span
                    className="legend-color"
                    style={{ backgroundColor: SCHEDULE_BG_COLORS[type] }}
                  />
                  <span>{SCHEDULE_TYPE_LABELS[type]}</span>
                </div>
              ))}
            </div>

            {/* Empty State - 이번 달 일정 없음 */}
            {hasNoSchedules && !selectedDay && (
              <div className="empty-state">
                이번 달에 등록된 일정이 없습니다.
              </div>
            )}

            {/* 선택된 날짜 상세 패널 */}
            {selectedDay && (
              <div className="selected-day-panel">
                <div className="panel-header">
                  <span className="panel-title">
                    {currentDate.getMonth() + 1}월 {selectedDay}일 일정
                  </span>
                  <button className="btn-add" onClick={handleAddSchedule}>
                    + 추가
                  </button>
                </div>

                {selectedDaySchedules.length === 0 ? (
                  <div className="panel-empty">
                    선택한 날짜에 일정이 없습니다.
                  </div>
                ) : (
                  <ul className="schedule-list">
                    {selectedDaySchedules.map((s) => (
                      <li
                        key={s.id}
                        className="schedule-item"
                        onClick={() => handleScheduleClick(s)}
                      >
                        <span
                          className="schedule-color"
                          style={{ backgroundColor: s.color }}
                        />
                        <div className="schedule-info">
                          <span className="schedule-title">{s.title}</span>
                          <span className="schedule-type">
                            {SCHEDULE_TYPE_LABELS[s.schedule_type]}
                            {s.all_day ? ' (종일)' : ` ${s.start.slice(11, 16)}`}
                          </span>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}
          </>
        )}
      </div>

      {/* 일정 모달 */}
      {modalData && (
        <ScheduleModal
          mode={modalData.mode}
          schedule={modalData.schedule}
          defaultDate={modalData.date}
          onClose={closeModal}
          onSave={loadSchedules}
        />
      )}

      <style>{`
        .doctor-schedule-calendar {
          min-height: 400px;
        }
        .calendar-body {
          padding: 16px;
        }
        .calendar-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
        }
        .nav-btn {
          width: 32px;
          height: 32px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--card-bg, white);
          color: var(--text-main, #1f2937);
          border-radius: 6px;
          cursor: pointer;
          font-size: 14px;
        }
        .nav-btn:hover {
          background: var(--bg-main, #f4f6f9);
        }
        .nav-title {
          font-size: 15px;
          font-weight: 600;
          color: var(--text-main, #1f2937);
        }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          margin-bottom: 8px;
        }
        .weekday {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-sub, #6b7280);
          padding: 6px;
        }
        .weekday.sun { color: var(--danger, #e56b6f); }
        .weekday.sat { color: var(--info, #5b8def); }

        /* 캘린더 그리드 */
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 4px;
        }
        .calendar-day {
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 4px;
          font-size: 13px;
          border-radius: 8px;
          cursor: pointer;
          position: relative;
          color: var(--text-main, #1f2937);
          min-height: 44px;
          transition: all 0.15s ease;
        }
        .calendar-day.empty {
          background: transparent;
          cursor: default;
        }
        .calendar-day.clickable:hover {
          background: var(--bg-main, #f4f6f9);
        }

        /* ============================================
           Tint 방식: ::before pseudo-element + inset
           일정의 실제 색상을 CSS 변수로 적용
           ============================================ */
        .calendar-day::before {
          content: "";
          position: absolute;
          inset: 4px;
          border-radius: 6px;
          pointer-events: none;
          z-index: 0;
        }

        /* 일정 있는 셀 - 실제 색상 적용 (12% 투명도) */
        .calendar-day.has-schedule::before {
          background: color-mix(in srgb, var(--schedule-color, #5b8def) 15%, transparent);
        }
        .calendar-day.has-schedule:hover::before {
          background: color-mix(in srgb, var(--schedule-color, #5b8def) 22%, transparent);
        }

        /* ============================================
           오늘 날짜 - 얇은 링 (box-shadow inset)
           배경 fill 없음, 텍스트 색상 유지
           ============================================ */
        .calendar-day.today {
          box-shadow: inset 0 0 0 2px rgba(91, 111, 214, 0.5);
        }
        .calendar-day.today .day-number {
          color: var(--primary, #5b6fd6);
          font-weight: 600;
        }

        /* ============================================
           선택된 날짜 - outline only (배경 fill 없음)
           ============================================ */
        // .calendar-day.selected {
        //   outline: 2px solid #5b8def;
        //   outline-offset: -2px;
        //   box-shadow: 0 4px 12px rgba(91, 141, 239, 0.25);
        //   z-index: 1;
        // }
        .calendar-day.selected .day-number {
          color: #5b8def;
          font-weight: 700;
        }
        /* 선택 + 오늘 동시: 선택 outline이 오늘 링 위에 표시 */
        .calendar-day.selected.today {
          box-shadow: inset 0 0 0 2px rgba(91, 111, 214, 0.5), 0 4px 12px rgba(91, 141, 239, 0.25);
        }

        /* 날짜 숫자 */
        .day-number {
          font-weight: 400;
          line-height: 1;
          position: relative;
          z-index: 1;
        }
        .day-number.bold {
          font-weight: 600;
        }

        /* ============================================
           일정 개수 Badge - 작은 크기, 우측 상단
           일정 색상에 맞춰 동적으로 표시
           ============================================ */
        .schedule-badge {
          position: absolute;
          top: 2px;
          right: 2px;
          min-width: 14px;
          height: 14px;
          padding: 0 3px;
          color: white;
          font-size: 9px;
          font-weight: 600;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 2;
        }

        /* 단일 일정 유형 표시 dot */
        .schedule-type-dot {
          width: 5px;
          height: 5px;
          border-radius: 50%;
          margin-top: 3px;
          position: relative;
          z-index: 1;
        }

        /* 범례 */
        .calendar-legend {
          display: flex;
          flex-wrap: wrap;
          justify-content: center;
          gap: 12px;
          margin-top: 16px;
          padding-top: 12px;
          border-top: 1px solid var(--border, #e5e7eb);
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 11px;
          color: var(--text-sub, #6b7280);
        }
        .legend-color {
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.1);
        }

        /* Empty State */
        .empty-state {
          padding: 24px;
          text-align: center;
          color: var(--text-sub, #6b7280);
          font-size: 13px;
        }

        /* 선택된 날짜 상세 패널 */
        .selected-day-panel {
          margin-top: 16px;
          padding: 12px;
          background: var(--bg-main, #f4f6f9);
          border-radius: 8px;
        }
        .panel-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .panel-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main, #1f2937);
        }
        .btn-add {
          padding: 4px 12px;
          background: var(--primary, #5b6fd6);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 12px;
          cursor: pointer;
        }
        .btn-add:hover {
          background: var(--primary-dark, #4a5bc4);
        }
        .panel-empty {
          padding: 16px;
          text-align: center;
          color: var(--text-sub, #6b7280);
          font-size: 13px;
        }
        .schedule-list {
          list-style: none;
          padding: 0;
          margin: 0;
        }
        .schedule-item {
          display: flex;
          align-items: center;
          gap: 10px;
          padding: 10px;
          background: var(--card-bg, white);
          border-radius: 6px;
          margin-bottom: 6px;
          cursor: pointer;
          transition: transform 0.1s;
        }
        .schedule-item:hover {
          transform: translateX(4px);
        }
        .schedule-item:last-child {
          margin-bottom: 0;
        }
        .schedule-color {
          width: 4px;
          height: 32px;
          border-radius: 2px;
          flex-shrink: 0;
        }
        .schedule-info {
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .schedule-title {
          font-size: 13px;
          font-weight: 500;
          color: var(--text-main, #1f2937);
        }
        .schedule-type {
          font-size: 11px;
          color: var(--text-sub, #6b7280);
        }

        .loading-state, .error-message {
          padding: 32px;
          text-align: center;
          color: var(--text-sub, #6b7280);
        }
        .error-message {
          color: var(--danger, #e56b6f);
          padding: 12px;
          background: #fef2f2;
          border-radius: 6px;
          margin-bottom: 12px;
        }
      `}</style>
    </section>
  );
}

// =============================================================================
// 일정 생성/수정 모달
// =============================================================================
interface ScheduleModalProps {
  mode: 'create' | 'edit';
  schedule?: CalendarScheduleItem;
  defaultDate?: string;
  onClose: () => void;
  onSave: () => void;
}

function ScheduleModal({ mode, schedule, defaultDate, onClose, onSave }: ScheduleModalProps) {
  const [title, setTitle] = useState(schedule?.title || '');
  const [scheduleType, setScheduleType] = useState<ScheduleType>(schedule?.schedule_type || 'meeting');
  const [startDate, setStartDate] = useState(
    schedule ? schedule.start.slice(0, 10) : defaultDate || ''
  );
  const [startTime, setStartTime] = useState(
    schedule && !schedule.all_day ? schedule.start.slice(11, 16) : '09:00'
  );
  const [endDate, setEndDate] = useState(
    schedule ? schedule.end.slice(0, 10) : defaultDate || ''
  );
  const [endTime, setEndTime] = useState(
    schedule && !schedule.all_day ? schedule.end.slice(11, 16) : '10:00'
  );
  const [allDay, setAllDay] = useState(schedule?.all_day || false);
  const [color, setColor] = useState(schedule?.color || SCHEDULE_TYPE_COLORS[scheduleType]);
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 일정 유형 변경 시 색상 자동 변경
  useEffect(() => {
    if (!schedule) {
      setColor(SCHEDULE_TYPE_COLORS[scheduleType]);
    }
  }, [scheduleType, schedule]);

  // 저장
  const handleSave = async () => {
    if (!title.trim()) {
      setError('제목을 입력해주세요.');
      return;
    }
    if (!startDate || !endDate) {
      setError('날짜를 선택해주세요.');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const startDatetime = allDay
        ? `${startDate}T00:00:00`
        : `${startDate}T${startTime}:00`;
      const endDatetime = allDay
        ? `${endDate}T23:59:59`
        : `${endDate}T${endTime}:00`;

      if (mode === 'create') {
        const data: DoctorScheduleCreateRequest = {
          title: title.trim(),
          schedule_type: scheduleType,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          all_day: allDay,
          color,
        };
        await createSchedule(data);
      } else if (schedule) {
        const data: DoctorScheduleUpdateRequest = {
          title: title.trim(),
          schedule_type: scheduleType,
          start_datetime: startDatetime,
          end_datetime: endDatetime,
          all_day: allDay,
          color,
        };
        await updateSchedule(schedule.id, data);
      }

      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      setError('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // 삭제
  const handleDelete = async () => {
    if (!schedule) return;
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;

    setDeleting(true);
    setError(null);

    try {
      await deleteSchedule(schedule.id);
      onSave();
      onClose();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      setError('삭제에 실패했습니다.');
    } finally {
      setDeleting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <header className="modal-header">
          <h3>{mode === 'create' ? '새 일정' : '일정 수정'}</h3>
          <button className="close-btn" onClick={onClose}>
            ×
          </button>
        </header>

        <div className="modal-body">
          {error && <div className="error-message">{error}</div>}

          <div className="form-group">
            <label>제목 *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="일정 제목을 입력하세요"
              autoFocus
            />
          </div>

          <div className="form-group">
            <label>유형</label>
            <select value={scheduleType} onChange={(e) => setScheduleType(e.target.value as ScheduleType)}>
              {(Object.keys(SCHEDULE_TYPE_LABELS) as ScheduleType[]).map((type) => (
                <option key={type} value={type}>
                  {SCHEDULE_TYPE_LABELS[type]}
                </option>
              ))}
            </select>
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>시작일 *</label>
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="form-group">
                <label>시작 시간</label>
                <input
                  type="time"
                  value={startTime}
                  onChange={(e) => setStartTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-row">
            <div className="form-group">
              <label>종료일 *</label>
              <input
                type="date"
                value={endDate}
                onChange={(e) => setEndDate(e.target.value)}
              />
            </div>
            {!allDay && (
              <div className="form-group">
                <label>종료 시간</label>
                <input
                  type="time"
                  value={endTime}
                  onChange={(e) => setEndTime(e.target.value)}
                />
              </div>
            )}
          </div>

          <div className="form-group checkbox-group">
            <label>
              <input
                type="checkbox"
                checked={allDay}
                onChange={(e) => setAllDay(e.target.checked)}
              />
              종일
            </label>
          </div>

          <div className="form-group">
            <label>색상</label>
            <div className="color-picker">
              {Object.values(SCHEDULE_TYPE_COLORS).map((c) => (
                <button
                  key={c}
                  className={`color-option ${color === c ? 'selected' : ''}`}
                  style={{ backgroundColor: c }}
                  onClick={() => setColor(c)}
                  type="button"
                />
              ))}
              <input
                type="color"
                value={color}
                onChange={(e) => setColor(e.target.value)}
                className="color-input"
              />
            </div>
          </div>
        </div>

        <footer className="modal-footer">
          {mode === 'edit' && (
            <button
              className="btn btn-danger"
              onClick={handleDelete}
              disabled={deleting || saving}
            >
              {deleting ? '삭제 중...' : '삭제'}
            </button>
          )}
          <div className="footer-right">
            <button className="btn btn-secondary" onClick={onClose} disabled={saving || deleting}>
              취소
            </button>
            <button className="btn btn-primary" onClick={handleSave} disabled={saving || deleting}>
              {saving ? '저장 중...' : '저장'}
            </button>
          </div>
        </footer>
      </div>

      <style>{`
        .modal-overlay {
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
          background: var(--card-bg, white);
          border-radius: 12px;
          width: 100%;
          max-width: 480px;
          max-height: 90vh;
          overflow-y: auto;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.15);
        }
        .modal-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-bottom: 1px solid var(--border, #e5e7eb);
        }
        .modal-header h3 {
          margin: 0;
          font-size: 18px;
          font-weight: 600;
          color: var(--text-main, #1f2937);
        }
        .close-btn {
          width: 32px;
          height: 32px;
          border: none;
          background: transparent;
          font-size: 24px;
          color: var(--text-sub, #6b7280);
          cursor: pointer;
          border-radius: 6px;
        }
        .close-btn:hover {
          background: var(--bg-main, #f4f6f9);
        }
        .modal-body {
          padding: 20px;
        }
        .modal-body .error-message {
          padding: 12px;
          background: #fef2f2;
          border: 1px solid #fecaca;
          border-radius: 6px;
          color: #dc2626;
          margin-bottom: 16px;
          font-size: 14px;
        }
        .form-group {
          margin-bottom: 16px;
        }
        .form-group label {
          display: block;
          font-size: 13px;
          font-weight: 500;
          color: var(--text-main, #1f2937);
          margin-bottom: 6px;
        }
        .form-group input[type="text"],
        .form-group input[type="date"],
        .form-group input[type="time"],
        .form-group select {
          width: 100%;
          padding: 10px 12px;
          border: 1px solid var(--border, #e5e7eb);
          border-radius: 6px;
          font-size: 14px;
          color: var(--text-main, #1f2937);
        }
        .form-group input:focus,
        .form-group select:focus {
          outline: none;
          border-color: var(--primary, #5b6fd6);
          box-shadow: 0 0 0 3px rgba(91, 111, 214, 0.1);
        }
        .form-row {
          display: flex;
          gap: 12px;
        }
        .form-row .form-group {
          flex: 1;
        }
        .checkbox-group label {
          display: flex;
          align-items: center;
          gap: 8px;
          cursor: pointer;
        }
        .checkbox-group input[type="checkbox"] {
          width: 18px;
          height: 18px;
          cursor: pointer;
        }
        .color-picker {
          display: flex;
          align-items: center;
          gap: 8px;
          flex-wrap: wrap;
        }
        .color-option {
          width: 28px;
          height: 28px;
          border: 2px solid transparent;
          border-radius: 6px;
          cursor: pointer;
        }
        .color-option:hover {
          opacity: 0.8;
        }
        .color-option.selected {
          border-color: var(--text-main, #1f2937);
        }
        .color-input {
          width: 28px;
          height: 28px;
          padding: 0;
          border: none;
          cursor: pointer;
        }
        .modal-footer {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 16px 20px;
          border-top: 1px solid var(--border, #e5e7eb);
        }
        .footer-right {
          display: flex;
          gap: 8px;
          margin-left: auto;
        }
        .btn {
          padding: 10px 20px;
          border-radius: 6px;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          border: none;
        }
        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }
        .btn-primary {
          background: var(--primary, #5b6fd6);
          color: white;
        }
        .btn-primary:hover:not(:disabled) {
          background: var(--primary-dark, #4a5bc4);
        }
        .btn-secondary {
          background: var(--bg-main, #f4f6f9);
          color: var(--text-main, #1f2937);
          border: 1px solid var(--border, #e5e7eb);
        }
        .btn-secondary:hover:not(:disabled) {
          background: var(--border, #e5e7eb);
        }
        .btn-danger {
          background: #fef2f2;
          color: #dc2626;
          border: 1px solid #fecaca;
        }
        .btn-danger:hover:not(:disabled) {
          background: #fecaca;
        }
      `}</style>
    </div>
  );
}
