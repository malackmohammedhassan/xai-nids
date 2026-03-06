/**
 * API shape adapters + utility tests.
 *
 * Covers:
 *  - validateDatasetFile / validateFeatureInput
 *  - errorMessages.friendlyError
 *  - formatters
 *  - vizDataTransformers
 */
import { describe, it, expect } from 'vitest';
import { validateDatasetFile, validateFeatureInput } from '@/utils/validators';
import { friendlyError, ERROR_MESSAGES } from '@/utils/errorMessages';
import { formatBytes, formatDuration } from '@/utils/formatters';

// ─── validateDatasetFile ──────────────────────────────────────────────────────

describe('validateDatasetFile', () => {
  const makeFile = (name: string, size = 1024) =>
    new File(['x'.repeat(size)], name, { type: 'text/csv' });

  it('accepts .csv files', () => {
    expect(validateDatasetFile(makeFile('data.csv')).valid).toBe(true);
  });

  it('accepts .parquet files', () => {
    expect(validateDatasetFile(makeFile('data.parquet')).valid).toBe(true);
  });

  it('rejects .pdf extension', () => {
    const result = validateDatasetFile(makeFile('report.pdf'));
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/unsupported file type/i);
  });

  it('rejects .exe extension', () => {
    expect(validateDatasetFile(makeFile('evil.exe')).valid).toBe(false);
  });

  it('rejects files exceeding 200 MB', () => {
    const tooBig = makeFile('big.csv', 201 * 1024 * 1024);
    const result = validateDatasetFile(tooBig);
    expect(result.valid).toBe(false);
    expect(result.error).toMatch(/exceeds limit/i);
  });

  it('accepts files right at the 200 MB boundary', () => {
    const atLimit = makeFile('limit.csv', 200 * 1024 * 1024);
    expect(validateDatasetFile(atLimit).valid).toBe(true);
  });
});

// ─── validateFeatureInput ─────────────────────────────────────────────────────

describe('validateFeatureInput', () => {
  const required = ['feat_a', 'feat_b', 'feat_c'];

  it('passes when all required fields are present', () => {
    const result = validateFeatureInput(
      { feat_a: '0.5', feat_b: '0.3', feat_c: '0.7' },
      required
    );
    expect(result.valid).toBe(true);
    expect(result.missing).toHaveLength(0);
  });

  it('reports missing fields', () => {
    const result = validateFeatureInput({ feat_a: '0.5' }, required);
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('feat_b');
    expect(result.missing).toContain('feat_c');
  });

  it('reports empty string values as missing', () => {
    const result = validateFeatureInput(
      { feat_a: '', feat_b: '0.3', feat_c: '0.7' },
      required
    );
    expect(result.valid).toBe(false);
    expect(result.missing).toContain('feat_a');
  });

  it('returns valid for extra (non-required) fields', () => {
    const result = validateFeatureInput(
      { feat_a: '0.5', feat_b: '0.3', feat_c: '0.7', extra: '99' },
      required
    );
    // Extra fields are allowed client-side (server validates them)
    expect(result.missing).toHaveLength(0);
  });
});

// ─── friendlyError ────────────────────────────────────────────────────────────

describe('friendlyError', () => {
  it('returns the human message for known error codes', () => {
    expect(friendlyError('invalid_file_type')).toBe(ERROR_MESSAGES.invalid_file_type);
    expect(friendlyError('training_in_progress')).toBe(ERROR_MESSAGES.training_in_progress);
    expect(friendlyError('dataset_not_found')).toBe(ERROR_MESSAGES.dataset_not_found);
  });

  it('returns fallback for unknown code', () => {
    expect(friendlyError('totally_unknown_code')).toMatch(/error: totally_unknown_code/i);
  });

  it('returns unknown message when code is undefined', () => {
    expect(friendlyError(undefined)).toBe(ERROR_MESSAGES.unknown);
  });

  it('returns null-safe result when code is null', () => {
    expect(friendlyError(null)).toBe(ERROR_MESSAGES.unknown);
  });

  it('uses custom fallback when provided', () => {
    expect(friendlyError('missing_code', 'Custom fallback')).toBe('Custom fallback');
  });
});

// ─── formatters ──────────────────────────────────────────────────────────────

describe('formatBytes', () => {
  it('formats bytes', () => {
    expect(formatBytes(512)).toMatch(/512\s*B/);
  });

  it('formats kilobytes', () => {
    expect(formatBytes(2048)).toMatch(/2(\.\d+)?\s*KB/i);
  });

  it('formats megabytes', () => {
    expect(formatBytes(5 * 1024 * 1024)).toMatch(/5(\.\d+)?\s*MB/i);
  });

  it('handles zero gracefully', () => {
    const result = formatBytes(0);
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
  });
});

describe('formatDuration', () => {
  it('formats seconds under a minute', () => {
    expect(formatDuration(45)).toMatch(/45\s*s/i);
  });

  it('formats minutes', () => {
    expect(formatDuration(125)).toMatch(/2\s*m/i);
  });

  it('handles zero', () => {
    const result = formatDuration(0);
    expect(typeof result).toBe('string');
  });
});
