import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Activity, Shield, Cpu, Database } from 'lucide-react';
import { getModels, getMetrics } from '../api';
import MetricsCard from '../components/MetricsCard';
import ConfusionMatrix from '../components/ConfusionMatrix';
import ROCChart from '../components/ROCChart';

export default function Dashboard() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [metricsData, setMetricsData] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    fetchModels();
  }, []);

  useEffect(() => {
    if (selectedModel) fetchMetrics();
  }, [selectedModel]);

  const fetchModels = async () => {
    try {
      const res = await getModels();
      setModels(res.data.models || []);
      if (res.data.models?.length > 0) {
        setSelectedModel(res.data.models[0].id);
      }
    } catch (err) {
      console.error('Failed to load models:', err);
    }
  };

  const fetchMetrics = async () => {
    setLoading(true);
    try {
      const res = await getMetrics(selectedModel);
      setMetricsData(res.data);
    } catch (err) {
      console.error('Failed to load metrics:', err);
      setMetricsData(null);
    }
    setLoading(false);
  };

  const metrics = metricsData?.metrics || {};

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Dashboard</h1>
          <p className="text-soc-muted mt-1">System overview and model performance</p>
        </div>
        <select
          value={selectedModel}
          onChange={(e) => setSelectedModel(e.target.value)}
          className="bg-soc-card border border-soc-border text-soc-text rounded-lg px-4 py-2 text-sm focus:outline-none focus:border-soc-accent"
        >
          <option value="">Select Model</option>
          {models.map((m) => (
            <option key={m.id} value={m.id}>{m.id}</option>
          ))}
        </select>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0 }}>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-green-500/20 flex items-center justify-center">
                <Activity className="w-5 h-5 text-green-400" />
              </div>
              <div>
                <p className="text-xs text-soc-muted uppercase tracking-wider">Status</p>
                <p className="text-lg font-bold text-green-400">Online</p>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-soc-accent/20 flex items-center justify-center">
                <Database className="w-5 h-5 text-soc-accent" />
              </div>
              <div>
                <p className="text-xs text-soc-muted uppercase tracking-wider">Models</p>
                <p className="text-lg font-bold text-white">{models.length}</p>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }}>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-purple-500/20 flex items-center justify-center">
                <Cpu className="w-5 h-5 text-purple-400" />
              </div>
              <div>
                <p className="text-xs text-soc-muted uppercase tracking-wider">Type</p>
                <p className="text-lg font-bold text-white">{metricsData?.model_type || '—'}</p>
              </div>
            </div>
          </div>
        </motion.div>
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 }}>
          <div className="glass-card p-5">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-orange-500/20 flex items-center justify-center">
                <Shield className="w-5 h-5 text-orange-400" />
              </div>
              <div>
                <p className="text-xs text-soc-muted uppercase tracking-wider">Mode</p>
                <p className="text-lg font-bold text-white capitalize">{metricsData?.mode || '—'}</p>
              </div>
            </div>
          </div>
        </motion.div>
      </div>

      {loading && (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-soc-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      {!loading && metricsData && (
        <>
          {/* Metrics Cards */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricsCard label="Accuracy" value={metrics.accuracy} color="cyan" />
            <MetricsCard label="Precision" value={metrics.precision} color="green" />
            <MetricsCard label="Recall" value={metrics.recall} color="purple" />
            <MetricsCard label="F1-Score" value={metrics.f1_score} color="orange" />
            <MetricsCard label="ROC-AUC" value={metrics.roc_auc} color="pink" />
          </div>

          {/* Additional Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-soc-accent mb-4">Training Info</h3>
              <div className="space-y-3 text-sm">
                <div className="flex justify-between">
                  <span className="text-soc-muted">Dataset</span>
                  <span className="text-white font-mono">{metricsData.dataset || '—'}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-soc-muted">Training Duration</span>
                  <span className="text-white font-mono">{metricsData.training_duration}s</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-soc-muted">Classes</span>
                  <span className="text-white font-mono">{metricsData.class_names?.join(', ') || '—'}</span>
                </div>
              </div>
            </div>
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-soc-accent mb-4">Best Hyperparameters</h3>
              <div className="space-y-2 text-sm max-h-48 overflow-y-auto">
                {metricsData.best_params && Object.entries(metricsData.best_params).map(([k, v]) => (
                  <div key={k} className="flex justify-between">
                    <span className="text-soc-muted font-mono">{k}</span>
                    <span className="text-white font-mono">{typeof v === 'number' ? v.toFixed(4) : String(v)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </>
      )}

      {!loading && !metricsData && selectedModel && (
        <div className="glass-card p-12 text-center">
          <p className="text-soc-muted">No metrics available for selected model.</p>
        </div>
      )}

      {!selectedModel && (
        <div className="glass-card p-12 text-center">
          <Shield className="w-16 h-16 text-soc-accent/30 mx-auto mb-4" />
          <p className="text-xl text-soc-muted">No models available</p>
          <p className="text-sm text-soc-muted mt-2">Train a model to see dashboard metrics</p>
        </div>
      )}
    </div>
  );
}
