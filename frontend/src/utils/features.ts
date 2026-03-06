// ─── Feature flags (read from Vite env vars) ─────────────────────────────────

function flag(name: string, defaultOn = false): boolean {
  const raw = import.meta.env[name];
  if (raw === undefined) return defaultOn;
  return raw === '1' || raw === 'true';
}

export const FEATURES = {
  /** Enable v2 intelligence analysis panel on Dataset page */
  intelligencePanel: flag('VITE_FEATURE_INTELLIGENCE', true),

  /** Enable tier-2 visualizations (histograms, boxplots, correlation, etc.) */
  tier2Viz: flag('VITE_FEATURE_TIER2_VIZ', true),

  /** Enable tier-3 visualizations (PCA, t-SNE, Isolation Forest) */
  tier3Viz: flag('VITE_FEATURE_TIER3_VIZ', true),

  /** Enable background-task panel (GlobalTaskBar + TasksPage) */
  taskPanel: flag('VITE_FEATURE_TASK_PANEL', true),

  /** Enable session persistence (restore last page + selections on reload) */
  sessionPersistence: flag('VITE_FEATURE_SESSION', true),

  /** Enable live confusion matrix during training */
  liveConfusionMatrix: flag('VITE_FEATURE_LIVE_CM', true),

  /** Enable live ROC curve during training */
  liveROC: flag('VITE_FEATURE_LIVE_ROC', true),

  /** Show plain-English SHAP narrative on Explainability page */
  plainEnglishExplanation: flag('VITE_FEATURE_PLAIN_ENGLISH', true),
} as const;
