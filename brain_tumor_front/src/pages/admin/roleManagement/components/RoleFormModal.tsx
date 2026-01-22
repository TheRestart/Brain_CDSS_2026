import { useEffect, useState } from "react";
import type { Role } from "@/types/role";
import { showWarning } from '@/utils/alert';

interface Props {
  open: boolean;
  role?: Role | null;
  onClose: () => void;
  onSubmit: (data: any) => void;
}

export default function RoleFormModal({
  open,
  role,
  onClose,
  onSubmit,
}: Props) {
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  const [description, setDescription] = useState("");
  const [descriptionError, setDescriptionError] = useState("");
  const [isActive, setIsActive] = useState(true);
  const [codeError, setCodeError] = useState<string | null>(null);

  useEffect(() => {
    if (role) {
      setName(role.name);
      setCode(role.code);
      setDescription(role.description || "");
      setIsActive(role.is_active);
    } else {
      setName("");
      setCode("");
      setDescription("");
      setIsActive(true);
    }
  }, [role]);

  if (!open) return null;

  // validation 함수
  const CODE_REGEX = /^[A-Z0-9_]+$/;
  const validate = () => {
  if (!name.trim()) {
    showWarning("역할명을 입력해주세요.");
    return false;
  }

  if (!role && !code.trim()) {
    showWarning("역할 코드를 입력해주세요.");
    return false;
  }

  if (!CODE_REGEX.test(code)) {
    showWarning("역할 코드는 영문 대문자, 숫자, _ 만 사용할 수 있습니다.");
    return false;
  }
  return true;
};


  const handleSubmit = () => {
    if (!validate()) return; // 여기서 API 접근 차단

    if (role) {
      // 수정
      onSubmit({
        name,
        description,
        is_active: isActive,
      });
    } else {
      // 생성
      onSubmit({
        name,
        code,
        description,
      });
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="modal role-modal">
        <h3>{role ? "역할 수정" : "역할 생성"}</h3>

        {/* 안내 문구 */}
        <p className="hint">
          {role
            ? "역할 코드는 시스템 식별자로 수정할 수 없습니다."
            : "역할 코드는 영문 대문자로 입력하며, 생성 후 수정할 수 없습니다."}
        </p>

        {/* 역할명 */}
        <div className="form-group">
          <label>
            역할명 <span className="required">*</span>
          </label>
          <input
            placeholder="예: Admin, Nurse"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </div>

        {/* 역할 코드 */}
        <div className="form-group">
          <label>
            역할 코드 {!role && <span className="required">*</span>}
          </label>
          <input
            placeholder="예: ADMIN, NURSE"
            value={code}
            disabled={!!role}
            onChange={(e) => {
              const raw = e.target.value;
              const upper = raw.toUpperCase();
              const filtered = upper.replace(/[^A-Z0-9_]/g, ""); // 한글 특수문자 제거

              setCode(filtered);

              if (upper !== filtered) {
                setCodeError("한글 입력 중입니다. 영문으로 입력해주세요.");
              } else {
                setCodeError(null);
              }
            }}
          />
          {codeError && (
            <div className="field-error">
              {codeError}
            </div>
          )}
          <small className="helper">
            시스템 내부에서 사용하는 고유 코드입니다.
          </small>

        </div>

        {/* 설명 */}
        <div className="form-group">
          <label>설명</label>
          <textarea
            className="roleTextarea"
            placeholder="이 역할이 어떤 역할인지 기입하세요."
            value={description}
            onChange={(e) => {
              setDescription(e.target.value)
              setDescriptionError(""); 
            }}
          />
          {descriptionError && (
            <p className="error-text">{descriptionError}</p>
          )}
        </div>

        {/* 활성 여부 */}
        {role && (
          <div className="form-group toggle">
            <label>상태</label>
            <div className="status-control">
              <label className="switch">
                <input
                  type="checkbox"
                  checked={isActive}
                  onChange={() => setIsActive(!isActive)}
                />
                <span className="slider" />
              </label>

              <span className={`status-text ${isActive ? "on" : "off"}`}>
                {isActive ? "활성" : "비활성"}
              </span>
            </div>
          </div>
        )}

        {/* 버튼 */}
        <div className="actions">
          <button className="btn btn-cancel" onClick={onClose}>
            취소
          </button>
          <button className="btn btn-primary" onClick={handleSubmit}>
            {role ? "수정" : "생성"}
          </button>

        </div>
      </div>
    </div>
  );
}
