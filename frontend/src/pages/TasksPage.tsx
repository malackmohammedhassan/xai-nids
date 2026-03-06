/**
 * TasksPage.tsx — Full page view for background job history
 */
import { useEffect } from 'react';
import { Activity } from 'lucide-react';
import { useJobStore } from '@/store/jobStore';
import { listJobs, cancelJob } from '@/api/jobs';
import { TaskCard } from '@/components/tasks/TaskCard';
import { useJobWebSocket } from '@/hooks/useJobWebSocket';

export default function TasksPage() {
  const { jobs, setJobs, clearUnread } = useJobStore();
  const { connected } = useJobWebSocket();

  useEffect(() => {
    clearUnread();
    listJobs().then((r) => setJobs(r.jobs)).catch(() => {/* ignore */});
  }, [clearUnread, setJobs]);

  const sorted = Object.values(jobs).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );

  const active = sorted.filter((j) => j.status === 'queued' || j.status === 'running');
  const completed = sorted.filter(
    (j) => j.status === 'succeeded' || j.status === 'failed' || j.status === 'cancelled',
  );

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Background Tasks</h1>
        <div className="flex items-center gap-2">
          <span
            className={`inline-flex h-2 w-2 rounded-full ${connected ? 'bg-emerald-400' : 'bg-red-500'}`}
          />
          <span className="text-xs text-slate-500">{connected ? 'Live' : 'Disconnected'}</span>
        </div>
      </div>

      {/* Active jobs */}
      {active.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Active ({active.length})
          </h2>
          {active.map((j) => (
            <TaskCard key={j.job_id} job={j} />
          ))}
        </section>
      )}

      {/* History */}
      {completed.length > 0 && (
        <section className="space-y-2">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            History ({completed.length})
          </h2>
          {completed.map((j) => (
            <TaskCard key={j.job_id} job={j} />
          ))}
        </section>
      )}

      {sorted.length === 0 && (
        <div className="flex flex-col items-center gap-3 py-16 text-center">
          <Activity className="h-10 w-10 text-slate-700" />
          <p className="text-sm text-slate-500">No background tasks yet.</p>
          <p className="text-xs text-slate-600">
            Intelligence analysis and tier-3 visualizations run here.
          </p>
        </div>
      )}
    </div>
  );
}
