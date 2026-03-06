/**
 * PipelineStepsVisual.tsx
 * Shows a visual "data → preprocessing → training → evaluation" pipeline
 * with step highlighting based on the current training status.
 */
import React from 'react';
import { Database, Cpu, FlaskConical, BarChart3, CheckCircle2, Loader2 } from 'lucide-react';
import type { TrainingStatus } from '@/types';

const STEPS = [
  { key: 'loading', label: 'Loading Data', icon: Database },
  { key: 'preprocessing', label: 'Preprocessing', icon: FlaskConical },
  { key: 'training', label: 'Training', icon: Cpu },
  { key: 'evaluating', label: 'Evaluation', icon: BarChart3 },
];

interface PipelineStepsVisualProps {
  trainingStatus: TrainingStatus | null;
  className?: string;
}

function matchStep(step: string | undefined): string {
  if (!step) return '';
  const s = step.toLowerCase();
  if (s.includes('load') || s.includes('data')) return 'loading';
  if (s.includes('preprocess') || s.includes('encod') || s.includes('scale')) return 'preprocessing';
  if (s.includes('train') || s.includes('fit') || s.includes('optuna') || s.includes('trial')) return 'training';
  if (s.includes('eval') || s.includes('metric') || s.includes('predict')) return 'evaluating';
  return 'training';
}

export const PipelineStepsVisual: React.FC<PipelineStepsVisualProps> = ({
  trainingStatus,
  className = '',
}) => {
  const isRunning = trainingStatus?.is_training === true;
  const isDone = trainingStatus !== null && !trainingStatus?.is_training && !!trainingStatus?.model_id;
  const activeKey = isRunning ? matchStep(trainingStatus?.current_step) : isDone ? '__done__' : '';

  return (
    <div className={`flex items-center gap-0 ${className}`}>
      {STEPS.map(({ key, label, icon: Icon }, idx) => {
        const isActive = activeKey === key;
        const isPast =
          isDone ||
          (isRunning && STEPS.findIndex((s) => s.key === activeKey) > idx);

        return (
          <React.Fragment key={key}>
            <div
              className={`flex flex-col items-center gap-1.5 px-3 py-2 rounded-lg transition-all ${
                isActive
                  ? 'bg-indigo-500/20 ring-1 ring-inset ring-indigo-500/50'
                  : isPast
                    ? 'bg-emerald-500/10'
                    : 'bg-slate-900/40'
              }`}
            >
              <div className="relative">
                <Icon
                  className={`h-5 w-5 ${
                    isActive ? 'text-indigo-400' : isPast ? 'text-emerald-400' : 'text-slate-600'
                  }`}
                />
                {isActive && (
                  <Loader2 className="absolute -right-2 -top-2 h-3 w-3 animate-spin text-indigo-400" />
                )}
                {isPast && (
                  <CheckCircle2 className="absolute -right-2 -top-2 h-3 w-3 text-emerald-400" />
                )}
              </div>
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-indigo-300' : isPast ? 'text-emerald-400' : 'text-slate-600'
                }`}
              >
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div
                className={`h-px w-6 flex-shrink-0 ${isPast ? 'bg-emerald-500/40' : 'bg-slate-800'}`}
              />
            )}
          </React.Fragment>
        );
      })}
    </div>
  );
};
