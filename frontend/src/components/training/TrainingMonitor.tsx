import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { CheckCircle, XCircle, Loader2, Wifi, WifiOff } from 'lucide-react';
import { clsx } from 'clsx';
import type { TrainingStatus } from '@/types';

interface Props {
  status: TrainingStatus | null;
  wsConnected: boolean;
  logs: string[];
}

const STEPS = ['Queued', 'Loading', 'Preprocessing', 'Training', 'Evaluating', 'Saving', 'Complete'];

function progressData(currentStep: string, progress: number, total: number) {
  const idx = STEPS.findIndex((s) => currentStep.toLowerCase().includes(s.toLowerCase()));
  return STEPS.map((step, i) => ({
    step,
    value: i < idx ? 100 : i === idx ? Math.round((progress / (total || 1)) * 100) : 0,
  }));
}

export function TrainingMonitor({ status, wsConnected, logs }: Props) {
  if (!status) {
    return (
      <div className="bg-gray-800 rounded-xl p-6 flex items-center gap-3 text-gray-400 text-sm">
        <Loader2 size={16} className="animate-spin" />
        Waiting for training job…
      </div>
    );
  }

  const pct = status.total > 0 ? Math.round((status.progress / status.total) * 100) : 0;
  const chartData = progressData(status.current_step, status.progress, status.total);

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="bg-gray-800 rounded-xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            {status.is_training ? (
              <Loader2 size={16} className="text-violet-400 animate-spin" />
            ) : status.error ? (
              <XCircle size={16} className="text-red-400" />
            ) : (
              <CheckCircle size={16} className="text-emerald-400" />
            )}
            <span className="text-gray-200 text-sm font-medium">{status.current_step}</span>
          </div>
          <div className={clsx('flex items-center gap-1.5 text-xs', wsConnected ? 'text-emerald-400' : 'text-red-400')}>
            {wsConnected ? <Wifi size={12} /> : <WifiOff size={12} />}
            {wsConnected ? 'Live' : 'Reconnecting'}
          </div>
        </div>

        {/* Progress bar */}
        <div className="w-full h-2.5 bg-gray-700 rounded-full overflow-hidden">
          <div
            className={clsx(
              'h-full rounded-full transition-all duration-500',
              status.error ? 'bg-red-500' : status.is_training ? 'bg-violet-500' : 'bg-emerald-500'
            )}
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="text-right text-xs text-gray-500 mt-1">{pct}%</p>

        {/* Step chart */}
        <ResponsiveContainer width="100%" height={80}>
          <LineChart data={chartData} margin={{ top: 8, right: 10, left: -30, bottom: 0 }}>
            <XAxis dataKey="step" tick={{ fill: '#6b7280', fontSize: 9 }} />
            <YAxis domain={[0, 100]} hide />
            <Tooltip
              contentStyle={{ background: '#1f2937', border: 'none', borderRadius: 6, fontSize: 11 }}
              formatter={(v: number) => [`${v}%`]}
            />
            <Line type="monotone" dataKey="value" stroke="#a78bfa" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      </div>

      {status.model_id && (
        <div className="text-xs text-emerald-400 bg-emerald-500/10 border border-emerald-500/30 rounded-lg px-4 py-2">
          Training complete! Model ID: <span className="font-mono">{status.model_id}</span>
        </div>
      )}

      {status.error && (
        <div className="text-xs text-red-400 bg-red-500/10 border border-red-500/30 rounded-lg px-4 py-2">
          Error: {status.error}
        </div>
      )}
    </div>
  );
}
