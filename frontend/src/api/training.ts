import { get, post } from './client';
import type { TrainingRequest, TrainingStatus, ModelConfig } from '@/types';
import type { PipelineRecommendation } from '@/types/pipeline';

export const trainingApi = {
  start: (req: TrainingRequest): Promise<{ task_id: string; status: string; estimated_duration_seconds: number }> =>
    post('/models/train', req),

  status: (): Promise<TrainingStatus> =>
    get<TrainingStatus>('/models/train/status'),

  modelConfigs: (pluginName?: string): Promise<ModelConfig[]> => {
    const params = pluginName ? { plugin: pluginName } : {};
    return get<{ configs: Record<string, unknown>[] }>('/models/train/configs', { params }).then(
      (r) =>
        r.configs.map((raw) => {
          // Backend returns a flat object: { plugin, model_type, param1: {...}, param2: {...} }
          // Reshape into ModelConfig: { model_type, display_name, hyperparameters: {...} }
          const { plugin: _plugin, model_type, ...rest } = raw as Record<string, unknown>;
          const hyperparameters: Record<string, unknown> = {};
          for (const [k, v] of Object.entries(rest)) {
            if (v && typeof v === 'object') {
              const param = v as Record<string, unknown>;
              // Normalize "categorical" type -> "str", "options" -> "choices"
              hyperparameters[k] = {
                ...param,
                type: param.type === 'categorical' ? 'str' : param.type,
                choices: param.choices ?? param.options,
              };
            }
          }
          return {
            model_type: model_type as string,
            display_name: (model_type as string).replace(/_/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()),
            hyperparameters,
          } as ModelConfig;
        })
    );
  },

  /**
   * Fetch dataset-aware pipeline recommendations.
   * Returns per-step options with recommended value, disabled options and reasons.
   */
  recommendPipeline: (
    datasetId: string,
    targetColumn?: string,
  ): Promise<PipelineRecommendation> => {
    const params = targetColumn ? { target_column: targetColumn } : {};
    return get<PipelineRecommendation>(`/models/train/recommend/${datasetId}`, { params });
  },
};
