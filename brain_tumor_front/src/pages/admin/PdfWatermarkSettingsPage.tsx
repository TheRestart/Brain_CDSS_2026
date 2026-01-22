import { useEffect, useState, useRef } from 'react';
import {
  getPdfWatermarkConfig,
  updatePdfWatermarkConfig,
  DEFAULT_PDF_WATERMARK_CONFIG,
  type PdfWatermarkConfig
} from '@/services/pdfWatermark.api';
import { invalidateWatermarkCache } from '@/utils/exportUtils';
import './PdfWatermarkSettingsPage.css';

const POSITION_OPTIONS = [
  { value: 'center', label: '중앙' },
  { value: 'diagonal', label: '대각선' },
  { value: 'top-right', label: '우측 상단' },
  { value: 'bottom-right', label: '우측 하단' },
] as const;

const TYPE_OPTIONS = [
  { value: 'text', label: '텍스트' },
  { value: 'image', label: '이미지' },
] as const;

export default function PdfWatermarkSettingsPage() {
  const [config, setConfig] = useState<PdfWatermarkConfig | null>(null);
  const [editConfig, setEditConfig] = useState<PdfWatermarkConfig>(DEFAULT_PDF_WATERMARK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchConfig();
  }, []);

  useEffect(() => {
    if (config) {
      setHasChanges(JSON.stringify(config) !== JSON.stringify(editConfig));
    }
  }, [config, editConfig]);

  const fetchConfig = async () => {
    try {
      setLoading(true);
      setError(null);
      const data = await getPdfWatermarkConfig();
      // 기존 데이터에 새 필드가 없으면 기본값 추가
      const mergedData: PdfWatermarkConfig = {
        ...DEFAULT_PDF_WATERMARK_CONFIG,
        ...data,
      };
      setConfig(mergedData);
      setEditConfig(mergedData);
    } catch (err) {
      setError('설정을 불러오는데 실패했습니다.');
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await updatePdfWatermarkConfig(editConfig);
      invalidateWatermarkCache();  // 캐시 무효화하여 다음 PDF 생성 시 새 설정 적용
      setConfig(editConfig);
      setHasChanges(false);
      alert('설정이 저장되었습니다.');
    } catch (err) {
      alert('설정 저장에 실패했습니다.');
      console.error(err);
    } finally {
      setSaving(false);
    }
  };

  const handleReset = () => {
    if (config) {
      setEditConfig(config);
    }
  };

  const handleResetToDefault = () => {
    if (confirm('기본값으로 초기화하시겠습니까?')) {
      setEditConfig(DEFAULT_PDF_WATERMARK_CONFIG);
    }
  };

  const updateField = <K extends keyof PdfWatermarkConfig>(
    field: K,
    value: PdfWatermarkConfig[K]
  ) => {
    setEditConfig(prev => ({ ...prev, [field]: value }));
  };

  // 이미지 파일 선택 핸들러
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 파일 크기 제한 (1MB)
    if (file.size > 1024 * 1024) {
      alert('이미지 파일 크기는 1MB 이하여야 합니다.');
      return;
    }

    // 파일 타입 확인
    if (!file.type.startsWith('image/')) {
      alert('이미지 파일만 업로드 가능합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      const dataUrl = event.target?.result as string;
      updateField('imageUrl', dataUrl);
    };
    reader.readAsDataURL(file);
  };

  // 이미지 삭제 핸들러
  const handleImageRemove = () => {
    updateField('imageUrl', '');
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  if (loading) {
    return (
      <div className="pdf-watermark-page">
        <div className="loading-container">
          <div className="spinner" />
          <p>설정을 불러오는 중...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="pdf-watermark-page">
        <div className="error-container">
          <p>{error}</p>
          <button onClick={fetchConfig} className="btn btn-primary">
            다시 시도
          </button>
        </div>
      </div>
    );
  }

  const watermarkType = editConfig.type || 'text';

  return (
    <div className="pdf-watermark-page">
      <div className="page-header">
        <div>
          <h1>PDF 워터마크 설정</h1>
          <p>PDF 보고서 출력 시 적용되는 워터마크를 설정합니다.</p>
        </div>
        <div className="header-actions">
          <button
            onClick={handleResetToDefault}
            className="btn btn-secondary"
            disabled={saving}
          >
            기본값 초기화
          </button>
          <button
            onClick={handleReset}
            className="btn btn-secondary"
            disabled={!hasChanges || saving}
          >
            변경 취소
          </button>
          <button
            onClick={handleSave}
            className="btn btn-primary"
            disabled={!hasChanges || saving}
          >
            {saving ? '저장 중...' : '저장'}
          </button>
        </div>
      </div>

      <div className="settings-container">
        {/* 설정 폼 */}
        <div className="settings-form">
          <div className="form-section">
            <h3>기본 설정</h3>

            <div className="form-row">
              <label className="toggle-label">
                <span>워터마크 활성화</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={editConfig.enabled}
                    onChange={(e) => updateField('enabled', e.target.checked)}
                  />
                  <span className="toggle-slider" />
                </div>
              </label>
            </div>

            <div className="form-row">
              <label>워터마크 유형</label>
              <div className="type-selector">
                {TYPE_OPTIONS.map(opt => (
                  <button
                    key={opt.value}
                    type="button"
                    className={`type-btn ${watermarkType === opt.value ? 'active' : ''}`}
                    onClick={() => updateField('type', opt.value as 'text' | 'image')}
                    disabled={!editConfig.enabled}
                  >
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>

            {watermarkType === 'text' ? (
              <div className="form-row">
                <label>워터마크 텍스트</label>
                <input
                  type="text"
                  value={editConfig.text}
                  onChange={(e) => updateField('text', e.target.value)}
                  placeholder="예: CONFIDENTIAL, 대외비"
                  disabled={!editConfig.enabled}
                />
                <p className="form-hint">한글, 영문 모두 사용 가능합니다.</p>
              </div>
            ) : (
              <div className="form-row">
                <label>워터마크 이미지</label>
                <div className="image-upload-area">
                  {editConfig.imageUrl ? (
                    <div className="image-preview-container">
                      <img
                        src={editConfig.imageUrl}
                        alt="워터마크 이미지"
                        className="image-preview"
                      />
                      <button
                        type="button"
                        className="image-remove-btn"
                        onClick={handleImageRemove}
                        disabled={!editConfig.enabled}
                      >
                        삭제
                      </button>
                    </div>
                  ) : (
                    <div
                      className={`image-drop-zone ${!editConfig.enabled ? 'disabled' : ''}`}
                      onClick={() => editConfig.enabled && fileInputRef.current?.click()}
                    >
                      <span className="drop-icon">🖼️</span>
                      <span>이미지를 선택하세요</span>
                      <span className="drop-hint">PNG, JPG (최대 1MB)</span>
                    </div>
                  )}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept="image/*"
                    onChange={handleImageSelect}
                    style={{ display: 'none' }}
                    disabled={!editConfig.enabled}
                  />
                </div>
              </div>
            )}

            <div className="form-row">
              <label>위치</label>
              <select
                value={editConfig.position}
                onChange={(e) => updateField('position', e.target.value as PdfWatermarkConfig['position'])}
                disabled={!editConfig.enabled}
              >
                {POSITION_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>{opt.label}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="form-section">
            <h3>스타일 설정</h3>

            <div className="form-row">
              <label>투명도: {Math.round(editConfig.opacity * 100)}%</label>
              <input
                type="range"
                min="0"
                max="100"
                value={editConfig.opacity * 100}
                onChange={(e) => updateField('opacity', Number(e.target.value) / 100)}
                disabled={!editConfig.enabled}
              />
            </div>

            {watermarkType === 'text' && (
              <>
                <div className="form-row">
                  <label>글꼴 크기 (px)</label>
                  <input
                    type="number"
                    min="12"
                    max="120"
                    value={editConfig.fontSize}
                    onChange={(e) => updateField('fontSize', Number(e.target.value))}
                    disabled={!editConfig.enabled}
                  />
                </div>

                <div className="form-row">
                  <label>색상</label>
                  <div className="color-input-wrapper">
                    <input
                      type="color"
                      value={editConfig.color}
                      onChange={(e) => updateField('color', e.target.value)}
                      disabled={!editConfig.enabled}
                    />
                    <input
                      type="text"
                      value={editConfig.color}
                      onChange={(e) => updateField('color', e.target.value)}
                      placeholder="#cccccc"
                      disabled={!editConfig.enabled}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <label>회전 각도 (도)</label>
                  <input
                    type="number"
                    min="-90"
                    max="90"
                    value={editConfig.rotation}
                    onChange={(e) => updateField('rotation', Number(e.target.value))}
                    disabled={!editConfig.enabled}
                  />
                </div>
              </>
            )}

            {watermarkType === 'image' && (
              <div className="form-row-group">
                <div className="form-row half">
                  <label>이미지 너비 (mm)</label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={editConfig.imageWidth}
                    onChange={(e) => updateField('imageWidth', Number(e.target.value))}
                    disabled={!editConfig.enabled}
                  />
                </div>
                <div className="form-row half">
                  <label>이미지 높이 (mm)</label>
                  <input
                    type="number"
                    min="10"
                    max="200"
                    value={editConfig.imageHeight}
                    onChange={(e) => updateField('imageHeight', Number(e.target.value))}
                    disabled={!editConfig.enabled}
                  />
                </div>
              </div>
            )}

            <div className="form-row">
              <label className="toggle-label">
                <span>패턴 반복</span>
                <div className="toggle-switch">
                  <input
                    type="checkbox"
                    checked={editConfig.repeatPattern}
                    onChange={(e) => updateField('repeatPattern', e.target.checked)}
                    disabled={!editConfig.enabled}
                  />
                  <span className="toggle-slider" />
                </div>
              </label>
              <p className="form-hint">활성화하면 전체 페이지에 워터마크가 반복됩니다.</p>
            </div>
          </div>
        </div>

        {/* 미리보기 */}
        <div className="preview-section">
          <h3>미리보기</h3>
          <div className="preview-container">
            <div className="preview-page">
              {editConfig.enabled && (
                <div
                  className={`preview-watermark ${editConfig.position} ${editConfig.repeatPattern ? 'repeat' : ''}`}
                  style={{
                    opacity: editConfig.opacity,
                    ...(watermarkType === 'text' ? {
                      color: editConfig.color,
                      fontSize: `${Math.min(editConfig.fontSize / 2, 24)}px`,
                      transform: `rotate(${editConfig.rotation}deg)`,
                    } : {})
                  }}
                >
                  {watermarkType === 'image' && editConfig.imageUrl ? (
                    editConfig.repeatPattern ? (
                      <>
                        {Array.from({ length: 9 }).map((_, i) => (
                          <img
                            key={i}
                            src={editConfig.imageUrl}
                            alt="watermark"
                            className="repeat-image"
                          />
                        ))}
                      </>
                    ) : (
                      <img
                        src={editConfig.imageUrl}
                        alt="watermark"
                        className="single-image"
                      />
                    )
                  ) : watermarkType === 'text' ? (
                    editConfig.repeatPattern ? (
                      <>
                        {Array.from({ length: 9 }).map((_, i) => (
                          <span key={i} className="repeat-text">{editConfig.text}</span>
                        ))}
                      </>
                    ) : (
                      editConfig.text
                    )
                  ) : null}
                </div>
              )}
              <div className="preview-content">
                <div className="preview-header" />
                <div className="preview-line" />
                <div className="preview-line short" />
                <div className="preview-line" />
                <div className="preview-line short" />
                <div className="preview-line" />
              </div>
            </div>
          </div>
          <p className="preview-note">
            {watermarkType === 'text'
              ? `실제 PDF에서는 설정된 글꼴 크기(${editConfig.fontSize}px)로 표시됩니다.`
              : `실제 PDF에서는 설정된 크기(${editConfig.imageWidth}x${editConfig.imageHeight}mm)로 표시됩니다.`
            }
          </p>
        </div>
      </div>
    </div>
  );
}
