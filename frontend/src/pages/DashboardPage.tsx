import { useEffect } from 'react';
import { Link } from 'react-router-dom';
import {
  Database,
  BrainCircuit,
  BarChart3,
  Lightbulb,
  Target,
  ArrowRight,
  CheckCircle2,
  AlertCircle,
  ShieldCheck,
  FlaskConical,
  Cpu,
  Eye,
  Activity,
  ExternalLink,
} from 'lucide-react';
import { clsx } from 'clsx';
import { healthApi } from '@/api';
import { useAppStore } from '@/store/appStore';
import { StatusBadge } from '@/components/common/StatusBadge';
import { WorkflowPipeline } from '@/components/common/WorkflowPipeline';
import type { PipelineStep } from '@/components/common/WorkflowPipeline';

// ── Feature highlights shown to new users ─────────────────────────────────────
const FEATURES = [
  {
    icon: Database,
    color: 'text-sky-400',
    bg: 'bg-sky-500/10 border-sky-500/20',
    title: 'Smart Dataset Analysis',
    desc: 'Upload CSV/Parquet. Get instant profiling — null rates, distributions, class balance, outlier detection, and AI-recommended target column.',
  },
  {
    icon: BrainCircuit,
    color: 'text-violet-400',
    bg: 'bg-violet-500/10 border-violet-500/20',
    title: 'Automated ML Training',
    desc: 'Train Random Forest or XGBoost with one click. Optuna hyperparameter optimisation, SMOTE balancing, and automatic feature selection run automatically.',
  },
  {
    icon: BarChart3,
    color: 'text-emerald-400',
    bg: 'bg-emerald-500/10 border-emerald-500/20',
    title: 'Rich Model Evaluation',
    desc: 'Confusion matrix, ROC-AUC curve, per-class F1, and feature importance — everything you need to trust or question a model.',
  },
  {
    icon: Lightbulb,
    color: 'text-amber-400',
    bg: 'bg-amber-500/10 border-amber-500/20',
    title: 'Explainable Predictions',
    desc: 'SHAP shows global feature importance. LIME explains any single prediction locally. Run both together and compare — disagreement is a signal.',
  },
  {
    icon: Target,
    color: 'text-red-400',
    bg: 'bg-red-500/10 border-red-500/20',
    title: 'Live Inference',
    desc: 'Enter feature values, run the model in real time, and see class probabilities and latency. Full prediction history kept in session.',
  },
  {
    icon: ShieldCheck,
    color: 'text-cyan-400',
    bg: 'bg-cyan-500/10 border-cyan-500/20',
    title: 'Drift Detection',
    desc: 'Compare two datasets with PSI, Kolmogorov-Smirnov, and KL divergence. Know whether your training data still represents the live traffic.',
  },
];

export default function DashboardPage() {
  const { health, setHealth, datasets, models } = useAppStore();

  useEffect(() => {
    healthApi.check().then(setHealth).catch(() => setHealth(null));
  }, [setHealth]);

  const hasDatasets = datasets.length > 0;
  const hasModels   = models.length > 0;

  const pipelineSteps: PipelineStep[] = [
    {
      step: 1,
      label: 'Upload Dataset',
      description: 'CSV or Parquet file',
      to: '/dataset',
      ctaText: 'Go to Dataset',
      completed: hasDatasets,
      accessible: true,
    },
    {
      step: 2,
      label: 'Train a Model',
      description: 'Random Forest or XGBoost',
      to: '/training',
      ctaText: 'Start Training',
      completed: hasModels,
      accessible: hasDatasets,
    },
    {
      step: 3,
      label: 'Evaluate',
      description: 'Metrics, ROC curve, confusion matrix',
      to: '/evaluation',
      ctaText: 'Review Results',
      completed: false,
      accessible: hasModels,
    },
    {
      step: 4,
      label: 'Explain',
      description: 'SHAP & LIME explanations',
      to: '/explainability',
      ctaText: 'Explain Predictions',
      completed: false,
      accessible: hasModels,
    },
    {
      step: 5,
      label: 'Predict',
      description: 'Live inference on new data',
      to: '/prediction',
      ctaText: 'Run Predictions',
      completed: false,
      accessible: hasModels,
    },
  ];

  // Derive "next step" call-to-action
  const nextStep = pipelineSteps.find((s) => !s.completed && s.accessible);

  return (
    <div className="space-y-8 max-w-5xl">

      {/* ── Hero ── */}
      <div className="rounded-2xl border border-gray-700 bg-gradient-to-br from-gray-800/60 to-gray-900/60 p-6 sm:p-8">
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <div className="w-8 h-8 rounded-lg bg-cyan-500 flex items-center justify-center font-bold text-gray-900 text-sm shrink-0">
                XAI
              </div>
              <span className="text-xs font-semibold text-cyan-400 uppercase tracking-widest">
                XAI-NIDS Platform
              </span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold text-white leading-tight">
              Explainable AI for Network Security
            </h1>
            <p className="text-gray-400 mt-2 text-sm leading-relaxed max-w-xl">
              Train intrusion detection models, understand <em>why</em> they classify traffic as
              attacks, detect when your data has drifted, and run live inference — all in one
              platform designed for SOC analysts and ML engineers.
            </p>
            {nextStep && (
              <Link
                to={nextStep.to}
                className="inline-flex items-center gap-2 mt-4 px-5 py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-gray-900 font-semibold text-sm transition-colors"
              >
                {nextStep.ctaText}
                <ArrowRight size={15} />
              </Link>
            )}
          </div>

          {/* Stats strip */}
          <div className="flex sm:flex-col gap-3 sm:gap-2 shrink-0">
            {[
              { label: 'Datasets', value: datasets.length, icon: Database, color: 'text-sky-400' },
              { label: 'Models',   value: models.length,   icon: BrainCircuit, color: 'text-violet-400' },
              { label: 'API',      value: health?.status === 'ok' ? 'Online' : 'Offline', icon: Activity, color: health?.status === 'ok' ? 'text-emerald-400' : 'text-red-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div key={label} className="flex items-center gap-3 bg-gray-900/60 rounded-xl px-4 py-2.5">
                <Icon size={16} className={clsx(color, 'shrink-0')} />
                <div>
                  <p className="text-gray-500 text-xs">{label}</p>
                  <p className={clsx('font-bold text-sm', color)}>{value}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* ── Workflow pipeline ── */}
      <WorkflowPipeline steps={pipelineSteps} />

      {/* ── System status ── */}
      <div className="bg-gray-800/50 rounded-xl p-5 border border-gray-700">
        <h2 className="text-gray-300 text-sm font-semibold mb-4 flex items-center gap-2">
          <Cpu size={14} className="text-gray-400" />
          System Status
        </h2>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'API',           ok: !!health },
            { label: 'Dataset Store', ok: !!health?.dataset_dir_exists },
            { label: 'Model Store',   ok: !!health?.model_dir_exists },
            { label: 'Experiment DB', ok: !!health?.experiment_db_exists },
          ].map(({ label, ok }) => (
            <div key={label} className="flex items-center gap-2 rounded-lg bg-gray-900/40 px-3 py-2.5">
              {ok ? (
                <CheckCircle2 size={13} className="text-emerald-400 shrink-0" />
              ) : (
                <AlertCircle size={13} className="text-red-400 shrink-0" />
              )}
              <span className="text-gray-300 text-xs">{label}</span>
            </div>
          ))}
        </div>

        {health && (
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Plugins',        value: health.plugins_loaded?.join(', ') || 'none' },
              { label: 'Loaded Models',  value: health.loaded_models?.length ?? 0 },
              { label: 'Backend',        value: health.version ?? '—' },
              { label: 'Training',       value: health.active_training ? '● Active' : 'Idle' },
            ].map(({ label, value }) => (
              <div key={label} className="rounded-lg bg-gray-900/40 px-3 py-2.5">
                <p className="text-gray-500 text-xs">{label}</p>
                <p className={clsx('font-medium text-xs mt-0.5 truncate', health.active_training && label === 'Training' ? 'text-cyan-400' : 'text-gray-200')}>
                  {value}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Feature cards ── */}
      <div>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-gray-200 font-semibold text-sm flex items-center gap-2">
            <Eye size={14} className="text-gray-400" />
            What you can do with XAI-NIDS
          </h2>
          <Link
            to="/dataset"
            className="flex items-center gap-1 text-xs text-cyan-400 hover:text-cyan-300 transition-colors"
          >
            Get started <ExternalLink size={11} />
          </Link>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {FEATURES.map(({ icon: Icon, color, bg, title, desc }) => (
            <div key={title} className={clsx('rounded-xl border p-4 space-y-2', bg)}>
              <div className="flex items-center gap-2">
                <Icon size={16} className={clsx(color, 'shrink-0')} />
                <p className={clsx('text-sm font-semibold', color)}>{title}</p>
              </div>
              <p className="text-gray-400 text-xs leading-relaxed">{desc}</p>
            </div>
          ))}
        </div>
      </div>

      {/* ── Quick links ── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {[
          { to: '/dataset',         label: 'Datasets',      icon: Database,    sub: `${datasets.length} uploaded` },
          { to: '/training',        label: 'Training',      icon: BrainCircuit, sub: hasDatasets ? 'Ready to train' : 'Upload a dataset first' },
          { to: '/evaluation',      label: 'Evaluation',    icon: BarChart3,    sub: hasModels ? `${models.length} model${models.length !== 1 ? 's' : ''}` : 'No models yet' },
          { to: '/explainability',  label: 'Explainability', icon: Lightbulb,   sub: hasModels ? 'SHAP · LIME' : 'Train a model first' },
          { to: '/experiments',     label: 'Experiments',   icon: FlaskConical, sub: 'Run history' },
        ].map(({ to, label, icon: Icon, sub }) => (
          <Link
            key={to}
            to={to}
            className="group flex items-center gap-3 bg-gray-800 hover:bg-gray-700 border border-gray-700 hover:border-cyan-500/40 rounded-xl px-4 py-3 transition-all"
          >
            <Icon size={16} className="text-gray-400 group-hover:text-cyan-400 shrink-0 transition-colors" />
            <div className="min-w-0">
              <p className="text-gray-200 text-xs font-medium truncate">{label}</p>
              <p className="text-gray-600 text-xs truncate">{sub}</p>
            </div>
          </Link>
        ))}
      </div>
    </div>
  );
}
