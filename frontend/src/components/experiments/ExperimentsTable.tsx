import { useState } from 'react';
import { Trash2, ChevronDown, ChevronUp } from 'lucide-react';
import { clsx } from 'clsx';
import { StatusBadge } from '@/components/common/StatusBadge';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatTimestamp, formatMetric, formatDuration, shortId } from '@/utils/formatters';
import type { ExperimentRun } from '@/types';

interface Props {
  experiments: ExperimentRun[];
  onDelete: (runId: string) => void;
  compareIds?: string[];
  onToggleCompare?: (runId: string) => void;
}

export function ExperimentsTable({ experiments, onDelete, compareIds = [], onToggleCompare }: Props) {
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  if (experiments.length === 0) {
    return <p className="text-gray-500 text-sm">No experiments yet.</p>;
  }

  return (
    <>
      <div className="overflow-x-auto rounded-xl border border-gray-700">
        <table className="w-full text-sm">
          <thead className="bg-gray-800 text-gray-400 text-xs uppercase tracking-wider">
            <tr>
              {onToggleCompare && <th className="px-4 py-3 w-10" />}
              <th className="px-4 py-3 text-left">Run ID</th>
              <th className="px-4 py-3 text-left">Model</th>
              <th className="px-4 py-3 text-left">Plugin</th>
              <th className="px-4 py-3 text-right">Accuracy</th>
              <th className="px-4 py-3 text-right">F1</th>
              <th className="px-4 py-3 text-right">AUC</th>
              <th className="px-4 py-3 text-left">Status</th>
              <th className="px-4 py-3 text-left">Created</th>
              <th className="px-4 py-3 w-10" />
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700/50">
            {experiments.map((run) => {
              const isExpanded = expandedId === run.run_id;
              return (
                <>
                  <tr
                    key={run.run_id}
                    className={clsx(
                      'hover:bg-gray-800/60 transition-colors',
                      compareIds.includes(run.run_id) && 'bg-cyan-500/5'
                    )}
                  >
                    {onToggleCompare && (
                      <td className="px-4 py-3">
                        <input
                          type="checkbox"
                          checked={compareIds.includes(run.run_id)}
                          onChange={() => onToggleCompare(run.run_id)}
                          className="w-3.5 h-3.5 accent-cyan-500"
                        />
                      </td>
                    )}
                    <td className="px-4 py-3 font-mono text-xs text-gray-300">{shortId(run.run_id)}</td>
                    <td className="px-4 py-3 text-gray-200">{run.model_type}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{run.plugin_name}</td>
                    <td className="px-4 py-3 text-right font-mono text-gray-200">
                      {formatMetric(run.metrics?.accuracy)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-200">
                      {formatMetric(run.metrics?.f1_score)}
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-gray-200">
                      {formatMetric(run.metrics?.roc_auc)}
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge
                        status={run.status === 'success' ? 'success' : 'error'}
                        label={run.status}
                        dot
                      />
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs whitespace-nowrap">
                      {formatTimestamp(run.created_at)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setExpandedId(isExpanded ? null : run.run_id)}
                          className="text-gray-500 hover:text-gray-300"
                        >
                          {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                        </button>
                        <button
                          onClick={() => setDeleteTarget(run.run_id)}
                          className="text-gray-500 hover:text-red-400 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>

                  {isExpanded && (
                    <tr key={`${run.run_id}-expanded`} className="bg-gray-800/40">
                      <td colSpan={10} className="px-8 py-4">
                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-xs">
                          <div>
                            <p className="text-gray-500 uppercase tracking-wider mb-1">Model ID</p>
                            <p className="font-mono text-gray-300">{run.model_id}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 uppercase tracking-wider mb-1">Dataset</p>
                            <p className="font-mono text-gray-300">{shortId(run.dataset_id)}</p>
                          </div>
                          <div>
                            <p className="text-gray-500 uppercase tracking-wider mb-1">Target</p>
                            <p className="font-mono text-cyan-400">{run.target_column}</p>
                          </div>
                          {run.duration_seconds !== undefined && (
                            <div>
                              <p className="text-gray-500 uppercase tracking-wider mb-1">Duration</p>
                              <p className="text-gray-300">{formatDuration(run.duration_seconds)}</p>
                            </div>
                          )}
                          {run.error && (
                            <div className="col-span-3">
                              <p className="text-gray-500 uppercase tracking-wider mb-1">Error</p>
                              <p className="text-red-400">{run.error}</p>
                            </div>
                          )}
                          <div className="col-span-3">
                            <p className="text-gray-500 uppercase tracking-wider mb-1">Hyperparameters</p>
                            <pre className="text-gray-300 text-xs bg-gray-900/60 rounded-lg px-3 py-2 overflow-x-auto">
                              {JSON.stringify(run.hyperparameters, null, 2)}
                            </pre>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete experiment run?"
        description="This removes the experiment record. The trained model file is not affected."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) onDelete(deleteTarget);
        }}
      />
    </>
  );
}
