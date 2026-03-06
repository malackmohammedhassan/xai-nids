import { post } from './client';
import type { PredictionRequest, PredictionResult } from '@/types';

// Backend schema: { inputs: Array<Record<string,unknown>> }
// Backend response: { predictions: [{input, prediction, confidence, class_probabilities}], model_id, duration_ms }
interface BackendPredictRequest {
  inputs: Record<string, unknown>[];
}

interface BackendSinglePrediction {
  input: Record<string, unknown>;
  prediction: string | number;
  confidence?: number;
  class_probabilities?: Record<string, number>;
}

interface BackendPredictResponse {
  predictions: BackendSinglePrediction[];
  model_id: string;
  prediction_count: number;
  duration_ms: number;
}

export const predictionApi = {
  predict: async (modelId: string, req: PredictionRequest): Promise<PredictionResult> => {
    const body: BackendPredictRequest = { inputs: [req.features] };
    const raw = await post<BackendPredictResponse>(`/models/${modelId}/predict`, body);
    const first = raw.predictions[0];
    return {
      model_id: raw.model_id,
      prediction: first.prediction,
      confidence: first.confidence,
      probabilities: first.class_probabilities,
      prediction_time_ms: raw.duration_ms,
    };
  },
};
