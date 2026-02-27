import { AlertTriangle, RefreshCw } from 'lucide-react';
import { clsx } from 'clsx';

interface Props {
  title?: string;
  message?: string;
  onRetry?: () => void;
  compact?: boolean;
  className?: string;
}

export function ErrorState({
  title = 'Something went wrong',
  message,
  onRetry,
  compact = false,
  className,
}: Props) {
  if (compact) {
    return (
      <div className={clsx('flex items-center gap-2 text-red-400 text-sm', className)}>
        <AlertTriangle size={14} />
        <span>{title}</span>
        {onRetry && (
          <button onClick={onRetry} className="ml-2 underline hover:no-underline">
            Retry
          </button>
        )}
      </div>
    );
  }

  return (
    <div
      className={clsx(
        'flex flex-col items-center justify-center gap-4 py-16 text-center',
        className
      )}
    >
      <AlertTriangle size={48} className="text-red-400 opacity-80" />
      <div>
        <p className="text-gray-200 font-semibold text-lg">{title}</p>
        {message && <p className="text-gray-400 text-sm mt-1 max-w-sm">{message}</p>}
      </div>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 text-white text-sm rounded-lg transition-colors"
        >
          <RefreshCw size={14} />
          Try Again
        </button>
      )}
    </div>
  );
}
