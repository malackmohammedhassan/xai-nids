/**
 * PredictionHistory.tsx
 * A compact, scrollable log of the last N predictions made in the session.
 */
import React, { useMemo } from 'react';
import { Clock, CheckCircle, XCircle, ChevronRight } from 'lucide-react';
import type { PredictionResult } from '@/types';

export interface HistoryEntry {
  id: string;
  timestamp: Date;
  features: Record<string, unknown>;
  result: PredictionResult;
}

interface PredictionHistoryProps {
  entries: HistoryEntry[];
  onSelect?: (entry: HistoryEntry) => void;
  selectedId?: string;
  maxVisible?: number;
}

function formatTime(d: Date): string {
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function isAttack(pred: string | number): boolean {
  const s = String(pred).toLowerCase();
  return s !== 'normal' && s !== '0' && s !== 'benign';
}

export const PredictionHistory: React.FC<PredictionHistoryProps> = ({
  entries,
  onSelect,
  selectedId,
  maxVisible = 20,
}) => {
  const visible = useMemo(() => [...entries].reverse().slice(0, maxVisible), [entries, maxVisible]);

  if (visible.length === 0) return null;

  const attacks = visible.filter((e) => isAttack(e.result.prediction)).length;
  const normal = visible.length - attacks;

  return (
    <div className="rounded-xl border border-gray-700 bg-gray-800/50 overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700">
        <div className="flex items-center gap-2">
          <Clock className="h-3.5 w-3.5 text-gray-400" />
          <span className="text-xs font-medium text-gray-300">
            Prediction History ({entries.length})
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <span className="text-emerald-400">{normal} Normal</span>
          <span className="text-red-400">{attacks} Attack</span>
        </div>
      </div>

      {/* Entries */}
      <div className="max-h-64 overflow-y-auto divide-y divide-gray-700/60">
        {visible.map((entry) => {
          const attack = isAttack(entry.result.prediction);
          const conf = entry.result.confidence;
          const isSelected = entry.id === selectedId;

          return (
            <button
              key={entry.id}
              onClick={() => onSelect?.(entry)}
              className={`w-full flex items-center gap-3 px-4 py-2.5 text-left transition-colors hover:bg-gray-700/50 ${
                isSelected ? 'bg-gray-700/70' : ''
              }`}
            >
              {/* Icon */}
              {attack ? (
                <XCircle className="h-4 w-4 text-red-400 shrink-0" />
              ) : (
                <CheckCircle className="h-4 w-4 text-emerald-400 shrink-0" />
              )}

              {/* Prediction + confidence */}
              <div className="flex-1 min-w-0">
                <span
                  className={`text-xs font-semibold ${
                    attack ? 'text-red-300' : 'text-emerald-300'
                  }`}
                >
                  {String(entry.result.prediction)}
                </span>
                {conf != null && (
                  <span className="ml-2 text-xs text-gray-400">
                    {(conf * 100).toFixed(1)}%
                  </span>
                )}
              </div>

              {/* Time */}
              <span className="text-xs text-gray-500 shrink-0">{formatTime(entry.timestamp)}</span>

              {onSelect && <ChevronRight className="h-3.5 w-3.5 text-gray-600 shrink-0" />}
            </button>
          );
        })}
      </div>
    </div>
  );
};
