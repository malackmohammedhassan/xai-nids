import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { Upload, Play, CheckCircle, AlertCircle } from 'lucide-react';
import { trainModel } from '../api';
import ConfusionMatrix from '../components/ConfusionMatrix';
import ROCChart from '../components/ROCChart';
import MetricsCard from '../components/MetricsCard';

export default function Training() {
  const [file, setFile] = useState(null);
  const [modelType, setModelType] = useState('random_forest');
  const [mode, setMode] = useState('binary');
  const [modelName, setModelName] = useState('');
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');

  const handleTrain = async () => {
    if (!file) {
      setError('Please upload a dataset CSV file');
      return;
    }
    setError('');
    setLoading(true);
    setResult(null);

    const formData = new FormData();
    formData.append('file', file);
    formData.append('model_type', modelType);
    formData.append('mode', mode);
    formData.append('model_name', modelName);

    try {
      const res = await trainModel(formData);
      setResult(res.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Training failed. Check your dataset format.');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Model Training</h1>
        <p className="text-soc-muted mt-1">Upload a dataset and train a new model</p>
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* File Upload */}
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Dataset (CSV)</label>
            <div className="relative">
              <input
                type="file"
                accept=".csv"
                onChange={(e) => setFile(e.target.files[0])}
                className="hidden"
                id="dataset-upload"
              />
              <label
                htmlFor="dataset-upload"
                className="flex items-center gap-3 px-4 py-3 bg-soc-card border border-soc-border rounded-lg cursor-pointer hover:border-soc-accent transition-colors"
              >
                <Upload className="w-5 h-5 text-soc-accent" />
                <span className="text-sm text-soc-text">
                  {file ? file.name : 'Choose CSV file...'}
                </span>
              </label>
            </div>
          </div>

          {/* Model Name */}
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Model Name (optional)</label>
            <input
              type="text"
              value={modelName}
              onChange={(e) => setModelName(e.target.value)}
              placeholder="e.g., my_rf_model"
              className="w-full px-4 py-3 bg-soc-card border border-soc-border rounded-lg text-sm text-soc-text placeholder-soc-muted focus:outline-none focus:border-soc-accent"
            />
          </div>

          {/* Model Type */}
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Model Type</label>
            <select
              value={modelType}
              onChange={(e) => setModelType(e.target.value)}
              className="w-full px-4 py-3 bg-soc-card border border-soc-border rounded-lg text-sm text-soc-text focus:outline-none focus:border-soc-accent"
            >
              <option value="random_forest">Random Forest</option>
              <option value="xgboost">XGBoost</option>
            </select>
          </div>

          {/* Classification Mode */}
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Classification Mode</label>
            <div className="flex gap-4">
              <button
                onClick={() => setMode('binary')}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                  mode === 'binary'
                    ? 'bg-soc-accent text-black'
                    : 'bg-soc-card border border-soc-border text-soc-muted hover:text-white'
                }`}
              >
                Binary
              </button>
              <button
                onClick={() => setMode('multiclass')}
                className={`flex-1 py-3 rounded-lg text-sm font-medium transition-all ${
                  mode === 'multiclass'
                    ? 'bg-soc-accent text-black'
                    : 'bg-soc-card border border-soc-border text-soc-muted hover:text-white'
                }`}
              >
                Multi-class
              </button>
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
          onClick={handleTrain}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-soc-accent to-blue-600 text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              Training... This may take a few minutes
            </>
          ) : (
            <>
              <Play className="w-5 h-5" />
              Train Model
            </>
          )}
        </button>
      </div>

      {/* Results */}
      {result && (
        <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="flex items-center gap-2 text-green-400">
            <CheckCircle className="w-5 h-5" />
            <span className="font-medium">
              Training complete! Model saved as "{result.model_id}" in {result.training_duration}s
            </span>
          </div>

          {/* Metrics */}
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <MetricsCard label="Accuracy" value={result.metrics?.accuracy} color="cyan" />
            <MetricsCard label="Precision" value={result.metrics?.precision} color="green" />
            <MetricsCard label="Recall" value={result.metrics?.recall} color="purple" />
            <MetricsCard label="F1-Score" value={result.metrics?.f1_score} color="orange" />
            <MetricsCard label="ROC-AUC" value={result.metrics?.roc_auc} color="pink" />
          </div>

          {/* Plots */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {result.confusion_matrix_plot && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-soc-accent mb-3">Confusion Matrix</h3>
                <img src={result.confusion_matrix_plot} alt="Confusion Matrix" className="w-full rounded" />
              </div>
            )}
            {result.roc_curve_plot && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-soc-accent mb-3">ROC Curve</h3>
                <img src={result.roc_curve_plot} alt="ROC Curve" className="w-full rounded" />
              </div>
            )}
            {result.pr_curve_plot && (
              <div className="glass-card p-4">
                <h3 className="text-sm font-semibold text-soc-accent mb-3">Precision-Recall Curve</h3>
                <img src={result.pr_curve_plot} alt="PR Curve" className="w-full rounded" />
              </div>
            )}
          </div>

          {/* Classification Report */}
          {result.classification_report && (
            <div className="glass-card p-6">
              <h3 className="text-lg font-semibold text-soc-accent mb-4">Classification Report</h3>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-soc-muted border-b border-soc-border">
                      <th className="py-2 px-4 text-left">Class</th>
                      <th className="py-2 px-4 text-right">Precision</th>
                      <th className="py-2 px-4 text-right">Recall</th>
                      <th className="py-2 px-4 text-right">F1-Score</th>
                      <th className="py-2 px-4 text-right">Support</th>
                    </tr>
                  </thead>
                  <tbody>
                    {Object.entries(result.classification_report)
                      .filter(([k]) => !['accuracy', 'macro avg', 'weighted avg'].includes(k))
                      .map(([cls, vals]) => (
                        <tr key={cls} className="border-b border-soc-border/30">
                          <td className="py-2 px-4 font-mono text-white">{cls}</td>
                          <td className="py-2 px-4 text-right font-mono">{vals.precision?.toFixed(4)}</td>
                          <td className="py-2 px-4 text-right font-mono">{vals.recall?.toFixed(4)}</td>
                          <td className="py-2 px-4 text-right font-mono">{vals['f1-score']?.toFixed(4)}</td>
                          <td className="py-2 px-4 text-right font-mono">{vals.support}</td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </motion.div>
      )}
    </div>
  );
}
