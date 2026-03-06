/** TaskBadge.tsx — Pulsing dot + count shown in the sidebar nav */
import React from 'react';
import { useJobStore } from '@/store/jobStore';

interface TaskBadgeProps {
  className?: string;
}

export const TaskBadge: React.FC<TaskBadgeProps> = ({ className = '' }) => {
  const { jobs, unreadCount } = useJobStore();
  const active = Object.values(jobs).filter(
    (j) => j.status === 'queued' || j.status === 'running',
  ).length;

  if (active === 0 && unreadCount === 0) return null;

  return (
    <span
      className={`inline-flex h-5 min-w-5 items-center justify-center rounded-full px-1 text-[10px] font-bold ${
        active > 0
          ? 'animate-pulse bg-indigo-500 text-white'
          : 'bg-slate-700 text-slate-300'
      } ${className}`}
    >
      {active > 0 ? active : unreadCount}
    </span>
  );
};
