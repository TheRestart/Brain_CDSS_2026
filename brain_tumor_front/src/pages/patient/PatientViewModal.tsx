import type { Patient } from '@/types/patient';
import './PatientCreateModal.css';

type Props = {
  isOpen: boolean;
  patient: Patient | null;
  onClose: () => void;
  onEdit?: () => void;
  onDelete?: () => void;
};

export default function PatientViewModal({ isOpen, patient, onClose, onEdit, onDelete }: Props) {
  if (!isOpen || !patient) return null;

  const getGenderDisplay = (gender: string) => {
    const genderMap: Record<string, string> = {
      'M': '남성',
      'F': '여성',
      'O': '기타',
    };
    return genderMap[gender] || gender;
  };

  const getStatusDisplay = (status: string) => {
    const statusMap: Record<string, string> = {
      'active': '활성',
      'inactive': '비활성',
      'deceased': '사망',
    };
    return statusMap[status] || status;
  };

  const getStatusClass = (status: string) => {
    const statusClassMap: Record<string, string> = {
      'active': 'status-active',
      'inactive': 'status-inactive',
      'deceased': 'status-deceased',
    };
    return statusClassMap[status] || '';
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content modal-large" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>환자 상세 정보</h2>
          <button className="btn-close" onClick={onClose}>
            ✕
          </button>
        </div>

        <div className="modal-body">
          <div className="patient-detail-view">
            {/* 기본 정보 */}
            <div className="detail-section">
              <h3>기본 정보</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">환자번호</span>
                  <span className="detail-value">{patient.patient_number}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">이름</span>
                  <span className="detail-value">{patient.name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">생년월일</span>
                  <span className="detail-value">{patient.birth_date}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">나이</span>
                  <span className="detail-value">{patient.age}세</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">성별</span>
                  <span className="detail-value">{getGenderDisplay(patient.gender)}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">혈액형</span>
                  <span className="detail-value">{patient.blood_type || '-'}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">상태</span>
                  <span className={`detail-value status-badge ${getStatusClass(patient.status)}`}>
                    {getStatusDisplay(patient.status)}
                  </span>
                </div>
              </div>
            </div>

            {/* 연락처 정보 */}
            <div className="detail-section">
              <h3>연락처 정보</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">전화번호</span>
                  <span className="detail-value">{patient.phone}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">이메일</span>
                  <span className="detail-value">{patient.email || '-'}</span>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">주소</span>
                  <span className="detail-value">{patient.address || '-'}</span>
                </div>
              </div>
            </div>

            {/* 의료 정보 */}
            <div className="detail-section">
              <h3>의료 정보</h3>
              <div className="detail-grid">
                <div className="detail-item full-width">
                  <span className="detail-label">알레르기</span>
                  <div className="detail-value">
                    {patient.allergies && patient.allergies.length > 0 ? (
                      <div className="tag-list">
                        {patient.allergies.map((allergy, index) => (
                          <span key={index} className="tag tag-readonly">
                            {allergy}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>없음</span>
                    )}
                  </div>
                </div>
                <div className="detail-item full-width">
                  <span className="detail-label">기저질환</span>
                  <div className="detail-value">
                    {patient.chronic_diseases && patient.chronic_diseases.length > 0 ? (
                      <div className="tag-list">
                        {patient.chronic_diseases.map((disease, index) => (
                          <span key={index} className="tag tag-readonly">
                            {disease}
                          </span>
                        ))}
                      </div>
                    ) : (
                      <span>없음</span>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* 등록 정보 */}
            <div className="detail-section">
              <h3>등록 정보</h3>
              <div className="detail-grid">
                <div className="detail-item">
                  <span className="detail-label">등록자</span>
                  <span className="detail-value">{patient.registered_by_name}</span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">등록일시</span>
                  <span className="detail-value">
                    {new Date(patient.created_at).toLocaleString('ko-KR')}
                  </span>
                </div>
                <div className="detail-item">
                  <span className="detail-label">최종 수정일시</span>
                  <span className="detail-value">
                    {new Date(patient.updated_at).toLocaleString('ko-KR')}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button type="button" className="btn" onClick={onClose}>
            닫기
          </button>
          {onDelete && (
            <button type="button" className="btn btn-danger" onClick={onDelete}>
              삭제
            </button>
          )}
          {onEdit && (
            <button type="button" className="btn primary" onClick={onEdit}>
              수정
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
