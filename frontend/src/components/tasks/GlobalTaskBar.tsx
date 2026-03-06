/** GlobalTaskBar.tsx — Fixed bottom-right FAB showing active job count */
import React, { useState } from 'react';
import { Activity } from 'lucide-react';
import { useJobStore } from '@/store/jobStore';
import { TaskBadge } from './TaskBadge';
import { TaskPanel } from './TaskPanel';

export const GlobalTaskBar: React.FC = () => {
  const [open, setOpen] = useState(false);
  const activeCount = useJobStore((s) => s.activeJobs().length);
  const unread = useJobStore((s) => s.unreadCount);

  const hasActivity = activeCount > 0 || unread > 0;

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        title="Background Tasks"
        className={`fixed bottom-5 right-5 z-40 flex h-12 w-12 items-center justify-center rounded-full shadow-lg transition-all
          ${hasActivity
            ? 'bg-indigo-600 text-white hover:bg-indigo-500'
            : 'bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-slate-200'
          }`}
      >
        <Activity className="h-5 w-5" />
        {hasActivity && (
          <span className="absolute -right-1 -top-1">
            <TaskBadge />
          </span>
        )}
      </button>

      <TaskPanel open={open} onClose={() => setOpen(false)} />
    </>
  );
};
