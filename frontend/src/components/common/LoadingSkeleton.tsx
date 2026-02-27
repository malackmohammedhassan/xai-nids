import { clsx } from 'clsx';

interface Props {
  lines?: number;
  className?: string;
}

export function LoadingSkeleton({ lines = 3, className }: Props) {
  return (
    <div className={clsx('animate-pulse space-y-3', className)}>
      {Array.from({ length: lines }).map((_, i) => (
        <div
          key={i}
          className="h-4 bg-gray-700 rounded"
          style={{ width: `${100 - i * 10}%` }}
        />
      ))}
    </div>
  );
}

export function CardSkeleton({ className }: { className?: string }) {
  return (
    <div className={clsx('animate-pulse bg-gray-800 rounded-xl p-5 space-y-4', className)}>
      <div className="h-5 bg-gray-700 rounded w-2/5" />
      <div className="space-y-2">
        <div className="h-3 bg-gray-700 rounded" />
        <div className="h-3 bg-gray-700 rounded w-4/5" />
        <div className="h-3 bg-gray-700 rounded w-3/5" />
      </div>
    </div>
  );
}
