/**
 * 범용 문서 미리보기 컴포넌트
 * - 모든 PDF 보고서에서 공통으로 사용
 */
import type { ReactNode } from 'react';

// 기본 정보 항목
export interface InfoItem {
  label: string;
  value: string | number | undefined | null;
  colSpan?: number; // 2열 차지
}

// 결과 박스 항목
export interface ResultBoxItem {
  title: string;
  value: string | number;
  subText?: string;
  variant?: 'default' | 'warning' | 'danger';
}

// 테이블 섹션
export interface TableSection {
  type: 'table';
  title: string;
  columns: string[];
  rows: Array<Record<string, ReactNode>>;
  emptyText?: string;
}

// 결과 박스 섹션
export interface ResultBoxSection {
  type: 'result-boxes';
  title: string;
  items: ResultBoxItem[];
}

// 텍스트 섹션
export interface TextSection {
  type: 'text';
  title: string;
  content: string;
  variant?: 'default' | 'warning' | 'danger';
}

// 썸네일 섹션
export interface ThumbnailSection {
  type: 'thumbnails';
  title: string;
  items: Array<{ label: string; url: string }>;
}

// 커스텀 섹션
export interface CustomSection {
  type: 'custom';
  title?: string;
  render: ReactNode;
}

export type Section = TableSection | ResultBoxSection | TextSection | ThumbnailSection | CustomSection;

// 서명 정보
export interface SignatureInfo {
  label: string;
  name: string;
}

export interface DocumentPreviewProps {
  title: string;
  subtitle?: string;
  infoGrid?: InfoItem[];
  sections?: Section[];
  signature?: SignatureInfo;
  children?: ReactNode; // 추가 커스텀 컨텐츠
}

export default function DocumentPreview({
  title,
  subtitle,
  infoGrid,
  sections,
  signature,
  children,
}: DocumentPreviewProps) {
  const renderSection = (section: Section, index: number) => {
    switch (section.type) {
      case 'table':
        return (
          <section key={index} className="section">
            <h2>{section.title}</h2>
            {section.rows.length > 0 ? (
              <table className="data-table">
                <thead>
                  <tr>
                    {section.columns.map((col, i) => (
                      <th key={i}>{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {section.rows.map((row, rowIdx) => (
                    <tr key={rowIdx}>
                      {section.columns.map((col, colIdx) => (
                        <td key={colIdx}>{row[col] ?? '-'}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            ) : (
              <p style={{ color: '#6b7280' }}>{section.emptyText || '데이터가 없습니다.'}</p>
            )}
          </section>
        );

      case 'result-boxes':
        return (
          <section key={index} className="section">
            <h2>{section.title}</h2>
            {section.items.map((item, i) => (
              <div key={i} className={`result-box ${item.variant || ''}`}>
                <h3>{item.title}</h3>
                <p style={{ fontSize: '18px', fontWeight: 600 }}>{item.value}</p>
                {item.subText && (
                  <p style={{ fontSize: '13px', color: '#6b7280' }}>{item.subText}</p>
                )}
              </div>
            ))}
          </section>
        );

      case 'text':
        return (
          <section key={index} className="section">
            <h2>{section.title}</h2>
            <div className={`result-box ${section.variant || ''}`}>
              <p style={{ whiteSpace: 'pre-wrap', lineHeight: 1.6 }}>{section.content}</p>
            </div>
          </section>
        );

      case 'thumbnails':
        return (
          <section key={index} className="section">
            <h2>{section.title}</h2>
            <div className="thumbnail-grid">
              {section.items.map((item, i) => (
                <div key={i} className="thumbnail-item">
                  <img src={item.url} alt={item.label} />
                  <div className="label">{item.label}</div>
                </div>
              ))}
            </div>
          </section>
        );

      case 'custom':
        return (
          <section key={index} className="section">
            {section.title && <h2>{section.title}</h2>}
            {section.render}
          </section>
        );

      default:
        return null;
    }
  };

  return (
    <>
      {/* 헤더 */}
      <div className="doc-header">
        <h1>{title}</h1>
        {subtitle && <div className="doc-subtitle">{subtitle}</div>}
      </div>

      {/* 기본 정보 그리드 */}
      {infoGrid && infoGrid.length > 0 && (
        <section className="section">
          <h2>기본 정보</h2>
          <div className="info-grid">
            {infoGrid.map((item, i) => (
              <div
                key={i}
                className="info-item"
                style={item.colSpan === 2 ? { gridColumn: 'span 2' } : undefined}
              >
                <span className="info-label">{item.label}</span>
                <span className="info-value">{item.value ?? '-'}</span>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* 섹션들 */}
      {sections?.map((section, i) => renderSection(section, i))}

      {/* 커스텀 컨텐츠 */}
      {children}

      {/* 서명 영역 */}
      {signature && (
        <div className="signature-area">
          <div className="signature-box">
            <div className="signature-line" />
            <div className="signature-label">{signature.label}: {signature.name}</div>
          </div>
        </div>
      )}
    </>
  );
}

// ============================================
// 헬퍼 함수들 - 각 보고서 유형별 데이터 생성
// ============================================

/**
 * 날짜 포맷
 */
export const formatDate = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleDateString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  });
};

export const formatDateTime = (dateStr: string | null | undefined): string => {
  if (!dateStr) return '-';
  return new Date(dateStr).toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};

/**
 * 성별 표시
 */
export const getGenderDisplay = (gender: string): string => {
  return gender === 'M' ? '남' : gender === 'F' ? '여' : gender;
};

/**
 * 신뢰도 포맷
 */
export const formatConfidence = (confidence?: number): string => {
  if (confidence === undefined || confidence === null) return '-';
  return `${(confidence * 100).toFixed(1)}%`;
};

/**
 * Grade에 따른 variant 반환
 */
export const getGradeVariant = (grade?: string): 'default' | 'warning' | 'danger' => {
  if (!grade) return 'default';
  if (grade.includes('IV') || grade.includes('4')) return 'danger';
  if (grade.includes('III') || grade.includes('3')) return 'warning';
  return 'default';
};

/**
 * Risk에 따른 variant 반환
 */
export const getRiskVariant = (category?: string): 'default' | 'warning' | 'danger' => {
  if (!category) return 'default';
  const lower = category.toLowerCase();
  if (lower.includes('high')) return 'danger';
  if (lower.includes('medium') || lower.includes('intermediate')) return 'warning';
  return 'default';
};
