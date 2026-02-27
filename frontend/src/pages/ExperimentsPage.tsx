import { useEffect, useState } from 'react';
import { Download, GitCompare } from 'lucide-react';
import { useExperiments } from '@/hooks/useExperiments';
import { ExperimentsTable } from '@/components/experiments/ExperimentsTable';
import { EmptyState } from '@/components/common/EmptyState';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';

export default function ExperimentsPage() {
  const { experiments, loading, fetchList, deleteExperiment } = useExperiments();
  const [compareIds, setCompareIds] = useState<string[]>([]);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  const toggleCompare = (runId: string) => {
    setCompareIds((prev) =>
      prev.includes(runId) ? prev.filter((id) => id !== runId) : [...prev, runId].slice(-3)
    );
  };

  const selectedRuns = experiments.filter((e) => compareIds.includes(e.run_id));

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Experiments</h1>
        <div className="flex items-center gap-3">
          {compareIds.length > 1 && (
            <div className="flex items-center gap-2 text-xs text-cyan-400">
              <GitCompare size={13} />
              Comparing {compareIds.length} runs
            </div>
          )}
          <button
            onClick={fetchList}
            className="text-xs text-gray-400 hover:text-gray-200 transition-colors"
          >
            Refresh
          </button>
        </div>
      </div>

      {loading ? (
        <LoadingSkeleton lines={5} />
      ) : experiments.length === 0 ? (
        <EmptyState
          title="No experiments yet"
          description="Train a model to create an experiment run"
        />
      ) : (
        <ExperimentsTable
          experiments={experiments}
          onDelete={deleteExperiment}
          compareIds={compareIds}
          onToggleCompare={toggleCompare}
        />
      )}

      {/* Comparison panel */}
      {compareIds.length >= 2 && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-gray-300 text-sm font-medium mb-4">Side-by-Side Comparison</h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-gray-400 text-xs">
                  <th className="text-left px-3 py-2">Metric</th>
                  {selectedRuns.map((r) => (
                    <th key={r.run_id} className="text-right px-3 py-2 font-mono">
                      {r.model_type}/{r.run_id.slice(0, 8)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-700/50">
                {(['accuracy', 'precision', 'recall', 'f1_score', 'roc_auc'] as const).map((m) => (
                  <tr key={m} className="hover:bg-gray-700/30">
                    <td className="px-3 py-2 text-gray-300 uppercase text-xs tracking-wider">{m}</td>
                    {selectedRuns.map((r) => {
                      const v = r.metrics?.[m];
                      const best =
                        v !== undefined &&
                        v ===
                          Math.max(
                            ...selectedRuns.map((sr) => sr.metrics?.[m] ?? 0)
                          );
                      return (
                        <td
                          key={r.run_id}
                          className={`px-3 py-2 text-right font-mono ${best ? 'text-cyan-400 font-bold' : 'text-gray-300'}`}
                        >
                          {v !== undefined ? v.toFixed(4) : '—'}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
