/** TSNEScatterPlot.tsx — 2-D t-SNE scatter, coloured by class label */
import React, { useMemo } from 'react';
import {
  ScatterChart, Scatter, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer, ZAxis, Legend,
} from 'recharts';
import { toTSNEPoints } from '@/utils/vizDataTransformers';
import { labelColour } from '@/utils/colorSchemes';

interface TSNEScatterPlotProps {
  data: {
    x: number[];
    y: number[];
    labels?: string[];
  };
  maxPoints?: number;
}

export const TSNEScatterPlot: React.FC<TSNEScatterPlotProps> = ({
  data,
  maxPoints = 3000,
}) => {
  const points = useMemo(() => {
    const all = toTSNEPoints(data);
    if (all.length <= maxPoints) return all;
    const step = Math.ceil(all.length / maxPoints);
    return all.filter((_, i) => i % step === 0);
  }, [data, maxPoints]);

  // Group by label for separate <Scatter> series
  const groups = useMemo(() => {
    const map: Record<string, { x: number; y: number }[]> = {};
    for (const p of points) {
      const key = p.label ?? 'unknown';
      if (!map[key]) map[key] = [];
      map[key].push({ x: p.x, y: p.y });
    }
    return map;
  }, [points]);

  const labelEntries = Object.keys(groups);

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs text-slate-500">
        t-SNE non-linear projection · {points.length.toLocaleString()} points
        {points.length < (data.x?.length ?? 0) && (
          <span className="ml-1 text-slate-600">
            (sub-sampled from {(data.x?.length ?? 0).toLocaleString()})
          </span>
        )}
      </p>
      <ResponsiveContainer width="100%" height={380}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="x"
            type="number"
            name="Dim 1"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Dim 1', position: 'insideBottomRight', offset: -4, fill: '#64748b', fontSize: 10 }}
          />
          <YAxis
            dataKey="y"
            type="number"
            name="Dim 2"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
            label={{ value: 'Dim 2', angle: -90, position: 'insideLeft', fill: '#64748b', fontSize: 10 }}
          />
          <ZAxis range={[8, 8]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{
              background: '#0f172a',
              border: '1px solid #1e293b',
              borderRadius: 8,
              fontSize: 12,
            }}
          />
          {labelEntries.length > 1 && (
            <Legend
              wrapperStyle={{ fontSize: 11, color: '#94a3b8' }}
              formatter={(value) => (
                <span style={{ color: labelColour(value), fontSize: 11 }}>{value}</span>
              )}
            />
          )}
          {labelEntries.map((label) => (
            <Scatter
              key={label}
              name={label}
              data={groups[label]}
              fill={labelColour(label)}
              opacity={0.65}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
