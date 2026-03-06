/**
 * ResourceMonitor.tsx
 * Live CPU & RAM usage widget. Polls the /api/v2/system/resources endpoint
 * every 2 seconds and renders animated progress bars.
 */
import React from 'react';
import { Cpu, HardDrive } from 'lucide-react';
import { useResourceMonitor } from '@/hooks/useResourceMonitor';

interface ResourceMonitorProps {
  enabled?: boolean;
  className?: string;
}

function Bar({
  pct,
  colour,
}: {
  pct: number;
  colour: 'cyan' | 'amber' | 'red';
}) {
  const clamp = Math.min(100, Math.max(0, pct));
  const colours = {
    cyan: 'bg-cyan-500',
    amber: 'bg-amber-400',
    red: 'bg-red-500',
  };
  const fill = pct > 85 ? 'red' : pct > 65 ? 'amber' : colour;

  return (
    <div className="w-full bg-slate-800 rounded-full h-1.5 overflow-hidden">
      <div
        className={`${colours[fill]} h-full rounded-full transition-all duration-700 ease-out`}
        style={{ width: `${clamp}%` }}
      />
    </div>
  );
}

export function ResourceMonitor({ enabled = true, className = '' }: ResourceMonitorProps) {
  const { stats, ram_pct } = useResourceMonitor(enabled);

  if (!enabled) return null;

  if (!stats) {
    return (
      <div className={`bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 animate-pulse ${className}`}>
        <div className="h-3 bg-slate-700 rounded w-24" />
        <div className="h-1.5 bg-slate-700 rounded" />
        <div className="h-3 bg-slate-700 rounded w-20" />
        <div className="h-1.5 bg-slate-700 rounded" />
      </div>
    );
  }

  if (!stats.available) {
    return (
      <div className={`bg-slate-900 border border-slate-700 rounded-xl p-4 text-xs text-slate-500 ${className}`}>
        Resource monitoring unavailable (psutil not installed)
      </div>
    );
  }

  const ramGb = (mb: number) =>
    mb >= 1024 ? `${(mb / 1024).toFixed(1)} GB` : `${mb} MB`;

  return (
    <div className={`bg-slate-900 border border-slate-700 rounded-xl p-4 space-y-3 ${className}`}>
      <div className="flex items-center justify-between text-xs text-slate-400 mb-1">
        <span className="font-semibold text-slate-300">System Resources</span>
        {stats.active_jobs > 0 && (
          <span className="bg-cyan-500/15 text-cyan-400 rounded-full px-2 py-0.5 text-[10px]">
            {stats.active_jobs} job{stats.active_jobs !== 1 ? 's' : ''} running
          </span>
        )}
      </div>

      {/* CPU */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <Cpu size={11} />
            CPU
          </span>
          <span
            className={`font-mono font-semibold ${
              stats.cpu_pct > 85
                ? 'text-red-400'
                : stats.cpu_pct > 65
                  ? 'text-amber-400'
                  : 'text-cyan-400'
            }`}
          >
            {stats.cpu_pct.toFixed(1)}%
          </span>
        </div>
        <Bar pct={stats.cpu_pct} colour="cyan" />
      </div>

      {/* RAM */}
      <div className="space-y-1">
        <div className="flex items-center justify-between text-xs">
          <span className="flex items-center gap-1.5 text-slate-400">
            <HardDrive size={11} />
            RAM
          </span>
          <span
            className={`font-mono font-semibold ${
              ram_pct > 85
                ? 'text-red-400'
                : ram_pct > 65
                  ? 'text-amber-400'
                  : 'text-cyan-400'
            }`}
          >
            {ramGb(stats.ram_used_mb)} / {ramGb(stats.ram_total_mb)}
          </span>
        </div>
        <Bar pct={ram_pct} colour="cyan" />
      </div>
    </div>
  );
}
