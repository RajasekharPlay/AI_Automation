import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' }
});

export const createRun = (name, testCases) =>
  api.post('/api/runs', { name, testCases }).then(r => r.data);

export const getRuns = () =>
  api.get('/api/runs').then(r => r.data);

export const getRun = (id) =>
  api.get(`/api/runs/${id}`).then(r => r.data);

export const deleteRun = (id) =>
  api.delete(`/api/runs/${id}`).then(r => r.data);

export default api;
