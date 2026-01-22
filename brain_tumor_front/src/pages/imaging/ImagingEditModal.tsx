import { useState } from 'react';
import { updateImagingStudy, createImagingReport } from '@/services/imaging.api';
import type { ImagingStudy, ImagingStudyUpdateData, WorkNote } from '@/types/imaging';
import '@/pages/patient/PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  study: ImagingStudy;
};

// datetime-local input용 포맷 변환 (타임존 제거)
// "2026-01-12T19:30:00+09:00" -> "2026-01-12T19:30"
const toDatetimeLocalFormat = (isoString: string | null): string => {
  if (!isoString) return '';
  // 타임존 부분 제거하고 초단위까지 자르기
  return isoString.slice(0, 16);
};

// work_notes 배열을 표시용 문자열로 변환
const formatWorkNotes = (workNotes: WorkNote[] | undefined): string => {
  if (!workNotes || workNotes.length === 0) return '';
  return workNotes
    .map(note => {
      const timestamp = new Date(note.timestamp).toLocaleString('ko-KR');
      return `[${timestamp}] ${note.author}\n${note.content}`;
    })
    .join('\n\n');
};

export default function ImagingEditModal({ isOpen, onClose, onSuccess, study }: Props) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [formData, setFormData] = useState<ImagingStudyUpdateData>({
    modality: study.modality,
    body_part: study.body_part,
    status: study.status,
    scheduled_at: toDatetimeLocalFormat(study.scheduled_at),
    performed_at: toDatetimeLocalFormat(study.performed_at),
    work_note: '',  // 새 입력용 (빈 문자열로 시작)
  });

  // 기존 작업 기록 (읽기 전용) - work_notes 배열에서 변환
  const existingWorkNote = formatWorkNotes(study.work_notes);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setLoading(true);

    try {
      // 빈 문자열을 null로 변환 (datetime 필드)
      // work_note는 백엔드에서 work_notes 배열에 자동 추가됨
      const submitData = {
        ...formData,
        scheduled_at: formData.scheduled_at || null,
        performed_at: formData.performed_at || null,
        // 빈 문자열은 보내지 않음 (새 기록이 있을 때만 전송)
        work_note: formData.work_note?.trim() || undefined,
      };

      // 상태를 '판독 완료'로 변경하고 판독문이 없으면 자동 생성
      if (formData.status === 'reported' && !study.has_report) {
        // 기본 판독문 생성
        await createImagingReport({
          imaging_study: study.id,
          findings: '(자동 생성됨)',
          impression: '(자동 생성됨)',
        });
      }

      await updateImagingStudy(study.id, submitData);
      alert('영상 검사 정보가 수정되었습니다.');
      onSuccess();
    } catch (err: any) {
      console.error('영상 검사 수정 실패:', err);
      console.error('Response data:', err.response?.data);
      // 서버 에러 메시지 상세 표시
      const errorData = err.response?.data;
      let errorMsg = '수정에 실패했습니다.';
      if (errorData) {
        if (typeof errorData === 'string') {
          errorMsg = errorData;
        } else if (errorData.detail) {
          errorMsg = errorData.detail;
        } else if (errorData.error) {
          errorMsg = errorData.error;
        } else {
          // 필드별 에러 메시지 표시
          errorMsg = Object.entries(errorData)
            .map(([key, val]) => `${key}: ${Array.isArray(val) ? val.join(', ') : val}`)
            .join('\n');
        }
      }
      setError(errorMsg);
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>영상 검사 정보 수정</h2>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            <div className="form-row">
              <div className="form-group">
                <label>환자</label>
                <input
                  type="text"
                  value={`${study.patient_name} (${study.patient_number})`}
                  disabled
                  style={{ backgroundColor: '#f5f5f5' }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="modality">검사 종류</label>
                <select
                  id="modality"
                  name="modality"
                  value={formData.modality}
                  onChange={handleChange}
                >
                  <option value="MRI">MRI (Magnetic Resonance Imaging)</option>
                  <option value="CT">CT (Computed Tomography)</option>
                  <option value="PET">PET (Positron Emission Tomography)</option>
                  <option value="X-RAY">X-Ray</option>
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="body_part">촬영 부위</label>
                <input
                  type="text"
                  id="body_part"
                  name="body_part"
                  value={formData.body_part}
                  onChange={handleChange}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="status">상태</label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                >
                  <option value="ordered">오더 생성</option>
                  <option value="scheduled">검사 예약</option>
                  <option value="in_progress">검사 수행 중</option>
                  <option value="completed">검사 완료</option>
                  <option value="reported">판독 완료</option>
                  <option value="cancelled">취소</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="scheduled_at">검사 예약 일시</label>
                <input
                  type="datetime-local"
                  id="scheduled_at"
                  name="scheduled_at"
                  value={formData.scheduled_at || ''}
                  onChange={handleChange}
                />
              </div>

              <div className="form-group">
                <label htmlFor="performed_at">검사 수행 일시</label>
                <input
                  type="datetime-local"
                  id="performed_at"
                  name="performed_at"
                  value={formData.performed_at || ''}
                  onChange={handleChange}
                />
              </div>
            </div>

            {/* 의사 작성 정보 (읽기 전용) */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginTop: '1rem'
            }}>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#666' }}>
                의사 오더 정보 (읽기 전용)
              </h4>
              <div className="form-row">
                <div className="form-group">
                  <label>임상 정보</label>
                  <textarea
                    value={study.clinical_info || '(없음)'}
                    disabled
                    rows={2}
                    style={{ backgroundColor: '#e9ecef', color: '#495057' }}
                  />
                </div>
              </div>

              <div className="form-row">
                <div className="form-group">
                  <label>특별 지시사항</label>
                  <textarea
                    value={study.special_instruction || '(없음)'}
                    disabled
                    rows={2}
                    style={{ backgroundColor: '#e9ecef', color: '#495057' }}
                  />
                </div>
              </div>
            </div>

            {/* 작업중 특이사항 */}
            <div style={{ marginTop: '1rem' }}>
              <h4 style={{ marginBottom: '0.75rem', fontSize: '0.9rem', color: '#333' }}>
                작업중 특이사항
              </h4>

              {/* 기존 작업 기록 (읽기 전용) */}
              {existingWorkNote && (
                <div className="form-row">
                  <div className="form-group">
                    <label style={{ color: '#666', fontSize: '0.85rem' }}>이전 기록</label>
                    <textarea
                      value={existingWorkNote}
                      disabled
                      rows={Math.min(existingWorkNote.split('\n').length + 1, 8)}
                      style={{
                        backgroundColor: '#f5f5f5',
                        color: '#495057',
                        fontFamily: 'monospace',
                        fontSize: '0.85rem',
                        whiteSpace: 'pre-wrap',
                      }}
                    />
                  </div>
                </div>
              )}

              {/* 새 작업 기록 입력 */}
              <div className="form-row">
                <div className="form-group">
                  <label htmlFor="work_note" style={{ color: '#333', fontSize: '0.85rem' }}>
                    {existingWorkNote ? '새 기록 추가' : '기록 입력'}
                  </label>
                  <textarea
                    id="work_note"
                    name="work_note"
                    value={formData.work_note}
                    onChange={handleChange}
                    rows={3}
                    placeholder="검사 수행 중 특이사항을 입력하세요... (저장 시 타임스탬프가 자동 추가됩니다)"
                  />
                </div>
              </div>
            </div>
          </div>

          <div className="modal-footer">
            <button type="button" className="btn" onClick={onClose} disabled={loading}>
              취소
            </button>
            <button type="submit" className="btn primary" disabled={loading}>
              {loading ? '수정 중...' : '수정'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
