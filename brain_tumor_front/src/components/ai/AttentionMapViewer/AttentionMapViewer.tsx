/**
 * Attention Map Viewer Component
 * MM 멀티모달 분석에서 XAI 결과를 시각화
 * - MRI 주요 영역 (mri_regions)
 * - Top Genes (top_genes)
 * - Key Proteins (key_proteins)
 */

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
} from 'recharts';
import './AttentionMapViewer.css';

interface AttentionItem {
  region?: string;
  gene?: string;
  protein?: string;
  attention: number;
}

interface IntegratedAttention {
  mri_regions?: Array<{ region: string; attention: number }>;
  top_genes?: Array<{ gene: string; attention: number }>;
  key_proteins?: Array<{ protein: string; attention: number }>;
}

interface CrossModalCorrelation {
  modality_pair: string;
  correlation: number;
  significance: number;
}

interface AttentionMapViewerProps {
  integratedAttention?: IntegratedAttention;
  crossModalCorrelations?: CrossModalCorrelation[];
}

const COLORS = {
  mri: ['#1976d2', '#2196f3', '#42a5f5', '#64b5f6', '#90caf9'],
  gene: ['#7b1fa2', '#9c27b0', '#ab47bc', '#ba68c8', '#ce93d8'],
  protein: ['#f57c00', '#ff9800', '#ffa726', '#ffb74d', '#ffcc80'],
};

export default function AttentionMapViewer({
  integratedAttention,
  crossModalCorrelations,
}: AttentionMapViewerProps) {
  if (!integratedAttention && !crossModalCorrelations) {
    return (
      <div className="attention-map-viewer attention-map-viewer--empty">
        <p>Attention Map 데이터가 없습니다.</p>
      </div>
    );
  }

  const renderAttentionBars = (
    data: AttentionItem[],
    labelKey: 'region' | 'gene' | 'protein',
    title: string,
    colorPalette: string[]
  ) => {
    if (!data || data.length === 0) return null;

    const chartData = data.map((item, index) => ({
      name: item[labelKey] || `Item ${index + 1}`,
      attention: item.attention,
      index,
    }));

    return (
      <div className="attention-map-viewer__section">
        <h4 className="attention-map-viewer__section-title">{title}</h4>
        <div className="attention-map-viewer__chart">
          <ResponsiveContainer width="100%" height={Math.max(200, data.length * 35)}>
            <BarChart
              data={chartData}
              layout="vertical"
              margin={{ top: 5, right: 30, left: 80, bottom: 5 }}
            >
              <XAxis
                type="number"
                domain={[0, 1]}
                tickFormatter={(value) => `${(value * 100).toFixed(0)}%`}
                tick={{ fontSize: 11 }}
              />
              <YAxis
                type="category"
                dataKey="name"
                tick={{ fontSize: 11 }}
                width={75}
              />
              <Tooltip
                formatter={(value) => [`${(Number(value) * 100).toFixed(1)}%`, 'Attention']}
                contentStyle={{
                  backgroundColor: 'rgba(255, 255, 255, 0.95)',
                  border: '1px solid #e0e0e0',
                  borderRadius: '4px',
                  fontSize: '12px',
                }}
              />
              <Bar dataKey="attention" radius={[0, 4, 4, 0]}>
                {chartData.map((_, index) => (
                  <Cell
                    key={`cell-${index}`}
                    fill={colorPalette[index % colorPalette.length]}
                  />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* 수치 리스트 */}
        <div className="attention-map-viewer__list">
          {chartData.map((item, index) => (
            <div
              key={index}
              className="attention-map-viewer__list-item"
              style={{ borderLeftColor: colorPalette[index % colorPalette.length] }}
            >
              <span className="attention-map-viewer__list-name">{item.name}</span>
              <span className="attention-map-viewer__list-value">
                {(item.attention * 100).toFixed(1)}%
              </span>
            </div>
          ))}
        </div>
      </div>
    );
  };

  return (
    <div className="attention-map-viewer">
      <h3 className="attention-map-viewer__title">Attention Map 분석</h3>

      <div className="attention-map-viewer__grid">
        {/* MRI Regions */}
        {integratedAttention?.mri_regions &&
          renderAttentionBars(
            integratedAttention.mri_regions,
            'region',
            '🧠 MRI 주요 영역',
            COLORS.mri
          )}

        {/* Top Genes */}
        {integratedAttention?.top_genes &&
          renderAttentionBars(
            integratedAttention.top_genes,
            'gene',
            '🧬 주요 유전자',
            COLORS.gene
          )}

        {/* Key Proteins */}
        {integratedAttention?.key_proteins &&
          renderAttentionBars(
            integratedAttention.key_proteins,
            'protein',
            '🔬 주요 단백질',
            COLORS.protein
          )}
      </div>

      {/* Cross-Modal Correlations */}
      {crossModalCorrelations && crossModalCorrelations.length > 0 && (
        <div className="attention-map-viewer__correlations">
          <h4 className="attention-map-viewer__section-title">모달리티 간 상호작용</h4>
          <div className="attention-map-viewer__correlation-grid">
            {crossModalCorrelations.map((corr, index) => (
              <div key={index} className="attention-map-viewer__correlation-item">
                <div className="attention-map-viewer__correlation-pair">
                  {corr.modality_pair}
                </div>
                <div className="attention-map-viewer__correlation-bar-wrapper">
                  <div
                    className={`attention-map-viewer__correlation-bar ${
                      corr.correlation >= 0 ? 'positive' : 'negative'
                    }`}
                    style={{ width: `${Math.abs(corr.correlation) * 100}%` }}
                  />
                </div>
                <div className="attention-map-viewer__correlation-values">
                  <span className="attention-map-viewer__correlation-value">
                    r = {corr.correlation > 0 ? '+' : ''}{corr.correlation.toFixed(3)}
                  </span>
                  <span
                    className={`attention-map-viewer__correlation-significance ${
                      corr.significance < 0.05 ? 'significant' : ''
                    }`}
                  >
                    p = {corr.significance.toFixed(4)}
                    {corr.significance < 0.001 && ' ***'}
                    {corr.significance >= 0.001 && corr.significance < 0.01 && ' **'}
                    {corr.significance >= 0.01 && corr.significance < 0.05 && ' *'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
