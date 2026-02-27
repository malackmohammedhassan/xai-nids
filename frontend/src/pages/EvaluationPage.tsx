import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { useModels } from '@/hooks/useModels';
import { MetricsCards } from '@/components/evaluation/MetricsCards';
import { ConfusionMatrix } from '@/components/evaluation/ConfusionMatrix';
import { ROCCurve } from '@/components/evaluation/ROCCurve';
import { FeatureImportance } from '@/components/evaluation/FeatureImportance';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { ModelMetrics } from '@/types';

export default function EvaluationPage() {
  const { models, selectedModelId, setSelectedModelId, fetchList, fetchMetrics, loading } =
    useModels();
  const [metrics, setMetrics] = useState<ModelMetrics | null>(null);
  const [metricsLoading, setMetricsLoading] = useState(false);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const handleSelectModel = async (id: string) => {
    setSelectedModelId(id);
    setMetricsLoading(true);
    try {
      const m = await fetchMetrics(id);
      setMetrics(m);
    } finally {
      setMetricsLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Model Evaluation</h1>
        <button
          onClick={fetchList}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      {/* Model picker */}
      <div className="space-y-2">
        <label className="text-gray-300 text-sm font-medium">Select Model</label>
        {models.length === 0 ? (
          <EmptyState title="No models yet" description="Train a model first" />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {models.map((m) => (
              <button
                key={m.model_id}
                onClick={() => handleSelectModel(m.model_id)}
                className={`text-left bg-gray-800 border rounded-xl px-4 py-3 transition-all hover:bg-gray-700 ${
                  selectedModelId === m.model_id
                    ? 'border-cyan-500/60 bg-cyan-500/5'
                    : 'border-gray-700'
                }`}
              >
                <p className="text-gray-200 font-medium text-sm">{m.model_type}</p>
                <p className="text-gray-500 text-xs mt-0.5 truncate font-mono">{m.model_id.slice(0, 16)}…</p>
                <div className="mt-1.5">
                  <StatusBadge status={m.is_loaded ? 'success' : 'neutral'} label={m.is_loaded ? 'Loaded' : 'Not loaded'} />
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Metrics display */}
      {metricsLoading && <LoadingSkeleton lines={5} />}

      {metrics && !metricsLoading && (
        <div className="space-y-5">
          <MetricsCards metrics={metrics} />

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {metrics.confusion_matrix && (
              <ConfusionMatrix
                matrix={metrics.confusion_matrix}
                classNames={metrics.class_names}
              />
            )}
            {metrics.roc_curve && (
              <ROCCurve
                fpr={metrics.roc_curve.fpr}
                tpr={metrics.roc_curve.tpr}
                auc={metrics.roc_auc}
              />
            )}
          </div>

          {metrics.feature_importances && metrics.feature_importances.length > 0 && (
            <FeatureImportance features={metrics.feature_importances} />
          )}
        </div>
      )}
    </div>
  );
}
