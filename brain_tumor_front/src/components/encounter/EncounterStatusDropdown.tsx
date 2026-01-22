import { useState } from 'react';
import type { EncounterStatus } from '@/types/encounter';
import { changeEncounterStatus } from '@/services/encounter.api';
import './EncounterStatusDropdown.css';

interface EncounterStatusDropdownProps {
  encounterId: number;
  currentStatus: EncounterStatus;
  onStatusChange?: (newStatus: EncounterStatus) => void;
  disabled?: boolean;
  compact?: boolean;
}

const STATUS_OPTIONS: { value: EncounterStatus; label: string }[] = [
  { value: 'scheduled', label: '예정' },
  { value: 'in_progress', label: '진행중' },
  { value: 'completed', label: '완료' },
  { value: 'cancelled', label: '취소' },
];

export default function EncounterStatusDropdown({
  encounterId,
  currentStatus,
  onStatusChange,
  disabled = false,
  compact = false,
}: EncounterStatusDropdownProps) {
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<EncounterStatus>(currentStatus);

  const handleChange = async (e: React.ChangeEvent<HTMLSelectElement>) => {
    const newStatus = e.target.value as EncounterStatus;
    if (newStatus === status) return;

    setLoading(true);
    try {
      await changeEncounterStatus(encounterId, newStatus);
      setStatus(newStatus);
      onStatusChange?.(newStatus);
    } catch (error: any) {
      console.error('Failed to change status:', error);
      alert(error.response?.data?.detail || '상태 변경에 실패했습니다.');
      // 실패 시 원래 상태로 되돌림
      e.target.value = status;
    } finally {
      setLoading(false);
    }
  };

  const dropdownClass = [
    'status-dropdown',
    compact ? 'compact' : '',
    loading ? 'loading' : '',
  ].filter(Boolean).join(' ');

  return (
    <div className={dropdownClass}>
      <select
        value={status}
        onChange={handleChange}
        disabled={disabled || loading}
        className={`status-select status-${status}`}
        onClick={(e) => e.stopPropagation()}
      >
        {STATUS_OPTIONS.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
      {loading && <span className="spinner" />}
    </div>
  );
}
