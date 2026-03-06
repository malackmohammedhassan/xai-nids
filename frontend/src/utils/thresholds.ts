// ─── Quality score thresholds (0-100 scale) ───────────────────────────────────

export const QUALITY_SCORE = {
  EXCELLENT: 80,
  GOOD: 60,
  FAIR: 40,
  POOR: 20,
} as const;

export type QualityBand = 'excellent' | 'good' | 'fair' | 'poor' | 'critical';

export function qualityBand(score: number): QualityBand {
  if (score >= QUALITY_SCORE.EXCELLENT) return 'excellent';
  if (score >= QUALITY_SCORE.GOOD) return 'good';
  if (score >= QUALITY_SCORE.FAIR) return 'fair';
  if (score >= QUALITY_SCORE.POOR) return 'poor';
  return 'critical';
}

export const QUALITY_BAND_LABELS: Record<QualityBand, string> = {
  excellent: 'Excellent',
  good: 'Good',
  fair: 'Fair',
  poor: 'Poor',
  critical: 'Critical',
};

// ─── Null / missing thresholds ────────────────────────────────────────────────
export const NULL_PCT_WARN = 0.05;   // >5 % → warning
export const NULL_PCT_ERROR = 0.2;   // >20% → error

// ─── Imbalance thresholds ─────────────────────────────────────────────────────
/** Minority class fraction below which we flag imbalance. */
export const IMBALANCE_WARN = 0.1;
export const IMBALANCE_ERROR = 0.02;

// ─── Correlation thresholds ───────────────────────────────────────────────────
export const HIGH_CORR_THRESHOLD = 0.95;
export const MODERATE_CORR_THRESHOLD = 0.7;

// ─── Cardinality thresholds ───────────────────────────────────────────────────
export const HIGH_CARD_THRESHOLD = 50;   // unique values for categorical col

// ─── Outlier thresholds ───────────────────────────────────────────────────────
export const OUTLIER_PCT_WARN = 0.03;

// ─── Job / task timeouts (ms) ─────────────────────────────────────────────────
export const TSNE_MAX_ROWS = 5_000;
export const PCA_MAX_ROWS = 100_000;
