import { useState, useEffect, useMemo } from 'react';
import {
  getSharedScheduleList,
  createSharedSchedule,
  updateSharedSchedule,
  deleteSharedSchedule,
} from '@/services/schedule.api';
import type {
  SharedScheduleListItem,
  SharedScheduleCreateRequest,
  SharedScheduleUpdateRequest,
  ScheduleType,
  ScheduleVisibility,
} from '@/types/schedule';
import {
  SCHEDULE_TYPE_LABELS,
  SCHEDULE_TYPE_COLORS,
  VISIBILITY_LABELS,
} from '@/types/schedule';
import './SharedCalendarPage.css';

type ModalMode = 'create' | 'edit' | null;

interface FormData {
  title: string;
  schedule_type: ScheduleType;
  start_datetime: string;
  end_datetime: string;
  all_day: boolean;
  description: string;
  color: string;
  visibility: ScheduleVisibility;
}

const initialFormData: FormData = {
  title: '',
  schedule_type: 'announcement',
  start_datetime: '',
  end_datetime: '',
  all_day: false,
  description: '',
  color: '#8b5cf6',
  visibility: 'ALL',
};

export default function SharedCalendarPage() {
  const [schedules, setSchedules] = useState<SharedScheduleListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // 필터
  const [filterVisibility, setFilterVisibility] = useState<string>('');

  // 모달
  const [modalMode, setModalMode] = useState<ModalMode>(null);
  const [editingId, setEditingId] = useState<number | null>(null);
  const [formData, setFormData] = useState<FormData>(initialFormData);
  const [submitting, setSubmitting] = useState(false);

  // 데이터 로드
  const fetchSchedules = async () => {
    try {
      setLoading(true);
      const data = await getSharedScheduleList(filterVisibility || undefined);
      setSchedules(data);
      setError(null);
    } catch (err) {
      console.error('Failed to fetch shared schedules:', err);
      setError('공유 일정을 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSchedules();
  }, [filterVisibility]);

  // 필터링된 일정
  const filteredSchedules = useMemo(() => {
    return schedules;
  }, [schedules]);

  // 모달 열기
  const openCreateModal = () => {
    setFormData(initialFormData);
    setEditingId(null);
    setModalMode('create');
  };

  const openEditModal = (schedule: SharedScheduleListItem) => {
    setFormData({
      title: schedule.title,
      schedule_type: schedule.schedule_type,
      start_datetime: schedule.start_datetime.slice(0, 16),
      end_datetime: schedule.end_datetime.slice(0, 16),
      all_day: schedule.all_day,
      description: '',
      color: schedule.color,
      visibility: schedule.visibility,
    });
    setEditingId(schedule.id);
    setModalMode('edit');
  };

  const closeModal = () => {
    setModalMode(null);
    setEditingId(null);
    setFormData(initialFormData);
  };

  // 폼 제출
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting) return;

    try {
      setSubmitting(true);

      if (modalMode === 'create') {
        const request: SharedScheduleCreateRequest = {
          title: formData.title,
          schedule_type: formData.schedule_type,
          start_datetime: formData.start_datetime,
          end_datetime: formData.end_datetime,
          all_day: formData.all_day,
          description: formData.description || undefined,
          color: formData.color || undefined,
          visibility: formData.visibility,
        };
        await createSharedSchedule(request);
      } else if (modalMode === 'edit' && editingId) {
        const request: SharedScheduleUpdateRequest = {
          title: formData.title,
          schedule_type: formData.schedule_type,
          start_datetime: formData.start_datetime,
          end_datetime: formData.end_datetime,
          all_day: formData.all_day,
          description: formData.description || undefined,
          color: formData.color || undefined,
          visibility: formData.visibility,
        };
        await updateSharedSchedule(editingId, request);
      }

      closeModal();
      fetchSchedules();
    } catch (err) {
      console.error('Failed to save schedule:', err);
      alert('일정 저장에 실패했습니다.');
    } finally {
      setSubmitting(false);
    }
  };

  // 삭제
  const handleDelete = async (id: number) => {
    if (!confirm('이 일정을 삭제하시겠습니까?')) return;

    try {
      await deleteSharedSchedule(id);
      fetchSchedules();
    } catch (err) {
      console.error('Failed to delete schedule:', err);
      alert('일정 삭제에 실패했습니다.');
    }
  };

  // 날짜 포맷
  const formatDateTime = (datetime: string) => {
    const date = new Date(datetime);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 일정 유형 선택 시 기본 색상 설정
  const handleScheduleTypeChange = (type: ScheduleType) => {
    setFormData(prev => ({
      ...prev,
      schedule_type: type,
      color: SCHEDULE_TYPE_COLORS[type],
    }));
  };

  if (loading) {
    return <div className="shared-calendar-page loading">로딩 중...</div>;
  }

  if (error) {
    return <div className="shared-calendar-page error">{error}</div>;
  }

  return (
    <div className="shared-calendar-page">
      <div className="page-header">
        <h2>권한별 공유 캘린더 관리</h2>
        <p className="page-desc">역할(권한)별로 공유되는 일정을 관리합니다.</p>
      </div>

      {/* 필터 및 액션 */}
      <div className="toolbar">
        <div className="filters">
          <select
            value={filterVisibility}
            onChange={e => setFilterVisibility(e.target.value)}
            className="filter-select"
          >
            <option value="">전체 권한</option>
            {Object.entries(VISIBILITY_LABELS).map(([key, label]) => (
              <option key={key} value={key}>
                {label}
              </option>
            ))}
          </select>
        </div>
        <button className="create-btn" onClick={openCreateModal}>
          + 일정 추가
        </button>
      </div>

      {/* 일정 목록 */}
      <div className="schedule-list">
        {filteredSchedules.length === 0 ? (
          <div className="empty-state">등록된 공유 일정이 없습니다.</div>
        ) : (
          <table className="schedule-table">
            <thead>
              <tr>
                <th>색상</th>
                <th>제목</th>
                <th>유형</th>
                <th>대상 권한</th>
                <th>시작</th>
                <th>종료</th>
                <th>작성자</th>
                <th>작업</th>
              </tr>
            </thead>
            <tbody>
              {filteredSchedules.map(schedule => (
                <tr key={schedule.id}>
                  <td>
                    <span
                      className="color-badge"
                      style={{ backgroundColor: schedule.color }}
                    />
                  </td>
                  <td className="title-cell">{schedule.title}</td>
                  <td>
                    <span className="type-badge">{schedule.schedule_type_display}</span>
                  </td>
                  <td>
                    <span className={`visibility-badge visibility-${schedule.visibility.toLowerCase()}`}>
                      {schedule.visibility_display}
                    </span>
                  </td>
                  <td>{formatDateTime(schedule.start_datetime)}</td>
                  <td>{formatDateTime(schedule.end_datetime)}</td>
                  <td>{schedule.created_by_name}</td>
                  <td className="actions-cell">
                    <button
                      className="action-btn edit"
                      onClick={() => openEditModal(schedule)}
                    >
                      수정
                    </button>
                    <button
                      className="action-btn delete"
                      onClick={() => handleDelete(schedule.id)}
                    >
                      삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* 모달 */}
      {modalMode && (
        <div className="modal-overlay" onClick={closeModal}>
          <div className="modal-content" onClick={e => e.stopPropagation()}>
            <div className="modal-header">
              <h3>{modalMode === 'create' ? '공유 일정 추가' : '공유 일정 수정'}</h3>
              <button className="close-btn" onClick={closeModal}>
                ×
              </button>
            </div>
            <form onSubmit={handleSubmit}>
              <div className="form-group">
                <label>제목 *</label>
                <input
                  type="text"
                  value={formData.title}
                  onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                  required
                  placeholder="일정 제목을 입력하세요"
                />
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>일정 유형 *</label>
                  <select
                    value={formData.schedule_type}
                    onChange={e => handleScheduleTypeChange(e.target.value as ScheduleType)}
                    required
                  >
                    {Object.entries(SCHEDULE_TYPE_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
                <div className="form-group">
                  <label>대상 권한 *</label>
                  <select
                    value={formData.visibility}
                    onChange={e =>
                      setFormData(prev => ({
                        ...prev,
                        visibility: e.target.value as ScheduleVisibility,
                      }))
                    }
                    required
                  >
                    {Object.entries(VISIBILITY_LABELS).map(([key, label]) => (
                      <option key={key} value={key}>
                        {label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>시작 일시 *</label>
                  <input
                    type="datetime-local"
                    value={formData.start_datetime}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, start_datetime: e.target.value }))
                    }
                    required
                  />
                </div>
                <div className="form-group">
                  <label>종료 일시 *</label>
                  <input
                    type="datetime-local"
                    value={formData.end_datetime}
                    onChange={e =>
                      setFormData(prev => ({ ...prev, end_datetime: e.target.value }))
                    }
                    required
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group checkbox-group">
                  <label>
                    <input
                      type="checkbox"
                      checked={formData.all_day}
                      onChange={e =>
                        setFormData(prev => ({ ...prev, all_day: e.target.checked }))
                      }
                    />
                    종일 일정
                  </label>
                </div>
                <div className="form-group color-group">
                  <label>색상</label>
                  <input
                    type="color"
                    value={formData.color}
                    onChange={e => setFormData(prev => ({ ...prev, color: e.target.value }))}
                  />
                </div>
              </div>

              <div className="form-group">
                <label>설명</label>
                <textarea
                  value={formData.description}
                  onChange={e =>
                    setFormData(prev => ({ ...prev, description: e.target.value }))
                  }
                  placeholder="일정에 대한 설명을 입력하세요"
                  rows={3}
                />
              </div>

              <div className="form-actions">
                <button type="button" className="cancel-btn" onClick={closeModal}>
                  취소
                </button>
                <button type="submit" className="submit-btn" disabled={submitting}>
                  {submitting ? '저장 중...' : modalMode === 'create' ? '추가' : '수정'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
