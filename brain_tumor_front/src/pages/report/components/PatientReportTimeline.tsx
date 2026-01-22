/**
 * 환자별 보고서 타임라인 컴포넌트
 * - 특정 환자의 모든 보고서를 시간순으로 표시
 * - 환자 상세 페이지에서 사용
 */
import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getPatientReportTimeline, type TimelineItem } from '@/services/report.api';
import './PatientReportTimeline.css';

// 아이콘 매핑
const TYPE_ICONS: Record<string, string> = {
  OCS_RIS: '\ud83e\udde0', // 뇌 (MRI)
  OCS_LIS: '\ud83e\uddea', // 시험관
  AI_M1: '\ud83e\udd16',   // 로봇
  AI_MG: '\ud83e\uddec',   // DNA
  AI_MM: '\ud83d\udd2c',   // 현미경
  FINAL: '\ud83d\udccb',   // 클립보드
};

// 타입별 색상
const TYPE_COLORS: Record<string, string> = {
  OCS_RIS: '#3b82f6', // blue
  OCS_LIS: '#10b981', // green
  AI_M1: '#ef4444',   // red
  AI_MG: '#10b981',   // green
  AI_MM: '#6366f1',   // indigo
  FINAL: '#8b5cf6',   // purple
};

interface PatientReportTimelineProps {
  patientId: number;
  maxItems?: number;
  showHeader?: boolean;
}

export default function PatientReportTimeline({
  patientId,
  maxItems = 10,
  showHeader = true,
}: PatientReportTimelineProps) {
  const navigate = useNavigate();
  const [timeline, setTimeline] = useState<TimelineItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [_patientName, setPatientName] = useState<string>('');

  useEffect(() => {
    const fetchTimeline = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await getPatientReportTimeline(patientId);
        setTimeline(data.timeline.slice(0, maxItems));
        setPatientName(data.patient_name);
      } catch (err) {
        setError('타임라인을 불러오는데 실패했습니다.');
        console.error(err);
      } finally {
        setLoading(false);
      }
    };

    fetchTimeline();
  }, [patientId, maxItems]);

  // 날짜 포맷
  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleDateString('ko-KR', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  // 시간 포맷
  const formatTime = (dateStr: string) => {
    const date = new Date(dateStr);
    return date.toLocaleTimeString('ko-KR', {
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  // 아이템 클릭
  const handleItemClick = (item: TimelineItem) => {
    navigate(item.link);
  };

  // 결과 플래그별 클래스
  const getResultClass = (flag: string) => {
    switch (flag) {
      case 'normal': return 'result-normal';
      case 'abnormal': return 'result-abnormal';
      case 'ai': return 'result-ai';
      case 'final': return 'result-final';
      default: return '';
    }
  };

  if (loading) {
    return (
      <div className="patient-timeline loading">
        <div className="spinner" />
        <span>로딩 중...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div className="patient-timeline error">
        <span>{error}</span>
      </div>
    );
  }

  if (timeline.length === 0) {
    return (
      <div className="patient-timeline empty">
        <span>보고서가 없습니다.</span>
      </div>
    );
  }

  return (
    <div className="patient-timeline">
      {showHeader && (
        <div className="timeline-header">
          <h3>보고서 타임라인</h3>
          <span className="count">{timeline.length}건</span>
        </div>
      )}

      <div className="timeline-list">
        {timeline.map((item, index) => (
          <div
            key={item.id}
            className="timeline-item"
            onClick={() => handleItemClick(item)}
          >
            {/* 타임라인 선 */}
            <div className="timeline-line">
              <div
                className="timeline-dot"
                style={{ backgroundColor: TYPE_COLORS[item.type] || '#6b7280' }}
              >
                <span className="dot-icon">{TYPE_ICONS[item.type] || '\ud83d\udcc4'}</span>
              </div>
              {index < timeline.length - 1 && <div className="line-connector" />}
            </div>

            {/* 컨텐츠 */}
            <div className="timeline-content">
              <div className="content-header">
                <span
                  className="type-badge"
                  style={{ backgroundColor: TYPE_COLORS[item.type] || '#6b7280' }}
                >
                  {item.type_display}
                </span>
                <span className="sub-type">{item.sub_type}</span>
              </div>

              <h4 className="content-title">{item.title}</h4>

              <div className="content-meta">
                <span className={`result ${getResultClass(item.result_flag)}`}>
                  {item.result}
                </span>
                {item.author && (
                  <span className="author">{item.author}</span>
                )}
              </div>

              <div className="content-date">
                <span className="date">{formatDate(item.date)}</span>
                <span className="time">{formatTime(item.date)}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {timeline.length >= maxItems && (
        <div className="timeline-more">
          <button onClick={() => navigate(`/reports?patient=${patientId}`)}>
            전체 보기
          </button>
        </div>
      )}
    </div>
  );
}
