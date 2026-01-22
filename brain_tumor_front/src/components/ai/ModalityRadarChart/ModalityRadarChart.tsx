/**
 * Modality Radar Chart Component
 * MM 멀티모달 분석에서 각 모달리티의 기여도를 Radar Chart로 시각화
 */

import {
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
  Legend,
  ResponsiveContainer,
  Tooltip,
} from 'recharts';
import './ModalityRadarChart.css';

interface ModalityContribution {
  mri?: { weight: number; confidence: number };
  gene?: { weight: number; confidence: number };
  protein?: { weight: number; confidence: number };
}

interface ModalityRadarChartProps {
  data: ModalityContribution;
  title?: string;
}

interface RadarDataPoint {
  modality: string;
  weight: number;
  confidence: number;
  fullMark: number;
}

const MODALITY_LABELS: Record<string, string> = {
  mri: 'MRI',
  gene: 'Gene',
  protein: 'Protein',
};

const MODALITY_ICONS: Record<string, string> = {
  mri: '🧠',
  gene: '🧬',
  protein: '🔬',
};

export default function ModalityRadarChart({
  data,
  title = '모달리티 기여도',
}: ModalityRadarChartProps) {
  // 데이터 변환
  const chartData: RadarDataPoint[] = Object.entries(data)
    .filter(([_, value]) => value !== undefined)
    .map(([key, value]) => ({
      modality: `${MODALITY_ICONS[key] || ''} ${MODALITY_LABELS[key] || key}`,
      weight: (value?.weight ?? 0) * 100,
      confidence: (value?.confidence ?? 0) * 100,
      fullMark: 100,
    }));

  // 데이터가 없으면 표시하지 않음
  if (chartData.length === 0) {
    return (
      <div className="modality-radar-chart modality-radar-chart--empty">
        <p>모달리티 기여도 데이터가 없습니다.</p>
      </div>
    );
  }

  // 단일 모달리티인 경우 간단한 표시
  if (chartData.length === 1) {
    const single = chartData[0];
    return (
      <div className="modality-radar-chart modality-radar-chart--single">
        <h4 className="modality-radar-chart__title">{title}</h4>
        <div className="modality-radar-chart__single-item">
          <span className="modality-radar-chart__single-name">{single.modality}</span>
          <div className="modality-radar-chart__single-values">
            <div className="modality-radar-chart__single-stat">
              <span className="label">가중치</span>
              <span className="value">{single.weight.toFixed(1)}%</span>
            </div>
            <div className="modality-radar-chart__single-stat">
              <span className="label">신뢰도</span>
              <span className="value">{single.confidence.toFixed(1)}%</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="modality-radar-chart">
      <h4 className="modality-radar-chart__title">{title}</h4>
      <div className="modality-radar-chart__container">
        <ResponsiveContainer width="100%" height={300}>
          <RadarChart cx="50%" cy="50%" outerRadius="70%" data={chartData}>
            <PolarGrid stroke="#e0e0e0" />
            <PolarAngleAxis
              dataKey="modality"
              tick={{ fill: '#333', fontSize: 13 }}
            />
            <PolarRadiusAxis
              angle={90}
              domain={[0, 100]}
              tick={{ fill: '#666', fontSize: 11 }}
              tickFormatter={(value) => `${value}%`}
            />
            <Radar
              name="가중치"
              dataKey="weight"
              stroke="#1976d2"
              fill="#1976d2"
              fillOpacity={0.3}
              strokeWidth={2}
            />
            <Radar
              name="신뢰도"
              dataKey="confidence"
              stroke="#4caf50"
              fill="#4caf50"
              fillOpacity={0.2}
              strokeWidth={2}
            />
            <Legend
              wrapperStyle={{ paddingTop: 10 }}
              formatter={(value) => <span style={{ color: '#333' }}>{value}</span>}
            />
            <Tooltip
              formatter={(value) => `${Number(value).toFixed(1)}%`}
              contentStyle={{
                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                border: '1px solid #e0e0e0',
                borderRadius: '4px',
              }}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* 수치 테이블 */}
      <div className="modality-radar-chart__table">
        <table>
          <thead>
            <tr>
              <th>모달리티</th>
              <th>가중치</th>
              <th>신뢰도</th>
            </tr>
          </thead>
          <tbody>
            {chartData.map((item) => (
              <tr key={item.modality}>
                <td>{item.modality}</td>
                <td className="value-cell weight">{item.weight.toFixed(1)}%</td>
                <td className="value-cell confidence">{item.confidence.toFixed(1)}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
