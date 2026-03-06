import { get, post, del } from './client';
import type { ModelMeta, ModelMetrics } from '@/types';

export const modelsApi = {
  list: (): Promise<ModelMeta[]> =>
    get<{ models: ModelMeta[]; total: number }>('/models/list').then((r) => r.models),

  metrics: (modelId: string): Promise<ModelMetrics> =>
    get<ModelMetrics>(`/models/${modelId}/metrics`),

  load: (modelId: string): Promise<{ message: string }> =>
    post(`/models/${modelId}/load`),

  remove: (modelId: string): Promise<{ message: string }> =>
    del(`/models/${modelId}`),
};
