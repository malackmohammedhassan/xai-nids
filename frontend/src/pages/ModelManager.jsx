import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Trash2, RefreshCw, Info } from 'lucide-react';
import { getModels, deleteModel, getModelMeta } from '../api';

export default function ModelManager() {
  const [models, setModels] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedMeta, setSelectedMeta] = useState(null);
  const [metaModelId, setMetaModelId] = useState('');

  const fetchModels = async () => {
    setLoading(true);
    try {
      const res = await getModels();
      setModels(res.data.models || []);
    } catch {
      setModels([]);
    }
    setLoading(false);
  };

  useEffect(() => {
    fetchModels();
  }, []);

  const handleDelete = async (id) => {
    if (!confirm(`Delete model "${id}"?`)) return;
    try {
      await deleteModel(id);
      fetchModels();
      if (metaModelId === id) {
        setSelectedMeta(null);
        setMetaModelId('');
      }
    } catch {
      alert('Failed to delete model');
    }
  };

  const handleViewMeta = async (id) => {
    try {
      const res = await getModelMeta(id);
      setSelectedMeta(res.data.meta);
      setMetaModelId(id);
    } catch {
      setSelectedMeta(null);
    }
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-white">Model Manager</h1>
          <p className="text-soc-muted mt-1">Manage saved models</p>
        </div>
        <button
          onClick={fetchModels}
          className="flex items-center gap-2 px-4 py-2 bg-soc-card border border-soc-border rounded-lg text-sm text-soc-muted hover:text-white hover:border-soc-accent transition-colors"
        >
          <RefreshCw className="w-4 h-4" />
          Refresh
        </button>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-2 border-soc-accent border-t-transparent rounded-full animate-spin"></div>
        </div>
      ) : models.length === 0 ? (
        <div className="glass-card p-12 text-center">
          <p className="text-soc-muted text-lg">No models saved yet</p>
          <p className="text-sm text-soc-muted mt-2">Train a model first to see it here</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {models.map((m, idx) => (
            <motion.div
              key={m.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.05 }}
            >
              <div className="glass-card p-5 hover:border-soc-accent/50 transition-colors">
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <h3 className="font-semibold text-white font-mono text-sm">{m.id}</h3>
                    <p className="text-xs text-soc-muted">{m.filename}</p>
                  </div>
                  <div className="flex gap-1">
                    <button
                      onClick={() => handleViewMeta(m.id)}
                      className="p-2 rounded-lg hover:bg-soc-accent/20 text-soc-muted hover:text-soc-accent transition-colors"
                      title="View metadata"
                    >
                      <Info className="w-4 h-4" />
                    </button>
                    <button
                      onClick={() => handleDelete(m.id)}
                      className="p-2 rounded-lg hover:bg-red-500/20 text-soc-muted hover:text-red-400 transition-colors"
                      title="Delete model"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
                {m.meta && (
                  <div className="space-y-1.5 text-xs">
                    {m.meta.model_type && (
                      <div className="flex justify-between">
                        <span className="text-soc-muted">Type</span>
                        <span className="text-white font-mono">{m.meta.model_type}</span>
                      </div>
                    )}
                    {m.meta.mode && (
                      <div className="flex justify-between">
                        <span className="text-soc-muted">Mode</span>
                        <span className="text-white font-mono capitalize">{m.meta.mode}</span>
                      </div>
                    )}
                    {m.meta.metrics?.accuracy !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-soc-muted">Accuracy</span>
                        <span className="text-green-400 font-mono font-bold">
                          {(m.meta.metrics.accuracy * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {m.meta.metrics?.f1_score !== undefined && (
                      <div className="flex justify-between">
                        <span className="text-soc-muted">F1-Score</span>
                        <span className="text-soc-accent font-mono font-bold">
                          {(m.meta.metrics.f1_score * 100).toFixed(1)}%
                        </span>
                      </div>
                    )}
                    {m.meta.dataset && (
                      <div className="flex justify-between">
                        <span className="text-soc-muted">Dataset</span>
                        <span className="text-white font-mono truncate max-w-[120px]">{m.meta.dataset}</span>
                      </div>
                    )}
                  </div>
                )}
              </div>
            </motion.div>
          ))}
        </div>
      )}

      {selectedMeta && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card p-6">
            <h3 className="text-lg font-semibold text-soc-accent mb-4">
              Metadata: <span className="font-mono">{metaModelId}</span>
            </h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              {Object.entries(selectedMeta).map(([key, value]) => (
                <div key={key} className="flex justify-between py-1 border-b border-soc-border/30">
                  <span className="text-soc-muted font-mono">{key}</span>
                  <span className="text-white font-mono text-right max-w-[60%] truncate">
                    {typeof value === 'object' ? JSON.stringify(value).slice(0, 80) : String(value)}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </motion.div>
      )}
    </div>
  );
}
