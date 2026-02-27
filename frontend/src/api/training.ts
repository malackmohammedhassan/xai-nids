import { get, post } from './client';
import type { TrainingRequest, TrainingStatus, ModelConfig } from '@/types';

export const trainingApi = {
  start: (req: TrainingRequest): Promise<{ run_id: string; message: string }> =>
    post('/models/train', req),

  status: (): Promise<TrainingStatus> =>
    get<TrainingStatus>('/models/train/status'),

  modelConfigs: (pluginName?: string): Promise<ModelConfig[]> => {
    const params = pluginName ? { plugin: pluginName } : {};
    return get<ModelConfig[]>('/models/train/configs', { params });
  },
};
