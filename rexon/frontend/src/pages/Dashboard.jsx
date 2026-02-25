import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function StatCard({ label, value, sub, color = 'text-white' }) {
  return (
    <div className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-4">
      <div className="text-xs text-slate-500 tracking-wider mb-2">{label}</div>
      <div className={`text-3xl font-bold ${color}`}>{value}</div>
      {sub && <div className="text-xs text-slate-500 mt-1">{sub}</div>}
    </div>
  );
}

export default function Dashboard() {
  const [runs, setRuns] = useState([]);
  const [testcases, setTestcases] = useState([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/runs`),
      axios.get(`${API}/api/testcases-manager`).catch(() => ({ data: [] }))
    ]).then(([r, t]) => {
      setRuns(r.data || []);
      setTestcases(t.data || []);
    }).catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  const totalRuns = runs.length;
  const passed = runs.reduce((s, r) => s + (r.passed || 0), 0);
  const failed = runs.reduce((s, r) => s + (r.failed || 0), 0);
  const healed = runs.reduce((s, r) => s + (r.healed || 0), 0);
  const total  = passed + failed;
  const passRate = total ? Math.round((passed / total) * 100) : 0;
  const lastRun = runs[0];

  return (
    <Layout>
      <div className="max-w-6xl mx-auto p-6">
        <div className="mb-6">
          <h1 className="text-xl font-bold text-white tracking-wider">Dashboard</h1>
          <p className="text-xs text-slate-500 mt-1">AI-powered QA automation overview</p>
        </div>

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading...</div>
        ) : (
          <>
            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="TOTAL RUNS" value={totalRuns} sub="all time" />
              <StatCard label="PASS RATE" value={`${passRate}%`} sub={`${passed} passed / ${total} total`} color="text-green-400" />
              <StatCard label="SELF-HEALED" value={healed} sub="auto-fixed by AI" color="text-cyan-400" />
              <StatCard label="TEST CASES" value={testcases.length} sub="stored definitions" color="text-blue-400" />
            </div>

            {/* Last Run Banner */}
            {lastRun && (
              <div className="mb-8 bg-[#0b1120] border border-[#1a3050] rounded-lg p-4 cursor-pointer hover:border-[#2a4070] transition-all"
                onClick={() => navigate(`/run/${lastRun.id}`)}>
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-xs text-slate-500 tracking-wider mb-1">LAST RUN</div>
                    <div className="text-white font-medium">{lastRun.name}</div>
                    <div className="text-xs text-slate-500 mt-0.5">{new Date(lastRun.created_at).toLocaleString()}</div>
                  </div>
                  <div className="flex items-center gap-4 text-sm">
                    <span className="text-green-400">✓ {lastRun.passed || 0}</span>
                    <span className="text-red-400">✗ {lastRun.failed || 0}</span>
                    {(lastRun.healed || 0) > 0 && <span className="text-cyan-400">⚡ {lastRun.healed}</span>}
                    <span className={`text-xs px-2 py-1 rounded uppercase tracking-wider
                      ${lastRun.status === 'completed' ? 'bg-green-900/40 text-green-400'
                        : lastRun.status === 'running' ? 'bg-yellow-900/40 text-yellow-400'
                        : 'bg-[#1a3050] text-slate-400'}`}>
                      {lastRun.status}
                    </span>
                  </div>
                </div>
              </div>
            )}

            <div className="grid md:grid-cols-2 gap-6">
              {/* Recent Runs */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold tracking-widest text-slate-400">RECENT RUNS</h2>
                  <button onClick={() => navigate('/runs')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
                </div>
                <div className="space-y-2">
                  {runs.slice(0, 5).map(run => (
                    <div key={run.id} onClick={() => navigate(`/run/${run.id}`)}
                      className="bg-[#0b1120] border border-[#1a3050] rounded p-3 cursor-pointer hover:border-[#2a4070] transition-all flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white truncate max-w-[180px]">{run.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">{new Date(run.created_at).toLocaleDateString()}</div>
                      </div>
                      <div className="flex items-center gap-2 text-xs">
                        <span className="text-green-400">✓{run.passed || 0}</span>
                        <span className="text-red-400">✗{run.failed || 0}</span>
                        <span className={`w-2 h-2 rounded-full ${
                          run.status === 'completed' ? 'bg-green-400'
                          : run.status === 'running' ? 'bg-yellow-400 animate-pulse'
                          : 'bg-slate-400'}`} />
                      </div>
                    </div>
                  ))}
                  {runs.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-[#1a3050] rounded-lg">
                      No runs yet
                    </div>
                  )}
                </div>
              </div>

              {/* Test Cases */}
              <div>
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-bold tracking-widest text-slate-400">TEST CASES</h2>
                  <button onClick={() => navigate('/testcases')} className="text-xs text-blue-400 hover:text-blue-300">View all →</button>
                </div>
                <div className="space-y-2">
                  {testcases.slice(0, 5).map(tc => (
                    <div key={tc.id} onClick={() => navigate('/testcases')}
                      className="bg-[#0b1120] border border-[#1a3050] rounded p-3 cursor-pointer hover:border-[#2a4070] transition-all flex items-center justify-between">
                      <div>
                        <div className="text-sm text-white truncate max-w-[180px]">{tc.name}</div>
                        <div className="text-[10px] text-slate-500 mt-0.5">
                          {tc.run_count || 0} runs · {tc.pass_rate || 0}% pass rate
                        </div>
                      </div>
                      <span className={`text-xs px-2 py-0.5 rounded uppercase
                        ${tc.status === 'passed' ? 'bg-green-900/40 text-green-400'
                          : tc.status === 'failed' ? 'bg-red-900/40 text-red-400'
                          : tc.status === 'running' ? 'bg-yellow-900/40 text-yellow-400'
                          : 'bg-[#1a3050] text-slate-400'}`}>
                        {tc.status || 'idle'}
                      </span>
                    </div>
                  ))}
                  {testcases.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-sm border border-dashed border-[#1a3050] rounded-lg">
                      No test cases yet —{' '}
                      <button onClick={() => navigate('/testcases')} className="text-blue-400 hover:underline">create one</button>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </Layout>
  );
}
