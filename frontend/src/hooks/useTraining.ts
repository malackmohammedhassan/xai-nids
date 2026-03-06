import { useCallback } from 'react';
import { trainingApi } from '@/api';
import { useAppStore } from '@/store/appStore';
import { useWebSocket } from './useWebSocket';
import type { TrainingProgressEvent, TrainingRequest } from '@/types';

export function useTraining() {
  const { trainingStatus, setTrainingStatus, trainingLogs, appendLog, clearLogs } =
    useAppStore();

  const handleWsMessage = useCallback(
    (ev: TrainingProgressEvent) => {
      const evtType = ev.event;
      const d = ev.data ?? {};

      if (evtType === 'heartbeat') return;

      // Resolve a human-readable timestamp for the log prefix
      const ts = d.timestamp
        ? typeof d.timestamp === 'number'
          ? new Date(d.timestamp * 1000).toLocaleTimeString()
          : String(d.timestamp) // already "HH:MM:SS" from emit_log
        : new Date().toLocaleTimeString();

      if (evtType === 'log') {
        appendLog(`[${ts}] ${d.level ?? 'INFO'}: ${d.message ?? ''}`);
      } else if (evtType === 'step') {
        appendLog(
          `[${ts}] ${d.step_name ?? 'Step'} (${d.step_number ?? 0}/${d.total_steps ?? 0}) — ${d.progress_pct ?? 0}%`
        );
        setTrainingStatus({
          is_training: true,
          current_step: d.step_name ?? '',
          progress: d.step_number ?? 0,
          total: d.total_steps ?? 6,
        });
      } else if (evtType === 'started') {
        appendLog(`[${ts}] Job started — model: ${d.model_type}, dataset: ${d.dataset_id}`);
      } else if (evtType === 'metrics') {
        const relevant = ['accuracy', 'f1_score', 'precision', 'recall', 'roc_auc'];
        const parts = Object.entries(d)
          .filter(([k]) => relevant.includes(k) && d[k] != null)
          .map(([k, v]) => `${k}: ${typeof v === 'number' ? (v as number).toFixed(4) : v}`);
        if (parts.length) appendLog(`[${ts}] Metrics — ${parts.join(' | ')}`);
      } else if (evtType === 'complete') {
        appendLog(
          `[${ts}] ✓ Complete — model_id: ${d.model_id ?? '?'}, run_id: ${d.run_id ?? '?'}` +
          (d.duration_seconds != null ? `, took ${(d.duration_seconds as number).toFixed(1)}s` : '')
        );
        setTrainingStatus({
          is_training: false,
          current_step: 'Complete',
          progress: 100,
          total: 100,
          model_id: d.model_id as string | undefined,
        });
      } else if (evtType === 'error') {
        appendLog(`[${ts}] ✗ ERROR: ${d.message ?? d.error_type ?? 'Unknown error'}`);
        setTrainingStatus({
          is_training: false,
          current_step: 'Error',
          progress: 0,
          total: 100,
          error: d.message as string | undefined,
        });
      }
    },
    [appendLog, setTrainingStatus]
  );

  const { connected: wsConnected } = useWebSocket(handleWsMessage);

  const startTraining = useCallback(
    async (req: TrainingRequest) => {
      clearLogs();
      setTrainingStatus({
        is_training: true,
        current_step: 'Queued',
        progress: 0,
        total: 100,
      });
      const result = await trainingApi.start(req);
      appendLog(`Training job queued. task_id: ${result.task_id}`);
      return result;
    },
    [clearLogs, setTrainingStatus, appendLog]
  );

  const pollStatus = useCallback(async () => {
    const status = await trainingApi.status();
    setTrainingStatus(status);
    return status;
  }, [setTrainingStatus]);

  return {
    trainingStatus,
    trainingLogs,
    wsConnected,
    startTraining,
    pollStatus,
    clearLogs,
  };
}
