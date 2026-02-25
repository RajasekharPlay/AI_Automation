import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { getRuns, deleteRun, createRun } from '../lib/api';
import ExcelUploader from '../components/ExcelUploader';
import Layout from '../components/Layout';
import axios from 'axios';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const STATUS_DOT = {
  pending:    'bg-gray-400',
  generating: 'bg-blue-400 animate-pulse',
  running:    'bg-yellow-400 animate-pulse',
  completed:  'bg-green-400',
  failed:     'bg-red-400'
};
const STATUS_COLORS = {
  pending:    'text-gray-400',
  generating: 'text-blue-400',
  running:    'text-yellow-400',
  completed:  'text-green-400',
  failed:     'text-red-400'
};

export default function RunsList() {
  const [runs, setRuns] = useState([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [runName, setRunName] = useState('');
  const [inputTab, setInputTab] = useState('excel');
  const [parsedFromExcel, setParsedFromExcel] = useState(null);
  const [testCasesJson, setTestCasesJson] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [credentialId, setCredentialId] = useState('');
  const [jsonError, setJsonError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    fetchRuns();
    const interval = setInterval(fetchRuns, 5000);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    axios.get(`${API}/api/credentials`).then(r => setCredentials(r.data || [])).catch(() => {});
  }, []);

  async function fetchRuns() {
    try { const data = await getRuns(); setRuns(data); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleCreate() {
    setJsonError('');
    let testCases;
    if (inputTab === 'excel') {
      if (!parsedFromExcel?.length) { setJsonError('Please upload and parse an Excel file first'); return; }
      testCases = parsedFromExcel;
    } else {
      try { testCases = JSON.parse(testCasesJson); if (!Array.isArray(testCases)) throw new Error('Must be JSON array'); }
      catch (e) { setJsonError('Invalid JSON: ' + e.message); return; }
    }
    if (!runName.trim()) { setJsonError('Please enter a run name'); return; }
    setCreating(true);
    try {
      const result = await createRun(runName, testCases, credentialId || null);
      navigate(`/run/${result.runId}`);
    } catch (e) {
      setJsonError('Failed: ' + (e.response?.data?.error || e.message));
      setCreating(false);
    }
  }

  async function handleDelete(id, e) {
    e.stopPropagation();
    if (!confirm('Delete this run?')) return;
    await deleteRun(id);
    setRuns(prev => prev.filter(r => r.id !== id));
  }

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider">Test Runs</h1>
            <p className="text-xs text-slate-500 mt-1">All execution history</p>
          </div>
          <button onClick={() => setShowNew(!showNew)}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded tracking-wider transition-colors">
            {showNew ? '✕ CLOSE' : '+ NEW RUN'}
          </button>
        </div>

        {showNew && (
          <div className="mb-8 bg-[#0b1120] border border-[#1a3050] rounded-lg p-6">
            <h2 className="text-sm font-bold tracking-widest text-cyan-400 mb-5">⚡ NEW TEST RUN</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 tracking-wider block mb-2">RUN NAME</label>
                <input type="text" value={runName} onChange={e => setRunName(e.target.value)}
                  placeholder="e.g. Login Flow Tests — Sprint 12"
                  className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2.5 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
              </div>

              {credentials.length > 0 && (
                <div>
                  <label className="text-xs text-slate-400 tracking-wider block mb-2">CREDENTIALS (optional)</label>
                  <select value={credentialId} onChange={e => setCredentialId(e.target.value)}
                    className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors">
                    <option value="">No credentials</option>
                    {credentials.map(c => (
                      <option key={c.id} value={c.id}>{c.name} — {c.base_url} ({c.env_type})</option>
                    ))}
                  </select>
                </div>
              )}

              <div>
                <label className="text-xs text-slate-400 tracking-wider block mb-3">TEST CASES SOURCE</label>
                <div className="flex gap-1 bg-[#060d1a] border border-[#1a3050] rounded p-1 w-fit mb-4">
                  {[{ id: 'excel', label: '📊 Excel / CSV' }, { id: 'json', label: '{ } JSON' }].map(tab => (
                    <button key={tab.id} onClick={() => { setInputTab(tab.id); setJsonError(''); }}
                      className={`px-4 py-2 rounded text-xs transition-colors ${inputTab === tab.id ? 'bg-[#1a3050] text-white' : 'text-slate-400 hover:text-white'}`}>
                      {tab.label}
                    </button>
                  ))}
                </div>
                {inputTab === 'excel' && <ExcelUploader onTestCasesParsed={tc => { setParsedFromExcel(tc); if (!runName) setRunName(`Run — ${new Date().toLocaleDateString()}`); }} />}
                {inputTab === 'json' && (
                  <textarea value={testCasesJson} onChange={e => { setTestCasesJson(e.target.value); setJsonError(''); }}
                    placeholder={'[\n  { "name": "Login Test", "url": "https://example.com", "steps": [] }\n]'}
                    rows={8} className="w-full bg-[#060d1a] border border-[#1a3050] text-green-300 px-3 py-2 rounded text-xs font-mono outline-none focus:border-cyan-500 transition-colors resize-none" />
                )}
              </div>
            </div>

            {jsonError && <div className="mt-3 text-red-400 text-xs">❌ {jsonError}</div>}

            <div className="mt-5 flex gap-3">
              <button onClick={handleCreate} disabled={creating}
                className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-8 py-3 rounded tracking-wider transition-colors flex items-center gap-2">
                {creating ? <><span className="animate-spin">⚙</span> CLAUDE GENERATING...</> : `🚀 LAUNCH${parsedFromExcel ? ` — ${parsedFromExcel.length} TESTS` : ''}`}
              </button>
              <button onClick={() => { setShowNew(false); setParsedFromExcel(null); setRunName(''); }}
                className="border border-[#1a3050] text-slate-400 hover:text-white text-xs px-4 py-3 rounded tracking-wider transition-colors">
                CANCEL
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading...</div>
        ) : runs.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#1a3050] rounded-lg">
            <div className="text-5xl mb-3">▶</div>
            <div className="text-slate-400 text-sm">No test runs yet</div>
            <div className="text-slate-500 text-xs mt-1 mb-4">Launch a run or rerun a stored test case</div>
            <button onClick={() => setShowNew(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-5 py-2 rounded tracking-wider">+ NEW RUN</button>
          </div>
        ) : (
          <div className="space-y-3">
            {runs.map(run => (
              <div key={run.id} onClick={() => navigate(`/run/${run.id}`)}
                className="bg-[#0b1120] border border-[#1a3050] hover:border-[#2a4070] rounded-lg p-4 cursor-pointer transition-all hover:bg-[#0d1929]">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <span className={`w-2.5 h-2.5 rounded-full inline-block ${STATUS_DOT[run.status] || 'bg-gray-400'}`} />
                    <span className="font-medium text-sm text-white">{run.name}</span>
                    <span className={`text-xs tracking-wider ${STATUS_COLORS[run.status] || 'text-gray-400'}`}>{run.status?.toUpperCase()}</span>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="text-xs flex gap-3">
                      <span className="text-green-400">✓ {run.passed || 0}</span>
                      <span className="text-red-400">✗ {run.failed || 0}</span>
                      {(run.healed || 0) > 0 && <span className="text-cyan-400">⚡ {run.healed}</span>}
                      <span className="text-slate-500">/ {run.total || 0}</span>
                    </div>
                    <span className="text-xs text-slate-500 hidden sm:block">{new Date(run.created_at).toLocaleString()}</span>
                    <button onClick={e => handleDelete(run.id, e)} className="text-slate-600 hover:text-red-400 text-xs w-6 text-center">✕</button>
                  </div>
                </div>
                {(run.total || 0) > 0 && (
                  <div className="mt-3 h-1 bg-[#1a3050] rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all duration-500"
                      style={{ width: `${(((run.passed || 0) + (run.failed || 0)) / run.total) * 100}%` }} />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
