import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Loader2, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { explainabilityApi } from '@/api';
import { SHAPWaterfall } from '@/components/explainability/SHAPWaterfall';
import { LIMEBarChart } from '@/components/explainability/LIMEBarChart';
import type { LabModelProfile, ExplanationResult } from '@/types';

interface Props {
  a: LabModelProfile;
  b: LabModelProfile;
}

const A_COLOR = '#818cf8';
const B_COLOR = '#fb923c';

function VerdictBadge({ result, color }: { result: ExplanationResult | null; color: string }) {
  const label = result?.shap?.prediction_label ?? result?.lime?.prediction_label;
  if (!label) return null;
  const isAttack = label.toLowerCase() !== 'normal' && label !== '0';
  return (
    <span className={`text-xs font-bold px-2 py-1 rounded-full ${isAttack ? 'bg-red-500/20 text-red-300' : 'bg-emerald-500/20 text-emerald-300'}`}>
      {label}
    </span>
  );
}

export function LabSection4({ a, b }: Props) {
  const [xaiMethod, setXaiMethod] = useState<'shap' | 'lime' | 'both'>('both');
  const [displayTopN, setDisplayTopN] = useState(10);
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [resultA, setResultA] = useState<ExplanationResult | null>(null);
  const [resultB, setResultB] = useState<ExplanationResult | null>(null);
  const [loadingA, setLoadingA] = useState(false);
  const [loadingB, setLoadingB] = useState(false);
  const [collapsed, setCollapsed] = useState(false);
  const [activeTab, setActiveTab] = useState<'shap' | 'lime'>('shap');

  // Union of all features from both models
  const allFeatures = useMemo(
    () => [...new Set([...a.feature_names, ...b.feature_names])].sort(),
    [a.feature_names, b.feature_names],
  );

  useEffect(() => {
    setFeatureValues(Object.fromEntries(allFeatures.map((f) => [f, '0'])));
  }, [allFeatures]);

  const handleRunBoth = useCallback(async () => {
    if (!a.is_loaded || !b.is_loaded) {
      toast.error('Load both models first (Training → Load Model)');
      return;
    }
    const parsed = Object.fromEntries(
      Object.entries(featureValues).map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)]),
    );
    const inputA = Object.fromEntries(a.feature_names.map((f) => [f, parsed[f] ?? 0]));
    const inputB = Object.fromEntries(b.feature_names.map((f) => [f, parsed[f] ?? 0]));

    setLoadingA(true);
    setLoadingB(true);
    setResultA(null);
    setResultB(null);

    const [ra, rb] = await Promise.allSettled([
      explainabilityApi.explain(a.model_id, { input_row: inputA, method: xaiMethod }),
      explainabilityApi.explain(b.model_id, { input_row: inputB, method: xaiMethod }),
    ]);

    setLoadingA(false);
    setLoadingB(false);

    if (ra.status === 'fulfilled') setResultA(ra.value);
    else toast.error(`Model A explanation failed: ${(ra.reason as Error).message}`);
    if (rb.status === 'fulfilled') setResultB(rb.value);
    else toast.error(`Model B explanation failed: ${(rb.reason as Error).message}`);
  }, [a, b, featureValues, xaiMethod]);

  const notLoaded = !a.is_loaded || !b.is_loaded;

  return (
    <div className="space-y-4">
      {notLoaded && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/5 px-4 py-3 text-amber-400 text-sm">
          {!a.is_loaded && !b.is_loaded
            ? 'Both models must be loaded before running explanations.'
            : `Model ${!a.is_loaded ? 'A' : 'B'} must be loaded first.`}
        </div>
      )}

      {/* Feature input form */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-300">Input Features ({allFeatures.length})</h3>
          <button
            onClick={() => setCollapsed((v) => !v)}
            className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
          >
            {collapsed ? <ChevronDown size={13} /> : <ChevronUp size={13} />}
            {collapsed ? 'Expand' : 'Collapse'}
          </button>
        </div>
        <p className="text-xs text-gray-600">
          Enter values. Features only in Model A are passed to A; only in B to B. Shared features go to both.
        </p>
        {!collapsed && (
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-56 overflow-y-auto pr-1">
            {allFeatures.map((f) => {
              const inA = a.feature_names.includes(f);
              const inB = b.feature_names.includes(f);
              return (
                <div key={f} className="flex items-center gap-1.5">
                  <label className="text-gray-400 text-[10px] truncate w-20 shrink-0 font-mono" title={f}>
                    <span className={inA && !inB ? 'text-indigo-400' : !inA && inB ? 'text-orange-400' : ''}>{f}</span>
                  </label>
                  <input
                    type="text"
                    value={featureValues[f] ?? '0'}
                    onChange={(e) => setFeatureValues((prev) => ({ ...prev, [f]: e.target.value }))}
                    className="flex-1 min-w-0 bg-gray-900 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1 focus:outline-none focus:border-indigo-500 font-mono"
                  />
                </div>
              );
            })}
          </div>
        )}

        {/* Controls */}
        <div className="flex items-center gap-3 flex-wrap pt-1 border-t border-gray-700">
          <div className="flex gap-1 rounded-lg overflow-hidden border border-gray-700 text-xs">
            {(['shap', 'lime', 'both'] as const).map((m) => (
              <button
                key={m}
                onClick={() => setXaiMethod(m)}
                className={`px-3 py-1.5 transition-colors ${xaiMethod === m ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
              >
                {m.toUpperCase()}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2 text-xs text-gray-500">
            <span>Top</span>
            <input
              type="range" min={5} max={25} step={5} value={displayTopN}
              onChange={(e) => setDisplayTopN(Number(e.target.value))}
              className="w-20 accent-indigo-500"
            />
            <span className="font-mono text-indigo-300 w-4">{displayTopN}</span>
          </div>
          <button
            onClick={handleRunBoth}
            disabled={loadingA || loadingB || notLoaded}
            className="ml-auto flex items-center gap-2 px-5 py-2 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {(loadingA || loadingB) ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {(loadingA || loadingB) ? 'Running…' : 'Explain Both Models'}
          </button>
        </div>
      </div>

      {/* Side-by-side results */}
      {(resultA || resultB || loadingA || loadingB) && (
        <>
          {/* XAI tab toggle */}
          {(xaiMethod === 'both') && (
            <div className="flex gap-1 rounded-lg overflow-hidden border border-gray-700 w-fit text-xs">
              {(['shap', 'lime'] as const).map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTab(t)}
                  className={`px-4 py-1.5 transition-colors ${activeTab === t ? 'bg-indigo-600 text-white' : 'bg-gray-800 text-gray-400 hover:text-white'}`}
                >
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {[
              { result: resultA, loading: loadingA, profile: a, color: A_COLOR, label: 'Model A' },
              { result: resultB, loading: loadingB, profile: b, color: B_COLOR, label: 'Model B' },
            ].map(({ result, loading, profile, color, label }) => (
              <div
                key={label}
                className="rounded-xl border border-gray-700 bg-gray-800/40 p-4 space-y-3"
                style={{ borderColor: color + '44' }}
              >
                <div className="flex items-center gap-2">
                  <p className="text-sm font-semibold" style={{ color }}>{label}</p>
                  <span className="text-xs text-gray-500 capitalize">{profile.model_type.replace('_', ' ')}</span>
                  {result && <VerdictBadge result={result} color={color} />}
                  {result && (
                    <span className="text-[10px] text-gray-600 ml-auto">
                      {result.computation_time_ms.toFixed(0)} ms
                    </span>
                  )}
                </div>

                {loading && (
                  <div className="flex items-center justify-center gap-2 py-8 text-gray-500 text-sm">
                    <Loader2 className="h-5 w-5 animate-spin" />
                    Running {xaiMethod.toUpperCase()}…
                  </div>
                )}

                {!loading && result && (
                  <>
                    {/* SHAP panel */}
                    {(xaiMethod === 'shap' || (xaiMethod === 'both' && activeTab === 'shap')) &&
                      result.shap?.shap_values && (
                        <SHAPWaterfall
                          shapValues={result.shap.shap_values}
                          baseValue={result.shap.base_value}
                          cumulativeWaterfall={result.shap.cumulative_waterfall}
                          featureDetails={result.shap.values}
                          predictionLabel={result.shap.prediction_label}
                          attackProbability={result.shap.class_probabilities?.Attack ?? result.shap.prediction_probability}
                          topN={displayTopN}
                        />
                    )}
                    {/* LIME panel */}
                    {(xaiMethod === 'lime' || (xaiMethod === 'both' && activeTab === 'lime')) &&
                      result.lime?.feature_weights && (
                        <LIMEBarChart lime={result.lime} topN={displayTopN} />
                    )}
                  </>
                )}

                {!loading && !result && (
                  <p className="text-xs text-gray-600 py-4 text-center">Click "Explain Both Models" to see results.</p>
                )}
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
