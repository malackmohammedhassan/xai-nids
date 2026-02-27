import { useEffect, useState } from 'react';
import toast from 'react-hot-toast';
import { predictionApi } from '@/api';
import { useModels } from '@/hooks/useModels';
import { PredictionPlayground } from '@/components/prediction/PredictionPlayground';
import { EmptyState } from '@/components/common/EmptyState';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { PredictionResult } from '@/types';

export default function PredictionPage() {
  const { models, selectedModelId, setSelectedModelId, fetchList, loadModel } = useModels();
  const [result, setResult] = useState<PredictionResult | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const selectedModel = models.find((m) => m.model_id === selectedModelId);

  const handlePredict = async (features: Record<string, unknown>): Promise<PredictionResult> => {
    if (!selectedModelId || !selectedModel) {
      throw new Error('No model selected');
    }
    if (!selectedModel.is_loaded) {
      toast.loading('Loading model…', { id: 'load' });
      await loadModel(selectedModelId);
      toast.dismiss('load');
    }
    setLoading(true);
    try {
      const r = await predictionApi.predict(selectedModelId, { features });
      setResult(r);
      return r;
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="space-y-6 max-w-5xl">
      <h1 className="text-xl font-bold text-white">Prediction Playground</h1>

      {/* Model picker */}
      <div className="flex items-center gap-4">
        <div className="space-y-1 flex-1 max-w-xs">
          <label className="text-gray-300 text-sm font-medium">Model</label>
          <select
            value={selectedModelId ?? ''}
            onChange={(e) => {
              setSelectedModelId(e.target.value);
              setResult(null);
            }}
            className="w-full bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500"
          >
            <option value="">Select model…</option>
            {models.map((m) => (
              <option key={m.model_id} value={m.model_id}>
                {m.model_type} · {m.model_id.slice(0, 8)}
              </option>
            ))}
          </select>
        </div>
        {selectedModel && (
          <div className="mt-5">
            <StatusBadge
              status={selectedModel.is_loaded ? 'success' : 'neutral'}
              label={selectedModel.is_loaded ? 'Loaded' : 'Not loaded'}
            />
          </div>
        )}
      </div>

      {!selectedModel ? (
        <EmptyState title="Select a model" description="Choose a trained model to run predictions" />
      ) : (
        <PredictionPlayground
          featureNames={selectedModel.feature_names}
          onPredict={handlePredict}
          result={result}
          loading={loading}
        />
      )}
    </div>
  );
}
