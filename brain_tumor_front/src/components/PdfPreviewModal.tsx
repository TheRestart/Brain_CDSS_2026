import { useState, useEffect, useRef, useCallback, type ReactNode } from 'react';
import {
  getPdfWatermarkConfig,
  DEFAULT_PDF_WATERMARK_CONFIG,
  type PdfWatermarkConfig
} from '@/services/pdfWatermark.api';
import './PdfPreviewModal.css';

interface PdfPreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (config: PdfWatermarkConfig) => void;
  title?: string;
  /** 실제 문서 내용을 렌더링하는 ReactNode */
  children?: ReactNode;
}

const POSITION_OPTIONS = [
  { value: 'center', label: '중앙' },
  { value: 'diagonal', label: '대각선' },
  { value: 'top-right', label: '우측 상단' },
  { value: 'bottom-right', label: '우측 하단' },
] as const;

export default function PdfPreviewModal({
  isOpen,
  onClose,
  onConfirm,
  title = 'PDF 미리보기',
  children
}: PdfPreviewModalProps) {
  const [config, setConfig] = useState<PdfWatermarkConfig>(DEFAULT_PDF_WATERMARK_CONFIG);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [showWatermarkSettings, setShowWatermarkSettings] = useState(true); // 기본으로 열려있음
  const fileInputRef = useRef<HTMLInputElement>(null);
  const printRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      fetchConfig();
    }
  }, [isOpen]);

  const fetchConfig = async () => {
    setLoading(true);
    try {
      const data = await getPdfWatermarkConfig();
      setConfig({ ...DEFAULT_PDF_WATERMARK_CONFIG, ...data });
    } catch (err) {
      console.error('워터마크 설정 로드 실패:', err);
      setConfig(DEFAULT_PDF_WATERMARK_CONFIG);
    } finally {
      setLoading(false);
    }
  };

  const updateField = useCallback(<K extends keyof PdfWatermarkConfig>(
    field: K,
    value: PdfWatermarkConfig[K]
  ) => {
    setConfig(prev => ({ ...prev, [field]: value }));
  }, []);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.size > 1024 * 1024) {
      alert('이미지 파일 크기는 1MB 이하여야 합니다.');
      return;
    }

    const reader = new FileReader();
    reader.onload = (event) => {
      updateField('imageUrl', event.target?.result as string);
    };
    reader.readAsDataURL(file);
  };

  const handleConfirm = async () => {
    setGenerating(true);
    try {
      await onConfirm(config);
    } finally {
      setGenerating(false);
      onClose();
    }
  };

  if (!isOpen) return null;

  const watermarkType = config.type || 'text';

  // 워터마크 오버레이 렌더링
  const renderWatermarkOverlay = () => {
    if (!config.enabled) return null;

    const style: React.CSSProperties = {
      opacity: config.opacity,
    };

    if (watermarkType === 'text') {
      style.color = config.color;
      style.fontSize = `${config.fontSize}px`;
      style.transform = `translate(-50%, -50%) rotate(${config.rotation}deg)`;
    }

    return (
      <div
        className={`pdf-watermark-overlay ${config.position} ${config.repeatPattern ? 'repeat' : ''}`}
        style={style}
      >
        {watermarkType === 'image' && config.imageUrl ? (
          config.repeatPattern ? (
            <div className="watermark-repeat-grid">
              {Array.from({ length: 9 }).map((_, i) => (
                <img key={i} src={config.imageUrl} alt="" className="watermark-img"
                  style={{ width: config.imageWidth, height: config.imageHeight }} />
              ))}
            </div>
          ) : (
            <img src={config.imageUrl} alt="" className="watermark-img-single"
              style={{ width: config.imageWidth, height: config.imageHeight }} />
          )
        ) : watermarkType === 'text' ? (
          config.repeatPattern ? (
            <div className="watermark-repeat-grid">
              {Array.from({ length: 9 }).map((_, i) => (
                <span key={i} className="watermark-text">{config.text}</span>
              ))}
            </div>
          ) : (
            <span className="watermark-text-single">{config.text}</span>
          )
        ) : null}
      </div>
    );
  };

  return (
    <div className="pdf-preview-modal-overlay" onClick={onClose}>
      <div className="pdf-preview-modal large" onClick={(e) => e.stopPropagation()}>
        {/* 헤더 */}
        <div className="pdf-preview-header">
          <h2>{title}</h2>
          <div className="header-actions">
            <button
              className={`btn-watermark-toggle ${showWatermarkSettings ? 'active' : ''}`}
              onClick={() => setShowWatermarkSettings(!showWatermarkSettings)}
              title="워터마크 설정"
            >
              <span className="icon">&#9881;</span>
              워터마크
              {config.enabled && <span className="badge">ON</span>}
            </button>
            <button className="close-btn" onClick={onClose}>×</button>
          </div>
        </div>

        <div className="pdf-preview-body">
          {/* 문서 미리보기 영역 */}
          <div className="document-preview-area">
            <div className="document-container" ref={printRef}>
              {/* 워터마크 오버레이 */}
              {renderWatermarkOverlay()}

              {/* 실제 문서 내용 */}
              <div className="document-content print-area">
                {children || (
                  <div className="empty-preview">
                    <p>미리보기 내용이 없습니다.</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 워터마크 설정 사이드 패널 */}
          {showWatermarkSettings && (
            <div className="watermark-settings-panel">
              <div className="settings-header">
                <h3>워터마크 설정</h3>
              </div>

              {loading ? (
                <div className="loading-text">설정 로딩 중...</div>
              ) : (
                <div className="settings-content">
                  <div className="setting-group">
                    <label className="toggle-row">
                      <span>워터마크 사용</span>
                      <input
                        type="checkbox"
                        checked={config.enabled}
                        onChange={(e) => updateField('enabled', e.target.checked)}
                      />
                    </label>
                  </div>

                  {config.enabled && (
                    <>
                      <div className="setting-group">
                        <label>유형</label>
                        <div className="type-btns">
                          <button
                            type="button"
                            className={watermarkType === 'text' ? 'active' : ''}
                            onClick={() => updateField('type', 'text')}
                          >
                            텍스트
                          </button>
                          <button
                            type="button"
                            className={watermarkType === 'image' ? 'active' : ''}
                            onClick={() => updateField('type', 'image')}
                          >
                            이미지
                          </button>
                        </div>
                      </div>

                      {watermarkType === 'text' ? (
                        <>
                          <div className="setting-group">
                            <label>텍스트</label>
                            <input
                              type="text"
                              value={config.text}
                              onChange={(e) => updateField('text', e.target.value)}
                              placeholder="워터마크 텍스트"
                            />
                          </div>
                          <div className="setting-group">
                            <label>색상</label>
                            <div className="color-row">
                              <input
                                type="color"
                                value={config.color}
                                onChange={(e) => updateField('color', e.target.value)}
                              />
                              <input
                                type="text"
                                value={config.color}
                                onChange={(e) => updateField('color', e.target.value)}
                              />
                            </div>
                          </div>
                          <div className="setting-group">
                            <label>크기: {config.fontSize}px</label>
                            <input
                              type="range"
                              min="12"
                              max="120"
                              value={config.fontSize}
                              onChange={(e) => updateField('fontSize', Number(e.target.value))}
                            />
                          </div>
                          <div className="setting-group">
                            <label>회전: {config.rotation}°</label>
                            <input
                              type="range"
                              min="-90"
                              max="90"
                              value={config.rotation}
                              onChange={(e) => updateField('rotation', Number(e.target.value))}
                            />
                          </div>
                        </>
                      ) : (
                        <>
                          <div className="setting-group">
                            <label>이미지</label>
                            {config.imageUrl ? (
                              <div className="image-preview-row">
                                <img src={config.imageUrl} alt="" />
                                <button onClick={() => updateField('imageUrl', '')}>삭제</button>
                              </div>
                            ) : (
                              <button
                                className="upload-btn"
                                onClick={() => fileInputRef.current?.click()}
                              >
                                이미지 선택
                              </button>
                            )}
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/*"
                              onChange={handleImageSelect}
                              style={{ display: 'none' }}
                            />
                          </div>
                          <div className="setting-group">
                            <label>이미지 크기</label>
                            <div className="size-inputs">
                              <div>
                                <span>너비: {config.imageWidth}mm</span>
                                <input
                                  type="range"
                                  min="10"
                                  max="200"
                                  value={config.imageWidth}
                                  onChange={(e) => updateField('imageWidth', Number(e.target.value))}
                                />
                              </div>
                              <div>
                                <span>높이: {config.imageHeight}mm</span>
                                <input
                                  type="range"
                                  min="10"
                                  max="200"
                                  value={config.imageHeight}
                                  onChange={(e) => updateField('imageHeight', Number(e.target.value))}
                                />
                              </div>
                            </div>
                          </div>
                        </>
                      )}

                      <div className="setting-group">
                        <label>투명도: {Math.round(config.opacity * 100)}%</label>
                        <input
                          type="range"
                          min="0"
                          max="100"
                          value={config.opacity * 100}
                          onChange={(e) => updateField('opacity', Number(e.target.value) / 100)}
                        />
                      </div>

                      <div className="setting-group">
                        <label>위치</label>
                        <select
                          value={config.position}
                          onChange={(e) => updateField('position', e.target.value as PdfWatermarkConfig['position'])}
                        >
                          {POSITION_OPTIONS.map(opt => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>

                      <div className="setting-group">
                        <label className="toggle-row">
                          <span>패턴 반복</span>
                          <input
                            type="checkbox"
                            checked={config.repeatPattern}
                            onChange={(e) => updateField('repeatPattern', e.target.checked)}
                          />
                        </label>
                      </div>
                    </>
                  )}
                </div>
              )}
            </div>
          )}
        </div>

        {/* 푸터 */}
        <div className="pdf-preview-footer">
          <button className="btn-secondary" onClick={onClose} disabled={generating}>
            닫기
          </button>
          <button className="btn-primary" onClick={handleConfirm} disabled={generating || loading}>
            {generating ? 'PDF 생성 중...' : 'PDF 출력'}
          </button>
        </div>
      </div>
    </div>
  );
}
