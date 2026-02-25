-- ============================================================
-- REXON Full Migration — Paste this entire file in Supabase SQL Editor
-- Covers: schema-updates.sql + schema-v2.sql
-- Safe to run multiple times (all statements use IF NOT EXISTS / IF EXISTS)
-- ============================================================

-- ── PART 1: Column additions to existing tables ──────────────────────────────

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS run_phase text DEFAULT 'pending';

ALTER TABLE test_cases
  ADD COLUMN IF NOT EXISTS run_phase      text  DEFAULT 'pending',
  ADD COLUMN IF NOT EXISTS execution_log  jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS ai_actions     jsonb DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS test_plan_json jsonb;

CREATE INDEX IF NOT EXISTS idx_test_cases_run_phase ON test_cases(run_phase);
CREATE INDEX IF NOT EXISTS idx_test_runs_run_phase  ON test_runs(run_phase);


-- ── PART 2: New v2 tables ────────────────────────────────────────────────────

-- Projects
CREATE TABLE IF NOT EXISTS projects (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  description text,
  owner_id    text,
  created_at  timestamptz DEFAULT now(),
  updated_at  timestamptz DEFAULT now()
);

-- Credentials (stored encrypted, never sent to LLM)
CREATE TABLE IF NOT EXISTS credentials (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  name         text NOT NULL,
  base_url     text NOT NULL,
  username_enc text,
  password_enc text,
  otp_field    text,
  env_type     text DEFAULT 'dev',
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now()
);

-- DOM Snapshots
CREATE TABLE IF NOT EXISTS dom_snapshots (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES projects(id) ON DELETE CASCADE,
  domain       text NOT NULL,
  dom_map_json jsonb NOT NULL DEFAULT '{}',
  page_count   int DEFAULT 0,
  created_at   timestamptz DEFAULT now()
);

-- Standalone Testcases (persistent, re-runnable)
CREATE TABLE IF NOT EXISTS testcases (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id      uuid REFERENCES projects(id) ON DELETE CASCADE,
  name            text NOT NULL,
  description     text,
  test_plan_json  jsonb,
  dom_snapshot_id uuid REFERENCES dom_snapshots(id) ON DELETE SET NULL,
  credential_id   uuid REFERENCES credentials(id) ON DELETE SET NULL,
  status          text DEFAULT 'idle',
  pass_rate       numeric(5,2) DEFAULT 0,
  last_run_at     timestamptz,
  run_count       int DEFAULT 0,
  created_at      timestamptz DEFAULT now(),
  updated_at      timestamptz DEFAULT now()
);

-- Run Steps (per test case execution step)
CREATE TABLE IF NOT EXISTS run_steps (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  run_id         uuid REFERENCES test_runs(id) ON DELETE CASCADE,
  test_case_id   uuid REFERENCES test_cases(id) ON DELETE CASCADE,
  step_index     int NOT NULL,
  action         text,
  selector       text,
  value          text,
  status         text DEFAULT 'pending',
  screenshot_url text,
  error_message  text,
  duration_ms    int,
  created_at     timestamptz DEFAULT now()
);

-- Chat Messages
CREATE TABLE IF NOT EXISTS chat_messages (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id   text NOT NULL,
  project_id   uuid,
  role         text NOT NULL,
  content      text NOT NULL,
  intent       text,
  action_taken jsonb,
  created_at   timestamptz DEFAULT now()
);


-- ── PART 3: New columns on test_runs ─────────────────────────────────────────

ALTER TABLE test_runs
  ADD COLUMN IF NOT EXISTS testcase_id   uuid REFERENCES testcases(id)   ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS credential_id uuid REFERENCES credentials(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS project_id    uuid REFERENCES projects(id)    ON DELETE SET NULL;


-- ── PART 4: Enable Realtime (safe — skips already-added tables) ──────────────

DO $$
DECLARE
  tbls text[] := ARRAY['projects','credentials','dom_snapshots','testcases','chat_messages','run_steps'];
  t text;
BEGIN
  FOREACH t IN ARRAY tbls LOOP
    BEGIN
      EXECUTE format('ALTER PUBLICATION supabase_realtime ADD TABLE %I', t);
    EXCEPTION WHEN duplicate_object THEN
      -- already a member, skip
    END;
  END LOOP;
END $$;
