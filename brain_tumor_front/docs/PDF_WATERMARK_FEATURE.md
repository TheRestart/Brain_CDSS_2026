# PDF 워터마크 기능 구현 문서

## 개요

PDF 보고서 출력 시 워터마크를 적용할 수 있는 기능입니다. Admin 페이지에서 워터마크 설정을 관리하고, 모든 PDF 출력 버튼에서 미리보기 모달을 통해 워터마크를 확인/수정한 후 PDF를 생성할 수 있습니다.

---

## 주요 기능

### 1. 워터마크 유형
- **텍스트 워터마크**: 한글/영문 텍스트 지원 (Canvas 렌더링으로 한글 깨짐 해결)
- **이미지 워터마크**: PNG, JPG 이미지 지원 (최대 1MB)

### 2. 워터마크 설정 옵션
| 옵션 | 설명 | 기본값 |
|------|------|--------|
| enabled | 워터마크 활성화 여부 | false |
| type | 워터마크 유형 (text/image) | text |
| text | 워터마크 텍스트 | "CONFIDENTIAL" |
| imageUrl | 이미지 URL (Base64) | "" |
| imageWidth | 이미지 너비 (mm) | 50 |
| imageHeight | 이미지 높이 (mm) | 50 |
| position | 위치 (center/diagonal/top-right/bottom-right) | diagonal |
| opacity | 투명도 (0.0 ~ 1.0) | 0.15 |
| fontSize | 글꼴 크기 (px) | 48 |
| color | 텍스트 색상 (hex) | #cccccc |
| rotation | 회전 각도 (degree) | -45 |
| repeatPattern | 패턴 반복 여부 | false |

---

## 아키텍처

### 백엔드 (Django)

**파일**: `brain_tumor_back/apps/common/views.py`

```python
# 기본 설정값
DEFAULT_PDF_WATERMARK_CONFIG = {
    "enabled": False,
    "type": "text",
    "text": "CONFIDENTIAL",
    "imageUrl": "",
    "imageWidth": 50,
    "imageHeight": 50,
    "position": "diagonal",
    "opacity": 0.15,
    "fontSize": 48,
    "color": "#cccccc",
    "rotation": -45,
    "repeatPattern": False
}

class PdfWatermarkConfigView(APIView):
    """PDF 워터마크 설정 API"""
    # GET: 설정 조회
    # PUT: 설정 저장
```

**URL**: `/api/system/config/pdf-watermark/`

### 프론트엔드 (React)

#### API 서비스
**파일**: `src/services/pdfWatermark.api.ts`

```typescript
export type PdfWatermarkConfig = {
  enabled: boolean;
  type: 'text' | 'image';
  text: string;
  imageUrl: string;
  imageWidth: number;
  imageHeight: number;
  position: 'center' | 'diagonal' | 'top-right' | 'bottom-right';
  opacity: number;
  fontSize: number;
  color: string;
  rotation: number;
  repeatPattern: boolean;
};

export const getPdfWatermarkConfig = async (): Promise<PdfWatermarkConfig>;
export const updatePdfWatermarkConfig = async (config: PdfWatermarkConfig): Promise<void>;
```

#### Admin 설정 페이지
**파일**: `src/pages/admin/PdfWatermarkSettingsPage.tsx`

- 워터마크 유형 선택 (텍스트/이미지)
- 텍스트 워터마크: 텍스트, 색상, 크기, 회전 설정
- 이미지 워터마크: 이미지 업로드, 크기 설정
- 위치, 투명도, 패턴 반복 설정
- 실시간 미리보기

#### PDF 미리보기 모달
**파일**: `src/components/PdfPreviewModal.tsx`

- 좌측: 문서 미리보기 (워터마크 오버레이 표시)
- 우측: 워터마크 설정 패널
- PDF 다운로드 버튼 클릭 시 설정 적용

#### PDF 생성 유틸리티
**파일**: `src/utils/exportUtils.ts`

```typescript
// 워터마크 적용 함수
const applyWatermark = async (pdf: jsPDF, config: PdfWatermarkConfig): Promise<void>;

// 텍스트를 이미지로 변환 (한글 지원)
const renderTextToImage = async (text, fontSize, color, opacity, rotation): Promise<string>;

// PDF 생성 함수들 (워터마크 설정 파라미터 추가)
export const generateRISReportPDF = async (data, watermarkConfig?): Promise<void>;
export const generateLISReportPDF = async (data, watermarkConfig?): Promise<void>;
export const generateM1ReportPDF = async (data, watermarkConfig?): Promise<void>;
export const generateMGReportPDF = async (data, watermarkConfig?): Promise<void>;
export const generateMMReportPDF = async (data, watermarkConfig?): Promise<void>;
export const generateFinalReportPDF = async (data, watermarkConfig?): Promise<void>;
```

---

## 적용된 페이지

PDF 미리보기 모달이 적용된 페이지 목록:

| 페이지 | 파일 경로 | PDF 종류 |
|--------|----------|----------|
| LIS 검사 상세 | `src/pages/ocs/LISStudyDetailPage.tsx` | 검사 결과 보고서 |
| RIS 영상 상세 | `src/pages/ocs/RISStudyDetailPage.tsx` | 영상 판독 보고서 |
| M1 MRI 분석 | `src/pages/ai-inference/M1DetailPage.tsx` | AI MRI 분석 보고서 |
| MG 유전자 분석 | `src/pages/ai-inference/MGDetailPage.tsx` | AI 유전자 분석 보고서 |
| MM 멀티모달 분석 | `src/pages/ai-inference/MMDetailPage.tsx` | AI 멀티모달 분석 보고서 |
| 최종 보고서 | `src/pages/report/ReportDetailPage.tsx` | 최종 진단 보고서 |

---

## 사용 방법

### 1. Admin에서 기본 워터마크 설정
1. Admin 계정으로 로그인
2. `/admin/pdf-watermark` 페이지 접속
3. 워터마크 유형 선택 (텍스트/이미지)
4. 설정 변경 후 "저장" 버튼 클릭

### 2. PDF 출력 시 워터마크 적용
1. 보고서 상세 페이지에서 "PDF 출력" 버튼 클릭
2. 미리보기 모달에서 워터마크 설정 확인/수정
3. "PDF 다운로드" 버튼 클릭
4. 워터마크가 적용된 PDF 파일 다운로드

---

## 한글 지원 구현

jsPDF는 기본적으로 한글 폰트를 지원하지 않아 글자가 깨지는 문제가 있었습니다.

### 해결 방법: Canvas 렌더링

```typescript
const renderTextToImage = async (
  text: string,
  fontSize: number,
  color: string,
  opacity: number,
  rotation: number
): Promise<string> => {
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');

  // 시스템 한글 폰트 사용
  const fontFamily = "'Malgun Gothic', 'Apple SD Gothic Neo', sans-serif";
  ctx.font = `bold ${fontSize}px ${fontFamily}`;

  // 회전 적용
  ctx.translate(canvas.width / 2, canvas.height / 2);
  ctx.rotate((rotation * Math.PI) / 180);
  ctx.fillText(text, 0, 0);

  // Canvas를 PNG 이미지로 변환
  return canvas.toDataURL('image/png');
};
```

텍스트를 Canvas에 렌더링한 후 이미지로 변환하여 PDF에 추가하는 방식으로 한글 깨짐 문제를 해결했습니다.

---

## 파일 목록

### 신규 생성 파일
- `src/services/pdfWatermark.api.ts` - API 서비스
- `src/pages/admin/PdfWatermarkSettingsPage.tsx` - Admin 설정 페이지
- `src/pages/admin/PdfWatermarkSettingsPage.css` - 설정 페이지 스타일
- `src/components/PdfPreviewModal.tsx` - PDF 미리보기 모달
- `src/components/PdfPreviewModal.css` - 모달 스타일

### 수정된 파일
- `brain_tumor_back/apps/common/views.py` - 백엔드 API 추가
- `brain_tumor_back/config/urls.py` - URL 라우팅 추가
- `src/utils/exportUtils.ts` - 워터마크 적용 함수 및 PDF 생성 함수 수정
- `src/pages/ocs/LISStudyDetailPage.tsx` - 미리보기 모달 적용
- `src/pages/ocs/RISStudyDetailPage.tsx` - 미리보기 모달 적용
- `src/pages/ai-inference/M1DetailPage.tsx` - 미리보기 모달 적용
- `src/pages/ai-inference/MGDetailPage.tsx` - 미리보기 모달 적용
- `src/pages/ai-inference/MMDetailPage.tsx` - 미리보기 모달 적용
- `src/pages/report/ReportDetailPage.tsx` - 미리보기 모달 적용

---

## 의존성 패키지

```bash
npm install jspdf jspdf-autotable html2canvas
```

---

## 향후 개선 사항

1. **워터마크 프리셋**: 자주 사용하는 워터마크 설정을 프리셋으로 저장
2. **사용자별 워터마크**: 사용자/부서별 다른 워터마크 적용
3. **동적 워터마크**: 날짜, 사용자명 등 동적 텍스트 지원
4. **워터마크 미리보기 개선**: 실제 PDF 렌더링 미리보기
