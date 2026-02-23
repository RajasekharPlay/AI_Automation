-- REXON Schema Updates — Run phase, execution logs, AI actions, test plan
-- Run this in the Supabase SQL editor

-- ── test_runs ──────────────────────────────────────────────────────────────
ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS run_phase text DEFAULT 'pending';

-- ── test_cases ─────────────────────────────────────────────────────────────
ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS run_phase     text    DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS execution_log jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_actions    jsonb   DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS test_plan_json jsonb;

-- Indexes for fast JSONB lookups (optional but useful at scale)
CREATE INDEX IF NOT EXISTS idx_test_cases_run_phase ON test_cases(run_phase);
CREATE INDEX IF NOT EXISTS idx_test_runs_run_phase  ON test_runs(run_phase);
