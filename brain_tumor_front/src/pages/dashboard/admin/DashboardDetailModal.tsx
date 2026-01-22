import { useState, useEffect } from 'react';
import { fetchUsers, fetchUserDetail } from '@/services/users.api';
import { getPatients, getPatient } from '@/services/patient.api';
import { getOCSList, getOCS } from '@/services/ocs.api';
import type { User } from '@/types/user';
import type { Patient } from '@/types/patient';
import type { OCSListItem, OCSDetail, OcsStatus } from '@/types/ocs';
import './DashboardDetailModal.css';

export type ModalType = 'users' | 'patients' | 'role' | 'ocs' | 'ocs_status';

interface Props {
  type: ModalType;
  title: string;
  roleFilter?: string; // 역할별 필터 (역할 코드)
  ocsStatusFilter?: OcsStatus; // OCS 상태별 필터
  onClose: () => void;
}

export default function DashboardDetailModal({ type, title, roleFilter, ocsStatusFilter, onClose }: Props) {
  const [users, setUsers] = useState<User[]>([]);
  const [patients, setPatients] = useState<Patient[]>([]);
  const [ocsList, setOcsList] = useState<OCSListItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [selectedOcs, setSelectedOcs] = useState<OCSDetail | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      try {
        if (type === 'users' || type === 'role') {
          const params = roleFilter ? { role__code: roleFilter } : {};
          const data = await fetchUsers(params);
          setUsers(data.results || []);
        } else if (type === 'patients') {
          const data = await getPatients({ page_size: 100 });
          setPatients(data.results || []);
        } else if (type === 'ocs' || type === 'ocs_status') {
          const params = ocsStatusFilter ? { ocs_status: ocsStatusFilter, page_size: 100 } : { page_size: 100 };
          const data = await getOCSList(params);
          setOcsList(data.results || []);
        }
      } catch (err) {
        console.error('데이터 로딩 실패:', err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [type, roleFilter, ocsStatusFilter]);

  const handleUserClick = async (userId: number) => {
    setDetailLoading(true);
    try {
      const detail = await fetchUserDetail(userId);
      setSelectedUser(detail);
      setSelectedPatient(null);
      setSelectedOcs(null);
    } catch (err) {
      console.error('사용자 상세 조회 실패:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handlePatientClick = async (patientId: number) => {
    setDetailLoading(true);
    try {
      const detail = await getPatient(patientId);
      setSelectedPatient(detail);
      setSelectedUser(null);
      setSelectedOcs(null);
    } catch (err) {
      console.error('환자 상세 조회 실패:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleOcsClick = async (ocsId: number) => {
    setDetailLoading(true);
    try {
      const detail = await getOCS(ocsId);
      setSelectedOcs(detail);
      setSelectedUser(null);
      setSelectedPatient(null);
    } catch (err) {
      console.error('OCS 상세 조회 실패:', err);
    } finally {
      setDetailLoading(false);
    }
  };

  const handleBackToList = () => {
    setSelectedUser(null);
    setSelectedPatient(null);
    setSelectedOcs(null);
  };

  const formatDate = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleDateString('ko-KR');
  };

  const formatDateTime = (dateStr: string | null | undefined) => {
    if (!dateStr) return '-';
    return new Date(dateStr).toLocaleString('ko-KR');
  };

  // 사용자 상세 뷰
  const renderUserDetail = () => {
    if (!selectedUser) return null;
    return (
      <div className="detail-view">
        <button className="back-btn" onClick={handleBackToList}>
          &larr; 목록으로
        </button>
        <h4>사용자 상세 정보</h4>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="label">아이디</span>
            <span className="value">{selectedUser.login_id}</span>
          </div>
          <div className="detail-row">
            <span className="label">이름</span>
            <span className="value">{selectedUser.name}</span>
          </div>
          <div className="detail-row">
            <span className="label">이메일</span>
            <span className="value">{selectedUser.email || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">역할</span>
            <span className="value">{selectedUser.role?.name || selectedUser.role?.code || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">상태</span>
            <span className={`value status ${selectedUser.is_active ? 'active' : 'inactive'}`}>
              {selectedUser.is_active ? '활성' : '비활성'}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">계정 잠금</span>
            <span className={`value ${selectedUser.is_locked ? 'locked' : ''}`}>
              {selectedUser.is_locked ? '잠금' : '정상'}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">마지막 로그인</span>
            <span className="value">{formatDateTime(selectedUser.last_login)}</span>
          </div>
          <div className="detail-row">
            <span className="label">계정 생성일</span>
            <span className="value">{formatDate(selectedUser.created_at)}</span>
          </div>
          {selectedUser.profile && (
            <>
              <div className="detail-section-title">프로필 정보</div>
              <div className="detail-row">
                <span className="label">생년월일</span>
                <span className="value">{formatDate(selectedUser.profile.birthDate)}</span>
              </div>
              <div className="detail-row">
                <span className="label">휴대폰</span>
                <span className="value">{selectedUser.profile.phoneMobile || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">사무실 전화</span>
                <span className="value">{selectedUser.profile.phoneOffice || '-'}</span>
              </div>
              <div className="detail-row">
                <span className="label">입사일</span>
                <span className="value">{formatDate(selectedUser.profile.hireDate)}</span>
              </div>
              <div className="detail-row">
                <span className="label">직책</span>
                <span className="value">{selectedUser.profile.title || '-'}</span>
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  // 환자 상세 뷰
  const renderPatientDetail = () => {
    if (!selectedPatient) return null;
    return (
      <div className="detail-view">
        <button className="back-btn" onClick={handleBackToList}>
          &larr; 목록으로
        </button>
        <h4>환자 상세 정보</h4>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="label">환자번호</span>
            <span className="value">{selectedPatient.patient_number}</span>
          </div>
          <div className="detail-row">
            <span className="label">이름</span>
            <span className="value">{selectedPatient.name}</span>
          </div>
          <div className="detail-row">
            <span className="label">성별</span>
            <span className="value">
              {selectedPatient.gender === 'M' ? '남성' : selectedPatient.gender === 'F' ? '여성' : '기타'}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">생년월일</span>
            <span className="value">{formatDate(selectedPatient.birth_date)}</span>
          </div>
          <div className="detail-row">
            <span className="label">나이</span>
            <span className="value">{selectedPatient.age}세</span>
          </div>
          <div className="detail-row">
            <span className="label">연락처</span>
            <span className="value">{selectedPatient.phone || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">이메일</span>
            <span className="value">{selectedPatient.email || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">주소</span>
            <span className="value">{selectedPatient.address || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">혈액형</span>
            <span className="value">{selectedPatient.blood_type || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">상태</span>
            <span className={`value status-${selectedPatient.status}`}>
              {selectedPatient.status === 'active' ? '진료중' :
               selectedPatient.status === 'discharged' ? '퇴원' :
               selectedPatient.status === 'transferred' ? '전원' : '사망'}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">중증도</span>
            <span className={`value severity-${selectedPatient.severity}`}>
              {selectedPatient.severity === 'normal' ? '정상' :
               selectedPatient.severity === 'mild' ? '경증' :
               selectedPatient.severity === 'moderate' ? '중등도' :
               selectedPatient.severity === 'severe' ? '중증' : '위중'}
            </span>
          </div>
          {selectedPatient.allergies && selectedPatient.allergies.length > 0 && (
            <div className="detail-row full">
              <span className="label">알러지</span>
              <span className="value">{selectedPatient.allergies.join(', ')}</span>
            </div>
          )}
          {selectedPatient.chronic_diseases && selectedPatient.chronic_diseases.length > 0 && (
            <div className="detail-row full">
              <span className="label">만성질환</span>
              <span className="value">{selectedPatient.chronic_diseases.join(', ')}</span>
            </div>
          )}
          <div className="detail-row">
            <span className="label">등록자</span>
            <span className="value">{selectedPatient.registered_by_name || '-'}</span>
          </div>
          <div className="detail-row">
            <span className="label">등록일</span>
            <span className="value">{formatDateTime(selectedPatient.created_at)}</span>
          </div>
        </div>
      </div>
    );
  };

  // 사용자 목록
  const renderUserList = () => (
    <table className="detail-table">
      <thead>
        <tr>
          <th>아이디</th>
          <th>이름</th>
          <th>역할</th>
          <th>상태</th>
          <th>마지막 로그인</th>
        </tr>
      </thead>
      <tbody>
        {users.map((user) => (
          <tr key={user.id} onClick={() => handleUserClick(user.id)} className="clickable">
            <td>{user.login_id}</td>
            <td>{user.name}</td>
            <td>{user.role?.name || user.role?.code || '-'}</td>
            <td>
              <span className={`badge ${user.is_active ? 'active' : 'inactive'}`}>
                {user.is_active ? '활성' : '비활성'}
              </span>
            </td>
            <td>{formatDateTime(user.last_login)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // 환자 목록
  const renderPatientList = () => (
    <table className="detail-table">
      <thead>
        <tr>
          <th>환자번호</th>
          <th>이름</th>
          <th>성별</th>
          <th>나이</th>
          <th>상태</th>
          <th>연락처</th>
        </tr>
      </thead>
      <tbody>
        {patients.map((patient) => (
          <tr key={patient.id} onClick={() => handlePatientClick(patient.id)} className="clickable">
            <td>{patient.patient_number}</td>
            <td>{patient.name}</td>
            <td>{patient.gender === 'M' ? '남' : patient.gender === 'F' ? '여' : '기타'}</td>
            <td>{patient.age}세</td>
            <td>
              <span className={`badge status-${patient.status}`}>
                {patient.status === 'active' ? '진료중' : patient.status === 'discharged' ? '퇴원' : patient.status}
              </span>
            </td>
            <td>{patient.phone || '-'}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  // OCS 상세 뷰
  const renderOcsDetail = () => {
    if (!selectedOcs) return null;
    return (
      <div className="detail-view">
        <button className="back-btn" onClick={handleBackToList}>
          &larr; 목록으로
        </button>
        <h4>OCS 상세 정보</h4>
        <div className="detail-grid">
          <div className="detail-row">
            <span className="label">OCS ID</span>
            <span className="value">{selectedOcs.ocs_id}</span>
          </div>
          <div className="detail-row">
            <span className="label">상태</span>
            <span className={`value ocs-status-${selectedOcs.ocs_status.toLowerCase()}`}>
              {selectedOcs.ocs_status_display}
            </span>
          </div>
          <div className="detail-row">
            <span className="label">작업 유형</span>
            <span className="value">{selectedOcs.job_role} - {selectedOcs.job_type}</span>
          </div>
          <div className="detail-row">
            <span className="label">우선순위</span>
            <span className={`value priority-${selectedOcs.priority}`}>
              {selectedOcs.priority_display}
            </span>
          </div>
          <div className="detail-section-title">환자 정보</div>
          <div className="detail-row">
            <span className="label">환자번호</span>
            <span className="value">{selectedOcs.patient.patient_number}</span>
          </div>
          <div className="detail-row">
            <span className="label">환자명</span>
            <span className="value">{selectedOcs.patient.name}</span>
          </div>
          <div className="detail-section-title">담당자 정보</div>
          <div className="detail-row">
            <span className="label">의사</span>
            <span className="value">{selectedOcs.doctor.name}</span>
          </div>
          <div className="detail-row">
            <span className="label">작업자</span>
            <span className="value">{selectedOcs.worker?.name || '-'}</span>
          </div>
          <div className="detail-section-title">일시 정보</div>
          <div className="detail-row">
            <span className="label">생성일</span>
            <span className="value">{formatDateTime(selectedOcs.created_at)}</span>
          </div>
          <div className="detail-row">
            <span className="label">접수일</span>
            <span className="value">{formatDateTime(selectedOcs.accepted_at)}</span>
          </div>
          <div className="detail-row">
            <span className="label">진행 시작</span>
            <span className="value">{formatDateTime(selectedOcs.in_progress_at)}</span>
          </div>
          <div className="detail-row">
            <span className="label">결과 준비</span>
            <span className="value">{formatDateTime(selectedOcs.result_ready_at)}</span>
          </div>
          <div className="detail-row">
            <span className="label">확정일</span>
            <span className="value">{formatDateTime(selectedOcs.confirmed_at)}</span>
          </div>
          {selectedOcs.cancelled_at && (
            <div className="detail-row">
              <span className="label">취소일</span>
              <span className="value">{formatDateTime(selectedOcs.cancelled_at)}</span>
            </div>
          )}
          {selectedOcs.cancel_reason && (
            <div className="detail-row full">
              <span className="label">취소 사유</span>
              <span className="value">{selectedOcs.cancel_reason}</span>
            </div>
          )}
          {selectedOcs.turnaround_time && (
            <div className="detail-row">
              <span className="label">총 소요 시간</span>
              <span className="value">{selectedOcs.turnaround_time}분</span>
            </div>
          )}
        </div>
      </div>
    );
  };

  // OCS 목록
  const renderOcsList = () => (
    <table className="detail-table">
      <thead>
        <tr>
          <th>OCS ID</th>
          <th>환자</th>
          <th>유형</th>
          <th>상태</th>
          <th>우선순위</th>
          <th>생성일</th>
        </tr>
      </thead>
      <tbody>
        {ocsList.map((ocs) => (
          <tr key={ocs.id} onClick={() => handleOcsClick(ocs.id)} className="clickable">
            <td>{ocs.ocs_id}</td>
            <td>{ocs.patient.name}</td>
            <td>{ocs.job_role} - {ocs.job_type}</td>
            <td>
              <span className={`badge ocs-status-${ocs.ocs_status.toLowerCase()}`}>
                {ocs.ocs_status_display}
              </span>
            </td>
            <td>
              <span className={`badge priority-${ocs.priority}`}>
                {ocs.priority_display}
              </span>
            </td>
            <td>{formatDateTime(ocs.created_at)}</td>
          </tr>
        ))}
      </tbody>
    </table>
  );

  return (
    <div className="dashboard-detail-modal-backdrop" onClick={onClose}>
      <div className="dashboard-detail-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h3>{title}</h3>
          <button className="close-btn" onClick={onClose}>&times;</button>
        </div>
        <div className="modal-body">
          {loading || detailLoading ? (
            <div className="loading">데이터를 불러오는 중...</div>
          ) : selectedUser ? (
            renderUserDetail()
          ) : selectedPatient ? (
            renderPatientDetail()
          ) : selectedOcs ? (
            renderOcsDetail()
          ) : (
            <div className="list-view">
              {(type === 'users' || type === 'role') && users.length > 0 && renderUserList()}
              {(type === 'users' || type === 'role') && users.length === 0 && (
                <div className="empty">사용자가 없습니다.</div>
              )}
              {type === 'patients' && patients.length > 0 && renderPatientList()}
              {type === 'patients' && patients.length === 0 && (
                <div className="empty">환자가 없습니다.</div>
              )}
              {(type === 'ocs' || type === 'ocs_status') && ocsList.length > 0 && renderOcsList()}
              {(type === 'ocs' || type === 'ocs_status') && ocsList.length === 0 && (
                <div className="empty">OCS가 없습니다.</div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
