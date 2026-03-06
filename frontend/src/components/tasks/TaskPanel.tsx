/** TaskPanel.tsx — Slide-out drawer: top half = background jobs, bottom half = activity log */
import React, { useEffect } from 'react';
import { X, CheckCircle2, XCircle, Info, AlertTriangle, Trash2 } from 'lucide-react';
import { useJobStore } from '@/store/jobStore';
import { useAppStore, type ActivityEntry } from '@/store/appStore';
import { listJobs } from '@/api/jobs';
import { TaskCard } from './TaskCard';

interface TaskPanelProps {
  open: boolean;
  onClose: () => void;
}

const ACTIVITY_ICON: Record<ActivityEntry['type'], React.ReactNode> = {
  success: <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400 shrink-0" />,
  error:   <XCircle      className="h-3.5 w-3.5 text-red-400    shrink-0" />,
  warning: <AlertTriangle className="h-3.5 w-3.5 text-amber-400  shrink-0" />,
  info:    <Info          className="h-3.5 w-3.5 text-sky-400    shrink-0" />,
};

const ACTIVITY_TIME_CLS: Record<ActivityEntry['type'], string> = {
  success: 'text-emerald-500',
  error:   'text-red-500',
  warning: 'text-amber-500',
  info:    'text-sky-500',
};

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

export const TaskPanel: React.FC<TaskPanelProps> = ({ open, onClose }) => {
  const { jobs, setJobs, clearUnread } = useJobStore();
  const activityLog = useAppStore((s) => s.activityLog);
  const clearActivity = useAppStore((s) => s.clearActivity);

  useEffect(() => {
    if (!open) return;
    clearUnread();
    listJobs().then((res) => setJobs(res.jobs)).catch(() => {/* ignore */});
  }, [open, clearUnread, setJobs]);

  const sorted = Object.values(jobs).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
  const active = sorted.filter((j) => j.status === 'queued' || j.status === 'running');
  const done   = sorted.filter((j) => j.status !== 'queued' && j.status !== 'running');

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm"
          onClick={onClose}
        />
      )}

      {/* Panel */}
      <div
        className={`fixed right-0 top-0 z-50 flex h-full w-96 flex-col bg-slate-950 shadow-2xl border-l border-slate-800 transition-transform duration-300 ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* ── Header ── */}
        <div className="flex items-center justify-between border-b border-slate-800 px-4 py-3 shrink-0">
          <h2 className="text-sm font-semibold text-slate-100">Activity &amp; Tasks</h2>
          <button onClick={onClose} className="rounded p-1 text-slate-400 hover:text-slate-200">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Top half: Background Jobs ── */}
        <div className="flex flex-col" style={{ height: '50%' }}>
          <div className="px-4 py-2 border-b border-slate-800/60 shrink-0">
            <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
              Background Tasks
            </span>
            {active.length > 0 && (
              <span className="ml-2 inline-flex h-4 min-w-4 items-center justify-center rounded-full bg-indigo-600 px-1 text-[10px] font-bold text-white">
                {active.length}
              </span>
            )}
          </div>

          <div className="flex-1 overflow-y-auto p-3 space-y-2">
            {active.length === 0 && done.length === 0 ? (
              <p className="py-6 text-center text-xs text-slate-500">No background tasks yet.</p>
            ) : (
              <>
                {active.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 px-1">
                      Active ({active.length})
                    </p>
                    {active.map((j) => <TaskCard key={j.job_id} job={j} />)}
                  </section>
                )}
                {done.length > 0 && (
                  <section className="space-y-2">
                    <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-600 px-1 mt-2">
                      Completed ({done.length})
                    </p>
                    {done.map((j) => <TaskCard key={j.job_id} job={j} />)}
                  </section>
                )}
              </>
            )}
          </div>
        </div>

        {/* ── Divider ── */}
        <div className="shrink-0 border-t border-slate-700 bg-slate-900/50 px-4 py-2 flex items-center justify-between">
          <span className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Activity Log
          </span>
          {activityLog.length > 0 && (
            <button
              onClick={clearActivity}
              title="Clear log"
              className="flex items-center gap-1 text-[10px] text-slate-600 hover:text-slate-400 transition-colors"
            >
              <Trash2 className="h-3 w-3" />
              Clear
            </button>
          )}
        </div>

        {/* ── Bottom half: Activity Log ── */}
        <div className="flex-1 overflow-y-auto px-3 pb-3 space-y-0.5">
          {activityLog.length === 0 ? (
            <p className="py-6 text-center text-xs text-slate-500">
              All API actions will appear here.
            </p>
          ) : (
            activityLog.map((entry) => (
              <div
                key={entry.id}
                className="flex items-start gap-2 py-1.5 border-b border-slate-800/40 last:border-0"
              >
                <div className="mt-0.5">{ACTIVITY_ICON[entry.type]}</div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-200 leading-snug">{entry.message}</p>
                  {entry.detail && (
                    <p className="text-[10px] text-slate-600 font-mono truncate mt-0.5">
                      {entry.detail}
                    </p>
                  )}
                </div>
                <span className={`text-[10px] shrink-0 mt-0.5 ${ACTIVITY_TIME_CLS[entry.type]}`}>
                  {fmtTime(entry.time)}
                </span>
              </div>
            ))
          )}
        </div>
      </div>
    </>
  );
};
