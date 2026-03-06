/** PCAScatterPlot.tsx — 2-D PCA scatter, coloured by class label */
import React, { useMemo } from 'react';
import { ScatterChart, Scatter, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ZAxis } from 'recharts';
import { toPCAPoints } from '@/utils/vizDataTransformers';
import { labelColour } from '@/utils/colorSchemes';
import { ATTACK_COLOUR } from '@/utils/colorSchemes';

interface PCAScatterPlotProps {
  data: {
    pc1: number[];
    pc2: number[];
    labels?: string[];
    anomaly_mask?: boolean[];
    explained_variance?: [number, number];
  };
  maxPoints?: number;
}

export const PCAScatterPlot: React.FC<PCAScatterPlotProps> = ({ data, maxPoints = 3000 }) => {
  const points = useMemo(() => {
    const all = toPCAPoints(data);
    // Subsample for performance
    if (all.length <= maxPoints) return all;
    const step = Math.ceil(all.length / maxPoints);
    return all.filter((_, i) => i % step === 0);
  }, [data, maxPoints]);

  // Group by label for separate <Scatter> series
  const groups = useMemo(() => {
    const map: Record<string, { pc1: number; pc2: number; anomaly?: boolean }[]> = {};
    for (const p of points) {
      const key = p.label ?? 'unknown';
      if (!map[key]) map[key] = [];
      map[key].push({ pc1: p.pc1, pc2: p.pc2, anomaly: p.anomaly });
    }
    return map;
  }, [points]);

  const ev = data.explained_variance;

  return (
    <div className="flex flex-col gap-2">
      {ev && (
        <p className="text-xs text-slate-500">
          PC1: {(ev[0] * 100).toFixed(1)}% variance | PC2: {(ev[1] * 100).toFixed(1)}% variance
        </p>
      )}
      <ResponsiveContainer width="100%" height={360}>
        <ScatterChart margin={{ top: 8, right: 8, bottom: 8, left: 8 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="pc1"
            type="number"
            name="PC1"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            dataKey="pc2"
            type="number"
            name="PC2"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            tickLine={false}
            axisLine={false}
          />
          <ZAxis range={[8, 8]} />
          <Tooltip
            cursor={{ strokeDasharray: '3 3' }}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8 }}
          />
          {Object.entries(groups).map(([label, pts]) => (
            <Scatter
              key={label}
              name={label}
              data={pts}
              fill={labelColour(label)}
              opacity={0.7}
            />
          ))}
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
};
