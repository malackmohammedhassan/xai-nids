/**
 * ViolinChart.tsx
 * Displays boxplot-style distribution comparison across classes for each feature.
 * Renders an interactive bar chart showing Q1/Median/Q3 spread per class.
 * Data: { data: ViolinFeature[], target_column: string }
 */
import React, { useState } from 'react';
import {
  ComposedChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Legend, ReferenceLine,
} from 'recharts';

export interface ViolinClass {
  class: string;
  count: number;
  mean: number;
  median: number;
  q1: number;
  q3: number;
  min: number;
  max: number;
}

export interface ViolinFeature {
  feature: string;
  classes: ViolinClass[];
}

interface ViolinData {
  data: ViolinFeature[];
  target_column?: string;
  viz_type?: string;
}

interface ViolinChartProps {
  data: ViolinData;
  className?: string;
}

const CLASS_COLOURS = [
  '#06b6d4', '#f87171', '#a78bfa', '#fbbf24', '#34d399', '#f472b6',
];

/** Build recharts data array for a selected feature */
function buildChartData(feature: ViolinFeature) {
  return feature.classes.map((cls) => ({
    class: cls.class,
    q1: cls.q1,
    iqr: Math.max(0, cls.q3 - cls.q1),
    median: cls.median,
    min: cls.min,
    max: cls.max,
    count: cls.count,
  }));
}

const CustomTooltip = ({
  active, payload, label,
}: {
  active?: boolean;
  payload?: Array<{ name: string; value: number; fill: string; payload: Record<string, unknown> }>;
  label?: string;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0]?.payload as {
    q1: number; iqr: number; median: number; min: number; max: number; count: number;
  };
  if (!d) return null;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs space-y-1 shadow-xl">
      <p className="font-semibold text-slate-200 mb-1">{label}</p>
      <p className="text-slate-400">Min: <span className="text-cyan-400">{d.min?.toFixed(4)}</span></p>
      <p className="text-slate-400">Q1: <span className="text-cyan-400">{d.q1?.toFixed(4)}</span></p>
      <p className="text-slate-400">Median: <span className="text-white font-semibold">{d.median?.toFixed(4)}</span></p>
      <p className="text-slate-400">Q3: <span className="text-cyan-400">{(d.q1 + d.iqr)?.toFixed(4)}</span></p>
      <p className="text-slate-400">Max: <span className="text-cyan-400">{d.max?.toFixed(4)}</span></p>
      <p className="text-slate-500 text-[10px]">n={d.count}</p>
    </div>
  );
};

export function ViolinChart({ data, className = '' }: ViolinChartProps) {
  const [selectedFeature, setSelectedFeature] = useState(0);

  if (!data?.data || data.data.length === 0) {
    return (
      <div className={`text-center text-slate-500 py-10 text-sm ${className}`}>
        No feature distribution data available.
      </div>
    );
  }

  const feature = data.data[Math.min(selectedFeature, data.data.length - 1)];
  const chartData = buildChartData(feature);
  const classes = feature.classes.map((c) => c.class);

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Feature selector */}
      <div className="flex items-center gap-3">
        <label className="text-xs text-slate-400 shrink-0">Feature:</label>
        <select
          value={selectedFeature}
          onChange={(e) => setSelectedFeature(Number(e.target.value))}
          className="bg-slate-900 border border-slate-700 text-slate-200 text-xs rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-600 flex-1 max-w-xs"
        >
          {data.data.map((f, i) => (
            <option key={f.feature} value={i}>
              {f.feature}
            </option>
          ))}
        </select>
        {data.target_column && (
          <span className="text-[10px] text-slate-600">
            grouped by <span className="text-slate-400 font-mono">{data.target_column}</span>
          </span>
        )}
      </div>

      {/* IQR bar chart (Q1 as base, IQR as height) */}
      <ResponsiveContainer width="100%" height={280}>
        <ComposedChart data={chartData} margin={{ top: 8, right: 20, left: 10, bottom: 24 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" />
          <XAxis
            dataKey="class"
            tick={{ fill: '#94a3b8', fontSize: 11 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
          />
          <YAxis
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            axisLine={{ stroke: '#334155' }}
            tickLine={false}
            width={55}
          />
          <Tooltip content={<CustomTooltip />} />
          <Legend
            wrapperStyle={{ fontSize: 11, color: '#94a3b8', paddingTop: 8 }}
          />
          {/* Q1 (transparent base to lift the IQR bar) */}
          <Bar dataKey="q1" name="Q1 base" stackId="box" fill="transparent" legendType="none" />
          {/* IQR bar */}
          <Bar
            dataKey="iqr"
            name="IQR (Q1→Q3)"
            stackId="box"
            fill="#06b6d4"
            fillOpacity={0.65}
            radius={[3, 3, 0, 0]}
          />
          {/* Median as reference dots via scatter workaround — show as ReferenceLine per class */}
        </ComposedChart>
      </ResponsiveContainer>

      {/* Class stat pills */}
      <div className="flex flex-wrap gap-2">
        {feature.classes.map((cls, i) => (
          <div
            key={cls.class}
            className="bg-slate-900 border border-slate-700 rounded-lg px-3 py-2 text-xs space-y-0.5"
          >
            <div
              className="font-semibold"
              style={{ color: CLASS_COLOURS[i % CLASS_COLOURS.length] }}
            >
              {cls.class}
            </div>
            <div className="text-slate-500">
              med={cls.median.toFixed(3)} · mean={cls.mean.toFixed(3)} · n={cls.count}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
