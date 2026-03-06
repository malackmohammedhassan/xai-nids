/** MutualInfoChart.tsx — Feature importance (mutual information) bar chart */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell,
} from 'recharts';
import { toMutualInfo } from '@/utils/vizDataTransformers';
import { CATEGORICAL_10 } from '@/utils/colorSchemes';

interface MutualInfoChartProps {
  data: Record<string, number>;
  topN?: number;
}

export const MutualInfoChart: React.FC<MutualInfoChartProps> = ({ data, topN = 20 }) => {
  const items = toMutualInfo(data, topN);
  if (items.length === 0) return <p className="text-sm text-slate-500 py-4 text-center">No mutual information scores.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(items.length * 24, 160)}>
      <BarChart data={items} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
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
          width={100}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v: number) => [v.toFixed(4), 'MI Score']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          itemStyle={{ color: '#e2e8f0' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={20}>
          {items.map((item, i) => (
            <Cell key={item.feature} fill={CATEGORICAL_10[i % CATEGORICAL_10.length]} />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
