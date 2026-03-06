/**
 * LIMEBarChart.tsx — Production-grade LIME explanation panel.
 *
 * Layout (top → bottom):
 *   1. Prediction verdict + class probability split-bar
 *   2. Local fidelity (R²) quality indicator
 *   3. Annotated horizontal bar chart — one bar per LIME condition,
 *      coloured red (→ Attack) or cyan (→ Normal), with actual value label
 *   4. Plain-English "Why Attack?" summary from top contributors
 */
import React, { useMemo } from 'react';
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, Cell, ReferenceLine,
} from 'recharts';
import { ShieldAlert, ShieldCheck, Info } from 'lucide-react';
import type { LIMEResult } from '@/types';

interface LIMEBarChartProps {
  lime: LIMEResult;
  topN?: number;
}

// ── Fidelity badge colour ─────────────────────────────────────────────────────
function fidelityColor(score: number): string {
  if (score >= 0.85) return 'text-emerald-400';
  if (score >= 0.60) return 'text-amber-400';
  return 'text-red-400';
}

function fidelityLabel(score: number): string {
  if (score >= 0.85) return 'High';
  if (score >= 0.60) return 'Moderate';
  return 'Low';
}

// ── Custom tooltip ────────────────────────────────────────────────────────────
const CustomTooltip = ({
  active, payload,
}: {
  active?: boolean;
  payload?: Array<{ payload: { condition: string; weight: number; actual_value: number | null; feature_name: string } }>;
}) => {
  if (!active || !payload?.length) return null;
  const d = payload[0].payload;
  const direction = d.weight > 0 ? 'Pushes → Attack' : 'Pushes → Normal';
  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-3 text-xs shadow-xl max-w-xs">
      <p className="text-slate-300 font-semibold mb-1 break-words">{d.condition}</p>
      <p className="text-slate-400">Feature: <span className="text-white font-mono">{d.feature_name}</span></p>
      {d.actual_value != null && (
        <p className="text-slate-400">Actual value: <span className="text-cyan-300 font-mono">{d.actual_value.toFixed(4)}</span></p>
      )}
      <p className={`font-semibold mt-1 ${d.weight > 0 ? 'text-red-400' : 'text-cyan-400'}`}>
        Weight: {d.weight > 0 ? '+' : ''}{d.weight.toFixed(5)} — {direction}
      </p>
    </div>
  );
};

export const LIMEBarChart: React.FC<LIMEBarChartProps> = ({ lime, topN = 15 }) => {
  // ── Build chart data ────────────────────────────────────────────────────────
  const chartData = useMemo(() => {
    // Prefer structured feature_details (new backend); fall back to feature_weights
    if (lime.feature_details && lime.feature_details.length > 0) {
      return [...lime.feature_details]
        .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
        .slice(0, topN)
        .map((d) => ({
          condition: d.condition,
          feature_name: d.feature_name,
          actual_value: d.actual_value,
          weight: d.weight,
          // Truncate condition label for chart axis
          label: d.condition.length > 38 ? d.condition.slice(0, 36) + '…' : d.condition,
        }));
    }
    return Object.entries(lime.feature_weights)
      .map(([condition, weight]) => ({
        condition,
        feature_name: condition.split(' ')[0],
        actual_value: null as number | null,
        weight,
        label: condition.length > 38 ? condition.slice(0, 36) + '…' : condition,
      }))
      .sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight))
      .slice(0, topN);
  }, [lime, topN]);

  if (chartData.length === 0) {
    return (
      <p className="text-gray-500 text-sm text-center py-6">No LIME feature data available.</p>
    );
  }

  // ── Prediction metadata ─────────────────────────────────────────────────────
  const predLabel = lime.prediction_label;
  const probs = lime.prediction_probabilities ?? {};
  const attackProb = probs['Attack'] ?? (lime.prediction_proba?.[1] ?? null);
  const normalProb = probs['Normal'] ?? (lime.prediction_proba?.[0] ?? null);
  const isAttack = predLabel === 'Attack' || (attackProb != null && attackProb >= 0.5);
  const fidelity = lime.fidelity_score ?? lime.local_fidelity ?? lime.intercept ?? null;

  // Plain-English top contributors
  const topAttack = chartData.filter((d) => d.weight > 0).slice(0, 3);
  const topNormal = chartData.filter((d) => d.weight < 0).slice(0, 2);

  return (
    <div className="space-y-4">
      {/* ── Verdict header ──────────────────────────────────────────────── */}
      <div className={`rounded-xl p-4 border ${
        isAttack ? 'bg-red-500/10 border-red-500/30' : 'bg-emerald-500/10 border-emerald-500/30'
      } flex items-start gap-3`}>
        {isAttack
          ? <ShieldAlert size={24} className="text-red-400 shrink-0 mt-0.5" />
          : <ShieldCheck size={24} className="text-emerald-400 shrink-0 mt-0.5" />
        }
        <div className="flex-1 min-w-0">
          <p className={`text-base font-bold ${isAttack ? 'text-red-300' : 'text-emerald-300'}`}>
            {predLabel ?? (isAttack ? 'Attack' : 'Normal')}
          </p>
          {/* Split probability bar */}
          {attackProb != null && normalProb != null && (
            <div className="mt-2 space-y-1">
              <div className="flex items-center gap-2 text-xs text-slate-400">
                <span className="w-14 text-right text-cyan-400 font-mono">{(normalProb * 100).toFixed(1)}%</span>
                <div className="flex-1 h-3 rounded-full overflow-hidden bg-slate-700 flex">
                  <div
                    className="bg-cyan-400 transition-all"
                    style={{ width: `${normalProb * 100}%` }}
                  />
                  <div
                    className="bg-red-400 transition-all"
                    style={{ width: `${attackProb * 100}%` }}
                  />
                </div>
                <span className="w-14 text-left text-red-400 font-mono">{(attackProb * 100).toFixed(1)}%</span>
              </div>
              <div className="flex justify-between text-[10px] text-slate-500 px-16">
                <span>Normal</span>
                <span>Attack</span>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* ── Fidelity indicator ──────────────────────────────────────────── */}
      {fidelity != null && (
        <div className="flex items-center gap-2 rounded-lg bg-slate-800 px-4 py-2.5 text-sm">
          <Info size={14} className="text-slate-400 shrink-0" />
          <span className="text-slate-400">Local Fidelity (R²):</span>
          <span className={`font-mono font-semibold ${fidelityColor(fidelity)}`}>
            {fidelity.toFixed(3)}
          </span>
          <span className={`text-xs ${fidelityColor(fidelity)}`}>— {fidelityLabel(fidelity)}</span>
          <span className="text-slate-600 text-xs ml-auto">
            How well the local model approximates the real model
          </span>
        </div>
      )}

      {/* ── Legend ──────────────────────────────────────────────────────── */}
      <div className="flex gap-5 text-xs text-slate-400">
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded bg-red-500/80 inline-block" />
          Pushes prediction toward <strong className="text-red-300">Attack</strong>
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 h-3 rounded bg-cyan-500/80 inline-block" />
          Pushes prediction toward <strong className="text-cyan-300">Normal</strong>
        </span>
      </div>

      {/* ── Bar chart ───────────────────────────────────────────────────── */}
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 30, 180)}>
        <BarChart
          data={[...chartData].sort((a, b) => a.weight - b.weight)}
          layout="vertical"
          margin={{ left: 8, right: 64, top: 4, bottom: 4 }}
        >
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
            dataKey="label"
            width={190}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip content={<CustomTooltip />} />
          <ReferenceLine x={0} stroke="#64748b" strokeWidth={1.5} />
          <Bar dataKey="weight" radius={[0, 4, 4, 0]} maxBarSize={22}
               label={{
                 position: 'right',
                 formatter: (v: number) => v > 0 ? `+${v.toFixed(4)}` : v.toFixed(4),
                 fill: '#9ca3af',
                 fontSize: 9,
               }}
          >
            {[...chartData].sort((a, b) => a.weight - b.weight).map((item, idx) => (
              <Cell key={idx} fill={item.weight > 0 ? '#ef4444' : '#22d3ee'} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* ── Plain-English verdict ────────────────────────────────────────── */}
      {(topAttack.length > 0 || topNormal.length > 0) && (
        <div className="rounded-xl bg-slate-800/60 border border-slate-700 p-4 text-sm space-y-3">
          <p className="text-slate-300 font-semibold text-sm">Why did the model predict this?</p>
          {topAttack.length > 0 && (
            <div>
              <p className="text-red-300 text-xs font-medium mb-1.5">Factors supporting Attack:</p>
              <ul className="space-y-1">
                {topAttack.map((d, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-red-400 shrink-0">▲</span>
                    <span>
                      <code className="text-slate-200 font-mono">{d.condition}</code>
                      {d.actual_value != null && (
                        <span className="text-slate-500"> (actual: <code className="text-cyan-400">{d.actual_value.toFixed(4)}</code>)</span>
                      )}
                      <span className="text-red-400 ml-1">+{d.weight.toFixed(4)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          {topNormal.length > 0 && (
            <div>
              <p className="text-cyan-300 text-xs font-medium mb-1.5">Factors supporting Normal:</p>
              <ul className="space-y-1">
                {topNormal.map((d, i) => (
                  <li key={i} className="text-xs text-slate-400 flex gap-2">
                    <span className="text-cyan-400 shrink-0">▼</span>
                    <span>
                      <code className="text-slate-200 font-mono">{d.condition}</code>
                      {d.actual_value != null && (
                        <span className="text-slate-500"> (actual: <code className="text-cyan-400">{d.actual_value.toFixed(4)}</code>)</span>
                      )}
                      <span className="text-cyan-400 ml-1">{d.weight.toFixed(4)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          )}
          <p className="text-slate-600 text-xs mt-2">
            * Conditions are evaluated in the scaled [0,1] feature space after MinMax normalisation.
            A higher value means the feature is near its maximum observed training value.
          </p>
        </div>
      )}
    </div>
  );
};
