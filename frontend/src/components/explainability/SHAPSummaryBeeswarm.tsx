/**
 * SHAPSummaryBeeswarm.tsx
 * Shows a dot chart of SHAP values → each feature on y-axis, SHAP value on x-axis.
 * Dots are coloured by normalised feature value (cyan = low, red = high).
 * Works with single-sample OR multi-sample SHAP arrays.
 */
import React, { useMemo } from 'react';
import {
  ResponsiveContainer, ScatterChart, Scatter, XAxis, YAxis,
  CartesianGrid, Tooltip, ReferenceLine, Cell,
} from 'recharts';

export interface SHAPEntry {
  feature: string;
  shap_value: number;
  value?: number; // raw feature value
}

interface Props {
  values: SHAPEntry[];
  topN?: number;
  className?: string;
}

/** Map 0→1 ratio to cyan→white→red colour */
function valueColour(ratio: number): string {
  // ratio in [0,1]: 0=low (cyan), 0.5=neutral (white/grey), 1=high (red)
  if (ratio < 0.5) {
    const t = ratio * 2; // 0→1
    const r = Math.round(6 + (255 - 6) * t);
    const g = Math.round(182 + (255 - 182) * t);
    const b = Math.round(212 + (255 - 212) * t);
    return `rgb(${r},${g},${b})`;
  } else {
    const t = (ratio - 0.5) * 2;
    const r = 248;
    const g = Math.round(255 - 141 * t);
    const b = Math.round(255 - 142 * t);
    return `rgb(${r},${g},${b})`;
  }
}

const CustomTooltip = ({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { feature: string; shap_value: number; value?: number } }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="font-semibold text-slate-200 mb-1 truncate max-w-[200px]">{d?.feature}</p>
      <p className="text-slate-400">
        SHAP: <span className={`font-mono ${(d?.shap_value ?? 0) > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
          {d?.shap_value?.toFixed(5)}
        </span>
      </p>
      {d?.value !== undefined && (
        <p className="text-slate-400">
          Feature value: <span className="text-white font-mono">{d.value.toFixed(4)}</span>
        </p>
      )}
    </div>
  );
};

export function SHAPSummaryBeeswarm({ values, topN = 20, className = '' }: Props) {
  const sorted = useMemo(
    () =>
      [...values]
        .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
        .slice(0, topN),
    [values, topN],
  );

  // Normalise feature values for colouring
  const rawVals = sorted.map((d) => d.value ?? 0);
  const vMin = Math.min(...rawVals);
  const vMax = Math.max(...rawVals);
  const vRange = vMax - vMin || 1;

  // Build scatter data: y = feature index (inverted for top-to-bottom render)
  const chartData = sorted.map((d, i) => ({
    feature: d.feature,
    shap_value: d.shap_value,
    value: d.value ?? 0,
    featureIdx: sorted.length - 1 - i,
    colourRatio: (( d.value ?? 0) - vMin) / vRange,
  }));

  if (!values || values.length === 0) {
    return (
      <div className={`text-center text-slate-500 py-8 text-sm ${className}`}>
        No SHAP values to display.
      </div>
    );
  }

  const tickFormatter = (idx: number) => {
    const found = chartData.find((d) => d.featureIdx === idx);
    const name = found?.feature ?? '';
    return name.length > 18 ? name.slice(0, 17) + '…' : name;
  };

  return (
    <div className={`space-y-2 ${className}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs text-slate-400">
          Top {Math.min(topN, values.length)} features by |SHAP|
        </p>
        <div className="flex items-center gap-2 text-[10px] text-slate-500">
          <span className="w-8 h-2 rounded inline-block" style={{ background: 'linear-gradient(to right, #06b6d4, #f87171)' }} />
          <span>low ← value → high</span>
        </div>
      </div>

      <ResponsiveContainer width="100%" height={Math.max(220, sorted.length * 22 + 40)}>
        <ScatterChart margin={{ top: 8, right: 20, left: 120, bottom: 16 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            type="number"
            dataKey="shap_value"
            name="SHAP value"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            tickFormatter={(v: number) => v.toFixed(3)}
            label={{ value: 'SHAP value', position: 'insideBottom', offset: -8, fill: '#64748b', fontSize: 10 }}
          />
          <YAxis
            type="number"
            dataKey="featureIdx"
            name="Feature"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={false}
            tickLine={false}
            tickFormatter={tickFormatter}
            domain={[-0.5, sorted.length - 0.5]}
            ticks={sorted.map((_, i) => sorted.length - 1 - i)}
            width={115}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={0} stroke="#475569" strokeDasharray="4 2" />
          <Scatter data={chartData}>
            {chartData.map((entry, index) => (
              <Cell
                key={`cell-${index}`}
                fill={valueColour(entry.colourRatio)}
                fillOpacity={0.85}
                r={6}
              />
            ))}
          </Scatter>
        </ScatterChart>
      </ResponsiveContainer>
    </div>
  );
}
