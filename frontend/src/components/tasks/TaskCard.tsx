/** TaskCard.tsx — Single background job card with retry, log-download and failure classification */
import React, { useState } from 'react';
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
  X,
  RotateCcw,
  ChevronDown,
  ChevronUp,
  Download,
  AlertTriangle,
} from 'lucide-react';
import { cancelJob, retryJob } from '@/api/jobs';
import { useJobStore } from '@/store/jobStore';
import type { Job } from '@/store/jobStore';

interface TaskCardProps {
  job: Job;
  /** Called after a successful retry so the parent can refresh the list */
  onRetried?: (newJobId: string) => void;
}

const STATUS_ICON: Record<string, React.ReactNode> = {
  queued: <Clock className="h-4 w-4 text-slate-400" />,
  running: <Loader2 className="h-4 w-4 animate-spin text-indigo-400" />,
  completed: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  succeeded: <CheckCircle className="h-4 w-4 text-emerald-400" />,
  failed: <XCircle className="h-4 w-4 text-red-400" />,
  cancelled: <XCircle className="h-4 w-4 text-slate-500" />,
};

const STATUS_COLOUR: Record<string, string> = {
  queued: 'border-slate-700',
  running: 'border-indigo-500/50',
  completed: 'border-emerald-500/40',
  succeeded: 'border-emerald-500/40',
  failed: 'border-red-500/40',
  cancelled: 'border-slate-700',
};

/** Friendly badge for known error codes */
const ERROR_CODE_BADGE: Record<string, { label: string; cls: string }> = {
  JOB_FAILED:            { label: 'Job Error',      cls: 'bg-red-900/50 text-red-300' },
  TRAINING_FAILED:       { label: 'Training Error',  cls: 'bg-orange-900/50 text-orange-300' },
  DATASET_NOT_FOUND:     { label: 'Dataset Missing', cls: 'bg-yellow-900/50 text-yellow-300' },
  MODEL_NOT_FOUND:       { label: 'Model Missing',   cls: 'bg-yellow-900/50 text-yellow-300' },
  INSUFFICIENT_DATA:     { label: 'Not Enough Data', cls: 'bg-yellow-900/50 text-yellow-300' },
  RESOURCE_EXHAUSTED:    { label: 'Out of Memory',   cls: 'bg-pink-900/50 text-pink-300' },
  CANCELLED:             { label: 'Cancelled',       cls: 'bg-slate-800 text-slate-400' },
};

function durationLabel(job: Job): string | null {
  if (!job.started_at || !job.finished_at) return null;
  const secs = Math.round(
    (new Date(job.finished_at).getTime() - new Date(job.started_at).getTime()) / 1_000,
  );
  if (secs < 60) return `${secs}s`;
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${m}m ${s}s`;
}

export const TaskCard: React.FC<TaskCardProps> = ({ job, onRetried }) => {
  const upsertJob = useJobStore((s) => s.upsertJob);
  const isActive = job.status === 'queued' || job.status === 'running';
  const isFailed = job.status === 'failed' || job.status === 'cancelled';
  const [showLogs, setShowLogs] = useState(false);
  const [retrying, setRetrying] = useState(false);

  const handleCancel = async () => {
    try {
      await cancelJob(job.job_id);
      upsertJob({ job_id: job.job_id, status: 'cancelled' });
    } catch {
      /* ignore */
    }
  };

  const handleRetry = async () => {
    setRetrying(true);
    try {
      const res = await retryJob(job.job_id);
      onRetried?.(res.new_job_id);
    } catch {
      /* show nothing — the error is visible in the job itself */
    } finally {
      setRetrying(false);
    }
  };

  const handleDownloadLogs = () => {
    if (!job.logs?.length) return;
    const blob = new Blob([job.logs.join('\n')], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `job_${job.job_id}_logs.txt`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const errorBadge = job.error?.code
    ? ERROR_CODE_BADGE[job.error.code] ?? { label: job.error.code, cls: 'bg-red-900/50 text-red-300' }
    : null;

  const duration = durationLabel(job);

  return (
    <div
      className={`rounded-lg border bg-slate-900/60 p-3 ${STATUS_COLOUR[job.status] ?? 'border-slate-700'}`}
    >
      {/* ── Header row ─────────────────────────────────────────────────────── */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          {STATUS_ICON[job.status]}
          <span className="truncate text-sm font-medium text-slate-200">{job.title}</span>
          {errorBadge && (
            <span className={`shrink-0 rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${errorBadge.cls}`}>
              {errorBadge.label}
            </span>
          )}
        </div>

        {/* Action buttons */}
        <div className="flex shrink-0 items-center gap-1">
          {duration && (
            <span className="text-[10px] text-slate-500">{duration}</span>
          )}
          {/* Retry button for failed/cancelled */}
          {isFailed && (
            <button
              onClick={handleRetry}
              disabled={retrying}
              className="rounded p-0.5 text-indigo-400 hover:text-indigo-200 disabled:opacity-40"
              title="Retry job"
            >
              <RotateCcw className={`h-3.5 w-3.5 ${retrying ? 'animate-spin' : ''}`} />
            </button>
          )}
          {/* Download logs */}
          {(job.logs?.length ?? 0) > 0 && (
            <button
              onClick={handleDownloadLogs}
              className="rounded p-0.5 text-slate-400 hover:text-slate-200"
              title="Download logs"
            >
              <Download className="h-3.5 w-3.5" />
            </button>
          )}
          {/* Toggle log drawer */}
          {(job.logs?.length ?? 0) > 0 && (
            <button
              onClick={() => setShowLogs((v) => !v)}
              className="rounded p-0.5 text-slate-500 hover:text-slate-300"
              title={showLogs ? 'Hide logs' : 'Show logs'}
            >
              {showLogs ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            </button>
          )}
          {/* Cancel active job */}
          {isActive && (
            <button
              onClick={handleCancel}
              className="rounded p-0.5 text-slate-500 hover:text-slate-300"
              title="Cancel job"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          )}
        </div>
      </div>

      {/* ── Progress bar ───────────────────────────────────────────────────── */}
      {isActive && (
        <div className="mt-2">
          <div className="flex justify-between text-[10px] text-slate-500">
            <span>{job.current_step ?? 'Waiting…'}</span>
            <span>{Math.round(job.progress_pct)}%</span>
          </div>
          <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-slate-800">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-500"
              style={{ width: `${job.progress_pct}%` }}
            />
          </div>
        </div>
      )}

      {/* ── Error detail ───────────────────────────────────────────────────── */}
      {isFailed && job.error && (
        <div className="mt-1.5 flex items-start gap-1">
          <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
          <p className="text-[10px] text-red-400 line-clamp-2">
            {job.error.message}
          </p>
        </div>
      )}

      {/* ── Log drawer ─────────────────────────────────────────────────────── */}
      {showLogs && (job.logs?.length ?? 0) > 0 && (
        <div className="mt-2 max-h-40 overflow-y-auto rounded bg-slate-950 p-2">
          {job.logs!.map((line, i) => (
            <p key={i} className="whitespace-pre-wrap font-mono text-[9px] text-slate-400">
              {line}
            </p>
          ))}
        </div>
      )}
    </div>
  );
};

