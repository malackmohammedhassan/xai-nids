import { clsx } from 'clsx';

type StatusVariant =
  | 'success'
  | 'error'
  | 'warning'
  | 'info'
  | 'neutral'
  | 'training';

interface Props {
  status: StatusVariant;
  label: string;
  dot?: boolean;
  className?: string;
}

const VARIANT_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/30',
  error: 'bg-red-500/20 text-red-400 ring-1 ring-red-500/30',
  warning: 'bg-yellow-500/20 text-yellow-400 ring-1 ring-yellow-500/30',
  info: 'bg-cyan-500/20 text-cyan-400 ring-1 ring-cyan-500/30',
  neutral: 'bg-gray-700/50 text-gray-400 ring-1 ring-gray-600',
  training: 'bg-violet-500/20 text-violet-400 ring-1 ring-violet-500/30',
};

const DOT_CLASSES: Record<StatusVariant, string> = {
  success: 'bg-emerald-400',
  error: 'bg-red-400',
  warning: 'bg-yellow-400',
  info: 'bg-cyan-400',
  neutral: 'bg-gray-400',
  training: 'bg-violet-400 animate-pulse',
};

export function StatusBadge({ status, label, dot = true, className }: Props) {
  return (
    <span
      className={clsx(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-medium',
        VARIANT_CLASSES[status],
        className
      )}
    >
      {dot && <span className={clsx('w-1.5 h-1.5 rounded-full shrink-0', DOT_CLASSES[status])} />}
      {label}
    </span>
  );
}
