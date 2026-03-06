import { useCallback, useEffect, useState } from 'react';
import { isAppError } from '@/api/client';
import { Zap } from 'lucide-react';
import toast from 'react-hot-toast';
import { predictionApi } from '@/api';
import { useModels } from '@/hooks/useModels';
import { useDatasets } from '@/hooks/useDatasets';
import { PageGuide } from '@/components/common/PageGuide';
import { useAppStore } from '@/store/appStore';
import { PredictionPlayground } from '@/components/prediction/PredictionPlayground';
import { PredictionHistory, type HistoryEntry } from '@/components/prediction/PredictionHistory';
import { ProbabilityGauge } from '@/components/explainability/ProbabilityGauge';
import { FeatureContextTable } from '@/components/explainability/FeatureContextTable';
import { ErrorPanel } from '@/components/common/ErrorPanel';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ModelSelect } from '@/components/common/ModelSelect';
import { useActivityLogger } from '@/hooks/useActivityLogger';
import type { PredictionResult } from '@/types';

function isAttack(pred: string | number): boolean {
  const s = String(pred).toLowerCase();
  return s !== 'normal' && s !== '0' && s !== 'benign';
}

export default function PredictionPage() {
  const storeModels = useAppStore((s) => s.models);
  const { models, selectedModelId, setSelectedModelId, fetchList, loadModel } = useModels();
  const { datasets, fetchList: fetchDatasets } = useDatasets();
  const logger = useActivityLogger();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<{ message: string; code?: string } | null>(null);
  const [history, setHistory] = useState<HistoryEntry[]>([]);
  const [selectedHistoryId, setSelectedHistoryId] = useState<string | undefined>();

  useEffect(() => { fetchList(); fetchDatasets(); }, [fetchList, fetchDatasets]);

  const selectedModel = models.find((m) => m.model_id === selectedModelId);

  const handlePredict = useCallback(async (features: Record<string, unknown>): Promise<PredictionResult> => {
    if (!selectedModelId || !selectedModel) throw new Error('No model selected');
    setError(null);
    if (!selectedModel.is_loaded) {
      toast.loading('Loading model…', { id: 'load' });
      await loadModel(selectedModelId);
      toast.dismiss('load');
    }
    setLoading(true);
    try {
      const r = await predictionApi.predict(selectedModelId, { features });
      setResult(r);
      logger.predictionRun(
        selectedModel.model_type,
        r.prediction,
        Array.isArray(r.probabilities) ? Math.max(...r.probabilities) : undefined,
      );
      // Add to history
      const entry: HistoryEntry = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        timestamp: new Date(),
        features,
        result: r,
      };
      setHistory((prev) => [...prev, entry]);
      setSelectedHistoryId(entry.id);
      return r;
    } catch (err: unknown) {
      if (isAppError(err)) {
        setError({ message: err.message, code: err.errorCode });
        logger.predictionFailed(selectedModel.model_type, err.message);
      } else {
        const ax = err as { response?: { data?: { detail?: string; error_code?: string } }; message?: string };
        const msg = ax?.response?.data?.detail ?? ax?.message ?? 'Prediction failed.';
        const code = ax?.response?.data?.error_code;
        setError({ message: String(msg), code });
        logger.predictionFailed(selectedModel.model_type, String(msg));
      }
      throw err;
    } finally {
      setLoading(false);
    }
  }, [selectedModelId, selectedModel, loadModel]);

  const handleHistorySelect = (entry: HistoryEntry) => {
    setSelectedHistoryId(entry.id);
    setResult(entry.result);
    setError(null);
  };

  const confidence = result?.confidence ?? (
    result?.probabilities
      ? Math.max(...Object.values(result.probabilities))
      : undefined
  );

  return (
    <PageGuide
      tagline="Run live inference on any trained model. Enter feature values or paste a JSON row — get a prediction and confidence score in milliseconds."
      prerequisites={[
        {
          label: 'No trained models yet — train a model before running predictions.',
          to: '/training',
          ctaText: 'Go to Training',
          met: storeModels.length > 0,
        },
      ]}
      howItWorksContent={
        <ol className="list-decimal list-inside space-y-1.5 text-sm text-gray-300">
          <li><strong className="text-white">Select a model</strong> from the dropdown.</li>
          <li><strong className="text-white">Enter feature values</strong> — or click <em>Random Sample</em> to auto-fill from dataset statistics.</li>
          <li><strong className="text-white">Run Prediction</strong> — see class label, confidence %, and per-class probability bars.</li>
          <li>Every prediction is saved to <strong className="text-white">History</strong> — click any past row to review it.</li>
          <li>Head to <strong className="text-white">Explainability</strong> to understand why the model made its decision.</li>
        </ol>
      }
    >
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center gap-3">
        <Zap className="h-5 w-5 text-cyan-400" />
        <h1 className="text-xl font-bold text-white">Prediction Playground</h1>
      </div>

      {/* Model picker */}
      <div className="space-y-1 max-w-xl">
        <label className="text-gray-300 text-sm font-medium">Model</label>
        <ModelSelect
          models={models}
          value={selectedModelId ?? ''}
          onChange={(id) => { setSelectedModelId(id); setResult(null); setError(null); }}
          placeholder="Select model…"
        />
      </div>

      {!selectedModel ? (
        <EmptyState title="Select a model" description="Choose a trained model to run predictions" />
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Left: playground */}
          <div className="lg:col-span-2 space-y-4">
            <PredictionPlayground
              featureNames={selectedModel.feature_names ?? []}
              onPredict={handlePredict}
              result={result}
              loading={loading}
              datasetId={selectedModel.dataset_id ?? null}
              targetColumn={selectedModel.target_column ?? undefined}
              datasets={datasets}
            />
            {error && <ErrorPanel message={error.message} code={error.code} onRetry={undefined} />}
          </div>

          {/* Right: result gauge + history */}
          <div className="space-y-4">
            {/* Result gauge */}
            {result && confidence != null && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 flex flex-col items-center gap-2">
                <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">
                  Prediction
                </p>
                <ProbabilityGauge
                  probability={confidence}
                  label={String(result.prediction)}
                  size={120}
                />
                <p className={`text-lg font-bold mt-1 ${isAttack(result.prediction) ? 'text-red-400' : 'text-emerald-400'}`}>
                  {String(result.prediction)}
                </p>
                <p className="text-xs text-gray-500">{result.prediction_time_ms.toFixed(1)} ms</p>
                {result.probabilities && (
                  <div className="w-full mt-2 space-y-1">
                    {Object.entries(result.probabilities)
                      .sort((a, b) => b[1] - a[1])
                      .map(([cls, prob]) => (
                        <div key={cls} className="flex items-center justify-between text-xs">
                          <span className="text-gray-400 truncate max-w-[100px]" title={cls}>{cls}</span>
                          <div className="flex items-center gap-2">
                            <div className="w-20 h-1.5 bg-gray-700 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full ${isAttack(cls) ? 'bg-red-500' : 'bg-emerald-500'}`}
                                style={{ width: `${prob * 100}%` }}
                              />
                            </div>
                            <span className="text-gray-300 font-mono w-10 text-right">
                              {(prob * 100).toFixed(1)}%
                            </span>
                          </div>
                        </div>
                      ))}
                  </div>
                )}
              </div>
            )}

            {/* History */}
            {history.length > 0 && (
              <PredictionHistory
                entries={history}
                selectedId={selectedHistoryId}
                onSelect={handleHistorySelect}
              />
            )}

            {/* Feature context — show last submitted features */}
            {result && (
              <FeatureContextTable
                features={
                  history.find((h) => h.id === selectedHistoryId)?.features ??
                  history[history.length - 1]?.features ??
                  {}
                }
                topN={12}
              />
            )}
          </div>
        </div>
      )}
    </div>
    </PageGuide>
  );
}
