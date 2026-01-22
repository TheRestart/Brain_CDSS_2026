import { useMemo } from 'react';
import type { OCSJobStats } from '@/services/ocs.api';
import './WorkflowPipeline.css';

interface WorkflowStep {
  id: string;
  label: string;
  count: number;
  color: string;
}

interface WorkflowPipelineProps {
  stats: OCSJobStats | null;
  type: 'LIS' | 'RIS';
  onStepClick?: (stepId: string) => void;
}

export function WorkflowPipeline({ stats, type, onStepClick }: WorkflowPipelineProps) {
  const steps = useMemo<WorkflowStep[]>(() => {
    if (!stats) return [];

    if (type === 'LIS') {
      return [
        { id: 'ordered', label: '접수 대기', count: stats.ordered, color: '#f59e0b' },
        { id: 'accepted', label: '조직 접수', count: stats.accepted, color: '#eab308' },
        { id: 'in_progress', label: '분석 중', count: stats.in_progress, color: '#06b6d4' },
        { id: 'result_ready', label: '결과 대기', count: stats.result_ready, color: '#8b5cf6' },
        { id: 'confirmed', label: '확정 완료', count: stats.confirmed, color: '#10b981' },
      ];
    } else {
      return [
        { id: 'ordered', label: '오더 생성', count: stats.ordered, color: '#f59e0b' },
        { id: 'accepted', label: '검사 예약', count: stats.accepted, color: '#eab308' },
        { id: 'in_progress', label: '촬영 중', count: stats.in_progress, color: '#06b6d4' },
        { id: 'result_ready', label: '판독 대기', count: stats.result_ready, color: '#8b5cf6' },
        { id: 'confirmed', label: '판독 완료', count: stats.confirmed, color: '#10b981' },
      ];
    }
  }, [stats, type]);

  const totalActive = useMemo(() => {
    return steps.reduce((sum, step) => sum + step.count, 0);
  }, [steps]);

  if (!stats) {
    return (
      <div className="workflow-pipeline loading">
        <div className="pipeline-skeleton">
          {[1, 2, 3, 4, 5].map(i => (
            <div key={i} className="step-skeleton" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="workflow-pipeline">
      <div className="pipeline-header">
        <h4>워크플로우 현황</h4>
        <span className="total-count">총 {totalActive}건 진행 중</span>
      </div>

      <div className="pipeline-steps">
        {steps.map((step, index) => (
          <div key={step.id} className="pipeline-step-wrapper">
            <div
              className={`pipeline-step ${step.count > 0 ? 'active' : ''}`}
              style={{ '--step-color': step.color } as React.CSSProperties}
              onClick={() => step.count > 0 && onStepClick?.(step.id)}
            >
              <div className="step-count">{step.count}</div>
              <div className="step-label">{step.label}</div>
              {step.count > 0 && <div className="step-indicator" />}
            </div>
            {index < steps.length - 1 && (
              <div className="step-connector">
                <svg viewBox="0 0 24 24" className="connector-arrow">
                  <path d="M5 12h14M13 6l6 6-6 6" fill="none" stroke="currentColor" strokeWidth="2" />
                </svg>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Progress Bar */}
      <div className="pipeline-progress">
        {steps.map((step) => {
          const percentage = totalActive > 0 ? (step.count / totalActive) * 100 : 0;
          return (
            <div
              key={step.id}
              className="progress-segment"
              style={{
                width: `${percentage}%`,
                backgroundColor: step.color,
              }}
              title={`${step.label}: ${step.count}건 (${percentage.toFixed(1)}%)`}
            />
          );
        })}
      </div>
    </div>
  );
}
