import { CheckCircle, AlertTriangle, Info } from 'lucide-react';
import { StatusBadge } from '@/components/common/StatusBadge';
import type { DatasetIntrospection } from '@/types';

interface Props {
  introspection: DatasetIntrospection;
}

const TASK_LABELS: Record<DatasetIntrospection['task_type'], string> = {
  binary_classification: 'Binary Classification',
  multiclass_classification: 'Multi-class Classification',
  regression: 'Regression',
};

export function IntrospectionReport({ introspection: d }: Props) {
  const issues: string[] = [];
  if (d.class_imbalance_ratio !== undefined && d.class_imbalance_ratio > 5)
    issues.push(`Class imbalance ratio ${d.class_imbalance_ratio.toFixed(1)}x — SMOTE recommended`);
  if (d.high_cardinality_features.length > 0)
    issues.push(`${d.high_cardinality_features.length} high-cardinality feature(s) — consider encoding`);

  return (
    <div className="bg-gray-800 rounded-xl p-5 space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-gray-200 font-medium">Auto-Introspection</h4>
        <StatusBadge status="info" label={TASK_LABELS[d.task_type]} />
      </div>

      <div className="grid grid-cols-2 gap-3 text-sm">
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Target Column</p>
          <p className="text-cyan-400 font-mono">{d.suggested_target}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Classes</p>
          <p className="text-gray-200">{d.target_classes.slice(0, 6).join(', ')}{d.target_classes.length > 6 ? '…' : ''}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Numeric Features</p>
          <p className="text-gray-200">{d.numeric_features.length}</p>
        </div>
        <div>
          <p className="text-gray-500 text-xs uppercase tracking-wider mb-1">Categorical Features</p>
          <p className="text-gray-200">{d.categorical_features.length}</p>
        </div>
      </div>

      {issues.length > 0 && (
        <div className="space-y-2">
          {issues.map((issue, i) => (
            <div key={i} className="flex items-start gap-2 text-xs text-yellow-300 bg-yellow-500/10 rounded-lg px-3 py-2">
              <AlertTriangle size={12} className="mt-0.5 shrink-0" />
              {issue}
            </div>
          ))}
        </div>
      )}

      {issues.length === 0 && (
        <div className="flex items-center gap-2 text-xs text-emerald-400">
          <CheckCircle size={12} />
          No data quality issues detected
        </div>
      )}
    </div>
  );
}
