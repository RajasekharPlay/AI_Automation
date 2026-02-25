import React, { useState, useEffect } from 'react';
import axios from 'axios';
import Layout from '../components/Layout';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

const ENV_COLORS = { dev: 'text-blue-400', staging: 'text-yellow-400', prod: 'text-red-400' };

function CredentialForm({ initial, onSave, onCancel }) {
  const [form, setForm] = useState(initial || { name: '', base_url: '', username: '', password: '', otp_field: '', env_type: 'dev' });
  const [saving, setSaving] = useState(false);
  const [showPass, setShowPass] = useState(false);

  function set(k, v) { setForm(prev => ({ ...prev, [k]: v })); }

  async function handleSubmit(e) {
    e.preventDefault();
    if (!form.name || !form.base_url) return;
    setSaving(true);
    await onSave(form);
    setSaving(false);
  }

  return (
    <form onSubmit={handleSubmit} className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-5 space-y-4">
      <h3 className="text-xs font-bold tracking-widest text-cyan-400">{initial?.id ? 'EDIT CREDENTIAL' : 'NEW CREDENTIAL'}</h3>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 tracking-wider block mb-1.5">NAME *</label>
          <input value={form.name} onChange={e => set('name', e.target.value)} required
            placeholder="e.g. Dev Environment"
            className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
        </div>
        <div>
          <label className="text-xs text-slate-400 tracking-wider block mb-1.5">ENVIRONMENT</label>
          <select value={form.env_type} onChange={e => set('env_type', e.target.value)}
            className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors">
            <option value="dev">Development</option>
            <option value="staging">Staging</option>
            <option value="prod">Production</option>
          </select>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 tracking-wider block mb-1.5">BASE URL *</label>
        <input value={form.base_url} onChange={e => set('base_url', e.target.value)} required
          placeholder="https://app.example.com"
          className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="text-xs text-slate-400 tracking-wider block mb-1.5">USERNAME / EMAIL</label>
          <input value={form.username} onChange={e => set('username', e.target.value)}
            placeholder="user@example.com"
            className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
        </div>
        <div>
          <label className="text-xs text-slate-400 tracking-wider block mb-1.5">PASSWORD</label>
          <div className="relative">
            <input type={showPass ? 'text' : 'password'} value={form.password} onChange={e => set('password', e.target.value)}
              placeholder={initial?.id ? 'Leave blank to keep current' : 'Enter password'}
              className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 pr-9 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
            <button type="button" onClick={() => setShowPass(s => !s)}
              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 text-xs">
              {showPass ? '🙈' : '👁'}
            </button>
          </div>
        </div>
      </div>

      <div>
        <label className="text-xs text-slate-400 tracking-wider block mb-1.5">OTP FIELD SELECTOR (optional)</label>
        <input value={form.otp_field} onChange={e => set('otp_field', e.target.value)}
          placeholder="e.g. input[name='otp']"
          className="w-full bg-[#060d1a] border border-[#1a3050] text-white px-3 py-2 rounded text-sm outline-none focus:border-cyan-500 transition-colors" />
      </div>

      <div className="text-xs text-slate-500 bg-[#060d1a] border border-[#1a3050] rounded p-3 flex items-start gap-2">
        <span className="text-green-400 mt-0.5">🔒</span>
        <span>Credentials are encrypted with AES-256-GCM before storing. Passwords are never sent to the AI model — only injected at execution time.</span>
      </div>

      <div className="flex gap-3 pt-1">
        <button type="submit" disabled={saving}
          className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-6 py-2 rounded tracking-wider transition-colors">
          {saving ? 'Saving...' : initial?.id ? 'Update' : 'Save Credential'}
        </button>
        <button type="button" onClick={onCancel}
          className="border border-[#1a3050] text-slate-400 hover:text-white text-xs px-4 py-2 rounded transition-colors">
          Cancel
        </button>
      </div>
    </form>
  );
}

export default function CredentialsManager() {
  const [creds, setCreds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);

  useEffect(() => { fetchCreds(); }, []);

  async function fetchCreds() {
    try {
      const { data } = await axios.get(`${API}/api/credentials`);
      setCreds(data || []);
    } catch (e) { console.error(e); }
    finally { setLoading(false); }
  }

  async function handleSave(form) {
    try {
      if (editing?.id) {
        const { data } = await axios.patch(`${API}/api/credentials/${editing.id}`, form);
        setCreds(prev => prev.map(c => c.id === data.id ? { ...c, ...data } : c));
      } else {
        const { data } = await axios.post(`${API}/api/credentials`, form);
        setCreds(prev => [data, ...prev]);
      }
      setShowForm(false);
      setEditing(null);
    } catch (e) { alert('Save failed: ' + (e.response?.data?.error || e.message)); }
  }

  async function handleDelete(id) {
    if (!confirm('Delete this credential?')) return;
    await axios.delete(`${API}/api/credentials/${id}`).catch(console.error);
    setCreds(prev => prev.filter(c => c.id !== id));
  }

  return (
    <Layout>
      <div className="max-w-4xl mx-auto p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-xl font-bold text-white tracking-wider">Credentials</h1>
            <p className="text-xs text-slate-500 mt-1">Encrypted · injected at runtime · never in scripts</p>
          </div>
          <button onClick={() => { setEditing(null); setShowForm(true); }}
            className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-4 py-2 rounded tracking-wider transition-colors">
            + ADD CREDENTIAL
          </button>
        </div>

        {(showForm || editing) && (
          <div className="mb-6">
            <CredentialForm initial={editing} onSave={handleSave} onCancel={() => { setShowForm(false); setEditing(null); }} />
          </div>
        )}

        {loading ? (
          <div className="text-center py-16 text-slate-500">Loading...</div>
        ) : creds.length === 0 && !showForm ? (
          <div className="text-center py-16 border border-dashed border-[#1a3050] rounded-lg">
            <div className="text-4xl mb-3">🔑</div>
            <div className="text-slate-400 text-sm mb-1">No credentials yet</div>
            <div className="text-slate-500 text-xs mb-4">Add credentials to run tests against authenticated apps</div>
            <button onClick={() => setShowForm(true)} className="bg-blue-600 hover:bg-blue-500 text-white text-xs px-5 py-2 rounded">
              + Add First Credential
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {creds.map(c => (
              <div key={c.id} className="bg-[#0b1120] border border-[#1a3050] rounded-lg p-4 flex items-center justify-between hover:border-[#2a4070] transition-all">
                <div className="flex items-center gap-4">
                  <div className="w-10 h-10 bg-[#1a3050] rounded-lg flex items-center justify-center text-lg">🔑</div>
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="text-white font-medium text-sm">{c.name}</span>
                      <span className={`text-[10px] uppercase tracking-wider font-bold ${ENV_COLORS[c.env_type] || 'text-slate-400'}`}>
                        {c.env_type}
                      </span>
                    </div>
                    <div className="text-xs text-slate-400 mt-0.5">{c.base_url}</div>
                    {c.username && (
                      <div className="text-xs text-slate-500 mt-0.5 flex items-center gap-2">
                        <span>👤 {c.username}</span>
                        <span>🔒 ••••••••</span>
                        {c.otp_field && <span>📱 OTP: {c.otp_field}</span>}
                      </div>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <button onClick={() => { setEditing(c); setShowForm(false); }}
                    className="text-xs text-slate-400 hover:text-white px-3 py-1.5 rounded border border-[#1a3050] hover:border-[#2a4070] transition-all">
                    Edit
                  </button>
                  <button onClick={() => handleDelete(c.id)}
                    className="text-slate-600 hover:text-red-400 text-xs w-7 text-center transition-colors">
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
