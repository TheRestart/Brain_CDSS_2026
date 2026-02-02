/**
 * LIS 검사 상세 페이지 (P.87-89)
 * - 환자 정보 및 검사 결과 상세
 * - 결과 검증 및 보고 확정
 * - 의학적 해석(Interpretation) 입력
 * - 파일 업로드 기능
 * - GENETIC/PROTEIN 검사 지원
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useAuth } from '../auth/AuthProvider';
import { getOCS, startOCS, saveOCSResult, confirmOCS, uploadLISFile } from '@/services/ocs.api';
import type { OCSDetail, GeneMutation, ProteinMarker } from '@/types/ocs';
import { getLISCategory, LIS_CATEGORY_LABELS } from '@/utils/ocs.utils';
import { getErrorMessage } from '@/types/error';
import { useAIInference } from '@/context/AIInferenceContext';
import {
  type StoredFileInfo,
  type FileWithData,
  loadFilesWithData,
  migrateFilesToStorage,
} from '@/utils/fileStorage';
import AIAnalysisPanel from './components/AIAnalysisPanel';
import PdfPreviewModal from '@/components/PdfPreviewModal';
import type { PdfWatermarkConfig } from '@/services/pdfWatermark.api';
import {
  DocumentPreview,
  formatDate as formatDatePreview,
} from '@/components/pdf-preview';
import { LIS_RESULT_SAMPLES } from '@/constants/sampleData';
import './LISStudyDetailPage.css';

// 탭 타입 - genetic, protein 탭 추가
type TabType = 'info' | 'result' | 'genetic' | 'protein' | 'interpretation' | 'history';

// 검사 결과 항목 타입
interface LabResultItem {
  testName: string;
  value: string;
  unit: string;
  refRange: string;
  flag: 'normal' | 'abnormal' | 'critical';
}

// 임상적 의의 라벨
const CLINICAL_SIGNIFICANCE_LABELS: Record<string, string> = {
  pathogenic: '병원성',
  likely_pathogenic: '병원성 추정',
  uncertain: '불확실',
  likely_benign: '양성 추정',
  benign: '양성',
};

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

// Flag 표시
const getFlagDisplay = (flag: string) => {
  switch (flag) {
    case 'critical':
      return <span className="flag flag-critical">Critical</span>;
    case 'abnormal':
      return <span className="flag flag-abnormal">이상</span>;
    default:
      return <span className="flag flag-normal">정상</span>;
  }
};

export default function LISStudyDetailPage() {
  const { ocsId } = useParams<{ ocsId: string }>();
  const [searchParams] = useSearchParams();
  const { user } = useAuth();
  const { requestInference } = useAIInference();

  const [ocs, setOcs] = useState<OCSDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeTab, setActiveTab] = useState<TabType>('info');

  // 결과 입력 폼
  const [labResults, setLabResults] = useState<LabResultItem[]>([]);
  const [interpretation, setInterpretation] = useState('');
  const [notes, setNotes] = useState('');

  // 유전자 검사 (GENETIC)
  const [geneMutations, setGeneMutations] = useState<GeneMutation[]>([]);
  const [rnaSeqPath, setRnaSeqPath] = useState('');
  const [sequencingMethod, setSequencingMethod] = useState('');
  const [sequencingCoverage, setSequencingCoverage] = useState<number | ''>('');

  // 단백질 검사 (PROTEIN)
  const [proteinMarkers, setProteinMarkers] = useState<ProteinMarker[]>([]);
  const [proteinSummary, setProteinSummary] = useState('');

  // 파일 업로드 (LocalStorage 참조 방식)
  // uploadedFiles: UI 표시용 (dataUrl 포함)
  // 저장 시에는 StoredFileInfo로 변환 (dataUrl 제외, storageKey만 저장)
  const [uploadedFiles, setUploadedFiles] = useState<FileWithData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const csvInputRef = useRef<HTMLInputElement>(null);

  // CSV 업로드 정보
  const [csvUploadInfo, setCsvUploadInfo] = useState<{
    fileName: string;
    uploadedAt: string;
    rowCount: number;
  } | null>(null);

  // AI 추론 상태
  const [aiRequesting, setAiRequesting] = useState(false);
  const [aiJobId, setAiJobId] = useState<string | null>(null);

  // PDF 미리보기 모달
  const [pdfPreviewOpen, setPdfPreviewOpen] = useState(false);

  // 검사 카테고리 확인
  const testCategory = ocs ? getLISCategory(ocs.job_type) : 'BLOOD';

  // URL 쿼리 파라미터 처리 (tab)
  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam && ['info', 'result', 'genetic', 'protein', 'interpretation', 'history'].includes(tabParam)) {
      setActiveTab(tabParam as TabType);
    }
  }, [searchParams]);

  // 데이터 로드
  const fetchOCSDetail = useCallback(async () => {
    if (!ocsId) return;

    setLoading(true);
    try {
      const data = await getOCS(parseInt(ocsId));
      setOcs(data);

      // 기존 결과가 있으면 폼에 로드
      if (data.worker_result) {
        const result = data.worker_result as unknown as Record<string, unknown>;
        // 기본 검사 결과
        if (result.labResults) {
          setLabResults(result.labResults as LabResultItem[]);
        }
        if (result.interpretation) {
          setInterpretation(result.interpretation as string);
        }
        if (result.notes) {
          setNotes(result.notes as string);
        }
        // 파일 로드 (LocalStorage에서 dataUrl 복원)
        if (result.files && (result.files as StoredFileInfo[]).length > 0) {
          const storedFiles = result.files as StoredFileInfo[];
          // 기존 형식(dataUrl 직접 저장)에서 새 형식으로 마이그레이션
          const migratedFiles = migrateFilesToStorage(storedFiles, data.id);
          // LocalStorage에서 dataUrl 로드하여 UI용 데이터 생성
          const filesWithData = loadFilesWithData(migratedFiles);
          setUploadedFiles(filesWithData);
        }
        // CSV 업로드 정보
        if (result.csvUploadInfo) {
          setCsvUploadInfo(result.csvUploadInfo as typeof csvUploadInfo);
        }
        // 유전자 검사 결과
        if (result.gene_mutations) {
          setGeneMutations(result.gene_mutations as GeneMutation[]);
        }
        if (result.RNA_seq) {
          setRnaSeqPath(result.RNA_seq as string);
        }
        if (result.sequencing_data) {
          const seqData = result.sequencing_data as Record<string, unknown>;
          if (seqData.method) setSequencingMethod(seqData.method as string);
          if (seqData.coverage) setSequencingCoverage(seqData.coverage as number);
        }
        // 단백질 검사 결과
        if (result.protein_markers) {
          setProteinMarkers(result.protein_markers as ProteinMarker[]);
        }
        if (result.protein) {
          setProteinSummary(result.protein as string);
        }
      }
    } catch (error) {
      console.error('Failed to fetch OCS detail:', error);
      alert('검사 정보를 불러오는데 실패했습니다.');
    } finally {
      setLoading(false);
    }
  }, [ocsId]);

  useEffect(() => {
    fetchOCSDetail();
  }, [fetchOCSDetail]);

  // 권한 체크
  const isWorker = ocs?.worker?.id === user?.id;
  const canEdit = isWorker && ['ACCEPTED', 'IN_PROGRESS'].includes(ocs?.ocs_status || '');
  const canVerify = isWorker && ocs?.ocs_status === 'IN_PROGRESS';

  // 작업 시작
  const handleStart = async () => {
    if (!ocs) return;
    try {
      await startOCS(ocs.id);
      await fetchOCSDetail();
    } catch (error) {
      console.error('Failed to start OCS:', error);
      alert('작업 시작에 실패했습니다.');
    }
  };

  // 결과 항목 추가
  const handleAddResult = () => {
    setLabResults([
      ...labResults,
      { testName: '', value: '', unit: '', refRange: '', flag: 'normal' },
    ]);
  };

  // 결과 항목 변경
  const handleResultChange = (index: number, field: keyof LabResultItem, value: string) => {
    const updated = [...labResults];
    updated[index] = { ...updated[index], [field]: value };
    setLabResults(updated);
  };

  // 결과 항목 삭제
  const handleRemoveResult = (index: number) => {
    setLabResults(labResults.filter((_, i) => i !== index));
  };

  // 유전자 변이 추가
  const handleAddGeneMutation = () => {
    setGeneMutations([
      ...geneMutations,
      {
        gene_name: '',
        mutation_type: '',
        position: '',
        variant: '',
        clinical_significance: 'uncertain',
        is_actionable: false,
      },
    ]);
  };

  // 유전자 변이 변경
  const handleGeneMutationChange = (index: number, field: keyof GeneMutation, value: unknown) => {
    const updated = [...geneMutations];
    updated[index] = { ...updated[index], [field]: value };
    setGeneMutations(updated);
  };

  // 유전자 변이 삭제
  const handleRemoveGeneMutation = (index: number) => {
    setGeneMutations(geneMutations.filter((_, i) => i !== index));
  };

  // 단백질 마커 추가
  const handleAddProteinMarker = () => {
    setProteinMarkers([
      ...proteinMarkers,
      {
        marker_name: '',
        value: '',
        unit: '',
        reference_range: '',
        interpretation: '',
        is_abnormal: false,
      },
    ]);
  };

  // 단백질 마커 변경
  const handleProteinMarkerChange = (index: number, field: keyof ProteinMarker, value: unknown) => {
    const updated = [...proteinMarkers];
    updated[index] = { ...updated[index], [field]: value };
    setProteinMarkers(updated);
  };

  // 단백질 마커 삭제
  const handleRemoveProteinMarker = (index: number) => {
    setProteinMarkers(proteinMarkers.filter((_, i) => i !== index));
  };

  // 파일 업로드 핸들러 (서버 CDSS_STORAGE/LIS에 저장)
  // LIS 파일 용량 제한: 10MB
  const MAX_FILE_SIZE_MB = 10;
  const MAX_FILE_SIZE_BYTES = MAX_FILE_SIZE_MB * 1024 * 1024;

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    console.log('[LIS] handleFileUpload 호출됨, files:', files?.length, 'ocs:', ocs?.id);
    if (!files || !ocs) {
      console.log('[LIS] 파일 또는 OCS가 없음, 리턴');
      return;
    }

    // 파일별로 서버에 업로드
    for (const file of Array.from(files)) {
      console.log('[LIS] 파일 업로드 시작:', file.name, file.size);
      // 용량 검증
      if (file.size > MAX_FILE_SIZE_BYTES) {
        alert(`파일 용량 초과: ${file.name}\n최대 ${MAX_FILE_SIZE_MB}MB까지 업로드 가능합니다.\n(현재: ${(file.size / (1024 * 1024)).toFixed(1)}MB)`);
        continue;
      }

      try {
        // 백엔드 API 호출하여 CDSS_STORAGE/LIS에 저장
        console.log('[LIS] uploadLISFile API 호출:', ocs.id, file.name);
        const response = await uploadLISFile(ocs.id, file);
        console.log('[LIS] uploadLISFile 응답:', response);

        // 서버 응답의 파일 정보를 StoredFileInfo 형식으로 변환
        const fileWithData: FileWithData = {
          name: response.file.name,
          size: response.file.size,
          type: response.file.content_type,
          uploadedAt: response.file.uploaded_at,
          storageKey: response.file.storage_path || '', // 서버 저장 경로
        };

        setUploadedFiles((prev) => [...prev, fileWithData]);

        // RNA_SEQ 타입이고 CSV 파일인 경우 자동으로 RNA 시퀀싱 데이터 경로 설정
        if (ocs.job_type === 'RNA_SEQ' && file.name.toLowerCase().endsWith('.csv')) {
          const storagePath = response.file.storage_path || `LIS/${ocs.id}/${response.file.name}`;
          setRnaSeqPath(storagePath);
        }
      } catch (error) {
        console.error('파일 업로드 실패:', file.name, error);
        alert(`파일 업로드 실패: ${file.name}\n${getErrorMessage(error)}`);
      }
    }

    // 업로드 성공 시 OCS 데이터 새로고침 (attachments 업데이트 반영)
    await fetchOCSDetail();

    // 입력 초기화
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  // 파일 삭제 (서버에서는 삭제하지 않고 UI에서만 제거 - 추후 삭제 API 추가 가능)
  const handleRemoveFile = (index: number) => {
    setUploadedFiles(uploadedFiles.filter((_, i) => i !== index));
  };

  // CSV 파일 업로드 및 파싱 핸들러
  const handleCSVUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // CSV 파일 확인
    if (!file.name.endsWith('.csv')) {
      alert('CSV 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      try {
        const text = event.target?.result as string;
        const parsedResults = parseCSV(text);

        if (parsedResults.length === 0) {
          alert('CSV 파일에서 유효한 데이터를 찾을 수 없습니다.');
          return;
        }

        // 기존 결과에 추가할지 대체할지 확인
        if (labResults.length > 0) {
          if (confirm(`기존 ${labResults.length}개 항목이 있습니다. 새 CSV 데이터로 대체하시겠습니까?\n취소를 누르면 기존 데이터에 추가합니다.`)) {
            setLabResults(parsedResults);
          } else {
            setLabResults([...labResults, ...parsedResults]);
          }
        } else {
          setLabResults(parsedResults);
        }

        // CSV 업로드 정보 저장
        setCsvUploadInfo({
          fileName: file.name,
          uploadedAt: new Date().toISOString(),
          rowCount: parsedResults.length,
        });

        alert(`CSV 파일에서 ${parsedResults.length}개 항목을 불러왔습니다.`);
      } catch (error) {
        console.error('CSV 파싱 오류:', error);
        alert('CSV 파일 파싱에 실패했습니다. 형식을 확인해주세요.');
      }
    };

    reader.readAsText(file, 'UTF-8');

    // 입력 초기화
    if (csvInputRef.current) {
      csvInputRef.current.value = '';
    }
  };

  // CSV 파싱 함수
  // 예상 CSV 형식: testName,value,unit,refRange,flag
  // 또는: 검사항목,결과값,단위,참고범위,판정
  const parseCSV = (text: string): LabResultItem[] => {
    const lines = text.trim().split('\n');
    if (lines.length < 2) return []; // 헤더 + 최소 1개 데이터

    // 헤더 파싱 (첫 번째 행)
    const headerLine = lines[0];
    const headers = parseCSVLine(headerLine).map((h) => h.toLowerCase().trim());

    // 컬럼 인덱스 찾기 (영문/한글 모두 지원)
    const findIndex = (names: string[]) =>
      headers.findIndex((h) => names.some((n) => h.includes(n)));

    const testNameIdx = findIndex(['testname', 'test_name', '검사항목', '항목명', '검사명', 'name', 'item']);
    const valueIdx = findIndex(['value', '결과값', '결과', '값', 'result']);
    const unitIdx = findIndex(['unit', '단위']);
    const refRangeIdx = findIndex(['refrange', 'ref_range', 'reference', '참고범위', '참고치', '기준']);
    const flagIdx = findIndex(['flag', '판정', '상태', 'status', 'abnormal']);

    // 필수 컬럼 확인
    if (testNameIdx === -1 || valueIdx === -1) {
      throw new Error('필수 컬럼(검사항목, 결과값)을 찾을 수 없습니다.');
    }

    // 데이터 파싱
    const results: LabResultItem[] = [];
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      const values = parseCSVLine(line);
      const testName = values[testNameIdx]?.trim() || '';
      const value = values[valueIdx]?.trim() || '';

      if (!testName || !value) continue;

      // flag 값 파싱
      let flag: 'normal' | 'abnormal' | 'critical' = 'normal';
      if (flagIdx !== -1) {
        const flagValue = values[flagIdx]?.trim().toLowerCase() || '';
        if (flagValue.includes('critical') || flagValue.includes('위험') || flagValue === 'c') {
          flag = 'critical';
        } else if (flagValue.includes('abnormal') || flagValue.includes('이상') || flagValue === 'h' || flagValue === 'l' || flagValue === 'a') {
          flag = 'abnormal';
        }
      }

      results.push({
        testName,
        value,
        unit: unitIdx !== -1 ? values[unitIdx]?.trim() || '' : '',
        refRange: refRangeIdx !== -1 ? values[refRangeIdx]?.trim() || '' : '',
        flag,
      });
    }

    return results;
  };

  // CSV 라인 파싱 (쉼표, 따옴표 처리)
  const parseCSVLine = (line: string): string[] => {
    const result: string[] = [];
    let current = '';
    let inQuotes = false;

    for (let i = 0; i < line.length; i++) {
      const char = line[i];
      const nextChar = line[i + 1];

      if (char === '"') {
        if (inQuotes && nextChar === '"') {
          current += '"';
          i++; // Skip next quote
        } else {
          inQuotes = !inQuotes;
        }
      } else if (char === ',' && !inQuotes) {
        result.push(current);
        current = '';
      } else {
        current += char;
      }
    }
    result.push(current);

    return result;
  };

  // 파일 크기 포맷
  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B';
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
    return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
  };

  // 파일 목록을 저장용으로 변환 (dataUrl 제외, storageKey만 포함)
  const getFilesForStorage = (): StoredFileInfo[] => {
    return uploadedFiles.map(({ name, size, type, uploadedAt, storageKey }) => {
      // storageKey에서 실제 저장된 파일명 추출
      // 예: "LIS/ocs_0064/20260120_100103_gene_expression.csv" → "20260120_100103_gene_expression.csv"
      const actualFileName = storageKey?.split('/').pop() || name;

      return {
        name: actualFileName,  // 실제 저장된 파일명 사용 (타임스탬프 포함)
        size,
        type,
        uploadedAt,
        storageKey: storageKey || '',
      };
    });
  };

  // worker_result 데이터 생성
  const buildWorkerResult = () => {
    // RNA_SEQ인 경우 job_type을 test_type으로 사용 (정상 포맷 호환)
    const actualTestType = ocs?.job_type === 'RNA_SEQ' ? 'RNA_SEQ' : testCategory;

    const result: Record<string, unknown> = {
      _template: 'LIS',
      _version: '1.2',
      test_type: actualTestType,
      interpretation,
      gene_mutations: geneMutations,
    };

    // RNA_SEQ 검사인 경우 - 정상 포맷에 맞게 저장
    if (ocs?.job_type === 'RNA_SEQ') {
      // CSV 파일 찾기 (uploadedFiles에서)
      const rnaSeqFile = uploadedFiles.find(f =>
        f.name.toLowerCase().endsWith('.csv')
      );

      if (rnaSeqFile) {
        // storageKey에서 파일 경로 추출 (예: "LIS/ocs_0044/gene_expression.csv")
        const storagePath = rnaSeqFile.storageKey || rnaSeqPath || '';

        // RNA_seq: CDSS_STORAGE 경로 형식
        result.RNA_seq = storagePath ? `CDSS_STORAGE/${storagePath}` : null;

        // gene_expression 객체 구조
        result.gene_expression = {
          file_path: storagePath ? `CDSS_STORAGE/${storagePath}` : '',
          file_size: rnaSeqFile.size || 0,
          uploaded_at: rnaSeqFile.uploadedAt || new Date().toISOString(),
        };
      } else if (rnaSeqPath) {
        // 파일 객체가 없지만 경로가 있는 경우 (하위 호환성)
        result.RNA_seq = rnaSeqPath.startsWith('CDSS_STORAGE') ? rnaSeqPath : `CDSS_STORAGE/${rnaSeqPath}`;
        result.gene_expression = {
          file_path: result.RNA_seq,
          file_size: 0,
          uploaded_at: new Date().toISOString(),
        };
      }

      // sequencing_data
      result.sequencing_data = {
        method: sequencingMethod || 'RNA-Seq (Illumina HiSeq)',
        coverage: sequencingCoverage || null,
      };

      // summary와 test_results (정상 포맷 호환)
      result.summary = interpretation || 'RNA 시퀀싱 분석 완료';
      result.test_results = labResults;

    } else if (testCategory === 'GENETIC') {
      // 일반 유전자 검사 (RNA_SEQ 아닌 경우)
      result.sequencing_data = {
        method: sequencingMethod,
        coverage: sequencingCoverage || null,
      };
      result.labResults = labResults;
      result.notes = notes;
      result.files = getFilesForStorage();
      result.csvUploadInfo = csvUploadInfo || null;

    } else if (testCategory === 'PROTEIN') {
      // 단백질 검사 데이터
      result.protein_markers = proteinMarkers;
      result.protein = proteinSummary || null;
      result.labResults = labResults;
      result.notes = notes;
      result.files = getFilesForStorage();
      result.csvUploadInfo = csvUploadInfo || null;

    } else {
      // 혈액/기타 검사
      result.labResults = labResults;
      result.notes = notes;
      result.files = getFilesForStorage();
      result.csvUploadInfo = csvUploadInfo || null;
    }

    return result;
  };

  // 임시 저장
  const handleSave = async () => {
    if (!ocs) return;

    setSaving(true);
    try {
      await saveOCSResult(ocs.id, {
        worker_result: {
          ...buildWorkerResult(),
          _savedAt: new Date().toISOString(),
        },
      });
      alert('임시 저장되었습니다.');
      await fetchOCSDetail();
    } catch (error) {
      console.error('Failed to save result:', error);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  // PDF 미리보기 열기
  const handleOpenPdfPreview = () => {
    setPdfPreviewOpen(true);
  };

  // PDF 출력 (워터마크 설정 적용)
  const handleExportPDF = async (watermarkConfig: PdfWatermarkConfig) => {
    if (!ocs) return;

    try {
      const { generateLISReportPDF } = await import('@/utils/exportUtils');
      await generateLISReportPDF({
        ocsId: ocs.ocs_id,
        patientName: ocs.patient.name,
        patientNumber: ocs.patient.patient_number,
        jobType: ocs.job_type,
        results: labResults.map(r => ({
          itemName: r.testName,
          value: r.value,
          unit: r.unit,
          refRange: r.refRange,
          flag: r.flag,
        })),
        interpretation: interpretation || undefined,
        doctorName: ocs.doctor.name,
        workerName: ocs.worker?.name || '-',
        createdAt: formatDate(ocs.created_at),
        confirmedAt: ocs.result_ready_at ? formatDate(ocs.result_ready_at) : undefined,
      }, watermarkConfig);
    } catch (error) {
      console.error('PDF 출력 실패:', error);
      alert('PDF 출력에 실패했습니다. jspdf 패키지가 설치되어 있는지 확인하세요.');
    }
  };

  // MG AI 추론 요청 (RNA_SEQ 전용) - AIInferenceContext 사용
  const handleRequestAIInference = async () => {
    if (!ocs) return;

    // RNA_SEQ 타입만 MG 추론 가능
    if (ocs.job_type !== 'RNA_SEQ') {
      alert('MG AI 분석은 RNA_SEQ 검사에서만 사용 가능합니다.');
      return;
    }

    if (!confirm('MG AI 분석을 요청하시겠습니까?\n분석에는 수 분이 소요될 수 있습니다.')) {
      return;
    }

    setAiRequesting(true);
    setAiJobId(null);
    try {
      // AIInferenceContext의 requestInference 사용 (MGInferencePage와 동일)
      const job = await requestInference('MG', { ocs_id: ocs.id, mode: 'manual' });

      if (!job) {
        alert('AI 서버 연결 실패. 서버 상태를 확인해주세요.');
        return;
      }

      setAiJobId(job.job_id);

      if (job.cached) {
        alert(`기존 분석 결과가 있습니다.\nJob ID: ${job.job_id}`);
      } else {
        alert(`MG AI 분석이 시작되었습니다.\nJob ID: ${job.job_id}\n완료 시 알림을 받게 됩니다.`);
      }

      // OCS 상세 새로고침
      await fetchOCSDetail();
    } catch (error) {
      console.error('AI 추론 요청 실패:', error);
      const errorMessage = getErrorMessage(error);
      alert(`AI 분석 요청 실패: ${errorMessage}`);
    } finally {
      setAiRequesting(false);
    }
  };

  // 서버에 아직 업로드되지 않은 파일 업로드 (LocalStorage에서 복원된 파일 처리)
  const uploadPendingFiles = async (): Promise<FileWithData[]> => {
    const updatedFiles: FileWithData[] = [];

    for (const file of uploadedFiles) {
      // storageKey가 서버 경로(LIS/...)로 시작하면 이미 업로드됨
      if (file.storageKey?.startsWith('LIS/')) {
        updatedFiles.push(file);
        continue;
      }

      // LocalStorage에 dataUrl이 있는 경우 서버에 업로드 필요
      if (file.dataUrl) {
        try {
          console.log('[LIS] 미업로드 파일 서버 전송:', file.name);

          // dataUrl을 Blob/File로 변환
          const response = await fetch(file.dataUrl);
          const blob = await response.blob();
          const fileToUpload = new File([blob], file.name, { type: file.type });

          // 서버에 업로드
          const uploadResponse = await uploadLISFile(ocs!.id, fileToUpload);
          console.log('[LIS] 서버 업로드 완료:', uploadResponse);

          // 서버 응답으로 파일 정보 업데이트
          updatedFiles.push({
            name: uploadResponse.file.name,
            size: uploadResponse.file.size,
            type: uploadResponse.file.content_type,
            uploadedAt: uploadResponse.file.uploaded_at,
            storageKey: uploadResponse.file.storage_path || '',
          });

          // RNA_SEQ CSV 파일인 경우 경로 업데이트
          if (ocs?.job_type === 'RNA_SEQ' && file.name.toLowerCase().endsWith('.csv')) {
            const storagePath = uploadResponse.file.storage_path || `LIS/${ocs.ocs_id}/${uploadResponse.file.name}`;
            setRnaSeqPath(storagePath);
          }
        } catch (error) {
          console.error('파일 업로드 실패:', file.name, error);
          // 실패한 파일은 원본 유지 (나중에 재시도 가능)
          updatedFiles.push(file);
          throw new Error(`파일 업로드 실패: ${file.name}`);
        }
      } else {
        // dataUrl도 없고 서버 경로도 아닌 경우 - 원본 유지
        updatedFiles.push(file);
      }
    }

    return updatedFiles;
  };

  // 결과 제출 및 확정 (IN_PROGRESS → CONFIRMED)
  const handleSubmit = async () => {
    if (!ocs) return;

    // 카테고리별 검증
    if (testCategory === 'BLOOD' || testCategory === 'OTHER') {
      if (labResults.length === 0) {
        alert('검사 결과를 입력해주세요.');
        return;
      }
      const hasCritical = labResults.some((r) => r.flag === 'critical');
      if (hasCritical && !interpretation) {
        alert('Critical 결과가 있습니다. 해석(Interpretation)을 입력해주세요.');
        return;
      }
    } else if (testCategory === 'GENETIC') {
      if (geneMutations.length === 0 && !rnaSeqPath) {
        alert('유전자 검사 결과를 입력해주세요.');
        return;
      }
    } else if (testCategory === 'PROTEIN') {
      if (proteinMarkers.length === 0) {
        alert('단백질 마커 결과를 입력해주세요.');
        return;
      }
    }

    if (!confirm('결과를 제출하시겠습니까? 제출 후에는 수정이 제한됩니다.')) {
      return;
    }

    setSaving(true);
    try {
      // 1. 아직 서버에 업로드되지 않은 파일 먼저 업로드
      if (uploadedFiles.length > 0) {
        console.log('[LIS] 결과 제출 전 파일 업로드 확인...');
        const updatedFiles = await uploadPendingFiles();
        setUploadedFiles(updatedFiles);
      }

      // 2. LIS는 결과 제출 시 바로 확정 처리
      await confirmOCS(ocs.id, {
        worker_result: {
          ...buildWorkerResult(),
          _confirmed: true,
          _verifiedAt: new Date().toISOString(),
          _verifiedBy: user?.name,
        },
      });
      alert('결과가 제출되고 확정되었습니다.');
      await fetchOCSDetail();
    } catch (error) {
      console.error('Failed to submit result:', error);
      alert('제출에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="page lis-detail-page loading">로딩 중...</div>;
  }

  if (!ocs) {
    return <div className="page lis-detail-page error">검사 정보를 찾을 수 없습니다.</div>;
  }

  // 이상 항목 수
  const abnormalCount = labResults.filter((r) => r.flag === 'abnormal').length;
  const criticalCount = labResults.filter((r) => r.flag === 'critical').length;

  return (
    <div className="page lis-detail-page">
      {/* 헤더 */}
      <header className="detail-header">
        {/* <button className="btn-back" onClick={() => navigate(-1)}>
          &larr; 목록으로
        </button> */}
        <div className="header-info">
          <h2>검사 상세 - {ocs.ocs_id}</h2>
          <span className={`status-badge status-${ocs.ocs_status.toLowerCase()}`}>
            {ocs.ocs_status_display}
          </span>
        </div>
        <div className="header-actions">
          {ocs.ocs_status === 'ACCEPTED' && isWorker && (
            <button className="btn btn-primary" onClick={handleStart}>
              작업 시작
            </button>
          )}
          {canEdit && (
            <>
              <button className="btn btn-secondary" onClick={handleSave} disabled={saving}>
                임시 저장
              </button>
              {canVerify && (
                <button className="btn btn-success" onClick={handleSubmit} disabled={saving}>
                  결과 제출
                </button>
              )}
            </>
          )}
          {['RESULT_READY', 'CONFIRMED'].includes(ocs.ocs_status) && (
            <>
              {/* MG 추론 버튼 (CONFIRMED 상태 + RNA_SEQ만) */}
              {ocs.ocs_status === 'CONFIRMED' && ocs.job_type === 'RNA_SEQ' && (
                <button
                  className="btn btn-ai"
                  onClick={handleRequestAIInference}
                  disabled={aiRequesting}
                  title="MG 추론 요청"
                >
                  {aiRequesting && aiJobId
                    ? `'${aiJobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
                    : 'MG 추론'}
                </button>
              )}
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
          <span>{ocs.patient.name}</span>
        </div>
        <div className="info-item">
          <label>환자번호</label>
          <span>{ocs.patient.patient_number}</span>
        </div>
        <div className="info-item">
          <label>검사 항목</label>
          <span>{ocs.job_type}</span>
        </div>
        <div className="info-item">
          <label>처방 의사</label>
          <span>{ocs.doctor.name}</span>
        </div>
        <div className="info-item">
          <label>처방일</label>
          <span>{formatDate(ocs.created_at)}</span>
        </div>
        <div className="info-item">
          <label>우선순위</label>
          <span className={`priority priority-${ocs.priority}`}>{ocs.priority_display}</span>
        </div>
      </section>

      {/* 결과 요약 */}
      {(labResults.length > 0 || geneMutations.length > 0 || proteinMarkers.length > 0) && (
        <section className="result-summary">
          {(testCategory === 'BLOOD' || testCategory === 'OTHER') && (
            <>
              <div className="summary-card">
                <span className="count">{labResults.length}</span>
                <span className="label">전체 항목</span>
              </div>
              <div className="summary-card abnormal">
                <span className="count">{abnormalCount}</span>
                <span className="label">이상 항목</span>
              </div>
              <div className="summary-card critical">
                <span className="count">{criticalCount}</span>
                <span className="label">Critical</span>
              </div>
            </>
          )}
          {testCategory === 'GENETIC' && (
            <>
              <div className="summary-card">
                <span className="count">{geneMutations.length}</span>
                <span className="label">유전자 변이</span>
              </div>
              <div className="summary-card abnormal">
                <span className="count">
                  {geneMutations.filter((m) => m.clinical_significance === 'pathogenic' || m.clinical_significance === 'likely_pathogenic').length}
                </span>
                <span className="label">병원성</span>
              </div>
              <div className="summary-card critical">
                <span className="count">{geneMutations.filter((m) => m.is_actionable).length}</span>
                <span className="label">치료 가능</span>
              </div>
            </>
          )}
          {testCategory === 'PROTEIN' && (
            <>
              <div className="summary-card">
                <span className="count">{proteinMarkers.length}</span>
                <span className="label">단백질 마커</span>
              </div>
              <div className="summary-card abnormal">
                <span className="count">{proteinMarkers.filter((m) => m.is_abnormal).length}</span>
                <span className="label">이상 소견</span>
              </div>
            </>
          )}
        </section>
      )}

      {/* 검사 유형 표시 */}
      <div className="test-category-badge">
        <span className={`category-badge category-${testCategory.toLowerCase()}`}>
          {LIS_CATEGORY_LABELS[testCategory] || testCategory}
        </span>
      </div>

      {/* 탭 메뉴 */}
      <nav className="tab-nav">
        <button
          className={activeTab === 'info' ? 'active' : ''}
          onClick={() => setActiveTab('info')}
        >
          검사 정보
        </button>
        <button
          className={activeTab === 'result' ? 'active' : ''}
          onClick={() => setActiveTab('result')}
        >
          검사 결과
        </button>
        {testCategory === 'GENETIC' && (
          <button
            className={activeTab === 'genetic' ? 'active' : ''}
            onClick={() => setActiveTab('genetic')}
          >
            유전자 분석
          </button>
        )}
        {testCategory === 'PROTEIN' && (
          <button
            className={activeTab === 'protein' ? 'active' : ''}
            onClick={() => setActiveTab('protein')}
          >
            단백질 분석
          </button>
        )}
        <button
          className={activeTab === 'interpretation' ? 'active' : ''}
          onClick={() => setActiveTab('interpretation')}
        >
          해석/소견
        </button>
        <button
          className={activeTab === 'history' ? 'active' : ''}
          onClick={() => setActiveTab('history')}
        >
          이력
        </button>
      </nav>

      {/* 탭 콘텐츠 */}
      <section className="tab-content">
        {/* 검사 정보 탭 */}
        {activeTab === 'info' && (
          <div className="info-tab">
            <div className="info-grid">
              <div className="info-row">
                <label>OCS ID</label>
                <span>{ocs.ocs_id}</span>
              </div>
              <div className="info-row">
                <label>검사 유형</label>
                <span>{ocs.job_type}</span>
              </div>
              <div className="info-row">
                <label>상태</label>
                <span>{ocs.ocs_status_display}</span>
              </div>
              <div className="info-row">
                <label>담당자</label>
                <span>{ocs.worker?.name || '미배정'}</span>
              </div>
              <div className="info-row">
                <label>접수일시</label>
                <span>{formatDate(ocs.accepted_at)}</span>
              </div>
              <div className="info-row">
                <label>작업시작</label>
                <span>{formatDate(ocs.in_progress_at)}</span>
              </div>
              <div className="info-row">
                <label>결과제출</label>
                <span>{formatDate(ocs.result_ready_at)}</span>
              </div>
            </div>

            {/* 의사 요청 사항 */}
            <div className="doctor-request">
              <h4>의사 요청 사항</h4>
              <pre>{JSON.stringify(ocs.doctor_request, null, 2)}</pre>
            </div>
          </div>
        )}

        {/* 검사 결과 탭 */}
        {activeTab === 'result' && (
          <div className="result-tab">
            {/* AI 분석 결과 패널 (MG 모델) */}
            {testCategory === 'GENETIC' && (
              <div className="ai-section">
                <AIAnalysisPanel
                  ocsId={ocs.id}
                  patientId={ocs.patient.id}
                  jobType={ocs.job_type}
                />
              </div>
            )}

            {/* 파일 업로드 섹션 */}
            <div className="file-upload-section">
              <div className="section-header">
                <h4>결과 파일 첨부</h4>
                {canEdit && (
                  <>
                    <input
                      ref={fileInputRef}
                      type="file"
                      multiple
                      accept=".pdf,.jpg,.jpeg,.png,.csv,.json,.txt,.tsv,.hl7,.xml"
                      onChange={handleFileUpload}
                      style={{ display: 'none' }}
                      id="file-upload"
                    />
                    <label htmlFor="file-upload" className="btn btn-sm btn-secondary">
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
                         file.type.includes('sheet') || file.type.includes('excel') ? '📊' : '📎'}
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
                    허용 확장자: PDF, JPG, PNG, CSV, JSON, TXT, TSV, HL7, XML
                  </p>
                </div>
              )}
            </div>

            {/* CSV 업로드 섹션 - BLOOD/OTHER만 */}
            {(testCategory === 'BLOOD' || testCategory === 'OTHER') && (
              <div className="csv-upload-section">
                <div className="section-header">
                  <h4>CSV 데이터 가져오기</h4>
                  {canEdit && (
                    <>
                      <input
                        ref={csvInputRef}
                        type="file"
                        accept=".csv"
                        onChange={handleCSVUpload}
                        style={{ display: 'none' }}
                        id="csv-upload"
                      />
                      <label htmlFor="csv-upload" className="btn btn-sm btn-success">
                        CSV 업로드
                      </label>
                    </>
                  )}
                </div>
                <div className="csv-help">
                  <p>CSV 형식: 검사항목, 결과값, 단위, 참고범위, 판정</p>
                  <p className="csv-example">예: WBC,7500,/uL,4000-10000,정상</p>
                </div>
                {csvUploadInfo && (
                  <div className="csv-info">
                    <span className="csv-icon">📊</span>
                    <span className="csv-filename">{csvUploadInfo.fileName}</span>
                    <span className="csv-count">{csvUploadInfo.rowCount}개 항목</span>
                    <span className="csv-date">{formatDate(csvUploadInfo.uploadedAt)}</span>
                  </div>
                )}
              </div>
            )}

            {/* 검사 결과 입력 - BLOOD/OTHER만 */}
            {(testCategory === 'BLOOD' || testCategory === 'OTHER') && (
              <>
                <div className="result-header">
                  <h4>검사 결과 입력</h4>
                  <div className="result-actions">
                    {canEdit && (
                      <>
                        {/* 샘플 데이터 버튼 */}
                        <div className="sample-buttons-row">
                          <span className="sample-label">샘플:</span>
                          {LIS_RESULT_SAMPLES.map((sample) => (
                            <button
                              key={sample.type}
                              type="button"
                              className="btn btn-xs btn-sample"
                              onClick={() => {
                                const convertedResults = sample.results.map(r => ({
                                  testName: r.item,
                                  value: r.value,
                                  unit: r.unit,
                                  refRange: r.reference,
                                  flag: r.status as 'normal' | 'abnormal' | 'critical',
                                }));
                                setLabResults(convertedResults);
                                setInterpretation(sample.interpretation);
                              }}
                              title={sample.label}
                            >
                              {sample.label}
                            </button>
                          ))}
                        </div>
                        <button className="btn btn-sm btn-primary" onClick={handleAddResult}>
                          + 항목 추가
                        </button>
                      </>
                    )}
                  </div>
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
                {labResults.length === 0 ? (
                  <tr>
                    <td colSpan={canEdit ? 6 : 5} className="empty">
                      검사 결과가 없습니다.
                      {canEdit && ' "항목 추가" 버튼을 클릭하여 결과를 입력하세요.'}
                    </td>
                  </tr>
                ) : (
                  labResults.map((result, index) => (
                    <tr key={index} className={result.flag !== 'normal' ? `row-${result.flag}` : ''}>
                      <td>
                        {canEdit ? (
                          <input
                            type="text"
                            value={result.testName}
                            onChange={(e) => handleResultChange(index, 'testName', e.target.value)}
                            placeholder="검사 항목명"
                          />
                        ) : (
                          result.testName
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
                              handleResultChange(index, 'flag', e.target.value as LabResultItem['flag'])
                            }
                          >
                            <option value="normal">정상</option>
                            <option value="abnormal">이상</option>
                            <option value="critical">Critical</option>
                          </select>
                        ) : (
                          getFlagDisplay(result.flag)
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
              </>
            )}
          </div>
        )}

        {/* 유전자 검사 탭 */}
        {activeTab === 'genetic' && (
          <div className="genetic-tab">
            {/* RNA 시퀀싱 정보 */}
            <div className="section-card">
              <div className="section-header">
                <h4>RNA 시퀀싱 정보</h4>
              </div>
              <div className="form-grid">
                <div className="form-group">
                  <label>시퀀싱 방법</label>
                  {canEdit ? (
                    <select
                      value={sequencingMethod}
                      onChange={(e) => setSequencingMethod(e.target.value)}
                    >
                      <option value="">선택하세요</option>
                      <option value="NGS">NGS (Next-Generation Sequencing)</option>
                      <option value="Sanger">Sanger Sequencing</option>
                      <option value="WGS">Whole Genome Sequencing</option>
                      <option value="WES">Whole Exome Sequencing</option>
                      <option value="RNA-seq">RNA Sequencing</option>
                    </select>
                  ) : (
                    <span>{sequencingMethod || '-'}</span>
                  )}
                </div>
                <div className="form-group">
                  <label>커버리지 (%)</label>
                  {canEdit ? (
                    <input
                      type="number"
                      value={sequencingCoverage}
                      onChange={(e) => setSequencingCoverage(e.target.value ? parseFloat(e.target.value) : '')}
                      placeholder="예: 99.5"
                      min="0"
                      max="100"
                      step="0.1"
                    />
                  ) : (
                    <span>{sequencingCoverage ? `${sequencingCoverage}%` : '-'}</span>
                  )}
                </div>
                <div className="form-group full-width">
                  <label>RNA 시퀀싱 데이터 경로</label>
                  {canEdit ? (
                    <input
                      type="text"
                      value={rnaSeqPath}
                      onChange={(e) => setRnaSeqPath(e.target.value)}
                      placeholder="파일 경로 또는 URL 입력"
                    />
                  ) : (
                    <span>{rnaSeqPath || '-'}</span>
                  )}
                </div>
              </div>
            </div>

            {/* 유전자 변이 목록 */}
            <div className="section-card">
              <div className="section-header">
                <h4>유전자 변이 분석</h4>
                {canEdit && (
                  <button className="btn btn-sm btn-primary" onClick={handleAddGeneMutation}>
                    + 변이 추가
                  </button>
                )}
              </div>
              <table className="genetic-table">
                <thead>
                  <tr>
                    <th>유전자</th>
                    <th>변이 유형</th>
                    <th>변이 정보</th>
                    <th>위치</th>
                    <th>임상적 의의</th>
                    <th>치료 가능</th>
                    {canEdit && <th>삭제</th>}
                  </tr>
                </thead>
                <tbody>
                  {geneMutations.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="empty">
                        유전자 변이 데이터가 없습니다.
                        {canEdit && ' "변이 추가" 버튼을 클릭하여 결과를 입력하세요.'}
                      </td>
                    </tr>
                  ) : (
                    geneMutations.map((mutation, index) => (
                      <tr key={index} className={mutation.clinical_significance === 'pathogenic' || mutation.clinical_significance === 'likely_pathogenic' ? 'row-pathogenic' : ''}>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={mutation.gene_name}
                              onChange={(e) => handleGeneMutationChange(index, 'gene_name', e.target.value)}
                              placeholder="예: TP53"
                            />
                          ) : (
                            mutation.gene_name
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <select
                              value={mutation.mutation_type}
                              onChange={(e) => handleGeneMutationChange(index, 'mutation_type', e.target.value)}
                            >
                              <option value="">선택</option>
                              <option value="missense">Missense</option>
                              <option value="nonsense">Nonsense</option>
                              <option value="frameshift">Frameshift</option>
                              <option value="deletion">Deletion</option>
                              <option value="insertion">Insertion</option>
                              <option value="duplication">Duplication</option>
                              <option value="splice_site">Splice Site</option>
                            </select>
                          ) : (
                            mutation.mutation_type
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={mutation.variant || ''}
                              onChange={(e) => handleGeneMutationChange(index, 'variant', e.target.value)}
                              placeholder="예: R132H"
                            />
                          ) : (
                            mutation.variant || '-'
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={mutation.position || ''}
                              onChange={(e) => handleGeneMutationChange(index, 'position', e.target.value)}
                              placeholder="예: chr17:7577538"
                            />
                          ) : (
                            mutation.position || '-'
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <select
                              value={mutation.clinical_significance}
                              onChange={(e) => handleGeneMutationChange(index, 'clinical_significance', e.target.value)}
                            >
                              <option value="pathogenic">병원성</option>
                              <option value="likely_pathogenic">병원성 추정</option>
                              <option value="uncertain">불확실</option>
                              <option value="likely_benign">양성 추정</option>
                              <option value="benign">양성</option>
                            </select>
                          ) : (
                            <span className={`significance significance-${mutation.clinical_significance}`}>
                              {CLINICAL_SIGNIFICANCE_LABELS[mutation.clinical_significance || 'uncertain']}
                            </span>
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="checkbox"
                              checked={mutation.is_actionable || false}
                              onChange={(e) => handleGeneMutationChange(index, 'is_actionable', e.target.checked)}
                            />
                          ) : (
                            mutation.is_actionable ? '예' : '아니오'
                          )}
                        </td>
                        {canEdit && (
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveGeneMutation(index)}
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

        {/* 단백질 검사 탭 */}
        {activeTab === 'protein' && (
          <div className="protein-tab">
            <div className="section-card">
              <div className="section-header">
                <h4>단백질 분석 요약</h4>
              </div>
              <div className="form-group">
                {canEdit ? (
                  <textarea
                    value={proteinSummary}
                    onChange={(e) => setProteinSummary(e.target.value)}
                    placeholder="단백질 분석 결과 요약을 입력하세요..."
                    rows={3}
                  />
                ) : (
                  <div className="readonly-text">{proteinSummary || '요약 없음'}</div>
                )}
              </div>
            </div>

            <div className="section-card">
              <div className="section-header">
                <h4>단백질 마커 분석</h4>
                {canEdit && (
                  <button className="btn btn-sm btn-primary" onClick={handleAddProteinMarker}>
                    + 마커 추가
                  </button>
                )}
              </div>
              <table className="protein-table">
                <thead>
                  <tr>
                    <th>마커명</th>
                    <th>결과값</th>
                    <th>단위</th>
                    <th>참고 범위</th>
                    <th>해석</th>
                    <th>이상 여부</th>
                    {canEdit && <th>삭제</th>}
                  </tr>
                </thead>
                <tbody>
                  {proteinMarkers.length === 0 ? (
                    <tr>
                      <td colSpan={canEdit ? 7 : 6} className="empty">
                        단백질 마커 데이터가 없습니다.
                        {canEdit && ' "마커 추가" 버튼을 클릭하여 결과를 입력하세요.'}
                      </td>
                    </tr>
                  ) : (
                    proteinMarkers.map((marker, index) => (
                      <tr key={index} className={marker.is_abnormal ? 'row-abnormal' : ''}>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={marker.marker_name}
                              onChange={(e) => handleProteinMarkerChange(index, 'marker_name', e.target.value)}
                              placeholder="예: EGFR"
                            />
                          ) : (
                            marker.marker_name
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={marker.value}
                              onChange={(e) => handleProteinMarkerChange(index, 'value', e.target.value)}
                              placeholder="결과값"
                            />
                          ) : (
                            marker.value
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={marker.unit || ''}
                              onChange={(e) => handleProteinMarkerChange(index, 'unit', e.target.value)}
                              placeholder="단위"
                            />
                          ) : (
                            marker.unit || '-'
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="text"
                              value={marker.reference_range || ''}
                              onChange={(e) => handleProteinMarkerChange(index, 'reference_range', e.target.value)}
                              placeholder="참고 범위"
                            />
                          ) : (
                            marker.reference_range || '-'
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <select
                              value={marker.interpretation || ''}
                              onChange={(e) => handleProteinMarkerChange(index, 'interpretation', e.target.value)}
                            >
                              <option value="">선택</option>
                              <option value="양성">양성 (Positive)</option>
                              <option value="음성">음성 (Negative)</option>
                              <option value="과발현">과발현 (Overexpressed)</option>
                              <option value="저발현">저발현 (Underexpressed)</option>
                              <option value="정상">정상 (Normal)</option>
                            </select>
                          ) : (
                            marker.interpretation || '-'
                          )}
                        </td>
                        <td>
                          {canEdit ? (
                            <input
                              type="checkbox"
                              checked={marker.is_abnormal || false}
                              onChange={(e) => handleProteinMarkerChange(index, 'is_abnormal', e.target.checked)}
                            />
                          ) : (
                            marker.is_abnormal ? <span className="flag flag-abnormal">이상</span> : <span className="flag flag-normal">정상</span>
                          )}
                        </td>
                        {canEdit && (
                          <td>
                            <button
                              className="btn btn-sm btn-danger"
                              onClick={() => handleRemoveProteinMarker(index)}
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

        {/* 해석/소견 탭 */}
        {activeTab === 'interpretation' && (
          <div className="interpretation-tab">
            <div className="form-group">
              <label>의학적 해석 (Interpretation)</label>
              {canEdit ? (
                <textarea
                  value={interpretation}
                  onChange={(e) => setInterpretation(e.target.value)}
                  placeholder="검사 결과에 대한 의학적 해석을 입력하세요..."
                  rows={6}
                />
              ) : (
                <div className="readonly-text">{interpretation || '해석 내용 없음'}</div>
              )}
            </div>

            <div className="form-group">
              <label>추가 메모</label>
              {canEdit ? (
                <textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="추가 메모 사항..."
                  rows={4}
                />
              ) : (
                <div className="readonly-text">{notes || '메모 없음'}</div>
              )}
            </div>

            {criticalCount > 0 && (
              <div className="critical-warning">
                <strong>⚠️ Critical 결과 안내</strong>
                <p>
                  {criticalCount}개의 Critical 결과가 있습니다. 담당 의사에게 즉시 통보하고 해석
                  내용을 필수로 입력해주세요.
                </p>
              </div>
            )}

            <div className="disclaimer">
              <p>
                ※ 본 결과는 진단을 보조하기 위한 참고 자료이며 최종 판단은 의료진의 결정에 따릅니다.
              </p>
            </div>
          </div>
        )}

        {/* 이력 탭 */}
        {activeTab === 'history' && (
          <div className="history-tab">
            <table className="history-table">
              <thead>
                <tr>
                  <th>일시</th>
                  <th>액션</th>
                  <th>수행자</th>
                  <th>상태 변경</th>
                  <th>사유</th>
                </tr>
              </thead>
              <tbody>
                {ocs.history.map((h) => (
                  <tr key={h.id}>
                    <td>{formatDate(h.created_at)}</td>
                    <td>{h.action_display}</td>
                    <td>{h.actor?.name || '-'}</td>
                    <td>
                      {h.from_status && h.to_status
                        ? `${h.from_status} → ${h.to_status}`
                        : h.to_status || '-'}
                    </td>
                    <td>{h.reason || '-'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* PDF 미리보기 모달 */}
      <PdfPreviewModal
        isOpen={pdfPreviewOpen}
        onClose={() => setPdfPreviewOpen(false)}
        onConfirm={handleExportPDF}
        title="LIS 검사 결과 PDF 미리보기"
      >
        {ocs && (
          <DocumentPreview
            title="검사 결과 보고서"
            subtitle="LIS (Laboratory Information System)"
            infoGrid={[
              { label: '환자번호', value: ocs.patient.patient_number },
              { label: '환자명', value: ocs.patient.name },
              { label: '검사번호', value: ocs.ocs_id },
              { label: '검사유형', value: ocs.job_type },
              { label: '처방의', value: ocs.doctor.name },
              { label: '검사자', value: ocs.worker?.name },
              { label: '검사일', value: formatDatePreview(ocs.created_at) },
              { label: '확정일', value: formatDatePreview(ocs.result_ready_at) },
            ]}
            sections={[
              {
                type: 'table',
                title: '검사 결과',
                columns: ['검사항목', '결과값', '단위', '참고범위', '플래그'],
                rows: labResults.map(r => ({
                  '검사항목': r.testName,
                  '결과값': r.value,
                  '단위': r.unit,
                  '참고범위': r.refRange,
                  '플래그': r.flag === 'abnormal' ? 'H' : r.flag === 'critical' ? 'HH' : '-',
                })),
                emptyText: '검사 결과가 없습니다.',
              },
              ...(interpretation ? [{
                type: 'text' as const,
                title: '의학적 해석 (Interpretation)',
                content: interpretation,
              }] : []),
            ]}
            signature={{ label: '검사자', name: ocs.worker?.name || '-' }}
          />
        )}
      </PdfPreviewModal>
    </div>
  );
}
