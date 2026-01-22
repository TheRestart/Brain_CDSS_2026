/**
 * RIS 영상 결과 업로드 화면
 * - 외부 RIS/PACS에서 수신된 영상 결과 파일 업로드
 * - DICOM/JPEG/PNG/PDF 형식 지원
 * - 파싱/정규화 처리 로그
 *
 * [비활성화됨] - 외부기관 검사 등록은 OCS 생성 페이지에서 진행
 */
import { Link } from 'react-router-dom';
import './RISUploadPage.css';

export default function RISUploadPage() {
  return (
    <div className="page ris-upload-page disabled-page">
      <div className="disabled-notice">
        <div className="notice-icon">🔄</div>
        <h2>서비스 변경 안내</h2>
        <p>외부기관 검사 등록 방식이 변경되었습니다.</p>
        <p>
          외부기관 검사 등록은{' '}
          <Link to="/ocs/create" className="notice-link">
            OCS 생성
          </Link>{' '}
          페이지에서 진행해주세요.
        </p>
        <Link to="/ocs/create" className="btn-go-ocs">
          OCS 생성 페이지로 이동
        </Link>
      </div>
    </div>
  );
}
