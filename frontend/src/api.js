import axios from 'axios';

const API = axios.create({
  baseURL: '/api',
  timeout: 600000,
});

export const trainModel = (formData) =>
  API.post('/train', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const predictData = (formData) =>
  API.post('/predict', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const explainSHAP = (formData) =>
  API.post('/explain/shap', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const explainLIME = (formData) =>
  API.post('/explain/lime', formData, {
    headers: { 'Content-Type': 'multipart/form-data' },
  });

export const getMetrics = (modelId) =>
  API.get('/metrics', { params: { model_id: modelId } });

export const getModels = () => API.get('/models');

export const deleteModel = (modelId) => API.delete(`/models/${modelId}`);

export const getModelMeta = (modelId) => API.get(`/models/${modelId}/meta`);

export default API;
