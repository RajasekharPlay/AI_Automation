import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import Layout from '../components/Layout';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

export default function CreateTest() {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [credentialId, setCredentialId] = useState('');
  const [credentials, setCredentials] = useState([]);
  const [domSnapshots, setDomSnapshots] = useState([]);
  const [domSnapshotId, setDomSnapshotId] = useState('');
  const [crawlUrl, setCrawlUrl] = useState('');
  const [crawling, setCrawling] = useState(false);
  const [crawlStatus, setCrawlStatus] = useState('');
  const [testPlan, setTestPlan] = useState(null);
  const [planDescription, setPlanDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      axios.get(`${API}/api/credentials`).catch(() => ({ data: [] })),
      axios.get(`${API}/api/dom-snapshots`).catch(() => ({ data: [] }))
    ]).then(([c, d]) => {
      setCredentials(c.data || []);
      setDomSnapshots(d.data || []);
    });
  }, []);

  async function handleCrawl() {
    if (!crawlUrl.trim()) return setError('Enter a URL to crawl');
    setCrawling(true);
    setCrawlStatus('Triggering DOM crawl via GitHub Actions...');
    setError('');
    try {
      // Send crawl request through chat endpoint
      const { data } = await axios.post(`${API}/api/chat`, {
        message: `Crawl DOM for ${crawlUrl}`,
        session_id: 'create-test-' + Date.now(),
        context: { currentUrl: crawlUrl }
      });
      setCrawlStatus(data.reply || 'Crawl triggered. Check back in ~2 minutes for the DOM snapshot.');
      // Refresh snapshots after a short delay
      setTimeout(async () => {
        const { data: snaps } = await axios.get(`${API}/api/dom-snapshots`).catch(() => ({ data: [] }));
        setDomSnapshots(snaps || []);
        setCrawling(false);
      }, 3000);
    } catch (e) {
      setError('Crawl failed: ' + (e.response?.data?.error || e.message));
      setCrawling(false);
      setCrawlStatus('');
    }
  }

  async function handleGeneratePlan() {
    if (!planDescription.trim()) return setError('Describe what you want to test');
    setGenerating(true);
    setError('');
    try {
      const snap = domSnapshots.find(s => s.id === domSnapshotId);
      let domMap = null;
      if (domSnapshotId) {
        const { data } = await axios.get(`${API}/api/dom-snapshots/${domSnapshotId}`);
        domMap = data?.dom_map_json;
      }
      const { data } = await axios.post(`${API}/api/chat`, {
        message: `Generate test plan: ${planDescription}`,
        session_id: 'create-test-' + Date.now(),
        context: {
          credentialId,
          domSnapshotId,
          domMap: domMap ? JSON.stringify(domMap).substring(0, 1000) : null,
          currentUrl: snap?.domain || crawlUrl
        }
      });
      if (data.action?.plan) {
        setTestPlan(data.action.plan);
        if (!name && data.action.plan.name) setName(data.action.plan.name);
      }
    } catch (e) {
      setError('Plan generation failed: ' + (e.response?.data?.error || e.message));
    }
    setGenerating(false);
  }

  async function handleSave() {
    if (!name.trim()) return setError('Enter a test case name');
    setSaving(true);
    setError('');
    try {
      const { data } = await axios.post(`${API}/api/testcases-manager`, {
        name: name.trim(),
        description: description.trim(),
        test_plan_json: testPlan,
        credential_id: credentialId || null,
        dom_snapshot_id: domSnapshotId || null
      });
      navigate('/testcases');
    } catch (e) {
      setError('Save failed: ' + (e.response?.data?.error || e.message));
      setSaving(false);
    }
  }

  return (
    <Layout>
      <div className="max-w-3xl mx-auto p-6">
        <div className="mb-6">
          <button onClick={() => navigate('/testcases')} className="text-xs text-slate-500 hover:text-slate-300 mb-3 flex items-center gap-1">
            ← Back to Test Cases
          </button>
          <h1 className="text-xl font-bold text-white tracking-wider">Create Test Case</h1>
          <p className="text-xs text-slate-500 mt-1">Define a reusable, AI-generated test</p>
        </div>

        <div className="space-y-6">
          {/* Basic Info */}
          <section className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-5">
            <h2 className="text-xs font-bold tracking-widest text-cyan-400 mb-4">1 — BASIC INFO</h2>
            <div className="space-y-4">
              <div>
                <label className="text-xs text-slate-400 tracking-wider block mb-2">TEST NAME *</label>
                <input value={name} onChange={e => setName(e.target.value)}
                  placeholder="e.g. Login Flow Test"
                  className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2.5 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
              </div>
              <div>
                <label className="text-xs text-slate-400 tracking-wider block mb-2">DESCRIPTION</label>
                <textarea value={description} onChange={e => setDescription(e.target.value)}
                  placeholder="What does this test verify?"
                  rows={2}
                  className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors resize-none" />
              </div>
            </div>
          </section>

          {/* Credentials */}
          <section className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-5">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xs font-bold tracking-widest text-cyan-400">2 — CREDENTIALS</h2>
              <button onClick={() => navigate('/credentials')} className="text-xs text-blue-400 hover:text-blue-300">
                + Manage Credentials →
              </button>
            </div>
            <select value={credentialId} onChange={e => setCredentialId(e.target.value)}
              className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2.5 rounded text-sm outline-none focus:border-cyan-500 transition-colors">
              <option value="">No credentials (public app)</option>
              {credentials.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.base_url} ({c.env_type})</option>
              ))}
            </select>
            {credentialId && (
              <div className="mt-2 text-xs text-green-400 flex items-center gap-1">
                ✓ Credentials will be injected at runtime · never stored in script
              </div>
            )}
          </section>

          {/* DOM Crawl */}
          <section className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-5">
            <h2 className="text-xs font-bold tracking-widest text-cyan-400 mb-4">3 — DOM CRAWL (optional)</h2>
            <p className="text-xs text-slate-500 mb-4">Crawl the target URL to extract interactive elements. This gives the AI better selector knowledge.</p>

            {/* Existing snapshots */}
            {domSnapshots.length > 0 && (
              <div className="mb-4">
                <label className="text-xs text-slate-400 tracking-wider block mb-2">USE EXISTING SNAPSHOT</label>
                <select value={domSnapshotId} onChange={e => setDomSnapshotId(e.target.value)}
                  className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors">
                  <option value="">None — skip DOM context</option>
                  {domSnapshots.map(s => (
                    <option key={s.id} value={s.id}>{s.domain} · {s.page_count} pages · {new Date(s.created_at).toLocaleDateString()}</option>
                  ))}
                </select>
              </div>
            )}

            {/* New crawl */}
            <div>
              <label className="text-xs text-slate-400 tracking-wider block mb-2">OR CRAWL NEW URL</label>
              <div className="flex gap-2">
                <input value={crawlUrl} onChange={e => setCrawlUrl(e.target.value)}
                  placeholder="https://app.example.com"
                  className="flex-1 bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
                <button onClick={handleCrawl} disabled={crawling}
                  className="bg-cyan-700 hover:bg-cyan-600 disabled:opacity-40 text-white text-xs px-4 py-2 rounded transition-colors flex items-center gap-1.5">
                  {crawling ? <><span className="animate-spin">⚙</span> Crawling...</> : '⌖ Crawl'}
                </button>
              </div>
              {crawlStatus && <div className="mt-2 text-xs text-cyan-400">{crawlStatus}</div>}
            </div>
          </section>

          {/* AI Test Plan */}
          <section className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-5">
            <h2 className="text-xs font-bold tracking-widest text-cyan-400 mb-4">4 — AI TEST PLAN</h2>
            <p className="text-xs text-slate-500 mb-4">Describe what to test and the AI will generate a structured plan.</p>
            <div className="flex gap-2 mb-3">
              <textarea value={planDescription} onChange={e => setPlanDescription(e.target.value)}
                placeholder="e.g. Test login with valid credentials, verify dashboard loads, check navigation menu works"
                rows={3}
                className="flex-1 bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors resize-none" />
            </div>
            <button onClick={handleGeneratePlan} disabled={generating}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-5 py-2 rounded transition-colors flex items-center gap-2">
              {generating ? <><span className="animate-spin">⚙</span> Generating...</> : '⚡ Generate Test Plan with AI'}
            </button>

            {/* Plan preview */}
            {testPlan && (
              <div className="mt-4 bg-[#060d1a] border border-[#1a3050] rounded p-4">
                <div className="text-xs font-bold text-green-400 mb-3">✓ Test Plan Generated</div>
                <div className="text-xs text-white font-medium mb-2">{testPlan.name}</div>
                <div className="space-y-1">
                  {(testPlan.steps || []).map(s => (
                    <div key={s.index} className="flex items-start gap-2 text-xs text-slate-300">
                      <span className="text-slate-600 w-4 shrink-0">{s.index}.</span>
                      <span className="text-cyan-400 uppercase text-[10px] w-16 shrink-0">{s.action}</span>
                      <span>{s.description}</span>
                    </div>
                  ))}
                </div>
                {testPlan.assertions?.length > 0 && (
                  <div className="mt-3 pt-3 border-t border-[#1a3050]">
                    <div className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Assertions</div>
                    {testPlan.assertions.map((a, i) => (
                      <div key={i} className="text-xs text-green-300">✓ {a}</div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </section>

          {error && <div className="text-red-400 text-xs bg-red-900/20 border border-red-900/40 rounded p-3">❌ {error}</div>}

          {/* Save */}
          <div className="flex gap-3">
            <button onClick={handleSave} disabled={saving || !name.trim()}
              className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-8 py-3 rounded tracking-wider transition-colors flex items-center gap-2">
              {saving ? <><span className="animate-spin">⚙</span> Saving...</> : '💾 Save Test Case'}
            </button>
            <button onClick={() => navigate('/testcases')}
              className="border border-[#1a3050] text-slate-400 hover:text-white text-xs px-4 py-3 rounded transition-colors">
              Cancel
            </button>
          </div>
        </div>
      </div>
    </Layout>
  );
}
