/**
 * RIS Study 상세 페이지 (P.75-80)
 * - 환자 정보 + Study 정보 + AI 분석 요약
 * - 판독 리포트 작성/조회/수정
 * - 검사 결과 항목 추가 기능
 * - Final 확정, EMR 전송, PDF 출력
 */
import { useState, useEffect, useRef } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getOCS, startOCS, saveOCSResult, confirmOCS, uploadRISFile } from '@/services/ocs.api';
import type { OCSDetail, RISWorkerResult } from '@/types/ocs';
import { OCS_STATUS_LABELS, isRISWorkerResult } from '@/types/ocs';
import { getErrorMessage } from '@/types/error';
import { aiApi } from '@/services/ai.api';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import AIViewerPanel from './components/AIViewerPanel';
import DicomViewerPopup, { type UploadResult, type ExistingStudyInfo } from '@/components/DicomViewerPopup';
import { getSeries } from '@/api/orthancApi';
import {
  type StoredFileInfo,
  type FileWithData,
  loadFilesWithData,
  migrateFilesToStorage,
} from '@/utils/fileStorage';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api';
import {
  DocumentPreview,
  formatDate as formatDatePreview,
} from '@/components/pdf-preview';
import './RISStudyDetailPage.css';

// 검사 결과 항목 타입
interface ImageResultItem {
  itemName: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'normal' | 'abnormal' | 'critical';
}

// 업로드 파일 타입 (LocalStorage 참조 방식)
// StoredFileInfo: worker_result에 저장되는 정보 (storageKey만 포함, dataUrl 제외)
// FileWithData: UI에서 사용하는 정보 (dataUrl 포함)

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

// 탭 타입
type TabType = 'info' | 'report' | 'result' | 'history';

export default function RISStudyDetailPage() {
  const { ocsId } = useParams<{ ocsId: string }>();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();

  const [ocsDetail, setOcsDetail] = useState<OCSDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<TabType>('info');
  const [saving, setSaving] = useState(false);

  // Report form state
  const [findings, setFindings] = useState('');
  const [impression, setImpression] = useState('');
  const [recommendation, setRecommendation] = useState('');
  const [tumorDetected, setTumorDetected] = useState<boolean | null>(null); // 뇌종양 유무

  // 검사 결과 항목
  const [imageResults, setImageResults] = useState<ImageResultItem[]>([]);

  // 파일 업로드 (LocalStorage 참조 방식)
  // uploadedFiles: UI 표시용 (dataUrl 포함)
  // 저장 시에는 StoredFileInfo로 변환 (dataUrl 제외, storageKey만 저장)
  const [uploadedFiles, setUploadedFiles] = useState<FileWithData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // DICOM 뷰어 팝업
  const [viewerOpen, setViewerOpen] = useState(false);

  // AI 추론 상태
  const [_aiInferenceStatus, setAiInferenceStatus] = useState<'none' | 'pending' | 'processing' | 'completed' | 'failed'>('none');
  const [aiJobId, setAiJobId] = useState<string | null>(null);
  const [aiRequesting, setAiRequesting] = useState(false);

  // PDF 미리보기 모달
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);
  const [previewThumbnails, setPreviewThumbnails] = useState<Array<{ channel: string; url: string }>>([]);

  // URL 쿼리 파라미터 처리 (tab, openViewer)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['info', 'report', 'result', 'history'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
    const openViewerParam = searchParams.get('openViewer');
    if (openViewerParam === 'true') {
      setViewerOpen(true);
    }
  }, [searchParams]);

  // OCS 상세 조회
  useEffect(() => {
    const fetchDetail = async () => {
      if (!ocsId) return;
      setLoading(true);
      try {
        const data = await getOCS(Number(ocsId));
        setOcsDetail(data);

        // 기존 결과가 있으면 폼에 로드
        if (isRISWorkerResult(data.worker_result)) {
          const result = data.worker_result;
          setFindings(result.findings || '');
          setImpression(result.impression || '');
          setRecommendation(result.recommendation || '');
          // 뇌종양 유무 로드
          setTumorDetected(result.tumorDetected ?? null);
          // 검사 결과 항목 로드
          if (result.imageResults) {
            setImageResults(result.imageResults);
          }
          // 파일 로드 (LocalStorage에서 dataUrl 복원)
          if (result.files && result.files.length > 0) {
            const storedFiles = result.files;
            // 기존 형식(dataUrl 직접 저장)에서 새 형식으로 마이그레이션
            const migratedFiles = migrateFilesToStorage(storedFiles, data.id);
            // LocalStorage에서 dataUrl 로드하여 UI용 데이터 생성
            const filesWithData = loadFilesWithData(migratedFiles);
            setUploadedFiles(filesWithData);
          }
        }
      } catch (error) {
        console.error('Failed to fetch OCS detail:', error);
        alert('상세 정보를 불러오는데 실패했습니다.');
      } finally {
        setLoading(false);
      }
    };

    fetchDetail();
  }, [ocsId]);

  // 결과 항목 추가
  const handleAddResult = () => {
    setImageResults([
      ...imageResults,
      { itemName: '', value: '', unit: '', refRange: '', flag: 'normal' },
    ]);
  };

  // 결과 항목 변경
  const handleResultChange = (index: number, field: keyof ImageResultItem, value: string) => {
    const updated = [...imageResults];
    updated[index] = { ...updated[index], [field]: value };
    setImageResults(updated);
  };

  // 결과 항목 삭제
  const handleRemoveResult = (index: number) => {
    setImageResults(imageResults.filter((_, i) => i !== index));
  };

  // 파일 업로드 핸들러 (서버에 저장)
  // RIS 파일 용량 제한: 100MB
  const MAX_FILE_SIZE_MB = 100;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || !ocsDetail) return;

    // 파일별로 서버에 업로드
    for (const file of Array.from(files)) {
      // 용량 검증
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`파일 용량 초과: ${file.name}\n최대 ${MAX_FILE_SIZE_MB}MB까지 업로드 가능합니다.\n(현재: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
        continue;
      }

      try {
        const response = await uploadRISFile(ocsDetail.id, file);

        // 서버 응답에서 파일 정보 추출
        if (response.file) {
          const fileWithData: FileWithData = {
            name: response.file.name,
            size: response.file.size,
            type: response.file.content_type,
            uploadedAt: response.file.uploaded_at,
            storageKey: response.file.storage_path || response.file.full_path || '',
          };
          setUploadedFiles((prev) => [...prev, fileWithData]);
        }
      } catch (error) {
        console.error('파일 업로드 실패:', file.name, error);
        alert(`파일 업로드 실패: ${file.name}\n${getErrorMessage(error)}`);
      }
    }

    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 파일 삭제 (UI에서만 제거 - 서버 삭제 API 필요 시 추가 구현)
  const handleRemoveFile = (index: number) => {
    // TODO: 서버에서 파일 삭제 API 호출 필요
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 판독 시작
  const handleStartReading = async () => {
    if (!ocsDetail) return;
    try {
      await startOCS(ocsDetail.id);
      // 상태 갱신
      const updated = await getOCS(ocsDetail.id);
      setOcsDetail(updated);
      setActiveTab('report');
      alert('판독을 시작합니다.');
    } catch (error) {
      console.error('Failed to start reading:', error);
      alert('판독 시작에 실패했습니다.');
    }
  };

  // 파일 목록을 저장용으로 변환 (dataUrl 제외, storageKey만 포함)
  const getFilesForStorage = (): StoredFileInfo[] => {
    return uploadedFiles.map(({ name, size, type, uploadedAt, storageKey }) => ({
      name,
      size,
      type,
      uploadedAt,
      storageKey: storageKey || '',
    }));
  };

  // orthanc 정보 추출 헬퍼 함수
  const getOrthancInfo = () => {
    if (isRISWorkerResult(ocsDetail?.worker_result)) {
      return ocsDetail.worker_result.orthanc || null;
    }
    return null;
  };

  // orthanc 시리즈에서 총 인스턴스 수 계산
  const calculateTotalInstances = (orthancInfo: RISWorkerResult['orthanc']) => {
    if (!orthancInfo?.series) return 0;
    return orthancInfo.series.reduce((sum, s) => sum + (s.instances_count || 0), 0);
  };

  // 임시 저장
  const handleSaveDraft = async () => {
    if (!ocsDetail) return;
    setSaving(true);
    try {
      // orthanc 정보를 기준으로 dicom 정보 생성 (중복 제거)
      const orthancInfo = getOrthancInfo();

      const workerResult = {
        _template: 'RIS' as const,
        _version: '1.2',  // 버전 업데이트 (LocalStorage 파일 저장 방식)
        _confirmed: false,
        findings,
        impression,
        recommendation,
        tumorDetected,  // 뇌종양 유무
        imageResults,
        // 파일: dataUrl 제외, storageKey만 저장
        files: getFilesForStorage(),
        // orthanc 정보를 주 저장소로 사용
        orthanc: orthancInfo,
        // dicom 필드는 호환성을 위해 최소 정보만 유지 (orthanc에서 파생)
        dicom: orthancInfo ? {
          study_uid: orthancInfo.study_uid || '',
          series_count: orthancInfo.series?.length || 0,
          instance_count: calculateTotalInstances(orthancInfo),
        } : { study_uid: '', series_count: 0, instance_count: 0 },
        _custom: {},
        _savedAt: new Date().toISOString(),
      };

      await saveOCSResult(ocsDetail.id, { worker_result: workerResult });
      alert('임시 저장되었습니다.');

      // 상태 갱신
      const updated = await getOCS(ocsDetail.id);
      setOcsDetail(updated);
    } catch (error) {
      console.error('Failed to save draft:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // Final 저장 (결과 제출 및 확정)
  const handleSubmitFinal = async () => {
    if (!ocsDetail) return;

    // DICOM 영상 업로드 여부 확인
    const orthancInfo = getOrthancInfo();
    if (!orthancInfo?.orthanc_study_id) {
      alert('DICOM 영상을 먼저 업로드해주세요.\n"검사 결과" 탭에서 "DICOM Viewer & Upload" 버튼을 클릭하여 영상을 업로드할 수 있습니다.');
      return;
    }

    if (!findings.trim() || !impression.trim()) {
      alert('판독 소견과 결론은 필수 입력입니다.');
      return;
    }

    // 뇌종양 유무 선택 확인
    if (tumorDetected === null) {
      if (!confirm('뇌종양 판정 결과가 "미판정" 상태입니다. 계속하시겠습니까?')) {
        return;
      }
    }

    if (!confirm('Final 저장 후에는 수정이 불가능합니다. 계속하시겠습니까?')) {
      return;
    }

    setSaving(true);
    try {
      // orthanc 정보를 기준으로 dicom 정보 생성 (중복 제거)
      const orthancInfo = getOrthancInfo();

      const workerResult = {
        _template: 'RIS' as const,
        _version: '1.2',  // 버전 업데이트 (LocalStorage 파일 저장 방식)
        _confirmed: true,
        findings,
        impression,
        recommendation,
        tumorDetected,  // 뇌종양 유무
        imageResults,
        // 파일: dataUrl 제외, storageKey만 저장
        files: getFilesForStorage(),
        // orthanc 정보를 주 저장소로 사용
        orthanc: orthancInfo,
        // dicom 필드는 호환성을 위해 최소 정보만 유지 (orthanc에서 파생)
        dicom: orthancInfo ? {
          study_uid: orthancInfo.study_uid || '',
          series_count: orthancInfo.series?.length || 0,
          instance_count: calculateTotalInstances(orthancInfo),
        } : { study_uid: '', series_count: 0, instance_count: 0 },
        _custom: {},
        _verifiedAt: new Date().toISOString(),
        _verifiedBy: user?.name,
      };

      // RIS도 결과 제출 시 바로 확정 처리 (ocs_result에 tumorDetected 전달)
      await confirmOCS(ocsDetail.id, { worker_result: workerResult, ocs_result: tumorDetected });
      alert('Final 저장 및 확정이 완료되었습니다.');

      // 상태 갱신
      const updated = await getOCS(ocsDetail.id);
      setOcsDetail(updated);
    } catch (error) {
      console.error('Failed to submit final:', error);
      alert('Final 저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // EMR 전송 (목업)
  const handleSendToEMR = () => {
    alert('EMR 전송 기능은 준비 중입니다.');
  };

  // PDF 미리보기 열기
  const handleOpenPdfPreview = async () => {
    setPdfPreviewOpen(true);

    // 미리보기용 썸네일 로드
    if (ocsDetail) {
      const orthancInfo = getOrthancInfo();
      if (orthancInfo?.series && orthancInfo.series.length > 0) {
        try {
          const { getSeriesPreviewBase64 } = await import('@/api/orthancApi');
          const thumbs: Array<{ channel: string; url: string }> = [];

          for (const series of orthancInfo.series) {
            const seriesId = series.orthanc_id;
            const seriesLabel = series.series_type || series.description || 'DICOM';
            if (seriesId && seriesLabel !== 'SEG') {
              try {
                const base64 = await getSeriesPreviewBase64(seriesId);
                if (base64) {
                  thumbs.push({ channel: seriesLabel, url: base64 });
                }
              } catch (e) {
                console.error('썸네일 로드 실패:', seriesLabel, e);
              }
            }
          }
          setPreviewThumbnails(thumbs);
        } catch (e) {
          console.error('썸네일 로드 실패:', e);
        }
      }
    }
  };

  // PDF 출력 (워터마크 설정 적용)
  const handleExportPDF = async (watermarkConfig: PdfWatermarkConfig) => {
    if (!ocsDetail) return;

    console.log('[RIS PDF] PDF 출력 시작, OCS ID:', ocsDetail.ocs_id);

    try {
      const { generateRISReportPDF } = await import('@/utils/exportUtils');

      // 미리보기에서 이미 로드한 썸네일 재사용 (미리보기와 동일한 이미지 보장)
      const thumbnails = previewThumbnails.map(t => ({
        channel: t.channel,
        dataUrl: t.url,
        description: '',
      }));

      console.log(`[RIS PDF] 미리보기 썸네일 사용: ${thumbnails.length}개`);
      console.log('[RIS PDF] PDF 생성 중...');

      await generateRISReportPDF({
        ocsId: ocsDetail.ocs_id,
        patientName: ocsDetail.patient.name,
        patientNumber: ocsDetail.patient.patient_number,
        jobType: ocsDetail.job_type,
        findings: findings || (ocsDetail.worker_result as RISWorkerResult)?.findings || '',
        impression: impression || (ocsDetail.worker_result as RISWorkerResult)?.impression || '',
        recommendation: recommendation || (ocsDetail.worker_result as RISWorkerResult)?.recommendation || '',
        tumorDetected: tumorDetected ?? (isRISWorkerResult(ocsDetail.worker_result) ? ocsDetail.worker_result.tumorDetected : null) ?? null,
        doctorName: ocsDetail.doctor.name,
        workerName: ocsDetail.worker?.name || '-',
        createdAt: formatDate(ocsDetail.created_at),
        confirmedAt: ocsDetail.result_ready_at ? formatDate(ocsDetail.result_ready_at) : undefined,
        thumbnails: thumbnails.length > 0 ? thumbnails : undefined,
      }, watermarkConfig);

      console.log('[RIS PDF] PDF 출력 완료');
    } catch (error) {
      const errorMsg = getErrorMessage(error);
      console.error('[RIS PDF] PDF 출력 실패:', errorMsg, error);
      alert(`PDF 출력에 실패했습니다.\n\n오류: ${errorMsg}\n\njspdf 패키지가 설치되어 있는지 확인하세요.`);
    }
  };

  // DICOM Viewer 열기
  const handleOpenViewer = () => {
    setViewerOpen(true);
  };

  // M1 AI 추론 요청
  const handleRequestAIInference = async () => {
    if (!ocsDetail) return;

    // DICOM 정보 확인
    const orthancInfo = getOrthancInfo();
    const dicomInfo = isRISWorkerResult(ocsDetail.worker_result) ? ocsDetail.worker_result.dicom : null;
    const studyUid = orthancInfo?.study_uid || dicomInfo?.study_uid;

    if (!studyUid) {
      alert('DICOM 영상 정보가 없습니다.\nDICOM Viewer에서 영상을 먼저 업로드해주세요.');
      return;
    }

    if (!confirm('M1 AI 분석을 요청하시겠습니까?\n분석에는 수 분이 소요될 수 있습니다.')) {
      return;
    }

    setAiRequesting(true);
    try {
      const response = await aiApi.requestM1Inference(ocsDetail.id, 'manual');

      if (response.cached) {
        // 캐시된 결과
        setAiInferenceStatus('completed');
        setAiJobId(response.job_id);
        alert(`기존 분석 결과가 있습니다.\nJob ID: ${response.job_id}`);
      } else {
        // 새 추론 시작
        setAiInferenceStatus('processing');
        setAiJobId(response.job_id);
        alert(`M1 AI 분석이 시작되었습니다.\nJob ID: ${response.job_id}\n완료 시 알림을 받게 됩니다.`);
      }

      // OCS 상세 새로고침
      const updated = await getOCS(ocsDetail.id);
      setOcsDetail(updated);
    } catch (error) {
      console.error('AI 추론 요청 실패:', error);
      const errorMessage = getErrorMessage(error);
      alert(`AI 분석 요청 실패: ${errorMessage}`);
      setAiInferenceStatus('failed');
    } finally {
      setAiRequesting(false);
    }
  };

  // 기존 업로드된 Study 정보 추출 (worker_result.orthanc에서)
  const getExistingStudyInfo = (): ExistingStudyInfo | undefined => {
    const orthancInfo = getOrthancInfo();
    if (!orthancInfo?.orthanc_study_id) return undefined;

    const dicomInfo = isRISWorkerResult(ocsDetail?.worker_result) ? ocsDetail.worker_result.dicom : null;

    return {
      orthanc_study_id: orthancInfo.orthanc_study_id,
      study_uid: orthancInfo.study_uid || '',
      patient_id: orthancInfo.patient_id || '',
      series_count: dicomInfo?.series_count || orthancInfo.series?.length || 0,
      instance_count: dicomInfo?.instance_count || 0,
      uploaded_at: orthancInfo.uploaded_at || '',
    };
  };

  // 기존 Study 삭제 완료 핸들러 (worker_result에서 orthanc/dicom 정보 제거)
  const handleStudyDeleted = async () => {
    if (!ocsDetail) return;

    try {
      const currentResult = (ocsDetail.worker_result as RISWorkerResult) || {};

      // orthanc, dicom 정보를 초기화한 새 worker_result
      const updatedResult = {
        ...currentResult,
        _template: 'RIS',
        _version: '1.2',
        // dicom 필드는 호환성을 위해 최소 정보만 유지
        dicom: {
          study_uid: '',
          series_count: 0,
          instance_count: 0,
        },
        orthanc: null,  // 삭제됨
        _savedAt: new Date().toISOString(),
      };

      await saveOCSResult(ocsDetail.id, { worker_result: updatedResult });

      // 상태 갱신
      const updated = await getOCS(ocsDetail.id);
      setOcsDetail(updated);

      alert('기존 영상 정보가 삭제되었습니다.');
    } catch (error) {
      console.error('Failed to clear DICOM info:', error);
      alert('영상 정보 삭제에 실패했습니다.');
    }
  };

  // DICOM 업로드 완료 시 worker_result에 Orthanc 정보 저장
  // 현재 폼 상태(findings, impression 등)를 보존하면서 orthanc 정보만 업데이트
  const handleUploadComplete = async (result: UploadResult) => {
    if (!ocsDetail) return;

    try {
      const currentResult = (ocsDetail.worker_result as RISWorkerResult) || {};

      // Orthanc에서 시리즈 정보 가져오기 (series_id, series_type 포함)
      interface LocalSeriesInfo {
        series_id: string;
        series_uid: string;
        series_type: string;
        modality: string;
        description: string;
        instance_count: number;
      }
      let seriesInfoList: LocalSeriesInfo[] = [];
      let totalInstanceCount = 0;

      // orthancStudyId가 있으면 해당 Study의 시리즈 정보 조회
      // orthancStudyId = Orthanc Internal Study ID (실제 API 호출에 사용)
      // studyId = DICOM StudyID (UUID, Orthanc API에서 사용 불가)
      const orthancStudyId = result.orthancStudyId;
      if (orthancStudyId) {
        try {
          // getSeries는 Orthanc Internal Study ID를 파라미터로 받음
          interface SeriesInfo {
            orthancId: string;
            seriesInstanceUID?: string;
            seriesType?: string;
            modality?: string;
            description?: string;
            instancesCount?: number;
          }
          const seriesData: SeriesInfo[] = await getSeries(orthancStudyId);
          seriesInfoList = seriesData.map((s) => ({
            series_id: s.orthancId,           // Orthanc Series ID
            series_uid: s.seriesInstanceUID || '',
            series_type: s.seriesType || 'OTHER',  // T1, T2, T1C, FLAIR, OTHER
            modality: s.modality || '',
            description: s.description || '',
            instance_count: s.instancesCount || 0,
          }));
          totalInstanceCount = seriesInfoList.reduce((sum, s) => sum + (s.instance_count || 0), 0);
        } catch (e) {
          console.warn('Failed to fetch series info from Orthanc:', e);
        }
      }

      // orthanc 정보 구성 (주 저장소)
      const orthancInfo = {
        patient_id: result.patientId,
        orthanc_study_id: result.orthancStudyId,  // Orthanc Internal Study ID
        study_id: result.studyId,  // DICOM StudyID (UUID)
        study_uid: result.studyUid,
        series: seriesInfoList.map((s) => ({
          orthanc_id: s.series_id,
          series_uid: s.series_uid,
          series_type: s.series_type,
          description: s.description,
          instances_count: s.instance_count,
        })),
        uploaded_at: new Date().toISOString(),
      };

      // 현재 폼 상태와 기존 저장된 데이터를 병합
      const updatedResult = {
        _template: 'RIS' as const,
        _version: '1.2',  // 버전 업데이트 (중복 필드 제거, LocalStorage 파일 저장)
        _confirmed: currentResult._confirmed || false,
        // 현재 폼 상태 우선 사용 (사용자가 입력 중일 수 있음)
        findings: findings || currentResult.findings || '',
        impression: impression || currentResult.impression || '',
        recommendation: recommendation || currentResult.recommendation || '',
        tumorDetected: tumorDetected ?? currentResult.tumorDetected ?? null,
        imageResults: imageResults.length > 0 ? imageResults : currentResult.imageResults || [],
        // 파일: dataUrl 제외, storageKey만 저장
        files: uploadedFiles.length > 0 ? getFilesForStorage() : currentResult.files || [],
        // orthanc 정보를 주 저장소로 사용
        orthanc: orthancInfo,
        // dicom 필드는 호환성을 위해 최소 정보만 유지 (orthanc에서 파생)
        dicom: {
          study_uid: result.studyUid || '',
          series_count: seriesInfoList.length,
          instance_count: totalInstanceCount,
        },
        _custom: currentResult._custom || {},
        _savedAt: new Date().toISOString(),
      };

      await saveOCSResult(ocsDetail.id, { worker_result: updatedResult });

      // 상태 갱신
      const updated = await getOCS(ocsDetail.id);
      setOcsDetail(updated);

      alert('DICOM 영상 정보가 저장되었습니다.');
    } catch (error) {
      console.error('Failed to save DICOM info:', error);
      alert('DICOM 정보 저장에 실패했습니다.');
    }
  };

  if (loading) {
    return <div className="page ris-study-detail loading">로딩 중...</div>;
  }

  if (!ocsDetail) {
    return <div className="page ris-study-detail error">데이터를 찾을 수 없습니다.</div>;
  }

  const isMyWork = ocsDetail.worker?.id === user?.id;
  const canEdit = isMyWork && ['ACCEPTED', 'IN_PROGRESS'].includes(ocsDetail.ocs_status);
  const isFinalized = ['RESULT_READY', 'CONFIRMED'].includes(ocsDetail.ocs_status);
  const workerResult = ocsDetail.worker_result as RISWorkerResult | null;

  return (
    <div className="page ris-study-detail">
      {/* 헤더 */}
      <header className="detail-header">
        <div className="header-left">
          <button className="btn btn-back" onClick={() => navigate(-1)}>
            &larr; 목록으로
          </button>
          <h2>영상 판독 상세</h2>
          <span className={`status-badge status-${ocsDetail.ocs_status.toLowerCase()}`}>
            {OCS_STATUS_LABELS[ocsDetail.ocs_status]}
          </span>
        </div>
        <div className="header-right">
          {ocsDetail.ocs_status === 'ACCEPTED' && isMyWork && (
            <button className="btn btn-primary" onClick={handleStartReading}>
              판독 시작
            </button>
          )}
          {ocsDetail.ocs_status === 'ORDERED' && (
            <span className="info-text">접수 대기 중</span>
          )}
          {canEdit && !isFinalized && (
            <>
              <button
                className="btn btn-secondary"
                onClick={handleSaveDraft}
                disabled={saving}
              >
                {saving ? '저장 중...' : '임시 저장'}
              </button>
              <button
                className="btn btn-primary"
                onClick={handleSubmitFinal}
                disabled={saving}
              >
                {saving ? '저장 중...' : '결과 제출'}
              </button>
            </>
          )}
          {isFinalized && (
            <>
              {/* AI 분석 요청 버튼 (CONFIRMED 상태에서만) */}
              {ocsDetail.ocs_status === 'CONFIRMED' && (
                <button
                  className="btn btn-ai"
                  onClick={handleRequestAIInference}
                  disabled={aiRequesting}
                  title="M1 추론 요청"
                >
                  {aiRequesting && aiJobId
                    ? `'${aiJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
                    : 'M1 추론'}
                </button>
              )}
              <button className="btn btn-success" onClick={handleSendToEMR}>
                EMR 전송
              </button>
              <button className="btn btn-secondary" onClick={handleOpenPdfPreview}>
                PDF 출력
              </button>
            </>
          )}
        </div>
      </header>

      {/* 환자 정보 바 */}
      <section className="patient-info-bar">
        <div className="info-item">
          <label>환자명</label>
          <span>{ocsDetail.patient.name}</span>
        </div>
        <div className="info-item">
          <label>환자번호</label>
          <span>{ocsDetail.patient.patient_number}</span>
        </div>
        <div className="info-item">
          <label>검사 유형</label>
          <span>{ocsDetail.job_type}</span>
        </div>
        <div className="info-item">
          <label>처방 의사</label>
          <span>{ocsDetail.doctor.name}</span>
        </div>
        <div className="info-item">
          <label>처방일시</label>
          <span>{formatDate(ocsDetail.created_at)}</span>
        </div>
        <div className="info-item">
          <label>담당자</label>
          <span>{ocsDetail.worker?.name || '미배정'}</span>
        </div>
      </section>

      {/* 탭 영역 */}
      <nav className="tab-nav">
        <button
          className={`tab-btn ${activeTab === 'info' ? 'active' : ''}`}
          onClick={() => setActiveTab('info')}
        >
          검사 정보
        </button>
        <button
          className={`tab-btn ${activeTab === 'report' ? 'active' : ''}`}
          onClick={() => setActiveTab('report')}
        >
          판독 리포트
        </button>
        <button
          className={`tab-btn ${activeTab === 'result' ? 'active' : ''}`}
          onClick={() => setActiveTab('result')}
        >
          검사 결과
        </button>
        <button
          className={`tab-btn ${activeTab === 'history' ? 'active' : ''}`}
          onClick={() => setActiveTab('history')}
        >
          이력
        </button>
      </nav>

      {/* 탭 콘텐츠 */}
      <div className="tab-content">
        {/* 검사 정보 탭 */}
        {activeTab === 'info' && (
          <div className="tab-panel info-panel">
            <div className="panel-row">
              {/* 좌측: 오더 정보 */}
              <div className="panel-section order-info">
                <h3>오더 정보</h3>
                <div className="info-grid">
                  <div className="info-row">
                    <label>OCS ID</label>
                    <span>{ocsDetail.ocs_id}</span>
                  </div>
                  <div className="info-row">
                    <label>우선순위</label>
                    <span className={`priority-badge priority-${ocsDetail.priority}`}>
                      {ocsDetail.priority_display}
                    </span>
                  </div>
                  <div className="info-row">
                    <label>주호소</label>
                    <span>{ocsDetail.doctor_request?.chief_complaint || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>임상 정보</label>
                    <span>{ocsDetail.doctor_request?.clinical_info || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>검사 요청</label>
                    <span>{ocsDetail.doctor_request?.request_detail || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>특별 지시</label>
                    <span>{ocsDetail.doctor_request?.special_instruction || '-'}</span>
                  </div>
                </div>
              </div>

              {/* 우측: AI 분석 결과 */}
              <div className="panel-section ai-section">
                <AIAnalysisPanel ocsId={ocsDetail.id} patientId={ocsDetail.patient.id} jobType={ocsDetail.job_type} />
              </div>
            </div>

            {/* Orthanc 업로드 정보 (DicomViewerPopup에서 업로드한 정보) */}
            {workerResult?.orthanc && (
              <div className="panel-section orthanc-info">
                <h3>Orthanc 영상 정보</h3>
                <div className="info-grid">
                  <div className="info-row">
                    <label>Patient ID</label>
                    <span className="mono">{workerResult.orthanc.patient_id || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>Study UID</label>
                    <span className="mono">{workerResult.orthanc.study_uid || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>Study ID (Orthanc)</label>
                    <span className="mono">{workerResult.orthanc.study_id || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>업로드 일시</label>
                    <span>{formatDate(workerResult.orthanc.uploaded_at)}</span>
                  </div>
                  {workerResult.orthanc.series && workerResult.orthanc.series.length > 0 && (
                    <div className="info-row series-row">
                      <label>Series ({workerResult.orthanc.series.length}개)</label>
                      <div className="series-list">
                        {workerResult.orthanc.series.map((s, idx) => (
                          <div key={idx} className="series-item">
                            <span className="mono">{s.orthanc_id}</span>
                            {s.description && <span className="desc">{s.description}</span>}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* DICOM 정보 (기존 dicom 필드) */}
            {workerResult?.dicom && workerResult.dicom.study_uid && (
              <div className="panel-section dicom-info">
                <h3>DICOM 정보</h3>
                <div className="info-grid">
                  <div className="info-row">
                    <label>Study UID</label>
                    <span className="mono text-ellipsis">{workerResult.dicom.study_uid || '-'}</span>
                  </div>
                  <div className="info-row">
                    <label>Series / Instance</label>
                    <span>{workerResult.dicom.series_count || 0}개 시리즈 / {workerResult.dicom.instance_count || 0}장</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* 판독 리포트 탭 */}
        {activeTab === 'report' && (
          <div className="tab-panel report-panel">
            {/* 판독 폼 */}
            <div className="report-form">
              {/* 뇌종양 유무 체크 */}
              <div className="form-group tumor-detection-group">
                <label>뇌종양 판정 결과 *</label>
                <div className="tumor-detection-options">
                  <label className={`tumor-option ${tumorDetected === true ? 'selected positive' : ''}`}>
                    <input
                      type="radio"
                      name="tumorDetected"
                      checked={tumorDetected === true}
                      onChange={() => setTumorDetected(true)}
                      disabled={!canEdit || isFinalized}
                    />
                    <span className="option-icon">+</span>
                    <span className="option-label">종양 있음</span>
                  </label>
                  <label className={`tumor-option ${tumorDetected === false ? 'selected negative' : ''}`}>
                    <input
                      type="radio"
                      name="tumorDetected"
                      checked={tumorDetected === false}
                      onChange={() => setTumorDetected(false)}
                      disabled={!canEdit || isFinalized}
                    />
                    <span className="option-icon">-</span>
                    <span className="option-label">종양 없음</span>
                  </label>
                  <label className={`tumor-option ${tumorDetected === null ? 'selected undetermined' : ''}`}>
                    <input
                      type="radio"
                      name="tumorDetected"
                      checked={tumorDetected === null}
                      onChange={() => setTumorDetected(null)}
                      disabled={!canEdit || isFinalized}
                    />
                    <span className="option-icon">?</span>
                    <span className="option-label">미판정</span>
                  </label>
                </div>
              </div>

              <div className="form-group">
                <label>판독 소견 (Findings) *</label>
                <textarea
                  value={findings}
                  onChange={(e) => setFindings(e.target.value)}
                  placeholder="영상에서 관찰된 소견을 입력하세요..."
                  rows={6}
                  disabled={!canEdit || isFinalized}
                />
              </div>

              <div className="form-group">
                <label>판독 결론 (Impression) *</label>
                <textarea
                  value={impression}
                  onChange={(e) => setImpression(e.target.value)}
                  placeholder="최종 판독 결론을 입력하세요..."
                  rows={4}
                  disabled={!canEdit || isFinalized}
                />
              </div>

              <div className="form-group">
                <label>권고 사항 (Recommendation)</label>
                <textarea
                  value={recommendation}
                  onChange={(e) => setRecommendation(e.target.value)}
                  placeholder="추가 검사 권고 등..."
                  rows={2}
                  disabled={!canEdit || isFinalized}
                />
              </div>

              {isFinalized && (
                <div className="finalized-info">
                  <p>이 리포트는 Final 저장되어 수정이 불가능합니다.</p>
                  <p>확정일시: {formatDate(ocsDetail.result_ready_at)}</p>
                </div>
              )}
            </div>
          </div>
        )}

        {/* 검사 결과 탭 */}
        {activeTab === 'result' && (
          <div className="tab-panel result-panel">
            {/* DICOM Viewer & Upload 섹션 */}
            <div className="viewer-section">
              <button className="btn btn-secondary" onClick={handleOpenViewer}>
                DICOM Viewer & Upload
              </button>
            </div>

            {/* 파일 업로드 섹션 */}
            <div className="file-upload-section">
              <div className="section-header">
                <h3>결과 파일 첨부</h3>
                {canEdit && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.dcm,.dicom,.txt,.csv,.json,.tsv"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="ris-file-upload"
                    />
                    <label htmlFor="ris-file-upload" className="btn btn-secondary btn-sm">
                      파일 선택
                    </label>
                  </>
                )}
              </div>

              {uploadedFiles.length > 0 ? (
                <ul className="file-list">
                  {uploadedFiles.map((file, index) => (
                    <li key={index} className="file-item">
                      <span className="file-icon">
                        {file.type.includes('pdf') ? '📄' :
                         file.type.includes('image') ? '🖼️' :
                         file.type.includes('dicom') ? '🩻' : '📎'}
                      </span>
                      <span className="file-name">{file.name}</span>
                      <span className="file-size">{formatFileSize(file.size)}</span>
                      {canEdit && (
                        <button
                          className="btn btn-sm btn-danger"
                          onClick={() => handleRemoveFile(index)}
                        >
                          삭제
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              ) : (
                <div className="no-files">
                  <p>첨부된 파일이 없습니다. {canEdit && '파일을 업로드하세요.'}</p>
                  <p className="allowed-extensions">
                    허용 확장자: PDF, JPG, PNG, DICOM, TXT, CSV, JSON, TSV
                  </p>
                </div>
              )}
            </div>

            {/* AI 분석 뷰어 */}
            <AIViewerPanel ocsId={ocsDetail.id} patientId={ocsDetail.patient.id} />

            {/* 검사 결과 항목 */}
            <div className="result-items-section">
              <div className="section-header">
                <h3>검사 결과 입력</h3>
                {canEdit && (
                  <button className="btn btn-primary btn-sm" onClick={handleAddResult}>
                    + 항목 추가
                  </button>
                )}
              </div>

              <table className="result-table">
                <thead>
                  <tr>
                    <th>검사 항목</th>
                    <th>결과값</th>
                    <th>단위</th>
                    <th>참고 범위</th>
                    <th>판정</th>
                    {canEdit && <th>삭제</th>}
                  </tr>
                </thead>
                <tbody>
                  {imageResults.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 6 : 5} className="empty">
                        검사 결과가 없습니다.
                        {canEdit && ' "항목 추가" 버튼을 클릭하여 결과를 입력하세요.'}
                      </td>
                    </tr>
                  ) : (
                    imageResults.map((result, index) => (
                      <tr key={index} className={result.flag !== 'normal' ? `row-${result.flag}` : ''}>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={result.itemName}
                              onChange={(e) => handleResultChange(index, 'itemName', e.target.value)}
                              placeholder="검사 항목명"
                            />
                          ) : (
                            result.itemName
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={result.value}
                              onChange={(e) => handleResultChange(index, 'value', e.target.value)}
                              placeholder="결과값"
                            />
                          ) : (
                            result.value
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={result.unit}
                              onChange={(e) => handleResultChange(index, 'unit', e.target.value)}
                              placeholder="단위"
                            />
                          ) : (
                            result.unit
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={result.refRange}
                              onChange={(e) => handleResultChange(index, 'refRange', e.target.value)}
                              placeholder="참고 범위"
                            />
                          ) : (
                            result.refRange
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <select
                              value={result.flag}
                              onChange={(e) =>
                                handleResultChange(index, 'flag', e.target.value as ImageResultItem['flag'])
                              }
                            >
                              <option value="normal">정상</option>
                              <option value="abnormal">이상</option>
                              <option value="critical">Critical</option>
                            </select>
                          ) : (
                            <span className={`flag flag-${result.flag}`}>
                              {result.flag === 'normal' ? '정상' : result.flag === 'abnormal' ? '이상' : 'Critical'}
                            </span>
                          )}
                        </td>
                        {canEdit && (
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveResult(index)}
                            >
                              삭제
                            </button>
                          </td>
                        )}
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* 이력 탭 */}
        {activeTab === 'history' && (
          <div className="tab-panel history-panel">
            <h3>변경 이력</h3>
            {ocsDetail.history?.length > 0 ? (
              <table className="history-table">
                <thead>
                  <tr>
                    <th>일시</th>
                    <th>액션</th>
                    <th>수행자</th>
                    <th>이전 상태</th>
                    <th>이후 상태</th>
                    <th>비고</th>
                  </tr>
                </thead>
                <tbody>
                  {ocsDetail.history.map((h) => (
                    <tr key={h.id}>
                      <td>{formatDate(h.created_at)}</td>
                      <td>{h.action_display}</td>
                      <td>{h.actor?.name || '-'}</td>
                      <td>{h.from_status ? OCS_STATUS_LABELS[h.from_status] : '-'}</td>
                      <td>{h.to_status ? OCS_STATUS_LABELS[h.to_status] : '-'}</td>
                      <td>{h.reason || '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p className="no-data">이력이 없습니다.</p>
            )}
          </div>
        )}
      </div>

      {/* DICOM 영상 조회 팝업 */}
      <DicomViewerPopup
        open={viewerOpen}
        onClose={() => setViewerOpen(false)}
        ocsInfo={ocsDetail ? {
          ocsId: ocsDetail.id,
          patientNumber: ocsDetail.patient.patient_number,
          patientName: ocsDetail.patient.name,
        } : undefined}
        existingStudy={getExistingStudyInfo()}
        onUploadComplete={handleUploadComplete}
        onStudyDeleted={handleStudyDeleted}
        isMyWork={isMyWork}
        workerName={ocsDetail?.worker?.name}
      />

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="RIS 영상 판독 PDF 미리보기"
      >
        {ocsDetail && (
          <DocumentPreview
            title="영상 판독 보고서"
            subtitle="RIS (Radiology Information System)"
            infoGrid={[
              { label: '환자번호', value: ocsDetail.patient.patient_number },
              { label: '환자명', value: ocsDetail.patient.name },
              { label: '검사번호', value: ocsDetail.ocs_id },
              { label: '검사유형', value: ocsDetail.job_type || 'MRI' },
              { label: '처방의', value: ocsDetail.doctor.name },
              { label: '판독의', value: ocsDetail.worker?.name },
              { label: '검사일', value: formatDatePreview(ocsDetail.created_at) },
              { label: '확정일', value: formatDatePreview(ocsDetail.result_ready_at) },
            ]}
            sections={[
              ...(previewThumbnails.length > 0 ? [{
                type: 'thumbnails' as const,
                title: 'MRI 영상',
                items: previewThumbnails.map(t => ({ label: t.channel, url: t.url })),
              }] : []),
              {
                type: 'result-boxes' as const,
                title: '판독 결과',
                items: [
                  ...(tumorDetected !== null ? [{
                    title: '종양 검출',
                    value: tumorDetected ? '종양 검출됨' : '종양 미검출',
                    variant: tumorDetected ? 'danger' as const : 'default' as const,
                  }] : []),
                  {
                    title: '소견 (Impression)',
                    value: impression || (ocsDetail.worker_result as RISWorkerResult)?.impression || '소견 내용 없음',
                  },
                  {
                    title: '권고사항 (Recommendation)',
                    value: recommendation || (ocsDetail.worker_result as RISWorkerResult)?.recommendation || '권고사항 없음',
                  },
                ],
              },
            ]}
            signature={{ label: '판독의', name: ocsDetail.worker?.name || '-' }}
          />
        )}
      </PdfPreviewModal>
    </div>
  );
}
