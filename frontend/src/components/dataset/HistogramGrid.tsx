/** HistogramGrid.tsx — Grid of small histograms, one per numeric column */
import React from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { toHistogramBins } from '@/utils/vizDataTransformers';
import { CATEGORICAL_10 } from '@/utils/colorSchemes';

interface ColumnHistogram {
  edges?: number[];
  bins?: number[];    // backend returns "bins", not "edges"
  counts?: number[];  // guard: may be missing for categorical columns
}

interface HistogramGridProps {
  /** { column_name: { edges: number[], counts: number[] } } */
  data: Record<string, ColumnHistogram>;
  maxCols?: number;
}

export const HistogramGrid: React.FC<HistogramGridProps> = ({ data, maxCols = 12 }) => {
  const cols = Object.keys(data).slice(0, maxCols);
  if (cols.length === 0) return null;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {cols.map((col, idx) => {
        const bins = toHistogramBins(data[col]);
        return (
          <div key={col} className="rounded-lg bg-slate-900/50 p-2">
            <p className="mb-1 truncate text-[10px] font-medium text-slate-400" title={col}>
              {col}
            </p>
            <ResponsiveContainer width="100%" height={80}>
              <BarChart data={bins} margin={{ top: 0, right: 0, bottom: 0, left: 0 }}>
                <XAxis dataKey="bin_start" hide />
                <YAxis hide />
                <Tooltip
                  formatter={(v: number) => [v, 'count']}
                  contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 6, fontSize: 10 }}
                  itemStyle={{ color: '#e2e8f0' }}
                  labelStyle={{ color: '#94a3b8' }}
                />
                <Bar dataKey="count" fill={CATEGORICAL_10[idx % CATEGORICAL_10.length]} radius={[2, 2, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        );
      })}
    </div>
  );
};
