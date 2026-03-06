/**
 * FeatureContextTable.tsx
 * Shows input feature values next to contextual stats (mean ± std, range).
 * Used on PredictionPage and ExplainabilityPage to give the user a sense of
 * whether their input values are typical or outlier-like.
 */
import React, { useMemo } from 'react';
import { ArrowUp, ArrowDown, Minus } from 'lucide-react';

interface FeatureContext {
  mean?: number;
  std?: number;
  min?: number;
  max?: number;
  median?: number;
}

interface FeatureContextTableProps {
  /** Input feature values as provided for prediction/explanation */
  features: Record<string, unknown>;
  /** Optional: per-feature stats from the dataset (e.g. from activeSummary.columns) */
  context?: Record<string, FeatureContext>;
  /** SHAP values — used to highlight the most impactful features */
  shapHighlight?: Record<string, number>;
  topN?: number;
  className?: string;
}

type ZScore = 'high' | 'low' | 'normal' | 'unknown';

function zScore(value: number, mean: number, std: number): number | null {
  if (std === 0) return null;
  return (value - mean) / std;
}

function classifyZ(z: number | null): ZScore {
  if (z === null) return 'unknown';
  if (z > 2) return 'high';
  if (z < -2) return 'low';
  return 'normal';
}

const ZIcon: React.FC<{ z: ZScore }> = ({ z }) => {
  if (z === 'high') return <ArrowUp size={11} className="text-amber-400 shrink-0" />;
  if (z === 'low') return <ArrowDown size={11} className="text-blue-400 shrink-0" />;
  if (z === 'normal') return <Minus size={11} className="text-emerald-500 shrink-0" />;
  return null;
};

const zLabel: Record<ZScore, string> = {
  high: 'Above normal',
  low: 'Below normal',
  normal: 'Typical',
  unknown: '',
};

export const FeatureContextTable: React.FC<FeatureContextTableProps> = ({
  features,
  context = {},
  shapHighlight = {},
  topN = 15,
  className = '',
}) => {
  const rows = useMemo(() => {
    const allFeatures = Object.keys(features);

    // Sort by |SHAP value| if provided, else alphabetical
    const hasSHAP = Object.keys(shapHighlight).length > 0;
    const sorted = hasSHAP
      ? allFeatures.sort((a, b) => (Math.abs(shapHighlight[b] ?? 0)) - (Math.abs(shapHighlight[a] ?? 0)))
      : allFeatures.sort();

    return sorted.slice(0, topN).map((name) => {
      const raw = features[name];
      const numVal = typeof raw === 'number' ? raw : Number(raw);
      const isNum = !Number.isNaN(numVal);
      const ctx = context[name];
      const z = isNum && ctx?.mean != null && ctx?.std != null
        ? zScore(numVal, ctx.mean, ctx.std)
        : null;
      const zClass = classifyZ(z);
      const shap = shapHighlight[name];

      return { name, raw, numVal, isNum, ctx, zClass, shap };
    });
  }, [features, context, shapHighlight, topN]);

  if (rows.length === 0) return null;

  return (
    <div className={`rounded-xl border border-slate-700 bg-slate-900/50 overflow-hidden ${className}`}>
      <div className="px-4 py-2.5 border-b border-slate-700 flex items-center justify-between">
        <p className="text-xs font-semibold text-slate-300 uppercase tracking-wider">
          Feature Context
        </p>
        <p className="text-[10px] text-slate-500">
          {Object.keys(features).length > topN
            ? `Top ${topN} of ${Object.keys(features).length} features`
            : `${rows.length} features`}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-800">
              <th className="text-left py-2 px-4 font-medium text-slate-500">Feature</th>
              <th className="text-right py-2 px-3 font-medium text-slate-500">Input</th>
              {Object.keys(context).length > 0 && (
                <>
                  <th className="text-right py-2 px-3 font-medium text-slate-500">Mean ± Std</th>
                  <th className="text-center py-2 px-3 font-medium text-slate-500">Status</th>
                </>
              )}
              {Object.keys(shapHighlight).length > 0 && (
                <th className="text-right py-2 px-3 font-medium text-slate-500">SHAP</th>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map(({ name, raw, numVal, isNum, ctx, zClass, shap }, idx) => (
              <tr
                key={name}
                className={`border-b border-slate-800/50 transition-colors hover:bg-slate-800/40 ${
                  idx === 0 && shap != null ? 'bg-slate-800/20' : ''
                }`}
              >
                {/* Feature name */}
                <td className="py-2 px-4 text-slate-300 font-medium max-w-[160px]">
                  <span className="truncate block" title={name}>{name}</span>
                </td>

                {/* Input value */}
                <td className="py-2 px-3 text-right font-mono text-slate-200">
                  {isNum ? numVal.toLocaleString(undefined, { maximumFractionDigits: 4 }) : String(raw)}
                </td>

                {/* Mean ± Std */}
                {Object.keys(context).length > 0 && (
                  <td className="py-2 px-3 text-right text-slate-500 font-mono">
                    {ctx?.mean != null && ctx?.std != null
                      ? `${ctx.mean.toFixed(2)} ± ${ctx.std.toFixed(2)}`
                      : <span className="text-slate-700">—</span>}
                  </td>
                )}

                {/* Status icon */}
                {Object.keys(context).length > 0 && (
                  <td className="py-2 px-3">
                    <div className="flex items-center justify-center gap-1">
                      <ZIcon z={zClass} />
                      {zClass !== 'unknown' && (
                        <span className={`${
                          zClass === 'high' ? 'text-amber-400' :
                          zClass === 'low' ? 'text-blue-400' :
                          'text-emerald-500'
                        }`}>
                          {zLabel[zClass]}
                        </span>
                      )}
                    </div>
                  </td>
                )}

                {/* SHAP value */}
                {Object.keys(shapHighlight).length > 0 && (
                  <td className="py-2 px-3 text-right font-mono">
                    {shap != null ? (
                      <span className={shap > 0 ? 'text-red-400' : 'text-cyan-400'}>
                        {shap > 0 ? '+' : ''}{shap.toFixed(4)}
                      </span>
                    ) : (
                      <span className="text-slate-700">—</span>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
};
