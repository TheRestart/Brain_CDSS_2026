import { useEffect, useRef, useState } from "react";

// 연락처 입력 컴포넌트
interface Props {
  value: string;                 // "010-1234-5678"
  onChange: (v: string) => void;
  segments: number[];            // [3,4,4] or [3,3,4]
}

export default function PhoneInput({ value, onChange, segments }: Props) {
  const initial = value ? value.split("-") : [];
  const [parts, setParts] = useState<string[]>(
    segments.map((_, i) => initial[i] || "")
  );

  const refs = useRef<HTMLInputElement[]>([]);

  useEffect(() => {
    onChange(parts.filter(Boolean).join("-"));
  }, [parts]);

  const handleChange = (idx: number, max: number) =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const v = e.target.value.replace(/\D/g, "").slice(0, max);

      setParts(prev => {
        const next = [...prev];
        next[idx] = v;
        return next;
      });

      if (v.length === max && refs.current[idx + 1]) {
        refs.current[idx + 1].focus();
      }
    };

  return (
    <div className="phone-group">
      {segments.map((len, i) => (
        <div key={i} className="phone-item">
          <input
            ref={el => {
              if (el) refs.current[i] = el;
            }}
            value={parts[i]}
            maxLength={len}
            onChange={handleChange(i, len)}
          />
          {i < segments.length - 1 && <span>-</span>}
        </div>
      ))}
    </div>
  );
}
