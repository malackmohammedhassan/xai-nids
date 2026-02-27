import { post } from './client';
import type { ExplainRequest, ExplanationResult } from '@/types';

export const explainabilityApi = {
  explain: (modelId: string, req: ExplainRequest): Promise<ExplanationResult> =>
    post<ExplanationResult>(`/models/${modelId}/explain`, req),
};
