import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';

const API = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

// Persistent session ID per browser
function getSessionId() {
  let id = localStorage.getItem('rexon_chat_session');
  if (!id) { id = 'sess_' + Math.random().toString(36).slice(2); localStorage.setItem('rexon_chat_session', id); }
  return id;
}

const INTENT_ICONS = {
  create_test: '✦',
  modify_test: '✎',
  run_test: '▶',
  analyze_failure: '⚡',
  list_tests: '◈',
  generate_plan: '⬡',
  crawl_dom: '⌖',
  suggest_fix: '⟳',
  general_query: '◎',
  small_talk: '◎',
};

const SUGGESTIONS = [
  'List all test cases',
  'Run all failed tests',
  'Create a login test',
  'Why did the last run fail?',
  'Generate test plan for a URL',
];

export default function ChatPanel({ open, onClose, projectId, context }) {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId] = useState(getSessionId);
  const bottomRef = useRef(null);

  // Load history on open
  useEffect(() => {
    if (!open) return;
    axios.get(`${API}/api/chat/history/${sessionId}`)
      .then(r => setMessages(r.data || []))
      .catch(() => {});
  }, [open, sessionId]);

  // Auto-scroll
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  async function sendMessage(text) {
    const msg = (text || input).trim();
    if (!msg) return;
    setInput('');
    const userMsg = { role: 'user', content: msg, created_at: new Date().toISOString() };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);
    try {
      const { data } = await axios.post(`${API}/api/chat`, {
        message: msg,
        session_id: sessionId,
        project_id: projectId,
        context: context || {}
      });
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: data.reply,
        intent: data.intent,
        action: data.action,
        created_at: new Date().toISOString()
      }]);
    } catch (e) {
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `Error: ${e.response?.data?.error || e.message}`,
        created_at: new Date().toISOString()
      }]);
    }
    setLoading(false);
  }

  function clearHistory() {
    axios.delete(`${API}/api/chat/history/${sessionId}`).catch(() => {});
    setMessages([]);
  }

  if (!open) return null;

  return (
    <div className="fixed top-0 right-0 h-full w-[380px] bg-[#080f1e] border-l border-[#1a3050] flex flex-col z-50 shadow-2xl">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-[#1a3050]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 bg-blue-600 rounded flex items-center justify-center text-xs font-bold">AI</div>
          <div>
            <div className="text-xs font-bold text-white tracking-wider">REXON AI</div>
            <div className="text-[10px] text-slate-500">QA Automation Assistant</div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button onClick={clearHistory} className="text-slate-500 hover:text-slate-300 text-xs px-2 py-1 rounded hover:bg-[#1a3050] transition-colors" title="Clear history">
            ⌫
          </button>
          <button onClick={onClose} className="text-slate-500 hover:text-white text-lg leading-none">✕</button>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8">
            <div className="text-3xl mb-3">💬</div>
            <div className="text-slate-400 text-sm mb-2">Ask REXON AI anything</div>
            <div className="text-slate-500 text-xs mb-4">Generate tests · Run tests · Analyze failures</div>
            <div className="space-y-2">
              {SUGGESTIONS.map(s => (
                <button key={s} onClick={() => sendMessage(s)}
                  className="w-full text-left text-xs text-slate-400 hover:text-white px-3 py-2 rounded border border-[#1a3050] hover:border-blue-600 hover:bg-[#0d1929] transition-all">
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m, i) => (
          <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            <div className={`max-w-[90%] rounded-lg px-3 py-2 text-xs leading-relaxed
              ${m.role === 'user'
                ? 'bg-blue-600 text-white'
                : 'bg-[#0d1929] border border-[#1a3050] text-slate-200'}`}>
              {m.role === 'assistant' && m.intent && m.intent !== 'small_talk' && (
                <div className="flex items-center gap-1 mb-1.5 text-[10px] text-cyan-400 font-mono">
                  <span>{INTENT_ICONS[m.intent] || '◎'}</span>
                  <span>{m.intent.replace(/_/g, ' ').toUpperCase()}</span>
                </div>
              )}
              <MarkdownText text={m.content} />
              {m.action?.type === 'run_test' && m.action.runId && (
                <a href={`/run/${m.action.runId}`}
                  className="mt-2 flex items-center gap-1 text-blue-400 hover:text-blue-300 font-mono text-[10px]">
                  ▶ View Run →
                </a>
              )}
            </div>
          </div>
        ))}

        {loading && (
          <div className="flex justify-start">
            <div className="bg-[#0d1929] border border-[#1a3050] rounded-lg px-4 py-3">
              <div className="flex gap-1.5 items-center">
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 bg-blue-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="border-t border-[#1a3050] p-3">
        <div className="flex gap-2">
          <input
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendMessage(); } }}
            placeholder="Ask anything about your tests..."
            className="flex-1 bg-[#0d1929] border border-[#1a3050] text-white text-xs px-3 py-2.5 rounded outline-none focus:border-blue-600 transition-colors placeholder-slate-500"
          />
          <button onClick={() => sendMessage()} disabled={loading || !input.trim()}
            className="bg-blue-600 hover:bg-blue-500 disabled:opacity-40 text-white text-xs px-3 py-2.5 rounded transition-colors">
            ↑
          </button>
        </div>
        <div className="text-[10px] text-slate-600 mt-1.5 text-center">
          Context-aware · Knows your project · Never stores passwords
        </div>
      </div>
    </div>
  );
}

// Minimal markdown renderer (bold, code, links, newlines)
function MarkdownText({ text }) {
  if (!text) return null;
  const lines = text.split('\n');
  return (
    <div className="space-y-1">
      {lines.map((line, i) => {
        if (!line.trim()) return <br key={i} />;
        // Bold: **text**
        const parts = line.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
        return (
          <div key={i}>
            {parts.map((p, j) => {
              if (p.startsWith('**') && p.endsWith('**'))
                return <strong key={j} className="text-white">{p.slice(2, -2)}</strong>;
              if (p.startsWith('`') && p.endsWith('`'))
                return <code key={j} className="bg-[#1a3050] text-cyan-300 px-1 rounded font-mono text-[10px]">{p.slice(1, -1)}</code>;
              return <span key={j}>{p}</span>;
            })}
          </div>
        );
      })}
    </div>
  );
}
