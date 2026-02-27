import { useEffect, useState } from 'react';
import { Database, Trash2, RefreshCw } from 'lucide-react';
import { useDatasets } from '@/hooks/useDatasets';
import { DatasetUpload } from '@/components/dataset/DatasetUpload';
import { DatasetSummaryCard } from '@/components/dataset/DatasetSummaryCard';
import { IntrospectionReport } from '@/components/dataset/IntrospectionReport';
import { FeatureDistribution } from '@/components/dataset/FeatureDistribution';
import { EmptyState } from '@/components/common/EmptyState';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { formatBytes, formatTimestamp } from '@/utils/formatters';

export default function DatasetPage() {
  const {
    datasets,
    activeSummary,
    activeIntrospection,
    selectedDatasetId,
    loading,
    uploadProgress,
    fetchList,
    upload,
    selectDataset,
    deleteDataset,
  } = useDatasets();

  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  useEffect(() => {
    fetchList();
  }, [fetchList]);

  return (
    <div className="space-y-6 max-w-6xl">
      <div className="flex items-center justify-between">
        <h1 className="text-xl font-bold text-white">Dataset</h1>
        <button
          onClick={fetchList}
          disabled={loading}
          className="flex items-center gap-1.5 text-xs text-gray-400 hover:text-gray-200 transition-colors"
        >
          <RefreshCw size={13} className={loading ? 'animate-spin' : ''} />
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Upload */}
        <div className="bg-gray-800/50 rounded-xl p-5 space-y-4 border border-gray-700">
          <h2 className="text-gray-300 font-medium text-sm">Upload Dataset</h2>
          <DatasetUpload onUpload={upload} uploading={loading} uploadProgress={uploadProgress} />
        </div>

        {/* Dataset list */}
        <div className="space-y-3">
          <h2 className="text-gray-300 font-medium text-sm">Uploaded Datasets</h2>
          {datasets.length === 0 ? (
            <EmptyState
              icon={<Database size={40} />}
              title="No datasets yet"
              description="Upload a CSV or Parquet file to get started"
            />
          ) : (
            <div className="space-y-2 max-h-80 overflow-y-auto pr-1">
              {datasets.map((d) => (
                <button
                  key={d.dataset_id}
                  onClick={() => selectDataset(d.dataset_id)}
                  className={`w-full text-left bg-gray-800 hover:bg-gray-700/80 border rounded-xl px-4 py-3 transition-colors flex items-center justify-between group ${
                    selectedDatasetId === d.dataset_id
                      ? 'border-cyan-500/50 bg-cyan-500/5'
                      : 'border-gray-700'
                  }`}
                >
                  <div>
                    <p className="text-gray-200 font-medium text-sm truncate max-w-xs">
                      {d.filename}
                    </p>
                    <p className="text-gray-500 text-xs mt-0.5">
                      {d.row_count.toLocaleString()} rows · {d.column_count} cols ·{' '}
                      {formatBytes(d.size_bytes)} · {formatTimestamp(d.uploaded_at)}
                    </p>
                  </div>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      setDeleteTarget(d.dataset_id);
                    }}
                    className="text-gray-600 hover:text-red-400 transition-colors opacity-0 group-hover:opacity-100"
                  >
                    <Trash2 size={14} />
                  </button>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Summary + Introspection */}
      {activeSummary && (
        <div className="space-y-4">
          <DatasetSummaryCard summary={activeSummary} />
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {activeIntrospection && <IntrospectionReport introspection={activeIntrospection} />}
            <FeatureDistribution columns={activeSummary.columns} />
          </div>
        </div>
      )}

      <ConfirmDialog
        open={deleteTarget !== null}
        onOpenChange={(open) => !open && setDeleteTarget(null)}
        title="Delete dataset?"
        description="This permanently removes the dataset file. Models trained on it remain."
        confirmLabel="Delete"
        onConfirm={() => {
          if (deleteTarget) deleteDataset(deleteTarget);
        }}
      />
    </div>
  );
}
