import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import type { ApiError } from '@/types';
import { useAppStore } from '@/store/appStore';

// ─── Activity log helpers ────────────────────────────────────────────────────
const SKIP_LOG_PATHS = ['/health', '/train/status', '/train/stream', '/metrics-live'];

/** Turn a raw axios URL into a short readable label. */
function describeCall(method: string, url: string): string {
  const m = method.toUpperCase();
  const path = (url ?? '').replace(/^\/api\/v[12]\//, '').replace(/\/[0-9a-f-]{8,}/g, '/{id}');
  const MAP: Record<string, string> = {
    'POST /datasets/upload': 'Dataset uploaded',
    'DELETE /datasets/{id}': 'Dataset deleted',
    'POST /models/train': 'Training job started',
    'POST /models/load/{id}': 'Model loaded into memory',
    'DELETE /models/{id}': 'Model deleted',
    'GET /models/{id}/metrics': 'Metrics loaded',
    'GET /models/list': 'Model list refreshed',
    'POST /predict': 'Prediction run',
    'POST /explain/shap': 'SHAP explanation computed',
    'POST /explain/lime': 'LIME explanation computed',
    'GET /experiments': 'Experiments fetched',
    'DELETE /experiments/{id}': 'Experiment deleted',
  };
  return MAP[`${m} /${path}`] ?? `${m} /${path}`;
}

function shouldLog(method: string, url: string): boolean {
  const m = method.toUpperCase();
  if (SKIP_LOG_PATHS.some((p) => url?.includes(p))) return false;
  // Always log mutations; skip routine GETs
  return m !== 'GET' || true; // log everything except skip-list above
}

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

// ─── Augment AxiosRequestConfig with a _silent flag ───────────────────────────
// When _silent: true, the response interceptor will NOT show a toast on error.
declare module 'axios' {
  interface AxiosRequestConfig {
    _silent?: boolean;
  }
}

// ─── Structured Application Error ────────────────────────────────────────────
export class AppError extends Error {
  constructor(
    message: string,
    public readonly errorCode: string | undefined,
    public readonly fixSuggestion: string | undefined,
    public readonly statusCode: number | undefined,
    public readonly rawDetail: unknown,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function isAppError(err: unknown): err is AppError {
  return err instanceof AppError;
}

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => {
    const method = response.config.method ?? 'get';
    const url = response.config.url ?? '';
    if (shouldLog(method, url)) {
      useAppStore.getState().addActivity({
        type: 'success',
        message: describeCall(method, url),
        detail: `${method.toUpperCase()} ${url} → ${response.status}`,
      });
    }
    return response;
  },
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const data = error.response?.data;
    const rawDetail = data?.detail ?? error.message;

    // Pydantic validation errors return detail as an array of objects — flatten to a string
    const detail = Array.isArray(rawDetail)
      ? rawDetail
          .map((e: { msg?: string; loc?: string[] }) =>
            [e.loc?.slice(1).join('.'), e.msg].filter(Boolean).join(': '),
          )
          .join(' | ')
      : typeof rawDetail === 'object' && rawDetail !== null
        ? JSON.stringify(rawDetail)
        : String(rawDetail ?? error.message);

    const errorCode = data?.error_code;
    const fixSuggestion = (data as Record<string, unknown> | undefined)?.fix_suggestion as
      | string
      | undefined;

    // Build a rich AppError so callers get structured info without parsing response
    const appError = new AppError(detail, errorCode, fixSuggestion, status, rawDetail);

    // Show toast — skip 409 (training-in-progress, handled by TrainingMonitor)
    // Skip if caller passed _silent: true (expected errors, e.g. tier3 404 before compute)
    // Also add fix_suggestion as subtitle if present
    if (status !== 409 && !error.config?._silent) {
      const label = errorCode ? `[${errorCode}] ` : '';
      const body = fixSuggestion ? `${label}${detail}\n💡 ${fixSuggestion}` : `${label}${detail}`;
      toast.error(body, { duration: 5000 });
    }

    // Always log errors to activity log (even silent ones — only skip 409 noise)
    if (status !== 409 && !error.config?._silent) {
      const method = error.config?.method ?? 'request';
      const url = error.config?.url ?? '';
      useAppStore.getState().addActivity({
        type: 'error',
        message: `${describeCall(method, url)} failed (${status ?? 'network error'})`,
        detail: detail.slice(0, 120),
      });
    }

    return Promise.reject(appError);
  },
);

export default client;

// ─── Typed fetch helpers ─────────────────────────────────────────────────────
export async function get<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.get<T>(url, config);
  return res.data;
}

export async function post<T, D = unknown>(url: string, data?: D, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.post<T>(url, data, config);
  return res.data;
}

export async function del<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  const res = await client.delete<T>(url, config);
  return res.data;
}
