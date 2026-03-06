/**
 * usePipelineAdvisor
 * ==================
 * Fetches dataset-aware pipeline recommendations from the backend and
 * derives a default `PipelineConfig` from those recommendations.
 *
 * Usage:
 *   const { recommendation, config, setConfig, loading, error, refresh } =
 *     usePipelineAdvisor(datasetId, targetColumn);
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { trainingApi } from '@/api';
import {
  defaultPipelineConfig,
  type PipelineConfig,
  type PipelineRecommendation,
} from '@/types/pipeline';

interface UsePipelineAdvisorResult {
  /** Raw recommendation payload from the backend */
  recommendation: PipelineRecommendation | null;
  /** Current editable PipelineConfig (starts from recommendations) */
  config: PipelineConfig;
  /** Update the pipeline config (partial or full) */
  setConfig: (updater: (prev: PipelineConfig) => PipelineConfig) => void;
  /** Replace config entirely */
  resetToRecommended: () => void;
  loading: boolean;
  error: string | null;
  /** Manually re-fetch (e.g. after changing target column) */
  refresh: () => void;
}

/**
 * Map the flat `recommended` strings from the backend StepRecommendation
 * array into a typed PipelineConfig.
 */
function buildConfigFromRecommendation(rec: PipelineRecommendation): PipelineConfig {
  const base = defaultPipelineConfig();
  // Build a lookup: step name → recommended value
  const stepMap: Record<string, string> = {};
  for (const s of rec.steps) {
    stepMap[s.step] = s.recommended;
  }

  return {
    missing_values: {
      ...base.missing_values,
      strategy: (stepMap['missing_values'] ?? base.missing_values.strategy) as PipelineConfig['missing_values']['strategy'],
    },
    duplicates: {
      remove: stepMap['duplicates'] !== 'keep',
    },
    outliers: {
      ...base.outliers,
      method: (stepMap['outliers'] ?? base.outliers.method) as PipelineConfig['outliers']['method'],
    },
    label_mode: {
      mode: (stepMap['label_mode'] ?? base.label_mode.mode) as PipelineConfig['label_mode']['mode'],
    },
    encoding: {
      strategy: (stepMap['encoding'] ?? base.encoding.strategy) as PipelineConfig['encoding']['strategy'],
    },
    scaling: {
      strategy: (stepMap['scaling'] ?? base.scaling.strategy) as PipelineConfig['scaling']['strategy'],
    },
    feature_selection: {
      ...base.feature_selection,
      method: (stepMap['feature_selection'] ?? base.feature_selection.method) as PipelineConfig['feature_selection']['method'],
    },
    class_balancing: {
      method: (stepMap['class_balancing'] ?? base.class_balancing.method) as PipelineConfig['class_balancing']['method'],
    },
    split: {
      ...base.split,
    },
    cross_validation: {
      ...base.cross_validation,
      enabled: stepMap['cross_validation'] === 'enabled',
    },
  };
}

export function usePipelineAdvisor(
  datasetId: string,
  targetColumn?: string,
): UsePipelineAdvisorResult {
  const [recommendation, setRecommendation] = useState<PipelineRecommendation | null>(null);
  const [config, setConfigState] = useState<PipelineConfig>(defaultPipelineConfig);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Track current fetch to avoid stale updates
  const fetchIdRef = useRef(0);

  const fetch = useCallback(() => {
    if (!datasetId) {
      setRecommendation(null);
      setConfigState(defaultPipelineConfig());
      setError(null);
      return;
    }

    const id = ++fetchIdRef.current;
    setLoading(true);
    setError(null);

    trainingApi
      .recommendPipeline(datasetId, targetColumn)
      .then((rec) => {
        if (id !== fetchIdRef.current) return; // stale
        setRecommendation(rec);
        setConfigState(buildConfigFromRecommendation(rec));
      })
      .catch((err: unknown) => {
        if (id !== fetchIdRef.current) return;
        const msg =
          err instanceof Error ? err.message : 'Failed to load recommendations';
        setError(msg);
        // Fall back to defaults so the user can still train
        setConfigState(defaultPipelineConfig());
      })
      .finally(() => {
        if (id === fetchIdRef.current) setLoading(false);
      });
  }, [datasetId, targetColumn]);

  useEffect(() => {
    fetch();
  }, [fetch]);

  const setConfig = useCallback(
    (updater: (prev: PipelineConfig) => PipelineConfig) => {
      setConfigState((prev) => updater(prev));
    },
    [],
  );

  const resetToRecommended = useCallback(() => {
    if (recommendation) {
      setConfigState(buildConfigFromRecommendation(recommendation));
    } else {
      setConfigState(defaultPipelineConfig());
    }
  }, [recommendation]);

  return {
    recommendation,
    config,
    setConfig,
    resetToRecommended,
    loading,
    error,
    refresh: fetch,
  };
}
