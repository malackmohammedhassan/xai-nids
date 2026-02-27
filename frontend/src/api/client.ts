import axios, { AxiosError, type AxiosInstance, type AxiosRequestConfig } from 'axios';
import toast from 'react-hot-toast';
import type { ApiError } from '@/types';

const BASE_URL = import.meta.env.VITE_API_URL
  ? `${import.meta.env.VITE_API_URL}/api/v1`
  : '/api/v1';

const client: AxiosInstance = axios.create({
  baseURL: BASE_URL,
  timeout: 120_000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// ─── Request interceptor ──────────────────────────────────────────────────────
client.interceptors.request.use((config) => {
  // In future, inject auth token here if needed
  return config;
});

// ─── Response interceptor ─────────────────────────────────────────────────────
client.interceptors.response.use(
  (response) => response,
  (error: AxiosError<ApiError>) => {
    const status = error.response?.status;
    const detail = error.response?.data?.detail ?? error.message;
    const errorCode = error.response?.data?.error_code;

    // Don't toast on 409 (training in progress) — handled by TrainingMonitor
    if (status !== 409) {
      const label = errorCode ? `[${errorCode}] ` : '';
      toast.error(`${label}${detail}`, { duration: 5000 });
    }

    return Promise.reject(error);
  }
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
