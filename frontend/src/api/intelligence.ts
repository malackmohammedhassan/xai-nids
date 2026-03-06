/** intelligence.ts — v2 dataset intelligence API */
import { v2get, v2post } from './v2client';

export interface IntelligenceStatusResponse {
  status: 'not_computed' | 'computing' | 'ready';
  job_id?: string;
  fetch_url?: string;
  report?: Record<string, unknown>;
}

export interface TriggerIntelligenceResponse {
  job_id: string;
  status: string;
  message: string;
}

/** Fetch cached intelligence report for a dataset */
export async function getIntelligence(datasetId: string): Promise<IntelligenceStatusResponse> {
  return v2get(`/datasets/${datasetId}/intelligence`);
}

/** Trigger background analysis job */
export async function triggerIntelligence(datasetId: string): Promise<TriggerIntelligenceResponse> {
  return v2post(`/datasets/${datasetId}/intelligence`);
}
