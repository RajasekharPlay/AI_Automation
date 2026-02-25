import { useRef, useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useTestRun } from '../hooks/useTestRun';
import Layout from '../components/Layout';

const BACKEND_URL = import.meta.env.VITE_BACKEND_URL || 'http://localhost:3001';

function proxyUrl(url) {
  return `${BACKEND_URL}/api/artifacts/proxy?url=${encodeURIComponent(url)}`;
}

function getArtifact(tc, type) {
  return (tc.artifacts || []).find(a => a.type === type);
}

// Step screenshot types, in navigation order
const STEP_SCREENSHOT_TYPES = [
  { type: 'screenshot_login',    label: 'After Login' },
  { type: 'screenshot_pet_zone', label: 'Pet Zone' },
  { type: 'screenshot_quote',    label: 'Quote Page' },
  { type: 'screenshot',          label: 'Final State' }
];

function getStepScreenshots(tc) {
  const artifacts = tc.artifacts || [];
  return STEP_SCREENSHOT_TYPES
    .map(s => ({ ...s, artifact: artifacts.find(a => a.type === s.type) }))
    .filter(s => s.artifact);
}

function fmtDuration(ms) {
  if (!ms) return '—';
  if (ms < 1000) return `${ms}ms`;
  return `${(ms / 1000).toFixed(1)}s`;
}

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

// ── Donut chart via CSS conic-gradient ──────────────────────────────────────
function DonutChart({ passed, failed, healed, total }) {
  const p = total > 0 ? (passed / total) * 100 : 0;
  const f = total > 0 ? (failed / total) * 100 : 0;
  const h = total > 0 ? (healed / total) * 100 : 0;
  const passRate = Math.round(((passed + healed) / Math.max(total, 1)) * 100);

  const gradient = `conic-gradient(
    #22c55e 0% ${p}%,
    #06b6d4 ${p}% ${p + h}%,
    #ef4444 ${p + h}% ${p + h + f}%,
    #1a3050 ${p + h + f}% 100%
  )`;

  return (
    <div className="flex flex-col items-center gap-3">
      <div style={{ width: 140, height: 140, borderRadius: '50%', background: gradient, position: 'relative' }}>
        <div style={{
          position: 'absolute', top: '50%', left: '50%',
          transform: 'translate(-50%,-50%)',
          width: 96, height: 96, borderRadius: '50%',
          background: '#0b1120',
          display: 'flex', flexDirection: 'column',
          alignItems: 'center', justifyContent: 'center'
        }}>
          <span style={{ color: '#fff', fontSize: 22, fontWeight: 700, lineHeight: 1 }}>{passRate}%</span>
          <span style={{ color: '#64748b', fontSize: 9, letterSpacing: 2 }}>PASS RATE</span>
        </div>
      </div>
      <div className="flex gap-4 text-xs">
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-green-500 inline-block" />Passed {passed}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-cyan-400 inline-block" />Healed {healed}</span>
        <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-red-500 inline-block" />Failed {failed}</span>
      </div>
    </div>
  );
}

// ── AI Actions Timeline ───────────────────────────────────────────────────────
const AI_ACTION_META = {
  script_generation: { icon: '🤖', label: 'Script Generation' },
  healing_attempt:   { icon: '⚡', label: 'Self-Healing' },
  failure_analysis:  { icon: '🔍', label: 'Failure Analysis' }
};

const AI_STATUS_STYLE = {
  started:     'text-yellow-400',
  completed:   'text-green-400',
  failed:      'text-red-400',
  no_fix_found:'text-slate-500'
};

function AiTimeline({ actions }) {
  if (!actions || actions.length === 0) {
    return <div className="text-xs text-slate-600 italic py-2">No AI actions recorded yet.</div>;
  }
  return (
    <div className="space-y-3">
      {actions.map((a, i) => {
        const meta = AI_ACTION_META[a.action] || { icon: '◈', label: a.action };
        return (
          <div key={i} className="flex gap-3 items-start">
            <div className="flex-shrink-0 w-6 text-center text-base leading-5 mt-0.5">{meta.icon}</div>
            <div className="flex-1 bg-[#060d1a] border border-[#1a3050] rounded p-3">
              <div className="flex items-center gap-2 mb-1">
                <span className="text-xs text-slate-300 font-semibold">{meta.label}</span>
                <span className={`text-xs ${AI_STATUS_STYLE[a.status] || 'text-slate-400'}`}>{a.status}</span>
                {a.timestamp && (
                  <span className="text-xs text-slate-600 ml-auto">{new Date(a.timestamp).toLocaleTimeString()}</span>
                )}
              </div>
              {/* Input details */}
              {a.input && (
                <div className="text-xs text-slate-500">
                  {a.input.testCaseName && <span>Case: {a.input.testCaseName} </span>}
                  {a.input.stepCount !== undefined && <span>• {a.input.stepCount} steps </span>}
                  {a.input.url && <span>• {a.input.url}</span>}
                  {a.input.error && <div className="text-red-400 mt-0.5 font-mono truncate">Error: {a.input.error}</div>}
                </div>
              )}
              {/* Output details */}
              {a.output && (
                <div className="text-xs mt-1">
                  {a.output.reason && <div className="text-cyan-400">Reason: {a.output.reason}</div>}
                  {a.output.scriptLength && <div className="text-slate-400">Generated {a.output.scriptLength} chars</div>}
                  {a.output.newSelector && <div className="text-green-400 font-mono truncate">Selector: {a.output.newSelector}</div>}
                </div>
              )}
              {a.error && <div className="text-xs text-red-400 mt-1 font-mono">{a.error}</div>}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ── Execution Log ─────────────────────────────────────────────────────────────
const EXEC_ICON = {
  execution_started:    '▶',
  script_executing:     '⚙',
  execution_completed:  '✓',
  execution_failed:     '✗',
  screenshot_captured:  '📸',
  screenshot_failed:    '⚠',
  trace_captured:       '🔍',
  trace_failed:         '⚠',
  healing_applied:      '⚡',
  healing_no_fix:       '—',
  healing_error:        '✗'
};

function ExecutionLog({ log }) {
  if (!log || log.length === 0) {
    return <div className="text-xs text-slate-600 italic py-2">No execution steps recorded yet.</div>;
  }
  return (
    <div className="space-y-1 font-mono text-xs">
      {log.map((entry, i) => {
        const isBad = entry.event?.includes('failed') || entry.event?.includes('error');
        const isGood = entry.event?.includes('completed') || entry.event?.includes('captured') || entry.event?.includes('applied');
        return (
          <div key={i} className="flex gap-3 items-start py-0.5">
            <span className="text-slate-600 flex-shrink-0 w-20">
              {entry.timestamp ? new Date(entry.timestamp).toLocaleTimeString() : '—'}
            </span>
            <span className="flex-shrink-0 text-slate-500">{EXEC_ICON[entry.event] || '•'}</span>
            <span className={`flex-1 ${isBad ? 'text-red-400' : isGood ? 'text-green-400' : 'text-slate-300'}`}>
              {(entry.event || '').replace(/_/g, ' ')}
              {entry.error && <span className="text-red-400"> — {entry.error.substring(0, 120)}</span>}
              {entry.durationMs && <span className="text-slate-500"> ({entry.durationMs}ms)</span>}
              {entry.device && <span className="text-slate-600"> • {entry.device}</span>}
              {entry.reason && <span className="text-cyan-400"> • {entry.reason}</span>}
            </span>
          </div>
        );
      })}
    </div>
  );
}

// ── Screenshot modal ─────────────────────────────────────────────────────────
function ScreenshotModal({ url, onClose }) {
  return (
    <div
      className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div className="relative max-w-5xl w-full" onClick={e => e.stopPropagation()}>
        <button onClick={onClose} className="absolute -top-8 right-0 text-slate-400 hover:text-white text-sm">✕ Close</button>
        <img src={url} alt="Screenshot" className="w-full rounded border border-[#1a3050]" />
      </div>
    </div>
  );
}

export default function RunDetail() {
  const { runId } = useParams();
  const navigate = useNavigate();
  const { run, testCases, loading, logs } = useTestRun(runId);
  const [activeTab, setActiveTab] = useState('workflow');
  const [selectedCase, setSelectedCase] = useState(null);
  const [copiedScript, setCopiedScript] = useState(false);
  const [modalImg, setModalImg] = useState(null);
  const [expandedCase, setExpandedCase] = useState(null);
  const terminalRef = useRef();

  useEffect(() => {
    if (terminalRef.current) terminalRef.current.scrollTop = terminalRef.current.scrollHeight;
  }, [logs]);

  // Auto-select first test case when switching to script tab
  useEffect(() => {
    if (activeTab === 'script' && !selectedCase && testCases.length > 0) {
      setSelectedCase(testCases[0]);
    }
  }, [activeTab, testCases, selectedCase]);

  // Keep selected case in sync with real-time updates
  useEffect(() => {
    if (selectedCase) {
      const updated = testCases.find(tc => tc.id === selectedCase.id);
      if (updated) setSelectedCase(updated);
    }
  }, [testCases]);

  function copyScript() {
    if (selectedCase?.script) {
      navigator.clipboard.writeText(selectedCase.script);
      setCopiedScript(true);
      setTimeout(() => setCopiedScript(false), 2000);
    }
  }

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

  const passed = testCases.filter(t => t.status === 'passed').length;
  const healed = testCases.filter(t => t.status === 'healed').length;
  const failed = testCases.filter(t => t.status === 'failed').length;
  const pending = testCases.filter(t => t.status === 'pending' || t.status === 'running').length;
  const totalDuration = testCases.reduce((sum, tc) => sum + (tc.duration_ms || 0), 0);
  const maxDuration = Math.max(...testCases.map(tc => tc.duration_ms || 0), 1);

  const isFailed = run.status === 'failed';
  const phase = run.run_phase || run.status;

  const workflowSteps = [
    { n: 1, title: 'Upload Test Cases', desc: 'Received structured test definitions', done: true, failed: false },
    { n: 2, title: 'Parse to JSON', desc: 'Validated and normalized test cases', done: true, failed: false },
    { n: 3, title: 'Claude → Generate Scripts', desc: 'AI generated Playwright scripts',
      done: !['pending', 'creating'].includes(phase),
      failed: isFailed && ['creating', 'generating'].includes(phase) },
    { n: 4, title: 'Trigger GitHub Actions', desc: 'Dispatched workflow_dispatch event',
      done: ['running', 'completed', 'failed'].includes(run.status),
      failed: isFailed && phase === 'triggering' },
    { n: 5, title: 'Execute Playwright', desc: 'Running tests in Chromium headless',
      done: ['completed', 'failed'].includes(run.status),
      failed: isFailed && ['running'].includes(phase) },
    { n: 6, title: 'Capture Artifacts', desc: 'Screenshots, traces, logs to R2',
      done: run.status === 'completed',
      failed: false },
    { n: 7, title: 'Self-Healing Agent', desc: `Claude healed ${run.healed || 0} failing selectors`,
      done: run.status === 'completed',
      failed: false },
    { n: 8, title: 'Results Ready', desc: 'Stream complete — artifacts stored',
      done: run.status === 'completed',
      failed: false }
  ];

  const tabs = ['workflow', 'script', 'results', 'allure', 'terminal'];

  return (
    <Layout>
      {modalImg && <ScreenshotModal url={modalImg} onClose={() => setModalImg(null)} />}

      {/* Run info bar */}
      <div className="border-b border-[#1a3050] px-6 py-2 flex items-center justify-between bg-[#060d1a]">
        <div className="flex items-center gap-3">
          <button onClick={() => navigate('/runs')} className="text-slate-400 hover:text-white text-xs transition-colors">← Runs</button>
          <span className="text-slate-600">|</span>
          <span className="text-xs text-white font-medium">{run.name}</span>
        </div>
        <div className="flex items-center gap-2 text-xs">
          <span className={`w-2 h-2 rounded-full inline-block ${
            run.status === 'running' || run.status === 'generating' ? 'bg-yellow-400 animate-pulse'
            : run.status === 'completed' ? 'bg-green-400'
            : run.status === 'failed' ? 'bg-red-400'
            : 'bg-slate-400'
          }`} />
          <span className="tracking-wider text-slate-300">{run.status?.toUpperCase()}</span>
        </div>
      </div>

      <div className="flex flex-1 overflow-hidden">
        {/* Left sidebar */}
        <div className="w-72 border-r border-[#1a3050] overflow-y-auto flex-shrink-0">
          <div className="p-4 border-b border-[#1a3050]">
            <div className="text-xs text-slate-400 tracking-wider mb-1">TEST CASES</div>
            <div className="flex gap-3 text-xs mt-2">
              <span className="text-green-400">✓ {passed + healed}</span>
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
                  {tc.status === 'healed' && <span className="text-cyan-400 text-xs">⚡</span>}
                </div>
                {tc.status === 'running' && (
                  <div className="mt-1.5 h-0.5 bg-[#1a3050] rounded overflow-hidden">
                    <div className="h-full bg-yellow-400 rounded animate-pulse w-2/3" />
                  </div>
                )}
                {tc.duration_ms && (
                  <div className="text-slate-600 mt-1">{fmtDuration(tc.duration_ms)}</div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Main content */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Tabs */}
          <div className="border-b border-[#1a3050] flex px-4">
            {tabs.map(tab => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-4 py-3 text-xs tracking-widest transition-colors border-b-2 ${
                  activeTab === tab
                    ? 'border-cyan-400 text-cyan-400'
                    : 'border-transparent text-slate-500 hover:text-slate-300'
                }`}
              >
                {tab === 'allure' ? '📊 ALLURE' : tab.toUpperCase()}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-6">

            {/* ── WORKFLOW ─────────────────────────────────────────────────── */}
            {activeTab === 'workflow' && (
              <div className="max-w-2xl">
                <h3 className="text-xs text-slate-400 tracking-wider mb-6">EXECUTION WORKFLOW</h3>

                {/* Failure banner */}
                {isFailed && (
                  <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-lg p-4">
                    <div className="text-xs text-red-400 font-bold tracking-wider mb-2">RUN FAILED</div>
                    {testCases.length === 0 ? (
                      <div className="text-xs text-red-300">
                        No test cases were found in the database when GitHub Actions ran.
                        This usually means script generation failed before the runner was triggered.
                        <br /><span className="text-slate-500 mt-1 block">Try creating a new run — the database schema is now up to date.</span>
                      </div>
                    ) : (
                      <div className="space-y-1">
                        {testCases.filter(tc => tc.status === 'failed').map(tc => (
                          <div key={tc.id} className="text-xs text-red-300 font-mono">
                            ✗ {tc.name}{tc.error ? ` — ${tc.error}` : ''}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                <div className="space-y-4">
                  {workflowSteps.map(step => (
                    <div key={step.n} className="flex gap-4 items-start">
                      <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${
                        step.failed ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : step.done  ? 'bg-cyan-500/20 text-cyan-400 border border-cyan-500/40'
                        : 'bg-[#1a3050] text-slate-500 border border-[#2a4070]'
                      }`}>
                        {step.failed ? '✗' : step.done ? '✓' : step.n}
                      </div>
                      <div className="flex-1 pb-4 border-b border-[#1a3050] last:border-0">
                        <div className={`text-sm font-medium ${step.failed ? 'text-red-400' : step.done ? 'text-white' : 'text-slate-500'}`}>
                          {step.title}
                        </div>
                        <div className="text-xs text-slate-500 mt-0.5">{step.desc}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── SCRIPT ───────────────────────────────────────────────────── */}
            {activeTab === 'script' && (
              <div>
                <div className="flex items-center justify-between mb-4">
                  <h3 className="text-xs text-slate-400 tracking-wider">
                    {selectedCase ? `SCRIPT — ${selectedCase.name}` : 'AI GENERATED SCRIPTS'}
                  </h3>
                  {selectedCase?.script && (
                    <button
                      onClick={copyScript}
                      className={`text-xs px-3 py-1.5 rounded border transition-colors ${
                        copiedScript
                          ? 'border-green-500/50 text-green-400 bg-green-500/10'
                          : 'border-[#1a3050] text-slate-400 hover:text-white hover:border-slate-500'
                      }`}
                    >
                      {copiedScript ? '✓ Copied!' : '⎘ Copy Script'}
                    </button>
                  )}
                </div>

                {/* Test case selector if multiple */}
                {testCases.length > 1 && (
                  <div className="flex gap-2 mb-4 flex-wrap">
                    {testCases.map(tc => (
                      <button
                        key={tc.id}
                        onClick={() => setSelectedCase(tc)}
                        className={`text-xs px-3 py-1 rounded border transition-colors ${
                          selectedCase?.id === tc.id
                            ? 'border-cyan-500/50 text-cyan-400 bg-cyan-500/10'
                            : 'border-[#1a3050] text-slate-500 hover:text-slate-300'
                        }`}
                      >
                        <span className={STATUS_COLOR[tc.status]}>{STATUS_ICON[tc.status]}</span>
                        <span className="ml-1 truncate max-w-[120px] inline-block align-bottom">{tc.name}</span>
                      </button>
                    ))}
                  </div>
                )}

                {selectedCase ? (
                  <div>
                    {selectedCase.status === 'healed' && (
                      <div className="mb-3 bg-cyan-500/10 border border-cyan-500/30 rounded p-3 text-xs text-cyan-400">
                        ⚡ HEALED — {selectedCase.heal_reason}
                      </div>
                    )}

                    {/* Script info bar */}
                    <div className="flex items-center gap-4 mb-2 text-xs text-slate-500">
                      <span>Status: <span className={STATUS_COLOR[selectedCase.status]}>{selectedCase.status.toUpperCase()}</span></span>
                      {selectedCase.duration_ms && <span>Duration: {fmtDuration(selectedCase.duration_ms)}</span>}
                      <span>Lines: {(selectedCase.script || '').split('\n').length}</span>
                    </div>

                    {/* Code block with line numbers */}
                    <div className="bg-[#0b1120] border border-[#1a3050] rounded overflow-hidden">
                      <div className="flex items-center justify-between px-4 py-2 border-b border-[#1a3050] bg-[#060d1a]">
                        <span className="text-xs text-slate-500 font-mono">playwright • javascript</span>
                        <span className="text-xs text-slate-600">AI Generated by Claude Opus</span>
                      </div>
                      <div className="overflow-x-auto">
                        <table className="w-full text-xs font-mono leading-relaxed">
                          <tbody>
                            {(selectedCase.script || 'No script generated').split('\n').map((line, i) => (
                              <tr key={i} className="hover:bg-white/5">
                                <td className="pl-4 pr-3 py-0 text-right text-slate-600 select-none w-10 border-r border-[#1a3050]">{i + 1}</td>
                                <td className="px-4 py-0 text-green-300 whitespace-pre">{line}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    </div>

                    {selectedCase.error && (
                      <div className="mt-3 bg-red-500/10 border border-red-500/30 rounded p-3 text-xs text-red-400 font-mono">
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

            {/* ── RESULTS ──────────────────────────────────────────────────── */}
            {activeTab === 'results' && (
              <div>
                <h3 className="text-xs text-slate-400 tracking-wider mb-6">TEST RESULTS</h3>

                {/* Summary cards */}
                <div className="grid grid-cols-4 gap-4 mb-6">
                  {[
                    { label: 'TOTAL', value: testCases.length, color: 'text-slate-300' },
                    { label: 'PASSED', value: passed + healed, color: 'text-green-400' },
                    { label: 'FAILED', value: failed, color: 'text-red-400' },
                    { label: 'HEALED', value: healed, color: 'text-cyan-400' }
                  ].map(card => (
                    <div key={card.label} className="bg-[#0b1120] border border-[#1a3050] rounded p-4 text-center">
                      <div className={`text-2xl font-bold ${card.color}`}>{card.value}</div>
                      <div className="text-xs text-slate-500 tracking-wider mt-1">{card.label}</div>
                    </div>
                  ))}
                </div>

                {/* Test case results with artifacts */}
                <div className="space-y-3">
                  {testCases.map(tc => {
                    const screenshot = getArtifact(tc, 'screenshot');
                    const trace = getArtifact(tc, 'trace');
                    const screenshotProxyUrl = screenshot ? proxyUrl(screenshot.url) : null;

                    return (
                      <div
                        key={tc.id}
                        className={`bg-[#0b1120] border rounded overflow-hidden ${
                          tc.status === 'failed' ? 'border-red-500/30' :
                          tc.status === 'healed' ? 'border-cyan-500/30' :
                          tc.status === 'passed' ? 'border-green-500/20' :
                          'border-[#1a3050]'
                        }`}
                      >
                        {/* Header row */}
                        <div className="p-4">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-3">
                              <span className={`text-lg ${STATUS_COLOR[tc.status]}`}>{STATUS_ICON[tc.status]}</span>
                              <div>
                                <div className="text-sm text-white">{tc.name}</div>
                                {tc.duration_ms && <div className="text-xs text-slate-500 mt-0.5">{fmtDuration(tc.duration_ms)}</div>}
                              </div>
                            </div>
                            <div className="flex items-center gap-2">
                              {tc.status === 'healed' && (
                                <span className="text-xs text-cyan-400 bg-cyan-400/10 px-2 py-0.5 rounded">⚡ HEALED</span>
                              )}
                              <span className={`text-xs tracking-wider ${STATUS_COLOR[tc.status]}`}>{tc.status.toUpperCase()}</span>
                            </div>
                          </div>

                          {/* Error message */}
                          {tc.error && (
                            <div className="mt-2 text-xs text-red-400 font-mono bg-red-500/5 p-2 rounded">
                              {tc.error}
                            </div>
                          )}

                          {/* Artifact buttons */}
                          {(screenshot || trace) && (
                            <div className="flex items-center gap-2 mt-3">
                              {screenshot && (
                                <button
                                  onClick={() => setModalImg(screenshotProxyUrl)}
                                  className="text-xs px-3 py-1.5 rounded border border-[#1a3050] text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1"
                                >
                                  📸 View Screenshot
                                </button>
                              )}
                              {trace && (
                                <a
                                  href={`https://trace.playwright.dev/?trace=${encodeURIComponent(proxyUrl(trace.url))}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-xs px-3 py-1.5 rounded border border-[#1a3050] text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1"
                                >
                                  🔍 View Trace
                                </a>
                              )}
                              {trace && (
                                <a
                                  href={proxyUrl(trace.url)}
                                  download="trace.zip"
                                  className="text-xs px-3 py-1.5 rounded border border-[#1a3050] text-slate-400 hover:text-white hover:border-slate-500 transition-colors flex items-center gap-1"
                                >
                                  ⬇ Download Trace
                                </a>
                              )}
                            </div>
                          )}
                        </div>

                        {/* Step screenshots gallery — shown for all statuses */}
                        {(() => {
                          const steps = getStepScreenshots(tc);
                          if (steps.length === 0) return null;
                          return (
                            <div className="border-t border-[#1a3050] p-3">
                              <div className="text-xs text-slate-500 tracking-wider mb-2">
                                PROCESS SCREENSHOTS ({steps.length})
                                {trace && (
                                  <a
                                    href={`https://trace.playwright.dev/?trace=${encodeURIComponent(proxyUrl(trace.url))}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="ml-3 text-cyan-500 hover:text-cyan-300"
                                  >
                                    View full trace for all steps →
                                  </a>
                                )}
                              </div>
                              <div className="grid grid-cols-4 gap-2">
                                {steps.map(s => (
                                  <div
                                    key={s.type}
                                    className="relative cursor-pointer group"
                                    onClick={() => setModalImg(proxyUrl(s.artifact.url))}
                                  >
                                    <img
                                      src={proxyUrl(s.artifact.url)}
                                      alt={s.label}
                                      className="w-full h-24 object-cover object-top rounded border border-[#1a3050] group-hover:border-cyan-500/50 transition-colors"
                                    />
                                    <div className="absolute bottom-0 inset-x-0 bg-black/70 text-xs text-center py-0.5 rounded-b text-slate-300 group-hover:text-white">
                                      {s.label}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            </div>
                          );
                        })()}
                      </div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* ── ALLURE ───────────────────────────────────────────────────── */}
            {activeTab === 'allure' && (
              <div>
                {/* Allure-style header */}
                <div className="flex items-center justify-between mb-6">
                  <div>
                    <h3 className="text-white font-bold text-lg">Allure Report</h3>
                    <p className="text-xs text-slate-500 mt-0.5">{run.name} • {new Date(run.created_at).toLocaleString()}</p>
                  </div>
                  <div className={`text-xs px-3 py-1.5 rounded-full font-medium ${
                    run.status === 'completed' && failed === 0
                      ? 'bg-green-500/20 text-green-400 border border-green-500/30'
                      : run.status === 'completed'
                      ? 'bg-red-500/20 text-red-400 border border-red-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border border-yellow-500/30'
                  }`}>
                    {run.status === 'completed' ? (failed === 0 ? '✓ All Passed' : `${failed} Failed`) : run.status.toUpperCase()}
                  </div>
                </div>

                {/* AI Activity banner */}
                {(() => {
                  const allActions = testCases.flatMap(tc => tc.ai_actions || []);
                  const scriptsGenerated = allActions.filter(a => a.action === 'script_generation' && a.status === 'completed').length;
                  const healAttempts = allActions.filter(a => a.action === 'healing_attempt').length;
                  const healSuccess = allActions.filter(a => a.action === 'healing_attempt' && a.status === 'completed').length;
                  const totalActions = allActions.length;
                  if (totalActions === 0) return null;
                  return (
                    <div className="bg-blue-500/5 border border-blue-500/20 rounded p-4 mb-6 flex items-center gap-6">
                      <div className="text-blue-400 text-lg">🤖</div>
                      <div className="flex-1 grid grid-cols-4 gap-4 text-center">
                        {[
                          { label: 'Total AI Calls', value: totalActions, color: 'text-blue-400' },
                          { label: 'Scripts Generated', value: scriptsGenerated, color: 'text-slate-300' },
                          { label: 'Heal Attempts', value: healAttempts, color: 'text-yellow-400' },
                          { label: 'Successful Heals', value: healSuccess, color: 'text-cyan-400' }
                        ].map(s => (
                          <div key={s.label}>
                            <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
                            <div className="text-xs text-slate-500 mt-0.5">{s.label}</div>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })()}

                {/* Overview row */}
                <div className="grid grid-cols-3 gap-4 mb-6">
                  {/* Donut chart */}
                  <div className="col-span-1 bg-[#0b1120] border border-[#1a3050] rounded p-6 flex flex-col items-center justify-center">
                    <div className="text-xs text-slate-400 tracking-wider mb-4">OVERVIEW</div>
                    <DonutChart passed={passed} failed={failed} healed={healed} total={testCases.length} />
                  </div>

                  {/* Stats */}
                  <div className="col-span-2 bg-[#0b1120] border border-[#1a3050] rounded p-6">
                    <div className="text-xs text-slate-400 tracking-wider mb-4">STATISTICS</div>
                    <div className="grid grid-cols-2 gap-4">
                      {[
                        { label: 'Total Tests', value: testCases.length, color: '#94a3b8' },
                        { label: 'Passed', value: passed + healed, color: '#22c55e' },
                        { label: 'Failed', value: failed, color: '#ef4444' },
                        { label: 'Self-Healed', value: healed, color: '#06b6d4' },
                        { label: 'Total Duration', value: fmtDuration(totalDuration), color: '#94a3b8' },
                        { label: 'Avg Duration', value: fmtDuration(testCases.length ? Math.round(totalDuration / testCases.length) : 0), color: '#94a3b8' },
                      ].map(s => (
                        <div key={s.label} className="flex items-center justify-between py-1.5 border-b border-[#1a3050] last:border-0">
                          <span className="text-xs text-slate-500">{s.label}</span>
                          <span className="text-sm font-bold" style={{ color: s.color }}>{s.value}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Duration chart */}
                {testCases.some(tc => tc.duration_ms) && (
                  <div className="bg-[#0b1120] border border-[#1a3050] rounded p-6 mb-6">
                    <div className="text-xs text-slate-400 tracking-wider mb-4">DURATION BREAKDOWN</div>
                    <div className="space-y-3">
                      {testCases.filter(tc => tc.duration_ms).map(tc => (
                        <div key={tc.id} className="flex items-center gap-3">
                          <div className="text-xs text-slate-400 w-48 truncate" title={tc.name}>{tc.name}</div>
                          <div className="flex-1 bg-[#1a3050] rounded-full h-3 overflow-hidden">
                            <div
                              className={`h-full rounded-full transition-all ${
                                tc.status === 'failed' ? 'bg-red-500' :
                                tc.status === 'healed' ? 'bg-cyan-500' : 'bg-green-500'
                              }`}
                              style={{ width: `${(tc.duration_ms / maxDuration) * 100}%` }}
                            />
                          </div>
                          <div className="text-xs text-slate-400 w-16 text-right">{fmtDuration(tc.duration_ms)}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Test Suites table */}
                <div className="bg-[#0b1120] border border-[#1a3050] rounded overflow-hidden mb-6">
                  <div className="px-4 py-3 border-b border-[#1a3050] flex items-center justify-between">
                    <span className="text-xs text-slate-400 tracking-wider">TEST SUITES</span>
                    <span className="text-xs text-slate-600">{testCases.length} tests</span>
                  </div>
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-[#1a3050] text-slate-500 text-left">
                        <th className="px-4 py-2">Status</th>
                        <th className="px-4 py-2">Test Name</th>
                        <th className="px-4 py-2">Duration</th>
                        <th className="px-4 py-2">Artifacts</th>
                        <th className="px-4 py-2">Details</th>
                      </tr>
                    </thead>
                    <tbody>
                      {testCases.map(tc => {
                        const screenshot = getArtifact(tc, 'screenshot');
                        const trace = getArtifact(tc, 'trace');
                        return (
                          <tr
                            key={tc.id}
                            className="border-b border-[#1a3050] last:border-0 hover:bg-white/5 cursor-pointer"
                            onClick={() => setExpandedCase(expandedCase === tc.id ? null : tc.id)}
                          >
                            <td className="px-4 py-3">
                              <span className={`font-bold ${STATUS_COLOR[tc.status]}`}>{STATUS_ICON[tc.status]}</span>
                            </td>
                            <td className="px-4 py-3 text-slate-200">{tc.name}</td>
                            <td className="px-4 py-3 text-slate-400">{fmtDuration(tc.duration_ms)}</td>
                            <td className="px-4 py-3">
                              <div className="flex gap-2">
                                {screenshot && <span className="text-slate-500">📸</span>}
                                {trace && <span className="text-slate-500">🔍</span>}
                              </div>
                            </td>
                            <td className="px-4 py-3 text-slate-600">{expandedCase === tc.id ? '▲' : '▼'}</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>

                {/* Expanded test case detail */}
                {expandedCase && (() => {
                  const tc = testCases.find(t => t.id === expandedCase);
                  if (!tc) return null;
                  const screenshot = getArtifact(tc, 'screenshot');
                  const trace = getArtifact(tc, 'trace');
                  return (
                    <div className="bg-[#0b1120] border border-[#1a3050] rounded p-6 mb-4">
                      <div className="flex items-start justify-between mb-4">
                        <div>
                          <div className={`text-sm font-bold ${STATUS_COLOR[tc.status]}`}>
                            {STATUS_ICON[tc.status]} {tc.name}
                          </div>
                          <div className="text-xs text-slate-500 mt-1">Duration: {fmtDuration(tc.duration_ms)}</div>
                        </div>
                        <button onClick={() => { setSelectedCase(tc); setActiveTab('script'); }} className="text-xs text-cyan-400 hover:underline">
                          View Script →
                        </button>
                      </div>

                      {tc.error && (
                        <div className="bg-red-500/10 border border-red-500/30 rounded p-3 mb-4">
                          <div className="text-xs text-red-400 font-bold mb-1">FAILURE REASON</div>
                          <div className="text-xs text-red-300 font-mono">{tc.error}</div>
                        </div>
                      )}

                      {tc.heal_reason && (
                        <div className="bg-cyan-500/10 border border-cyan-500/30 rounded p-3 mb-4">
                          <div className="text-xs text-cyan-400 font-bold mb-1">⚡ SELF-HEALING</div>
                          <div className="text-xs text-cyan-300">{tc.heal_reason}</div>
                        </div>
                      )}

                      <div className="flex gap-3 flex-wrap">
                        {screenshot && (
                          <button
                            onClick={() => setModalImg(proxyUrl(screenshot.url))}
                            className="text-xs px-3 py-1.5 rounded border border-[#1a3050] text-slate-400 hover:text-white transition-colors"
                          >
                            📸 View Screenshot
                          </button>
                        )}
                        {trace && (
                          <>
                            <a
                              href={`https://trace.playwright.dev/?trace=${encodeURIComponent(proxyUrl(trace.url))}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-xs px-3 py-1.5 rounded border border-[#1a3050] text-slate-400 hover:text-white transition-colors"
                            >
                              🔍 Open Trace Viewer
                            </a>
                            <a
                              href={proxyUrl(trace.url)}
                              download="trace.zip"
                              className="text-xs px-3 py-1.5 rounded border border-[#1a3050] text-slate-400 hover:text-white transition-colors"
                            >
                              ⬇ Download trace.zip
                            </a>
                          </>
                        )}
                      </div>

                      {screenshot && (
                        <div className="mt-4 cursor-pointer" onClick={() => setModalImg(proxyUrl(screenshot.url))}>
                          <div className="text-xs text-slate-500 mb-2">FAILURE SCREENSHOT</div>
                          <img
                            src={proxyUrl(screenshot.url)}
                            alt="Test screenshot"
                            className="rounded border border-[#1a3050] max-h-64 object-cover object-top hover:opacity-90 transition-opacity"
                          />
                        </div>
                      )}

                      {/* AI Actions Timeline */}
                      {tc.ai_actions && tc.ai_actions.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs text-slate-400 tracking-wider font-bold mb-3">🤖 WHAT THE MODEL DID</div>
                          <AiTimeline actions={tc.ai_actions} />
                        </div>
                      )}

                      {/* Execution Log */}
                      {tc.execution_log && tc.execution_log.length > 0 && (
                        <div className="mt-4">
                          <div className="text-xs text-slate-400 tracking-wider font-bold mb-3">⚙ EXECUTION STEPS</div>
                          <div className="bg-[#020609] border border-[#1a3050] rounded p-3">
                            <ExecutionLog log={tc.execution_log} />
                          </div>
                        </div>
                      )}
                    </div>
                  );
                })()}

                {/* Failures summary */}
                {failed > 0 && (
                  <div className="bg-red-500/5 border border-red-500/20 rounded p-6">
                    <div className="text-xs text-red-400 tracking-wider font-bold mb-4">FAILURES ({failed})</div>
                    <div className="space-y-3">
                      {testCases.filter(tc => tc.status === 'failed').map(tc => (
                        <div key={tc.id} className="border-l-2 border-red-500/50 pl-3">
                          <div className="text-sm text-white">{tc.name}</div>
                          <div className="text-xs text-red-400 font-mono mt-1">{tc.error || 'No error message'}</div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* ── TERMINAL ─────────────────────────────────────────────────── */}
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
                  <div className="text-slate-600"><span className="blink">█</span></div>
                </div>
              </div>
            )}

          </div>
        </div>
      </div>
    </Layout>
  );
}
