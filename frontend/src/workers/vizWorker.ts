/**
 * vizWorker.ts — Web Worker for heavy client-side visualisation computation.
 * Offloads histogram binning and boxplot stat computation from the main thread.
 *
 * Usage (via Comlink):
 *   import { wrap } from 'comlink';
 *   const worker = wrap<typeof import('./vizWorker')>(new Worker(new URL('./vizWorker.ts', import.meta.url), { type: 'module' }));
 *   const bins = await worker.binHistogram(data, 20);
 */

export interface HistogramBin {
  bin_start: number;
  bin_end: number;
  count: number;
}

export interface BoxplotStats {
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  whisker_lo: number;
  whisker_hi: number;
  outlier_count: number;
}

/** Compute histogram bins for a numeric array */
export function binHistogram(data: number[], numBins = 20): HistogramBin[] {
  if (!data || data.length === 0) return [];
  const valid = data.filter((v) => isFinite(v));
  if (valid.length === 0) return [];

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const binWidth = range / numBins;

  const counts = new Array<number>(numBins).fill(0);
  for (const v of valid) {
    const idx = Math.min(numBins - 1, Math.floor((v - min) / binWidth));
    counts[idx]++;
  }

  return counts.map((count, i) => ({
    bin_start: min + i * binWidth,
    bin_end: min + (i + 1) * binWidth,
    count,
  }));
}

/** Compute boxplot statistics for a numeric array */
export function calcBoxplot(data: number[]): BoxplotStats | null {
  const valid = data.filter((v) => isFinite(v)).sort((a, b) => a - b);
  if (valid.length < 5) return null;

  const quantile = (arr: number[], p: number): number => {
    const idx = (arr.length - 1) * p;
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return arr[lo] + (arr[hi] - arr[lo]) * (idx - lo);
  };

  const q1 = quantile(valid, 0.25);
  const median = quantile(valid, 0.5);
  const q3 = quantile(valid, 0.75);
  const iqr = q3 - q1;
  const whisker_lo = iqr > 0 ? valid.find((v) => v >= q1 - 1.5 * iqr) ?? valid[0] : valid[0];
  const whisker_hi =
    iqr > 0 ? [...valid].reverse().find((v) => v <= q3 + 1.5 * iqr) ?? valid[valid.length - 1] : valid[valid.length - 1];
  const outlier_count = valid.filter((v) => v < whisker_lo || v > whisker_hi).length;

  return {
    min: valid[0],
    q1,
    median,
    q3,
    max: valid[valid.length - 1],
    whisker_lo,
    whisker_hi,
    outlier_count,
  };
}

/** Subsample an array to at most maxPoints, preserving distribution */
export function subsample<T>(data: T[], maxPoints: number): T[] {
  if (data.length <= maxPoints) return data;
  const step = data.length / maxPoints;
  const result: T[] = [];
  for (let i = 0; i < maxPoints; i++) {
    result.push(data[Math.floor(i * step)]);
  }
  return result;
}

// Comlink/message handler for standalone worker use
self.onmessage = (e: MessageEvent<{ type: string; id: string; payload: unknown }>) => {
  const { type, id, payload } = e.data;
  try {
    if (type === 'BIN_HISTOGRAM') {
      const { data, numBins } = payload as { data: number[]; numBins?: number };
      const result = binHistogram(data, numBins ?? 20);
      (self as unknown as Worker).postMessage({ id, result });
    } else if (type === 'CALC_BOXPLOT') {
      const { data } = payload as { data: number[] };
      const result = calcBoxplot(data);
      (self as unknown as Worker).postMessage({ id, result });
    } else if (type === 'SUBSAMPLE') {
      const { data, maxPoints } = payload as { data: unknown[]; maxPoints: number };
      const result = subsample(data, maxPoints);
      (self as unknown as Worker).postMessage({ id, result });
    } else {
      (self as unknown as Worker).postMessage({ id, error: `Unknown message type: ${type}` });
    }
  } catch (err) {
    (self as unknown as Worker).postMessage({ id, error: String(err) });
  }
};
