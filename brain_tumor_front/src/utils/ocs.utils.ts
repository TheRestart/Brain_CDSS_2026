/**
 * OCS 공통 유틸리티 함수
 */

// =============================================================================
// 날짜 포맷
// =============================================================================

/**
 * ISO 문자열을 한국어 날짜 형식으로 변환
 */
export const formatDate = (dateStr: string | null): string => {
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

/**
 * 간단한 날짜 형식 (시간 제외)
 */
export const formatDateShort = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

/**
 * 상대적 시간 표시 (예: "3시간 전")
 */
export const formatRelativeTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffMins = Math.floor(diffMs / (1000 * 60));
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffMins < 1) return '방금 전';
  if (diffMins < 60) return `${diffMins}분 전`;
  if (diffHours < 24) return `${diffHours}시간 전`;
  if (diffDays < 7) return `${diffDays}일 전`;
  return formatDateShort(dateStr);
};

// =============================================================================
// 상태 스타일
// =============================================================================

/**
 * OCS 상태에 따른 CSS 클래스
 */
export const getStatusClass = (status: string): string => {
  const classes: Record<string, string> = {
    ORDERED: 'status-ordered',
    ACCEPTED: 'status-accepted',
    IN_PROGRESS: 'status-in_progress',
    RESULT_READY: 'status-result-ready',
    CONFIRMED: 'status-confirmed',
    CANCELLED: 'status-cancelled',
  };
  return classes[status] || '';
};

/**
 * 우선순위에 따른 CSS 클래스
 */
export const getPriorityClass = (priority: string): string => {
  const classes: Record<string, string> = {
    urgent: 'priority-urgent',
    normal: 'priority-normal',
  };
  return classes[priority] || '';
};

/**
 * 상태에 따른 배경색 (인라인 스타일용)
 */
export const getStatusColor = (status: string): string => {
  const colors: Record<string, string> = {
    ORDERED: '#fef3c7',
    ACCEPTED: '#dbeafe',
    IN_PROGRESS: '#d1fae5',
    RESULT_READY: '#e0e7ff',
    CONFIRMED: '#dcfce7',
    CANCELLED: '#fee2e2',
  };
  return colors[status] || '#f3f4f6';
};

/**
 * 우선순위에 따른 배경색
 */
export const getPriorityColor = (priority: string): string => {
  const colors: Record<string, string> = {
    urgent: '#fecaca',
    normal: '#e0e7ff',
  };
  return colors[priority] || '#f3f4f6';
};

// =============================================================================
// 파일 유틸리티
// =============================================================================

/**
 * 파일 크기를 읽기 쉬운 형식으로 변환
 */
export const formatFileSize = (bytes: number): string => {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(1) + ' MB';
};

/**
 * 파일 타입에 따른 아이콘 반환
 */
export const getFileIcon = (type: string): string => {
  if (type.includes('pdf')) return '📄';
  if (type.includes('image')) return '🖼️';
  if (type.includes('dicom')) return '🩻';
  if (type.includes('sheet') || type.includes('excel') || type.includes('csv')) return '📊';
  if (type.includes('word') || type.includes('document')) return '📝';
  return '📎';
};

// =============================================================================
// 검증 유틸리티
// =============================================================================

/**
 * RIS 판독 결과 검증
 */
export const validateRISResult = (data: {
  findings?: string;
  impression?: string;
}): { valid: boolean; message?: string } => {
  if (!data.findings?.trim()) {
    return { valid: false, message: '판독 소견(Findings)을 입력해주세요.' };
  }
  if (!data.impression?.trim()) {
    return { valid: false, message: '판독 결론(Impression)을 입력해주세요.' };
  }
  return { valid: true };
};

/**
 * LIS 검사 결과 검증
 */
export const validateLISResult = (data: {
  labResults?: Array<{ flag?: string }>;
  interpretation?: string;
}): { valid: boolean; message?: string } => {
  if (!data.labResults || data.labResults.length === 0) {
    return { valid: false, message: '검사 결과를 입력해주세요.' };
  }

  const hasCritical = data.labResults.some((r) => r.flag === 'critical');
  if (hasCritical && !data.interpretation?.trim()) {
    return {
      valid: false,
      message: 'Critical 결과가 있습니다. 해석(Interpretation)을 입력해주세요.',
    };
  }

  return { valid: true };
};

// =============================================================================
// 권한 체크
// =============================================================================

/**
 * 편집 가능 여부 체크
 */
export const canEditOCS = (
  ocsStatus: string,
  workerId: number | undefined,
  userId: number | undefined
): boolean => {
  const isWorker = workerId === userId;
  const editableStatuses = ['ACCEPTED', 'IN_PROGRESS'];
  return isWorker && editableStatuses.includes(ocsStatus);
};

/**
 * 검증 가능 여부 체크
 */
export const canVerifyOCS = (
  ocsStatus: string,
  workerId: number | undefined,
  userId: number | undefined
): boolean => {
  const isWorker = workerId === userId;
  return isWorker && ocsStatus === 'IN_PROGRESS';
};

/**
 * 확정 완료 여부 체크
 */
export const isOCSFinalized = (ocsStatus: string): boolean => {
  return ['RESULT_READY', 'CONFIRMED'].includes(ocsStatus);
};

// =============================================================================
// Modality 옵션
// =============================================================================

export const MODALITY_OPTIONS = [
  'CT',
  'MRI',
  'PET',
  'X-RAY',
  'Ultrasound',
  'Mammography',
  'Fluoroscopy',
];

// =============================================================================
// LIS 검사 항목 옵션
// =============================================================================

// LIS 검사 유형 (job_type)
export const LIS_TEST_TYPES = [
  // 혈액 검사 (BLOOD)
  'CBC',
  'BMP',
  'CMP',
  'Lipid Panel',
  'Thyroid Panel',
  'Liver Function',
  'Renal Function',
  'Tumor Markers',
  'Coagulation',
  'RFT',
  // 유전자 검사 (GENETIC)
  'GENETIC',
  'RNA_SEQ',
  'DNA_SEQ',
  'GENE_PANEL',
  // 단백질 검사 (PROTEIN)
  'PROTEIN',
  'PROTEIN_PANEL',
  'BIOMARKER',
  // 기타 검사
  'URINE',
  'CSF',
  'BIOPSY',
];

// LIS 검사 카테고리
export const LIS_TEST_CATEGORIES: Record<string, string[]> = {
  BLOOD: ['CBC', 'BMP', 'CMP', 'Lipid Panel', 'Thyroid Panel', 'Liver Function', 'Renal Function', 'Tumor Markers', 'Coagulation', 'RFT'],
  GENETIC: ['GENETIC', 'RNA_SEQ', 'DNA_SEQ', 'GENE_PANEL'],
  PROTEIN: ['PROTEIN', 'PROTEIN_PANEL', 'BIOMARKER'],
  OTHER: ['URINE', 'CSF', 'BIOPSY'],
};

// 검사 유형에 따른 카테고리 반환
export const getLISCategory = (jobType: string): string => {
  for (const [category, types] of Object.entries(LIS_TEST_CATEGORIES)) {
    if (types.includes(jobType)) return category;
  }
  return 'BLOOD'; // 기본값
};

// 검사 카테고리 한글 라벨
export const LIS_CATEGORY_LABELS: Record<string, string> = {
  BLOOD: '혈액 검사',
  GENETIC: '유전자 검사',
  PROTEIN: '단백질 검사',
  OTHER: '기타 검사',
};
