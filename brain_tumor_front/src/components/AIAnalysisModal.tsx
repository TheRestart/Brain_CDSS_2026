/**
 * AI 분석 요청 모달 컴포넌트
 * - M1: MRI 영상 분석
 * - MG: Gene Expression 분석
 * - MM: 멀티모달 분석
 */
import { useState, useEffect } from 'react'
import { M1InferencePage, MGInferencePage, MMInferencePage } from '@/pages/ai-inference/components'
import './AIAnalysisModal.css'

type TabType = 'm1' | 'mg' | 'mm'

interface AIAnalysisModalProps {
  isOpen: boolean
  onClose: () => void
}

export default function AIAnalysisModal({ isOpen, onClose }: AIAnalysisModalProps) {
  const [activeTab, setActiveTab] = useState<TabType>('m1')

  // ESC 키로 모달 닫기
  useEffect(() => {
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose()
      }
    }

    if (isOpen) {
      document.addEventListener('keydown', handleEsc)
      document.body.style.overflow = 'hidden' // 배경 스크롤 방지
    }

    return () => {
      document.removeEventListener('keydown', handleEsc)
      document.body.style.overflow = 'unset'
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="ai-modal-overlay" onClick={onClose}>
      <div className="ai-modal-container" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <header className="ai-modal-header">
          <div className="ai-modal-header-content">
            <h1 className="ai-modal-title">Brain Tumor CDSS</h1>
            <p className="ai-modal-subtitle">AI 기반 뇌종양 분석 시스템</p>
          </div>
          <button className="ai-modal-close" onClick={onClose} title="닫기">
            <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="18" y1="6" x2="6" y2="18"></line>
              <line x1="6" y1="6" x2="18" y2="18"></line>
            </svg>
          </button>
        </header>

        {/* Navigation Tabs */}
        <nav className="ai-modal-nav">
          <button
            className={`ai-modal-tab ${activeTab === 'm1' ? 'active m1' : ''}`}
            onClick={() => setActiveTab('m1')}
          >
            <span className="tab-icon">🧠</span>
            <span className="tab-label">M1 MRI 분석</span>
          </button>
          <button
            className={`ai-modal-tab ${activeTab === 'mg' ? 'active mg' : ''}`}
            onClick={() => setActiveTab('mg')}
          >
            <span className="tab-icon">🧬</span>
            <span className="tab-label">MG Gene Analysis</span>
          </button>
          <button
            className={`ai-modal-tab ${activeTab === 'mm' ? 'active mm' : ''}`}
            onClick={() => setActiveTab('mm')}
          >
            <span className="tab-icon">🔬</span>
            <span className="tab-label">MM 멀티모달</span>
          </button>
        </nav>

        {/* Modal Content */}
        <main className="ai-modal-main">
          {activeTab === 'm1' && <M1InferencePage />}
          {activeTab === 'mg' && <MGInferencePage />}
          {activeTab === 'mm' && <MMInferencePage />}
        </main>
      </div>
    </div>
  )
}
