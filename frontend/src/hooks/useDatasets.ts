import { useState, useCallback } from 'react';
import { datasetsApi } from '@/api';
import { useAppStore } from '@/store/appStore';
import type { DatasetIntrospection, DatasetSummary } from '@/types';

export function useDatasets() {
  const {
    datasets,
    setDatasets,
    activeSummary,
    setActiveSummary,
    activeIntrospection,
    setActiveIntrospection,
    selectedDatasetId,
    setSelectedDatasetId,
    removeDataset,
  } = useAppStore();

  const [loading, setLoading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const fetchList = useCallback(async () => {
    setLoading(true);
    try {
      const list = await datasetsApi.list();
      setDatasets(list);
    } finally {
      setLoading(false);
    }
  }, [setDatasets]);

  const upload = useCallback(
    async (file: File): Promise<DatasetSummary> => {
      setUploadProgress(0);
      const summary = await datasetsApi.upload(file, setUploadProgress);
      setActiveSummary(summary);
      setSelectedDatasetId(summary.dataset_id);
      await fetchList();
      return summary;
    },
    [fetchList, setActiveSummary, setSelectedDatasetId]
  );

  const selectDataset = useCallback(
    async (id: string) => {
      setSelectedDatasetId(id);
      setLoading(true);
      try {
        const [summary, introspection] = await Promise.all([
          datasetsApi.summary(id),
          datasetsApi.introspect(id),
        ]);
        setActiveSummary(summary);
        setActiveIntrospection(introspection);
      } finally {
        setLoading(false);
      }
    },
    [setSelectedDatasetId, setActiveSummary, setActiveIntrospection]
  );

  const deleteDataset = useCallback(
    async (id: string) => {
      await datasetsApi.remove(id);
      removeDataset(id);
      if (selectedDatasetId === id) {
        setSelectedDatasetId(null);
        setActiveSummary(null);
        setActiveIntrospection(null as unknown as DatasetIntrospection);
      }
    },
    [removeDataset, selectedDatasetId, setSelectedDatasetId, setActiveSummary, setActiveIntrospection]
  );

  return {
    datasets,
    activeSummary,
    activeIntrospection,
    selectedDatasetId,
    loading,
    uploadProgress,
    fetchList,
    upload,
    selectDataset,
    deleteDataset,
  };
}
