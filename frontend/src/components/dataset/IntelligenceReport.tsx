/**
 * IntelligenceReport.tsx
 * Displays the DataQualityReport returned by /api/v2/datasets/{id}/intelligence
 */
import React from 'react';
import { Sparkles, AlertTriangle, Lightbulb } from 'lucide-react';
import { ScoreGauge } from '@/components/common/ScoreGauge';
import { ProgressRing } from '@/components/common/ProgressRing';

interface IntelligenceReportProps {
  report: Record<string, unknown>;
}

interface QualityIssue {
  severity: string;
  message: string;
}

interface Recommendation {
  action: string;
  reason: string;
}

export const IntelligenceReport: React.FC<IntelligenceReportProps> = ({ report }) => {
  const overall = Number(report.overall_score ?? 0);
  const completeness = Number(report.completeness_score ?? 0);
  const imbalance = Number(report.imbalance_score ?? 0);
  const outlier_score = Number(report.outlier_score ?? 0);
  const redundancy = Number(report.redundancy_score ?? 0);
  const cardinality = Number(report.cardinality_score ?? 0);
  const issues = (report.issues ?? []) as QualityIssue[];
  const recommendations = (report.recommendations ?? []) as Recommendation[];
  const summary = (report.summary_paragraph ?? '') as string;
  const risk = (report.risk_assessment ?? '') as string;
  const model = (report.recommended_model ?? '') as string;

  return (
    <div className="flex flex-col gap-5">
      {/* Header */}
      <div className="flex items-start gap-4">
        <ProgressRing value={overall} size={88} strokeWidth={9} label="Overall" />
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-indigo-400" />
            <span className="text-sm font-semibold text-slate-100">Dataset Intelligence</span>
            {risk && (
              <span className={`ml-auto text-xs font-medium px-2 py-0.5 rounded-full ${
                risk.toLowerCase().includes('high')
                  ? 'bg-red-500/20 text-red-300'
                  : risk.toLowerCase().includes('medium')
                    ? 'bg-amber-500/20 text-amber-300'
                    : 'bg-emerald-500/20 text-emerald-300'
              }`}>
                {risk}
              </span>
            )}
          </div>
          {summary && <p className="text-xs text-slate-400 leading-relaxed line-clamp-3">{summary}</p>}
          {model && (
            <p className="mt-2 text-xs text-indigo-300">
              <span className="text-slate-500">Recommended model: </span>{model}
            </p>
          )}
        </div>
      </div>

      {/* Score breakdown */}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
        {[
          { label: 'Completeness', value: completeness },
          { label: 'Balance', value: imbalance },
          { label: 'Outlier', value: outlier_score },
          { label: 'Redundancy', value: redundancy },
          { label: 'Cardinality', value: cardinality },
        ].map(({ label, value }) => (
          <ScoreGauge key={label} label={label} score={value} showBand={false} />
        ))}
      </div>

      {/* Issues */}
      {issues.length > 0 && (
        <div className="rounded-xl border border-amber-500/20 bg-amber-950/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <AlertTriangle className="h-3.5 w-3.5 text-amber-400" />
            <span className="text-xs font-semibold text-amber-300">Issues Found</span>
          </div>
          <ul className="space-y-1">
            {issues.slice(0, 5).map((issue, i) => (
              <li key={i} className="flex gap-2 text-xs">
                <span className={`shrink-0 font-medium ${
                  issue.severity === 'critical' ? 'text-red-400' :
                  issue.severity === 'warning' ? 'text-amber-400' : 'text-slate-400'
                }`}>
                  {issue.severity}
                </span>
                <span className="text-slate-400">{issue.message}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Recommendations */}
      {recommendations.length > 0 && (
        <div className="rounded-xl border border-indigo-500/20 bg-indigo-950/20 p-3">
          <div className="flex items-center gap-1.5 mb-2">
            <Lightbulb className="h-3.5 w-3.5 text-indigo-400" />
            <span className="text-xs font-semibold text-indigo-300">Recommendations</span>
          </div>
          <ul className="space-y-2">
            {recommendations.slice(0, 4).map((rec, i) => (
              <li key={i} className="text-xs">
                <span className="font-medium text-slate-200">{rec.action}</span>
                <span className="ml-1 text-slate-500">— {rec.reason}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};
