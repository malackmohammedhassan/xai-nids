import client from './client';
import type { LabCompareResult } from '@/types';

export const labApi = {
  compare: (modelAId: string, modelBId: string): Promise<LabCompareResult> =>
    client.get(`/api/v2/lab/compare/${modelAId}/${modelBId}`).then((r) => r.data),
};
