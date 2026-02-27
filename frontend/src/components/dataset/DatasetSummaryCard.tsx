import { formatBytes, formatTimestamp, formatPct } from '@/utils/formatters';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { DatasetSummary } from '@/types';

interface Props {
  summary: DatasetSummary;
}

export function DatasetSummaryCard({ summary }: Props) {
  const nullyColumns = summary.columns.filter((c) => c.null_pct > 0);

  // Health score: penalise for nulls
  const avgNullPct = nullyColumns.length
    ? nullyColumns.reduce((acc, c) => acc + c.null_pct, 0) / summary.columns.length
    : 0;
  const healthScore = Math.max(0, 1 - avgNullPct);

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-start justify-between">
        <div>
          <h3 className="text-white font-semibold">{summary.filename}</h3>
          <p className="text-gray-400 text-xs mt-0.5">{summary.dataset_id}</p>
        </div>
        <StatusBadge
          status={healthScore > 0.9 ? 'success' : healthScore > 0.6 ? 'warning' : 'error'}
          label={`Health ${Math.round(healthScore * 100)}%`}
        />
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: 'Rows', value: summary.row_count.toLocaleString() },
          { label: 'Columns', value: summary.column_count },
          { label: 'Size', value: formatBytes(summary.size_bytes) },
          { label: 'Null cols', value: nullyColumns.length },
        ].map(({ label, value }) => (
          <div key={label} className="bg-gray-900/60 rounded-lg p-3">
            <p className="text-gray-400 text-xs">{label}</p>
            <p className="text-white font-semibold mt-0.5">{value}</p>
          </div>
        ))}
      </div>

      <div className="text-xs text-gray-500">
        Uploaded {formatTimestamp(summary.uploaded_at)}
      </div>
    </div>
  );
}
