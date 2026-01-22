import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import './ModelUsageChart.css';

interface UsageData {
  date: string;
  m1_count: number;
  mg_count: number;
  mm_count: number;
}

interface ModelUsageChartProps {
  data: UsageData[];
  loading?: boolean;
}

export default function ModelUsageChart({ data, loading = false }: ModelUsageChartProps) {
  if (loading) {
    return (
      <div className="model-usage-chart__loading">
        <div className="model-usage-chart__skeleton" />
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="model-usage-chart__empty">
        <span className="material-icons">bar_chart</span>
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  return (
    <div className="model-usage-chart">
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={data} margin={{ top: 5, right: 30, left: 0, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 12 }}
            tickFormatter={(value) => {
              const date = new Date(value);
              return `${date.getMonth() + 1}/${date.getDate()}`;
            }}
          />
          <YAxis tick={{ fontSize: 12 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
            labelFormatter={(value) => {
              const date = new Date(value);
              return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
            }}
          />
          <Legend
            wrapperStyle={{ paddingTop: '10px' }}
            formatter={(value) => {
              const labels: Record<string, string> = {
                m1_count: 'M1 (MRI 분석)',
                mg_count: 'MG (유전자 분석)',
                mm_count: 'MM (멀티모달)',
              };
              return labels[value] || value;
            }}
          />
          <Line
            type="monotone"
            dataKey="m1_count"
            stroke="#1976d2"
            strokeWidth={2}
            dot={{ fill: '#1976d2', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="mg_count"
            stroke="#4caf50"
            strokeWidth={2}
            dot={{ fill: '#4caf50', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
          <Line
            type="monotone"
            dataKey="mm_count"
            stroke="#ff9800"
            strokeWidth={2}
            dot={{ fill: '#ff9800', strokeWidth: 2, r: 4 }}
            activeDot={{ r: 6 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
