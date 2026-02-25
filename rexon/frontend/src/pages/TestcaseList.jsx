import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const STATUS_COLORS = {
  idle:    'bg-[#1a3050] text-slate-400',
  running: 'bg-yellow-900/40 text-yellow-400',
  passed:  'bg-green-900/40 text-green-400',
  failed:  'bg-red-900/40 text-red-400',
};

export default function TestcaseList() {
  const [testcases, setTestcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [rerunning, setRerunning] = useState({});
  const [filter, setFilter] = useState('all');
  const [search, setSearch] = useState('');
  const navigate = useNavigate();

  useEffect(() => { fetchTestcases(); }, []);

  async function fetchTestcases() {
    try {
      const { data } = await axios.get(`${API}/api/testcases-manager`);
      setTestcases(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleRerun(tc) {
    if (rerunning[tc.id]) return;
    setRerunning(prev => ({ ...prev, [tc.id]: true }));
    try {
      const { data } = await axios.post(`${API}/api/testcases-manager/${tc.id}/rerun`);
      navigate(`/run/${data.runId}`);
    } catch (e) {
      alert('Rerun failed: ' + (e.response?.data?.error || e.message));
      setRerunning(prev => ({ ...prev, [tc.id]: false }));
    }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this test case?')) return;
    await axios.delete(`${API}/api/testcases-manager/${id}`).catch(console.error);
    setTestcases(prev => prev.filter(t => t.id !== id));
  }

  const filtered = testcases.filter(tc => {
    const matchStatus = filter === 'all' || tc.status === filter;
    const matchSearch = !search || tc.name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider">Test Cases</h1>
            <p className="text-xs text-slate-500 mt-1">Stored test definitions · rerun anytime</p>
          </div>
          <button onClick={() => navigate('/testcases/create')}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded tracking-wider transition-colors">
            + NEW TEST CASE
          </button>
        </div>

        {/* Filters */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div className="flex gap-1 bg-[#0b1120] border border-[#1a3050] rounded p-1">
            {['all', 'idle', 'passed', 'failed', 'running'].map(s => (
              <button key={s} onClick={() => setFilter(s)}
                className={`px-3 py-1 rounded text-xs transition-colors capitalize
                  ${filter === s ? 'bg-[#1a3050] text-white' : 'text-slate-400 hover:text-white'}`}>
                {s}
              </button>
            ))}
          </div>
          <input value={search} onChange={e => setSearch(e.target.value)}
            placeholder="Search test cases..."
            className="bg-[#0b1120] border border-[#1a3050] text-white text-xs px-3 py-2 rounded outline-none focus:border-blue-600 transition-colors w-48" />
          <span className="text-xs text-slate-500 ml-auto">{filtered.length} test cases</span>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 border border-dashed border-[#1a3050] rounded-lg">
            <div className="text-4xl mb-3">◈</div>
            <div className="text-slate-400 text-sm mb-2">
              {search || filter !== 'all' ? 'No test cases match your filter' : 'No test cases yet'}
            </div>
            {!search && filter === 'all' && (
              <button onClick={() => navigate('/testcases/create')}
                className="mt-2 bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded">
                + Create First Test Case
              </button>
            )}
          </div>
        ) : (
          <div className="bg-[#0b1120] border border-[#1a3050] rounded-lg overflow-hidden">
            {/* Table Header */}
            <div className="grid grid-cols-12 gap-3 px-4 py-2 border-b border-[#1a3050] text-[10px] text-slate-500 uppercase tracking-wider">
              <div className="col-span-4">Name</div>
              <div className="col-span-2">Status</div>
              <div className="col-span-2">Pass Rate</div>
              <div className="col-span-2">Last Run</div>
              <div className="col-span-2 text-right">Actions</div>
            </div>

            {filtered.map((tc, i) => (
              <div key={tc.id}
                className={`grid grid-cols-12 gap-3 px-4 py-3 items-center transition-colors hover:bg-[#0d1929]
                  ${i < filtered.length - 1 ? 'border-b border-[#1a3050]' : ''}`}>
                {/* Name */}
                <div className="col-span-4">
                  <div className="text-sm text-white font-medium truncate">{tc.name}</div>
                  {tc.credentials?.name && (
                    <div className="text-[10px] text-slate-500 mt-0.5 flex items-center gap-1">
                      <span>🔑</span> {tc.credentials.name}
                      <span className="ml-1 px-1 rounded bg-[#1a3050] text-slate-400 uppercase text-[9px]">{tc.credentials.env_type}</span>
                    </div>
                  )}
                  {tc.dom_snapshots?.domain && (
                    <div className="text-[10px] text-slate-500 flex items-center gap-1">
                      <span>⌖</span> {tc.dom_snapshots.domain} · {tc.dom_snapshots.page_count} pages crawled
                    </div>
                  )}
                </div>

                {/* Status */}
                <div className="col-span-2">
                  <span className={`text-[10px] px-2 py-0.5 rounded uppercase tracking-wider ${STATUS_COLORS[tc.status] || STATUS_COLORS.idle}`}>
                    {tc.status === 'running' && <span className="animate-pulse">● </span>}
                    {tc.status || 'idle'}
                  </span>
                </div>

                {/* Pass Rate */}
                <div className="col-span-2">
                  <div className="flex items-center gap-2">
                    <div className="flex-1 h-1.5 bg-[#1a3050] rounded-full overflow-hidden">
                      <div className="h-full bg-green-500 rounded-full" style={{ width: `${tc.pass_rate || 0}%` }} />
                    </div>
                    <span className="text-xs text-slate-400 w-8 text-right">{tc.pass_rate || 0}%</span>
                  </div>
                  <div className="text-[10px] text-slate-500 mt-0.5">{tc.run_count || 0} runs</div>
                </div>

                {/* Last Run */}
                <div className="col-span-2 text-xs text-slate-500">
                  {tc.last_run_at ? new Date(tc.last_run_at).toLocaleDateString() : 'Never'}
                </div>

                {/* Actions */}
                <div className="col-span-2 flex items-center justify-end gap-2">
                  <button onClick={() => handleRerun(tc)} disabled={rerunning[tc.id]}
                    className="text-xs bg-blue-600/20 hover:bg-blue-600 border border-blue-600/40 hover:border-blue-500 text-blue-400 hover:text-white px-2 py-1 rounded transition-all disabled:opacity-40 flex items-center gap-1">
                    {rerunning[tc.id] ? <span className="animate-spin">⚙</span> : '▶'}
                    {rerunning[tc.id] ? 'Running...' : 'Rerun'}
                  </button>
                  <button onClick={() => handleDelete(tc.id)}
                    className="text-slate-600 hover:text-red-400 text-xs w-6 text-center transition-colors">
                    ✕
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </Layout>
  );
}
