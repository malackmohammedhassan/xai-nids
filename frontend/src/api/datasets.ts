import client, { get, del } from './client';
import type { DatasetListItem, DatasetSummary, DatasetIntrospection } from '@/types';

export interface DatasetRowsResponse {
  total: number;
  page: number;
  per_page: number;
  rows: Array<{ row_index: number; data: Record<string, unknown> }>;
}

export const datasetsApi = {
  list: (): Promise<DatasetListItem[]> =>
    get<{ datasets: DatasetListItem[]; total: number }>('/datasets/list').then((r) => r.datasets),

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

  /** Fetch paginated rows from a dataset (for the row-sampler UI). */
  rows: (
    datasetId: string,
    params?: { page?: number; per_page?: number },
  ): Promise<DatasetRowsResponse> =>
    get<DatasetRowsResponse>(`/datasets/${datasetId}/rows`, { params }),

  /** Fetch a single row by 0-based index. */
  rowByIndex: (
    datasetId: string,
    rowIndex: number,
  ): Promise<DatasetRowsResponse> =>
    get<DatasetRowsResponse>(`/datasets/${datasetId}/rows`, {
      params: { row_index: rowIndex },
    }),
};
