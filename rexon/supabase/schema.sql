-- Run this in your Supabase SQL editor

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- Test Runs table
create table if not exists test_runs (
  id uuid default gen_random_uuid() primary key,
  name text not null,
  status text default 'pending' check (status in ('pending','generating','running','completed','failed')),
  total int default 0,
  passed int default 0,
  failed int default 0,
  healed int default 0,
  created_at timestamptz default now(),
  completed_at timestamptz
);

-- Test Cases table
create table if not exists test_cases (
  id uuid default gen_random_uuid() primary key,
  run_id uuid references test_runs(id) on delete cascade,
  name text not null,
  status text default 'pending' check (status in ('pending','running','passed','failed','healed')),
  script text,
  original_script text,
  error text,
  heal_reason text,
  healed boolean default false,
  duration_ms int,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

-- Artifacts table
create table if not exists artifacts (
  id uuid default gen_random_uuid() primary key,
  test_case_id uuid references test_cases(id) on delete cascade,
  run_id uuid references test_runs(id) on delete cascade,
  type text check (type in ('screenshot','trace','log')),
  url text not null,
  created_at timestamptz default now()
);

-- Indexes
create index if not exists idx_test_cases_run_id on test_cases(run_id);
create index if not exists idx_artifacts_test_case_id on artifacts(test_case_id);
create index if not exists idx_test_runs_created on test_runs(created_at desc);

-- Enable Row Level Security (optional but recommended)
alter table test_runs enable row level security;
alter table test_cases enable row level security;
alter table artifacts enable row level security;

-- Allow all operations for anon key (adjust for production)
create policy "Allow all" on test_runs for all using (true);
create policy "Allow all" on test_cases for all using (true);
create policy "Allow all" on artifacts for all using (true);

-- Enable Realtime on test_cases and test_runs
alter publication supabase_realtime add table test_cases;
alter publication supabase_realtime add table test_runs;
