import { useState, useEffect } from 'react'
import { OCSTable, type OCSItem } from '@/components/OCSTable'
import GeneVisualization from '@/components/GeneVisualization'
import type { GeneExpressionData } from '@/components/GeneVisualization/GeneVisualization'
import MGResultViewer from '@/components/MGResultViewer'
import { useAIInference } from '@/context/AIInferenceContext'
import { ocsApi, aiApi } from '@/services/ai.api'

interface MGResult {
  patient_id?: string
  survival_risk?: {
    risk_score: number
    risk_percentile?: number
    risk_category?: string
    model_cindex?: number
  }
  survival_time?: {
    predicted_days: number
    predicted_months: number
    confidence_interval?: { lower: number; upper: number }
  }
  grade?: {
    predicted_class: string
    probability: number
    lgg_probability?: number
    hgg_probability?: number
    probabilities?: Record<string, number>
  }
  recurrence?: {
    predicted_class: string
    probability: number
    recurrence_probability?: number
  }
  tmz_response?: {
    predicted_class: string
    probability: number
    responder_probability?: number
  }
  xai?: {
    attention_weights?: number[]
    top_genes?: Array<{
      rank: number
      gene: string
      attention_score: number
      expression_zscore: number
    }>
    gene_importance_summary?: {
      total_genes: number
      attention_mean: number
      attention_std: number
      attention_max: number
      attention_min: number
    }
    deg_cluster_scores?: Record<string, {
      score: number
      up_genes_count: number
      down_genes_count: number
    }>
    expression_stats?: {
      mean: number
      std: number
      min: number
      max: number
      nonzero_count: number
      positive_count: number
      negative_count: number
    }
  }
  visualizations?: {
    grade_chart?: string
    risk_gauge?: string
    survival_chart?: string
    recurrence_chart?: string
    top_genes_chart?: string
    deg_cluster_chart?: string
    attention_distribution_chart?: string
    expression_profile_chart?: string
  }
  processing_time_ms?: number
  input_genes_count?: number
  model_version?: string
}

interface InferenceRecord {
  id: number
  job_id: string
  model_type: string
  status: string
  mode: string
  patient_name: string
  patient_number: string
  gene_ocs: number | null
  result_data: MGResult | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export default function MGInferencePage() {
  // State
  const [ocsData, setOcsData] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOcs, setSelectedOcs] = useState<OCSItem | null>(null)
  const [inferenceStatus, setInferenceStatus] = useState<string>('')
  const [inferenceResult, setInferenceResult] = useState<MGResult | null>(null)
  const [error, setError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [isCached, setIsCached] = useState<boolean>(false)

  // Gene Expression 시각화
  const [geneExpData, setGeneExpData] = useState<GeneExpressionData | null>(null)
  const [loadingGeneExp, setLoadingGeneExp] = useState(false)
  const [geneExpError, setGeneExpError] = useState<string>('')

  // 추론 이력
  const [inferenceHistory, setInferenceHistory] = useState<InferenceRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // WebSocket (from Context)
  const { lastMessage, isConnected } = useAIInference()

  // OCS 데이터 로드
  useEffect(() => {
    loadOcsData()
    loadInferenceHistory()
  }, [])

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage?.type === 'AI_INFERENCE_RESULT') {
      console.log('Received MG inference result:', lastMessage)

      if (lastMessage.job_id === jobId) {
        if (lastMessage.status === 'COMPLETED') {
          setInferenceStatus('completed')
          if (lastMessage.result) {
            setInferenceResult(lastMessage.result as MGResult)
          }
          setError('')
          loadInferenceHistory()
        } else if (lastMessage.status === 'FAILED') {
          setInferenceStatus('failed')
          setError(lastMessage.error || '추론 실패')
        }
      }
    }
  }, [lastMessage, jobId])

  const loadOcsData = async () => {
    try {
      setLoading(true)
      const response = await ocsApi.getAllOcsList()
      const rawData = response.results || response || []

      // LIS + RNA_SEQ + CONFIRMED만 필터링
      const mappedData: OCSItem[] = rawData
        .filter((item: any) => item.job_role === 'LIS' && item.job_type === 'RNA_SEQ' && item.ocs_status === 'CONFIRMED')
        .map((item: any) => ({
          id: item.id,
          ocs_id: item.ocs_id,
          patient_name: item.patient?.name || '',
          patient_number: item.patient?.patient_number || '',
          job_role: item.job_role || '',
          job_type: item.job_type || '',
          ocs_status: item.ocs_status || '',
          confirmed_at: item.confirmed_at || '',
          ocs_result: item.ocs_result || null,
          attachments: item.attachments || {},
          worker_result: item.worker_result || {},
        }))

      setOcsData(mappedData)
    } catch (err) {
      console.error('Failed to load OCS data:', err)
      setError('OCS 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const loadInferenceHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await aiApi.getInferenceList('MG')
      setInferenceHistory(data || [])
    } catch (err) {
      console.error('Failed to load MG inference history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // Gene Expression 데이터 로드
  const loadGeneExpressionData = async (ocsId: number) => {
    try {
      setLoadingGeneExp(true)
      setGeneExpError('')
      const data = await aiApi.getGeneExpressionData(ocsId)
      setGeneExpData(data)
    } catch (err: any) {
      console.error('Failed to load gene expression data:', err)
      setGeneExpError(err.response?.data?.error || '유전자 발현 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoadingGeneExp(false)
    }
  }

  const handleSelectOcs = (ocs: OCSItem) => {
    setSelectedOcs(ocs)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
    setIsCached(false)
    // Gene Expression 데이터 로드
    loadGeneExpressionData(ocs.id)
  }

  const handleRequestInference = async () => {
    if (!selectedOcs) {
      setError('OCS를 선택해주세요.')
      return
    }

    try {
      setInferenceStatus('requesting')
      setError('')
      setInferenceResult(null)
      setIsCached(false)

      const response = await aiApi.requestMGInference(selectedOcs.id, 'manual')

      setJobId(response.job_id)

      // 캐시된 결과인 경우 바로 표시
      if (response.cached && response.result) {
        console.log('Using cached MG inference result:', response)
        setIsCached(true)
        setInferenceStatus('completed')
        setInferenceResult(response.result as MGResult)
      } else {
        // 새 추론 요청 - WebSocket으로 결과 대기
        setInferenceStatus('processing')
        console.log('MG Inference request sent:', response)
      }
    } catch (err: any) {
      setInferenceStatus('failed')
      setError(
        err.response?.data?.error ||
          err.message ||
          '추론 요청에 실패했습니다.'
      )
    }
  }

  const handleSelectHistory = (record: InferenceRecord) => {
    setJobId(record.job_id)
    setInferenceStatus(record.status.toLowerCase())
    setInferenceResult(record.result_data)
    setError(record.error_message || '')
    setIsCached(false)
  }

  // 추론 이력 삭제
  const handleDeleteInference = async (record: InferenceRecord) => {
    if (!window.confirm(`${record.job_id} 추론 결과를 삭제하시겠습니까?`)) {
      return
    }

    try {
      await aiApi.deleteInference(record.job_id)
      if (record.job_id === jobId) {
        setJobId('')
        setInferenceResult(null)
        setInferenceStatus('')
        setError('')
      }
      loadInferenceHistory()
    } catch (err: any) {
      console.error('Failed to delete inference:', err)
      alert(err.response?.data?.error || '삭제에 실패했습니다.')
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'COMPLETED':
        return <span className="px-2 py-1 text-xs rounded bg-green-100 text-green-800">완료</span>
      case 'PROCESSING':
        return <span className="px-2 py-1 text-xs rounded bg-blue-100 text-blue-800">처리중</span>
      case 'PENDING':
        return <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">대기</span>
      case 'FAILED':
        return <span className="px-2 py-1 text-xs rounded bg-red-100 text-red-800">실패</span>
      default:
        return <span className="px-2 py-1 text-xs rounded bg-gray-100 text-gray-800">{status}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">MG Gene Expression 분석</h2>
          <p className="text-sm text-gray-500 mt-1">
            RNA-seq 유전자 발현 데이터를 분석하여 생존 예측, Grade, 재발, TMZ 반응을 예측합니다.
          </p>
        </div>
        <div className="flex items-center space-x-2">
          <span
            className={`h-2 w-2 rounded-full ${
              isConnected ? 'bg-green-500' : 'bg-red-500'
            }`}
          />
          <span className="text-sm text-gray-500">
            {isConnected ? 'WebSocket 연결됨' : 'WebSocket 연결 안됨'}
          </span>
        </div>
      </div>

      {/* OCS Table */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            LIS RNA_SEQ 목록 ({ocsData.length}건)
          </h3>
          <button
            onClick={loadOcsData}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            새로고침
          </button>
        </div>

        <OCSTable
          data={ocsData}
          selectedId={selectedOcs?.id || null}
          onSelect={handleSelectOcs}
          loading={loading}
        />
      </div>

      {/* Gene Expression Visualization */}
      {selectedOcs && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
          <div className="bg-gray-50 rounded-lg p-4 text-sm">
            <h4 className="font-medium text-gray-900 mb-2">선택된 OCS</h4>
            <dl className="space-y-1 text-gray-600">
              <div className="flex justify-between">
                <dt>OCS ID:</dt>
                <dd className="font-medium">{selectedOcs.ocs_id}</dd>
              </div>
              <div className="flex justify-between">
                <dt>환자:</dt>
                <dd>
                  {selectedOcs.patient_name} ({selectedOcs.patient_number})
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>검사유형:</dt>
                <dd>{selectedOcs.job_type}</dd>
              </div>
              <div className="flex justify-between">
                <dt>파일경로:</dt>
                <dd className="truncate max-w-[200px]">
                  {selectedOcs.worker_result?.file_path || '-'}
                </dd>
              </div>
            </dl>
          </div>
          <div className="flex items-center">
            <button
              onClick={handleRequestInference}
              disabled={
                inferenceStatus === 'requesting' ||
                inferenceStatus === 'processing'
              }
              className={`w-full py-3 px-4 rounded-lg font-medium text-white transition ${
                inferenceStatus === 'requesting' ||
                inferenceStatus === 'processing'
                  ? 'bg-gray-400 cursor-not-allowed'
                  : 'bg-purple-600 hover:bg-purple-700'
              }`}
            >
              {(inferenceStatus === 'requesting' || inferenceStatus === 'processing') && jobId
                ? `'${jobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
                : 'MG 추론 요청'}
            </button>
          </div>
        </div>
      )}

      {/* Gene Expression Data Visualization */}
      {selectedOcs && (
        <GeneVisualization
          data={geneExpData}
          patientId={selectedOcs.patient_number}
          loading={loadingGeneExp}
          error={geneExpError}
        />
      )}

      {/* MG Inference Result */}
      {inferenceStatus === 'processing' && (
        <div className="bg-purple-50 border border-purple-200 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-purple-600 mx-auto" />
          <p className="text-purple-600 mt-3">MG 모델 추론 중...</p>
          <p className="text-sm text-purple-400 mt-1">Job ID: {jobId}</p>
        </div>
      )}

      {inferenceStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">추론 실패</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {inferenceStatus === 'completed' && inferenceResult && (
        <MGResultViewer result={inferenceResult} />
      )}

      {/* Request ID */}
      {jobId && (
        <div className="text-center text-xs text-gray-500">
          Job ID: {jobId}
          {isCached && (
            <span className="ml-2 px-2 py-0.5 bg-yellow-100 text-yellow-700 rounded">
              캐시됨
            </span>
          )}
        </div>
      )}

      {/* Inference History */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold text-gray-900">
            추론 이력 ({inferenceHistory.length}건)
          </h3>
          <button
            onClick={loadInferenceHistory}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            새로고침
          </button>
        </div>

        <div className="bg-white rounded-lg shadow overflow-hidden">
          {loadingHistory ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
            </div>
          ) : inferenceHistory.length > 0 ? (
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    Job ID
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    환자
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    결과
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    처리시간
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    생성일시
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    작업
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {inferenceHistory.map((record) => (
                  <tr
                    key={record.id}
                    className={`hover:bg-gray-50 ${
                      record.job_id === jobId ? 'bg-purple-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {record.job_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.patient_name} ({record.patient_number})
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.status === 'COMPLETED' && record.result_data?.grade ? (
                        <span>
                          Grade: {record.result_data.grade.predicted_class}
                        </span>
                      ) : record.status === 'FAILED' ? (
                        <span className="text-red-600 truncate max-w-[150px] block">
                          {record.error_message || 'Error'}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.status === 'COMPLETED' && record.result_data?.processing_time_ms ? (
                        <span className="font-medium text-purple-600">
                          {(record.result_data.processing_time_ms / 1000).toFixed(2)}초
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-500">
                      {new Date(record.created_at).toLocaleString('ko-KR')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center space-x-2">
                        {record.status === 'COMPLETED' && (
                          <button
                            onClick={() => handleSelectHistory(record)}
                            className="text-sm text-purple-600 hover:text-purple-800"
                          >
                            결과 보기
                          </button>
                        )}
                        <button
                          onClick={() => handleDeleteInference(record)}
                          className="text-sm text-red-600 hover:text-red-800"
                        >
                          삭제
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <div className="text-center py-8 text-gray-500">
              추론 이력이 없습니다.
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
