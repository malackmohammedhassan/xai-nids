/**
 * useAutoLoad.ts
 *
 * Runs once on app startup (and on hard-refresh) to:
 *  1. Fetch the full dataset list into the store.
 *  2. Fetch all saved models into the store.
 *  3. Auto-load every saved model that is not already in memory,
 *     so pages like Explainability and Intelligence Lab work immediately
 *     without the user manually clicking "Load Model".
 *
 * Failures are swallowed silently — a missing model file or a busy server
 * should never crash the UI; the model will just stay marked as not-loaded.
 */
import { useEffect, useRef } from 'react';
import { modelsApi } from '@/api';
import { datasetsApi } from '@/api';
import { useAppStore } from '@/store/appStore';

export function useAutoLoad() {
  const { setModels, setDatasets, markLoaded } = useAppStore();
  // Guard: run only once per app lifecycle even under StrictMode double-invoke
  const ran = useRef(false);

  useEffect(() => {
    if (ran.current) return;
    ran.current = true;

    // ── 1. Datasets (fire-and-forget) ────────────────────────────────────────
    datasetsApi.list()
      .then(setDatasets)
      .catch(() => { /* non-fatal */ });

    // ── 2. Models list + auto-load ────────────────────────────────────────────
    modelsApi.list()
      .then(async (models) => {
        setModels(models);
        const unloaded = models.filter((m) => !m.is_loaded);
        await Promise.allSettled(
          unloaded.map((m) =>
            modelsApi.load(m.model_id)
              .then(() => markLoaded(m.model_id, true))
              .catch(() => { /* non-fatal: file missing or server busy */ }),
          ),
        );
      })
      .catch(() => { /* non-fatal */ });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
}
