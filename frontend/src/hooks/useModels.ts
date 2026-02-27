import { useState, useCallback } from 'react';
import { modelsApi } from '@/api';
import { useAppStore } from '@/store/appStore';
import type { ModelMetrics } from '@/types';

export function useModels() {
  const {
    models,
    setModels,
    metricsCache,
    cacheMetrics,
    selectedModelId,
    setSelectedModelId,
    removeModel,
    markLoaded,
  } = useAppStore();

  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await modelsApi.list();
      setModels(list);
    } finally {
      setLoading(false);
    }
  }, [setModels]);

  const fetchMetrics = useCallback(
    async (modelId: string): Promise<ModelMetrics> => {
      if (metricsCache[modelId]) return metricsCache[modelId];
      const metrics = await modelsApi.metrics(modelId);
      cacheMetrics(modelId, metrics);
      return metrics;
    },
    [metricsCache, cacheMetrics]
  );

  const loadModel = useCallback(
    async (modelId: string) => {
      await modelsApi.load(modelId);
      markLoaded(modelId, true);
    },
    [markLoaded]
  );

  const deleteModel = useCallback(
    async (modelId: string) => {
      await modelsApi.remove(modelId);
      removeModel(modelId);
      if (selectedModelId === modelId) setSelectedModelId(null);
    },
    [removeModel, selectedModelId, setSelectedModelId]
  );

  const selectedModel = models.find((m) => m.model_id === selectedModelId) ?? null;

  return {
    models,
    selectedModel,
    selectedModelId,
    metricsCache,
    loading,
    fetchList,
    fetchMetrics,
    loadModel,
    deleteModel,
    setSelectedModelId,
  };
}
