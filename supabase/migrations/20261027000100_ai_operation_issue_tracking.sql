-- Durable, privacy-conscious diagnostics for AI failures.
create table if not exists public.ai_operation_issues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null default gen_random_uuid(),
  operation text not null default 'handwriting_scan',
  stage text not null default 'provider_request',
  severity text not null default 'error' check (severity in ('info','warning','error','critical')),
  status text not null default 'open' check (status in ('open','investigating','resolved')),
  school_id uuid null references public.schools(id) on delete set null,
  user_id uuid null,
  provider text not null default 'gemini',
  model text null,
  http_status integer null,
  error_code text null,
  error_message text not null,
  attempt_count integer not null default 1,
  duration_ms integer null,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz null,
  resolution_notes text null
);
create index if not exists ai_operation_issues_created_at_idx on public.ai_operation_issues(created_at desc);
create index if not exists ai_operation_issues_status_idx on public.ai_operation_issues(status, created_at desc);
create index if not exists ai_operation_issues_school_idx on public.ai_operation_issues(school_id, created_at desc);
alter table public.ai_operation_issues enable row level security;
revoke all on public.ai_operation_issues from anon, authenticated;
grant select, update on public.ai_operation_issues to authenticated;
drop policy if exists "Platform admins can read AI issues" on public.ai_operation_issues;
create policy "Platform admins can read AI issues" on public.ai_operation_issues
for select to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid() and ur.role = 'platform_admin'
));
drop policy if exists "Platform admins can update AI issues" on public.ai_operation_issues;
create policy "Platform admins can update AI issues" on public.ai_operation_issues
for update to authenticated
using (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid() and ur.role = 'platform_admin'
))
with check (exists (
  select 1 from public.user_roles ur
  where ur.user_id = auth.uid() and ur.role = 'platform_admin'
));
