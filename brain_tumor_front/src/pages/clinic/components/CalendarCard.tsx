/**
 * 환자 일정 캘린더 카드
 * - 환자의 진료 일정을 달력 형태로 표시 (노랑 계열 tint)
 * - 의사 일정도 함께 표시 (파랑 계열 tint)
 *
 * UX 규칙:
 * - 배경은 "연한 tint"로만 (inset 적용)
 * - 선택(Selected): outline + shadow
 * - 오늘(Today): 얇은 링(ring)
 * - 복수 일정: 작은 badge
 * - 큰 도형/원으로 덮기 금지
 */
import { useState, useMemo, useEffect, useCallback } from 'react';
import type { Encounter } from '@/types/encounter';
import { getScheduleCalendar } from '@/services/schedule.api';
import type { CalendarScheduleItem } from '@/types/schedule';

interface CalendarCardProps {
  patientId: number;
  encounters: Encounter[];
  onDateSelect?: (date: string | null) => void;
  selectedDate?: string | null;
}

export default function CalendarCard({
  patientId: _patientId,
  encounters,
  onDateSelect,
  selectedDate,
}: CalendarCardProps) {
  const [currentDate, setCurrentDate] = useState(new Date());
  const [doctorSchedules, setDoctorSchedules] = useState<CalendarScheduleItem[]>([]);

  // 의사 일정 로드
  const loadDoctorSchedules = useCallback(async () => {
    try {
      const data = await getScheduleCalendar({
        year: currentDate.getFullYear(),
        month: currentDate.getMonth() + 1,
      });
      setDoctorSchedules(data);
    } catch (err) {
      console.error('Failed to load doctor schedules:', err);
    }
  }, [currentDate]);

  useEffect(() => {
    loadDoctorSchedules();
  }, [loadDoctorSchedules]);

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

  // 진료 날짜 추출 헬퍼
  const getEncounterDate = (e: Encounter): string | null => {
    const dateStr = e.admission_date || e.encounter_date;
    if (!dateStr) return null;
    return dateStr.slice(0, 10);
  };

  // 해당 월의 진료 일정
  const monthEncounters = useMemo(() => {
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();
    const monthStr = `${year}-${String(month + 1).padStart(2, '0')}`;

    return encounters.filter((e) => {
      const dateStr = getEncounterDate(e);
      return dateStr?.startsWith(monthStr);
    });
  }, [currentDate, encounters]);

  // 날짜별 진료 맵
  const encountersByDate = useMemo(() => {
    const map: Record<number, Encounter[]> = {};
    monthEncounters.forEach((e) => {
      const dateStr = getEncounterDate(e);
      if (!dateStr) return;
      const day = parseInt(dateStr.split('-')[2] || '0', 10);
      if (!map[day]) map[day] = [];
      map[day].push(e);
    });
    return map;
  }, [monthEncounters]);

  // 날짜별 의사 일정 맵
  const doctorSchedulesByDate = useMemo(() => {
    const map: Record<number, CalendarScheduleItem[]> = {};
    const year = currentDate.getFullYear();
    const month = currentDate.getMonth();

    doctorSchedules.forEach((s) => {
      const start = new Date(s.start);
      const end = new Date(s.end);

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
  }, [doctorSchedules, currentDate]);

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

  // 요일 헤더
  const weekDays = ['일', '월', '화', '수', '목', '금', '토'];

  // 달력 그리드 생성
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

  // 선택된 날짜인지 확인
  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return dateStr === selectedDate;
  };

  // 환자 일정의 우선 상태 (tint 강도 결정)
  const getPrimaryPatientStatus = (day: number): string | null => {
    const dayEncounters = encountersByDate[day];
    if (!dayEncounters || dayEncounters.length === 0) return null;

    const priority = ['in_progress', 'scheduled', 'completed', 'cancelled'];
    for (const status of priority) {
      if (dayEncounters.some(e => e.status === status)) return status;
    }
    return dayEncounters[0].status || 'scheduled';
  };

  // 날짜 클릭 핸들러
  const handleDayClick = (day: number) => {
    if (!day) return;

    const hasPatientSchedule = encountersByDate[day] && encountersByDate[day].length > 0;
    if (!hasPatientSchedule) return;

    const dateStr = `${currentDate.getFullYear()}-${String(currentDate.getMonth() + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

    if (selectedDate === dateStr) {
      onDateSelect?.(null);
    } else {
      onDateSelect?.(dateStr);
    }
  };

  // 이번 달 일정 여부 체크
  const hasNoSchedules = monthEncounters.length === 0 && doctorSchedules.length === 0;

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">📅</span>
          환자 일정 캘린더
        </h3>
        <button className="btn btn-sm btn-secondary" onClick={goToToday}>
          오늘
        </button>
      </div>
      <div className="clinic-card-body calendar-body">
        {/* 월 네비게이션 */}
        <div className="calendar-nav">
          <button className="nav-btn" onClick={prevMonth}>&lt;</button>
          <span className="nav-title">
            {currentDate.getFullYear()}년 {currentDate.getMonth() + 1}월
          </span>
          <button className="nav-btn" onClick={nextMonth}>&gt;</button>
        </div>

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
            const patientCount = day ? (encountersByDate[day]?.length || 0) : 0;
            const doctorCount = day ? (doctorSchedulesByDate[day]?.length || 0) : 0;
            const patientStatus = day ? getPrimaryPatientStatus(day) : null;
            const isTodayCell = day ? isToday(day) : false;
            const isSelectedCell = day ? isSelected(day) : false;
            const hasPatientSchedule = patientCount > 0;
            const hasDoctorSchedule = doctorCount > 0;

            // 상태에 따른 tint class
            let tintClass = '';
            if (patientStatus === 'in_progress') tintClass = 'tint-patient-active';
            else if (patientStatus === 'scheduled') tintClass = 'tint-patient';
            else if (patientStatus === 'completed') tintClass = 'tint-completed';
            else if (patientStatus === 'cancelled') tintClass = 'tint-cancelled';
            else if (hasDoctorSchedule) tintClass = 'tint-doctor';

            return (
              <div
                key={idx}
                className={`day-cell ${day ? '' : 'empty'} ${isTodayCell ? 'today' : ''} ${isSelectedCell ? 'selected' : ''} ${hasPatientSchedule ? 'clickable' : ''} ${tintClass}`}
                onClick={() => day && handleDayClick(day)}
              >
                {day && (
                  <>
                    <span className={`day-num ${patientCount > 0 || doctorCount > 0 ? 'has-event' : ''}`}>
                      {day}
                    </span>

                    {/* Badge 표시 - 환자(노랑) / 의사(파랑) 분리 */}
                    {(patientCount > 0 || doctorCount > 0) && (
                      <div className="badge-row">
                        {patientCount > 0 && (
                          <span className="badge badge-patient" title={`환자 ${patientCount}`}>
                            {patientCount}
                          </span>
                        )}
                        {doctorCount > 0 && (
                          <span className="badge badge-doctor" title={`의사 ${doctorCount}`}>
                            {doctorCount}
                          </span>
                        )}
                      </div>
                    )}
                  </>
                )}
              </div>
            );
          })}
        </div>

        {/* 범례 */}
        <div className="calendar-legend">
          <div className="legend-row">
            <span className="legend-label">환자</span>
            <div className="legend-item"><span className="legend-box tint-patient"></span>예약</div>
            <div className="legend-item"><span className="legend-box tint-patient-active"></span>진료중</div>
            <div className="legend-item"><span className="legend-box tint-completed"></span>완료</div>
          </div>
          <div className="legend-row">
            <span className="legend-label">의사</span>
            <div className="legend-item"><span className="legend-box tint-doctor"></span>일정</div>
          </div>
        </div>

        {/* Empty State */}
        {hasNoSchedules && (
          <div className="empty-state">
            이번 달에 등록된 진료 일정이 없습니다.
          </div>
        )}
      </div>

      <style>{`
        .calendar-body {
          padding: 12px;
        }
        .calendar-nav {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 12px;
        }
        .nav-btn {
          width: 28px;
          height: 28px;
          border: 1px solid var(--border, #e5e7eb);
          background: var(--card-bg, white);
          color: var(--text-main, #1f2937);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .nav-btn:hover {
          background: var(--bg-main, #f4f6f9);
        }
        .nav-title {
          font-size: 14px;
          font-weight: 600;
          color: var(--text-main, #1f2937);
        }
        .calendar-weekdays {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          text-align: center;
          margin-bottom: 4px;
        }
        .weekday {
          font-size: 11px;
          font-weight: 500;
          color: var(--text-sub, #6b7280);
          padding: 4px;
        }
        .weekday.sun { color: #e56b6f; }
        .weekday.sat { color: #5b8def; }

        /* ========== 캘린더 그리드 ========== */
        .calendar-grid {
          display: grid;
          grid-template-columns: repeat(7, 1fr);
          gap: 2px;
        }

        /* ========== 날짜 셀 기본 ========== */
        .day-cell {
          position: relative;
          aspect-ratio: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          font-size: 13px;
          border-radius: 8px;
          color: var(--text-main, #1f2937);
          cursor: default;
        }
        .day-cell.empty {
          background: transparent;
        }
        .day-cell.clickable {
          cursor: pointer;
        }
        .day-cell.clickable:hover {
          background: rgba(0, 0, 0, 0.04);
        }

        /* ========== Tint (inset pseudo-element) ========== */
        .day-cell::before {
          content: "";
          position: absolute;
          inset: 4px;
          border-radius: 6px;
          pointer-events: none;
        }

        /* 환자 - 예약 (노랑 12%) */
        .day-cell.tint-patient::before {
          background: rgba(245, 158, 11, 0.12);
        }

        /* 환자 - 진료중 (노랑 28%) */
        .day-cell.tint-patient-active::before {
          background: rgba(245, 158, 11, 0.28);
        }

        /* 완료 (초록 12%) */
        .day-cell.tint-completed::before {
          background: rgba(16, 185, 129, 0.12);
        }

        /* 취소 (회색 10%) */
        .day-cell.tint-cancelled::before {
          background: rgba(107, 114, 128, 0.10);
        }

        /* 의사 일정만 (파랑 12%) */
        .day-cell.tint-doctor::before {
          background: rgba(91, 141, 239, 0.12);
        }

        /* ========== 오늘 (Today) - 얇은 링 ========== */
        .day-cell.today {
          box-shadow: inset 0 0 0 2px rgba(91, 111, 214, 0.5);
        }
        .day-cell.today .day-num {
          font-weight: 700;
          color: #5b6fd6;
        }

        /* ========== 선택 (Selected) - outline + shadow ========== */
        .day-cell.selected {
          outline: 2px solid #5b8def;
          outline-offset: -2px;
          box-shadow: 0 4px 12px rgba(91, 141, 239, 0.25);
          z-index: 1;
        }

        /* 선택 + 오늘 겹칠 때 */
        .day-cell.selected.today {
          box-shadow: inset 0 0 0 2px rgba(91, 111, 214, 0.5), 0 4px 12px rgba(91, 141, 239, 0.25);
        }

        /* ========== 날짜 숫자 ========== */
        .day-num {
          position: relative;
          z-index: 1;
          font-weight: 400;
          line-height: 1;
        }
        .day-num.has-event {
          font-weight: 600;
        }

        /* ========== Badge ========== */
        .badge-row {
          position: absolute;
          top: 3px;
          right: 3px;
          display: flex;
          gap: 1px;
          z-index: 2;
        }
        .badge {
          min-width: 14px;
          height: 14px;
          padding: 0 3px;
          font-size: 9px;
          font-weight: 600;
          border-radius: 7px;
          display: flex;
          align-items: center;
          justify-content: center;
          color: white;
        }
        .badge-patient {
          background: #f59e0b;
        }
        .badge-doctor {
          background: #5b8def;
        }

        /* ========== 범례 ========== */
        .calendar-legend {
          margin-top: 12px;
          padding-top: 10px;
          border-top: 1px solid var(--border, #e5e7eb);
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .legend-row {
          display: flex;
          align-items: center;
          gap: 10px;
        }
        .legend-label {
          font-size: 10px;
          font-weight: 600;
          color: var(--text-main, #1f2937);
          min-width: 28px;
        }
        .legend-item {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 10px;
          color: var(--text-sub, #6b7280);
        }
        .legend-box {
          position: relative;
          width: 16px;
          height: 16px;
          border-radius: 4px;
          border: 1px solid rgba(0,0,0,0.08);
        }
        .legend-box::before {
          content: "";
          position: absolute;
          inset: 2px;
          border-radius: 2px;
        }
        .legend-box.tint-patient::before {
          background: rgba(245, 158, 11, 0.12);
        }
        .legend-box.tint-patient-active::before {
          background: rgba(245, 158, 11, 0.28);
        }
        .legend-box.tint-completed::before {
          background: rgba(16, 185, 129, 0.12);
        }
        .legend-box.tint-doctor::before {
          background: rgba(91, 141, 239, 0.12);
        }

        /* ========== Empty State ========== */
        .empty-state {
          padding: 20px;
          text-align: center;
          color: var(--text-sub, #6b7280);
          font-size: 12px;
        }
      `}</style>
    </div>
  );
}
