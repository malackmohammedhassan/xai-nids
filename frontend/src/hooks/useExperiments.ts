import { useState, useCallback } from 'react';
import { experimentsApi } from '@/api';
import { useAppStore } from '@/store/appStore';

export function useExperiments() {
  const { experiments, setExperiments, removeExperiment } = useAppStore();
  const [loading, setLoading] = useState(false);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await experimentsApi.list();
      setExperiments(list);
    } finally {
      setLoading(false);
    }
  }, [setExperiments]);

  const deleteExperiment = useCallback(
    async (runId: string) => {
      await experimentsApi.remove(runId);
      removeExperiment(runId);
    },
    [removeExperiment]
  );

  return { experiments, loading, fetchList, deleteExperiment };
}
