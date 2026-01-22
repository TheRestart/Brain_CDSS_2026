interface Props {
  remain: number;
  onExtend: () => void;
  onLogout: () => void;
}

export default function SessionExtendModal({
  remain,
  onExtend,
  onLogout,
}: Props) {
  return (
    <div className="modal-backdrop">
      <div className="modal">
        <h3>세션 만료 안내</h3>
        <p>
          세션이 <strong>{Math.floor(remain / 60)}분</strong> 후
          만료됩니다.
        </p>

        <div className="modal-actions">
          <button className="primary" onClick={onExtend}>
            세션 연장
          </button>
          <button className="danger" onClick={onLogout}>
            로그아웃
          </button>
        </div>
      </div>
    </div>
  );
}
