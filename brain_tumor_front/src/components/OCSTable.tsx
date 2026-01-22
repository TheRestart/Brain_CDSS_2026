import './OCSTable.css'

export interface OCSItem {
  id: number
  ocs_id: string
  patient_name: string
  patient_number: string
  job_role: string
  job_type: string
  ocs_status: string
  confirmed_at: string
  ocs_result?: string | null
  attachments?: {
    files?: Array<{
      path: string
      name: string
      size?: number
    }>
    zip_url?: string
  }
  worker_result?: {
    impression?: string
    findings?: string
    dicom?: {
      study_uid: string
      series?: Array<{
        orthanc_id: string
        description: string
        path?: string
      }>
    }
    // LIS 결과 경로
    file_path?: string
  }
  // AI 추론 완료 상태 (MM 모델용)
  ai_inference_info?: {
    model_type: 'M1' | 'MG' | null
    status: 'completed' | 'not_run' | 'not_required'
    job_id?: string
    completed_at?: string
  }
}

interface OCSTableProps {
  data: OCSItem[]
  selectedId: number | null
  onSelect: (ocs: OCSItem) => void
  loading?: boolean
}

export function OCSTable({ data, selectedId, onSelect, loading }: OCSTableProps) {
  if (loading) {
    return (
      <div className="ocs-table-container">
        <div className="ocs-loading">
          <div className="ocs-loading-skeleton"></div>
          <div className="ocs-loading-skeleton"></div>
          <div className="ocs-loading-skeleton"></div>
        </div>
      </div>
    )
  }

  if (data.length === 0) {
    return (
      <div className="ocs-table-container">
        <div className="ocs-empty">
          <span className="ocs-empty-icon">📋</span>
          <span>OCS 데이터가 없습니다.</span>
        </div>
      </div>
    )
  }

  // AI 추론 배지 렌더링
  const renderAIBadge = (ocs: OCSItem) => {
    const info = ocs.ai_inference_info
    if (!info || info.status === 'not_required') return null

    if (info.status === 'completed') {
      return (
        <span className="ocs-badge ocs-badge-ai-completed" title={`Job: ${info.job_id}`}>
          {info.model_type} 완료
        </span>
      )
    }
    return (
      <span className="ocs-badge ocs-badge-ai-pending">
        {info.model_type} 필요
      </span>
    )
  }

  return (
    <div className="ocs-table-container">
      <table className="ocs-table">
        <thead>
          <tr>
            <th className="ocs-th-select"></th>
            <th>OCS ID</th>
            <th>환자명</th>
            <th>환자번호</th>
            <th>작업</th>
            <th>검사</th>
            <th>AI</th>
            <th>Result</th>
          </tr>
        </thead>
        <tbody>
          {data.map((ocs) => (
            <tr
              key={ocs.id}
              className={selectedId === ocs.id ? 'selected' : ''}
              onClick={() => onSelect(ocs)}
            >
              <td className="ocs-td-select">
                <div className={`ocs-radio ${selectedId === ocs.id ? 'checked' : ''}`}>
                  {selectedId === ocs.id && <div className="ocs-radio-dot"></div>}
                </div>
              </td>
              <td className="ocs-td-id">{ocs.ocs_id}</td>
              <td className="ocs-td-name">{ocs.patient_name}</td>
              <td className="ocs-td-number">{ocs.patient_number}</td>
              <td>
                <span className="ocs-badge ocs-badge-role">{ocs.job_role}</span>
              </td>
              <td>
                <span className="ocs-badge ocs-badge-type">{ocs.job_type}</span>
              </td>
              <td className="ocs-td-ai">
                {renderAIBadge(ocs)}
              </td>
              <td className="ocs-td-result" title={ocs.worker_result?.impression || ''}>
                {ocs.worker_result?.impression || '-'}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}
