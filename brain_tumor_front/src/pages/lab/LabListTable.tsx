import { useNavigate } from 'react-router-dom';
import type { OCSListItem, OcsStatus } from '@/types/ocs';
// OCS_STATUS_LABELS removed - not used in this file

type Props = {
  role: string;
  labOrders: OCSListItem[];
  onRefresh: () => void;
};

// 검사 유형 라벨
const getTestTypeLabel = (jobType: string): string => {
  const type = jobType.toUpperCase();
  if (type.includes('BLOOD')) return '혈액 검사';
  if (type.includes('GENETIC')) return '유전자 검사';
  if (type.includes('PROTEIN')) return '단백질 검사';
  if (type.includes('URINE')) return '소변 검사';
  if (type.includes('CSF')) return '뇌척수액 검사';
  if (type.includes('BIOPSY')) return '조직 검사';
  return jobType;
};

// 검사 유형별 색상
const getTestTypeColor = (jobType: string): string => {
  const type = jobType.toUpperCase();
  if (type.includes('BLOOD')) return '#d32f2f';
  if (type.includes('GENETIC')) return '#7b1fa2';
  if (type.includes('PROTEIN')) return '#1976d2';
  if (type.includes('URINE')) return '#f57c00';
  if (type.includes('CSF')) return '#00796b';
  if (type.includes('BIOPSY')) return '#5d4037';
  return '#666';
};

export default function LabListTable({ labOrders }: Props) {
  const navigate = useNavigate();

  const formatDateTime = (dateString: string) => {
    return new Date(dateString).toLocaleString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });
  };

  const getStatusBadgeStyle = (status: OcsStatus): React.CSSProperties => {
    switch (status) {
      case 'ORDERED':
        return { backgroundColor: '#e3f2fd', color: '#1565c0' };
      case 'ACCEPTED':
        return { backgroundColor: '#fff3e0', color: '#ef6c00' };
      case 'IN_PROGRESS':
        return { backgroundColor: '#e8f5e9', color: '#2e7d32' };
      case 'RESULT_READY':
        return { backgroundColor: '#fce4ec', color: '#c2185b' };
      case 'CONFIRMED':
        return { backgroundColor: '#e8f5e9', color: '#1b5e20' };
      case 'CANCELLED':
        return { backgroundColor: '#ffebee', color: '#c62828' };
      default:
        return {};
    }
  };

  const handleViewDetail = (order: OCSListItem) => {
    navigate(`/ocs/lis/${order.id}`);
  };

  if (!labOrders) {
    return (
      <table className="table encounter-table">
        <thead>
          <tr>
            <th>OCS ID</th>
            <th>환자명</th>
            <th>환자번호</th>
            <th>검사종류</th>
            <th>의뢰의사</th>
            <th>담당자</th>
            <th>우선순위</th>
            <th>의뢰일시</th>
            <th>상태</th>
            <th>결과</th>
            <th>작업</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
              로딩 중...
            </td>
          </tr>
        </tbody>
      </table>
    );
  }

  return (
    <table className="table encounter-table">
      <thead>
        <tr>
          <th>OCS ID</th>
          <th>환자명</th>
          <th>환자번호</th>
          <th>검사종류</th>
          <th>의뢰의사</th>
          <th>담당자</th>
          <th>우선순위</th>
          <th>의뢰일시</th>
          <th>상태</th>
          <th>결과</th>
          <th>작업</th>
        </tr>
      </thead>

      <tbody>
        {labOrders.length === 0 ? (
          <tr>
            <td colSpan={11} style={{ textAlign: 'center', padding: '2rem' }}>
              등록된 검사가 없습니다.
            </td>
          </tr>
        ) : (
          labOrders.map((order) => (
            <tr key={order.id}>
              <td>
                <span style={{ fontFamily: 'monospace', fontSize: '0.875rem' }}>
                  {order.ocs_id}
                </span>
              </td>
              <td>{order.patient.name}</td>
              <td>{order.patient.patient_number}</td>
              <td>
                <span style={{
                  color: getTestTypeColor(order.job_type),
                  fontWeight: 600
                }}>
                  {getTestTypeLabel(order.job_type)}
                </span>
              </td>
              <td>{order.doctor.name}</td>
              <td>
                {order.worker?.name || (
                  <span style={{ color: '#999' }}>미배정</span>
                )}
              </td>
              <td>
                <span style={{
                  padding: '0.25rem 0.5rem',
                  borderRadius: '4px',
                  fontSize: '0.75rem',
                  fontWeight: 500,
                  backgroundColor: order.priority === 'urgent' ? '#ffebee' : '#f5f5f5',
                  color: order.priority === 'urgent' ? '#c62828' : '#666'
                }}>
                  {order.priority_display}
                </span>
              </td>
              <td>{formatDateTime(order.created_at)}</td>
              <td>
                <span
                  style={{
                    padding: '0.25rem 0.5rem',
                    borderRadius: '4px',
                    fontSize: '0.75rem',
                    fontWeight: 500,
                    ...getStatusBadgeStyle(order.ocs_status)
                  }}
                >
                  {order.ocs_status_display}
                </span>
              </td>
              <td>
                {order.ocs_result === true ? (
                  <span style={{ color: '#2e7d32', fontWeight: 500 }}>정상</span>
                ) : order.ocs_result === false ? (
                  <span style={{ color: '#c62828', fontWeight: 500 }}>이상</span>
                ) : (
                  <span style={{ color: '#999' }}>-</span>
                )}
              </td>
              <td>
                <div className="action-buttons" style={{ display: 'flex', gap: '0.25rem', flexWrap: 'wrap' }}>
                  <button
                    className="btn small primary"
                    onClick={() => handleViewDetail(order)}
                    style={{ fontSize: '0.75rem' }}
                  >
                    상세보기
                  </button>
                </div>
              </td>
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
