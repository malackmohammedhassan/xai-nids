/** NullPctChart.tsx — Horizontal bar chart of null % per column */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { toNullPctBar } from '@/utils/vizDataTransformers';
import { NULL_PCT_WARN, NULL_PCT_ERROR } from '@/utils/thresholds';

interface NullPctChartProps {
  data: Record<string, number>;
  /** max columns to show (sorted desc) */
  topN?: number;
}

export const NullPctChart: React.FC<NullPctChartProps> = ({ data, topN = 30 }) => {
  const items = toNullPctBar(data).slice(0, topN);
  if (items.length === 0) return <p className="text-sm text-slate-500 py-4 text-center">No missing data.</p>;

  return (
    <ResponsiveContainer width="100%" height={Math.max(items.length * 22, 120)}>
      <BarChart data={items} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
        <XAxis
          type="number"
          domain={[0, 1]}
          tickFormatter={(v) => `${Math.round(v * 100)}%`}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          type="category"
          dataKey="column"
          width={90}
          tick={{ fill: '#94a3b8', fontSize: 11 }}
          tickLine={false}
          axisLine={false}
        />
        <Tooltip
          formatter={(v: number) => [`${(v * 100).toFixed(1)}%`, 'Null %']}
          contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          itemStyle={{ color: '#e2e8f0' }}
          labelStyle={{ color: '#94a3b8' }}
        />
        <ReferenceLine x={NULL_PCT_WARN} stroke="#f59e0b" strokeDasharray="4 4" strokeWidth={1} />
        <ReferenceLine x={NULL_PCT_ERROR} stroke="#ef4444" strokeDasharray="4 4" strokeWidth={1} />
        <Bar dataKey="null_pct" radius={[0, 4, 4, 0]} maxBarSize={18}>
          {items.map((item) => (
            <Cell
              key={item.column}
              fill={item.null_pct >= NULL_PCT_ERROR ? '#ef4444' : item.null_pct >= NULL_PCT_WARN ? '#f59e0b' : '#6366f1'}
            />
          ))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
};
