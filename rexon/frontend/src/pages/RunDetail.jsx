import React, { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTestRun } from '../hooks/useTestRun';

const STATUS_COLOR = {
  pending: 'text-slate-400',
  running: 'text-yellow-400',
  passed: 'text-green-400',
  failed: 'text-red-400',
  healed: 'text-cyan-400'
};

const STATUS_ICON = {
  pending: '○',
  running: '◎',
  passed: '✓',
  failed: '✗',
  healed: '⚡'
};

export default function RunDetail() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { run, testCases, loading, logs } = useTestRun(runId);
  const [activeTab, setActiveTab] = useState('workflow');
  const [selectedCase, setSelectedCase] = useState(null);
  const terminalRef = useRef();

  // Auto-scroll terminal
  useEffect(() => {
    if (terminalRef.current) {
      terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
    }
  }, [logs]);

  if (loading) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex items-center justify-center">
        <div className="text-cyan-400 text-sm tracking-wider animate-pulse">LOADING RUN...</div>
      </div>
    );
  }

  if (!run) {
    return (
      <div className="min-h-screen bg-[#060d1a] flex flex-col items-center justify-center gap-4">
        <div className="text-red-400">Run not found</div>
        <button onClick={() => navigate('/')} className="text-xs text-slate-400 hover:text-white">← Back</button>
      </div>
    );
  }

  const passed = testCases.filter(t => t.status === 'passed' || t.status === 'healed').length;
  const failed = testCases.filter(t => t.status === 'failed').length;
  const pending = testCases.filter(t => t.status === 'pending' || t.status === 'running').length;

  const workflowSteps = [
    { n: 1, title: 'Upload Test Cases', desc: 'Received structured test definitions', done: true },
    { n: 2, title: 'Parse to JSON', desc: 'Validated and normalized test cases', done: true },
    { n: 3, title: 'Claude → Generate Scripts', desc: 'AI generated Playwright scripts', done: run.status !== 'pending' },
    { n: 4, title: 'Trigger GitHub Actions', desc: 'Dispatched workflow_dispatch event', done: ['running', 'completed', 'failed'].includes(run.status) },
    { n: 5, title: 'Execute Playwright', desc: 'Running tests in Chromium headless', done: ['completed', 'failed'].includes(run.status) },
    { n: 6, title: 'Capture Artifacts', desc: 'Screenshots, traces, logs to R2', done: run.status === 'completed' },
    { n: 7, title: 'Self-Healing Agent', desc: `Claude healed ${run.healed || 0} failing selectors`, done: run.status === 'completed' },
    { n: 8, title: 'Results Ready', desc: 'Stream complete — artifacts stored', done: run.status === 'completed' }
  ];

  return (
    <div className="min-h-screen bg-[#060d1a] text-slate-200 flex flex-col">
      {/* Header */}
      <header className="border-b border-[#1a3050] px-6 py-3 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button onClick={() => navigate('/')} className="text-slate-400 hover:text-white text-xs transition-colors">← BACK</button>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-blue-600 rounded flex items-center justify-center font-bold text-white text-sm">R</div>
            <div>
              <div className="font-bold text-white text-xs tracking-widest">REXON</div>
              <div className="text-xs text-slate-500">{run.name}</div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full inline-block ${run.status === 'running' ? 'bg-yellow-400 animate-pulse' : run.status === 'completed' ? 'bg-green-400' : 'bg-red-400'}`}></span>
          <span className="tracking-wider text-slate-300">{run.status.toUpperCase()}</span>
        </div>
      </header>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar — test cases */}
        <div className="w-72 border-r border-[#1a3050] overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-[#1a3050]">
            <div className="text-xs text-slate-400 tracking-wider mb-1">TEST CASES</div>
            <div className="flex gap-3 text-xs mt-2">
              <span className="text-green-400">✓ {passed}</span>
              <span className="text-red-400">✗ {failed}</span>
              <span className="text-slate-400">⟳ {pending}</span>
              <span className="text-slate-500">/ {testCases.length}</span>
            </div>
          </div>
          <div className="p-2">
            {testCases.map(tc => (
              <div
                key={tc.id}
                onClick={() => setSelectedCase(tc)}
                className={`p-3 rounded mb-1 cursor-pointer text-xs transition-colors ${selectedCase?.id === tc.id ? 'bg-[#112136]' : 'hover:bg-[#0d1929]'}`}
              >
                <div className="flex items-center gap-2">
                  <span className={STATUS_COLOR[tc.status]}>{STATUS_ICON[tc.status]}</span>
                  <span className="text-slate-300 truncate flex-1">{tc.name}</span>
                  {tc.healed && <span className="text-cyan-400 text-xs">⚡</span>}
                </div>
                {tc.status === 'running' && (
                  <div className="mt-1.5 h-0.5 bg-[#1a3050] rounded overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded animate-pulse w-2/3" />
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-[#1a3050] flex px-4">
            {['workflow', 'script', 'results', 'terminal'].map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs tracking-widest transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">
            {/* WORKFLOW TAB */}
            {activeTab === 'workflow' && (
              <div className="max-w-2xl">
                <h3 className="text-xs text-slate-400 tracking-wider mb-6">EXECUTION WORKFLOW</h3>
                <div className="space-y-4">
                  {workflowSteps.map((step, i) => (
                    <div key={step.n} className="flex gap-4 items-start">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        step.done ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40' : 'bg-[#1a3050] text-slate-500 border border-[#2a4070]'
                      }`}>
                        {step.done ? '✓' : step.n}
                      </div>
                      <div className="flex-1 pb-4 border-b border-[#1a3050] last:border-0">
                        <div className={`text-sm font-medium ${step.done ? 'text-white' : 'text-slate-500'}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* SCRIPT TAB */}
            {activeTab === 'script' && (
              <div>
                <h3 className="text-xs text-slate-400 tracking-wider mb-4">
                  {selectedCase ? `SCRIPT — ${selectedCase.name}` : 'SELECT A TEST CASE TO VIEW SCRIPT'}
                </h3>
                {selectedCase ? (
                  <div>
                    {selectedCase.healed && (
                      <div className="mb-3 bg-cyan-500/10 border border-cyan-500/30 rounded p-3 text-xs text-cyan-400">
                        ⚡ HEALED — {selectedCase.heal_reason}
                      </div>
                    )}
                    <pre className="bg-[#0b1120] border border-[#1a3050] rounded p-4 text-xs text-green-300 overflow-x-auto font-mono leading-relaxed">
                      {selectedCase.script || 'No script generated'}
                    </pre>
                    {selectedCase.error && (
                      <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded p-3 text-xs text-red-400">
                        ❌ ERROR: {selectedCase.error}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-12 text-slate-600 text-sm">
                    Click a test case in the sidebar to view its generated script
                  </div>
                )}
              </div>
            )}

            {/* RESULTS TAB */}
            {activeTab === 'results' && (
              <div>
                <h3 className="text-xs text-slate-400 tracking-wider mb-6">TEST RESULTS</h3>

                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'TOTAL', value: testCases.length, color: 'text-slate-300' },
                    { label: 'PASSED', value: passed, color: 'text-green-400' },
                    { label: 'FAILED', value: failed, color: 'text-red-400' },
                    { label: 'HEALED', value: run.healed || 0, color: 'text-cyan-400' }
                  ].map(card => (
                    <div key={card.label} className="bg-[#0b1120] border border-[#1a3050] rounded p-4 text-center">
                      <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                      <div className="text-xs text-slate-500 tracking-wider mt-1">{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Test case list */}
                <div className="space-y-2">
                  {testCases.map(tc => (
                    <div
                      key={tc.id}
                      className={`bg-[#0b1120] border rounded p-4 ${
                        tc.status === 'failed' ? 'border-red-500/30' :
                        tc.status === 'healed' ? 'border-cyan-500/30' :
                        tc.status === 'passed' ? 'border-green-500/20' :
                        'border-[#1a3050]'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          <span className={`text-lg ${STATUS_COLOR[tc.status]}`}>{STATUS_ICON[tc.status]}</span>
                          <div>
                            <div className="text-sm text-white">{tc.name}</div>
                            {tc.duration_ms && (
                              <div className="text-xs text-slate-500 mt-0.5">{tc.duration_ms}ms</div>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {tc.healed && (
                            <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">⚡ HEALED</span>
                          )}
                          <span className={`text-xs tracking-wider ${STATUS_COLOR[tc.status]}`}>
                            {tc.status.toUpperCase()}
                          </span>
                        </div>
                      </div>
                      {tc.error && (
                        <div className="mt-2 text-xs text-red-400 font-mono bg-red-500/5 p-2 rounded">
                          {tc.error}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TERMINAL TAB */}
            {activeTab === 'terminal' && (
              <div>
                <h3 className="text-xs text-slate-400 tracking-wider mb-4">AGENT TERMINAL — EXECUTION LOG</h3>
                <div
                  ref={terminalRef}
                  className="bg-[#020609] border border-[#1a3050] rounded p-4 h-96 overflow-y-auto font-mono text-xs"
                >
                  {logs.length === 0 ? (
                    <span className="text-slate-600">Waiting for events...<span className="blink">_</span></span>
                  ) : (
                    logs.map((log, i) => (
                      <div key={i} className="mb-1">
                        <span className="text-slate-600">{log.time}</span>
                        <span className="text-green-300 ml-2">{log.msg}</span>
                      </div>
                    ))
                  )}
                  <div className="text-slate-600">
                    <span className="blink">█</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
