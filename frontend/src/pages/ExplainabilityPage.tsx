import { useCallback, useEffect, useMemo, useState } from 'react';
import { Brain, Loader2, RefreshCw, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import toast from 'react-hot-toast';
import { explainabilityApi } from '@/api';
import { isAppError } from '@/api/client';
import { useModels } from '@/hooks/useModels';
import { useDatasets } from '@/hooks/useDatasets';
import { PageGuide } from '@/components/common/PageGuide';
import { useAppStore } from '@/store/appStore';
import { SHAPWaterfall } from '@/components/explainability/SHAPWaterfall';
import { SHAPForcePlot } from '@/components/explainability/SHAPForcePlot';
import { SHAPSummaryBeeswarm } from '@/components/explainability/SHAPSummaryBeeswarm';
import { SHAPDependencePlot } from '@/components/explainability/SHAPDependencePlot';
import { LIMEBarChart } from '@/components/explainability/LIMEBarChart';
import { ProbabilityGauge } from '@/components/explainability/ProbabilityGauge';
import { PlainEnglishExplanation } from '@/components/explainability/PlainEnglishExplanation';
import { FeatureContextTable } from '@/components/explainability/FeatureContextTable';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { TooltipWrapper } from '@/components/common/TooltipWrapper';
import { ModelSelect } from '@/components/common/ModelSelect';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import { ExportButton } from '@/components/common/ExportButton';
import { HowItWorks } from '@/components/common/HowItWorks';
import { DatasetRowSampler } from '@/components/common/DatasetRowSampler';
import type { ExplanationResult, ExplanationMethod } from '@/types';

type VizTab = 'shap' | 'force' | 'lime' | 'context' | 'raw';

// Derive PlainEnglishExplanation topFeatures from SHAP values
function deriveTopFeatures(
  shapValues: Record<string, number> | undefined,
  n = 5,
): { name: string; contribution: 'positive' | 'negative'; description: string }[] {
  if (!shapValues) return [];
  return Object.entries(shapValues)
    .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
    .slice(0, n)
    .map(([name, val]) => ({
      name,
      contribution: val > 0 ? ('positive' as const) : ('negative' as const),
      description:
        val > 0
          ? `pushed the model toward Attack (SHAP +${val.toFixed(4)})`
          : `pushed the model toward Normal (SHAP ${val.toFixed(4)})`,
    }));
}

export default function ExplainabilityPage() {
  const storeModels = useAppStore((s) => s.models);
  const { models, selectedModelId, setSelectedModelId, fetchList, loadModel } = useModels();
  const { datasets, fetchList: fetchDatasets } = useDatasets();
  const logger = useActivityLogger();
  const [method, setMethod] = useState<ExplanationMethod>('shap');
  // PageGuide prerequisite guard uses storeModels (populated by global store)
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [vizTab, setVizTab] = useState<VizTab>('shap');
  const [showAllFeatures, setShowAllFeatures] = useState(false);
  const [depFeature, setDepFeature] = useState<string>('');

  useEffect(() => { fetchList(); fetchDatasets(); }, [fetchList, fetchDatasets]);

  const selectedModel = models.find((m) => m.model_id === selectedModelId);

  useEffect(() => {
    if (!selectedModel) return;
    setFeatureValues(Object.fromEntries((selectedModel.feature_names ?? []).map((f) => [f, '0'])));
    setResult(null);
    setError(null);
  }, [selectedModel]);

  useEffect(() => {
    if (method === 'shap') setVizTab('shap');
    else if (method === 'lime') setVizTab('lime');
  }, [method]);

  const handleExplain = useCallback(async () => {
    if (!selectedModelId || !selectedModel) return;
    setError(null);
    if (!selectedModel.is_loaded) {
      toast.loading('Loading model…', { id: 'load-model' });
      await loadModel(selectedModelId);
      toast.dismiss('load-model');
    }
    setLoading(true);
    try {
      const parsed = Object.fromEntries(
        Object.entries(featureValues).map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)])
      );
      const r = await explainabilityApi.explain(selectedModelId, { input_row: parsed, method });
      setResult(r);
      logger.explainabilityRun(selectedModel.model_type, method);
      if (r.shap && (method === 'shap' || method === 'both')) setVizTab('shap');
      else if (r.lime) setVizTab('lime');
    } catch (err: unknown) {
      if (isAppError(err)) {
        setError({ message: err.message, code: err.errorCode });
        logger.explainabilityFailed(selectedModel.model_type, method, err.message);
      } else {
        const msg = (err as Error).message ?? 'Failed to generate explanation.';
        setError({ message: msg });
        logger.explainabilityFailed(selectedModel.model_type, method, msg);
      }
    } finally {
      setLoading(false);
    }
  }, [selectedModelId, selectedModel, featureValues, method, loadModel]);

  const confidence = useMemo(() => {
    if (!result) return null;
    // Prefer the richer probability maps from new backend fields
    if (result.lime?.class_probabilities) {
      const vals = Object.values(result.lime.class_probabilities);
      if (vals.length > 0) return Math.max(...vals);
    }
    if (result.shap?.class_probabilities) {
      const vals = Object.values(result.shap.class_probabilities);
      if (vals.length > 0) return Math.max(...vals);
    }
    // Fall back to legacy fields
    if (result.shap?.prediction_probability != null) return result.shap.prediction_probability;
    if (result.lime?.prediction_proba && result.lime.prediction_proba.length > 0)
      return Math.max(...result.lime.prediction_proba);
    return null;
  }, [result]);

  const prediction = useMemo(() => {
    if (!result) return '—';
    // Prefer explicit label from new backend fields
    if (result.shap?.prediction_label) return result.shap.prediction_label;
    if (result.lime?.prediction_label) return result.lime.prediction_label;
    // Legacy fallbacks
    if (result.shap?.prediction != null) return String(result.shap.prediction);
    const probs = result.lime?.prediction_probabilities;
    if (probs) {
      const best = Object.entries(probs).sort((a, b) => b[1] - a[1])[0];
      return best ? best[0] : '—';
    }
    const classProbs = result.lime?.class_probabilities;
    if (classProbs) {
      const best = Object.entries(classProbs).sort((a, b) => b[1] - a[1])[0];
      return best ? best[0] : '—';
    }
    return '—';
  }, [result]);

  const topFeatures = useMemo(() => deriveTopFeatures(result?.shap?.shap_values), [result]);

  const parsedFeatures = useMemo(() => {
    return Object.fromEntries(
      Object.entries(featureValues).map(([k, v]) => [k, isNaN(Number(v)) ? v : Number(v)])
    );
  }, [featureValues]);

  const availableTabs = useMemo<VizTab[]>(() => {
    const tabs: VizTab[] = [];
    if (result?.shap?.shap_values) tabs.push('shap');
    if (result?.shap?.shap_values) tabs.push('force');
    if (result?.lime?.feature_weights) tabs.push('lime');
    if (result) tabs.push('context');
    tabs.push('raw');
    return tabs;
  }, [result]);

  const METHODS: { id: ExplanationMethod; label: string; tip: string }[] = [
    { id: 'shap', label: 'SHAP', tip: 'Game-theory based global feature contributions' },
    { id: 'lime', label: 'LIME', tip: 'Local linear approximation of model behaviour' },
    { id: 'both', label: 'Both', tip: 'Run SHAP and LIME together for cross-validation' },
  ];

  const isAttackPred = prediction !== '—' && prediction.toLowerCase() !== 'normal' && prediction !== '0';

  return (
    <PageGuide
      tagline="Understand every prediction. SHAP shows global feature influence; LIME explains each individual decision locally — pick any model and input to see exactly why it classified a sample as Attack or Normal."
      prerequisites={[
        {
          label: 'No trained models yet — train a model first.',
          to: '/training',
          ctaText: 'Go to Training',
          met: storeModels.length > 0,
        },
      ]}
      howItWorksContent={
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300">
          <li><strong className="text-white">Select a model</strong> and choose SHAP or LIME as your explanation method.</li>
          <li><strong className="text-white">Enter feature values</strong> — use the same values as a real packet or prediction sample.</li>
          <li><strong className="text-white">SHAP Waterfall</strong> — shows value-by-value contribution to the final prediction score.</li>
          <li><strong className="text-white">SHAP Force Plot</strong> — visualises how features push the score above or below the base rate.</li>
          <li><strong className="text-white">LIME Bar Chart</strong> — local approximation: which features matter most for this specific sample.</li>
          <li>Use <strong className="text-white">Export</strong> to save the full explanation JSON for your report.</li>
        </ol>
      }
    >
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center gap-3">
        <Brain className="h-5 w-5 text-indigo-400" />
        <h1 className="text-xl font-bold text-white">Explainability Studio</h1>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* ── LEFT: Config ──────────────────────────────────────────────── */}
        <div className="space-y-4 lg:col-span-1">
          {/* Model picker */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Model</label>
            <ModelSelect
              models={models}
              value={selectedModelId ?? ''}
              onChange={setSelectedModelId}
              placeholder="Select a model…"
            />
          </div>

          {/* Method tabs */}
          <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
            <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Method</label>
            <div className="flex gap-1.5">
              {METHODS.map(({ id, label, tip }) => (
                <TooltipWrapper key={id} tip={tip}>
                  <button
                    onClick={() => setMethod(id)}
                    className={`flex-1 py-2 text-xs font-medium rounded-lg border transition-colors ${
                      method === id
                        ? 'bg-indigo-500/20 border-indigo-500/50 text-indigo-300'
                        : 'bg-gray-900 border-gray-700 text-gray-400 hover:text-gray-200 hover:border-gray-600'
                    }`}
                  >
                    {label}
                  </button>
                </TooltipWrapper>
              ))}
            </div>
          </div>

          {/* Feature inputs */}
          {selectedModel && (
            <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-3">
              <div className="flex items-center justify-between">
                <label className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Input Features
                </label>
                <button
                  onClick={() => setShowAllFeatures((v) => !v)}
                  className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-300 transition-colors"
                >
                  {showAllFeatures ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
                  {showAllFeatures ? 'Collapse' : 'Show all'}
                </button>
              </div>

              {/* ── Row sampler ────────────────────────────────────────────── */}
              <DatasetRowSampler
                datasetId={selectedModel.dataset_id ?? null}
                featureNames={selectedModel.feature_names ?? []}
                targetColumn={selectedModel.target_column ?? undefined}
                datasets={datasets}
                onLoad={(filled) => setFeatureValues(filled)}
              />
              <div className={`space-y-1.5 overflow-y-auto transition-all ${showAllFeatures ? 'max-h-96' : 'max-h-52'}`}>
                {(selectedModel.feature_names ?? []).map((f) => (
                  <div key={f} className="flex items-center gap-2">
                    <label className="text-gray-400 text-xs truncate w-28 shrink-0 font-mono" title={f}>{f}</label>
                    <input
                      type="text"
                      value={featureValues[f] ?? '0'}
                      onChange={(e) => setFeatureValues((prev) => ({ ...prev, [f]: e.target.value }))}
                      className="flex-1 min-w-0 bg-gray-900 border border-gray-600 text-gray-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-indigo-500 font-mono transition-colors"
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleExplain}
            disabled={loading || !selectedModelId}
            className="flex items-center justify-center gap-2 w-full px-5 py-3 bg-indigo-600 hover:bg-indigo-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Brain className="h-4 w-4" />}
            {loading ? `Running ${method.toUpperCase()}…` : `Explain with ${method.toUpperCase()}`}
          </button>
        </div>

        {/* ── RIGHT: Results ────────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-4">
          {!result && !loading && !error && (
            <EmptyState title="No explanation yet" description="Select a model, fill in feature values, and click Explain" />
          )}

          {loading && (
            <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-700 bg-gray-800/30 py-20">
              <Loader2 className="h-8 w-8 animate-spin text-indigo-400" />
              <p className="text-sm text-gray-400">Running {method.toUpperCase()} explanation…</p>
              <p className="text-xs text-gray-600">This may take 2–15 seconds</p>
            </div>
          )}

          {error && !loading && (
            <ErrorPanel message={error.message} code={error.code} onRetry={handleExplain} />
          )}

          {result && !loading && (
            <>
              {/* Meta bar */}
              <div className="flex items-center gap-2 text-xs text-gray-400 flex-wrap">
                <StatusBadge status="info" label={(result.method_used ?? result.method).toUpperCase()} dot={false} />
                <span>{result.computation_time_ms.toFixed(0)} ms</span>
                <button onClick={handleExplain} className="flex items-center gap-1 text-gray-500 hover:text-gray-300 transition-colors">
                  <RefreshCw className="h-3 w-3" /> Re-run
                </button>
                <div className="ml-auto">
                  <ExportButton data={result} filename={`explanation_${result.model_id.slice(0,8)}`} label="Export" />
                </div>
              </div>

              {/* Gauge + prediction */}
              {confidence != null && (
                <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex items-center gap-6">
                  <ProbabilityGauge probability={confidence} label={prediction !== '—' ? prediction : undefined} size={110} />
                  <div className="space-y-1">
                    <p className="text-xs text-gray-400 uppercase tracking-wide font-semibold">Prediction</p>
                    <p className={`text-2xl font-bold ${isAttackPred ? 'text-red-400' : 'text-emerald-400'}`}>{prediction}</p>
                    <p className="text-xs text-gray-500">Confidence: {(confidence * 100).toFixed(1)}%</p>
                  </div>
                </div>
              )}

              {/* Plain English */}
              {topFeatures.length > 0 && prediction !== '—' && confidence != null && (
                <PlainEnglishExplanation prediction={prediction} confidence={confidence} topFeatures={topFeatures} />
              )}

              {/* Viz tabs */}
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
                <div className="flex border-b border-gray-700 overflow-x-auto">
                  {availableTabs.map((tab) => (
                    <button
                      key={tab}
                      onClick={() => setVizTab(tab)}
                      className={`px-4 py-2.5 text-xs font-medium whitespace-nowrap transition-colors border-b-2 -mb-px ${
                        vizTab === tab ? 'border-indigo-500 text-indigo-400' : 'border-transparent text-gray-400 hover:text-gray-200'
                      }`}
                    >
                      {tab === 'shap' && 'SHAP Waterfall'}
                      {tab === 'force' && 'SHAP Force'}
                      {tab === 'lime' && 'LIME Weights'}
                      {tab === 'context' && 'Feature Context'}
                      {tab === 'raw' && 'Raw Values'}
                    </button>
                  ))}
                </div>

                <div className="p-4">
                  {/* SHAP Waterfall */}
                  {vizTab === 'shap' && (
                    result.shap?.shap_values ? (
                      <div className="space-y-6">
                        <p className="text-xs text-gray-500">
                          Feature contributions{result.shap.base_value != null ? ` (base: ${result.shap.base_value.toFixed(4)})` : ''}.
                          Red bars push toward Attack; cyan bars push toward Normal.
                        </p>
                        <SHAPWaterfall
                          shapValues={result.shap.shap_values}
                          baseValue={result.shap.base_value}
                          cumulativeWaterfall={result.shap.cumulative_waterfall}
                          featureDetails={result.shap.values}
                          predictionLabel={result.shap.prediction_label}
                          attackProbability={result.shap.class_probabilities?.Attack ?? result.shap.prediction_probability}
                          topN={20}
                        />
                        <HowItWorks title="How to read SHAP Waterfall" learnMoreUrl="https://shap.readthedocs.io/en/latest/">
                          <p>Each bar shows one feature’s contribution to moving the prediction from the
                          base value (average model output) to the final score. Longer bars = more impact.</p>
                          <p>Red = pushes toward Attack · Cyan = pushes toward Benign</p>
                        </HowItWorks>

                        {/* SHAP Summary Beeswarm */}
                        {result.shap.values && result.shap.values.length > 0 && (
                          <div className="space-y-2 border-t border-gray-700 pt-5">
                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SHAP Summary — all features</h4>
                            <SHAPSummaryBeeswarm
                              values={result.shap.values.map((v) => ({ feature: v.feature, shap_value: v.shap_value, value: v.value }))}
                              topN={20}
                            />
                          </div>
                        )}

                        {/* SHAP Dependence Plot */}
                        {result.shap.values && result.shap.values.length > 0 && (
                          <div className="space-y-3 border-t border-gray-700 pt-5">
                            <div className="flex items-center gap-3 flex-wrap">
                              <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide">SHAP Dependence</h4>
                              <select
                                value={depFeature || result.shap.values[0]?.feature || ''}
                                onChange={(e) => setDepFeature(e.target.value)}
                                className="bg-gray-800 border border-gray-700 text-gray-200 text-xs rounded px-2 py-1"
                              >
                                {result.shap.values.map((v) => (
                                  <option key={v.feature} value={v.feature}>{v.feature}</option>
                                ))}
                              </select>
                            </div>
                            {(() => {
                              const feat = depFeature || result.shap.values![0]?.feature;
                              const entry = result.shap.values!.find((v) => v.feature === feat);
                              return entry ? (
                                <SHAPDependencePlot
                                  featureName={entry.feature}
                                  data={[{ feature_value: entry.value ?? 0, shap_value: entry.shap_value }]}
                                />
                              ) : null;
                            })()}
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-400 py-8 justify-center">
                        <AlertCircle className="h-4 w-4" />
                        SHAP data not available. Re-run with method SHAP or Both.
                      </div>
                    )
                  )}

                  {/* SHAP Force */}
                  {vizTab === 'force' && (
                    result.shap?.shap_values ? (
                      <div className="space-y-3">
                        <SHAPForcePlot
                          shapValues={result.shap.shap_values}
                          baseValue={result.shap.base_value}
                          prediction={prediction !== '—' ? prediction : undefined}
                          topN={10}
                        />
                        <HowItWorks title="How to read SHAP Force Plot">
                          <p>The force strip shows how all features together push the decision
                          from the base value (left) toward the final prediction (right).
                          Red mass = features pushing toward Attack · Cyan = toward Benign.</p>
                        </HowItWorks>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-400 py-8 justify-center">
                        <AlertCircle className="h-4 w-4" /> SHAP data not available.
                      </div>
                    )
                  )}

                  {/* LIME */}
                  {vizTab === 'lime' && (
                    result.lime?.feature_weights ? (
                      <div className="space-y-3">
                        <LIMEBarChart lime={result.lime} topN={15} />
                        <HowItWorks title="How to read LIME Weights">
                          <p>LIME trains a simple linear model on perturbed samples near your input.
                          Positive weight (amber) = feature pushes toward Attack ·
                          Negative weight (indigo) = pushes toward Benign.</p>
                          <p>Local fidelity measures how well the linear model approximates the real
                          model in this neighbourhood.</p>
                        </HowItWorks>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 text-sm text-amber-400 py-8 justify-center">
                        <AlertCircle className="h-4 w-4" />
                        LIME data not available. Re-run with method LIME or Both.
                      </div>
                    )
                  )}

                  {/* Feature Context */}
                  {vizTab === 'context' && (
                    <div className="space-y-3">
                      <p className="text-xs text-gray-500">
                        Your input values compared to SHAP contribution ranked by impact.
                        Arrows indicate if a value is unusually high or low vs. typical.
                      </p>
                      <FeatureContextTable
                        features={parsedFeatures}
                        shapHighlight={result.shap?.shap_values ?? {}}
                        topN={20}
                      />
                    </div>
                  )}

                  {/* Raw */}
                  {vizTab === 'raw' && (
                    <div className="space-y-4">
                      {result.shap?.shap_values && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">SHAP Values (sorted by |value|)</p>
                          <div className="overflow-auto max-h-64 rounded-lg border border-gray-700">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-900/60 border-b border-gray-700">
                                  {['Feature', 'SHAP', 'Direction'].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(result.shap.shap_values)
                                  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                  .map(([feat, val], i) => (
                                    <tr key={feat} className={`border-b border-gray-700/40 ${i % 2 ? 'bg-gray-900/20' : ''}`}>
                                      <td className="px-3 py-1.5 font-mono text-gray-200 truncate max-w-[160px]">{feat}</td>
                                      <td className={`px-3 py-1.5 font-mono ${val > 0 ? 'text-red-300' : 'text-cyan-300'}`}>
                                        {val > 0 ? '+' : ''}{val.toFixed(5)}
                                      </td>
                                      <td className="px-3 py-1.5 text-xs">
                                        {val > 0 ? <span className="text-red-400">↑ Attack</span> : <span className="text-cyan-400">↓ Normal</span>}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                      {result.lime?.feature_weights && (
                        <div>
                          <p className="text-xs font-semibold text-gray-400 mb-2">LIME Weights (sorted by |weight|)</p>
                          <div className="overflow-auto max-h-48 rounded-lg border border-gray-700">
                            <table className="w-full text-xs">
                              <thead>
                                <tr className="bg-gray-900/60 border-b border-gray-700">
                                  {['Feature', 'Weight'].map((h) => (
                                    <th key={h} className="px-3 py-2 text-left text-gray-500 font-medium">{h}</th>
                                  ))}
                                </tr>
                              </thead>
                              <tbody>
                                {Object.entries(result.lime.feature_weights)
                                  .sort((a, b) => Math.abs(b[1]) - Math.abs(a[1]))
                                  .map(([feat, w], i) => (
                                    <tr key={feat} className={`border-b border-gray-700/40 ${i % 2 ? 'bg-gray-900/20' : ''}`}>
                                      <td className="px-3 py-1.5 font-mono text-gray-200">{feat}</td>
                                      <td className={`px-3 py-1.5 font-mono ${w > 0 ? 'text-amber-300' : 'text-indigo-300'}`}>
                                        {w > 0 ? '+' : ''}{w.toFixed(5)}
                                      </td>
                                    </tr>
                                  ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </PageGuide>
  );
}
