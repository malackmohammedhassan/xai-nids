import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Crosshair, AlertCircle } from 'lucide-react';
import { predictData, getModels } from '../api';

export default function Prediction() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  useEffect(() => {
    getModels().then((res) => {
      setModels(res.data.models || []);
      if (res.data.models?.length > 0) setSelectedModel(res.data.models[0].id);
    }).catch(() => {});
  }, []);

  const handlePredict = async () => {
    if (!file || !selectedModel) {
      setError('Please select a model and upload a CSV file');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_id', selectedModel);

    try {
      const res = await predictData(formData);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Prediction failed');
    }
    setLoading(false);
  };

  const getConfidenceColor = (conf) => {
    if (conf >= 0.9) return 'text-green-400';
    if (conf >= 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Prediction</h1>
        <p className="text-soc-muted mt-1">Upload data and get predictions with confidence scores</p>
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Select Model</label>
            <select
              value={selectedModel}
              onChange={(e) => setSelectedModel(e.target.value)}
              className="w-full px-4 py-3 bg-soc-card border border-soc-border rounded-lg text-sm text-soc-text focus:outline-none focus:border-soc-accent"
            >
              <option value="">Choose model...</option>
              {models.map((m) => (
                <option key={m.id} value={m.id}>{m.id}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Data File (CSV)</label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="predict-upload"
              />
              <label
                htmlFor="predict-upload"
                className="flex items-center gap-3 px-4 py-3 bg-soc-card border border-soc-border rounded-lg cursor-pointer hover:border-soc-accent transition-colors"
              >
                <Upload className="w-5 h-5 text-soc-accent" />
                <span className="text-sm text-soc-text">
                  {file ? file.name : 'Choose CSV file...'}
                </span>
              </label>
            </div>
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handlePredict}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-purple-500 to-pink-500 text-white font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin"></div>
          ) : (
            <>
              <Crosshair className="w-5 h-5" />
              Run Prediction
            </>
          )}
        </button>
      </div>

      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }}>
          <div className="glass-card p-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-soc-accent">
                Predictions ({result.total_samples} samples)
              </h3>
              <span className="text-sm text-soc-muted font-mono">Model: {result.model_id}</span>
            </div>
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto">
              <table className="w-full text-sm">
                <thead className="sticky top-0 bg-soc-panel">
                  <tr className="text-soc-muted border-b border-soc-border">
                    <th className="py-2 px-4 text-left">#</th>
                    <th className="py-2 px-4 text-left">Prediction</th>
                    <th className="py-2 px-4 text-right">Confidence</th>
                    <th className="py-2 px-4 text-left">Probabilities</th>
                  </tr>
                </thead>
                <tbody>
                  {result.predictions.slice(0, 100).map((pred) => (
                    <tr key={pred.index} className="border-b border-soc-border/30 hover:bg-soc-card/50">
                      <td className="py-2 px-4 font-mono text-soc-muted">{pred.index}</td>
                      <td className="py-2 px-4">
                        <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                          pred.prediction === 'Normal' || pred.prediction === 'normal'
                            ? 'bg-green-500/20 text-green-400'
                            : 'bg-red-500/20 text-red-400'
                        }`}>
                          {pred.prediction}
                        </span>
                      </td>
                      <td className={`py-2 px-4 text-right font-mono font-bold ${getConfidenceColor(pred.confidence)}`}>
                        {pred.confidence ? (pred.confidence * 100).toFixed(1) + '%' : '—'}
                      </td>
                      <td className="py-2 px-4 text-xs font-mono text-soc-muted">
                        {pred.probabilities
                          ? Object.entries(pred.probabilities).map(([k, v]) => `${k}: ${(v * 100).toFixed(1)}%`).join(' | ')
                          : '—'}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {result.total_samples > 100 && (
              <p className="text-xs text-soc-muted mt-3 text-center">Showing first 100 of {result.total_samples} predictions</p>
            )}
          </div>
        </motion.div>
      )}
    </div>
  );
}
