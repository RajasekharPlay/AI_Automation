import axios from 'axios';

const api = axios.create({
  baseURL: import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001',
  headers: { 'Content-Type': 'application/json' }
});

export const createRun = (name, testCases, credentialId, projectId, domSnapshotId) =>
  api.post('/api/runs', { name, testCases, credentialId, projectId, domSnapshotId }).then(r => r.data);

// Projects
export const getProjects   = ()           => api.get('/api/projects').then(r => r.data);
export const createProject = (data)       => api.post('/api/projects', data).then(r => r.data);
export const deleteProject = (id)         => api.delete(`/api/projects/${id}`).then(r => r.data);

// Credentials
export const getCredentials   = ()        => api.get('/api/credentials').then(r => r.data);
export const createCredential = (data)    => api.post('/api/credentials', data).then(r => r.data);
export const updateCredential = (id, data)=> api.patch(`/api/credentials/${id}`, data).then(r => r.data);
export const deleteCredential = (id)      => api.delete(`/api/credentials/${id}`).then(r => r.data);

// DOM Snapshots
export const getDomSnapshots = ()         => api.get('/api/dom-snapshots').then(r => r.data);
export const getDomSnapshot  = (id)       => api.get(`/api/dom-snapshots/${id}`).then(r => r.data);
export const deleteDomSnapshot = (id)     => api.delete(`/api/dom-snapshots/${id}`).then(r => r.data);

// Testcases Manager
export const getTestcases    = ()         => api.get('/api/testcases-manager').then(r => r.data);
export const getTestcase     = (id)       => api.get(`/api/testcases-manager/${id}`).then(r => r.data);
export const createTestcase  = (data)     => api.post('/api/testcases-manager', data).then(r => r.data);
export const updateTestcase  = (id, data) => api.patch(`/api/testcases-manager/${id}`, data).then(r => r.data);
export const rerunTestcase   = (id)       => api.post(`/api/testcases-manager/${id}/rerun`).then(r => r.data);
export const deleteTestcase  = (id)       => api.delete(`/api/testcases-manager/${id}`).then(r => r.data);

// Chat
export const sendChat       = (body)      => api.post('/api/chat', body).then(r => r.data);
export const getChatHistory = (sessionId) => api.get(`/api/chat/history/${sessionId}`).then(r => r.data);

export const getRuns = () =>
  api.get('/api/runs').then(r => r.data);

export const getRun = (id) =>
  api.get(`/api/runs/${id}`).then(r => r.data);

export const deleteRun = (id) =>
  api.delete(`/api/runs/${id}`).then(r => r.data);

export default api;
