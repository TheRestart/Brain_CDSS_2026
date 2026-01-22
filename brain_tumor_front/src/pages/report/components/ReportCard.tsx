/**
 * 보고서 카드 컴포넌트
 * - 썸네일 + 정보를 카드 형태로 표시
 * - OCS_RIS: 4채널 DICOM 이미지 썸네일 (T1, T1C, T2, FLAIR)
 * - 캐시되지 않은 보고서는 아이콘으로 표시, 상세 방문 후 캐시되면 썸네일 표시
 */
import { useState } from 'react';
import type { UnifiedReport, ChannelThumbnail } from '@/services/report.api';
import { useThumbnailCache } from '@/context/ThumbnailCacheContext';
import './ReportCard.css';

// 아이콘 매핑
const ICON_MAP: Record<string, string> = {
  mri: '\ud83e\udde0',      // 뇌
  brain: '\ud83e\udde0',    // 뇌
  dna: '\ud83e\uddec',      // DNA
  protein: '\ud83e\uddea',  // 시험관
  lab: '\ud83e\uddea',      // 시험관
  document: '\ud83d\udcc4', // 문서
  ai: '\ud83e\udd16',       // 로봇
  multimodal: '\ud83d\udd2c', // 현미경
};

// 채널별 색상
const CHANNEL_COLORS: Record<string, string> = {
  T1: '#3b82f6',    // blue
  T1C: '#ef4444',   // red (contrast)
  T2: '#10b981',    // green
  FLAIR: '#f59e0b', // amber
};

// API Base URL (Vite 프록시 우회용)
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:8000/api';

// 상대 경로 URL을 절대 URL로 변환
const toAbsoluteUrl = (url: string): string => {
  if (url.startsWith('http')) return url;
  if (url.startsWith('/api/')) {
    // '/api/' 제거 후 API_BASE_URL 추가 (예: '/api/foo' -> 'http://localhost:8000/api/foo')
    return `${API_BASE_URL}${url.slice(4)}`;
  }
  return url;
};

// SEG 채널 색상 추가
const CHANNEL_COLORS_EXT: Record<string, string> = {
  ...CHANNEL_COLORS,
  SEG: '#8b5cf6',  // purple (세그멘테이션 오버레이)
};

interface ReportCardProps {
  report: UnifiedReport;
  onClick: () => void;
}

export default function ReportCard({ report, onClick }: ReportCardProps) {
  const { thumbnail, type, type_display, sub_type, patient_name, patient_number, title, result_display, completed_at, status_display, id } = report;
  const [imageErrors, setImageErrors] = useState<Set<string>>(new Set());
  const { isCached } = useThumbnailCache();

  // 캐시된 보고서인지 확인 (캐시된 경우만 썸네일 로드)
  const showThumbnail = isCached(id);

  // 날짜 포맷
  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-';
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
  };

  // 타입별 색상
  const getTypeColor = () => {
    if (type.startsWith('OCS_RIS')) return '#3b82f6'; // blue
    if (type.startsWith('OCS_LIS')) return '#10b981'; // green
    if (type.startsWith('AI_M1')) return '#ef4444';   // red
    if (type.startsWith('AI_MG')) return '#10b981';   // green
    if (type.startsWith('AI_MM')) return '#6366f1';   // indigo
    if (type === 'FINAL') return '#8b5cf6';           // purple
    return '#6b7280';
  };

  // 결과 플래그 색상
  const getResultClass = () => {
    if (result_display === '정상' || result_display === '종양 미발견') return 'result-normal';
    if (result_display === '비정상' || result_display.includes('종양 발견')) return 'result-abnormal';
    return 'result-default';
  };

  // 이미지 에러 핸들러
  const handleImageError = (channel: string) => {
    setImageErrors(prev => new Set(prev).add(channel));
  };

  // DICOM 멀티채널 썸네일 렌더링 (4채널 그리드)
  const renderDicomMultiThumbnail = (channels: ChannelThumbnail[]) => {
    return (
      <div className="thumbnail-dicom-multi">
        {channels.slice(0, 4).map((ch) => (
          <div key={ch.channel} className="dicom-channel">
            {imageErrors.has(ch.channel) ? (
              <div
                className="channel-fallback"
                style={{ backgroundColor: CHANNEL_COLORS[ch.channel] || '#6b7280' }}
              >
                <span className="channel-label">{ch.channel}</span>
              </div>
            ) : (
              <>
                <img
                  src={toAbsoluteUrl(ch.url)}
                  alt={ch.description}
                  onError={() => handleImageError(ch.channel)}
                  loading="lazy"
                />
                <span
                  className="channel-badge"
                  style={{ backgroundColor: CHANNEL_COLORS[ch.channel] || '#6b7280' }}
                >
                  {ch.channel}
                </span>
              </>
            )}
          </div>
        ))}
      </div>
    );
  };

  // 썸네일 렌더링
  const renderThumbnail = () => {
    // DICOM 멀티채널 (4채널 그리드) - 캐시된 경우에만 실제 이미지 로드
    if (thumbnail.type === 'dicom_multi' && thumbnail.channels && thumbnail.channels.length > 0) {
      if (showThumbnail) {
        return renderDicomMultiThumbnail(thumbnail.channels);
      }
      // 캐시되지 않은 경우 MRI 아이콘 표시
      return (
        <div className="thumbnail-icon" style={{ backgroundColor: '#3b82f6' }}>
          <span className="icon">{ICON_MAP.mri}</span>
          <span className="label">MRI</span>
        </div>
      );
    }

    // DICOM 단일 (동적 로드 필요 시)
    if (thumbnail.type === 'dicom' && thumbnail.thumbnails_url) {
      // 아이콘 표시
      return (
        <div className="thumbnail-icon" style={{ backgroundColor: '#3b82f6' }}>
          <span className="icon">{ICON_MAP.mri}</span>
          <span className="label">MRI</span>
        </div>
      );
    }

    if (thumbnail.type === 'image' && thumbnail.url) {
      return (
        <div className="thumbnail-image">
          <img src={toAbsoluteUrl(thumbnail.url)} alt="thumbnail" />
        </div>
      );
    }

    if (thumbnail.type === 'segmentation') {
      // 세그멘테이션 미리보기 (간단한 아이콘으로 대체)
      return (
        <div className="thumbnail-segmentation" style={{ backgroundColor: thumbnail.color || '#ef4444' }}>
          <span className="icon">{ICON_MAP.brain}</span>
          <span className="label">3D MRI</span>
        </div>
      );
    }

    // M1 추론: MRI 4채널 + 세그멘테이션 오버레이
    if (thumbnail.type === 'segmentation_with_mri') {
      if (showThumbnail && thumbnail.channels && thumbnail.channels.length > 0) {
        // 첫 번째 채널을 SEG 오버레이로 대체, 나머지 3개는 원본 MRI
        const overlayChannel = {
          channel: 'SEG' as const,
          url: (thumbnail as any).overlay_url || '',
          description: 'Segmentation Overlay',
        };
        const displayChannels = [overlayChannel, ...thumbnail.channels.slice(0, 3)];
        return (
          <div className="thumbnail-dicom-multi">
            {displayChannels.map((ch, idx) => (
              <div key={ch.channel + idx} className="dicom-channel">
                {imageErrors.has(ch.channel) ? (
                  <div
                    className="channel-fallback"
                    style={{ backgroundColor: CHANNEL_COLORS_EXT[ch.channel] || '#6b7280' }}
                  >
                    <span className="channel-label">{ch.channel}</span>
                  </div>
                ) : (
                  <>
                    <img
                      src={toAbsoluteUrl(ch.url)}
                      alt={ch.description}
                      onError={() => handleImageError(ch.channel)}
                      loading="lazy"
                    />
                    <span
                      className="channel-badge"
                      style={{ backgroundColor: CHANNEL_COLORS_EXT[ch.channel] || '#6b7280' }}
                    >
                      {ch.channel}
                    </span>
                  </>
                )}
              </div>
            ))}
          </div>
        );
      }
      // 캐시되지 않은 경우 M1 아이콘
      return (
        <div className="thumbnail-icon" style={{ backgroundColor: thumbnail.color || '#ef4444' }}>
          <span className="icon">{ICON_MAP.brain}</span>
          <span className="label">M1</span>
        </div>
      );
    }

    // M1 추론: 세그멘테이션 오버레이만 (MRI 채널 없음)
    if (thumbnail.type === 'segmentation_overlay') {
      if (showThumbnail && (thumbnail as any).overlay_url) {
        return (
          <div className="thumbnail-image">
            <img src={toAbsoluteUrl((thumbnail as any).overlay_url)} alt="Segmentation Overlay" />
          </div>
        );
      }
      return (
        <div className="thumbnail-icon" style={{ backgroundColor: thumbnail.color || '#ef4444' }}>
          <span className="icon">{ICON_MAP.brain}</span>
          <span className="label">M1</span>
        </div>
      );
    }

    if (thumbnail.type === 'chart') {
      return (
        <div className="thumbnail-chart" style={{ backgroundColor: thumbnail.color || '#10b981' }}>
          <span className="icon">{ICON_MAP[thumbnail.icon || 'dna']}</span>
          <span className="label">Gene</span>
        </div>
      );
    }

    // 기본 아이콘
    return (
      <div className="thumbnail-icon" style={{ backgroundColor: thumbnail.color || getTypeColor() }}>
        <span className="icon">{ICON_MAP[thumbnail.icon || 'document']}</span>
      </div>
    );
  };

  return (
    <div className="report-card" onClick={onClick}>
      {/* 썸네일 영역 */}
      <div className="card-thumbnail">
        {renderThumbnail()}
        <span className="type-badge" style={{ backgroundColor: getTypeColor() }}>
          {type_display}
        </span>
      </div>

      {/* 정보 영역 */}
      <div className="card-content">
        <div className="card-header">
          <span className="sub-type">{sub_type}</span>
          <span className={`result-badge ${getResultClass()}`}>{result_display}</span>
        </div>

        <h3 className="card-title">{title}</h3>

        <div className="card-patient">
          <span className="patient-name">{patient_name || '-'}</span>
          <span className="patient-number">{patient_number}</span>
        </div>

        <div className="card-footer">
          <span className="date">{formatDate(completed_at)}</span>
          <span className="status">{status_display}</span>
        </div>
      </div>
    </div>
  );
}
