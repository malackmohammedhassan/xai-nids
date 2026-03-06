/** LIMEBarChart.tsx — LIME feature weights as a signed horizontal bar chart */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

interface LIMEBarChartProps {
  weights: Record<string, number>;
  topN?: number;
}

export const LIMEBarChart: React.FC<LIMEBarChartProps> = ({ weights, topN = 15 }) => {
  const sorted = Object.entries(weights)
    .map(([feature, weight]) => ({ feature, weight }))
    .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
    .slice(0, topN);

  if (sorted.length === 0) return null;

  return (
    <ResponsiveContainer width="100%" height={Math.max(sorted.length * 26, 160)}>
      <BarChart data={sorted} layout="vertical" margin={{ left: 8, right: 32, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis
          type="number"
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="feature"
          width={120}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v: number) => [v.toFixed(5), 'LIME weight']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          itemStyle={{ color: '#e2e8f0' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <ReferenceLine x={0} stroke="#475569" />
        <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {sorted.map((item) => (
            <Cell key={item.feature} fill={item.weight > 0 ? '#f59e0b' : '#6366f1'} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
