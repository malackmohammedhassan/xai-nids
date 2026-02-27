import { get } from './client';
import type { HealthStatus, PluginsResponse } from '@/types';

export const healthApi = {
  check: (): Promise<HealthStatus> =>
    get<HealthStatus>('/health'),

  plugins: (): Promise<PluginsResponse> =>
    get<PluginsResponse>('/health/plugins'),
};
