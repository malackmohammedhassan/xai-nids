/**
 * modelLabel.ts — Utilities for generating unique, human-readable model labels.
 *
 * A user who trained four "random_forest" models on different datasets and days
 * needs to tell them apart at a glance. This module produces:
 *
 *   Short label (for <option> text):
 *     "Random Forest · UNSW_NB15.csv · Today 14:32 · Acc 99.2%"
 *
 *   Full label (tooltip / card subtitle):
 *     "Random Forest   UNSW_NB15.csv   target: label   48 features
 *      Trained Today 14:32   Accuracy 99.2%   F1 0.9918"
 */

import type { ModelMeta } from '@/types';

// ─── Time helpers ─────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  if (!iso) return 'Unknown date';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return 'Unknown date';
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const yestStart  = new Date(todayStart.getTime() - 86_400_000);
  const time = d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  if (d >= todayStart) return `Today ${time}`;
  if (d >= yestStart)  return `Yesterday ${time}`;
  const diffDays = Math.floor((todayStart.getTime() - d.getTime()) / 86_400_000);
  if (diffDays < 7)    return `${diffDays}d ago ${time}`;
  return d.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' }) + ` ${time}`;
}

// ─── Label builders ───────────────────────────────────────────────────────────

/** Pretty-print model_type: "random_forest" → "Random Forest" */
function prettyType(model_type: string): string {
  return model_type
    .replace(/_/g, ' ')
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

/** Shorten dataset filename: "UNSW_NB15_training-set.csv" → "UNSW_NB15..." */
function shortDataset(filename: string | undefined): string {
  if (!filename) return '';
  // Remove path prefix
  const base = filename.split('/').pop()?.split('\\').pop() ?? filename;
  // Remove extension
  const stem = base.replace(/\.[^.]+$/, '');
  return stem.length > 20 ? stem.slice(0, 18) + '…' : stem;
}

/**
 * Short one-line label suitable for a <select> <option> or dropdown item.
 * Example: "Random Forest · UNSW_NB15 · Today 14:32 · Acc 99.2%"
 */
export function modelOptionLabel(m: ModelMeta): string {
  const parts: string[] = [prettyType(m.model_type)];

  const ds = shortDataset(m.dataset_filename ?? m.dataset_id);
  if (ds) parts.push(ds);

  parts.push(relativeDate(m.created_at));

  if (m.accuracy != null) {
    parts.push(`Acc ${(m.accuracy * 100).toFixed(1)}%`);
  }

  return parts.join(' · ');
}

/**
 * Multi-line detail string shown in the rich dropdown under the main label.
 * Returns an object with individual fields ready for rendering.
 */
export function modelDetail(m: ModelMeta): {
  type: string;
  dataset: string;
  date: string;
  accuracy: string | null;
  f1: string | null;
  features: string;
  shortId: string;
} {
  return {
    type:     prettyType(m.model_type),
    dataset:  m.dataset_filename ?? m.dataset_id ?? '—',
    date:     relativeDate(m.created_at),
    accuracy: m.accuracy != null ? `${(m.accuracy * 100).toFixed(2)}%` : null,
    f1:       m.f1_score  != null ? m.f1_score.toFixed(4) : null,
    features: `${m.feature_names?.length ?? m.feature_count ?? '?'} features`,
    shortId:  m.model_id.slice(-8).toUpperCase(),
  };
}
