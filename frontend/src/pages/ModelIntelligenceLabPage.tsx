import { useCallback, useEffect, useState } from 'react';
import {
  FlaskConical, Loader2, AlertCircle, RefreshCw, ChevronRight,
} from 'lucide-react';
import toast from 'react-hot-toast';
import { labApi } from '@/api/lab';
import { isAppError } from '@/api/client';
import { useModels } from '@/hooks/useModels';
import { ModelSelect } from '@/components/common/ModelSelect';
import { LoadingSkeleton } from '@/components/common/LoadingSkeleton';
import { ExportButton } from '@/components/common/ExportButton';
import { LabSection1 } from '@/components/lab/LabSection1';
import { LabSection2 } from '@/components/lab/LabSection2';
import { LabSection3 } from '@/components/lab/LabSection3';
import { LabSection4 } from '@/components/lab/LabSection4';
import { LabSection5 } from '@/components/lab/LabSection5';
import type { LabCompareResult } from '@/types';

type SectionId = 's1' | 's2' | 's3' | 's4' | 's5';
const SECTIONS: Array<{ id: SectionId; label: string; sublabel: string }> = [
  { id: 's1', label: '1. Dataset Structure', sublabel: 'Stats, importance, correlations' },
  { id: 's2', label: '2. Distributions', sublabel: 'Histograms, mean drift' },
  { id: 's3', label: '3. Performance', sublabel: 'ROC, confusion matrix' },
  { id: 's4', label: '4. Explainability', sublabel: 'SHAP & LIME side-by-side' },
  { id: 's5', label: '5. Training Pipeline', sublabel: 'Hyperparameters, features' },
];

export default function ModelIntelligenceLabPage() {
  const { models, fetchList } = useModels();
  const [modelAId, setModelAId] = useState<string>('');
  const [modelBId, setModelBId] = useState<string>('');
  const [data, setData] = useState<LabCompareResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeSection, setActiveSection] = useState<SectionId>('s1');

  useEffect(() => { fetchList(); }, [fetchList]);

  const handleCompare = useCallback(async () => {
    if (!modelAId || !modelBId) { toast.error('Select both models first.'); return; }
    if (modelAId === modelBId) { toast.error('Select two different models.'); return; }
    setError(null);
    setLoading(true);
    setData(null);
    try {
      const result = await labApi.compare(modelAId, modelBId);
      setData(result);
      setActiveSection('s1');
    } catch (err: unknown) {
      let msg = isAppError(err) ? err.message : (err as Error).message ?? 'Compare failed';
      // Disambiguate a generic "Not Found" into something actionable
      if (msg.toLowerCase() === 'not found' || msg === '404') {
        msg = 'Backend returned 404 — the server may have restarted. Refresh the page and try again.';
      }
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [modelAId, modelBId]);

  return (
    <div className="space-y-6 max-w-7xl pb-20">
      {/* Header */}
      <div className="flex items-center gap-3 flex-wrap">
        <FlaskConical className="h-6 w-6 text-violet-400 shrink-0" />
        <div>
          <h1 className="text-xl font-bold text-white">Model Intelligence Lab</h1>
          <p className="text-xs text-gray-500 mt-0.5">
            Compare any two models side-by-side — dataset analysis, performance, explainability, and training pipeline.
          </p>
        </div>
        {data && (
          <div className="ml-auto">
            <ExportButton data={data} filename="model_intelligence_lab" label="Export JSON" />
          </div>
        )}
      </div>

      {/* Model selectors */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto_1fr_auto] gap-3 items-end">
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-indigo-400 uppercase tracking-wide">Model A</label>
            <ModelSelect
              models={models}
              value={modelAId}
              onChange={(id) => { setModelAId(id); setError(null); setData(null); }}
              placeholder="Select Model A…"
            />
            {modelAId && data?.model_a && (
              <p className="text-[10px] text-gray-500 font-mono truncate">
                {data.model_a.dataset_filename ?? data.model_a.dataset_id ?? 'Unknown dataset'}
              </p>
            )}
          </div>
          <div className="flex items-center justify-center pb-2">
            <div className="flex items-center gap-1 text-gray-600">
              <ChevronRight size={16} />
              <span className="text-xs font-bold">VS</span>
              <ChevronRight size={16} />
            </div>
          </div>
          <div className="space-y-1.5">
            <label className="text-[11px] font-semibold text-orange-400 uppercase tracking-wide">Model B</label>
            <ModelSelect
              models={models}
              value={modelBId}
              onChange={(id) => { setModelBId(id); setError(null); setData(null); }}
              placeholder="Select Model B…"
            />
            {modelBId && data?.model_b && (
              <p className="text-[10px] text-gray-500 font-mono truncate">
                {data.model_b.dataset_filename ?? data.model_b.dataset_id ?? 'Unknown dataset'}
              </p>
            )}
          </div>
          <button
            onClick={handleCompare}
            disabled={loading || !modelAId || !modelBId}
            className="flex items-center gap-2 px-6 py-2.5 bg-violet-600 hover:bg-violet-500 disabled:opacity-40 disabled:cursor-not-allowed text-white text-sm font-semibold rounded-xl transition-colors whitespace-nowrap"
          >
            {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <FlaskConical className="h-4 w-4" />}
            {loading ? 'Analysing…' : 'Run Analysis'}
          </button>
        </div>

        {/* Model identity summary after load */}
        {data && !loading && (
          <div className="grid grid-cols-2 gap-3 pt-3 border-t border-gray-700/50">
            {[
              { m: data.model_a, color: 'border-indigo-500/30 bg-indigo-500/5', badge: 'bg-indigo-500/20 text-indigo-300', label: 'A' },
              { m: data.model_b, color: 'border-orange-500/30 bg-orange-500/5', badge: 'bg-orange-500/20 text-orange-300', label: 'B' },
            ].map(({ m, color, badge, label }) => (
              <div key={label} className={`rounded-lg border px-3 py-2 flex items-center gap-2 text-xs ${color}`}>
                <span className={`font-bold px-1.5 py-0.5 rounded-full text-[10px] ${badge}`}>{label}</span>
                <span className="capitalize text-gray-300 font-medium">{m.model_type.replace('_', ' ')}</span>
                <span className="text-gray-600">·</span>
                <span className="text-gray-500 truncate">{m.dataset_filename ?? m.dataset_id ?? '—'}</span>
                {!m.is_loaded && (
                  <span className="ml-auto text-amber-400 font-semibold whitespace-nowrap">Not loaded</span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Error */}
      {error && !loading && (
        <div className="rounded-xl border border-red-500/30 bg-red-500/5 px-4 py-3 flex items-center gap-3">
          <AlertCircle className="h-4 w-4 text-red-400 shrink-0" />
          <p className="text-sm text-red-300">{error}</p>
          <button onClick={handleCompare} className="ml-auto flex items-center gap-1 text-xs text-gray-400 hover:text-white">
            <RefreshCw className="h-3 w-3" /> Retry
          </button>
        </div>
      )}

      {/* Loading skeleton */}
      {loading && (
        <div className="space-y-4 p-4 rounded-xl border border-gray-700 bg-gray-800/30">
          <p className="text-sm text-gray-400 flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-violet-400" />
            Running full model analysis…
          </p>
          <LoadingSkeleton lines={8} />
        </div>
      )}

      {/* Results */}
      {data && !loading && (
        <>
          {/* Section tab bar */}
          <div className="rounded-xl border border-gray-700 bg-gray-900 overflow-x-auto">
            <div className="flex">
              {SECTIONS.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveSection(s.id)}
                  className={`flex-1 min-w-[130px] px-3 py-2.5 text-left transition-colors border-b-2 -mb-px ${
                    activeSection === s.id
                      ? 'border-violet-500 bg-violet-500/5'
                      : 'border-transparent hover:bg-gray-800/60'
                  }`}
                >
                  <p className={`text-xs font-semibold whitespace-nowrap ${activeSection === s.id ? 'text-violet-300' : 'text-gray-300'}`}>
                    {s.label}
                  </p>
                  <p className="text-[10px] text-gray-600 whitespace-nowrap">{s.sublabel}</p>
                </button>
              ))}
            </div>
          </div>

          {/* Active section content */}
          <div className="mt-2">
            {activeSection === 's1' && (
              <LabSection1
                a={data.model_a}
                b={data.model_b}
                sharedFeatures={data.shared_features}
                onlyA={data.only_in_a}
                onlyB={data.only_in_b}
              />
            )}
            {activeSection === 's2' && (
              <LabSection2 a={data.model_a} b={data.model_b} sharedFeatures={data.shared_features} />
            )}
            {activeSection === 's3' && (
              <LabSection3 a={data.model_a} b={data.model_b} deltas={data.metric_deltas} />
            )}
            {activeSection === 's4' && (
              <LabSection4 a={data.model_a} b={data.model_b} />
            )}
            {activeSection === 's5' && (
              <LabSection5 a={data.model_a} b={data.model_b} />
            )}
          </div>
        </>
      )}

      {!data && !loading && !error && (
        <div className="flex flex-col items-center justify-center gap-4 rounded-xl border border-gray-700 bg-gray-800/20 py-24 text-center">
          <FlaskConical className="h-12 w-12 text-gray-700" />
          <p className="text-gray-400 font-medium">Select two models and click Run Analysis</p>
          <p className="text-xs text-gray-600 max-w-md">
            The Lab compares datasets, distributions, metrics, SHAP/LIME explanations, and training pipelines side-by-side.
            Load both models first for full dataset analytics.
          </p>
        </div>
      )}
    </div>
  );
}
