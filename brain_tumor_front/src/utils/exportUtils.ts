/**
 * PDF 및 Excel 내보내기 유틸리티
 *
 * 필요 패키지 설치:
 * npm install jspdf jspdf-autotable xlsx file-saver
 * npm install -D @types/file-saver
 *
 * 참고: 패키지가 설치되지 않은 경우에도 앱이 정상 동작하도록
 * 동적 import를 사용하며, 실패 시 사용자에게 안내합니다.
 */

import type { jsPDF } from 'jspdf';
import { getPdfWatermarkConfig, type PdfWatermarkConfig } from '@/services/pdfWatermark.api';

// ============================================
// PDF 워터마크 유틸리티
// ============================================

// 워터마크 설정 캐시
let cachedWatermarkConfig: PdfWatermarkConfig | null = null;
let cacheTimestamp: number = 0;
const CACHE_DURATION = 60000; // 1분

/**
 * 워터마크 설정 조회 (캐시 적용)
 */
const getWatermarkConfig = async (): Promise<PdfWatermarkConfig | null> => {
  const now = Date.now();
  if (cachedWatermarkConfig && (now - cacheTimestamp) < CACHE_DURATION) {
    return cachedWatermarkConfig;
  }

  try {
    cachedWatermarkConfig = await getPdfWatermarkConfig();
    cacheTimestamp = now;
    return cachedWatermarkConfig;
  } catch (error) {
    console.warn('워터마크 설정 조회 실패, 워터마크 없이 진행:', error);
    return null;
  }
};

/**
 * 워터마크 설정 캐시 무효화
 * 설정 변경 후 호출하여 다음 PDF 생성 시 새 설정을 사용하도록 함
 */
export const invalidateWatermarkCache = () => {
  cachedWatermarkConfig = null;
  cacheTimestamp = 0;
};

/**
 * 텍스트를 캔버스로 렌더링하여 이미지로 변환 (한글 지원)
 */
const renderTextToImage = async (
  text: string,
  fontSize: number,
  color: string,
  opacity: number,
  rotation: number
): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas context not available');

  // 폰트 설정
  const fontFamily = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
  ctx.font = `bold ${fontSize}px ${fontFamily}`;

  // 텍스트 크기 측정
  const metrics = ctx.measureText(text);
  const textWidth = metrics.width;
  const textHeight = fontSize;

  // 회전을 고려한 캔버스 크기 계산
  const radians = (Math.abs(rotation) * Math.PI) / 180;
  const canvasWidth = Math.ceil(textWidth * Math.cos(radians) + textHeight * Math.sin(radians)) + 20;
  const canvasHeight = Math.ceil(textWidth * Math.sin(radians) + textHeight * Math.cos(radians)) + 20;

  canvas.width = canvasWidth * 2; // 고해상도
  canvas.height = canvasHeight * 2;

  // 다시 폰트 설정 (캔버스 크기 변경 후 리셋됨)
  ctx.font = `bold ${fontSize * 2}px ${fontFamily}`;
  ctx.fillStyle = color;
  ctx.globalAlpha = opacity;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';

  // 회전 적용
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillText(text, 0, 0);

  return canvas.toDataURL('image/png');
};

/**
 * PDF에 워터마크 적용 (이미지/텍스트 모두 지원, 한글 지원)
 */
const applyWatermark = async (pdf: jsPDF, config: PdfWatermarkConfig): Promise<void> => {
  if (!config.enabled) return;

  // type 필드가 없으면 text로 기본 설정 (하위 호환성)
  const watermarkType = config.type || 'text';

  if (watermarkType === 'text' && !config.text) return;
  if (watermarkType === 'image' && !config.imageUrl) return;

  const pageCount = pdf.getNumberOfPages();
  const pageWidth = pdf.internal.pageSize.getWidth();
  const pageHeight = pdf.internal.pageSize.getHeight();

  // 이미지 워터마크 또는 텍스트를 이미지로 변환
  let watermarkImage: string;
  let imgWidth: number;
  let imgHeight: number;

  if (watermarkType === 'image' && config.imageUrl) {
    watermarkImage = config.imageUrl;
    imgWidth = config.imageWidth || 50;
    imgHeight = config.imageHeight || 50;

    // 이미지 크기가 페이지보다 클 경우 비율 유지하며 축소
    const maxWidth = pageWidth * 0.9;  // 페이지 너비의 90%
    const maxHeight = pageHeight * 0.9; // 페이지 높이의 90%

    if (imgWidth > maxWidth || imgHeight > maxHeight) {
      const widthRatio = maxWidth / imgWidth;
      const heightRatio = maxHeight / imgHeight;
      const scale = Math.min(widthRatio, heightRatio);
      imgWidth = imgWidth * scale;
      imgHeight = imgHeight * scale;
    }
  } else {
    // 텍스트를 이미지로 변환 (한글 지원)
    watermarkImage = await renderTextToImage(
      config.text,
      config.fontSize,
      config.color,
      config.opacity,
      config.rotation
    );
    // 텍스트 이미지 크기 계산 (대략적)
    imgWidth = config.fontSize * config.text.length * 0.6;
    imgHeight = config.fontSize * 1.2;
  }

  for (let i = 1; i <= pageCount; i++) {
    pdf.setPage(i);

    // GState로 투명도 설정 (이미지 워터마크용)
    if (watermarkType === 'image') {
      // @ts-ignore
      if (pdf.GState) {
        // @ts-ignore
        const gState = new pdf.GState({ opacity: config.opacity });
        // @ts-ignore
        pdf.setGState(gState);
      }
    }

    if (config.repeatPattern) {
      // 패턴 반복
      const spacingX = imgWidth * 1.5;
      const spacingY = imgHeight * 2;
      for (let x = 0; x < pageWidth + spacingX; x += spacingX) {
        for (let y = 0; y < pageHeight + spacingY; y += spacingY) {
          try {
            pdf.addImage(watermarkImage, 'PNG', x - imgWidth / 2, y - imgHeight / 2, imgWidth, imgHeight);
          } catch {
            // 이미지 추가 실패 시 무시
          }
        }
      }
    } else {
      // 단일 워터마크
      let x: number, y: number;

      switch (config.position) {
        case 'center':
        case 'diagonal':
          x = (pageWidth - imgWidth) / 2;
          y = (pageHeight - imgHeight) / 2;
          break;
        case 'top-right':
          x = pageWidth - imgWidth - 10;
          y = 10;
          break;
        case 'bottom-right':
          x = pageWidth - imgWidth - 10;
          y = pageHeight - imgHeight - 10;
          break;
        default:
          x = (pageWidth - imgWidth) / 2;
          y = (pageHeight - imgHeight) / 2;
      }

      try {
        pdf.addImage(watermarkImage, 'PNG', x, y, imgWidth, imgHeight);
      } catch (e) {
        console.warn('워터마크 이미지 추가 실패:', e);
      }
    }

    // 투명도 초기화
    // @ts-ignore
    if (pdf.GState) {
      // @ts-ignore
      pdf.setGState(new pdf.GState({ opacity: 1 }));
    }
  }
};

// ============================================
// PDF 출력 유틸리티
// ============================================

// 패키지 설치 여부 확인용 플래그 (향후 사용 예정)
// let jspdfAvailable: boolean | null = null;
// let xlsxAvailable: boolean | null = null;

// jspdf 사용 가능 여부 확인 (향후 사용 예정)
// const _checkJspdfAvailable = async (): Promise<boolean> => {
//   if (jspdfAvailable !== null) return jspdfAvailable;
//   try {
//     await import('jspdf');
//     jspdfAvailable = true;
//     return true;
//   } catch {
//     jspdfAvailable = false;
//     return false;
//   }
// };

// xlsx 사용 가능 여부 확인 (향후 사용 예정)
// const _checkXlsxAvailable = async (): Promise<boolean> => {
//   if (xlsxAvailable !== null) return xlsxAvailable;
//   try {
//     await import('xlsx');
//     xlsxAvailable = true;
//     return true;
//   } catch {
//     xlsxAvailable = false;
//     return false;
//   }
// };

// 향후 사용 예정
// interface PDFReportData {
//   title: string;
//   subtitle?: string;
//   patientInfo: {
//     name: string;
//     patientNumber: string;
//     birthDate?: string;
//     gender?: string;
//   };
//   sections: {
//     title: string;
//     content: string | string[];
//   }[];
//   footer?: {
//     author?: string;
//     date?: string;
//     hospital?: string;
//   };
// }

/**
 * RIS 판독 리포트 PDF 생성
 * - html2canvas를 사용하여 한글 폰트 지원
 */
export const generateRISReportPDF = async (data: {
  ocsId: string;
  patientName: string;
  patientNumber: string;
  jobType: string;
  findings: string;
  impression: string;
  recommendation?: string;
  tumorDetected: boolean | null;
  doctorName: string;
  workerName: string;
  createdAt: string;
  confirmedAt?: string;
  // 썸네일 이미지 (DICOM 미리보기)
  thumbnails?: Array<{
    channel: string;  // T1, T1C, T2, FLAIR 등
    dataUrl: string;  // base64 이미지 또는 URL
    description?: string;
  }>;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    // 동적 import (패키지 설치 필요: npm install jspdf html2canvas)
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    // 뇌종양 판정 상태
    const tumorStatus = data.tumorDetected === true ? '종양 있음 (+)' :
                        data.tumorDetected === false ? '종양 없음 (-)' : '미판정';
    const tumorClass = data.tumorDetected === true ? 'positive' :
                       data.tumorDetected === false ? 'negative' : 'undetermined';

    // HTML 템플릿 생성
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold;">영상 판독 보고서</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">OCS ID: ${data.ocsId}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">환자 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 200px;"><span style="color: #666;">환자명:</span> <strong>${data.patientName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">환자번호:</span> <strong>${data.patientNumber}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">검사 유형:</span> <strong>${data.jobType}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">처방 의사:</span> <strong>${data.doctorName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">판독자:</span> <strong>${data.workerName}</strong></div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">판정 결과</h2>
        <div style="padding: 12px 16px; border-radius: 8px; display: inline-block;
          ${tumorClass === 'positive' ? 'background: #ffebee; border: 2px solid #e53935;' :
            tumorClass === 'negative' ? 'background: #e8f5e9; border: 2px solid #43a047;' :
            'background: #f5f5f5; border: 2px solid #757575;'}">
          <span style="font-size: 18px; font-weight: bold;
            ${tumorClass === 'positive' ? 'color: #c62828;' :
              tumorClass === 'negative' ? 'color: #2e7d32;' : 'color: #424242;'}">
            뇌종양 판정: ${tumorStatus}
          </span>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">판독 소견 (Findings)</h2>
        <div style="padding: 12px; background: #fafafa; border-left: 3px solid #1976d2; border-radius: 4px; white-space: pre-wrap;">
          ${data.findings || '-'}
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">판독 결론 (Impression)</h2>
        <div style="padding: 12px; background: #fafafa; border-left: 3px solid #388e3c; border-radius: 4px; white-space: pre-wrap;">
          ${data.impression || '-'}
        </div>
      </div>

      ${data.recommendation ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">권고 사항 (Recommendation)</h2>
        <div style="padding: 12px; background: #fff8e1; border-left: 3px solid #f57c00; border-radius: 4px; white-space: pre-wrap;">
          ${data.recommendation}
        </div>
      </div>
      ` : ''}

      ${data.thumbnails && data.thumbnails.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">영상 이미지</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          ${data.thumbnails.map(thumb => `
            <div style="text-align: center;">
              <img src="${thumb.dataUrl}" alt="${thumb.channel}" style="width: 160px; height: 160px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; background: #000;" crossorigin="anonymous" />
              <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 500; color: #374151;">${thumb.channel}</p>
              ${thumb.description ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">${thumb.description}</p>` : ''}
            </div>
          `).join('')}
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <p style="margin: 4px 0;">처방일시: ${data.createdAt}</p>
            ${data.confirmedAt ? `<p style="margin: 4px 0;">확정일시: ${data.confirmedAt}</p>` : ''}
          </div>
          <div style="text-align: right;">
            <p style="margin: 4px 0; font-weight: bold;">Brain Tumor CDSS</p>
            <p style="margin: 4px 0;">발급일시: ${new Date().toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // HTML을 Canvas로 변환
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    document.body.removeChild(container);

    // Canvas를 PDF로 변환
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20; // 좌우 여백 10mm씩
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 페이지 높이보다 크면 여러 페이지로 분할
    let heightLeft = imgHeight;
    let position = 10; // 상단 여백

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    // PDF 다운로드
    const filename = `RIS_Report_${data.ocsId}_${data.patientNumber}.pdf`;
    console.log('[exportUtils] RIS PDF 저장:', filename);
    pdf.save(filename);

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('[exportUtils] RIS PDF 생성 실패:', errorMsg, error);
    throw new Error(`RIS PDF 생성 실패: ${errorMsg}`);
  }
};

/**
 * LIS 검사 결과 PDF 생성
 * - html2canvas를 사용하여 한글 폰트 지원
 */
export const generateLISReportPDF = async (data: {
  ocsId: string;
  patientName: string;
  patientNumber: string;
  jobType: string;
  results: Array<{
    itemName: string;
    value: string;
    unit: string;
    refRange: string;
    flag: string;
  }>;
  interpretation?: string;
  doctorName: string;
  workerName: string;
  createdAt: string;
  confirmedAt?: string;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    // 판정 색상 헬퍼
    const getFlagStyle = (flag: string) => {
      if (flag === 'critical') return 'color: #c62828; background: #ffebee;';
      if (flag === 'abnormal') return 'color: #e65100; background: #fff3e0;';
      return 'color: #2e7d32; background: #e8f5e9;';
    };

    const getFlagText = (flag: string) => {
      if (flag === 'critical') return 'Critical';
      if (flag === 'abnormal') return '이상';
      return '정상';
    };

    // HTML 템플릿 생성
    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #333; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold;">검사 결과 보고서</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">OCS ID: ${data.ocsId}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">환자 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 200px;"><span style="color: #666;">환자명:</span> <strong>${data.patientName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">환자번호:</span> <strong>${data.patientNumber}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">검사 유형:</span> <strong>${data.jobType}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">처방 의사:</span> <strong>${data.doctorName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">검사자:</span> <strong>${data.workerName}</strong></div>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">검사 결과</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #5b6fd6; color: white;">
              <th style="padding: 10px; text-align: left; border: 1px solid #ddd;">검사 항목</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">결과값</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">단위</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">참고 범위</th>
              <th style="padding: 10px; text-align: center; border: 1px solid #ddd;">판정</th>
            </tr>
          </thead>
          <tbody>
            ${data.results.map((r, i) => `
              <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                <td style="padding: 10px; border: 1px solid #ddd;">${r.itemName}</td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd; font-weight: 500;">${r.value}</td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd; color: #666;">${r.unit}</td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd; color: #666;">${r.refRange}</td>
                <td style="padding: 10px; text-align: center; border: 1px solid #ddd;">
                  <span style="padding: 4px 8px; border-radius: 4px; font-weight: 600; ${getFlagStyle(r.flag)}">
                    ${getFlagText(r.flag)}
                  </span>
                </td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>

      ${data.interpretation ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">결과 해석</h2>
        <div style="padding: 12px; background: #f0f4ff; border-left: 3px solid #5b6fd6; border-radius: 4px; white-space: pre-wrap;">
          ${data.interpretation}
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            <p style="margin: 4px 0;">처방일시: ${data.createdAt}</p>
            ${data.confirmedAt ? `<p style="margin: 4px 0;">확정일시: ${data.confirmedAt}</p>` : ''}
          </div>
          <div style="text-align: right;">
            <p style="margin: 4px 0; font-weight: bold;">Brain Tumor CDSS</p>
            <p style="margin: 4px 0;">발급일시: ${new Date().toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);

    // HTML을 Canvas로 변환
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff',
    });

    document.body.removeChild(container);

    // Canvas를 PDF로 변환
    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20; // 좌우 여백 10mm씩
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    // 페이지 높이보다 크면 여러 페이지로 분할
    let heightLeft = imgHeight;
    let position = 10; // 상단 여백

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    // PDF 다운로드
    const filename = `LIS_Report_${data.ocsId}_${data.patientNumber}.pdf`;
    console.log('[exportUtils] LIS PDF 저장:', filename);
    pdf.save(filename);

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('[exportUtils] LIS PDF 생성 실패:', errorMsg, error);
    throw new Error(`LIS PDF 생성 실패: ${errorMsg}`);
  }
};

/**
 * AI M1 (MRI 분석) 보고서 PDF 생성
 */
export const generateM1ReportPDF = async (data: {
  jobId: string;
  patientName: string;
  patientNumber: string;
  createdAt: string;
  completedAt?: string;
  grade?: {
    predicted_class: string;
    probability: number;
    probabilities?: Record<string, number>;
  };
  idh?: {
    predicted_class: string;
    mutant_probability?: number;
  };
  mgmt?: {
    predicted_class: string;
    methylated_probability?: number;
  };
  survival?: {
    risk_score: number;
    risk_category: string;
  };
  os_days?: {
    predicted_days: number;
    predicted_months: number;
  };
  processing_time_ms?: number;
  // MRI 썸네일 이미지 (T1, T1C, T2, FLAIR)
  mri_thumbnails?: Array<{
    channel: string;
    url: string;
    description?: string;
  }>;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    // Grade 색상 결정
    const gradeColor = data.grade?.predicted_class === 'HGG' ? '#ef4444' : '#10b981';
    const gradeLabel = data.grade?.predicted_class === 'HGG' ? '고등급 (HGG)' : '저등급 (LGG)';

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #ef4444; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold; color: #ef4444;">AI MRI 분석 보고서 (M1)</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">Job ID: ${data.jobId}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">환자 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 200px;"><span style="color: #666;">환자명:</span> <strong>${data.patientName || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">환자번호:</span> <strong>${data.patientNumber || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">분석 요청일:</span> <strong>${data.createdAt}</strong></div>
          ${data.completedAt ? `<div style="min-width: 200px;"><span style="color: #666;">분석 완료일:</span> <strong>${data.completedAt}</strong></div>` : ''}
        </div>
      </div>

      ${data.grade ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">뇌종양 등급 예측</h2>
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="padding: 16px 24px; background: ${data.grade.predicted_class === 'HGG' ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${gradeColor}; border-radius: 8px;">
            <span style="font-size: 20px; font-weight: bold; color: ${gradeColor};">${gradeLabel}</span>
          </div>
          <div>
            <p style="margin: 0; font-size: 14px; color: #666;">확률: <strong>${(data.grade.probability * 100).toFixed(1)}%</strong></p>
          </div>
        </div>
      </div>
      ` : ''}

      ${data.idh || data.mgmt ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">분자 표지자 예측</h2>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          ${data.idh ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">IDH 돌연변이</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${data.idh.predicted_class === 'Mutant' ? '#f59e0b' : '#6b7280'};">
              ${data.idh.predicted_class === 'Mutant' ? '변이형 (Mutant)' : '야생형 (Wild-type)'}
            </p>
            ${data.idh.mutant_probability !== undefined ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">확률: ${(data.idh.mutant_probability * 100).toFixed(1)}%</p>` : ''}
          </div>
          ` : ''}
          ${data.mgmt ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">MGMT 메틸화</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${data.mgmt.predicted_class === 'Methylated' ? '#10b981' : '#6b7280'};">
              ${data.mgmt.predicted_class === 'Methylated' ? '메틸화 (Methylated)' : '비메틸화 (Unmethylated)'}
            </p>
            ${data.mgmt.methylated_probability !== undefined ? `<p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">확률: ${(data.mgmt.methylated_probability * 100).toFixed(1)}%</p>` : ''}
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${data.survival || data.os_days ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">생존 예측</h2>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          ${data.survival ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">위험도</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${data.survival.risk_category === 'High' ? '#ef4444' : data.survival.risk_category === 'Medium' ? '#f59e0b' : '#10b981'};">
              ${data.survival.risk_category === 'High' ? '고위험' : data.survival.risk_category === 'Medium' ? '중위험' : '저위험'}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">위험 점수: ${data.survival.risk_score.toFixed(2)}</p>
          </div>
          ` : ''}
          ${data.os_days ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">예상 생존 기간</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #3b82f6;">
              ${data.os_days.predicted_months.toFixed(1)}개월
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">(약 ${data.os_days.predicted_days}일)</p>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${data.mri_thumbnails && data.mri_thumbnails.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">MRI 이미지</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 12px; justify-content: center;">
          ${data.mri_thumbnails.map(thumb => {
            const channelColors: Record<string, string> = {
              T1: '#3b82f6',
              T1C: '#ef4444',
              T2: '#10b981',
              FLAIR: '#f59e0b',
            };
            const color = channelColors[thumb.channel] || '#6b7280';
            return `
            <div style="text-align: center;">
              <img src="${thumb.url}" alt="${thumb.channel}" style="width: 160px; height: 160px; object-fit: contain; border: 1px solid #e5e7eb; border-radius: 4px; background: #000;" crossorigin="anonymous" />
              <p style="margin: 6px 0 0 0; font-size: 12px; font-weight: 600; color: ${color};">${thumb.channel}</p>
              ${thumb.description ? `<p style="margin: 2px 0 0 0; font-size: 11px; color: #6b7280;">${thumb.description}</p>` : ''}
            </div>
          `;
          }).join('')}
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            ${data.processing_time_ms ? `<p style="margin: 4px 0;">처리 시간: ${(data.processing_time_ms / 1000).toFixed(2)}초</p>` : ''}
            <p style="margin: 4px 0;">모델: M1-v2.1.0</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 4px 0; font-weight: bold;">Brain Tumor CDSS - AI Analysis</p>
            <p style="margin: 4px 0;">발급일시: ${new Date().toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff', allowTaint: true });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    const filename = `M1_Report_${data.jobId}_${data.patientNumber || 'unknown'}.pdf`;
    console.log('[exportUtils] M1 PDF 저장:', filename);
    pdf.save(filename);

  } catch (error: any) {
    const errorMsg = error?.message || String(error);
    console.error('[exportUtils] M1 PDF 생성 실패:', errorMsg, error);
    throw new Error(`M1 PDF 생성 실패: ${errorMsg}`);
  }
};

/**
 * AI MG (유전자 분석) 보고서 PDF 생성
 */
export const generateMGReportPDF = async (data: {
  jobId: string;
  patientName: string;
  patientNumber: string;
  createdAt: string;
  completedAt?: string;
  grade?: {
    predicted_class: string;
    probability: number;
  };
  survival_risk?: {
    risk_score: number;
    risk_category?: string;
  };
  survival_time?: {
    predicted_days: number;
    predicted_months: number;
  };
  recurrence?: {
    predicted_class: string;
    probability: number;
  };
  tmz_response?: {
    predicted_class: string;
    probability: number;
  };
  top_genes?: Array<{
    rank?: number;
    gene: string;
    attention_score?: number;
    expression_zscore?: number;
    importance?: number;
  }>;
  processing_time_ms?: number;
  input_genes_count?: number;
  risk_group?: string;
  survival_months?: number;
  confidence?: number;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    // Top genes 테이블 생성
    const topGenesHtml = data.top_genes?.slice(0, 10).map((g, idx) => `
      <tr>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${g.rank ?? idx + 1}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; font-weight: 500;">${g.gene}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee;">${(g.attention_score ?? g.importance ?? 0).toFixed(4)}</td>
        <td style="padding: 8px; border-bottom: 1px solid #eee; color: ${(g.expression_zscore ?? 0) > 0 ? '#10b981' : '#ef4444'};">${(g.expression_zscore ?? 0) > 0 ? '+' : ''}${(g.expression_zscore ?? 0).toFixed(2)}</td>
      </tr>
    `).join('') || '';

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #10b981; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold; color: #10b981;">AI 유전자 분석 보고서 (MG)</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">Job ID: ${data.jobId}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">환자 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 200px;"><span style="color: #666;">환자명:</span> <strong>${data.patientName || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">환자번호:</span> <strong>${data.patientNumber || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">분석 요청일:</span> <strong>${data.createdAt}</strong></div>
          ${data.input_genes_count ? `<div style="min-width: 200px;"><span style="color: #666;">입력 유전자 수:</span> <strong>${data.input_genes_count.toLocaleString()}개</strong></div>` : ''}
        </div>
      </div>

      ${data.grade ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">종양 등급 예측</h2>
        <div style="padding: 16px 24px; background: ${data.grade.predicted_class === 'HGG' ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${data.grade.predicted_class === 'HGG' ? '#ef4444' : '#10b981'}; border-radius: 8px; display: inline-block;">
          <span style="font-size: 20px; font-weight: bold; color: ${data.grade.predicted_class === 'HGG' ? '#ef4444' : '#10b981'};">
            ${data.grade.predicted_class === 'HGG' ? '고등급 (HGG)' : '저등급 (LGG)'}
          </span>
          <span style="margin-left: 16px; color: #666;">확률: ${(data.grade.probability * 100).toFixed(1)}%</span>
        </div>
      </div>
      ` : ''}

      ${data.survival_risk || data.survival_time ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">생존 예측</h2>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          ${data.survival_risk ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">위험도</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold;">위험 점수: ${data.survival_risk.risk_score.toFixed(2)}</p>
            ${data.survival_risk.risk_category ? `<p style="margin: 4px 0 0 0; color: ${data.survival_risk.risk_category === 'High' ? '#ef4444' : '#10b981'};">${data.survival_risk.risk_category === 'High' ? '고위험' : '저위험'}</p>` : ''}
          </div>
          ` : ''}
          ${data.survival_time ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">예상 생존 기간</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: #3b82f6;">${data.survival_time.predicted_months.toFixed(1)}개월</p>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${data.recurrence || data.tmz_response ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">치료 반응 예측</h2>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          ${data.recurrence ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">재발 예측</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${data.recurrence.predicted_class === 'Recurrence' ? '#ef4444' : '#10b981'};">
              ${data.recurrence.predicted_class === 'Recurrence' ? '재발 예측' : '비재발 예측'}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">확률: ${(data.recurrence.probability * 100).toFixed(1)}%</p>
          </div>
          ` : ''}
          ${data.tmz_response ? `
          <div style="flex: 1; min-width: 200px; padding: 16px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">TMZ 반응 예측</h4>
            <p style="margin: 0; font-size: 18px; font-weight: bold; color: ${data.tmz_response.predicted_class === 'Responder' ? '#10b981' : '#f59e0b'};">
              ${data.tmz_response.predicted_class === 'Responder' ? '반응자' : '비반응자'}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">확률: ${(data.tmz_response.probability * 100).toFixed(1)}%</p>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${data.top_genes && data.top_genes.length > 0 ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">주요 유전자 (Top 10)</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 13px;">
          <thead>
            <tr style="background: #f3f4f6;">
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">순위</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">유전자</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Attention</th>
              <th style="padding: 10px; text-align: left; border-bottom: 2px solid #ddd;">Z-Score</th>
            </tr>
          </thead>
          <tbody>
            ${topGenesHtml}
          </tbody>
        </table>
      </div>
      ` : ''}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            ${data.processing_time_ms ? `<p style="margin: 4px 0;">처리 시간: ${(data.processing_time_ms / 1000).toFixed(2)}초</p>` : ''}
            <p style="margin: 4px 0;">모델: MG-v1.0.0</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 4px 0; font-weight: bold;">Brain Tumor CDSS - AI Analysis</p>
            <p style="margin: 4px 0;">발급일시: ${new Date().toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    pdf.save(`MG_Report_${data.jobId}_${data.patientNumber || 'unknown'}.pdf`);

  } catch (error) {
    console.error('PDF 생성 실패:', error);
    alert('PDF 생성에 실패했습니다. jspdf, html2canvas 패키지가 설치되어 있는지 확인하세요.');
    throw error;
  }
};

/**
 * AI MM (멀티모달 분석) 보고서 PDF 생성
 */
export const generateMMReportPDF = async (data: {
  jobId: string;
  patientName: string;
  patientNumber: string;
  createdAt: string;
  completedAt?: string;
  modalities: {
    mri: boolean;
    gene: boolean;
    protein: boolean;
  };
  integrated_prediction?: {
    grade: {
      predicted_class: string;
      probability: number;
    };
    survival_risk?: {
      risk_score: number;
      risk_category?: string;
    };
    survival_time?: {
      predicted_days: number;
      predicted_months: number;
    };
  };
  modality_contributions?: {
    mri?: { weight: number; confidence: number };
    gene?: { weight: number; confidence: number };
    protein?: { weight: number; confidence: number };
  };
  processing_time_ms?: number;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    const modalityList = [
      data.modalities.mri && 'MRI',
      data.modalities.gene && 'Gene',
      data.modalities.protein && 'Protein'
    ].filter(Boolean).join(', ');

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #6366f1; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold; color: #6366f1;">AI 멀티모달 분석 보고서 (MM)</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">Job ID: ${data.jobId}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">환자 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 200px;"><span style="color: #666;">환자명:</span> <strong>${data.patientName || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">환자번호:</span> <strong>${data.patientNumber || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">분석 요청일:</span> <strong>${data.createdAt}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">사용 모달리티:</span> <strong>${modalityList}</strong></div>
        </div>
      </div>

      ${data.integrated_prediction ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">통합 예측 결과</h2>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          <div style="flex: 1; min-width: 200px; padding: 20px; background: ${data.integrated_prediction.grade.predicted_class === 'HGG' ? '#fef2f2' : '#f0fdf4'}; border: 2px solid ${data.integrated_prediction.grade.predicted_class === 'HGG' ? '#ef4444' : '#10b981'}; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">종양 등급</h4>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: ${data.integrated_prediction.grade.predicted_class === 'HGG' ? '#ef4444' : '#10b981'};">
              ${data.integrated_prediction.grade.predicted_class === 'HGG' ? '고등급 (HGG)' : '저등급 (LGG)'}
            </p>
            <p style="margin: 4px 0 0 0; font-size: 14px; color: #666;">확률: ${(data.integrated_prediction.grade.probability * 100).toFixed(1)}%</p>
          </div>
          ${data.integrated_prediction.survival_risk ? `
          <div style="flex: 1; min-width: 200px; padding: 20px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">생존 위험도</h4>
            <p style="margin: 0; font-size: 24px; font-weight: bold;">점수: ${data.integrated_prediction.survival_risk.risk_score.toFixed(2)}</p>
            ${data.integrated_prediction.survival_risk.risk_category ? `<p style="margin: 4px 0 0 0; font-size: 14px; color: ${data.integrated_prediction.survival_risk.risk_category === 'High' ? '#ef4444' : '#10b981'};">${data.integrated_prediction.survival_risk.risk_category === 'High' ? '고위험' : '저위험'}</p>` : ''}
          </div>
          ` : ''}
          ${data.integrated_prediction.survival_time ? `
          <div style="flex: 1; min-width: 200px; padding: 20px; background: #fafafa; border-radius: 8px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #666;">예상 생존 기간</h4>
            <p style="margin: 0; font-size: 24px; font-weight: bold; color: #3b82f6;">${data.integrated_prediction.survival_time.predicted_months.toFixed(1)}개월</p>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      ${data.modality_contributions ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">모달리티 기여도</h2>
        <div style="display: flex; gap: 24px; flex-wrap: wrap;">
          ${data.modality_contributions.mri ? `
          <div style="flex: 1; min-width: 150px; padding: 16px; background: #eff6ff; border-left: 4px solid #3b82f6; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #3b82f6;">MRI</h4>
            <p style="margin: 0;">가중치: <strong>${(data.modality_contributions.mri.weight * 100).toFixed(1)}%</strong></p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">신뢰도: ${(data.modality_contributions.mri.confidence * 100).toFixed(1)}%</p>
          </div>
          ` : ''}
          ${data.modality_contributions.gene ? `
          <div style="flex: 1; min-width: 150px; padding: 16px; background: #f0fdf4; border-left: 4px solid #10b981; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #10b981;">Gene</h4>
            <p style="margin: 0;">가중치: <strong>${(data.modality_contributions.gene.weight * 100).toFixed(1)}%</strong></p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">신뢰도: ${(data.modality_contributions.gene.confidence * 100).toFixed(1)}%</p>
          </div>
          ` : ''}
          ${data.modality_contributions.protein ? `
          <div style="flex: 1; min-width: 150px; padding: 16px; background: #faf5ff; border-left: 4px solid #8b5cf6; border-radius: 4px;">
            <h4 style="margin: 0 0 8px 0; font-size: 14px; color: #8b5cf6;">Protein</h4>
            <p style="margin: 0;">가중치: <strong>${(data.modality_contributions.protein.weight * 100).toFixed(1)}%</strong></p>
            <p style="margin: 4px 0 0 0; font-size: 12px; color: #666;">신뢰도: ${(data.modality_contributions.protein.confidence * 100).toFixed(1)}%</p>
          </div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666;">
        <div style="display: flex; justify-content: space-between;">
          <div>
            ${data.processing_time_ms ? `<p style="margin: 4px 0;">처리 시간: ${(data.processing_time_ms / 1000).toFixed(2)}초</p>` : ''}
            <p style="margin: 4px 0;">모델: MM-v1.0.0</p>
          </div>
          <div style="text-align: right;">
            <p style="margin: 4px 0; font-weight: bold;">Brain Tumor CDSS - AI Analysis</p>
            <p style="margin: 4px 0;">발급일시: ${new Date().toLocaleString('ko-KR')}</p>
          </div>
        </div>
      </div>
    `;

    document.body.appendChild(container);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    pdf.save(`MM_Report_${data.jobId}_${data.patientNumber || 'unknown'}.pdf`);

  } catch (error) {
    console.error('PDF 생성 실패:', error);
    alert('PDF 생성에 실패했습니다. jspdf, html2canvas 패키지가 설치되어 있는지 확인하세요.');
    throw error;
  }
};

/**
 * Final Report PDF 생성
 */
export const generateFinalReportPDF = async (data: {
  reportId: string;
  patientName: string;
  patientNumber: string;
  reportType: string;
  status: string;
  diagnosisDate?: string;
  primaryDiagnosis?: string;
  secondaryDiagnoses?: string[];
  clinicalFindings?: string;
  treatmentSummary?: string;
  treatmentPlan?: string;
  aiAnalysisSummary?: string;
  doctorOpinion?: string;
  recommendations?: string;
  prognosis?: string;
  createdByName?: string;
  createdAt: string;
  reviewedByName?: string;
  reviewedAt?: string;
  approvedByName?: string;
  approvedAt?: string;
  finalizedAt?: string;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    const statusColor = data.status === 'FINALIZED' ? '#10b981' : data.status === 'APPROVED' ? '#3b82f6' : '#f59e0b';
    const statusLabel = data.status === 'FINALIZED' ? '최종 확정' : data.status === 'APPROVED' ? '승인됨' : data.status === 'PENDING_REVIEW' ? '검토 대기' : '작성 중';

    const secondaryDiagList = data.secondaryDiagnoses?.map(d => `<li style="margin: 4px 0;">${d}</li>`).join('') || '';

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #8b5cf6; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold; color: #8b5cf6;">최종 보고서</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">보고서 ID: ${data.reportId}</p>
        <div style="margin-top: 12px; display: inline-block; padding: 6px 16px; background: ${statusColor}20; border: 1px solid ${statusColor}; border-radius: 20px;">
          <span style="color: ${statusColor}; font-weight: 500;">${statusLabel}</span>
        </div>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">기본 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          <div style="min-width: 200px;"><span style="color: #666;">환자명:</span> <strong>${data.patientName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">환자번호:</span> <strong>${data.patientNumber}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">보고서 유형:</span> <strong>${data.reportType}</strong></div>
          ${data.diagnosisDate ? `<div style="min-width: 200px;"><span style="color: #666;">진단일:</span> <strong>${data.diagnosisDate}</strong></div>` : ''}
          <div style="min-width: 200px;"><span style="color: #666;">작성자:</span> <strong>${data.createdByName || '-'}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">작성일:</span> <strong>${data.createdAt}</strong></div>
        </div>
      </div>

      ${data.primaryDiagnosis || data.secondaryDiagnoses?.length ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">진단 정보</h2>
        ${data.primaryDiagnosis ? `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">주 진단명</h4>
          <p style="margin: 0; padding: 12px; background: #fafafa; border-left: 3px solid #8b5cf6; border-radius: 4px;">${data.primaryDiagnosis}</p>
        </div>
        ` : ''}
        ${data.secondaryDiagnoses?.length ? `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">부 진단명</h4>
          <ul style="margin: 0; padding-left: 20px;">${secondaryDiagList}</ul>
        </div>
        ` : ''}
        ${data.clinicalFindings ? `
        <div>
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">임상 소견</h4>
          <p style="margin: 0; padding: 12px; background: #fafafa; border-radius: 4px; white-space: pre-wrap;">${data.clinicalFindings}</p>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${data.treatmentSummary || data.treatmentPlan ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">치료 정보</h2>
        ${data.treatmentSummary ? `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">치료 요약</h4>
          <p style="margin: 0; padding: 12px; background: #fafafa; border-radius: 4px; white-space: pre-wrap;">${data.treatmentSummary}</p>
        </div>
        ` : ''}
        ${data.treatmentPlan ? `
        <div>
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">향후 치료 계획</h4>
          <p style="margin: 0; padding: 12px; background: #fafafa; border-radius: 4px; white-space: pre-wrap;">${data.treatmentPlan}</p>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${data.aiAnalysisSummary || data.doctorOpinion ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">AI 분석 및 의사 소견</h2>
        ${data.aiAnalysisSummary ? `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">AI 분석 요약</h4>
          <p style="margin: 0; padding: 12px; background: #eff6ff; border-left: 3px solid #3b82f6; border-radius: 4px; white-space: pre-wrap;">${data.aiAnalysisSummary}</p>
        </div>
        ` : ''}
        ${data.doctorOpinion ? `
        <div>
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">의사 소견</h4>
          <p style="margin: 0; padding: 12px; background: #fafafa; border-radius: 4px; white-space: pre-wrap;">${data.doctorOpinion}</p>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${data.recommendations || data.prognosis ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">권고 사항 및 예후</h2>
        ${data.recommendations ? `
        <div style="margin-bottom: 12px;">
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">권고 사항</h4>
          <p style="margin: 0; padding: 12px; background: #fff8e1; border-left: 3px solid #f59e0b; border-radius: 4px; white-space: pre-wrap;">${data.recommendations}</p>
        </div>
        ` : ''}
        ${data.prognosis ? `
        <div>
          <h4 style="margin: 0 0 4px 0; font-size: 14px; color: #666;">예후</h4>
          <p style="margin: 0; padding: 12px; background: #fafafa; border-radius: 4px; white-space: pre-wrap;">${data.prognosis}</p>
        </div>
        ` : ''}
      </div>
      ` : ''}

      ${data.reviewedByName || data.approvedByName ? `
      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">승인 정보</h2>
        <div style="display: flex; flex-wrap: wrap; gap: 16px;">
          ${data.reviewedByName ? `
          <div style="min-width: 200px;"><span style="color: #666;">검토자:</span> <strong>${data.reviewedByName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">검토일:</span> <strong>${data.reviewedAt || '-'}</strong></div>
          ` : ''}
          ${data.approvedByName ? `
          <div style="min-width: 200px;"><span style="color: #666;">승인자:</span> <strong>${data.approvedByName}</strong></div>
          <div style="min-width: 200px;"><span style="color: #666;">승인일:</span> <strong>${data.approvedAt || '-'}</strong></div>
          ` : ''}
          ${data.finalizedAt ? `
          <div style="min-width: 200px;"><span style="color: #666;">확정일:</span> <strong>${data.finalizedAt}</strong></div>
          ` : ''}
        </div>
      </div>
      ` : ''}

      <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #ddd; font-size: 12px; color: #666; text-align: right;">
        <p style="margin: 4px 0; font-weight: bold;">Brain Tumor CDSS</p>
        <p style="margin: 4px 0;">발급일시: ${new Date().toLocaleString('ko-KR')}</p>
      </div>
    `;

    document.body.appendChild(container);
    const canvas = await html2canvas(container, { scale: 2, useCORS: true, logging: false, backgroundColor: '#ffffff' });
    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    pdf.save(`Final_Report_${data.reportId}_${data.patientNumber}.pdf`);

  } catch (error) {
    console.error('PDF 생성 실패:', error);
    alert('PDF 생성에 실패했습니다. jspdf, html2canvas 패키지가 설치되어 있는지 확인하세요.');
    throw error;
  }
};

/**
 * 환자 요약서 PDF 생성
 */
export const generatePatientSummaryPDF = async (data: {
  patientName: string;
  patientNumber: string;
  age?: number;
  gender?: string;
  birthDate?: string;
  phone?: string;
  bloodType?: string;
  address?: string;
  encounters: Array<{
    id: number;
    admission_date?: string;
    encounter_type?: string;
    encounter_type_display?: string;
    attending_doctor_name?: string;
    status?: string;
    status_display?: string;
    chief_complaint?: string;
  }>;
  ocsHistory: Array<{
    id: number;
    created_at?: string;
    job_type?: string;
    job_role?: string;
    ocs_status?: string;
    ocs_status_display?: string;
  }>;
  aiInferences: Array<{
    id: number;
    requested_at?: string;
    model_code?: string;
    model_name?: string;
    status?: string;
    status_display?: string;
  }>;
  prescriptions: Array<{
    id: number;
    prescribed_at?: string;
    status?: string;
  }>;
  generatedAt?: string;
}, watermarkConfig?: PdfWatermarkConfig): Promise<void> => {
  try {
    const { jsPDF } = await import('jspdf');
    const html2canvas = (await import('html2canvas')).default;

    const container = document.createElement('div');
    container.style.cssText = `
      position: absolute;
      left: -9999px;
      top: 0;
      width: 794px;
      padding: 40px;
      background: white;
      font-family: 'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif;
      font-size: 14px;
      line-height: 1.6;
      color: #333;
      box-sizing: border-box;
    `;

    const genderDisplay = data.gender === 'M' ? '남' : data.gender === 'F' ? '여' : data.gender || '-';

    // 진료 이력 테이블 행
    const encounterRows = data.encounters.length > 0
      ? data.encounters.map(enc => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${enc.admission_date?.split('T')[0] || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${enc.encounter_type_display || enc.encounter_type || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${enc.attending_doctor_name || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${enc.status_display || enc.status || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${enc.chief_complaint || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="5" style="padding: 16px; text-align: center; color: #666; border: 1px solid #ddd;">진료 이력이 없습니다.</td></tr>';

    // OCS 이력 테이블 행
    const ocsRows = data.ocsHistory.length > 0
      ? data.ocsHistory.map(ocs => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${ocs.created_at?.split('T')[0] || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ocs.job_type || ocs.job_role || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ocs.ocs_status_display || ocs.ocs_status || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #666; border: 1px solid #ddd;">검사 이력이 없습니다.</td></tr>';

    // AI 분석 이력 테이블 행
    const aiRows = data.aiInferences.length > 0
      ? data.aiInferences.map(ai => `
          <tr>
            <td style="padding: 8px; border: 1px solid #ddd;">${ai.requested_at?.split('T')[0] || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ai.model_name || ai.model_code || '-'}</td>
            <td style="padding: 8px; border: 1px solid #ddd;">${ai.status_display || ai.status || '-'}</td>
          </tr>
        `).join('')
      : '<tr><td colspan="3" style="padding: 16px; text-align: center; color: #666; border: 1px solid #ddd;">AI 분석 이력이 없습니다.</td></tr>';

    container.innerHTML = `
      <div style="text-align: center; border-bottom: 2px solid #2196f3; padding-bottom: 20px; margin-bottom: 20px;">
        <h1 style="margin: 0 0 8px 0; font-size: 24px; font-weight: bold; color: #2196f3;">환자 요약서</h1>
        <p style="margin: 0; color: #666; font-size: 13px;">생성일시: ${data.generatedAt?.replace('T', ' ').split('.')[0] || new Date().toLocaleString()}</p>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">기본 정보</h2>
        <table style="width: 100%; border-collapse: collapse;">
          <tr>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; width: 15%; text-align: left;">환자번호</th>
            <td style="padding: 8px; border: 1px solid #ddd; width: 35%;"><strong>${data.patientNumber}</strong></td>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; width: 15%; text-align: left;">환자명</th>
            <td style="padding: 8px; border: 1px solid #ddd; width: 35%;"><strong>${data.patientName}</strong></td>
          </tr>
          <tr>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; text-align: left;">나이/성별</th>
            <td style="padding: 8px; border: 1px solid #ddd;">${data.age || '-'}세 / ${genderDisplay}</td>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; text-align: left;">생년월일</th>
            <td style="padding: 8px; border: 1px solid #ddd;">${data.birthDate || '-'}</td>
          </tr>
          <tr>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; text-align: left;">연락처</th>
            <td style="padding: 8px; border: 1px solid #ddd;">${data.phone || '-'}</td>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; text-align: left;">혈액형</th>
            <td style="padding: 8px; border: 1px solid #ddd;">${data.bloodType || '-'}</td>
          </tr>
          <tr>
            <th style="padding: 8px; background: #f5f5f5; border: 1px solid #ddd; text-align: left;">주소</th>
            <td colspan="3" style="padding: 8px; border: 1px solid #ddd;">${data.address || '-'}</td>
          </tr>
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">진료 이력 (${data.encounters.length}건)</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">날짜</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">유형</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">담당의</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">상태</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">주호소</th>
            </tr>
          </thead>
          <tbody>
            ${encounterRows}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">검사 이력 (${data.ocsHistory.length}건)</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">날짜</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">유형</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">상태</th>
            </tr>
          </thead>
          <tbody>
            ${ocsRows}
          </tbody>
        </table>
      </div>

      <div style="margin-bottom: 24px;">
        <h2 style="font-size: 16px; margin: 0 0 12px 0; padding-bottom: 8px; border-bottom: 1px solid #ddd;">AI 분석 이력 (${data.aiInferences.length}건)</h2>
        <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
          <thead>
            <tr style="background: #f5f5f5;">
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">날짜</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">모델</th>
              <th style="padding: 8px; border: 1px solid #ddd; text-align: left;">상태</th>
            </tr>
          </thead>
          <tbody>
            ${aiRows}
          </tbody>
        </table>
      </div>

      <div style="margin-top: 40px; padding-top: 16px; border-top: 1px solid #ddd; text-align: center; color: #666; font-size: 12px;">
        본 문서는 NeuroNova CDSS에서 자동 생성되었습니다.
      </div>
    `;

    document.body.appendChild(container);

    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
    });

    document.body.removeChild(container);

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');

    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pdfWidth - 20;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    let heightLeft = imgHeight;
    let position = 10;

    pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
    heightLeft -= (pdfHeight - 20);

    while (heightLeft > 0) {
      position = heightLeft - imgHeight + 10;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 10, position, imgWidth, imgHeight);
      heightLeft -= (pdfHeight - 20);
    }

    // 워터마크 적용 (파라미터로 전달받거나 캐시에서 조회)
    const finalWatermarkConfig = watermarkConfig || await getWatermarkConfig();
    if (finalWatermarkConfig) {
      await applyWatermark(pdf, finalWatermarkConfig);
    }

    pdf.save(`Patient_Summary_${data.patientNumber}.pdf`);

  } catch (error) {
    console.error('PDF 생성 실패:', error);
    alert('PDF 생성에 실패했습니다. jspdf, html2canvas 패키지가 설치되어 있는지 확인하세요.');
    throw error;
  }
};

// ============================================
// Excel 내보내기 유틸리티
// ============================================

interface ExcelColumn {
  header: string;
  key: string;
  width?: number;
}

/**
 * 데이터를 Excel 파일로 내보내기
 */
export const exportToExcel = async <T extends Record<string, any>>(
  data: T[],
  columns: ExcelColumn[],
  filename: string,
  sheetName: string = 'Sheet1'
): Promise<void> => {
  try {
    const XLSX = await import('xlsx');

    // 헤더 행 생성
    const headers = columns.map(col => col.header);

    // 데이터 행 생성
    const rows = data.map(item =>
      columns.map(col => item[col.key] ?? '')
    );

    // 워크시트 생성
    const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);

    // 열 너비 설정
    ws['!cols'] = columns.map(col => ({ wch: col.width || 15 }));

    // 워크북 생성
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, sheetName);

    // 파일 다운로드
    XLSX.writeFile(wb, `${filename}.xlsx`);

  } catch (error) {
    console.error('Excel 내보내기 실패:', error);
    alert('Excel 내보내기에 실패했습니다. xlsx 패키지가 설치되어 있는지 확인하세요.\nnpm install xlsx');
    throw error;
  }
};

/**
 * 데이터를 CSV 파일로 내보내기
 */
export const exportToCSV = async <T extends Record<string, any>>(
  data: T[],
  columns: ExcelColumn[],
  filename: string
): Promise<void> => {
  try {
    // 헤더 행
    const headers = columns.map(col => col.header).join(',');

    // 데이터 행
    const rows = data.map(item =>
      columns.map(col => {
        const value = item[col.key] ?? '';
        // 쉼표, 줄바꿈, 따옴표가 포함된 경우 따옴표로 감싸기
        if (typeof value === 'string' && (value.includes(',') || value.includes('\n') || value.includes('"'))) {
          return `"${value.replace(/"/g, '""')}"`;
        }
        return value;
      }).join(',')
    );

    // BOM 추가 (한글 인코딩)
    const BOM = '\uFEFF';
    const csvContent = BOM + [headers, ...rows].join('\n');

    // Blob 생성 및 다운로드
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    link.href = URL.createObjectURL(blob);
    link.download = `${filename}.csv`;
    link.click();
    URL.revokeObjectURL(link.href);

  } catch (error) {
    console.error('CSV 내보내기 실패:', error);
    throw error;
  }
};

// ============================================
// 프리셋: 자주 사용하는 내보내기
// ============================================

/**
 * 환자 목록 Excel 내보내기
 */
export const exportPatientList = async (patients: any[]): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: '환자번호', key: 'patient_number', width: 15 },
    { header: '환자명', key: 'name', width: 12 },
    { header: '생년월일', key: 'birth_date', width: 12 },
    { header: '성별', key: 'gender', width: 8 },
    { header: '연락처', key: 'phone', width: 15 },
    { header: '등록일', key: 'created_at', width: 12 },
  ];

  await exportToExcel(patients, columns, `환자목록_${formatDateForFilename()}`, '환자목록');
};

/**
 * OCS 목록 Excel 내보내기
 */
export const exportOCSList = async (ocsList: any[]): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: 'OCS ID', key: 'ocs_id', width: 15 },
    { header: '환자번호', key: 'patient_number', width: 15 },
    { header: '환자명', key: 'patient_name', width: 12 },
    { header: 'OCS 유형', key: 'ocs_class', width: 10 },
    { header: '검사 유형', key: 'job_type', width: 12 },
    { header: '상태', key: 'ocs_status', width: 12 },
    { header: '우선순위', key: 'priority_display', width: 10 },
    { header: '처방 의사', key: 'doctor_name', width: 12 },
    { header: '담당자', key: 'worker_name', width: 12 },
    { header: '처방일시', key: 'created_at', width: 18 },
  ];

  // 데이터 변환
  const formattedData = ocsList.map(ocs => ({
    ...ocs,
    patient_number: ocs.patient?.patient_number || '',
    patient_name: ocs.patient?.name || '',
    doctor_name: ocs.doctor?.name || '',
    worker_name: ocs.worker?.name || '-',
  }));

  await exportToExcel(formattedData, columns, `OCS목록_${formatDateForFilename()}`, 'OCS목록');
};

/**
 * 진료 기록 목록 Excel 내보내기
 */
export const exportEncounterList = async (encounters: any[]): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: '진료ID', key: 'id', width: 10 },
    { header: '환자번호', key: 'patient_number', width: 15 },
    { header: '환자명', key: 'patient_name', width: 12 },
    { header: '진료유형', key: 'encounter_type', width: 10 },
    { header: '상태', key: 'status', width: 10 },
    { header: '담당의', key: 'doctor_name', width: 12 },
    { header: '예약일시', key: 'scheduled_date', width: 18 },
    { header: '시작일시', key: 'start_date', width: 18 },
    { header: '종료일시', key: 'end_date', width: 18 },
  ];

  const formattedData = encounters.map(enc => ({
    ...enc,
    patient_number: enc.patient?.patient_number || '',
    patient_name: enc.patient?.name || '',
    doctor_name: enc.doctor?.name || '',
  }));

  await exportToExcel(formattedData, columns, `진료기록_${formatDateForFilename()}`, '진료기록');
};

/**
 * 감사 로그 Excel 내보내기
 */
export const exportAuditLog = async (logs: any[]): Promise<void> => {
  const columns: ExcelColumn[] = [
    { header: '일시', key: 'created_at', width: 20 },
    { header: '사용자ID', key: 'user_id', width: 12 },
    { header: '사용자명', key: 'user_name', width: 12 },
    { header: '액션', key: 'action', width: 15 },
    { header: '대상', key: 'target', width: 20 },
    { header: 'IP 주소', key: 'ip_address', width: 15 },
    { header: '상세', key: 'detail', width: 30 },
  ];

  await exportToExcel(logs, columns, `감사로그_${formatDateForFilename()}`, '감사로그');
};

// ============================================
// 헬퍼 함수
// ============================================

/**
 * 파일명용 날짜 포맷
 */
const formatDateForFilename = (): string => {
  const now = new Date();
  return now.toISOString().slice(0, 10).replace(/-/g, '');
};

/**
 * 날짜 포맷 (표시용)
 */
export const formatDateTime = (dateStr: string | null): string => {
  if (!dateStr) return '-';
  const date = new Date(dateStr);
  return date.toLocaleString('ko-KR', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
};
