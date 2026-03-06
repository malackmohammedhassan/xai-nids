/**
 * useSession.ts — Load session on mount, debounce-save on relevant state changes.
 */
import { useCallback, useEffect, useRef } from 'react';
import { fetchSession, saveSession } from '@/api/session';
import { useSessionStore } from '@/store/sessionStore';
import { FEATURES } from '@/utils/features';

const DEBOUNCE_MS = 600;

export function useSession() {
  const store = useSessionStore();
  const debounceTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const mounted = useRef(true);

  // Load from server on mount
  useEffect(() => {
    mounted.current = true;
    if (!FEATURES.sessionPersistence) return;
    fetchSession()
      .then((session) => {
        if (mounted.current) store.hydrateFromServer(session);
      })
      .catch(() => {/* ignore — non-fatal */});
    return () => {
      mounted.current = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const persistNow = useCallback(async () => {
    if (!FEATURES.sessionPersistence) return;
    try {
      await saveSession({
        activePage: store.activePage,
        selectedDatasetId: store.selectedDatasetId,
        selectedModelId: store.selectedModelId,
        uiState: store.uiState,
      });
    } catch {
      /* non-fatal */
    }
  }, [store]);

  /** Call this whenever something that should be persisted changes. */
  const scheduleSync = useCallback(() => {
    if (debounceTimer.current) clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(persistNow, DEBOUNCE_MS);
  }, [persistNow]);

  return { ...store, scheduleSync };
}
