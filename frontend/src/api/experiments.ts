import { get, del } from './client';
import type { ExperimentRun } from '@/types';

export const experimentsApi = {
  list: (): Promise<ExperimentRun[]> =>
    get<{ experiments: ExperimentRun[]; total: number }>('/experiments').then((r) => r.experiments),

  get: (runId: string): Promise<ExperimentRun> =>
    get<ExperimentRun>(`/experiments/${runId}`),

  remove: (runId: string): Promise<{ message: string }> =>
    del(`/experiments/${runId}`),
};
