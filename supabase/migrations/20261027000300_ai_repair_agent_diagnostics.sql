alter table public.ai_operation_issues
  add column if not exists ai_analysis text,
  add column if not exists ai_recommendation text,
  add column if not exists repair_status text not null default 'not_run'
    check (repair_status in ('not_run','analyzed','auto_retried','needs_admin','resolved')),
  add column if not exists repair_attempted_at timestamptz,
  add column if not exists repair_metadata jsonb not null default '{}'::jsonb;

create index if not exists ai_operation_issues_repair_status_idx
  on public.ai_operation_issues(repair_status, created_at desc);
