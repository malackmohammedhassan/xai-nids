import React, { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { Upload, Eye, AlertCircle } from 'lucide-react';
import { explainSHAP, explainLIME, getModels } from '../api';
import SHAPSummary from '../components/SHAPSummary';
import LIMEExplanation from '../components/LIMEExplanation';

export default function Explainability() {
  const [models, setModels] = useState([]);
  const [selectedModel, setSelectedModel] = useState('');
  const [file, setFile] = useState(null);
  const [instanceIdx, setInstanceIdx] = useState(0);
  const [loading, setLoading] = useState(false);
  const [shapResult, setShapResult] = useState(null);
  const [limeResult, setLimeResult] = useState(null);
  const [error, setError] = useState('');
  const [activeTab, setActiveTab] = useState('shap');

  useEffect(() => {
    getModels().then((res) => {
      setModels(res.data.models || []);
      if (res.data.models?.length > 0) setSelectedModel(res.data.models[0].id);
    }).catch(() => {});
  }, []);

  const handleExplain = async () => {
    if (!file || !selectedModel) {
      setError('Please select a model and upload a CSV file');
      return;
    }
    setError('');
    setLoading(true);
    setShapResult(null);
    setLimeResult(null);

    try {
      const formData1 = new FormData();
      formData1.append('file', file);
      formData1.append('model_id', selectedModel);
      formData1.append('instance_idx', instanceIdx);

      const formData2 = new FormData();
      formData2.append('file', file);
      formData2.append('model_id', selectedModel);
      formData2.append('instance_idx', instanceIdx);

      const [shapRes, limeRes] = await Promise.all([
        explainSHAP(formData1),
        explainLIME(formData2),
      ]);

      setShapResult(shapRes.data);
      setLimeResult(limeRes.data);
    } catch (err) {
      setError(err.response?.data?.detail || 'Explanation generation failed');
    }
    setLoading(false);
  };

  return (
    <div className="space-y-6 animate-fade-in">
      <div>
        <h1 className="text-3xl font-bold text-white">Explainability</h1>
        <p className="text-soc-muted mt-1">SHAP and LIME explanations for model predictions</p>
      </div>

      <div className="glass-card p-6">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
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
            <input
              type="file"
              accept=".csv"
              onChange={(e) => setFile(e.target.files[0])}
              className="hidden"
              id="explain-upload"
            />
            <label
              htmlFor="explain-upload"
              className="flex items-center gap-3 px-4 py-3 bg-soc-card border border-soc-border rounded-lg cursor-pointer hover:border-soc-accent transition-colors"
            >
              <Upload className="w-5 h-5 text-soc-accent" />
              <span className="text-sm text-soc-text">
                {file ? file.name : 'Choose CSV...'}
              </span>
            </label>
          </div>
          <div>
            <label className="block text-sm font-medium text-soc-muted mb-2">Instance Index</label>
            <input
              type="number"
              min="0"
              value={instanceIdx}
              onChange={(e) => setInstanceIdx(parseInt(e.target.value) || 0)}
              className="w-full px-4 py-3 bg-soc-card border border-soc-border rounded-lg text-sm text-soc-text focus:outline-none focus:border-soc-accent"
            />
          </div>
        </div>

        {error && (
          <div className="mt-4 flex items-center gap-2 text-red-400 text-sm">
            <AlertCircle className="w-4 h-4" />
            {error}
          </div>
        )}

        <button
          onClick={handleExplain}
          disabled={loading}
          className="mt-6 w-full flex items-center justify-center gap-2 py-3 bg-gradient-to-r from-soc-accent to-green-500 text-black font-semibold rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
        >
          {loading ? (
            <>
              <div className="w-5 h-5 border-2 border-black border-t-transparent rounded-full animate-spin"></div>
              Generating explanations...
            </>
          ) : (
            <>
              <Eye className="w-5 h-5" />
              Generate Explanations
            </>
          )}
        </button>
      </div>

      {(shapResult || limeResult) && (
        <div>
          {/* Tab Navigation */}
          <div className="flex gap-2 mb-4">
            <button
              onClick={() => setActiveTab('shap')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'shap'
                  ? 'bg-soc-accent text-black'
                  : 'bg-soc-card border border-soc-border text-soc-muted hover:text-white'
              }`}
            >
              SHAP
            </button>
            <button
              onClick={() => setActiveTab('lime')}
              className={`px-6 py-2 rounded-lg text-sm font-medium transition-all ${
                activeTab === 'lime'
                  ? 'bg-soc-accent text-black'
                  : 'bg-soc-card border border-soc-border text-soc-muted hover:text-white'
              }`}
            >
              LIME
            </button>
          </div>

          <motion.div key={activeTab} initial={{ opacity: 0, x: 20 }} animate={{ opacity: 1, x: 0 }}>
            {activeTab === 'shap' && shapResult && <SHAPSummary data={shapResult} />}
            {activeTab === 'lime' && limeResult && <LIMEExplanation data={limeResult} />}
          </motion.div>
        </div>
      )}
    </div>
  );
}
