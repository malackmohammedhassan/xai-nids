import { useCallback } from 'react';
import { trainingApi } from '@/api';
import { useAppStore } from '@/store/appStore';
import { useWebSocket } from './useWebSocket';
import type { TrainingProgressEvent, TrainingRequest } from '@/types';

export function useTraining() {
  const { trainingStatus, setTrainingStatus, trainingLogs, appendLog, clearLogs } =
    useAppStore();

  const handleWsMessage = useCallback(
    (event: TrainingProgressEvent) => {
      if (event.type === 'heartbeat') return;

      appendLog(
        `[${new Date(event.timestamp).toLocaleTimeString()}] ` +
          (event.step ?? event.type) +
          (event.progress !== undefined ? ` (${event.progress}/${event.total})` : '') +
          (event.error ? ` ERROR: ${event.error}` : '') +
          (event.model_id ? ` → model_id: ${event.model_id}` : '')
      );

      if (event.type === 'progress') {
        setTrainingStatus({
          is_training: true,
          current_step: event.step ?? '',
          progress: event.progress ?? 0,
          total: event.total ?? 100,
        });
      } else if (event.type === 'complete') {
        setTrainingStatus({
          is_training: false,
          current_step: 'Complete',
          progress: 100,
          total: 100,
          model_id: event.model_id,
        });
      } else if (event.type === 'error') {
        setTrainingStatus({
          is_training: false,
          current_step: 'Error',
          progress: 0,
          total: 100,
          error: event.error,
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
      appendLog(`Training job started. run_id: ${result.run_id}`);
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
