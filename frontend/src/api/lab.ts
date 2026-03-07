import v2client from './v2client';
import type { LabCompareResult } from '@/types';

export const labApi = {
  // _silent: true — page handles errors inline; suppress the global toast interceptor
  compare: (modelAId: string, modelBId: string): Promise<LabCompareResult> =>
    v2client.get(`/lab/compare/${modelAId}/${modelBId}`, { _silent: true }).then((r) => r.data),
};
