/**
 * OCS 결과 보고서 페이지
 * - CONFIRMED 상태의 OCS 결과를 보기 좋게 표시
 * - 환자 정보, 검사 정보, 결과 정보 포함
 * - PDF 출력 기능 지원 (워터마크 설정 가능)
 */
import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getOCS } from '@/services/ocs.api';
import type { OCSDetail, RISWorkerResult, LISWorkerResult } from '@/types/ocs';
import { isRISWorkerResult, isLISWorkerResult } from '@/types/ocs';

// LIS 확장 결과 타입 (labResults 등 상세 페이지에서 저장하는 필드)
interface LabResultItem {
  testName: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'normal' | 'abnormal' | 'critical';
}

interface LISExtendedResult extends LISWorkerResult {
  labResults?: LabResultItem[];
  notes?: string;
  _verifiedBy?: string;
}

interface RISExtendedResult extends RISWorkerResult {
  _verifiedBy?: string;
}

// 시리즈 정보 타입
interface SeriesInfo {
  series_type: string;
  orthanc_id: string;
  description?: string;
}

// 썸네일 정보 타입
interface ThumbnailInfo {
  channel: string;
  url: string;
  description: string;
}
import { useThumbnailCache } from '@/context/ThumbnailCacheContext';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api';
import { DocumentPreview } from '@/components/pdf-preview';
import './OCSResultReportPage.css';

// 날짜 포맷
const formatDate = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

// 날짜만 포맷
const formatDateOnly = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

// 파일 크기 포맷
const formatFileSize = (bytes: number): string => {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};

export default function OCSResultReportPage() {
  const { ocsId } = useParams();
  const navigate = useNavigate();
  const [ocs, setOcs] = useState<OCSDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const { markAsCached } = useThumbnailCache();
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  const fetchOCSDetail = useCallback(async () => {
    if (!ocsId) return;

    setLoading(true);
    try {
      const data = await getOCS(parseInt(ocsId));
      setOcs(data);
      // 보고서 방문 시 캐시에 등록 (목록 페이지에서 썸네일 표시용)
      markAsCached(`ocs_${ocsId}`);
    } catch (error) {
      console.error('Failed to fetch OCS detail:', error);
      alert('결과 정보를 불러오는데 실패했습니다.');
      navigate(-1);
    } finally {
      setLoading(false);
    }
  }, [ocsId, navigate, markAsCached]);

  useEffect(() => {
    fetchOCSDetail();
  }, [fetchOCSDetail]);

  // PDF 미리보기 열기
  const handleOpenPdfPreview = () => {
    setPdfPreviewOpen(true);
  };

  // PDF 출력 (워터마크 설정 적용)
  const handleExportPDF = useCallback(async (watermarkConfig: PdfWatermarkConfig) => {
    if (!ocs) return;

    try {
      // RIS 결과 추출
      const risResult = isRISWorkerResult(ocs.worker_result) ? ocs.worker_result : null;
      const findings = risResult?.findings || '';
      const impression = risResult?.impression || '';
      const recommendation = risResult?.recommendation || '';

      // LIS 결과 추출
      const lisResult = isLISWorkerResult(ocs.worker_result) ? ocs.worker_result as LISExtendedResult : null;
      const labResults: LabResultItem[] = lisResult?.labResults || [];

      if (ocs.job_role === 'RIS') {
        // RIS PDF 생성
        const { generateRISReportPDF } = await import('@/utils/exportUtils');
        await generateRISReportPDF({
          ocsId: ocs.ocs_id,
          patientName: ocs.patient.name,
          patientNumber: ocs.patient.patient_number,
          jobType: ocs.job_type,
          findings: findings,
          impression: impression,
          recommendation: recommendation,
          tumorDetected: ocs.ocs_result === false ? true : ocs.ocs_result === true ? false : null,
          doctorName: ocs.doctor.name,
          workerName: ocs.worker?.name || '-',
          createdAt: formatDate(ocs.created_at),
          confirmedAt: ocs.confirmed_at ? formatDate(ocs.confirmed_at) : undefined,
        }, watermarkConfig);
      } else if (ocs.job_role === 'LIS') {
        // LIS PDF 생성
        const { generateLISReportPDF } = await import('@/utils/exportUtils');
        await generateLISReportPDF({
          ocsId: ocs.ocs_id,
          patientName: ocs.patient.name,
          patientNumber: ocs.patient.patient_number,
          jobType: ocs.job_type,
          results: labResults.map((item) => ({
            itemName: item.testName || '',
            value: item.value || '',
            unit: item.unit || '',
            refRange: item.refRange || '',
            flag: item.flag || 'normal',
          })),
          interpretation: lisResult?.interpretation || '',
          doctorName: ocs.doctor.name,
          workerName: ocs.worker?.name || '-',
          createdAt: formatDate(ocs.created_at),
          confirmedAt: ocs.confirmed_at ? formatDate(ocs.confirmed_at) : undefined,
        }, watermarkConfig);
      }
    } catch (err) {
      console.error('PDF 출력 실패:', err);
      alert('PDF 출력에 실패했습니다.');
    }
  }, [ocs]);

  // 뒤로가기
  const handleBack = () => {
    navigate(-1);
  };

  if (loading) {
    return (
      <div className="ocs-result-report loading">
        <p>로딩 중...</p>
      </div>
    );
  }

  if (!ocs) {
    return (
      <div className="ocs-result-report error">
        <p>결과 정보를 찾을 수 없습니다.</p>
        <button className="btn btn-secondary" onClick={handleBack}>
          돌아가기
        </button>
      </div>
    );
  }

  // worker_result 파싱
  const risResult = isRISWorkerResult(ocs.worker_result) ? ocs.worker_result as RISExtendedResult : null;
  const lisResult = isLISWorkerResult(ocs.worker_result) ? ocs.worker_result as LISExtendedResult : null;

  // LIS 결과인 경우 labResults 추출
  const labResults: LabResultItem[] = lisResult?.labResults || [];
  const interpretation = lisResult?.interpretation || '';
  const notes = lisResult?.notes || '';

  // RIS 결과인 경우
  const findings = risResult?.findings || '';
  const impression = risResult?.impression || '';
  const recommendation = risResult?.recommendation || '';

  // 확정 정보
  const verifiedBy = risResult?._verifiedBy || lisResult?._verifiedBy || ocs.worker?.name;

  // RIS DICOM 썸네일 정보 추출
  const orthancInfo = risResult?.orthanc;
  const seriesList: SeriesInfo[] = orthancInfo?.series || [];
  const channelOrder = ['T1', 'T1C', 'T2', 'FLAIR'];
  // Vite 프록시 우회: 직접 Django 서버로 요청
  const apiBaseUrl = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';
  const dicomThumbnails: ThumbnailInfo[] = seriesList
    .filter((s) => channelOrder.includes(s.series_type) && s.orthanc_id)
    .sort((a, b) => channelOrder.indexOf(a.series_type) - channelOrder.indexOf(b.series_type))
    .map((s) => ({
      channel: s.series_type,
      url: `${apiBaseUrl}/orthanc/series/${s.orthanc_id}/thumbnail/`,
      description: s.description || s.series_type,
    }));

  return (
    <div className="ocs-result-report">
      {/* 헤더 (인쇄 시 숨김) */}
      <div className="report-actions no-print">
        <button className="btn btn-secondary" onClick={handleBack}>
          돌아가기
        </button>
        <button className="btn btn-primary" onClick={handleOpenPdfPreview}>
          PDF 출력
        </button>
      </div>

      {/* 보고서 본문 */}
      <div className="report-container">
        {/* 보고서 헤더 */}
        <header className="report-header">
          <h1>검사 결과 보고서</h1>
          <div className="report-meta">
            <span className="report-id">{ocs.ocs_id}</span>
            <span className={`report-type ${ocs.job_role.toLowerCase()}`}>
              {ocs.job_role === 'RIS' ? '영상검사' :
               ocs.job_role === 'LIS' ? '임상검사' :
               ocs.job_role}
            </span>
          </div>
        </header>

        {/* 환자 정보 */}
        <section className="report-section patient-section">
          <h2>환자 정보</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>환자번호</label>
              <span>{ocs.patient.patient_number}</span>
            </div>
            <div className="info-item">
              <label>환자명</label>
              <span>{ocs.patient.name}</span>
            </div>
            <div className="info-item">
              <label>검사일</label>
              <span>{formatDateOnly(ocs.in_progress_at || ocs.accepted_at)}</span>
            </div>
            <div className="info-item">
              <label>보고일</label>
              <span>{formatDateOnly(ocs.confirmed_at)}</span>
            </div>
          </div>
        </section>

        {/* 검사 정보 */}
        <section className="report-section order-section">
          <h2>검사 정보</h2>
          <div className="info-grid">
            <div className="info-item">
              <label>검사 유형</label>
              <span>{ocs.job_type}</span>
            </div>
            <div className="info-item">
              <label>처방 의사</label>
              <span>{ocs.doctor.name}</span>
            </div>
            <div className="info-item">
              <label>검사 담당자</label>
              <span>{ocs.worker?.name || '-'}</span>
            </div>
            <div className="info-item">
              <label>우선순위</label>
              <span className={`priority-tag priority-${ocs.priority}`}>
                {ocs.priority_display}
              </span>
            </div>
          </div>

          {/* 의사 요청 사항 */}
          {ocs.doctor_request && Object.keys(ocs.doctor_request).length > 0 && (
            <div className="request-info">
              <h3>의사 요청 사항</h3>
              {ocs.doctor_request.clinical_info && (
                <div className="request-item">
                  <label>임상 정보:</label>
                  <p>{ocs.doctor_request.clinical_info}</p>
                </div>
              )}
              {ocs.doctor_request.special_instruction && (
                <div className="request-item">
                  <label>특별 지시:</label>
                  <p>{ocs.doctor_request.special_instruction}</p>
                </div>
              )}
            </div>
          )}
        </section>

        {/* 검사 결과 */}
        <section className="report-section result-section">
          <h2>검사 결과</h2>

          {/* LIS 결과 - 테이블 형식 */}
          {ocs.job_role === 'LIS' && labResults.length > 0 && (
            <div className="lab-results">
              <table className="result-table">
                <thead>
                  <tr>
                    <th>검사 항목</th>
                    <th>결과</th>
                    <th>단위</th>
                    <th>참고치</th>
                    <th>판정</th>
                  </tr>
                </thead>
                <tbody>
                  {labResults.map((item, index) => (
                    <tr
                      key={index}
                      className={
                        item.flag === 'critical' ? 'row-critical' :
                        item.flag === 'abnormal' ? 'row-abnormal' : ''
                      }
                    >
                      <td>{item.testName}</td>
                      <td className="result-value">{item.value}</td>
                      <td>{item.unit}</td>
                      <td>{item.refRange}</td>
                      <td>
                        <span className={`flag flag-${item.flag}`}>
                          {item.flag === 'normal' ? '정상' :
                           item.flag === 'abnormal' ? '비정상' :
                           item.flag === 'critical' ? '위험' : item.flag}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* RIS 결과 - 텍스트 형식 */}
          {ocs.job_role === 'RIS' && (
            <div className="imaging-results">
              {/* MRI 썸네일 (4채널 그리드) */}
              {dicomThumbnails.length > 0 && (
                <div className="mri-thumbnails">
                  <h3>MRI 영상</h3>
                  <div className="thumbnail-grid">
                    {dicomThumbnails.map((thumb) => (
                      <div key={thumb.channel} className="thumbnail-item">
                        <img
                          src={thumb.url}
                          alt={thumb.description}
                          onError={(e) => {
                            (e.target as HTMLImageElement).style.display = 'none';
                            (e.target as HTMLImageElement).nextElementSibling?.classList.add('show');
                          }}
                        />
                        <div className="thumbnail-fallback">
                          <span>{thumb.channel}</span>
                        </div>
                        <span className="thumbnail-label">{thumb.channel}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
              {findings && (
                <div className="result-block">
                  <h3>소견 (Findings)</h3>
                  <p className="result-text">{findings}</p>
                </div>
              )}
              {impression && (
                <div className="result-block">
                  <h3>인상 (Impression)</h3>
                  <p className="result-text">{impression}</p>
                </div>
              )}
              {recommendation && (
                <div className="result-block">
                  <h3>권고 사항 (Recommendation)</h3>
                  <p className="result-text">{recommendation}</p>
                </div>
              )}
            </div>
          )}

          {/* 해석/종합 소견 */}
          {interpretation && (
            <div className="result-block interpretation">
              <h3>의학적 해석</h3>
              <p className="result-text">{interpretation}</p>
            </div>
          )}

          {/* 비고 */}
          {notes && (
            <div className="result-block notes">
              <h3>비고</h3>
              <p className="result-text">{notes}</p>
            </div>
          )}

          {/* 결과가 없는 경우 JSON 표시 */}
          {labResults.length === 0 && !findings && !impression && !interpretation && (
            <div className="raw-result">
              <h3>검사 결과 데이터</h3>
              <pre className="json-viewer">
                {JSON.stringify(ocs.worker_result, null, 2)}
              </pre>
            </div>
          )}
        </section>

        {/* 첨부파일 섹션 */}
        {ocs.attachments && ocs.attachments.files && ocs.attachments.files.length > 0 && (
          <section className="report-section attachments-section">
            <h2>첨부파일</h2>
            <div className="attachments-list">
              <table className="attachments-table">
                <thead>
                  <tr>
                    <th>파일명</th>
                    <th>유형</th>
                    <th>크기</th>
                    <th className="no-print">미리보기</th>
                  </tr>
                </thead>
                <tbody>
                  {ocs.attachments.files.map((file, index) => (
                    <tr key={index}>
                      <td className="file-name">{file.name}</td>
                      <td>{file.type}</td>
                      <td>{formatFileSize(file.size)}</td>
                      <td className="no-print">
                        {file.preview === 'image' && (
                          <span className="preview-badge image">이미지</span>
                        )}
                        {file.preview === 'table' && (
                          <span className="preview-badge table">테이블</span>
                        )}
                        {file.preview === 'iframe' && (
                          <span className="preview-badge iframe">문서</span>
                        )}
                        {file.dicom_viewer_url && (
                          <a
                            href={file.dicom_viewer_url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="dicom-link"
                          >
                            DICOM 뷰어
                          </a>
                        )}
                        {file.preview === 'download' && (
                          <span className="preview-badge download">다운로드</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {ocs.attachments.total_size > 0 && (
                <div className="attachments-summary">
                  <span>총 {ocs.attachments.files.length}개 파일</span>
                  <span>전체 크기: {formatFileSize(ocs.attachments.total_size)}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {/* 확정 정보 */}
        <section className="report-section confirmation-section">
          <div className="confirmation-info">
            <div className="confirmation-item">
              <label>확정일시</label>
              <span>{formatDate(ocs.confirmed_at)}</span>
            </div>
            <div className="confirmation-item">
              <label>확정자</label>
              <span>{verifiedBy || '-'}</span>
            </div>
            <div className="confirmation-item">
              <label>결과 상태</label>
              <span className={`result-status ${ocs.ocs_result ? 'normal' : 'abnormal'}`}>
                {ocs.ocs_result ? '정상' : '비정상'}
              </span>
            </div>
          </div>
        </section>

        {/* 보고서 푸터 */}
        <footer className="report-footer">
          <p>본 보고서는 의료 목적으로만 사용되어야 하며, 의료 전문가의 해석이 필요합니다.</p>
          <p className="print-date">출력일시: {new Date().toLocaleString('ko-KR')}</p>
        </footer>
      </div>

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title={`${ocs.job_role === 'RIS' ? '영상검사' : '임상검사'} 결과 PDF 미리보기`}
      >
        {ocs && (() => {
          const previewRisResult = isRISWorkerResult(ocs.worker_result) ? ocs.worker_result : null;
          const previewLisResult = isLISWorkerResult(ocs.worker_result) ? ocs.worker_result as LISExtendedResult : null;
          const previewLabResults: LabResultItem[] = previewLisResult?.labResults || [];
          const previewFindings = previewRisResult?.findings || '';
          const previewImpression = previewRisResult?.impression || '';
          const previewRecommendation = previewRisResult?.recommendation || '';
          const previewInterpretation = previewLisResult?.interpretation || '';

          return (
            <DocumentPreview
              title={ocs.job_role === 'RIS' ? '영상 판독 보고서' : '임상검사 결과 보고서'}
              subtitle={`OCS ID: ${ocs.ocs_id}`}
              infoGrid={[
                { label: '환자번호', value: ocs.patient.patient_number },
                { label: '환자명', value: ocs.patient.name },
                { label: '검사 유형', value: ocs.job_type },
                { label: '처방 의사', value: ocs.doctor.name },
                { label: '검사 담당자', value: ocs.worker?.name || '-' },
                { label: '확정일시', value: formatDate(ocs.confirmed_at) },
              ]}
              sections={[
                // RIS 결과
                ...(ocs.job_role === 'RIS' ? [
                  ...(previewFindings ? [{
                    type: 'text' as const,
                    title: '소견 (Findings)',
                    content: previewFindings,
                  }] : []),
                  ...(previewImpression ? [{
                    type: 'text' as const,
                    title: '인상 (Impression)',
                    content: previewImpression,
                  }] : []),
                  ...(previewRecommendation ? [{
                    type: 'text' as const,
                    title: '권고 사항',
                    content: previewRecommendation,
                  }] : []),
                ] : []),
                // LIS 결과
                ...(ocs.job_role === 'LIS' && previewLabResults.length > 0 ? [{
                  type: 'table' as const,
                  title: '검사 결과',
                  columns: ['검사 항목', '결과', '단위', '참고치', '판정'],
                  rows: previewLabResults.map((item) => ({
                    '검사 항목': item.testName || '-',
                    '결과': item.value || '-',
                    '단위': item.unit || '-',
                    '참고치': item.refRange || '-',
                    '판정': item.flag === 'normal' ? '정상' : item.flag === 'abnormal' ? '비정상' : item.flag === 'critical' ? '위험' : '-',
                  })),
                }] : []),
                // 해석
                ...(previewInterpretation ? [{
                  type: 'text' as const,
                  title: '의학적 해석',
                  content: previewInterpretation,
                }] : []),
              ]}
              signature={{ label: '확정자', name: ocs.worker?.name || '-' }}
            />
          );
        })()}
      </PdfPreviewModal>
    </div>
  );
}
