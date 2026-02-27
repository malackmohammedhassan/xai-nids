import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  BrainCircuit,
  BarChart3,
  Lightbulb,
  Target,
  ArrowRight,
  CheckCircle,
  AlertCircle,
} from 'lucide-react';
import { clsx } from 'clsx';
import { healthApi } from '@/api';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/common/StatusBadge';

const QUICK_START = [
  { step: 1, label: 'Upload Dataset', icon: Database, to: '/dataset', description: 'CSV or Parquet' },
  { step: 2, label: 'Train Model', icon: BrainCircuit, to: '/training', description: 'RF or XGBoost' },
  { step: 3, label: 'Evaluate', icon: BarChart3, to: '/evaluation', description: 'Metrics & ROC' },
  { step: 4, label: 'Explain', icon: Lightbulb, to: '/explainability', description: 'SHAP & LIME' },
  { step: 5, label: 'Predict', icon: Target, to: '/prediction', description: 'Live inference' },
];

export default function DashboardPage() {
  const { health, setHealth } = useAppStore();

  useEffect(() => {
    healthApi.check().then(setHealth).catch(() => setHealth(null));
  }, [setHealth]);

  return (
    <div className="space-y-8 max-w-5xl">
      <div>
        <h1 className="text-2xl font-bold text-white">Dashboard</h1>
        <p className="text-gray-400 mt-1 text-sm">
          XAI-NIDS — Explainable AI for Network Intrusion Detection
        </p>
      </div>

      {/* System status */}
      <div className="bg-gray-800 rounded-xl p-5">
        <h2 className="text-gray-300 text-sm font-medium mb-4">System Status</h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          {[
            { label: 'API', ok: !!health },
            { label: 'Dataset Dir', ok: health?.dataset_dir_exists },
            { label: 'Model Dir', ok: health?.model_dir_exists },
            { label: 'Experiment DB', ok: health?.experiment_db_exists },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2">
              {ok ? (
                <CheckCircle size={14} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={14} className="text-red-400 shrink-0" />
              )}
              <span className="text-gray-300 text-sm">{label}</span>
            </div>
          ))}
        </div>

        {health && (
          <div className="mt-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
            {[
              { label: 'Plugins', value: health.plugins_loaded.length },
              { label: 'Loaded Models', value: health.loaded_models.length },
              { label: 'Version', value: health.version },
              { label: 'Training', value: health.active_training ? 'Active' : 'Idle' },
            ].map(({ label, value }) => (
              <div key={label} className="bg-gray-900/60 rounded-lg p-3">
                <p className="text-gray-400 text-xs">{label}</p>
                <p className="text-white font-semibold mt-0.5">{value}</p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick start */}
      <div>
        <h2 className="text-gray-300 text-sm font-medium mb-4">Quick Start</h2>
        <div className="flex flex-wrap gap-3">
          {QUICK_START.map(({ step, label, icon: Icon, to, description }, i) => (
            <div key={step} className="flex items-center gap-2">
              <Link
                to={to}
                className="flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500/50 rounded-xl p-4 transition-all group"
              >
                <div className="w-8 h-8 rounded-lg bg-cyan-500/20 flex items-center justify-center shrink-0">
                  <Icon size={16} className="text-cyan-400" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">
                    <span className="text-gray-500 mr-1">{step}.</span>
                    {label}
                  </p>
                  <p className="text-gray-500 text-xs">{description}</p>
                </div>
                <ArrowRight
                  size={14}
                  className="text-gray-600 group-hover:text-cyan-400 ml-2 transition-colors"
                />
              </Link>
              {i < QUICK_START.length - 1 && (
                <ArrowRight size={14} className="text-gray-600 shrink-0" />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Plugins */}
      {health && health.plugins_loaded.length > 0 && (
        <div className="bg-gray-800 rounded-xl p-5">
          <h2 className="text-gray-300 text-sm font-medium mb-3">Loaded Plugins</h2>
          <div className="flex flex-wrap gap-2">
            {health.plugins_loaded.map((p) => (
              <StatusBadge key={p} status="info" label={p} dot={false} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
