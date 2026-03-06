/**
 * SHAPWaterfall.tsx
 * Horizontal waterfall chart showing SHAP feature contributions.
 * Positive = pushes toward attack, negative = pushes toward benign.
 */
import React from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

interface SHAPWaterfallProps {
  /** { feature_name: shap_value } */
  shapValues: Record<string, number>;
  topN?: number;
  baseValue?: number;
}

export const SHAPWaterfall: React.FC<SHAPWaterfallProps> = ({
  shapValues,
  topN = 20,
  baseValue = 0,
}) => {
  const sorted = Object.entries(shapValues)
    .map(([feature, value]) => ({ feature, value }))
    .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
    .slice(0, topN);

  if (sorted.length === 0) return null;

  return (
    <div className="flex flex-col gap-2">
      {baseValue !== 0 && (
        <p className="text-xs text-slate-500">Base value: {baseValue.toFixed(4)}</p>
      )}
      <ResponsiveContainer width="100%" height={Math.max(sorted.length * 24, 160)}>
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
            width={110}
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: number) => [v.toFixed(5), 'SHAP value']}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
            itemStyle={{ color: '#e2e8f0' }}
            labelStyle={{ color: '#94a3b8' }}
          />
          <ReferenceLine x={0} stroke="#475569" />
          <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
            {sorted.map((item) => (
              <Cell
                key={item.feature}
                fill={item.value > 0 ? '#ef4444' : '#22d3ee'}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-red-500" /> Pushes toward attack
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-cyan-400" /> Pushes toward benign
        </span>
      </div>
    </div>
  );
};
