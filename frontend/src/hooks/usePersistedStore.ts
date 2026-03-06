/**
 * usePersistedStore.ts
 *
 * Persists a subset of app state across page refreshes and server restarts.
 *
 * Strategy
 * ─────────
 * 1. Tries IndexedDB via the idb-keyval micro-library (async, structured cloning).
 * 2. Falls back to localStorage JSON (synchronous, strings only).
 *
 * Usage
 * ─────
 * Call once at app root level, e.g. inside <App>:
 *
 *   usePersistedStore()
 *
 * The hook automatically:
 *   - Restores saved values into Zustand on mount.
 *   - Subscribes to store changes and saves them debounced (300 ms).
 */

import { useEffect, useRef } from 'react';
import { useAppStore } from '../store/appStore';
import { useJobStore } from '../store/jobStore';

// ─── idb-keyval availability check ───────────────────────────────────────────
// We do a runtime import so the bundle degrades gracefully if absent.
type IdbKv = {
  get: (key: string) => Promise<unknown>;
  set: (key: string, value: unknown) => Promise<void>;
};

let idbKv: IdbKv | null = null;
// Attempt to load idb-keyval at module init (non-blocking)
// eslint-disable-next-line @typescript-eslint/ban-ts-comment
// @ts-ignore — optional peer dependency; falls back to localStorage if absent
import('idb-keyval')
  .then((mod: IdbKv) => {
    idbKv = mod;
  })
  .catch(() => {
    // Not installed — fall back to localStorage
  });

// ─── Storage interface ───────────────────────────────────────────────────────

const PREFIX = 'xai_nids:';

async function storageGet<T>(key: string): Promise<T | null> {
  const k = PREFIX + key;
  try {
    if (idbKv) {
      const val = await idbKv.get(k);
      return (val as T) ?? null;
    }
  } catch {
    /* fall through */
  }
  try {
    const raw = localStorage.getItem(k);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

async function storageSet(key: string, value: unknown): Promise<void> {
  const k = PREFIX + key;
  try {
    if (idbKv) {
      await idbKv.set(k, value);
      return;
    }
  } catch {
    /* fall through */
  }
  try {
    localStorage.setItem(k, JSON.stringify(value));
  } catch {
    /* quota exceeded — silently skip */
  }
}

// ─── Debounce utility ────────────────────────────────────────────────────────

function debounce<F extends (...args: Parameters<F>) => void>(fn: F, ms: number): F {
  let timer: ReturnType<typeof setTimeout>;
  return ((...args: Parameters<F>) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  }) as F;
}

// ─── Schema versioning ─────────────────────────────────────────────────────
// Increment SCHEMA_VERSION whenever the persisted shape changes.
// On mismatch the old data is silently dropped instead of causing a runtime
// error from a stale structure (e.g. missing required fields).
const SCHEMA_VERSION = 1;

type Versioned<T> = { version: number; data: T };

function versionedGet<T>(raw: unknown): T | null {
  if (
    raw !== null &&
    typeof raw === 'object' &&
    'version' in (raw as object) &&
    'data' in (raw as object)
  ) {
    const envelope = raw as Versioned<T>;
    if (envelope.version === SCHEMA_VERSION) return envelope.data;
  }
  return null; // stale schema — discard
}

function versionedSet<T>(value: T): Versioned<T> {
  return { version: SCHEMA_VERSION, data: value };
}

// ─── Persisted keys ──────────────────────────────────────────────────────────

type AppSnapshot = {
  selectedDatasetId: string | null;
  selectedModelId: string | null;
};

type JobSnapshot = {
  /** Last 100 job summaries (id, title, status, type, error) */
  recentJobSummaries: Array<{
    job_id: string;
    title: string;
    status: string;
    job_type: string;
  }>;
};

// ─── Hook ─────────────────────────────────────────────────────────────────────

export function usePersistedStore(): void {
  const restored = useRef(false);

  // ── Restore on mount ───────────────────────────────────────────────────────
  useEffect(() => {
    if (restored.current) return;
    restored.current = true;

    (async () => {
      const appSnap = versionedGet<AppSnapshot>(await storageGet<unknown>('app_snapshot'));
      if (appSnap) {
        const { setSelectedDataset, setSelectedModel } =
          useAppStore.getState() as {
            setSelectedDataset?: (id: string | null) => void;
            setSelectedModel?: (id: string | null) => void;
          };
        if (appSnap.selectedDatasetId && setSelectedDataset) {
          setSelectedDataset(appSnap.selectedDatasetId);
        }
        if (appSnap.selectedModelId && setSelectedModel) {
          setSelectedModel(appSnap.selectedModelId);
        }
      }
    })();
  }, []);

  // ── Subscribe and save (debounced) ────────────────────────────────────────
  useEffect(() => {
    const saveApp = debounce(async (state: ReturnType<typeof useAppStore.getState>) => {
      const snap: AppSnapshot = {
        selectedDatasetId:
          (state as { selectedDatasetId?: string | null }).selectedDatasetId ?? null,
        selectedModelId:
          (state as { selectedModelId?: string | null }).selectedModelId ?? null,
      };
      await storageSet('app_snapshot', versionedSet(snap));
    }, 300);

    const unsubApp = useAppStore.subscribe(saveApp);

    const saveJobs = debounce(async (state: ReturnType<typeof useJobStore.getState>) => {
      const jobs = Object.values((state as { jobs: Record<string, { job_id: string; title: string; status: string; job_type: string }> }).jobs ?? {});
      const snap: JobSnapshot = {
        recentJobSummaries: jobs.slice(-100).map((j) => ({
          job_id: j.job_id,
          title: j.title,
          status: j.status,
          job_type: j.job_type,
        })),
      };
      await storageSet('job_snapshot', versionedSet(snap));
    }, 300);

    const unsubJobs = useJobStore.subscribe(saveJobs);

    return () => {
      unsubApp();
      unsubJobs();
    };
  }, []);
}
