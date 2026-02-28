import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';
import { explainabilityApi } from '@/api';
import { useModels } from '@/hooks/useModels';
import { SHAPView } from '@/components/explainability/SHAPView';
import { LIMEView } from '@/components/explainability/LIMEView';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { ExplanationResult, ExplanationMethod } from '@/types';

export default function ExplainabilityPage() {
  const { models, selectedModelId, setSelectedModelId, fetchList, loadModel } = useModels();
  const [method, setMethod] = useState<ExplanationMethod>('shap');
  const [featureValues, setFeatureValues] = useState<Record<string, string>>({});
  const [result, setResult] = useState<ExplanationResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selectedModel = models.find((m) => m.model_id === selectedModelId);

  // Initialise feature inputs when model changes
  useEffect(() => {
    if (!selectedModel) return;
    setFeatureValues(Object.fromEntries(selectedModel.feature_names.map((f) => [f, '0'])));
    setResult(null);
  }, [selectedModel]);

  const handleExplain = async () => {
    if (!selectedModelId || !selectedModel) return;
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
      const r = await explainabilityApi.explain(selectedModelId, {
        input_row: parsed,
        method,
      });
      setResult(r);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-white">Explainability</h1>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Config panel */}
        <div className="space-y-5 lg:col-span-1">
          {/* Model picker */}
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">Model</label>
            <select
              value={selectedModelId ?? ''}
              onChange={(e) => setSelectedModelId(e.target.value)}
              className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
            >
              <option value="">Select…</option>
              {models.map((m) => (
                <option key={m.model_id} value={m.model_id}>
                  {m.model_type} · {m.model_id.slice(0, 8)}
                </option>
              ))}
            </select>
          </div>

          {/* Method */}
          <div className="space-y-2">
            <label className="text-gray-300 text-sm font-medium">Method</label>
            <div className="flex gap-2">
              {(['shap', 'lime', 'both'] as ExplanationMethod[]).map((m) => (
                <button
                  key={m}
                  onClick={() => setMethod(m)}
                  className={`flex-1 py-1.5 text-xs rounded-lg border transition-colors ${
                    method === m
                      ? 'bg-cyan-500/20 border-cyan-500/50 text-cyan-300'
                      : 'bg-gray-800 border-gray-700 text-gray-400'
                  }`}
                >
                  {m.toUpperCase()}
                </button>
              ))}
            </div>
          </div>

          {/* Feature inputs */}
          {selectedModel && (
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              <label className="text-gray-300 text-sm font-medium">Features</label>
              {selectedModel.feature_names.map((f) => (
                <div key={f} className="flex items-center gap-2">
                  <label className="text-gray-400 text-xs truncate w-32 shrink-0" title={f}>
                    {f}
                  </label>
                  <input
                    type="text"
                    value={featureValues[f] ?? '0'}
                    onChange={(e) =>
                      setFeatureValues((prev) => ({ ...prev, [f]: e.target.value }))
                    }
                    className="flex-1 min-w-0 bg-gray-800 border border-gray-600 text-gray-200 text-xs rounded-lg px-2 py-1 focus:outline-none focus:border-cyan-500 font-mono"
                  />
                </div>
              ))}
            </div>
          )}

          <button
            onClick={handleExplain}
            disabled={loading || !selectedModelId}
            className="flex items-center gap-2 px-5 py-2.5 bg-cyan-600 hover:bg-cyan-500 disabled:opacity-50 text-white text-sm font-medium rounded-xl transition-colors w-full justify-center"
          >
            {loading ? <Loader2 size={16} className="animate-spin" /> : null}
            {loading ? 'Computing…' : 'Explain'}
          </button>
        </div>

        {/* Results panel */}
        <div className="lg:col-span-2">
          {!result && !loading && (
            <EmptyState
              title="No explanation yet"
              description="Configure features above and click Explain"
            />
          )}
          {loading && (
            <div className="flex items-center gap-3 py-20 justify-center text-gray-400">
              <Loader2 size={20} className="animate-spin" />
              Running {method.toUpperCase()} explanation…
            </div>
          )}
          {result && !loading && (
            <div className="space-y-5">
              <div className="flex items-center gap-2 text-xs text-gray-400">
                <StatusBadge status="info" label={result.method.toUpperCase()} dot={false} />
                <span>{result.computation_time_ms.toFixed(0)} ms</span>
              </div>
              {result.shap && <SHAPView shap={result.shap} />}
              {result.lime && <LIMEView lime={result.lime} />}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
