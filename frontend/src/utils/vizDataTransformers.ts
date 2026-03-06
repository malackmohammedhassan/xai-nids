/**
 * vizDataTransformers.ts
 *
 * Convert raw API payloads (dicts from Python) into arrays / objects that
 * Recharts (and other chart libraries) consume directly.
 */

// ─── Types matching the Python API response shapes ────────────────────────────

export interface NullPctBarItem {
  column: string;
  null_pct: number;
}

export interface CardinalityBarItem {
  column: string;
  unique_count: number;
}

export interface SkewnessBarItem {
  column: string;
  skewness: number;
}

export interface DtypeBreakdownItem {
  dtype: string;
  count: number;
}

export interface ClassDistItem {
  label: string;
  count: number;
}

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
  kde?: number;
}

export interface BoxplotItem {
  column: string;
  min: number;
  q25: number;
  median: number;
  q75: number;
  max: number;
  outlier_count: number;
}

export interface CorrelationCell {
  row: string;
  col: string;
  value: number;
}

export interface MutualInfoItem {
  feature: string;
  score: number;
}

export interface PCAPoint {
  pc1: number;
  pc2: number;
  label?: string;
  anomaly?: boolean;
}

export interface TSNEPoint {
  x: number;
  y: number;
  label?: string;
}

// ─── Transforms ───────────────────────────────────────────────────────────────

/** null_pct_bar → [{column, null_pct}] sorted desc */
export function toNullPctBar(raw: Record<string, number>): NullPctBarItem[] {
  return Object.entries(raw)
    .map(([column, null_pct]) => ({ column, null_pct }))
    .sort((a, b) => b.null_pct - a.null_pct);
}

/** cardinality_bar → [{column, unique_count}] sorted desc */
export function toCardinalityBar(raw: Record<string, number>): CardinalityBarItem[] {
  return Object.entries(raw)
    .map(([column, unique_count]) => ({ column, unique_count }))
    .sort((a, b) => b.unique_count - a.unique_count);
}

/** skewness_bar → [{column, skewness}] sorted by abs skewness desc */
export function toSkewnessBar(raw: Record<string, number>): SkewnessBarItem[] {
  return Object.entries(raw)
    .map(([column, skewness]) => ({ column, skewness }))
    .sort((a, b) => Math.abs(b.skewness) - Math.abs(a.skewness));
}

/** dtype_breakdown → [{dtype, count}] */
export function toDtypeBreakdown(raw: Record<string, number>): DtypeBreakdownItem[] {
  return Object.entries(raw).map(([dtype, count]) => ({ dtype, count }));
}

/** class_distribution → [{label, count}] sorted desc */
export function toClassDist(raw: Record<string, number>): ClassDistItem[] {
  return Object.entries(raw)
    .map(([label, count]) => ({ label, count }))
    .sort((a, b) => b.count - a.count);
}

/** histogram bins: [{bin_start, bin_end, count, kde?}] */
export function toHistogramBins(raw: {
  edges?: number[];
  bins?: number[];   // backend alias for edges
  counts?: number[];
  kde_x?: number[];
  kde_y?: number[];
}): HistogramBin[] {
  const edges = raw.edges ?? raw.bins ?? [];
  const counts = raw.counts ?? [];
  if (!counts.length) return [];
  return counts.map((count, i) => ({
    bin_start: edges[i],
    bin_end: edges[i + 1],
    count,
  }));
}

/** Flatten correlation matrix dict-of-dicts → [{row, col, value}] */
export function toCorrelationCells(raw: Record<string, Record<string, number>>): CorrelationCell[] {
  const cells: CorrelationCell[] = [];
  for (const row of Object.keys(raw)) {
    for (const col of Object.keys(raw[row])) {
      cells.push({ row, col, value: raw[row][col] });
    }
  }
  return cells;
}

/** mutual_info scores → [{feature, score}] sorted desc, top N */
export function toMutualInfo(
  raw: Record<string, number> | null | undefined,
  topN = 20,
): MutualInfoItem[] {
  if (!raw) return [];
  return Object.entries(raw)
    .map(([feature, score]) => ({ feature, score }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topN);
}

/** PCA scatter: zip arrays → [{pc1, pc2, label?, anomaly?}] */
export function toPCAPoints(raw: {
  pc1: number[];
  pc2: number[];
  labels?: string[];
  anomaly_mask?: boolean[];
}): PCAPoint[] {
  return raw.pc1.map((pc1, i) => ({
    pc1,
    pc2: raw.pc2[i],
    label: raw.labels?.[i],
    anomaly: raw.anomaly_mask?.[i],
  }));
}

/** t-SNE scatter: zip arrays → [{x, y, label?}] */
export function toTSNEPoints(raw: {
  x: number[];
  y: number[];
  labels?: string[];
}): TSNEPoint[] {
  return raw.x.map((x, i) => ({
    x,
    y: raw.y[i],
    label: raw.labels?.[i],
  }));
}
