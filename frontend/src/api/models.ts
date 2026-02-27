import { get, post, del } from './client';
import type { ModelMeta, ModelMetrics } from '@/types';

export const modelsApi = {
  list: (): Promise<ModelMeta[]> =>
    get<ModelMeta[]>('/models/list'),

  metrics: (modelId: string): Promise<ModelMetrics> =>
    get<ModelMetrics>(`/models/${modelId}/metrics`),

  load: (modelId: string): Promise<{ message: string }> =>
    post(`/models/${modelId}/load`),

  remove: (modelId: string): Promise<{ message: string }> =>
    del(`/models/${modelId}`),
};
