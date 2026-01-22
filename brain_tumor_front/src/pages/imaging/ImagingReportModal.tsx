import { useState, useEffect } from 'react';
import { getImagingStudy, createImagingReport, updateImagingReport, signImagingReport } from '@/services/imaging.api';
import type { ImagingStudy, ImagingStudyDetailResponse, ImagingReport, ImagingReportCreateData, ImagingReportUpdateData } from '@/types/imaging';
import { useAuth } from '@/pages/auth/AuthProvider';
import '@/pages/patient/PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
  study: ImagingStudy;
};

export default function ImagingReportModal({ isOpen, onClose, onSuccess, study }: Props) {
  const { role } = useAuth();
  const isRIS = role === 'RIS';
  const isSystemManager = role === 'SYSTEMMANAGER';
  const canEdit = isRIS || isSystemManager;

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [_studyDetail, setStudyDetail] = useState<ImagingStudyDetailResponse | null>(null);
  const [existingReport, setExistingReport] = useState<ImagingReport | null>(null);
  const [isEditMode, setIsEditMode] = useState(false);

  const [formData, setFormData] = useState({
    findings: '',
    impression: '',
    tumor_detected: false,
    tumor_lobe: '',
    tumor_hemisphere: '',
    tumor_max_diameter: '',
    tumor_volume: '',
  });

  // Load study details and report
  useEffect(() => {
    if (isOpen) {
      loadStudyDetail();
    }
  }, [isOpen, study.id]);

  const loadStudyDetail = async () => {
    try {
      const detail = await getImagingStudy(study.id);
      setStudyDetail(detail);

      if (detail.report) {
        setExistingReport(detail.report);
        setFormData({
          findings: detail.report.findings,
          impression: detail.report.impression,
          tumor_detected: detail.report.tumor_detected,
          tumor_lobe: detail.report.tumor_location?.lobe || '',
          tumor_hemisphere: detail.report.tumor_location?.hemisphere || '',
          tumor_max_diameter: detail.report.tumor_size?.max_diameter_cm?.toString() || '',
          tumor_volume: detail.report.tumor_size?.volume_cc?.toString() || '',
        });
        setIsEditMode(false);
      } else {
        // No report exists, start in edit mode
        setIsEditMode(true);
      }
    } catch (err) {
      console.error('Failed to load study detail:', err);
      alert('검사 정보를 불러오는데 실패했습니다.');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!formData.findings.trim()) {
      setError('판독 소견을 입력해주세요.');
      return;
    }
    if (!formData.impression.trim()) {
      setError('판독 결론을 입력해주세요.');
      return;
    }

    setLoading(true);
    try {
      const reportData: ImagingReportCreateData | ImagingReportUpdateData = {
        ...(existingReport ? {} : { imaging_study: study.id }),
        findings: formData.findings,
        impression: formData.impression,
        tumor_detected: formData.tumor_detected,
        tumor_location: formData.tumor_detected ? {
          lobe: formData.tumor_lobe,
          hemisphere: formData.tumor_hemisphere,
        } : null,
        tumor_size: formData.tumor_detected && formData.tumor_max_diameter ? {
          max_diameter_cm: parseFloat(formData.tumor_max_diameter),
          volume_cc: formData.tumor_volume ? parseFloat(formData.tumor_volume) : 0,
        } : null,
      };

      if (existingReport) {
        await updateImagingReport(existingReport.id, reportData);
        alert('판독문이 수정되었습니다.');
      } else {
        await createImagingReport(reportData as ImagingReportCreateData);
        alert('판독문이 작성되었습니다.');
      }

      onSuccess();
    } catch (err: any) {
      console.error('Failed to save report:', err);
      console.error('Response data:', err.response?.data);
      // 서버 에러 메시지 상세 표시
      const errorData = err.response?.data;
      let errorMsg = '판독문 저장에 실패했습니다.';
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

  const handleSubmit2 = async () => {
    if (!existingReport) return;
    if (!confirm('판독문을 제출하시겠습니까?\n\n⚠️ 제출 후에는 수정이 불가능합니다.')) return;

    setLoading(true);
    try {
      await signImagingReport(existingReport.id);
      alert('판독문이 제출되었습니다.');
      onSuccess();
    } catch (err: any) {
      console.error('Failed to submit report:', err);
      alert(err.response?.data?.detail || err.response?.data?.error || '제출에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value, type } = e.target;
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked;
      setFormData(prev => ({ ...prev, [name]: checked }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  if (!isOpen) return null;

  const isSigned = existingReport?.is_signed;
  const canEditReport = canEdit && !isSigned;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div>
            <h2>영상 판독문</h2>
            {existingReport && (
              <div style={{ display: 'flex', gap: '0.5rem', marginTop: '0.5rem' }}>
                <span className={`status-badge ${isSigned ? 'status-completed' : 'status-scheduled'}`}>
                  {existingReport.status_display}
                </span>
                {isSigned && (
                  <span style={{ fontSize: '0.875rem', color: '#666' }}>
                    서명: {new Date(existingReport.signed_at!).toLocaleString('ko-KR')}
                  </span>
                )}
              </div>
            )}
          </div>
          <button className="modal-close" onClick={onClose}>×</button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body" style={{ maxHeight: '70vh', overflowY: 'auto' }}>
            {error && (
              <div className="alert alert-error" style={{ marginBottom: '1rem' }}>
                {error}
              </div>
            )}

            {/* Study Information */}
            <div style={{
              padding: '1rem',
              backgroundColor: '#f8f9fa',
              borderRadius: '8px',
              marginBottom: '1.5rem'
            }}>
              <h3 style={{ marginBottom: '0.5rem', fontSize: '1rem' }}>검사 정보</h3>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', fontSize: '0.875rem' }}>
                <div><strong>환자:</strong> {study.patient_name} ({study.patient_number})</div>
                <div><strong>검사종류:</strong> {study.modality_display}</div>
                <div><strong>촬영부위:</strong> {study.body_part}</div>
                <div><strong>오더일시:</strong> {new Date(study.ordered_at).toLocaleDateString('ko-KR')}</div>
                {study.clinical_info && (
                  <div style={{ gridColumn: '1 / -1' }}>
                    <strong>임상정보:</strong> {study.clinical_info}
                  </div>
                )}
              </div>
            </div>

            {/* Report Form */}
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="findings">판독 소견 *</label>
                <textarea
                  id="findings"
                  name="findings"
                  value={formData.findings}
                  onChange={handleChange}
                  rows={6}
                  placeholder="영상에서 관찰된 소견을 상세히 기술하세요..."
                  disabled={!isEditMode}
                  required
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="impression">판독 결론 *</label>
                <textarea
                  id="impression"
                  name="impression"
                  value={formData.impression}
                  onChange={handleChange}
                  rows={4}
                  placeholder="판독 결과에 대한 결론을 작성하세요..."
                  disabled={!isEditMode}
                  required
                  style={{ fontFamily: 'monospace', fontSize: '0.9rem' }}
                />
              </div>
            </div>

            {/* Tumor Information */}
            <div style={{
              padding: '1rem',
              border: '2px solid #e0e0e0',
              borderRadius: '8px',
              marginTop: '1rem'
            }}>
              <div className="form-row" style={{ marginBottom: '1rem' }}>
                <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1rem', fontWeight: 600 }}>
                  <input
                    type="checkbox"
                    name="tumor_detected"
                    checked={formData.tumor_detected}
                    onChange={handleChange}
                    disabled={!isEditMode}
                  />
                  종양 발견
                </label>
              </div>

              {formData.tumor_detected && (
                <>
                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="tumor_lobe">종양 위치 (Lobe)</label>
                      <input
                        type="text"
                        id="tumor_lobe"
                        name="tumor_lobe"
                        value={formData.tumor_lobe}
                        onChange={handleChange}
                        placeholder="예: 좌측 전두엽"
                        disabled={!isEditMode}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="tumor_hemisphere">반구 (Hemisphere)</label>
                      <select
                        id="tumor_hemisphere"
                        name="tumor_hemisphere"
                        value={formData.tumor_hemisphere}
                        onChange={handleChange as any}
                        disabled={!isEditMode}
                      >
                        <option value="">선택</option>
                        <option value="좌측">좌측</option>
                        <option value="우측">우측</option>
                        <option value="중앙">중앙</option>
                        <option value="양측">양측</option>
                      </select>
                    </div>
                  </div>

                  <div className="form-row" style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
                    <div className="form-group">
                      <label htmlFor="tumor_max_diameter">최대 직경 (cm)</label>
                      <input
                        type="number"
                        id="tumor_max_diameter"
                        name="tumor_max_diameter"
                        value={formData.tumor_max_diameter}
                        onChange={handleChange}
                        step="0.1"
                        min="0"
                        placeholder="0.0"
                        disabled={!isEditMode}
                      />
                    </div>

                    <div className="form-group">
                      <label htmlFor="tumor_volume">부피 (cc)</label>
                      <input
                        type="number"
                        id="tumor_volume"
                        name="tumor_volume"
                        value={formData.tumor_volume}
                        onChange={handleChange}
                        step="0.01"
                        min="0"
                        placeholder="0.00"
                        disabled={!isEditMode}
                      />
                    </div>
                  </div>
                </>
              )}
            </div>

            {existingReport && (
              <div style={{ marginTop: '1rem', padding: '0.75rem', backgroundColor: '#f8f9fa', borderRadius: '4px', fontSize: '0.875rem' }}>
                <p><strong>판독의:</strong> {existingReport.radiologist_name}</p>
                <p><strong>작성일:</strong> {new Date(existingReport.created_at).toLocaleString('ko-KR')}</p>
                {existingReport.updated_at !== existingReport.created_at && (
                  <p><strong>수정일:</strong> {new Date(existingReport.updated_at).toLocaleString('ko-KR')}</p>
                )}
              </div>
            )}
          </div>

          <div className="modal-footer" style={{ justifyContent: 'space-between' }}>
            <div>
              {existingReport && !isSigned && canEdit && !isEditMode && (
                <button
                  type="button"
                  className="btn"
                  onClick={() => setIsEditMode(true)}
                >
                  판독문 수정
                </button>
              )}
            </div>
            <div style={{ display: 'flex', gap: '0.5rem' }}>
              <button type="button" className="btn" onClick={onClose} disabled={loading}>
                닫기
              </button>
              {isEditMode && canEditReport && (
                <button type="submit" className="btn primary" disabled={loading}>
                  {loading ? '저장 중...' : '저장'}
                </button>
              )}
              {existingReport && !isSigned && canEdit && !isEditMode && (
                <button
                  type="button"
                  className="btn"
                  onClick={handleSubmit2}
                  disabled={loading}
                  style={{ backgroundColor: '#ff9800', color: 'white' }}
                >
                  제출
                </button>
              )}
              {isSigned && (
                <span style={{
                  padding: '0.5rem 1rem',
                  backgroundColor: '#e8f5e9',
                  color: '#2e7d32',
                  borderRadius: '4px',
                  fontSize: '0.875rem'
                }}>
                  제출 완료 (수정 불가)
                </span>
              )}
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
