import { post } from './client';
import type { PredictionRequest, PredictionResult } from '@/types';

export const predictionApi = {
  predict: (modelId: string, req: PredictionRequest): Promise<PredictionResult> =>
    post<PredictionResult>(`/models/${modelId}/predict`, req),
};
