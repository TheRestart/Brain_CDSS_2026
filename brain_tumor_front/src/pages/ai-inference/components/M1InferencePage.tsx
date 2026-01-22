import { useState, useEffect } from 'react'
import { OCSTable, type OCSItem } from '@/components/OCSTable'
import { InferenceResult } from '@/components/InferenceResult'
import SegMRIViewer, { type SegmentationData } from '@/components/ai/SegMRIViewer'
import { useAIInference } from '@/context/AIInferenceContext'
import { ocsApi, aiApi } from '@/services/ai.api'

interface M1Result {
  grade?: {
    predicted_class: string
    probability: number
    probabilities?: Record<string, number>
  }
  idh?: {
    predicted_class: string
    mutant_probability?: number
  }
  mgmt?: {
    predicted_class: string
    methylated_probability?: number
  }
  survival?: {
    risk_score: number
    risk_category: string
  }
  os_days?: {
    predicted_days: number
    predicted_months: number
  }
  processing_time_ms?: number
}

interface InferenceRecord {
  id: number
  job_id: string
  model_type: string
  status: string
  mode: string
  patient_name: string
  patient_number: string
  mri_ocs: number | null
  result_data: M1Result | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export default function M1InferencePage() {
  // State
  const [ocsData, setOcsData] = useState<OCSItem[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedOcs, setSelectedOcs] = useState<OCSItem | null>(null)
  const [inferenceStatus, setInferenceStatus] = useState<string>('')
  const [inferenceResult, setInferenceResult] = useState<M1Result | null>(null)
  const [error, setError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [isCached, setIsCached] = useState<boolean>(false)

  // 추론 이력
  const [inferenceHistory, setInferenceHistory] = useState<InferenceRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // 세그멘테이션 뷰어
  const [segmentationData, setSegmentationData] = useState<SegmentationData | null>(null)
  const [loadingSegmentation, setLoadingSegmentation] = useState(false)
  const [segmentationError, setSegmentationError] = useState<string>('')

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
      console.log('Received inference result:', lastMessage)

      if (lastMessage.job_id === jobId) {
        if (lastMessage.status === 'COMPLETED') {
          setInferenceStatus('completed')
          if (lastMessage.result) {
            setInferenceResult(lastMessage.result as M1Result)
          }
          setError('')
          // 이력 새로고침
          loadInferenceHistory()
          // 세그멘테이션 데이터 로드
          loadSegmentationData(jobId)
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

      // API 응답을 OCSItem 형태로 변환 (RIS + MRI + CONFIRMED만 필터링)
      const mappedData: OCSItem[] = rawData
        .filter((item: any) => item.job_role === 'RIS' && item.job_type === 'MRI' && item.ocs_status === 'CONFIRMED')
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
      const data = await aiApi.getInferenceList('M1')
      setInferenceHistory(data || [])
    } catch (err) {
      console.error('Failed to load inference history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // 세그멘테이션 데이터 로드
  const loadSegmentationData = async (jobIdToLoad: string) => {
    try {
      setLoadingSegmentation(true)
      setSegmentationError('')
      setSegmentationData(null)

      const data = await aiApi.getSegmentationData(jobIdToLoad)

      // API 응답을 SegmentationData 형식으로 변환
      const segData: SegmentationData = {
        mri: data.mri,
        groundTruth: data.groundTruth || data.prediction,  // GT가 없으면 prediction 사용
        prediction: data.prediction,
        shape: data.shape as [number, number, number],
        mri_channels: data.mri_channels,  // T1, T1CE, T2, FLAIR 4채널
      }

      setSegmentationData(segData)
      console.log('Segmentation data loaded:', segData.shape, 'channels:', data.mri_channels ? Object.keys(data.mri_channels) : 'none')
    } catch (err: any) {
      console.error('Failed to load segmentation data:', err)
      setSegmentationError(
        err.response?.data?.error || '세그멘테이션 데이터를 불러오는데 실패했습니다.'
      )
    } finally {
      setLoadingSegmentation(false)
    }
  }

  const handleSelectOcs = (ocs: OCSItem) => {
    setSelectedOcs(ocs)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
    setIsCached(false)
    setSegmentationData(null)
    setSegmentationError('')
  }

  const handleRequestInference = async () => {
    if (!selectedOcs) {
      setError('OCS를 선택해주세요.')
      return
    }

    // DICOM 정보 확인
    const dicomInfo = selectedOcs.worker_result?.dicom
    if (!dicomInfo?.study_uid) {
      setError('선택한 OCS에 DICOM 정보가 없습니다.')
      return
    }

    try {
      setInferenceStatus('requesting')
      setError('')
      setInferenceResult(null)
      setIsCached(false)

      const response = await aiApi.requestM1Inference(selectedOcs.id, 'manual')

      setJobId(response.job_id)

      // 캐시된 결과인 경우 바로 표시
      if (response.cached && response.result) {
        console.log('Using cached inference result:', response)
        setIsCached(true)
        setInferenceStatus('completed')
        setInferenceResult(response.result as M1Result)
      } else {
        // 새 추론 요청 - WebSocket으로 결과 대기
        setInferenceStatus('processing')
        console.log('Inference request sent:', response)
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

    // 완료된 추론 결과인 경우 세그멘테이션 데이터 로드
    if (record.status === 'COMPLETED') {
      loadSegmentationData(record.job_id)
    } else {
      setSegmentationData(null)
      setSegmentationError('')
    }
  }

  // 추론 이력 삭제
  const handleDeleteInference = async (record: InferenceRecord) => {
    if (!window.confirm(`${record.job_id} 추론 결과를 삭제하시겠습니까?`)) {
      return
    }

    try {
      await aiApi.deleteInference(record.job_id)
      // 현재 선택된 결과가 삭제되는 경우 초기화
      if (record.job_id === jobId) {
        setJobId('')
        setInferenceResult(null)
        setInferenceStatus('')
        setError('')
        setSegmentationData(null)
        setSegmentationError('')
      }
      // 이력 새로고침
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
          <h2 className="text-2xl font-bold text-gray-900">M1 MRI 분석</h2>
          <p className="text-sm text-gray-500 mt-1">
            MRI 영상을 분석하여 Grade, IDH, MGMT, 생존 예측을 수행합니다.
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
            RIS MRI 목록 ({ocsData.length}건)
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

      {/* Selected OCS Info & Inference Button */}
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
                <dt>Study UID:</dt>
                <dd className="truncate max-w-[200px]">
                  {selectedOcs.worker_result?.dicom?.study_uid || '-'}
                </dd>
              </div>
              <div className="flex justify-between">
                <dt>Series 수:</dt>
                <dd>
                  {selectedOcs.worker_result?.dicom?.series?.length || 0}개
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
                  : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {(inferenceStatus === 'requesting' || inferenceStatus === 'processing') && jobId
                ? `'${jobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
                : 'M1 추론 요청'}
            </button>
          </div>
        </div>
      )}

      {/* Inference Result */}
      <div className="space-y-4">
        <h3 className="text-lg font-semibold text-gray-900">추론 결과</h3>

        <InferenceResult
          result={inferenceResult}
          status={inferenceStatus}
          error={error}
          jobId={jobId}
        />

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
      </div>

      {/* Segmentation Viewer */}
      {(inferenceStatus === 'completed' || segmentationData || loadingSegmentation) && (
        <div className="space-y-4">
          <h3 className="text-lg font-semibold text-gray-900">세그멘테이션 뷰어</h3>

          {loadingSegmentation ? (
            <div className="bg-white rounded-lg shadow p-8 text-center">
              <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600 mx-auto" />
              <p className="text-gray-600 mt-3">세그멘테이션 데이터 로딩 중...</p>
            </div>
          ) : segmentationError ? (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <h4 className="text-red-800 font-medium">세그멘테이션 로드 실패</h4>
              <p className="text-red-600 text-sm mt-1">{segmentationError}</p>
            </div>
          ) : segmentationData ? (
            <div className="bg-white rounded-lg shadow p-4">
              <SegMRIViewer
                data={segmentationData}
                title={`세그멘테이션 결과 (Job: ${jobId})`}
                initialViewMode="axial"
                initialDisplayMode="pred_only"
                maxCanvasSize={500}
              />
            </div>
          ) : (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-6 text-center text-gray-500">
              추론 이력에서 완료된 결과를 선택하면 세그멘테이션을 표시합니다.
            </div>
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600 mx-auto" />
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
                      record.job_id === jobId ? 'bg-blue-50' : ''
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
                        <span className="font-medium text-blue-600">
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
                            className="text-sm text-blue-600 hover:text-blue-800"
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
