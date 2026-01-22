import { useState, useEffect, useMemo } from 'react'
import MMResultViewer from '@/components/MMResultViewer'
import { useAIInference } from '@/context/AIInferenceContext'
import { ocsApi, aiApi } from '@/services/ai.api'

interface MMResult {
  patient_id?: string
  job_id?: string
  ocs_id?: number
  risk_group?: {
    predicted_class: string
    probabilities: Record<string, number>
  }
  survival?: {
    hazard_ratio: number
    risk_score: number
    survival_probability_6m?: number
    survival_probability_12m?: number
    model_cindex?: number
  }
  os_days?: {
    predicted_days: number
    predicted_months: number
    confidence_interval?: { lower: number; upper: number }
  }
  recurrence?: {
    predicted_class: string
    recurrence_probability: number
  }
  tmz_response?: {
    predicted_class: string
    responder_probability: number
  }
  recommendation?: string
  processing_time_ms?: number
  model_version?: string
  modalities_used?: string[]
}

interface OCSItem {
  id: number
  ocs_id: string
  patient_name: string
  patient_number: string
  job_role: string
  job_type: string
  ocs_status: string
  confirmed_at: string
}

interface PatientOption {
  patient_number: string
  patient_name: string
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
  gene_ocs: number | null
  protein_ocs: number | null
  result_data: MMResult | null
  error_message: string | null
  created_at: string
  completed_at: string | null
}

export default function MMInferencePage() {
  // State
  const [_loading, setLoading] = useState(false)
  const [patients, setPatients] = useState<PatientOption[]>([])
  const [selectedPatient, setSelectedPatient] = useState<string>('')

  // 모달리티별 OCS
  const [mriOcsList, setMriOcsList] = useState<OCSItem[]>([])
  const [geneOcsList, setGeneOcsList] = useState<OCSItem[]>([])
  const [proteinOcsList, setProteinOcsList] = useState<OCSItem[]>([])

  const [selectedMriOcs, setSelectedMriOcs] = useState<number | null>(null)
  const [selectedGeneOcs, setSelectedGeneOcs] = useState<number | null>(null)
  const [selectedProteinOcs, setSelectedProteinOcs] = useState<number | null>(null)
  const [isResearch, setIsResearch] = useState<boolean>(false)  // 연구용 모드

  // 추론 상태
  const [inferenceStatus, setInferenceStatus] = useState<string>('')
  const [inferenceResult, setInferenceResult] = useState<MMResult | null>(null)
  const [error, setError] = useState<string>('')
  const [jobId, setJobId] = useState<string>('')
  const [isCached, setIsCached] = useState<boolean>(false)

  // 추론 이력
  const [inferenceHistory, setInferenceHistory] = useState<InferenceRecord[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  // WebSocket (from Context)
  const { lastMessage, isConnected } = useAIInference()

  // 초기 데이터 로드
  useEffect(() => {
    loadAllOcsData()
    loadInferenceHistory()
  }, [])

  // WebSocket 메시지 처리
  useEffect(() => {
    if (lastMessage?.type === 'AI_INFERENCE_RESULT') {
      console.log('Received MM inference result:', lastMessage)

      if (lastMessage.job_id === jobId) {
        if (lastMessage.status === 'COMPLETED') {
          setInferenceStatus('completed')
          if (lastMessage.result) {
            setInferenceResult(lastMessage.result as MMResult)
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

  const loadAllOcsData = async () => {
    try {
      setLoading(true)
      const response = await ocsApi.getAllOcsList()
      const rawData = response.results || response || []

      // 환자 목록 추출
      const patientMap = new Map<string, PatientOption>()
      rawData.forEach((item: any) => {
        if (item.patient?.patient_number) {
          patientMap.set(item.patient.patient_number, {
            patient_number: item.patient.patient_number,
            patient_name: item.patient.name || '',
          })
        }
      })
      setPatients(Array.from(patientMap.values()))

      // 모달리티별 OCS 분류 (CONFIRMED만)
      const confirmed = rawData.filter((item: any) => item.ocs_status === 'CONFIRMED')

      const mriList = confirmed
        .filter((item: any) => item.job_role === 'RIS' && item.job_type === 'MRI')
        .map(mapOcsItem)
      const geneList = confirmed
        .filter((item: any) => item.job_role === 'LIS' && item.job_type === 'RNA_SEQ')
        .map(mapOcsItem)
      const proteinList = confirmed
        .filter((item: any) => item.job_role === 'LIS' && item.job_type === 'BIOMARKER')
        .map(mapOcsItem)

      setMriOcsList(mriList)
      setGeneOcsList(geneList)
      setProteinOcsList(proteinList)
    } catch (err) {
      console.error('Failed to load OCS data:', err)
      setError('OCS 데이터를 불러오는데 실패했습니다.')
    } finally {
      setLoading(false)
    }
  }

  const mapOcsItem = (item: any): OCSItem => ({
    id: item.id,
    ocs_id: item.ocs_id,
    patient_name: item.patient?.name || '',
    patient_number: item.patient?.patient_number || '',
    job_role: item.job_role || '',
    job_type: item.job_type || '',
    ocs_status: item.ocs_status || '',
    confirmed_at: item.confirmed_at || '',
  })

  const loadInferenceHistory = async () => {
    try {
      setLoadingHistory(true)
      const data = await aiApi.getInferenceList('MM')
      setInferenceHistory(data || [])
    } catch (err) {
      console.error('Failed to load MM inference history:', err)
    } finally {
      setLoadingHistory(false)
    }
  }

  // 선택된 환자의 OCS만 필터링 (연구용 모드에서는 모든 환자 데이터 표시)
  const filteredMriOcsList = useMemo(() => {
    if (isResearch || !selectedPatient) return mriOcsList
    return mriOcsList.filter(ocs => ocs.patient_number === selectedPatient)
  }, [mriOcsList, selectedPatient, isResearch])

  const filteredGeneOcsList = useMemo(() => {
    if (isResearch || !selectedPatient) return geneOcsList
    return geneOcsList.filter(ocs => ocs.patient_number === selectedPatient)
  }, [geneOcsList, selectedPatient, isResearch])

  const filteredProteinOcsList = useMemo(() => {
    if (isResearch || !selectedPatient) return proteinOcsList
    return proteinOcsList.filter(ocs => ocs.patient_number === selectedPatient)
  }, [proteinOcsList, selectedPatient, isResearch])

  // 선택된 모달리티 개수
  const selectedModalityCount = useMemo(() => {
    let count = 0
    if (selectedMriOcs) count++
    if (selectedGeneOcs) count++
    if (selectedProteinOcs) count++
    return count
  }, [selectedMriOcs, selectedGeneOcs, selectedProteinOcs])

  const handlePatientChange = (patientNumber: string) => {
    setSelectedPatient(patientNumber)
    setSelectedMriOcs(null)
    setSelectedGeneOcs(null)
    setSelectedProteinOcs(null)
    setInferenceResult(null)
    setError('')
    setInferenceStatus('')
    setJobId('')
  }

  const handleRequestInference = async () => {
    if (selectedModalityCount < 1) {
      setError('최소 1개 이상의 모달리티를 선택해주세요.')
      return
    }

    try {
      setInferenceStatus('requesting')
      setError('')
      setInferenceResult(null)
      setIsCached(false)

      const response = await aiApi.requestMMInference(
        selectedMriOcs,
        selectedGeneOcs,
        selectedProteinOcs,
        'manual',
        isResearch
      )

      setJobId(response.job_id)

      // 캐시된 결과인 경우 바로 표시
      if (response.cached && response.result) {
        console.log('Using cached MM inference result:', response)
        setIsCached(true)
        setInferenceStatus('completed')
        setInferenceResult(response.result as MMResult)
      } else {
        // 새 추론 요청 - WebSocket으로 결과 대기
        setInferenceStatus('processing')
        console.log('MM Inference request sent:', response)
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
          <h2 className="text-2xl font-bold text-gray-900">MM 멀티모달 분석</h2>
          <p className="text-sm text-gray-500 mt-1">
            MRI, Gene, Protein 데이터를 융합하여 종합적인 예후 예측을 수행합니다.
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

      {/* Patient Selection & Research Mode */}
      <div className="bg-white rounded-lg shadow p-4">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold text-gray-900">환자 선택</h3>
          <label className="flex items-center space-x-2 cursor-pointer">
            <input
              type="checkbox"
              checked={isResearch}
              onChange={(e) => setIsResearch(e.target.checked)}
              className="w-4 h-4 text-amber-600 border-gray-300 rounded focus:ring-amber-500"
            />
            <span className="text-sm font-medium text-gray-700">연구용</span>
            <span className="text-xs text-gray-500">(다른 환자 OCS 조합 가능)</span>
          </label>
        </div>
        <select
          value={selectedPatient}
          onChange={(e) => handlePatientChange(e.target.value)}
          className="w-full p-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-amber-500 focus:border-amber-500"
          disabled={isResearch}
        >
          <option value="">{isResearch ? '연구용 모드: 모든 환자 데이터 표시' : '환자를 선택하세요'}</option>
          {patients.map((patient) => (
            <option key={patient.patient_number} value={patient.patient_number}>
              {patient.patient_number} - {patient.patient_name}
            </option>
          ))}
        </select>
        {isResearch && (
          <p className="mt-2 text-xs text-amber-600 bg-amber-50 p-2 rounded">
            연구용 모드: 서로 다른 환자의 MRI, Gene, Protein 데이터를 조합하여 추론할 수 있습니다.
          </p>
        )}
      </div>

      {/* Modality Selection */}
      {(selectedPatient || isResearch) && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* MRI */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
              <span className="text-xl mr-2">🧠</span>
              MRI 영상
              {selectedMriOcs && <span className="ml-2 text-green-600 text-sm">선택됨</span>}
            </h4>
            <select
              value={selectedMriOcs || ''}
              onChange={(e) => setSelectedMriOcs(e.target.value ? Number(e.target.value) : null)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-blue-500"
            >
              <option value="">선택 안함</option>
              {filteredMriOcsList.map((ocs) => (
                <option key={ocs.id} value={ocs.id}>
                  {ocs.ocs_id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {filteredMriOcsList.length}건 이용 가능
            </p>
          </div>

          {/* Gene */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
              <span className="text-xl mr-2">🧬</span>
              Gene Expression
              {selectedGeneOcs && <span className="ml-2 text-green-600 text-sm">선택됨</span>}
            </h4>
            <select
              value={selectedGeneOcs || ''}
              onChange={(e) => setSelectedGeneOcs(e.target.value ? Number(e.target.value) : null)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-purple-500"
            >
              <option value="">선택 안함</option>
              {filteredGeneOcsList.map((ocs) => (
                <option key={ocs.id} value={ocs.id}>
                  {ocs.ocs_id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {filteredGeneOcsList.length}건 이용 가능
            </p>
          </div>

          {/* Protein */}
          <div className="bg-white rounded-lg shadow p-4">
            <h4 className="font-medium text-gray-900 mb-2 flex items-center">
              <span className="text-xl mr-2">🔬</span>
              Protein Marker
              {selectedProteinOcs && <span className="ml-2 text-green-600 text-sm">선택됨</span>}
            </h4>
            <select
              value={selectedProteinOcs || ''}
              onChange={(e) => setSelectedProteinOcs(e.target.value ? Number(e.target.value) : null)}
              className="w-full p-2 border border-gray-300 rounded focus:ring-2 focus:ring-amber-500"
            >
              <option value="">선택 안함</option>
              {filteredProteinOcsList.map((ocs) => (
                <option key={ocs.id} value={ocs.id}>
                  {ocs.ocs_id}
                </option>
              ))}
            </select>
            <p className="text-xs text-gray-500 mt-1">
              {filteredProteinOcsList.length}건 이용 가능
            </p>
          </div>
        </div>
      )}

      {/* Inference Button */}
      {(selectedPatient || isResearch) && (
        <div className="flex items-center justify-center gap-4">
          <div className="text-sm text-gray-600">
            선택된 모달리티: <span className="font-bold">{selectedModalityCount}</span>개
            {selectedModalityCount < 2 && (
              <span className="text-amber-600 ml-2">(2개 이상 권장)</span>
            )}
          </div>
          <button
            onClick={handleRequestInference}
            disabled={
              selectedModalityCount < 1 ||
              inferenceStatus === 'requesting' ||
              inferenceStatus === 'processing'
            }
            className={`py-3 px-8 rounded-lg font-medium text-white transition ${
              selectedModalityCount < 1 ||
              inferenceStatus === 'requesting' ||
              inferenceStatus === 'processing'
                ? 'bg-gray-400 cursor-not-allowed'
                : 'bg-amber-600 hover:bg-amber-700'
            }`}
          >
            {(inferenceStatus === 'requesting' || inferenceStatus === 'processing') && jobId
              ? `'${jobId}' 요청 중, 현재 페이지를 벗어나도 괜찮습니다`
              : 'MM 멀티모달 추론 요청'}
          </button>
        </div>
      )}

      {/* MM Inference Result */}
      {inferenceStatus === 'processing' && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-6 text-center">
          <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-amber-600 mx-auto" />
          <p className="text-amber-600 mt-3">MM 멀티모달 추론 중...</p>
          <p className="text-sm text-amber-400 mt-1">Job ID: {jobId}</p>
        </div>
      )}

      {inferenceStatus === 'failed' && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h3 className="text-red-800 font-medium">추론 실패</h3>
          <p className="text-red-600 text-sm mt-1">{error}</p>
        </div>
      )}

      {inferenceStatus === 'completed' && inferenceResult && (
        <MMResultViewer result={inferenceResult} />
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
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-600 mx-auto" />
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
                    모달리티
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    상태
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                    결과
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
                      record.job_id === jobId ? 'bg-amber-50' : ''
                    }`}
                  >
                    <td className="px-4 py-3 text-sm text-gray-900">
                      {record.job_id}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.patient_name} ({record.patient_number})
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex gap-1">
                        {record.mri_ocs && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-blue-100 text-blue-700">MRI</span>
                        )}
                        {record.gene_ocs && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-purple-100 text-purple-700">Gene</span>
                        )}
                        {record.protein_ocs && (
                          <span className="px-1.5 py-0.5 text-xs rounded bg-amber-100 text-amber-700">Protein</span>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      {getStatusBadge(record.status)}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600">
                      {record.status === 'COMPLETED' && record.result_data?.risk_group ? (
                        <span>
                          Risk: {record.result_data.risk_group.predicted_class}
                        </span>
                      ) : record.status === 'FAILED' ? (
                        <span className="text-red-600 truncate max-w-[150px] block">
                          {record.error_message || 'Error'}
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
                            className="text-sm text-amber-600 hover:text-amber-800"
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
