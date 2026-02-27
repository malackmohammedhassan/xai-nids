import type { HyperparamSchema } from '@/types';

interface Props {
  schema: Record<string, HyperparamSchema>;
  values: Record<string, unknown>;
  onChange: (key: string, value: unknown) => void;
  useOptuna: boolean;
  onOptunaChange: (v: boolean) => void;
}

export function HyperparamEditor({ schema, values, onChange, useOptuna, onOptunaChange }: Props) {
  return (
    <div className="space-y-4">
      {/* Optuna toggle */}
      <div className="flex items-center justify-between bg-violet-500/10 border border-violet-500/30 rounded-lg px-4 py-3">
        <div>
          <p className="text-violet-300 text-sm font-medium">Auto-tune with Optuna</p>
          <p className="text-gray-400 text-xs mt-0.5">
            Runs 30 trials to find optimal hyperparameters
          </p>
        </div>
        <label className="relative inline-flex items-center cursor-pointer">
          <input
            type="checkbox"
            checked={useOptuna}
            onChange={(e) => onOptunaChange(e.target.checked)}
            className="sr-only peer"
          />
          <div className="w-10 h-5 bg-gray-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:bg-violet-600 after:content-[''] after:absolute after:top-0.5 after:left-0.5 after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-all" />
        </label>
      </div>

      {/* Manual hyperparams (disabled when Optuna on) */}
      <div className={useOptuna ? 'opacity-40 pointer-events-none' : ''}>
        <p className="text-gray-400 text-xs mb-3 uppercase tracking-wider">
          Manual Hyperparameters
        </p>
        <div className="space-y-3">
          {Object.entries(schema).map(([key, param]) => (
            <div key={key} className="flex items-center gap-4">
              <label className="text-gray-300 text-sm w-48 shrink-0">
                {key}
                {param.description && (
                  <span className="block text-gray-500 text-xs font-normal">{param.description}</span>
                )}
              </label>
              {param.type === 'bool' ? (
                <input
                  type="checkbox"
                  checked={!!values[key]}
                  onChange={(e) => onChange(key, e.target.checked)}
                  className="w-4 h-4 accent-cyan-500"
                />
              ) : param.choices ? (
                <select
                  value={String(values[key] ?? param.default)}
                  onChange={(e) => onChange(key, e.target.value)}
                  className="bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
                >
                  {param.choices.map((c) => (
                    <option key={String(c)} value={String(c)}>
                      {String(c)}
                    </option>
                  ))}
                </select>
              ) : (
                <input
                  type="number"
                  value={String(values[key] ?? param.default)}
                  min={param.min}
                  max={param.max}
                  step={param.type === 'float' ? 0.01 : 1}
                  onChange={(e) =>
                    onChange(
                      key,
                      param.type === 'float' ? parseFloat(e.target.value) : parseInt(e.target.value)
                    )
                  }
                  className="w-36 bg-gray-800 border border-gray-600 text-gray-200 text-sm rounded-lg px-3 py-1.5 focus:outline-none focus:border-cyan-500"
                />
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
