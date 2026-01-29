import { createContext, useContext, useState, useEffect, type ReactNode } from 'react';

// 글자 크기 배율 타입
export type FontSizeScale = 'small' | 'medium' | 'large' | 'xlarge';

// 글자 크기 배율 값 (기본 1 = 100%)
const FONT_SIZE_SCALES: Record<FontSizeScale, number> = {
  small: 0.875,   // 87.5%
  medium: 1,      // 100% (기본)
  large: 1.125,   // 112.5%
  xlarge: 1.25,   // 125%
};

// 글자 크기 라벨
export const FONT_SIZE_LABELS: Record<FontSizeScale, string> = {
  small: '작게',
  medium: '보통',
  large: '크게',
  xlarge: '매우 크게',
};

interface FontSizeContextType {
  fontSize: FontSizeScale;
  setFontSize: (size: FontSizeScale) => void;
  fontSizeScale: number;
}

const FontSizeContext = createContext<FontSizeContextType | null>(null);

const STORAGE_KEY = 'cdss-font-size';

export function FontSizeProvider({ children }: { children: ReactNode }) {
  const [fontSize, setFontSizeState] = useState<FontSizeScale>(() => {
    const saved = localStorage.getItem(STORAGE_KEY);
    return (saved as FontSizeScale) || 'medium';
  });

  const fontSizeScale = FONT_SIZE_SCALES[fontSize];

  // CSS 변수 업데이트
  useEffect(() => {
    const root = document.documentElement;
    const scale = FONT_SIZE_SCALES[fontSize];

    // 기본 폰트 크기들을 배율에 맞게 조정
    root.style.setProperty('--text-xs', `${0.75 * scale}rem`);
    root.style.setProperty('--text-sm', `${0.875 * scale}rem`);
    root.style.setProperty('--text-base', `${1 * scale}rem`);
    root.style.setProperty('--text-lg', `${1.125 * scale}rem`);
    root.style.setProperty('--text-xl', `${1.25 * scale}rem`);
    root.style.setProperty('--text-2xl', `${1.5 * scale}rem`);
    root.style.setProperty('--text-3xl', `${1.875 * scale}rem`);

    // localStorage에 저장
    localStorage.setItem(STORAGE_KEY, fontSize);
  }, [fontSize]);

  const setFontSize = (size: FontSizeScale) => {
    setFontSizeState(size);
  };

  return (
    <FontSizeContext.Provider value={{ fontSize, setFontSize, fontSizeScale }}>
      {children}
    </FontSizeContext.Provider>
  );
}

export function useFontSize() {
  const context = useContext(FontSizeContext);
  if (!context) {
    throw new Error('useFontSize must be used within a FontSizeProvider');
  }
  return context;
}
