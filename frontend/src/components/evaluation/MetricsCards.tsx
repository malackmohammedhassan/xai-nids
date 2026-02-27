import { formatMetric, metricGrade } from '@/utils/formatters';
import type { ModelMetrics } from '@/types';

interface Props {
  metrics: ModelMetrics;
}

interface MetricCard {
  label: string;
  value: number | undefined;
  description: string;
}

export function MetricsCards({ metrics }: Props) {
  const cards: MetricCard[] = [
    { label: 'Accuracy', value: metrics.accuracy, description: 'Overall correct predictions' },
    { label: 'Precision', value: metrics.precision, description: 'TP / (TP + FP)' },
    { label: 'Recall', value: metrics.recall, description: 'TP / (TP + FN)' },
    { label: 'F1 Score', value: metrics.f1_score, description: 'Harmonic mean of P & R' },
    { label: 'ROC-AUC', value: metrics.roc_auc, description: 'Area under ROC curve' },
  ];

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
      {cards.map(({ label, value, description }) => {
        const { grade, color } = value !== undefined ? metricGrade(value) : { grade: '—', color: 'text-gray-400' };
        return (
          <div key={label} className="bg-gray-800 rounded-xl p-4 text-center">
            <p className="text-gray-400 text-xs">{label}</p>
            <p className={`text-2xl font-bold mt-1 ${color}`}>{formatMetric(value)}</p>
            <p className={`text-xs font-semibold mt-0.5 ${color}`}>{grade}</p>
            <p className="text-gray-500 text-xs mt-1">{description}</p>
          </div>
        );
      })}
    </div>
  );
}
