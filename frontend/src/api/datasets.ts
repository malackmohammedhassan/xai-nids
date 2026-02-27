import client, { get, del } from './client';
import type { DatasetListItem, DatasetSummary, DatasetIntrospection } from '@/types';

export const datasetsApi = {
  list: (): Promise<DatasetListItem[]> =>
    get<DatasetListItem[]>('/datasets/list'),

  upload: (file: File, onProgress?: (pct: number) => void): Promise<DatasetSummary> => {
    const fd = new FormData();
    fd.append('file', file);
    return client
      .post<DatasetSummary>('/datasets/upload', fd, {
        headers: { 'Content-Type': 'multipart/form-data' },
        onUploadProgress: (e) => {
          if (onProgress && e.total) {
            onProgress(Math.round((e.loaded * 100) / e.total));
          }
        },
      })
      .then((r) => r.data);
  },

  summary: (datasetId: string): Promise<DatasetSummary> =>
    get<DatasetSummary>(`/datasets/${datasetId}/summary`),

  introspect: (datasetId: string): Promise<DatasetIntrospection> =>
    get<DatasetIntrospection>(`/datasets/${datasetId}/introspect`),

  remove: (datasetId: string): Promise<{ message: string }> =>
    del<{ message: string }>(`/datasets/${datasetId}`),
};
