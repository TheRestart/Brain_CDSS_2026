/**
 * 처방 카드
 * - 약 처방 생성 및 발행
 * - 의약품 마스터에서 클릭 선택 가능
 * - 진단은 SOAP Assessment에서 입력
 */
import { useState, useEffect, useRef } from 'react';
import {
  createPrescription,
  issuePrescription,
  getPrescriptionsByPatient,
  getMedications,
  getMedicationCategories,
} from '@/services/prescription.api';
import type { Medication, MedicationCategory } from '@/services/prescription.api';
import type { Encounter } from '@/types/encounter';
import type {
  PrescriptionListItem,
  PrescriptionItemCreateData,
  PrescriptionFrequency,
  PrescriptionRoute,
} from '@/types/prescription';
import { FREQUENCY_LABELS, ROUTE_LABELS } from '@/types/prescription';

interface PrescriptionCardProps {
  patientId: number;
  encounter: Encounter | null;
  onPrescriptionCreated?: () => void;
}

// 기본 처방 항목
const DEFAULT_ITEM: PrescriptionItemCreateData = {
  medication_name: '',
  dosage: '',
  frequency: 'TID',
  route: 'PO',
  duration_days: 7,
  quantity: 21,
  instructions: '',
};

export default function PrescriptionCard({
  patientId,
  encounter,
  onPrescriptionCreated,
}: PrescriptionCardProps) {
  // 처방 관련 상태
  const [prescriptionDiagnosis, setPrescriptionDiagnosis] = useState('');
  const [prescriptionNotes, setPrescriptionNotes] = useState('');
  const [items, setItems] = useState<PrescriptionItemCreateData[]>([{ ...DEFAULT_ITEM }]);
  const [creatingPrescription, setCreatingPrescription] = useState(false);
  const [_currentPrescriptionId, setCurrentPrescriptionId] = useState<number | null>(null);
  const [draftPrescriptions, setDraftPrescriptions] = useState<PrescriptionListItem[]>([]);

  // 의약품 선택 관련 상태
  const [medications, setMedications] = useState<Medication[]>([]);
  const [categories, setCategories] = useState<MedicationCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<string>('');
  const [medicationSearch, setMedicationSearch] = useState('');
  const [showMedicationPicker, setShowMedicationPicker] = useState(false);
  const pickerRef = useRef<HTMLDivElement>(null);

  // 기존 데이터 로드 (진단명을 처방 진단명 기본값으로)
  useEffect(() => {
    if (encounter) {
      setPrescriptionDiagnosis(encounter.primary_diagnosis || '');
    }
  }, [encounter]);

  // 의약품 목록 및 카테고리 로드
  useEffect(() => {
    const fetchMedications = async () => {
      try {
        const [medList, catList] = await Promise.all([
          getMedications(),
          getMedicationCategories(),
        ]);
        setMedications(medList);
        setCategories(catList);
      } catch (err) {
        console.error('의약품 목록 로드 실패:', err);
      }
    };
    fetchMedications();
  }, []);

  // 의약품 picker 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target as Node)) {
        setShowMedicationPicker(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // 작성 중인 처방 목록 불러오기
  useEffect(() => {
    if (!patientId) return;

    const fetchDraftPrescriptions = async () => {
      try {
        const prescriptions = await getPrescriptionsByPatient(patientId);
        const list = Array.isArray(prescriptions) ? prescriptions : [];
        setDraftPrescriptions(list.filter((p) => p.status === 'DRAFT'));
      } catch (err) {
        console.error('작성 중 처방 조회 실패:', err);
      }
    };

    fetchDraftPrescriptions();
  }, [patientId]);

  // 처방 항목 추가 (위쪽에 추가)
  const handleAddItem = () => {
    setItems([{ ...DEFAULT_ITEM }, ...items]);
  };

  // 처방 항목 삭제
  const handleRemoveItem = (index: number) => {
    if (items.length <= 1) return;
    setItems(items.filter((_, i) => i !== index));
  };

  // 의약품 선택 시 처방 항목에 추가 (위쪽에 추가)
  const handleSelectMedication = (med: Medication) => {
    const newItem: PrescriptionItemCreateData = {
      medication_name: med.name,
      medication_code: med.code,
      dosage: med.default_dosage,
      frequency: med.default_frequency as PrescriptionFrequency,
      route: med.default_route as PrescriptionRoute,
      duration_days: med.default_duration_days,
      quantity: Math.ceil(
        med.default_duration_days *
          (med.default_frequency === 'QD' ? 1 :
           med.default_frequency === 'BID' ? 2 :
           med.default_frequency === 'TID' ? 3 :
           med.default_frequency === 'QID' ? 4 :
           med.default_frequency === 'QOD' ? 0.5 :
           med.default_frequency === 'QW' ? 1/7 : 1)
      ),
      instructions: '',
    };
    // 빈 항목이 하나뿐이면 대체, 아니면 위에 추가
    if (items.length === 1 && !items[0].medication_name) {
      setItems([newItem]);
    } else {
      setItems([newItem, ...items]);
    }
    setShowMedicationPicker(false);
    setMedicationSearch('');
  };

  // 필터링된 의약품 목록
  const filteredMedications = medications.filter((med) => {
    const matchesCategory = !selectedCategory || med.category === selectedCategory;
    const matchesSearch = !medicationSearch ||
      med.name.toLowerCase().includes(medicationSearch.toLowerCase()) ||
      med.code.toLowerCase().includes(medicationSearch.toLowerCase()) ||
      (med.generic_name && med.generic_name.toLowerCase().includes(medicationSearch.toLowerCase()));
    return matchesCategory && matchesSearch;
  });

  // 처방 항목 업데이트
  const handleUpdateItem = (
    index: number,
    field: keyof PrescriptionItemCreateData,
    value: string | number
  ) => {
    const newItems = [...items];
    newItems[index] = { ...newItems[index], [field]: value };

    // duration_days 변경 시 quantity 자동 계산
    if (field === 'duration_days' || field === 'frequency') {
      const freq = field === 'frequency' ? (value as PrescriptionFrequency) : newItems[index].frequency;
      const days = field === 'duration_days' ? (value as number) : newItems[index].duration_days;
      const multiplier: Record<PrescriptionFrequency, number> = {
        QD: 1,
        BID: 2,
        TID: 3,
        QID: 4,
        PRN: 1,
        QOD: 0.5,
        QW: 1 / 7,
      };
      newItems[index].quantity = Math.ceil(days * multiplier[freq]);
    }

    setItems(newItems);
  };

  // 처방 생성 및 발행
  const handleCreatePrescription = async (issueAfterCreate: boolean = false) => {
    // 유효성 검사
    const validItems = items.filter((item) => item.medication_name.trim() && item.dosage.trim());
    if (validItems.length === 0) {
      alert('최소 1개 이상의 약품 정보를 입력해주세요.');
      return;
    }

    setCreatingPrescription(true);
    try {
      // 처방 생성
      const prescription = await createPrescription({
        patient_id: patientId,
        encounter_id: encounter?.id,
        diagnosis: prescriptionDiagnosis,
        notes: prescriptionNotes,
        items: validItems,
      });

      setCurrentPrescriptionId(prescription.id);

      if (issueAfterCreate) {
        await issuePrescription(prescription.id);
        alert('처방전이 발행되었습니다.');
      } else {
        alert('처방이 저장되었습니다. (작성 중)');
      }

      // 초기화 및 콜백
      setItems([{ ...DEFAULT_ITEM }]);
      setPrescriptionNotes('');
      onPrescriptionCreated?.();

      // 작성 중 목록 새로고침
      const prescriptions = await getPrescriptionsByPatient(patientId);
      const list = Array.isArray(prescriptions) ? prescriptions : [];
      setDraftPrescriptions(list.filter((p) => p.status === 'DRAFT'));
    } catch (err) {
      console.error('처방 생성 실패:', err);
      alert('처방 생성에 실패했습니다.');
    } finally {
      setCreatingPrescription(false);
    }
  };

  // 진료가 시작되지 않은 경우
  if (!encounter) {
    return (
      <div className="clinic-card">
        <div className="clinic-card-header">
          <h3>
            <span className="card-icon">💊</span>
            처방
          </h3>
        </div>
        <div className="clinic-card-body">
          <div className="empty-state">
            <div className="empty-state-icon">💊</div>
            <div className="empty-state-text">
              진료를 시작하면 처방을 입력할 수 있습니다.
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="clinic-card prescription-card">
      <div className="clinic-card-header">
        <h3>
          <span className="card-icon">💊</span>
          처방
          {draftPrescriptions.length > 0 && (
            <span className="draft-count">작성중 {draftPrescriptions.length}</span>
          )}
        </h3>
      </div>
      <div className="clinic-card-body">
        <div className="prescription-section">
          {/* 처방 진단명 */}
          <div className="form-group">
            <label>처방 진단명</label>
            <input
              type="text"
              value={prescriptionDiagnosis}
              onChange={(e) => setPrescriptionDiagnosis(e.target.value)}
              placeholder="처방 관련 진단명"
            />
          </div>

          {/* 처방 항목 목록 */}
          <div className="prescription-items">
            <div className="items-header">
              <label>처방 약품</label>
              <div className="items-header-buttons">
                <button
                  className="btn btn-sm btn-primary"
                  onClick={() => setShowMedicationPicker(true)}
                  type="button"
                >
                  💊 약품 선택
                </button>
                <button
                  className="btn btn-sm btn-secondary"
                  onClick={handleAddItem}
                  type="button"
                >
                  + 직접 입력
                </button>
              </div>
            </div>

            {/* 의약품 선택 Picker */}
            {showMedicationPicker && (
              <div className="medication-picker" ref={pickerRef}>
                <div className="picker-header">
                  <input
                    type="text"
                    value={medicationSearch}
                    onChange={(e) => setMedicationSearch(e.target.value)}
                    placeholder="약품명, 코드로 검색..."
                    autoFocus
                  />
                  <select
                    value={selectedCategory}
                    onChange={(e) => setSelectedCategory(e.target.value)}
                  >
                    <option value="">전체 분류</option>
                    {categories.map((cat) => (
                      <option key={cat.value} value={cat.value}>
                        {cat.label}
                      </option>
                    ))}
                  </select>
                  <button
                    className="btn-close"
                    onClick={() => setShowMedicationPicker(false)}
                  >
                    ✕
                  </button>
                </div>
                <div className="picker-list">
                  {filteredMedications.length === 0 ? (
                    <div className="picker-empty">검색 결과가 없습니다</div>
                  ) : (
                    filteredMedications.map((med) => (
                      <div
                        key={med.id}
                        className="picker-item"
                        onClick={() => handleSelectMedication(med)}
                      >
                        <div className="picker-item-main">
                          <span className="med-name">{med.name}</span>
                          <span className="med-dosage">{med.default_dosage}</span>
                        </div>
                        <div className="picker-item-sub">
                          <span className="med-code">{med.code}</span>
                          <span className="med-category">{med.category_display}</span>
                          <span className="med-route">{med.default_route_display}</span>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {items.map((item, index) => (
              <div key={index} className="prescription-item-form">
                <div className="item-row">
                  <div className="form-group flex-2">
                    <input
                      type="text"
                      value={item.medication_name}
                      onChange={(e) =>
                        handleUpdateItem(index, 'medication_name', e.target.value)
                      }
                      placeholder="약품명"
                    />
                  </div>
                  <div className="form-group flex-1">
                    <input
                      type="text"
                      value={item.dosage}
                      onChange={(e) => handleUpdateItem(index, 'dosage', e.target.value)}
                      placeholder="용량 (예: 500mg)"
                    />
                  </div>
                  {items.length > 1 && (
                    <button
                      className="btn-remove"
                      onClick={() => handleRemoveItem(index)}
                      type="button"
                    >
                      ✕
                    </button>
                  )}
                </div>
                <div className="item-row">
                  <div className="form-group">
                    <select
                      value={item.frequency}
                      onChange={(e) =>
                        handleUpdateItem(
                          index,
                          'frequency',
                          e.target.value as PrescriptionFrequency
                        )
                      }
                    >
                      {(Object.keys(FREQUENCY_LABELS) as PrescriptionFrequency[]).map((f) => (
                        <option key={f} value={f}>
                          {FREQUENCY_LABELS[f]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <select
                      value={item.route}
                      onChange={(e) =>
                        handleUpdateItem(index, 'route', e.target.value as PrescriptionRoute)
                      }
                    >
                      {(Object.keys(ROUTE_LABELS) as PrescriptionRoute[]).map((r) => (
                        <option key={r} value={r}>
                          {ROUTE_LABELS[r]}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      value={item.duration_days}
                      onChange={(e) =>
                        handleUpdateItem(index, 'duration_days', parseInt(e.target.value) || 1)
                      }
                      min={1}
                      placeholder="일수"
                    />
                    <span className="input-suffix">일</span>
                  </div>
                  <div className="form-group">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) =>
                        handleUpdateItem(index, 'quantity', parseInt(e.target.value) || 1)
                      }
                      min={1}
                      placeholder="수량"
                    />
                    <span className="input-suffix">개</span>
                  </div>
                </div>
                <div className="item-row">
                  <div className="form-group flex-1">
                    <input
                      type="text"
                      value={item.instructions || ''}
                      onChange={(e) =>
                        handleUpdateItem(index, 'instructions', e.target.value)
                      }
                      placeholder="복용 지시 (예: 식후 30분)"
                    />
                  </div>
                </div>
              </div>
            ))}
          </div>

          {/* 처방 비고 */}
          <div className="form-group">
            <label>처방 비고</label>
            <textarea
              value={prescriptionNotes}
              onChange={(e) => setPrescriptionNotes(e.target.value)}
              placeholder="추가 지시사항..."
              rows={2}
            />
          </div>
        </div>
      </div>

      {/* 푸터: 발행 버튼 */}
      <div className="clinic-card-footer">
        <div className="prescription-actions">
          <button
            className="btn btn-primary"
            onClick={() => handleCreatePrescription(true)}
            disabled={creatingPrescription}
          >
            {creatingPrescription ? '처리 중...' : '처방전 발행'}
          </button>
        </div>
      </div>

      <style>{`
        .prescription-card .clinic-card-body {
          max-height: 400px;
          overflow-y: auto;
        }
        .draft-count {
          font-size: 11px;
          font-weight: normal;
          padding: 2px 8px;
          background: var(--warning, #f57c00);
          color: white;
          border-radius: 10px;
          margin-left: 8px;
        }
        .prescription-section {
          display: flex;
          flex-direction: column;
          gap: 12px;
        }
        .items-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 8px;
        }
        .items-header label {
          font-size: 12px;
          font-weight: 500;
          color: var(--text-secondary, #666);
        }
        .items-header-buttons {
          display: flex;
          gap: 6px;
        }
        .prescription-items {
          display: flex;
          flex-direction: column;
          gap: 8px;
          position: relative;
        }
        /* 의약품 선택 Picker */
        .medication-picker {
          position: absolute;
          top: 40px;
          left: 0;
          right: 0;
          background: white;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 8px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          z-index: 1000;
          max-height: 350px;
          display: flex;
          flex-direction: column;
        }
        .picker-header {
          display: flex;
          gap: 8px;
          padding: 12px;
          border-bottom: 1px solid var(--border-color, #e0e0e0);
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 8px 8px 0 0;
        }
        .picker-header input {
          flex: 2;
          padding: 8px 12px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 4px;
          font-size: 13px;
        }
        .picker-header select {
          flex: 1;
          padding: 8px;
          border: 1px solid var(--border-color, #e0e0e0);
          border-radius: 4px;
          font-size: 13px;
        }
        .picker-header .btn-close {
          width: 32px;
          height: 32px;
          border: none;
          background: var(--bg-secondary, #f0f0f0);
          border-radius: 4px;
          cursor: pointer;
          font-size: 14px;
        }
        .picker-header .btn-close:hover {
          background: var(--error-light, #ffebee);
          color: var(--error, #c62828);
        }
        .picker-list {
          overflow-y: auto;
          max-height: 280px;
        }
        .picker-empty {
          padding: 24px;
          text-align: center;
          color: var(--text-tertiary, #999);
        }
        .picker-item {
          padding: 10px 12px;
          cursor: pointer;
          border-bottom: 1px solid var(--border-color, #f0f0f0);
          transition: background 0.15s;
        }
        .picker-item:hover {
          background: var(--primary-light, #e3f2fd);
        }
        .picker-item:last-child {
          border-bottom: none;
        }
        .picker-item-main {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 4px;
        }
        .picker-item-main .med-name {
          font-weight: 500;
          color: var(--text-primary, #333);
        }
        .picker-item-main .med-dosage {
          font-size: 12px;
          color: var(--primary, #1976d2);
          font-weight: 500;
        }
        .picker-item-sub {
          display: flex;
          gap: 8px;
          font-size: 11px;
          color: var(--text-tertiary, #999);
        }
        .picker-item-sub .med-code {
          color: var(--text-secondary, #666);
        }
        .picker-item-sub .med-category {
          background: var(--bg-secondary, #f5f5f5);
          padding: 1px 6px;
          border-radius: 3px;
        }
        .prescription-item-form {
          background: var(--bg-secondary, #f5f5f5);
          border-radius: 6px;
          padding: 12px;
          display: flex;
          flex-direction: column;
          gap: 8px;
        }
        .item-row {
          display: flex;
          gap: 8px;
          align-items: center;
        }
        .item-row .form-group {
          margin-bottom: 0;
          flex: 1;
          position: relative;
        }
        .item-row .form-group.flex-2 {
          flex: 2;
        }
        .item-row .form-group.flex-1 {
          flex: 1;
        }
        .item-row input,
        .item-row select {
          width: 100%;
          padding: 6px 8px;
          font-size: 13px;
        }
        .item-row select {
          padding-right: 24px;
        }
        .input-suffix {
          position: absolute;
          right: 8px;
          top: 50%;
          transform: translateY(-50%);
          font-size: 11px;
          color: var(--text-tertiary, #999);
          pointer-events: none;
        }
        .btn-remove {
          width: 24px;
          height: 24px;
          border: none;
          background: var(--error-light, #ffebee);
          color: var(--error, #c62828);
          border-radius: 4px;
          cursor: pointer;
          font-size: 12px;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }
        .btn-remove:hover {
          background: var(--error, #c62828);
          color: white;
        }
        .prescription-actions {
          display: flex;
          gap: 8px;
          justify-content: flex-end;
        }
      `}</style>
    </div>
  );
}
