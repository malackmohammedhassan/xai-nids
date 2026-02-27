/**
 * Format a duration in seconds to a human-readable string.
 * e.g. 65 → "1m 5s", 3661 → "1h 1m 1s"
 */
export function formatDuration(seconds: number): string {
  if (seconds < 60) return `${Math.round(seconds)}s`;
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = Math.round(seconds % 60);
  if (h > 0) return `${h}h ${m}m ${s}s`;
  return `${m}m ${s}s`;
}

/**
 * Format bytes to KB / MB / GB.
 */
export function formatBytes(bytes: number, decimals = 1): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['B', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format a fraction (0–1) as a percentage string.
 */
export function formatPct(value: number, decimals = 1): string {
  return `${(value * 100).toFixed(decimals)}%`;
}

/**
 * Format an ISO timestamp to a localized date-time string.
 */
export function formatTimestamp(iso: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

/**
 * Format a metric value — rounds to 4 decimal places.
 */
export function formatMetric(value: number | undefined, fallback = '—'): string {
  if (value === undefined || value === null || isNaN(value)) return fallback;
  return value.toFixed(4);
}

/**
 * Shorten a UUID to 8 chars for display.
 */
export function shortId(id: string): string {
  return id.slice(0, 8);
}

/**
 * Get a letter grade from a 0-1 metric score (accuracy, F1, AUC).
 */
export function metricGrade(value: number): { grade: string; color: string } {
  if (value >= 0.95) return { grade: 'A+', color: 'text-emerald-400' };
  if (value >= 0.9) return { grade: 'A', color: 'text-emerald-400' };
  if (value >= 0.85) return { grade: 'B+', color: 'text-green-400' };
  if (value >= 0.8) return { grade: 'B', color: 'text-green-400' };
  if (value >= 0.7) return { grade: 'C', color: 'text-yellow-400' };
  if (value >= 0.6) return { grade: 'D', color: 'text-orange-400' };
  return { grade: 'F', color: 'text-red-400' };
}
