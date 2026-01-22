import { useQuery } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { getAIRequests } from '@/services/ai.api';
import './RecentAnalysisList.css';

const STATUS_COLORS: Record<string, string> = {
  COMPLETED: '#4caf50',
  PROCESSING: '#2196f3',
  PENDING: '#ff9800',
  FAILED: '#f44336',
  CANCELLED: '#9e9e9e',
};

const STATUS_LABELS: Record<string, string> = {
  COMPLETED: '완료',
  PROCESSING: '처리중',
  PENDING: '대기',
  FAILED: '실패',
  CANCELLED: '취소',
  VALIDATING: '검증중',
};

const MODEL_LABELS: Record<string, string> = {
  M1: 'M1 (MRI)',
  MG: 'MG (유전자)',
  MM: 'MM (멀티모달)',
};

export default function RecentAnalysisList() {
  const navigate = useNavigate();

  const { data: requests, isLoading } = useQuery({
    queryKey: ['ai-recent-requests'],
    queryFn: () => getAIRequests(),
    refetchInterval: 30000,
  });

  // 최근 10개만 표시
  const recentRequests = requests?.slice(0, 10) ?? [];

  const handleRowClick = (jobId: string, modelCode: string) => {
    const detailPath =
      modelCode === 'M1'
        ? `/ai/m1/${jobId}`
        : modelCode === 'MG'
          ? `/ai/mg/${jobId}`
          : `/ai/mm/${jobId}`;
    navigate(detailPath);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return `${date.getMonth() + 1}/${date.getDate()} ${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
  };

  if (isLoading) {
    return (
      <div className="recent-analysis-list__loading">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="recent-analysis-list__skeleton-row" />
        ))}
      </div>
    );
  }

  if (recentRequests.length === 0) {
    return (
      <div className="recent-analysis-list__empty">
        <span className="material-icons">inbox</span>
        <p>최근 분석 요청이 없습니다</p>
      </div>
    );
  }

  return (
    <div className="recent-analysis-list">
      <table className="recent-analysis-list__table">
        <thead>
          <tr>
            <th>ID</th>
            <th>환자명</th>
            <th>모델</th>
            <th>상태</th>
            <th>요청일시</th>
            <th>결과</th>
          </tr>
        </thead>
        <tbody>
          {recentRequests.map((request) => (
            <tr
              key={request.request_id}
              onClick={() => handleRowClick(request.request_id, request.model_code)}
              className="recent-analysis-list__row"
            >
              <td className="recent-analysis-list__id">
                {request.request_id.substring(0, 8)}...
              </td>
              <td>{request.patient_name || '-'}</td>
              <td>
                <span className="recent-analysis-list__model">
                  {MODEL_LABELS[request.model_code] || request.model_code}
                </span>
              </td>
              <td>
                <span
                  className="recent-analysis-list__status"
                  style={{ backgroundColor: STATUS_COLORS[request.status] || '#9e9e9e' }}
                >
                  {STATUS_LABELS[request.status] || request.status}
                </span>
              </td>
              <td>{formatDate(request.requested_at)}</td>
              <td>
                {request.status === 'COMPLETED' && request.result ? (
                  <span className="recent-analysis-list__result">
                    {getResultSummary(request.model_code, request.result.result_data)}
                  </span>
                ) : (
                  '-'
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function getResultSummary(modelCode: string, resultData: Record<string, unknown>): string {
  if (modelCode === 'M1') {
    const grade = resultData.grade as { predicted_class?: string } | undefined;
    return grade?.predicted_class || '-';
  }
  if (modelCode === 'MG') {
    const survival = resultData.survival as { risk_group?: string } | undefined;
    return survival?.risk_group ? `${survival.risk_group} Risk` : '-';
  }
  if (modelCode === 'MM') {
    const integrated = resultData.integrated_prediction as { grade?: string } | undefined;
    return integrated?.grade || '-';
  }
  return '-';
}
