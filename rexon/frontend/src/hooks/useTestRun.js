import { useEffect, useState, useCallback } from 'react';
import { supabase } from '../lib/supabase';
import { getRun } from '../lib/api';

export function useTestRun(runId) {
  const [run, setRun] = useState(null);
  const [testCases, setTestCases] = useState([]);
  const [loading, setLoading] = useState(true);
  const [logs, setLogs] = useState([]);

  const addLog = useCallback((msg) => {
    setLogs(prev => [...prev, { time: new Date().toLocaleTimeString(), msg }]);
  }, []);

  useEffect(() => {
    if (!runId) return;

    // Initial fetch
    getRun(runId).then(data => {
      setRun(data);
      setTestCases(data.testCases || []);
      setLoading(false);
      addLog(`Loaded run: ${data.name}`);
    }).catch(err => {
      addLog(`Error loading run: ${err.message}`);
      setLoading(false);
    });

    // Subscribe to test_cases changes
    const tcChannel = supabase
      .channel(`tc-${runId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'test_cases',
        filter: `run_id=eq.${runId}`
      }, (payload) => {
        const updated = payload.new;
        setTestCases(prev =>
          prev.map(tc => tc.id === updated.id ? { ...tc, ...updated } : tc)
        );
        addLog(`[${updated.name}] → ${updated.status.toUpperCase()}${updated.healed ? ' (HEALED)' : ''}`);
      })
      .subscribe();

    // Subscribe to test_runs changes
    const runChannel = supabase
      .channel(`run-${runId}`)
      .on('postgres_changes', {
        event: 'UPDATE',
        schema: 'public',
        table: 'test_runs',
        filter: `id=eq.${runId}`
      }, (payload) => {
        setRun(prev => ({ ...prev, ...payload.new }));
        if (payload.new.status === 'completed') {
          addLog(`✅ Run completed — Passed: ${payload.new.passed} | Failed: ${payload.new.failed}`);
        }
      })
      .subscribe();

    return () => {
      supabase.removeChannel(tcChannel);
      supabase.removeChannel(runChannel);
    };
  }, [runId]);

  return { run, testCases, loading, logs };
}
