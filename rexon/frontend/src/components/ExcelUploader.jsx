import React, { useState, useRef, useCallback } from 'react';
import { parseExcelToTestCases, validateTestCases, generateExcelTemplate } from '../lib/excelParser';

const ACTION_COLORS = {
  navigate: 'text-blue-400',
  click: 'text-yellow-400',
  fill: 'text-green-400',
  type: 'text-green-400',
  expect: 'text-cyan-400',
  wait: 'text-purple-400',
  select: 'text-orange-400',
  hover: 'text-pink-400',
  screenshot: 'text-slate-400'
};

export default function ExcelUploader({ onTestCasesParsed }) {
  const [dragging, setDragging] = useState(false);
  const [parsing, setParsing] = useState(false);
  const [error, setError] = useState('');
  const [warnings, setWarnings] = useState([]);
  const [parsedCases, setParsedCases] = useState(null);
  const [fileName, setFileName] = useState('');
  const [expandedCase, setExpandedCase] = useState(null);
  const [jsonView, setJsonView] = useState(false);
  const fileRef = useRef();

  const processFile = useCallback(async (file) => {
    if (!file) return;
    const validTypes = [
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-excel',
      'text/csv'
    ];
    const isValid = validTypes.includes(file.type) ||
      file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv');

    if (!isValid) {
      setError('Please upload an Excel (.xlsx, .xls) or CSV file');
      return;
    }

    setParsing(true);
    setError('');
    setWarnings([]);
    setParsedCases(null);
    setFileName(file.name);

    try {
      const testCases = await parseExcelToTestCases(file);
      const warns = validateTestCases(testCases);
      setWarnings(warns);
      setParsedCases(testCases);
      setExpandedCase(testCases[0]?.name || null);
    } catch (err) {
      setError(err.message);
    } finally {
      setParsing(false);
    }
  }, []);

  const handleDrop = useCallback((e) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    processFile(file);
  }, [processFile]);

  const handleFileInput = (e) => processFile(e.target.files[0]);

  const totalSteps = parsedCases?.reduce((sum, tc) => sum + tc.steps.length, 0) || 0;

  return (
    <div className="space-y-4">
      {/* Drop zone */}
      {!parsedCases && (
        <div
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          onClick={() => fileRef.current.click()}
          className={`border-2 border-dashed rounded-lg p-8 text-center cursor-pointer transition-all ${
            dragging
              ? 'border-cyan-400 bg-cyan-400/5'
              : 'border-[#1a3050] hover:border-[#2a5080] hover:bg-[#0d1929]'
          }`}
        >
          <input
            ref={fileRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            onChange={handleFileInput}
            className="hidden"
          />
          {parsing ? (
            <div className="text-cyan-400 text-sm animate-pulse">
              <div className="text-2xl mb-2">⚙</div>
              Parsing Excel file...
            </div>
          ) : (
            <>
              <div className="text-3xl mb-3">📊</div>
              <div className="text-white text-sm font-medium mb-1">
                Drop your Excel file here
              </div>
              <div className="text-slate-400 text-xs">
                Supports .xlsx, .xls, .csv
              </div>
              <div className="mt-4 flex items-center justify-center gap-3">
                <span className="text-xs text-slate-500">or</span>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); generateExcelTemplate(); }}
                className="mt-3 text-xs text-cyan-400 hover:text-cyan-300 underline underline-offset-2"
              >
                ↓ Download Excel template
              </button>
            </>
          )}
        </div>
      )}

      {/* Error */}
      {error && (
        <div className="bg-red-500/10 border border-red-500/40 rounded p-3 text-red-400 text-xs">
          ❌ {error}
          <button onClick={() => setError('')} className="ml-2 text-red-300 hover:text-white">✕</button>
        </div>
      )}

      {/* Warnings */}
      {warnings.length > 0 && (
        <div className="bg-yellow-500/10 border border-yellow-500/40 rounded p-3 text-yellow-400 text-xs space-y-1">
          <div className="font-bold mb-1">⚠ Warnings ({warnings.length})</div>
          {warnings.map((w, i) => <div key={i}>• {w}</div>)}
        </div>
      )}

      {/* Parsed preview */}
      {parsedCases && (
        <div className="space-y-3">
          {/* Header bar */}
          <div className="flex items-center justify-between bg-[#0b1120] border border-[#1a3050] rounded p-3">
            <div className="flex items-center gap-3">
              <span className="text-green-400">✓</span>
              <span className="text-white text-sm font-medium">{fileName}</span>
              <span className="text-slate-400 text-xs">parsed successfully</span>
            </div>
            <div className="flex items-center gap-4 text-xs">
              <span className="text-cyan-400">{parsedCases.length} tests</span>
              <span className="text-slate-400">{totalSteps} steps</span>
              <button
                onClick={() => { setParsedCases(null); setFileName(''); setWarnings([]); setError(''); }}
                className="text-slate-500 hover:text-white transition-colors"
              >
                ✕ Clear
              </button>
            </div>
          </div>

          {/* Toggle JSON / Visual */}
          <div className="flex gap-2">
            <button
              onClick={() => setJsonView(false)}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${!jsonView ? 'bg-[#1a3050] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              🗂 Visual Preview
            </button>
            <button
              onClick={() => setJsonView(true)}
              className={`text-xs px-3 py-1.5 rounded transition-colors ${jsonView ? 'bg-[#1a3050] text-white' : 'text-slate-400 hover:text-white'}`}
            >
              { } JSON Preview
            </button>
          </div>

          {/* JSON view */}
          {jsonView ? (
            <pre className="bg-[#020609] border border-[#1a3050] rounded p-4 text-xs text-green-300 font-mono overflow-x-auto max-h-80 overflow-y-auto">
              {JSON.stringify(parsedCases, null, 2)}
            </pre>
          ) : (
            /* Visual card view */
            <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
              {parsedCases.map((tc, i) => (
                <div
                  key={i}
                  className="bg-[#0b1120] border border-[#1a3050] rounded overflow-hidden"
                >
                  <button
                    className="w-full flex items-center justify-between p-3 hover:bg-[#0d1929] transition-colors text-left"
                    onClick={() => setExpandedCase(expandedCase === tc.name ? null : tc.name)}
                  >
                    <div className="flex items-center gap-3">
                      <span className="text-cyan-400 text-xs font-mono w-5 text-right">{i + 1}</span>
                      <span className="text-white text-sm">{tc.name}</span>
                      {tc.url && (
                        <span className="text-slate-500 text-xs truncate max-w-40">{tc.url}</span>
                      )}
                    </div>
                    <div className="flex items-center gap-2 text-xs">
                      <span className="text-slate-400">{tc.steps.length} steps</span>
                      <span className="text-slate-500">{expandedCase === tc.name ? '▲' : '▼'}</span>
                    </div>
                  </button>

                  {expandedCase === tc.name && (
                    <div className="border-t border-[#1a3050] px-3 pb-3">
                      <div className="mt-2 space-y-1">
                        {tc.steps.map((step, j) => (
                          <div key={j} className="flex items-start gap-3 text-xs py-1 border-b border-[#0d1929] last:border-0">
                            <span className="text-slate-600 font-mono w-4 text-right flex-shrink-0">{j + 1}</span>
                            <span className={`font-mono w-16 flex-shrink-0 ${ACTION_COLORS[step.action] || 'text-slate-300'}`}>
                              {step.action}
                            </span>
                            {step.selector && (
                              <span className="text-yellow-200/70 font-mono truncate">{step.selector}</span>
                            )}
                            {step.value && (
                              <span className="text-green-300/70">"{step.value}"</span>
                            )}
                            {step.condition && (
                              <span className="text-purple-300/70">→ {step.condition}</span>
                            )}
                            {step.description && (
                              <span className="text-slate-500 italic">{step.description}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Confirm button */}
          <button
            onClick={() => onTestCasesParsed(parsedCases)}
            className="w-full bg-blue-600 hover:bg-blue-500 text-white text-xs py-3 rounded tracking-wider transition-colors font-medium"
          >
            ✓ USE THESE {parsedCases.length} TEST CASES → GENERATE SCRIPTS
          </button>
        </div>
      )}

      {/* Template format guide */}
      {!parsedCases && !parsing && (
        <div className="bg-[#0b1120] border border-[#1a3050] rounded p-4">
          <div className="text-xs text-slate-400 tracking-wider mb-3">EXPECTED EXCEL FORMAT</div>
          <div className="overflow-x-auto">
            <table className="text-xs w-full">
              <thead>
                <tr className="border-b border-[#1a3050]">
                  {['Test Name', 'URL', 'Action', 'Selector', 'Value', 'Condition', 'Description'].map(h => (
                    <th key={h} className="text-left text-cyan-400 pb-2 pr-4 font-mono">{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="text-slate-400">
                <tr className="border-b border-[#0d1929]">
                  <td className="py-1.5 pr-4 text-white">Login Test</td>
                  <td className="pr-4 text-blue-300 text-xs">https://app.com/login</td>
                  <td className="pr-4 text-blue-400">navigate</td>
                  <td className="pr-4"></td>
                  <td className="pr-4"></td>
                  <td className="pr-4"></td>
                  <td className="pr-4">Open login</td>
                </tr>
                <tr className="border-b border-[#0d1929]">
                  <td className="py-1.5 pr-4 text-white">Login Test</td>
                  <td className="pr-4"></td>
                  <td className="pr-4 text-green-400">fill</td>
                  <td className="pr-4 text-yellow-300">#email</td>
                  <td className="pr-4 text-green-300">user@test.com</td>
                  <td className="pr-4"></td>
                  <td className="pr-4">Enter email</td>
                </tr>
                <tr className="border-b border-[#0d1929]">
                  <td className="py-1.5 pr-4 text-white">Login Test</td>
                  <td className="pr-4"></td>
                  <td className="pr-4 text-yellow-400">click</td>
                  <td className="pr-4 text-yellow-300">button[type=submit]</td>
                  <td className="pr-4"></td>
                  <td className="pr-4"></td>
                  <td className="pr-4">Submit form</td>
                </tr>
                <tr>
                  <td className="py-1.5 pr-4 text-white">Login Test</td>
                  <td className="pr-4"></td>
                  <td className="pr-4 text-cyan-400">expect</td>
                  <td className="pr-4 text-yellow-300">.dashboard</td>
                  <td className="pr-4"></td>
                  <td className="pr-4 text-purple-300">visible</td>
                  <td className="pr-4">Check redirect</td>
                </tr>
              </tbody>
            </table>
          </div>
          <div className="mt-3 text-xs text-slate-500">
            💡 Same "Test Name" across rows = grouped as one test. URL only needed on the first row of each test.
          </div>
        </div>
      )}
    </div>
  );
}
