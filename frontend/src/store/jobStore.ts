/**
 * jobStore.ts — Zustand store for v2 background jobs (intelligence, tier-3 viz, etc.)
 */
import { create } from 'zustand';

export type JobStatus = 'queued' | 'running' | 'succeeded' | 'failed' | 'cancelled';

export interface StructuredError {
  code: string;
  message: string;
  details?: Record<string, unknown>;
}

export interface Job {
  job_id: string;
  job_type: string;
  title: string;
  status: JobStatus;
  dataset_id?: string;
  progress_pct: number;
  current_step?: string;
  logs: string[];
  error?: StructuredError;
  created_at: string;
  started_at?: string;
  finished_at?: string;
  result_url?: string;
  /** Set on retry jobs — points to the original/parent job for lineage tracing. */
  parent_job_id?: string;
}

interface JobStore {
  jobs: Record<string, Job>;
  /** Number of jobs the user hasn't seen yet in the task panel */
  unreadCount: number;

  /** Upsert a job (partial update merges into existing) */
  upsertJob: (job: Partial<Job> & { job_id: string }) => void;
  /** Append a log line to a job */
  appendLog: (jobId: string, line: string) => void;
  /** Replace the full jobs map (used when fetching initial state from API) */
  setJobs: (jobs: Job[]) => void;
  /** Mark all as read */
  clearUnread: () => void;

  // Selectors (plain functions, not memoized – call inside components)
  getJob: (jobId: string) => Job | undefined;
  getJobsByDataset: (datasetId: string) => Job[];
  activeJobs: () => Job[];
}

export const useJobStore = create<JobStore>((set, get) => ({
  jobs: {},
  unreadCount: 0,

  upsertJob: (partial) =>
    set((state) => {
      const existing = state.jobs[partial.job_id];
      const updated: Job = existing
        ? { ...existing, ...partial, logs: existing.logs }
        : ({
            job_type: 'unknown',
            title: 'Background Job',
            status: 'queued',
            progress_pct: 0,
            logs: [],
            created_at: new Date().toISOString(),
            ...partial,
          } as Job);

      // Bump unread when a job transitions to a terminal state
      const wasTerminal = existing
        ? existing.status === 'succeeded' || existing.status === 'failed'
        : false;
      const isTerminal =
        updated.status === 'succeeded' || updated.status === 'failed';
      const newlyTerminal = isTerminal && !wasTerminal;

      return {
        jobs: { ...state.jobs, [partial.job_id]: updated },
        unreadCount: newlyTerminal
          ? state.unreadCount + 1
          : state.unreadCount,
      };
    }),

  appendLog: (jobId, line) =>
    set((state) => {
      const job = state.jobs[jobId];
      if (!job) return state;
      return {
        jobs: {
          ...state.jobs,
          [jobId]: { ...job, logs: [...job.logs.slice(-299), line] },
        },
      };
    }),

  setJobs: (jobs) =>
    set({
      jobs: Object.fromEntries(jobs.map((j) => [j.job_id, j])),
    }),

  clearUnread: () => set({ unreadCount: 0 }),

  getJob: (jobId) => get().jobs[jobId],
  getJobsByDataset: (datasetId) =>
    Object.values(get().jobs).filter((j) => j.dataset_id === datasetId),
  activeJobs: () =>
    Object.values(get().jobs).filter(
      (j) => j.status === 'queued' || j.status === 'running',
    ),
}));
