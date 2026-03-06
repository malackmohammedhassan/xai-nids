// ─── Colour palettes used consistently across all charts ─────────────────────

/** 10-colour categorical palette (accessibility-tested) */
export const CATEGORICAL_10 = [
  '#6366f1', '#22d3ee', '#10b981', '#f59e0b', '#ef4444',
  '#8b5cf6', '#06b6d4', '#84cc16', '#f97316', '#ec4899',
];

/** Diverging red→green for quality scores */
export const DIVERGING_RG = [
  '#ef4444', '#f97316', '#f59e0b', '#84cc16', '#10b981',
];

/** Sequential blue for correlation / heatmaps */
export const SEQ_BLUE = ['#eff6ff', '#bfdbfe', '#60a5fa', '#2563eb', '#1d4ed8'];

/** Sequential orange-red for anomaly / risk levels */
export const SEQ_RISK = ['#fef3c7', '#fde68a', '#fbbf24', '#f59e0b', '#b45309'];

/** Stroke colour for null / missing values */
export const NULL_COLOUR = '#71717a';

/** Colour for normal traffic in binary datasets */
export const NORMAL_COLOUR = '#10b981';

/** Colour for attack / anomaly traffic */
export const ATTACK_COLOUR = '#ef4444';

/**
 * Map a 0-100 quality score to a hex colour.
 * ≥80 green, ≥60 lime, ≥40 amber, ≥20 orange, else red.
 */
export function scoreColour(score: number): string {
  if (score >= 80) return '#10b981';
  if (score >= 60) return '#84cc16';
  if (score >= 40) return '#f59e0b';
  if (score >= 20) return '#f97316';
  return '#ef4444';
}

/** Pick a stable colour for a categorical label (wraps around palette). */
export function labelColour(label: string, palette = CATEGORICAL_10): string {
  let hash = 0;
  for (let i = 0; i < label.length; i++) hash = (hash * 31 + label.charCodeAt(i)) >>> 0;
  return palette[hash % palette.length];
}
