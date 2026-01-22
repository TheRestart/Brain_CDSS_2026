/**
 * 금일 증세 입력 카드
 * - 환자의 오늘 증상/주소 입력
 * - POST /api/encounters/ 또는 PATCH로 저장
 */
import { useState, useCallback, useEffect } from 'react';
import { updateEncounter } from '@/services/encounter.api';
import type { Encounter } from '@/types/encounter';

interface TodaySymptomCardProps {
  patientId: number;
  encounter: Encounter | null;
  onUpdate: () => void;
}

export default function TodaySymptomCard({
  patientId: _patientId,
  encounter,
  onUpdate,
}: TodaySymptomCardProps) {
  const [chiefComplaint, setChiefComplaint] = useState('');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // 기존 데이터 로드
  useEffect(() => {
    if (encounter) {
      setChiefComplaint(encounter.chief_complaint || '');
    }
  }, [encounter]);

  // 저장
  const handleSave = useCallback(async () => {
    if (!encounter?.id) {
      alert('진료 정보가 없습니다.');
      return;
    }

    setSaving(true);
    try {
      await updateEncounter(encounter.id, {
        chief_complaint: chiefComplaint,
      });
      setSaved(true);
      setTimeout(() => setSaved(false), 2000);
      onUpdate();
    } catch (err) {
      console.error('Failed to save symptoms:', err);
      alert('저장에 실패했습니다.');
    } finally {
      setSaving(false);
    }
  }, [encounter, chiefComplaint, onUpdate]);

  // 진료가 시작되지 않은 경우
  if (!encounter) {
    return (
      <div className="clinic-card">
        <div className="clinic-card-header">
          <h3>
            <span className="card-icon">📋</span>
            금일 증세
          </h3>
        </div>
        <div className="clinic-card-body">
          <div className="empty-state">
            <div className="empty-state-icon">🩺</div>
            <div className="empty-state-text">
              진료를 시작하면 증세를 입력할 수 있습니다.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clinic-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">📋</span>
          금일 증세
        </h3>
        {saved && <span className="save-indicator">저장됨 ✓</span>}
      </div>
      <div className="clinic-card-body">
        <div className="form-group">
          <label>주호소 (Chief Complaint)</label>
          <textarea
            value={chiefComplaint}
            onChange={(e) => setChiefComplaint(e.target.value)}
            placeholder="환자의 주된 호소 내용을 입력하세요..."
            rows={4}
          />
        </div>
      </div>
      <div className="clinic-card-footer">
        <button
          className="btn btn-primary"
          onClick={handleSave}
          disabled={saving}
        >
          {saving ? '저장 중...' : '저장'}
        </button>
      </div>
    </div>
  );
}
