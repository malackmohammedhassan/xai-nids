/** ErrorPanel.tsx — Friendly error display with optional retry button */
import React from 'react';
import { AlertTriangle, RefreshCw } from 'lucide-react';
import { friendlyError } from '@/utils/errorMessages';

interface ErrorPanelProps {
  message?: string;
  code?: string;
  onRetry?: () => void;
  className?: string;
}

export const ErrorPanel: React.FC<ErrorPanelProps> = ({
  message,
  code,
  onRetry,
  className = '',
}) => {
  const text = message ?? friendlyError(code);
  return (
    <div
      className={`flex flex-col items-center justify-center gap-3 rounded-xl border border-red-500/30 bg-red-950/20 p-6 text-center ${className}`}
    >
      <AlertTriangle className="h-8 w-8 text-red-400" />
      <p className="text-sm text-red-300">{text}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="flex items-center gap-2 rounded-lg bg-red-500/20 px-3 py-1.5 text-xs text-red-300 transition hover:bg-red-500/30"
        >
          <RefreshCw className="h-3 w-3" />
          Retry
        </button>
      )}
    </div>
  );
};
