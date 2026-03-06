/**
 * SHAPForcePlot.tsx — Horizontal force/push-pull diagram for SHAP values.
 * Shows contributions pulling prediction toward "Attack" (red) or toward
 * "Benign" (cyan) from a base value to the final prediction.
 *
 * Instead of SVG path calculation (complex), we use a stacked-bar approach
 * that communicates the same directional narrative.
 */
import React, { useMemo } from 'react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ReferenceLine } from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';

interface SHAPForcePlotProps {
  shapValues: Record<string, number>;
  baseValue?: number;
  prediction?: string | number;
  topN?: number;
}

export const SHAPForcePlot: React.FC<SHAPForcePlotProps> = ({
  shapValues,
  baseValue = 0,
  prediction,
  topN = 10,
}) => {
  const { positiveFeatures, negativeFeatures, totalPositive, totalNegative } = useMemo(() => {
    const entries = Object.entries(shapValues)
      .map(([feature, value]) => ({ feature, value }))
      .sort((a, b) => Math.abs(b.value) - Math.abs(a.value))
      .slice(0, topN * 2);

    const pos = entries.filter((e) => e.value > 0)
      .sort((a, b) => b.value - a.value)
      .slice(0, topN);
    const neg = entries.filter((e) => e.value < 0)
      .sort((a, b) => a.value - b.value)
      .slice(0, topN);

    return {
      positiveFeatures: pos,
      negativeFeatures: neg,
      totalPositive: pos.reduce((s, e) => s + e.value, 0),
      totalNegative: neg.reduce((s, e) => s + e.value, 0),
    };
  }, [shapValues, topN]);

  const finalScore = baseValue + totalPositive + totalNegative;

  // Horizontal waterfall bars for top contributors
  const chartData = useMemo(() => {
    const pos = positiveFeatures.slice(0, 5).map((e) => ({
      ...e,
      displayName: e.feature.length > 18 ? e.feature.slice(0, 16) + '…' : e.feature,
      abs: e.value,
    }));
    const neg = negativeFeatures.slice(0, 5).map((e) => ({
      ...e,
      displayName: e.feature.length > 18 ? e.feature.slice(0, 16) + '…' : e.feature,
      abs: Math.abs(e.value),
    }));
    return [...pos, ...neg].sort((a, b) => Math.abs(b.value) - Math.abs(a.value)).slice(0, topN);
  }, [positiveFeatures, negativeFeatures, topN]);

  return (
    <div className="flex flex-col gap-4">
      {/* Summary strip */}
      <div className="rounded-lg border border-slate-700 bg-slate-800/50 p-3 flex items-center gap-4">
        <div className="text-xs text-slate-500 font-medium w-20 shrink-0">Base value</div>
        <div className="font-mono text-slate-300 text-sm">{baseValue.toFixed(4)}</div>

        <div className="flex-1 mx-1">
          {/* Two-sided force bar */}
          <div className="h-5 flex rounded-md overflow-hidden gap-px">
            {/* negative side (benign = left) */}
            <div
              className="bg-cyan-500/70 flex items-center justify-end pr-1 transition-all"
              style={{ flex: Math.abs(totalNegative) || 0.01 }}
              title={`Benign forces: ${totalNegative.toFixed(4)}`}
            >
              {Math.abs(totalNegative) > 0.05 && (
                <TrendingDown size={11} className="text-white/80" />
              )}
            </div>
            {/* base value divider */}
            <div className="w-0.5 bg-slate-500 shrink-0" />
            {/* positive side (attack = right) */}
            <div
              className="bg-red-500/70 flex items-center justify-start pl-1 transition-all"
              style={{ flex: totalPositive || 0.01 }}
              title={`Attack forces: ${totalPositive.toFixed(4)}`}
            >
              {totalPositive > 0.05 && (
                <TrendingUp size={11} className="text-white/80" />
              )}
            </div>
          </div>
        </div>

        <div className="text-xs text-slate-500 font-medium w-20 shrink-0 text-right">
          Final score
        </div>
        <div className={`font-mono text-sm font-bold ${finalScore > baseValue ? 'text-red-400' : 'text-cyan-400'}`}>
          {finalScore.toFixed(4)}
        </div>
        {prediction != null && (
          <div className={`text-xs font-bold px-2 py-0.5 rounded-full ${
            String(prediction).toLowerCase() !== 'normal' && String(prediction) !== '0'
              ? 'bg-red-500/20 text-red-300'
              : 'bg-emerald-500/20 text-emerald-300'
          }`}>
            {String(prediction)}
          </div>
        )}
      </div>

      {/* Feature contribution bars */}
      <p className="text-[10px] text-slate-500 -mb-2">
        Top feature contributions (red = toward Attack, cyan = toward Benign)
      </p>
      <ResponsiveContainer width="100%" height={Math.max(chartData.length * 26, 140)}>
        <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 48, top: 4, bottom: 4 }}>
          <XAxis
            type="number"
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
            tickFormatter={(v) => v.toFixed(3)}
          />
          <YAxis
            type="category"
            dataKey="displayName"
            width={120}
            tick={{ fill: '#94a3b8', fontSize: 10 }}
            tickLine={false}
            axisLine={false}
          />
          <Tooltip
            formatter={(v: number) => [v.toFixed(5), 'SHAP value']}
            contentStyle={{ background: '#0f172a', border: '1px solid #1e293b', borderRadius: 8, fontSize: 11 }}
          />
          <ReferenceLine x={0} stroke="#475569" />
          <Bar dataKey="value" maxBarSize={18} radius={[0, 3, 3, 0]}>
            {chartData.map((item) => (
              <Cell
                key={item.feature}
                fill={item.value > 0 ? '#ef4444' : '#22d3ee'}
                opacity={0.85}
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>

      {/* Legend */}
      <div className="flex gap-4 text-[10px] text-slate-500">
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-red-500" />
          Pushes toward Attack
        </span>
        <span className="flex items-center gap-1">
          <span className="inline-block h-2 w-4 rounded bg-cyan-400" />
          Pushes toward Benign
        </span>
      </div>
    </div>
  );
};
