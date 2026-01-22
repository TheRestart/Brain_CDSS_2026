import { useState, useEffect } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getPatientImagingHistory } from '@/services/imaging.api';
import { getPatient } from '@/services/patient.api';
import type { ImagingStudy } from '@/types/imaging';
import type { Patient } from '@/types/patient';
import './PatientImagingHistoryPage.css';

export default function PatientImagingHistoryPage() {
  const [searchParams] = useSearchParams();
  const patientId = searchParams.get('patient_id');

  const [patient, setPatient] = useState<Patient | null>(null);
  const [studies, setStudies] = useState<ImagingStudy[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (patientId) {
      fetchData();
    }
  }, [patientId]);

  const fetchData = async () => {
    if (!patientId) return;

    try {
      setLoading(true);
      setError('');

      // 환자 정보와 영상 히스토리 동시 조회
      const [patientData, historyResponse] = await Promise.all([
        getPatient(Number(patientId)),
        getPatientImagingHistory(Number(patientId))
      ]);

      setPatient(patientData);
      setStudies(Array.isArray(historyResponse) ? historyResponse : historyResponse.results || []);
    } catch (err) {
      console.error('Failed to fetch patient imaging history:', err);
      setError('환자 영상 히스토리 조회에 실패했습니다.');
    } finally {
      setLoading(false);
    }
  };

  const getStatusBadge = (status: string) => {
    const statusMap: Record<string, { text: string; className: string }> = {
      ordered: { text: '오더 생성', className: 'badge-info' },
      scheduled: { text: '검사 예약', className: 'badge-warning' },
      in_progress: { text: '검사 수행 중', className: 'badge-primary' },
      completed: { text: '검사 완료', className: 'badge-success' },
      reported: { text: '판독 완료', className: 'badge-completed' },
      cancelled: { text: '취소', className: 'badge-danger' },
    };
    const info = statusMap[status] || { text: status, className: 'badge-default' };
    return <span className={`badge ${info.className}`}>{info.text}</span>;
  };

  const getReportStatusBadge = (study: ImagingStudy) => {
    if (study.report) {
      if (study.report.is_signed) {
        return <span className="badge badge-success">판독 완료 (서명)</span>;
      }
      return <span className="badge badge-warning">판독 중</span>;
    }
    if (study.status === 'completed') {
      return <span className="badge badge-danger">판독 대기</span>;
    }
    return <span className="badge badge-secondary">미시행</span>;
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  const getAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const m = today.getMonth() - birth.getMonth();
    if (m < 0 || (m === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return age;
  };

  if (!patientId) {
    return (
      <div className="patient-imaging-history">
        <div className="error-message">환자 ID가 필요합니다.</div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="patient-imaging-history">
        <div className="loading">Loading...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-imaging-history">
        <div className="error-message">{error}</div>
      </div>
    );
  }

  return (
    <div className="patient-imaging-history">
      <div className="page-header">
        <h1>환자 영상 히스토리</h1>
      </div>

      {patient && (
        <section className="patient-info-panel">
          <h2>환자 정보</h2>
          <div className="patient-info-grid">
            <div className="info-item">
              <label>환자번호</label>
              <span>{patient.patient_number}</span>
            </div>
            <div className="info-item">
              <label>이름</label>
              <span>{patient.name}</span>
            </div>
            <div className="info-item">
              <label>성별</label>
              <span>{patient.gender === 'M' ? '남성' : '여성'}</span>
            </div>
            <div className="info-item">
              <label>나이</label>
              <span>{getAge(patient.birth_date)}세</span>
            </div>
            <div className="info-item">
              <label>생년월일</label>
              <span>{patient.birth_date}</span>
            </div>
            <div className="info-item">
              <label>전체 Study 수</label>
              <span className="highlight">{studies.length}건</span>
            </div>
          </div>
        </section>
      )}

      <section className="study-timeline">
        <h2>영상 검사 타임라인</h2>
        {studies.length === 0 ? (
          <div className="empty-message">영상 검사 이력이 없습니다.</div>
        ) : (
          <div className="timeline-container">
            {studies.map((study) => (
              <div key={study.id} className="timeline-item">
                <div className="timeline-marker"></div>
                <div className="timeline-content">
                  <div className="study-header">
                    <div className="study-date">{formatDate(study.ordered_at)}</div>
                    <div className="study-badges">
                      {getStatusBadge(study.status)}
                      {getReportStatusBadge(study)}
                    </div>
                  </div>
                  <div className="study-info">
                    <div className="info-row">
                      <span className="label">검사 종류:</span>
                      <span className="value modality-badge modality-{study.modality.toLowerCase()}">
                        {study.modality}
                      </span>
                    </div>
                    <div className="info-row">
                      <span className="label">촬영 부위:</span>
                      <span className="value">{study.body_part}</span>
                    </div>
                    {study.encounter && (
                      <div className="info-row">
                        <span className="label">진료:</span>
                        <span className="value">#{study.encounter}</span>
                      </div>
                    )}
                    {study.clinical_info && (
                      <div className="info-row">
                        <span className="label">임상 정보:</span>
                        <span className="value">{study.clinical_info}</span>
                      </div>
                    )}
                    {study.report && (
                      <div className="report-summary">
                        <div className="report-header">판독 소견</div>
                        <div className="report-content">
                          <div className="report-field">
                            <strong>소견:</strong>
                            <p>{study.report.findings}</p>
                          </div>
                          <div className="report-field">
                            <strong>결론:</strong>
                            <p>{study.report.impression}</p>
                          </div>
                          {study.report.tumor_detected && (
                            <div className="tumor-alert">
                              ⚠️ 종양 검출
                            </div>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <div className="study-actions">
                    <button
                      className="btn-secondary"
                      onClick={() => window.location.href = `/imaging/studies/${study.id}`}
                    >
                      상세 보기
                    </button>
                    {study.report && (
                      <button
                        className="btn-primary"
                        onClick={() => window.location.href = `/imaging/reports/${study.report?.id}`}
                      >
                        판독문 보기
                      </button>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
