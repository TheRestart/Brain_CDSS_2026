import { api } from './api';

// =============================================================================
// AI Inference API
// =============================================================================

export interface AIModel {
  id: number;
  code: string;
  name: string;
  description: string;
  ocs_sources: string[];
  required_keys: Record<string, string[]>;
  version: string;
  is_active: boolean;
  config: Record<string, unknown>;
  created_at: string;
  updated_at: string;
}

export interface AIInferenceRequest {
  id: number;
  request_id: string;
  patient: number;
  patient_name: string;
  patient_number: string;
  model: number;
  model_code: string;
  model_name: string;
  requested_by: number;
  requested_by_name: string;
  ocs_references: number[];
  input_data: Record<string, unknown>;
  status: 'PENDING' | 'VALIDATING' | 'PROCESSING' | 'COMPLETED' | 'FAILED' | 'CANCELLED';
  status_display: string;
  priority: 'low' | 'normal' | 'high' | 'urgent';
  priority_display: string;
  requested_at: string;
  started_at: string | null;
  completed_at: string | null;
  processing_time: number | null;
  error_message: string | null;
  has_result: boolean;
  result?: AIInferenceResult;
  logs?: AIInferenceLog[];
  created_at: string;
  updated_at: string;
}

export interface AIInferenceResult {
  id: number;
  result_data: Record<string, unknown>;
  confidence_score: number | null;
  visualization_paths: string[];
  reviewed_by: number | null;
  reviewed_by_name: string | null;
  review_status: 'pending' | 'approved' | 'rejected';
  review_status_display: string;
  review_comment: string | null;
  reviewed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface AIInferenceLog {
  id: number;
  action: string;
  action_display: string;
  message: string;
  details: Record<string, unknown>;
  created_at: string;
}

export interface DataValidationResult {
  valid: boolean;
  patient_id: number;
  model_code: string;
  available_keys: string[];
  missing_keys: string[];
  ocs_info: Record<string, {
    has_ocs: boolean;
    ocs_id: number | null;
    ocs_status: string | null;
  }>;
}

export interface AvailableModel {
  code: string;
  name: string;
  description: string;
  is_available: boolean;
  available_keys: string[];
  missing_keys: string[];
}

// =============================================================================
// API 함수
// =============================================================================

// 모델 목록 조회
export const getAIModels = async (): Promise<AIModel[]> => {
  const response = await api.get<AIModel[]>('/ai/models/');
  return response.data;
};

// 모델 상세 조회
export const getAIModel = async (code: string): Promise<AIModel> => {
  const response = await api.get<AIModel>(`/ai/models/${code}/`);
  return response.data;
};

// 추론 요청 목록
// NOTE: 백엔드의 실제 엔드포인트는 /ai/inferences/
export const getAIRequests = async (params?: {
  patient_id?: number;
  model_code?: string;
  status?: string;
  my_only?: boolean;
}): Promise<AIInferenceRequest[]> => {
  // 백엔드의 실제 엔드포인트 사용
  const backendParams: Record<string, string> = {};
  if (params?.model_code) backendParams.model_type = params.model_code;
  if (params?.status) backendParams.status = params.status;

  const response = await api.get('/ai/inferences/', { params: backendParams });
  const data = response.data || [];

  // 백엔드 응답을 AIInferenceRequest 형식으로 매핑
  return data.map((item: AIInferenceBackendResponse) => ({
    id: item.id,
    request_id: item.job_id,
    patient: 0,
    patient_name: item.patient_name || '',
    patient_number: item.patient_number || '',
    model: 0,
    model_code: item.model_type,
    model_name: item.model_type === 'M1' ? 'M1 MRI 분석' : item.model_type === 'MG' ? 'MG Gene Analysis' : 'MM 멀티모달',
    requested_by: item.requested_by || 0,
    requested_by_name: item.requested_by_name || '',
    ocs_references: [],
    input_data: {},
    status: item.status,
    status_display: item.status,
    priority: 'normal' as const,
    priority_display: '보통',
    requested_at: item.created_at,
    started_at: null,
    completed_at: item.completed_at || null,
    processing_time: item.processing_time ?? null,
    error_message: item.error_message || null,
    has_result: item.status === 'COMPLETED',
    result: item.status === 'COMPLETED' ? {
      id: item.id,
      result_data: item.result_data || {},
      confidence_score: null,
      visualization_paths: [],
      reviewed_by: null,
      reviewed_by_name: item.reviewed_by_name || null,
      review_status: (item.review_status || 'pending') as 'pending' | 'approved' | 'rejected',
      review_status_display: item.review_status === 'approved' ? '승인됨' : item.review_status === 'rejected' ? '반려됨' : '검토 대기',
      review_comment: item.review_comment || null,
      reviewed_at: item.reviewed_at || null,
      created_at: item.created_at,
      updated_at: item.created_at,
    } : undefined,
    created_at: item.created_at,
    updated_at: item.created_at,
  }));
};

// 추론 요청 상세 (job_id로 조회)
export const getAIRequest = async (jobId: string): Promise<AIInferenceRequest> => {
  // 백엔드 /ai/inferences/<job_id>/ 엔드포인트 사용
  const response = await api.get(`/ai/inferences/${jobId}/`);
  const item = response.data as AIInferenceBackendResponse;

  // 백엔드 응답을 AIInferenceRequest 형식으로 매핑
  return {
    id: item.id,
    request_id: item.job_id,
    patient: 0,
    patient_name: item.patient_name || '',
    patient_number: item.patient_number || '',
    model: 0,
    model_code: item.model_type,
    model_name: item.model_type === 'M1' ? 'M1 MRI 분석' : item.model_type === 'MG' ? 'MG Gene Analysis' : 'MM 멀티모달',
    requested_by: item.requested_by || 0,
    requested_by_name: item.requested_by_name || '',
    ocs_references: [],
    input_data: item.result_data || {},
    status: item.status as AIInferenceRequest['status'],
    status_display: item.status,
    priority: 'normal' as const,
    priority_display: '보통',
    requested_at: item.created_at,
    started_at: null,
    completed_at: item.completed_at || null,
    processing_time: item.processing_time ?? null,
    error_message: item.error_message || null,
    has_result: item.status === 'COMPLETED',
    result: item.status === 'COMPLETED' ? {
      id: item.id,
      result_data: item.result_data || {},
      confidence_score: null,
      visualization_paths: [],
      reviewed_by: null,
      reviewed_by_name: item.reviewed_by_name || null,
      review_status: (item.review_status || 'pending') as 'pending' | 'approved' | 'rejected',
      review_status_display: item.review_status === 'approved' ? '승인됨' : item.review_status === 'rejected' ? '반려됨' : '검토 대기',
      review_comment: item.review_comment || null,
      reviewed_at: item.reviewed_at || null,
      created_at: item.created_at,
      updated_at: item.created_at,
    } : undefined,
    created_at: item.created_at,
    updated_at: item.created_at,
  };
};

// 추론 요청 생성
export const createAIRequest = async (data: {
  patient_id: number;
  model_code: string;
  priority?: string;
  ocs_ids?: number[];
}): Promise<AIInferenceRequest> => {
  const response = await api.post<AIInferenceRequest>('/ai/requests/', data);
  return response.data;
};

// 추론 요청 취소 (job_id로 취소)
export const cancelAIRequest = async (jobId: string): Promise<{ message: string }> => {
  const response = await api.post<{ message: string }>(`/ai/inferences/${jobId}/cancel/`);
  return response.data;
};

// 추론 요청 상태 조회
export const getAIRequestStatus = async (id: number): Promise<{
  request_id: string;
  status: string;
  status_display: string;
  started_at: string | null;
  completed_at: string | null;
  error_message: string | null;
  has_result: boolean;
}> => {
  const response = await api.get(`/ai/requests/${id}/status/`);
  return response.data;
};

// 데이터 검증
export const validateAIData = async (data: {
  patient_id: number;
  model_code: string;
}): Promise<DataValidationResult> => {
  const response = await api.post<DataValidationResult>('/ai/requests/validate/', data);
  return response.data;
};

// 결과 검토 (job_id로 검토)
export const reviewAIResult = async (jobId: string, data: {
  review_status: 'approved' | 'rejected';
  review_comment?: string;
}): Promise<{ message: string; review_status: string; review_status_display: string }> => {
  const response = await api.post(`/ai/inferences/${jobId}/review/`, data);
  return response.data;
};

// 환자별 추론 요청 이력
export const getPatientAIRequests = async (patientId: number): Promise<AIInferenceRequest[]> => {
  const response = await api.get(`/ai/patients/${patientId}/requests/`);
  const data = response.data || [];

  // 백엔드 응답을 AIInferenceRequest 형식으로 매핑
  return data.map((item: AIInferenceBackendResponse & { mri_ocs?: number; rna_ocs?: number; protein_ocs?: number }) => {
    // OCS 참조 배열 생성 (mri_ocs, rna_ocs, protein_ocs에서)
    const ocsRefs: number[] = [];
    if (item.mri_ocs) ocsRefs.push(item.mri_ocs);
    if (item.rna_ocs) ocsRefs.push(item.rna_ocs);
    if (item.protein_ocs) ocsRefs.push(item.protein_ocs);

    return {
      id: item.id,
      request_id: item.job_id,
      patient: patientId,
      patient_name: item.patient_name || '',
      patient_number: item.patient_number || '',
      model: 0,
      model_code: item.model_type,
      model_name: item.model_type === 'M1' ? 'M1 MRI 분석' : item.model_type === 'MG' ? 'MG Gene Analysis' : 'MM 멀티모달',
      requested_by: item.requested_by || 0,
      requested_by_name: item.requested_by_name || '',
      ocs_references: ocsRefs,
      input_data: {},
      status: item.status as AIInferenceRequest['status'],
      status_display: item.status,
      priority: 'normal' as const,
      priority_display: '보통',
      requested_at: item.created_at,
      started_at: null,
      completed_at: item.completed_at || null,
      processing_time: item.processing_time ?? null,
      error_message: item.error_message || null,
      has_result: item.status === 'COMPLETED',
      result: item.status === 'COMPLETED' ? {
        id: item.id,
        result_data: item.result_data || {},
        confidence_score: null,
        visualization_paths: [],
        reviewed_by: null,
        reviewed_by_name: item.reviewed_by_name || null,
        review_status: (item.review_status || 'pending') as 'pending' | 'approved' | 'rejected',
        review_status_display: item.review_status === 'approved' ? '승인됨' : item.review_status === 'rejected' ? '반려됨' : '검토 대기',
        review_comment: item.review_comment || null,
        reviewed_at: item.reviewed_at || null,
        created_at: item.created_at,
        updated_at: item.created_at,
      } : undefined,
      created_at: item.created_at,
      updated_at: item.created_at,
    };
  });
};

// 환자별 사용 가능한 모델
export const getPatientAvailableModels = async (patientId: number): Promise<AvailableModel[]> => {
  const response = await api.get<AvailableModel[]>(`/ai/patients/${patientId}/available-models/`);
  return response.data;
};

// 모델에 적합한 OCS 목록 (환자별)
export interface OCSForModelItem {
  id: number;
  ocs_id: string;
  job_role: string;
  job_type: string;
  ocs_status: string;
  confirmed_at: string | null;
  created_at: string;
  is_compatible: boolean;
  available_keys: string[];
  missing_keys: string[];
}

// 백엔드 AI 추론 응답 타입
export interface AIInferenceBackendResponse {
  id: number;
  job_id: string;
  model_type: string;
  status: string;
  patient_name?: string;
  patient_number?: string;
  requested_by?: number;
  requested_by_name?: string;
  created_at: string;
  completed_at?: string;
  processing_time?: number;
  result_data?: Record<string, unknown>;
  error_message?: string;
  review_status?: 'pending' | 'approved' | 'rejected';
  reviewed_by_name?: string;
  review_comment?: string;
  reviewed_at?: string;
}

export interface OCSForModelResponse {
  model_code: string;
  model_name: string;
  required_sources: string[];
  ocs_list: OCSForModelItem[];
}

export const getOCSForModel = async (
  patientId: number,
  modelCode: string
): Promise<OCSForModelResponse> => {
  const response = await api.get<OCSForModelResponse>(
    `/ai/patients/${patientId}/ocs-for-model/`,
    { params: { model_code: modelCode } }
  );
  return response.data;
};

// =============================================================================
// AI Inference API (modAI 서버 연동)
// =============================================================================

// OCS API
export const ocsApi = {
  // 전체 OCS 목록 조회
  getAllOcsList: async () => {
    const response = await api.get('/ocs/', {
      params: { page_size: 100 }
    });
    return response.data;
  },

  // MRI OCS 목록 조회 (RIS + MRI + CONFIRMED)
  getMriOcsList: async () => {
    const response = await api.get('/ocs/', {
      params: {
        job_role: 'RIS',
        job_type: 'MRI',
        ocs_status: 'CONFIRMED',
        page_size: 100,
      },
    });
    return response.data;
  },

  // LIS RNA_SEQ OCS 목록 조회 (Gene Expression)
  getRnaSeqOcsList: async () => {
    const response = await api.get('/ocs/', {
      params: {
        job_role: 'LIS',
        job_type: 'RNA_SEQ',
        ocs_status: 'CONFIRMED',
        page_size: 100,
      },
    });
    return response.data;
  },

  // LIS BIOMARKER OCS 목록 조회 (Protein)
  getBiomarkerOcsList: async () => {
    const response = await api.get('/ocs/', {
      params: {
        job_role: 'LIS',
        job_type: 'BIOMARKER',
        ocs_status: 'CONFIRMED',
        page_size: 100,
      },
    });
    return response.data;
  },

  // OCS 상세 조회
  getOcs: async (id: number) => {
    const response = await api.get(`/ocs/${id}/`);
    return response.data;
  },
};

// AI Inference API
export const aiApi = {
  // M1 추론 요청
  requestM1Inference: async (ocsId: number, mode: 'manual' | 'auto' = 'manual') => {
    const response = await api.post('/ai/m1/inference/', {
      ocs_id: ocsId,
      mode,
    });
    return response.data;
  },

  // MG 추론 요청
  requestMGInference: async (ocsId: number, mode: 'manual' | 'auto' = 'manual') => {
    const response = await api.post('/ai/mg/inference/', {
      ocs_id: ocsId,
      mode,
    });
    return response.data;
  },

  // MM 추론 요청 (Multimodal)
  requestMMInference: async (
    mriOcsId: number | null,
    geneOcsId: number | null,
    proteinOcsId: number | null,
    mode: 'manual' | 'auto' = 'manual',
    isResearch: boolean = false
  ) => {
    const response = await api.post('/ai/mm/inference/', {
      mri_ocs_id: mriOcsId,
      gene_ocs_id: geneOcsId,
      protein_ocs_id: proteinOcsId,
      mode,
      is_research: isResearch,
    });
    return response.data;
  },

  // 추론 목록 조회
  getInferenceList: async (modelType?: string, status?: string) => {
    const params: Record<string, string> = {};
    if (modelType) params.model_type = modelType;
    if (status) params.status = status;
    const response = await api.get('/ai/inferences/', { params });
    return response.data;
  },

  // 추론 상세 조회
  getInferenceDetail: async (jobId: string) => {
    const response = await api.get(`/ai/inferences/${jobId}/`);
    return response.data;
  },

  // 추론 결과 파일 목록 조회
  getInferenceFiles: async (jobId: string) => {
    const response = await api.get(`/ai/inferences/${jobId}/files/`);
    return response.data;
  },

  // 파일 다운로드 URL 생성
  getFileDownloadUrl: (jobId: string, filename: string) => {
    return `/api/ai/inferences/${jobId}/files/${filename}/`;
  },

  // 세그멘테이션 데이터 조회 (MRI + Segmentation mask)
  getSegmentationData: async (jobId: string) => {
    const response = await api.get(`/ai/inferences/${jobId}/segmentation/`, {
      params: { enc: 'binary' }
    });
    const data = response.data;

    // base64 인코딩된 경우 디코딩
    if (data.encoding === 'base64') {
      const shape = data.shape as [number, number, number];

      // base64 → Float32Array → 3D 배열 변환 (에러 처리 포함)
      const decodeBase64To3D = (base64: string): number[][][] | null => {
        if (!base64 || typeof base64 !== 'string') {
          console.warn('Invalid base64 input');
          return null;
        }
        try {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const float32 = new Float32Array(bytes.buffer);

          // 1D → 3D 변환
          const result: number[][][] = [];
          let idx = 0;
          for (let x = 0; x < shape[0]; x++) {
            result[x] = [];
            for (let y = 0; y < shape[1]; y++) {
              result[x][y] = [];
              for (let z = 0; z < shape[2]; z++) {
                result[x][y][z] = float32[idx++] ?? 0;
              }
            }
          }
          return result;
        } catch (error) {
          console.error('Base64 디코딩 실패:', error);
          return null;
        }
      };

      // MRI 및 prediction 디코딩
      if (typeof data.mri === 'string') {
        data.mri = decodeBase64To3D(data.mri);
      }
      if (typeof data.prediction === 'string') {
        data.prediction = decodeBase64To3D(data.prediction);
      }
      if (typeof data.groundTruth === 'string') {
        data.groundTruth = decodeBase64To3D(data.groundTruth);
      }

      // MRI 채널 디코딩 (T1, T1CE, T2, FLAIR)
      if (data.mri_channels) {
        const channels = ['t1', 't1ce', 't2', 'flair'];
        for (const ch of channels) {
          if (typeof data.mri_channels[ch] === 'string') {
            data.mri_channels[ch] = decodeBase64To3D(data.mri_channels[ch]);
          }
        }
      }
    }

    return data;
  },

  // 추론 결과 삭제 (job_id로)
  deleteInference: async (jobId: string) => {
    const response = await api.delete(`/ai/inferences/${jobId}/`);
    return response.data;
  },

  // MM 추론 가능 OCS 목록 조회
  getMMAvailableOCS: async (patientId: string) => {
    const response = await api.get(`/ai/mm/available-ocs/${patientId}/`);
    return response.data;
  },

  // Gene Expression 데이터 조회
  getGeneExpressionData: async (ocsId: number) => {
    const response = await api.get(`/ai/mg/gene-expression/${ocsId}/`);
    return response.data;
  },

  // SEG 비교 데이터 조회 (M1_seg vs Orthanc SEG)
  getSegmentationCompareData: async (jobId: string): Promise<SegmentationCompareData> => {
    const response = await api.get(`/ai/inferences/${jobId}/segmentation/compare/`);
    const data = response.data;

    // base64 인코딩된 경우 디코딩
    if (data.encoding === 'base64') {
      const predShape = data.shape as [number, number, number];
      const gtShape = data.ground_truth_shape as [number, number, number] | undefined;

      // base64 → Float32Array → 3D 배열 변환
      const decodeBase64To3D = (base64: string, shape: [number, number, number]): number[][][] | null => {
        if (!base64 || typeof base64 !== 'string') {
          return null;
        }
        try {
          const binary = atob(base64);
          const bytes = new Uint8Array(binary.length);
          for (let i = 0; i < binary.length; i++) {
            bytes[i] = binary.charCodeAt(i);
          }
          const float32 = new Float32Array(bytes.buffer);

          // 1D → 3D 변환
          const result: number[][][] = [];
          let idx = 0;
          for (let x = 0; x < shape[0]; x++) {
            result[x] = [];
            for (let y = 0; y < shape[1]; y++) {
              result[x][y] = [];
              for (let z = 0; z < shape[2]; z++) {
                result[x][y][z] = float32[idx++] ?? 0;
              }
            }
          }
          return result;
        } catch (error) {
          console.error('Base64 디코딩 실패:', error);
          return null;
        }
      };

      // Prediction 디코딩
      if (typeof data.prediction === 'string') {
        data.prediction = decodeBase64To3D(data.prediction, predShape);
      }

      // Ground Truth 디코딩 (있는 경우)
      if (data.has_ground_truth && typeof data.ground_truth === 'string' && gtShape) {
        data.ground_truth = decodeBase64To3D(data.ground_truth, gtShape);
      }
    }

    return data as SegmentationCompareData;
  },
};

// =============================================================================
// SEG 비교 데이터 타입
// =============================================================================

export interface SegmentationCompareData {
  job_id: string;
  model_type: string;
  shape: [number, number, number];
  encoding: string;
  dtype: string;

  // 예측 데이터
  prediction: number[][][] | null;
  prediction_volumes: {
    wt_volume?: number;
    tc_volume?: number;
    et_volume?: number;
    ncr_volume?: number;
    ed_volume?: number;
  };

  // Ground Truth 데이터
  has_ground_truth: boolean;
  orthanc_seg_status: 'loaded' | 'not_found' | 'no_ocs';
  ground_truth: number[][][] | null;
  ground_truth_shape?: [number, number, number];
  gt_volumes: {
    wt_volume?: number;
    tc_volume?: number;
    et_volume?: number;
    ncr_volume?: number;
    ed_volume?: number;
  } | null;

  // 비교 메트릭
  comparison_metrics: {
    dice_wt?: number;
    dice_tc?: number;
    dice_et?: number;
    dice_mean?: number;
    error?: string;
  } | null;
}

// =============================================================================
// AI Analytics API (대시보드용)
// =============================================================================

export interface AIAnalyticsStats {
  total_analyses: number;
  completed: number;
  in_progress: number;
  pending: number;
  failed: number;

  result_distribution: {
    grade: { G2: number; G3: number; G4: number };
    risk: { low: number; medium: number; high: number };
    idh: { mutant: number; wildtype: number };
    mgmt: { methylated: number; unmethylated: number };
  };

  performance: {
    avg_dice_wt: number;
    avg_dice_tc: number;
    avg_dice_et: number;
    avg_processing_time_seconds: number;
    approval_rate: number;
    rejection_rate: number;
  };

  high_risk_patients: {
    patient_id: number;
    patient_name: string;
    risk_level: string;
    analysis_date: string;
  }[];
}

export interface ModelUsageStats {
  period: string;
  data: {
    date: string;
    m1_count: number;
    mg_count: number;
    mm_count: number;
  }[];
  totals: {
    m1: number;
    mg: number;
    mm: number;
  };
}

// AI 분석 통계 조회
export const getAIAnalyticsStats = async (
  dateRange?: { start: string; end: string }
): Promise<AIAnalyticsStats> => {
  try {
    const response = await api.get('/ai/analytics/stats/', { params: dateRange });
    return response.data;
  } catch {
    // API가 아직 없는 경우 목업 데이터 반환
    return {
      total_analyses: 0,
      completed: 0,
      in_progress: 0,
      pending: 0,
      failed: 0,
      result_distribution: {
        grade: { G2: 0, G3: 0, G4: 0 },
        risk: { low: 0, medium: 0, high: 0 },
        idh: { mutant: 0, wildtype: 0 },
        mgmt: { methylated: 0, unmethylated: 0 },
      },
      performance: {
        avg_dice_wt: 0,
        avg_dice_tc: 0,
        avg_dice_et: 0,
        avg_processing_time_seconds: 0,
        approval_rate: 0,
        rejection_rate: 0,
      },
      high_risk_patients: [],
    };
  }
};

// 모델별 사용 통계 조회
export const getModelUsageStats = async (
  period: 'day' | 'week' | 'month'
): Promise<ModelUsageStats> => {
  try {
    const response = await api.get('/ai/analytics/model-usage/', { params: { period } });
    return response.data;
  } catch {
    // API가 아직 없는 경우 목업 데이터 반환
    return {
      period,
      data: [],
      totals: { m1: 0, mg: 0, mm: 0 },
    };
  }
}

// =============================================================================
// AI Compare API (비교 기능용)
// =============================================================================

// 환자별 AI 분석 이력 조회 (M1 모델 필터)
export const getPatientAIHistory = async (
  patientId: number,
  modelCode?: 'M1' | 'MG' | 'MM'
): Promise<AIInferenceRequest[]> => {
  try {
    const params: Record<string, string | number> = { patient_id: patientId };
    if (modelCode) params.model_type = modelCode;

    const response = await api.get('/ai/inferences/', { params });
    const data = response.data || [];

    // 백엔드 응답을 AIInferenceRequest 형식으로 매핑
    return data
      .filter((item: AIInferenceBackendResponse) => item.status === 'COMPLETED')
      .map((item: AIInferenceBackendResponse) => ({
        id: item.id,
        request_id: item.job_id,
        patient: patientId,
        patient_name: item.patient_name || '',
        patient_number: item.patient_number || '',
        model: 0,
        model_code: item.model_type,
        model_name: item.model_type === 'M1' ? 'M1 MRI 분석' : item.model_type === 'MG' ? 'MG Gene Analysis' : 'MM 멀티모달',
        requested_by: item.requested_by || 0,
        requested_by_name: item.requested_by_name || '',
        ocs_references: [],
        input_data: {},
        status: item.status as AIInferenceRequest['status'],
        status_display: item.status,
        priority: 'normal' as const,
        priority_display: '보통',
        requested_at: item.created_at,
        started_at: null,
        completed_at: item.completed_at || null,
        processing_time: item.processing_time ?? null,
        error_message: item.error_message || null,
        has_result: item.status === 'COMPLETED',
        result: item.status === 'COMPLETED' ? {
          id: item.id,
          result_data: item.result_data || {},
          confidence_score: null,
          visualization_paths: [],
          reviewed_by: null,
          reviewed_by_name: item.reviewed_by_name || null,
          review_status: (item.review_status || 'pending') as 'pending' | 'approved' | 'rejected',
          review_status_display: item.review_status === 'approved' ? '승인됨' : item.review_status === 'rejected' ? '반려됨' : '검토 대기',
          review_comment: item.review_comment || null,
          reviewed_at: item.reviewed_at || null,
          created_at: item.created_at,
          updated_at: item.created_at,
        } : undefined,
        created_at: item.created_at,
        updated_at: item.created_at,
      }));
  } catch (error) {
    console.error('Failed to fetch patient AI history:', error);
    return [];
  }
}

// 두 결과 비교 데이터 조회
export interface AICompareResult {
  job1: AIInferenceRequest;
  job2: AIInferenceRequest;
  changes: {
    wt_change_ml: number;
    wt_change_percent: number;
    tc_change_ml: number;
    tc_change_percent: number;
    et_change_ml: number;
    et_change_percent: number;
    days_between: number;
  };
}

export const getAICompareData = async (
  jobId1: string,
  jobId2: string
): Promise<AICompareResult | null> => {
  try {
    const response = await api.get('/ai/compare/', {
      params: { job1: jobId1, job2: jobId2 }
    });
    return response.data;
  } catch {
    // API가 없는 경우 null 반환 (프론트에서 직접 계산)
    return null;
  }
}
