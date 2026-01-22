import { PieChart, Pie, Cell, ResponsiveContainer, Legend, Tooltip } from 'recharts';
import './ResultDistribution.css';

interface GradeData {
  G2: number;
  G3: number;
  G4: number;
}

interface ResultDistributionProps {
  data: GradeData;
  loading?: boolean;
}

const COLORS = {
  G2: '#4caf50',
  G3: '#ff9800',
  G4: '#f44336',
};

const LABELS = {
  G2: 'Grade 2 (저등급)',
  G3: 'Grade 3 (중등급)',
  G4: 'Grade 4 (고등급)',
};

export default function ResultDistribution({ data, loading = false }: ResultDistributionProps) {
  if (loading) {
    return (
      <div className="result-distribution__loading">
        <div className="result-distribution__skeleton" />
      </div>
    );
  }

  const total = data.G2 + data.G3 + data.G4;

  if (total === 0) {
    return (
      <div className="result-distribution__empty">
        <span className="material-icons">pie_chart</span>
        <p>데이터가 없습니다</p>
      </div>
    );
  }

  const chartData = [
    { name: 'G2', value: data.G2, label: LABELS.G2 },
    { name: 'G3', value: data.G3, label: LABELS.G3 },
    { name: 'G4', value: data.G4, label: LABELS.G4 },
  ].filter((d) => d.value > 0);

  return (
    <div className="result-distribution">
      <ResponsiveContainer width="100%" height={280}>
        <PieChart>
          <Pie
            data={chartData}
            cx="50%"
            cy="50%"
            innerRadius={60}
            outerRadius={90}
            paddingAngle={2}
            dataKey="value"
            label={({ name, percent }) => `${name} (${((percent ?? 0) * 100).toFixed(0)}%)`}
            labelLine={{ stroke: '#666', strokeWidth: 1 }}
          >
            {chartData.map((entry) => (
              <Cell
                key={entry.name}
                fill={COLORS[entry.name as keyof typeof COLORS]}
                stroke="white"
                strokeWidth={2}
              />
            ))}
          </Pie>
          <Tooltip
            formatter={(value, name) => [
              `${value}건`,
              LABELS[name as keyof typeof LABELS],
            ]}
            contentStyle={{
              backgroundColor: 'white',
              border: '1px solid #e0e0e0',
              borderRadius: '8px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.1)',
            }}
          />
          <Legend
            verticalAlign="bottom"
            height={36}
            formatter={(value) => LABELS[value as keyof typeof LABELS]}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="result-distribution__summary">
        <span className="result-distribution__total">총 {total}건</span>
      </div>
    </div>
  );
}
