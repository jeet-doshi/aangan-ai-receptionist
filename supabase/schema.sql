-- Aangan AI Receptionist: run once in Supabase -> SQL Editor.
-- All access is server-side with the secret key; RLS is enabled with no policies,
-- so the public (anon/publishable) key cannot read call records.

create table if not exists public.calls (
  id uuid primary key,
  created_at timestamptz not null default now(),
  source text not null check (source in ('demo_seed', 'simulated', 'vaani')),
  is_demo boolean not null default true,
  reference text,
  transcript text,

  -- caller & project
  caller_name text,
  caller_phone text,
  caller_type text not null check (caller_type in ('new_enquiry', 'existing_client')),
  project_type text not null,
  area_sqft double precision,
  location text,
  timeline_kind text not null check (timeline_kind in ('flexible', 'deadline', 'unknown')),
  deadline_weeks double precision,
  timeline_text text,
  budget_text text,
  budget_inr double precision,
  decision_maker text not null,
  pricing_asked boolean not null default false,
  urgent_human_request boolean not null default false,
  notes text,
  duration_sec double precision,

  -- qualification
  outcome text not null check (outcome in ('qualified', 'unqualified', 'needs_follow_up', 'needs_human_review')),
  escalation_required boolean not null default false,
  escalation_reason text,
  criteria jsonb not null default '[]'::jsonb,
  follow_up_question text,
  timeline_conflict boolean not null default false,
  agent_response text not null,
  summary text not null,
  handoff_note text,

  -- costs
  voice_cost_inr double precision,
  ai_cost_inr double precision,
  cost_estimated boolean not null default true,

  -- handoff
  handoff_status text not null check (handoff_status in ('not_required', 'sent', 'failed', 'demo_not_configured')),
  handoff_detail text,
  handoff_message text,
  handoff_at timestamptz
);

create index if not exists calls_created_at_idx on public.calls (created_at desc);
create index if not exists calls_outcome_idx on public.calls (outcome);

alter table public.calls enable row level security;
