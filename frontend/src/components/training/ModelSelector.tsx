import { clsx } from 'clsx';
import { BrainCircuit } from 'lucide-react';
import type { ModelConfig } from '@/types';

interface Props {
  configs: ModelConfig[];
  selected: string;
  onChange: (modelType: string) => void;
}

const MODEL_DESCRIPTIONS: Record<string, string> = {
  random_forest: 'Ensemble of decision trees. Robust to noise, handles non-linearity.',
  xgboost: 'Gradient boosting with regularization. Often best raw accuracy.',
};

export function ModelSelector({ configs, selected, onChange }: Props) {
  return (
    <div className="space-y-2">
      <label className="text-gray-300 text-sm font-medium">Model Type</label>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {configs.map((cfg) => {
          const isSelected = cfg.model_type === selected;
          return (
            <button
              key={cfg.model_type}
              onClick={() => onChange(cfg.model_type)}
              className={clsx(
                'flex items-start gap-3 p-4 rounded-xl border text-left transition-all',
                isSelected
                  ? 'border-cyan-500 bg-cyan-500/10'
                  : 'border-gray-700 bg-gray-800 hover:border-gray-600'
              )}
            >
              <BrainCircuit
                size={20}
                className={clsx('mt-0.5 shrink-0', isSelected ? 'text-cyan-400' : 'text-gray-500')}
              />
              <div>
                <p
                  className={clsx(
                    'font-medium text-sm',
                    isSelected ? 'text-cyan-300' : 'text-gray-200'
                  )}
                >
                  {cfg.display_name}
                </p>
                <p className="text-gray-500 text-xs mt-0.5">
                  {MODEL_DESCRIPTIONS[cfg.model_type] ?? 'ML model'}
                </p>
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
