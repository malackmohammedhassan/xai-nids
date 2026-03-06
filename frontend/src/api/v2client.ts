/**
 * v2client.ts — Axios client pre-configured for /api/v2
 * Shares the same interceptors as the v1 client but uses a different base URL.
 */
import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import type { ApiError } from '@/types';
import { useAppStore } from '@/store/appStore';

const SKIP_LOG_PATHS_V2 = ['/health', '/status', '/jobs/stream'];

function describeV2Call(method: string, url: string): string {
  const m = method.toUpperCase();
  const path = (url ?? '').replace(/^\/api\/v2\//, '').replace(/\/[0-9a-f-]{8,}/g, '/{id}');
  const MAP: Record<string, string> = {
    'POST /datasets/{id}/intelligence': 'Dataset intelligence analysis started',
    'POST /datasets/{id}/visualizations/tier2': 'Tier-2 visualizations queued',
    'POST /datasets/{id}/visualizations/tier3': 'Tier-3 visualizations queued',
    'GET /jobs': 'Background jobs fetched',
    'DELETE /jobs/{id}': 'Job cancelled',
  };
  return MAP[`${m} /${path}`] ?? `${m} /${path} (v2)`;
}

const BASE_V2 = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v2`
  : '/api/v2';

const v2client: AxiosInstance = axios.create({
  baseURL: BASE_V2,
  timeout: 120_000,
  headers: { 'Content-Type': 'application/json' },
});

v2client.interceptors.response.use(
  (response) => {
    const method = response.config.method ?? 'get';
    const url = response.config.url ?? '';
    if (!SKIP_LOG_PATHS_V2.some((p) => url.includes(p))) {
      useAppStore.getState().addActivity({
        type: 'success',
        message: describeV2Call(method, url),
        detail: `${method.toUpperCase()} ${url} → ${response.status}`,
      });
    }
    return response;
  },
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const rawDetail = error.response?.data?.detail ?? error.message;
    const detail = Array.isArray(rawDetail)
      ? rawDetail
          .map((e: { msg?: string; loc?: string[] }) =>
            [e.loc?.slice(1).join('.'), e.msg].filter(Boolean).join(': '),
          )
          .join(' | ')
      : typeof rawDetail === 'object' && rawDetail !== null
        ? JSON.stringify(rawDetail)
        : String(rawDetail ?? error.message);

    // Skip toast for 409 (training in progress) or when caller sets _silent: true
    if (status !== 409 && !error.config?._silent) {
      const code = (error.response?.data as unknown as Record<string, unknown>)?.error_code;
      const label = code ? `[${code}] ` : '';
      toast.error(`${label}${detail}`, { duration: 5000 });
      useAppStore.getState().addActivity({
        type: 'error',
        message: `${describeV2Call(error.config?.method ?? 'request', error.config?.url ?? '')} failed (${status ?? 'network error'})`,
        detail: detail.slice(0, 120),
      });
    }
    return Promise.reject(error);
  },
);

export default v2client;

export async function v2get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await v2client.get<T>(url, config);
  return res.data;
}

export async function v2post<T, D = unknown>(
  url: string,
  data?: D,
  config?: AxiosRequestConfig,
): Promise<T> {
  const res = await v2client.post<T>(url, data, config);
  return res.data;
}

export async function v2delete<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await v2client.delete<T>(url, config);
  return res.data;
}

export function v2wsUrl(path: string): string {
  const base = import.meta.env.VITE_WS_URL ?? 'ws://127.0.0.1:8765';
  return `${base}/api/v2${path}`;
}
