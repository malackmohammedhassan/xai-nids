/**
 * sessionStore.ts — Persist active page + selections to the v2 /session API
 */
import { create } from 'zustand';

export interface SessionState {
  activePage: string;
  selectedDatasetId: string | null;
  selectedModelId: string | null;
  uiState: Record<string, unknown>;
}

interface SessionStore extends SessionState {
  setActivePage: (page: string) => void;
  setSelectedDatasetId: (id: string | null) => void;
  setSelectedModelId: (id: string | null) => void;
  setUiState: (key: string, value: unknown) => void;
  hydrateFromServer: (session: Partial<SessionState>) => void;
}

export const useSessionStore = create<SessionStore>((set) => ({
  activePage: 'dashboard',
  selectedDatasetId: null,
  selectedModelId: null,
  uiState: {},

  setActivePage: (activePage) => set({ activePage }),
  setSelectedDatasetId: (selectedDatasetId) => set({ selectedDatasetId }),
  setSelectedModelId: (selectedModelId) => set({ selectedModelId }),
  setUiState: (key, value) =>
    set((s) => ({ uiState: { ...s.uiState, [key]: value } })),
  hydrateFromServer: (session) =>
    set((s) => ({
      activePage: session.activePage ?? s.activePage,
      selectedDatasetId:
        session.selectedDatasetId !== undefined
          ? session.selectedDatasetId
          : s.selectedDatasetId,
      selectedModelId:
        session.selectedModelId !== undefined
          ? session.selectedModelId
          : s.selectedModelId,
      uiState: session.uiState ?? s.uiState,
    })),
}));
