/**
 * SHAPWaterfall.tsx — SHAP feature contributions.
 *
 * Renders two views toggled by the user:
 *   1. "Contributions" — signed horizontal bars, sorted by |SHAP|, with
 *      actual feature value + % contribution in tooltip.
 *   2. "Cumulative" — true waterfall showing base → each step → final score
 *      (uses cumulative_waterfall from backend if present).
 *
 * Positive (red) = pushes toward Attack.
 * Negative (cyan) = pushes toward Normal / Benign.
 */
import React, { useState } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';

interface CumulativeEntry {
  feature: string;
  value: number;
  shap_value: number;
  start: number;
  end: number;
  pct_contribution: number;
}

interface SHAPWaterfallProps {
  shapValues: Record<string, number>;
  /** Structured entries with feature values + cumulative positions */
  cumulativeWaterfall?: CumulativeEntry[];
  /** Per-feature details from backend values[] array */
  featureDetails?: Array<{ feature: string; value: number; shap_value: number; pct_contribution?: number }>;
  topN?: number;
  baseValue?: number;
  predictionLabel?: string;
  attackProbability?: number;
}

// ── Tooltip for contribution view ────────────────────────────────────────────
const ContribTooltip = ({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { fullName: string; value: number; feat_value?: number; pct?: number } }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const direction = d.value > 0 ? '→ Pushes toward Attack' : '→ Pushes toward Normal';
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-white font-semibold mb-1 max-w-[220px] break-words">{d.fullName}</p>
      <p className="text-slate-400">
        SHAP: <span className={`font-mono font-bold ${d.value > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
          {d.value > 0 ? '+' : ''}{d.value.toFixed(5)}
        </span>
      </p>
      {d.feat_value != null && (
        <p className="text-slate-400">Feature value: <span className="text-cyan-300 font-mono">{d.feat_value.toFixed(4)}</span></p>
      )}
      {d.pct != null && (
        <p className="text-slate-400">Contribution: <span className="text-amber-300 font-mono">{d.pct.toFixed(1)}%</span></p>
      )}
      <p className={`text-xs mt-1 ${d.value > 0 ? 'text-red-400' : 'text-cyan-400'}`}>{direction}</p>
    </div>
  );
};

// ── Tooltip for waterfall view ────────────────────────────────────────────────
const WaterfallTooltip = ({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { label: string; shap_value?: number; end: number; pct?: number; feat_value?: number } }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl">
      <p className="text-white font-semibold mb-1 max-w-[220px] break-words">{d.label}</p>
      {d.shap_value != null && (
        <p className="text-slate-400">
          SHAP: <span className={`font-mono font-bold ${d.shap_value > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
            {d.shap_value > 0 ? '+' : ''}{d.shap_value.toFixed(5)}
          </span>
        </p>
      )}
      {d.feat_value != null && (
        <p className="text-slate-400">Feature value: <span className="text-cyan-300 font-mono">{d.feat_value.toFixed(4)}</span></p>
      )}
      {d.pct != null && (
        <p className="text-slate-400">Share: <span className="text-amber-300 font-mono">{d.pct.toFixed(1)}%</span></p>
      )}
      <p className="text-slate-400">Running score: <span className="text-white font-mono">{d.end.toFixed(4)}</span></p>
    </div>
  );
};

export const SHAPWaterfall: React.FC<SHAPWaterfallProps> = ({
  shapValues,
  cumulativeWaterfall,
  featureDetails,
  topN = 20,
  baseValue = 0,
  predictionLabel,
  attackProbability,
}) => {
  const [viewMode, setViewMode] = useState<'contributions' | 'waterfall'>(
    cumulativeWaterfall && cumulativeWaterfall.length > 0 ? 'contributions' : 'contributions'
  );

  // ── Build contribution chart data ─────────────────────────────────────────
  const contribData = React.useMemo(() => {
    // Prefer featureDetails (has actual values) → fall back to shapValues dict
    if (featureDetails && featureDetails.length > 0) {
      return [...featureDetails]
        .sort((a, b) => Math.abs(b.shap_value) - Math.abs(a.shap_value))
        .slice(0, topN)
        .map((d) => ({
          name: d.feature.length > 22 ? d.feature.slice(0, 20) + '…' : d.feature,
          fullName: d.feature,
          value: d.shap_value,
          feat_value: d.value,
          pct: d.pct_contribution ?? null,
        }));
    }
    return Object.entries(shapValues)
      .map(([feature, value]) => ({ name: feature.length > 22 ? feature.slice(0, 20) + '…' : feature, fullName: feature, value, feat_value: undefined, pct: null }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, topN);
  }, [shapValues, featureDetails, topN]);

  // ── Build waterfall chart data ────────────────────────────────────────────
  const waterfallData = React.useMemo(() => {
    const src = cumulativeWaterfall && cumulativeWaterfall.length > 0
      ? cumulativeWaterfall
      : null;
    if (!src) return null;

    // Base row + feature rows + final row
    const rows: Array<{
      label: string; start: number; width: number; end: number;
      color: string; shap_value?: number; pct?: number; feat_value?: number;
    }> = [];

    rows.push({ label: 'E[f(X)] — Base', start: 0, width: baseValue, end: baseValue, color: '#6b7280' });
    for (const entry of src) {
      const start = entry.shap_value >= 0 ? entry.start : entry.end;
      rows.push({
        label: entry.feature.length > 26 ? entry.feature.slice(0, 24) + '…' : entry.feature,
        start,
        width: Math.abs(entry.shap_value),
        end: entry.end,
        color: entry.shap_value > 0 ? '#ef4444' : '#22d3ee',
        shap_value: entry.shap_value,
        pct: entry.pct_contribution,
        feat_value: entry.value,
      });
    }
    const finalVal = src[src.length - 1]?.end ?? baseValue;
    rows.push({ label: 'f(x) — Final score', start: 0, width: finalVal, end: finalVal, color: '#f59e0b' });
    return rows;
  }, [cumulativeWaterfall, baseValue]);

  if (contribData.length === 0) return null;

  const hasWaterfall = waterfallData !== null && waterfallData.length > 0;
  const sortedContrib = [...contribData].sort((a, b) => a.value - b.value);

  return (
    <div className="flex flex-col gap-3">
      {/* Metadata + view toggle */}
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3 text-xs text-slate-400 flex-wrap">
          {baseValue !== 0 && (
            <span className="flex items-center gap-1">
              Base: <code className="text-slate-200 font-mono">{baseValue.toFixed(4)}</code>
            </span>
          )}
          {predictionLabel && (
            <span className={`font-semibold px-2 py-0.5 rounded-full text-xs ${
              predictionLabel.toLowerCase() !== 'normal' && predictionLabel !== '0'
                ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'
            }`}>
              {predictionLabel}
            </span>
          )}
          {attackProbability != null && (
            <span>Attack: <code className="text-red-300 font-mono">{(attackProbability * 100).toFixed(1)}%</code></span>
          )}
        </div>
        {hasWaterfall && (
          <div className="flex gap-1 rounded-lg overflow-hidden border border-slate-700 text-xs">
            {(['contributions', 'waterfall'] as const).map((mode) => (
              <button
                key={mode}
                onClick={() => setViewMode(mode)}
                className={`px-3 py-1.5 transition-colors ${
                  viewMode === mode
                    ? 'bg-indigo-600 text-white'
                    : 'bg-slate-800 text-slate-400 hover:text-slate-200'
                }`}
              >
                {mode === 'contributions' ? 'Contributions' : 'Waterfall'}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Legend */}
      <div className="flex gap-5 text-[11px] text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded bg-red-500" /> Toward Attack
        </span>
        <span className="flex items-center gap-1.5">
          <span className="inline-block h-2.5 w-4 rounded bg-cyan-400" /> Toward Normal
        </span>
        {hasWaterfall && viewMode === 'waterfall' && (
          <span className="flex items-center gap-1.5">
            <span className="inline-block h-2.5 w-4 rounded bg-amber-400" /> Final score
          </span>
        )}
      </div>

      {/* Contribution bar chart */}
      {viewMode === 'contributions' && (
        <ResponsiveContainer width="100%" height={Math.max(sortedContrib.length * 26, 160)}>
          <BarChart data={sortedContrib} layout="vertical" margin={{ left: 8, right: 16, top: 4, bottom: 4 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
            <XAxis
              type="number"
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => v >= 0 ? `+${v.toFixed(3)}` : v.toFixed(3)}
            />
            <YAxis
              type="category"
              dataKey="name"
              width={130}
              tick={{ fill: '#94a3b8', fontSize: 10 }}
              tickLine={false}
              axisLine={false}
            />
            <Tooltip content={<ContribTooltip />} />
            <ReferenceLine x={0} stroke="#475569" strokeWidth={1.5} />
            <Bar dataKey="value" radius={[0, 4, 4, 0]} maxBarSize={20}>
              {sortedContrib.map((entry, idx) => (
                <Cell key={idx} fill={entry.value > 0 ? '#ef4444' : '#22d3ee'} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      )}

      {/* Cumulative waterfall chart */}
      {viewMode === 'waterfall' && hasWaterfall && waterfallData && (
        <div className="space-y-1">
          <p className="text-[11px] text-slate-500">
            Each bar shows how a feature moves the score from the base value toward the final prediction.
          </p>
          <ResponsiveContainer width="100%" height={Math.max(waterfallData.length * 28, 200)}>
            <BarChart
              data={waterfallData}
              layout="vertical"
              margin={{ left: 8, right: 16, top: 4, bottom: 4 }}
            >
              <CartesianGrid strokeDasharray="3 3" stroke="#1e293b" horizontal={false} />
              <XAxis
                type="number"
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                type="category"
                dataKey="label"
                width={150}
                tick={{ fill: '#94a3b8', fontSize: 10 }}
                tickLine={false}
                axisLine={false}
              />
              <Tooltip content={<WaterfallTooltip />} />
              <ReferenceLine x={0.5} stroke="#fbbf24" strokeDasharray="4 2" strokeWidth={1.5} label={{ value: 'threshold', fill: '#fbbf24', fontSize: 9, position: 'insideTopLeft' }} />
              <Bar dataKey="width" stackId="stack" radius={[0, 4, 4, 0]} maxBarSize={22}>
                {waterfallData.map((entry, idx) => (
                  <Cell key={idx} fill={entry.color} />
                ))}
              </Bar>
              {/* Invisible bar to set start position */}
              <Bar dataKey="start" stackId="stack" fill="transparent" maxBarSize={22} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
};
