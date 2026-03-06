/**
 * ModelSelect.tsx — Rich custom dropdown for choosing a trained model.
 *
 * Replaces the bare <select> with a panel that shows:
 *   • Model type (human-formatted)
 *   • Dataset filename (what data it learned from)
 *   • Training date/time (relative: "Today 14:32", "Yesterday", "3d ago")
 *   • Accuracy + F1 badges (so you can pick the best model instantly)
 *   • Feature count & loaded status
 *   • A unique short ID so models with identical settings are distinguishable
 */
import React, { useEffect, useRef, useState } from 'react';
import {
  ChevronDown,
  Database,
  Calendar,
  Zap,
  Layers,
  CheckCircle2,
  Circle,
  BarChart2,
} from 'lucide-react';
import type { ModelMeta } from '@/types';
import { modelDetail } from '@/utils/modelLabel';

interface ModelSelectProps {
  models: ModelMeta[];
  value: string | null;
  onChange: (modelId: string) => void;
  placeholder?: string;
  className?: string;
}

/** Left accent bar colour cycling through 6 hues */
const ACCENTS = [
  'bg-cyan-500',
  'bg-violet-500',
  'bg-emerald-500',
  'bg-amber-500',
  'bg-rose-500',
  'bg-sky-500',
];

/** Map model index → fixed accent so colour stays stable during re-renders */
function accentFor(index: number): string {
  return ACCENTS[index % ACCENTS.length];
}

function AccuracyBadge({ value }: { value: string }) {
  const num = parseFloat(value);
  const cls =
    num >= 97 ? 'bg-emerald-900/60 text-emerald-300' :
    num >= 90 ? 'bg-sky-900/60 text-sky-300' :
    num >= 80 ? 'bg-amber-900/60 text-amber-300' :
                'bg-red-900/60 text-red-300';
  return (
    <span className={`inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold ${cls}`}>
      <BarChart2 className="h-2.5 w-2.5" />
      {value}
    </span>
  );
}

export const ModelSelect: React.FC<ModelSelectProps> = ({
  models,
  value,
  onChange,
  placeholder = 'Select a model…',
  className = '',
}) => {
  const [open, setOpen] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    if (open) document.addEventListener('mousedown', handle);
    return () => document.removeEventListener('mousedown', handle);
  }, [open]);

  // Close on Escape
  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false);
    }
    if (open) document.addEventListener('keydown', handle);
    return () => document.removeEventListener('keydown', handle);
  }, [open]);

  const selectedModel = models.find((m) => m.model_id === value);
  const selectedIdx   = models.findIndex((m) => m.model_id === value);
  const selectedDetail = selectedModel ? modelDetail(selectedModel) : null;

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      {/* ── Trigger ── */}
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className={`w-full flex items-center justify-between gap-3 px-3 py-2.5 rounded-lg bg-gray-800 border text-sm transition-colors focus:outline-none ${
          open
            ? 'border-cyan-500 ring-1 ring-cyan-500/30'
            : 'border-gray-600 hover:border-gray-500'
        }`}
      >
        {selectedModel && selectedDetail ? (
          <div className="flex items-center gap-2 min-w-0 flex-1">
            {/* Accent pip */}
            <span
              className={`inline-block h-2.5 w-2.5 rounded-full shrink-0 ${accentFor(selectedIdx)}`}
            />
            <div className="min-w-0 flex-1 text-left">
              <span className="text-gray-100 font-medium truncate block">
                {selectedDetail.type}
              </span>
              <span className="text-gray-500 text-[11px] truncate block">
                {selectedDetail.dataset} · {selectedDetail.date}
                {selectedDetail.accuracy ? ` · Acc ${selectedDetail.accuracy}` : ''}
              </span>
            </div>
          </div>
        ) : (
          <span className="text-gray-500">{placeholder}</span>
        )}
        <ChevronDown
          className={`h-4 w-4 text-gray-500 shrink-0 transition-transform ${open ? 'rotate-180' : ''}`}
        />
      </button>

      {/* ── Dropdown ── */}
      {open && (
        <div className="absolute left-0 right-0 top-full z-50 mt-1 max-h-[420px] overflow-y-auto rounded-xl border border-gray-700 bg-gray-900 shadow-2xl">
          {models.length === 0 ? (
            <p className="py-6 text-center text-sm text-gray-500">No trained models yet.</p>
          ) : (
            <>
              {/* Column hint header */}
              <div className="sticky top-0 bg-gray-900/95 backdrop-blur-sm border-b border-gray-800 px-3 py-1.5 flex items-center gap-4">
                <span className="text-[10px] font-semibold uppercase tracking-wider text-gray-600 flex-1">
                  {models.length} model{models.length !== 1 ? 's' : ''} available
                </span>
                <span className="text-[10px] text-gray-700">click to select</span>
              </div>

              {models.map((m, idx) => {
                const d = modelDetail(m);
                const isSelected = m.model_id === value;
                const accent = accentFor(idx);

                return (
                  <button
                    key={m.model_id}
                    type="button"
                    onClick={() => { onChange(m.model_id); setOpen(false); }}
                    className={`w-full flex items-stretch gap-0 text-left transition-colors focus:outline-none ${
                      isSelected
                        ? 'bg-cyan-500/10'
                        : 'hover:bg-gray-800/70'
                    } ${idx !== 0 ? 'border-t border-gray-800/60' : ''}`}
                  >
                    {/* Left accent bar */}
                    <span className={`w-1 shrink-0 rounded-l ${accent}`} />

                    {/* Main content */}
                    <div className="flex-1 px-3 py-2.5 min-w-0">
                      {/* Row 1: Model type + short ID + loaded badge */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`font-semibold text-sm ${isSelected ? 'text-cyan-300' : 'text-gray-100'}`}>
                          {d.type}
                        </span>
                        <span className="text-[10px] text-gray-600 font-mono">#{d.shortId}</span>
                        {m.is_loaded && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-400">
                            <CheckCircle2 className="h-3 w-3" />
                            Loaded
                          </span>
                        )}
                        {!m.is_loaded && (
                          <span className="inline-flex items-center gap-0.5 text-[10px] text-gray-600">
                            <Circle className="h-3 w-3" />
                            Not loaded
                          </span>
                        )}
                        {isSelected && (
                          <span className="ml-auto text-[10px] text-cyan-400 font-semibold">✓ selected</span>
                        )}
                      </div>

                      {/* Row 2: Dataset + date */}
                      <div className="flex items-center gap-3 mt-1 flex-wrap">
                        <span className="flex items-center gap-1 text-[11px] text-gray-400">
                          <Database className="h-3 w-3 text-gray-600 shrink-0" />
                          <span className="truncate max-w-[180px]" title={d.dataset}>{d.dataset}</span>
                        </span>
                        <span className="flex items-center gap-1 text-[11px] text-gray-500">
                          <Calendar className="h-3 w-3 text-gray-600 shrink-0" />
                          {d.date}
                        </span>
                      </div>

                      {/* Row 3: Metrics + features */}
                      <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                        {d.accuracy && <AccuracyBadge value={`Acc ${d.accuracy}`} />}
                        {d.f1 && (
                          <span className="inline-flex items-center gap-0.5 rounded px-1.5 py-0.5 text-[10px] font-mono font-semibold bg-indigo-900/60 text-indigo-300">
                            <Zap className="h-2.5 w-2.5" />
                            F1 {d.f1}
                          </span>
                        )}
                        <span className="flex items-center gap-0.5 text-[10px] text-gray-600">
                          <Layers className="h-2.5 w-2.5" />
                          {d.features}
                        </span>
                      </div>
                    </div>
                  </button>
                );
              })}
            </>
          )}
        </div>
      )}
    </div>
  );
};
