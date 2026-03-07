import client from './client';
import type { LabCompareResult } from '@/types';

export const labApi = {
  // _silent: true — page handles errors inline; suppress the global toast interceptor
  compare: (modelAId: string, modelBId: string): Promise<LabCompareResult> =>
    client.get(`/api/v2/lab/compare/${modelAId}/${modelBId}`, { _silent: true }).then((r) => r.data),
};
