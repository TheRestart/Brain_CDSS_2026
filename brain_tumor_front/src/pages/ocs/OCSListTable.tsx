import type { OCSListItem } from '@/types/ocs';

type Props = {
  role: string;
  ocsList: OCSListItem[];
  onRowClick: (ocs: OCSListItem) => void;
};

// 상태별 스타일 클래스
const getStatusClass = (status: string): string => {
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

// 우선순위별 스타일 클래스
const getPriorityClass = (priority: string): string => {
  const classes: Record<string, string> = {
    urgent: 'priority-urgent',
    normal: 'priority-normal',
    scheduled: 'priority-scheduled',
  };
  return classes[priority] || '';
};

// 날짜 포맷
const formatDate = (dateStr: string): string => {
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

export default function OCSListTable({ role, ocsList = [], onRowClick }: Props) {
  const isWorkerRole = ['RIS', 'LIS', 'TREATMENT'].includes(role);
  const isDoctor = role === 'DOCTOR';
  const isAdmin = ['SYSTEMMANAGER', 'ADMIN'].includes(role);

  return (
    <table className="ocs-table">
      <thead>
        <tr>
          <th>OCS ID</th>
          <th>상태</th>
          <th>우선순위</th>
          <th>환자</th>
          {!isDoctor && <th>처방 의사</th>}
          {!isWorkerRole && <th>작업자</th>}
          <th>작업 역할</th>
          <th>작업 유형</th>
          <th>생성일시</th>
          {isAdmin && <th>결과</th>}
        </tr>
      </thead>

      <tbody>
        {!ocsList || ocsList.length === 0 ? (
          <tr>
            <td colSpan={isAdmin ? 10 : 8} align="center">
              데이터 없음
            </td>
          </tr>
        ) : (
          ocsList.map((ocs) => (
            <tr
              key={ocs.id}
              onClick={() => onRowClick(ocs)}
              className="clickable-row"
            >
              <td>{ocs.ocs_id}</td>
              <td>
                <span className={`status-badge ${getStatusClass(ocs.ocs_status)}`}>
                  {ocs.ocs_status_display}
                </span>
              </td>
              <td>
                <span className={`priority-badge ${getPriorityClass(ocs.priority)}`}>
                  {ocs.priority_display}
                </span>
              </td>
              <td>{ocs.patient.name}</td>
              {!isDoctor && (
                <td>{ocs.doctor.name}</td>
              )}
              {!isWorkerRole && (
                <td>{ocs.worker ? ocs.worker.name : '-'}</td>
              )}
              <td>{ocs.job_role}</td>
              <td>{ocs.job_type}</td>
              <td>{formatDate(ocs.created_at)}</td>
              {isAdmin && (
                <td>
                  {ocs.ocs_result === null
                    ? '-'
                    : ocs.ocs_result
                    ? '정상'
                    : '비정상'}
                </td>
              )}
            </tr>
          ))
        )}
      </tbody>
    </table>
  );
}
