/**
 * useActivityLogger — semantic wrapper over useAppStore().addActivity
 *
 * Provides named methods for each meaningful user action so that pages
 * don't need to think about ActivityEntry shapes.  Every method appends
 * an entry to the activity log (shown in the bottom half of TaskPanel).
 *
 * Usage:
 *   const logger = useActivityLogger();
 *   logger.pageNavigated('/evaluation', 'Model Evaluation');
 *   logger.modelSelected(model, 'Prediction');
 */
import { useCallback } from 'react';
import { useAppStore } from '@/store/appStore';
import { modelOptionLabel } from '@/utils/modelLabel';
import type { ModelMeta } from '@/types';

const PAGE_NAMES: Record<string, string> = {
  '/':              'Dashboard',
  '/dataset':       'Dataset',
  '/training':      'Model Training',
  '/evaluation':    'Model Evaluation',
  '/explainability':'Explainability Studio',
  '/prediction':    'Prediction Playground',
  '/experiments':   'Experiments',
};

export function useActivityLogger() {
  const addActivity = useAppStore((s) => s.addActivity);

  /** Called whenever the user navigates to a new page */
  const pageNavigated = useCallback(
    (path: string, customName?: string) => {
      const name = customName ?? PAGE_NAMES[path] ?? path;
      addActivity({ type: 'info', message: `Navigated to ${name}`, detail: path });
    },
    [addActivity],
  );

  /** Model chosen in any model selector */
  const modelSelected = useCallback(
    (model: ModelMeta, context: string) => {
      addActivity({
        type: 'info',
        message: `Model selected for ${context}`,
        detail: modelOptionLabel(model),
      });
    },
    [addActivity],
  );

  /** Training job kicked off */
  const trainingStarted = useCallback(
    (modelType: string, datasetName?: string) => {
      addActivity({
        type: 'info',
        message: `Training started — ${modelType}`,
        detail: datasetName ? `Dataset: ${datasetName}` : undefined,
      });
    },
    [addActivity],
  );

  /** Training job finished */
  const trainingCompleted = useCallback(
    (modelId: string, accuracy?: number) => {
      addActivity({
        type: 'success',
        message: 'Training completed',
        detail: accuracy != null
          ? `${modelId} · Acc ${(accuracy * 100).toFixed(1)}%`
          : modelId,
      });
    },
    [addActivity],
  );

  /** Prediction run against a model */
  const predictionRun = useCallback(
    (modelType: string, prediction: string | number, confidence?: number) => {
      const conf = confidence != null ? ` (${(confidence * 100).toFixed(1)}% confidence)` : '';
      addActivity({
        type: 'success',
        message: `Prediction: ${String(prediction)}${conf}`,
        detail: `Model: ${modelType}`,
      });
    },
    [addActivity],
  );

  /** Prediction attempt failed */
  const predictionFailed = useCallback(
    (modelType: string, reason?: string) => {
      addActivity({
        type: 'error',
        message: `Prediction failed — ${modelType}`,
        detail: reason,
      });
    },
    [addActivity],
  );

  /** Explainability explanation computed */
  const explainabilityRun = useCallback(
    (modelType: string, method: string) => {
      addActivity({
        type: 'success',
        message: `${method.toUpperCase()} explanation computed`,
        detail: `Model: ${modelType}`,
      });
    },
    [addActivity],
  );

  /** Explainability explanation failed */
  const explainabilityFailed = useCallback(
    (modelType: string, method: string, reason?: string) => {
      addActivity({
        type: 'error',
        message: `${method.toUpperCase()} explanation failed — ${modelType}`,
        detail: reason,
      });
    },
    [addActivity],
  );

  /** Dataset file uploaded */
  const datasetUploaded = useCallback(
    (filename: string, rows?: number) => {
      addActivity({
        type: 'success',
        message: `Dataset uploaded — ${filename}`,
        detail: rows != null ? `${rows.toLocaleString()} rows` : undefined,
      });
    },
    [addActivity],
  );

  /** Existing dataset selected for analysis */
  const datasetSelected = useCallback(
    (filename: string) => {
      addActivity({
        type: 'info',
        message: `Dataset selected — ${filename}`,
      });
    },
    [addActivity],
  );

  /** Model chosen for evaluation */
  const evaluationModelSelected = useCallback(
    (model: ModelMeta) => {
      addActivity({
        type: 'info',
        message: 'Model loaded for evaluation',
        detail: modelOptionLabel(model),
      });
    },
    [addActivity],
  );

  /** Experiment (run) deleted from the experiments table */
  const experimentDeleted = useCallback(
    (runId: string) => {
      addActivity({
        type: 'warning',
        message: `Experiment deleted`,
        detail: `Run: ${runId}`,
      });
    },
    [addActivity],
  );

  /** Generic info log for any other user action */
  const logInfo = useCallback(
    (message: string, detail?: string) => {
      addActivity({ type: 'info', message, detail });
    },
    [addActivity],
  );

  return {
    pageNavigated,
    modelSelected,
    trainingStarted,
    trainingCompleted,
    predictionRun,
    predictionFailed,
    explainabilityRun,
    explainabilityFailed,
    datasetUploaded,
    datasetSelected,
    evaluationModelSelected,
    experimentDeleted,
    logInfo,
  };
}
