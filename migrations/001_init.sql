-- ============================================================
-- Core schema for AI Agent Workflow Builder
-- ============================================================

create extension if not exists "uuid-ossp";

create table organizations (
  id uuid primary key default uuid_generate_v4(),
  name text not null,
  quota_limit int not null default 100,
  quota_used int not null default 0,
  quota_period_start date not null default date_trunc('month', now()),
  created_at timestamptz not null default now()
);

create type member_role as enum ('owner', 'editor', 'viewer');

create table org_members (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null, -- references auth.users(id) from nhost auth
  role member_role not null default 'viewer',
  created_at timestamptz not null default now(),
  unique (org_id, user_id)
);

create table workflows (
  id uuid primary key default uuid_generate_v4(),
  org_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  created_by uuid not null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create type step_type as enum (
  'llm_call', 'http_request', 'db_write', 'notify', 'conditional_branch', 'approval_gate'
);

create table workflow_steps (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  step_order int not null,
  type step_type not null,
  config jsonb not null default '{}'::jsonb,
  -- for conditional_branch: config.on_true_step_order / config.on_false_step_order
  created_at timestamptz not null default now(),
  unique (workflow_id, step_order)
);

create type trigger_type as enum ('manual', 'webhook', 'scheduled', 'db_event');

create table workflow_triggers (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  type trigger_type not null,
  config jsonb not null default '{}'::jsonb, -- e.g. { "cron": "*/10 * * * *" } or { "watch_table": "leads" }
  created_at timestamptz not null default now()
);

create type run_status as enum ('running', 'paused', 'completed', 'failed');

create table workflow_runs (
  id uuid primary key default uuid_generate_v4(),
  workflow_id uuid not null references workflows(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  status run_status not null default 'running',
  triggered_by uuid, -- user id, null if webhook/scheduled/db_event
  trigger_type trigger_type not null default 'manual',
  current_step_order int not null default 0,
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  error text
);

create type step_run_status as enum ('pending', 'running', 'paused', 'completed', 'failed');

create table step_runs (
  id uuid primary key default uuid_generate_v4(),
  workflow_run_id uuid not null references workflow_runs(id) on delete cascade,
  step_id uuid not null references workflow_steps(id) on delete cascade,
  status step_run_status not null default 'pending',
  input jsonb,
  output jsonb,
  error text,
  attempt_count int not null default 0,
  approved_by uuid,
  approved_at timestamptz,
  started_at timestamptz,
  completed_at timestamptz
);

create table db_write_results (
  id uuid primary key default uuid_generate_v4(),
  step_run_id uuid not null references step_runs(id) on delete cascade,
  data jsonb not null,
  created_at timestamptz not null default now()
);

create table notifications (
  id uuid primary key default uuid_generate_v4(),
  step_run_id uuid not null references step_runs(id) on delete cascade,
  org_id uuid not null references organizations(id) on delete cascade,
  channel text not null default 'slack',
  message text not null,
  sent boolean not null default false,
  created_at timestamptz not null default now()
);

-- ============================================================
-- Aggregation: org usage this month (required "one aggregation")
-- ============================================================
create view org_usage_this_month as
select
  o.id as org_id,
  o.quota_limit,
  o.quota_used,
  count(wr.id) filter (where wr.started_at >= date_trunc('month', now())) as runs_this_month,
  avg(extract(epoch from (wr.completed_at - wr.started_at)))
    filter (where wr.completed_at is not null and wr.started_at >= date_trunc('month', now())) as avg_run_duration_seconds
from organizations o
left join workflow_runs wr on wr.org_id = o.id
group by o.id, o.quota_limit, o.quota_used;

-- indexes
create index idx_org_members_org on org_members(org_id);
create index idx_org_members_user on org_members(user_id);
create index idx_workflows_org on workflows(org_id);
create index idx_steps_workflow on workflow_steps(workflow_id, step_order);
create index idx_runs_workflow on workflow_runs(workflow_id);
create index idx_runs_org on workflow_runs(org_id);
create index idx_step_runs_run on step_runs(workflow_run_id);