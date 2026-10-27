-- Ensure the handwriting scan queue and AI issue log exist in the active public schema.
-- Deliberately avoid foreign keys to application-specific school/role tables so this migration
-- remains compatible with deployments whose school schema uses a different table name.
create table if not exists public.ai_operation_issues (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  request_id uuid not null default gen_random_uuid(),
  operation text not null default 'handwriting_scan',
  stage text not null default 'provider_request',
  severity text not null default 'error' check (severity in ('info','warning','error','critical')),
  status text not null default 'open' check (status in ('open','investigating','resolved')),
  school_id uuid,
  user_id uuid,
  provider text not null default 'gemini',
  model text,
  http_status integer,
  error_code text,
  error_message text not null default 'Unspecified AI operation error',
  attempt_count integer not null default 1,
  duration_ms integer,
  metadata jsonb not null default '{}'::jsonb,
  resolved_at timestamptz,
  resolution_notes text,
  ai_analysis text,
  ai_recommendation text,
  repair_status text not null default 'not_run',
  repair_attempted_at timestamptz,
  repair_metadata jsonb not null default '{}'::jsonb
);

alter table public.ai_operation_issues
  add column if not exists ai_analysis text,
  add column if not exists ai_recommendation text,
  add column if not exists repair_status text not null default 'not_run',
  add column if not exists repair_attempted_at timestamptz,
  add column if not exists repair_metadata jsonb not null default '{}'::jsonb;

create index if not exists ai_operation_issues_created_at_idx
  on public.ai_operation_issues(created_at desc);
create index if not exists ai_operation_issues_status_idx
  on public.ai_operation_issues(status, created_at desc);
create index if not exists ai_operation_issues_school_idx
  on public.ai_operation_issues(school_id, created_at desc);
create index if not exists ai_operation_issues_repair_status_idx
  on public.ai_operation_issues(repair_status, created_at desc);

alter table public.ai_operation_issues enable row level security;
revoke all on public.ai_operation_issues from anon, authenticated, public;
grant select, insert, update, delete on public.ai_operation_issues to service_role;

create table if not exists public.handwriting_scan_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null,
  teacher_id uuid,
  requester_token_hash text,
  request_payload jsonb not null default '{}'::jsonb,
  status text not null default 'pending'
    check (status in ('pending','processing','completed','failed')),
  result_data jsonb,
  error_message text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

alter table public.handwriting_scan_requests
  add column if not exists requester_token_hash text,
  add column if not exists request_payload jsonb not null default '{}'::jsonb,
  add column if not exists status text not null default 'pending',
  add column if not exists result_data jsonb,
  add column if not exists error_message text,
  add column if not exists attempts integer not null default 0,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists updated_at timestamptz not null default now(),
  add column if not exists started_at timestamptz,
  add column if not exists completed_at timestamptz;

create index if not exists handwriting_scan_queue_idx
  on public.handwriting_scan_requests(status, created_at asc);
create index if not exists handwriting_scan_school_idx
  on public.handwriting_scan_requests(school_id, created_at desc);

alter table public.handwriting_scan_requests enable row level security;
revoke all on public.handwriting_scan_requests from anon, authenticated, public;
grant select, insert, update, delete on public.handwriting_scan_requests to service_role;

create or replace function public.claim_next_handwriting_scan()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.handwriting_scan_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('rockcraft_handwriting_scan_queue'));

  update public.handwriting_scan_requests
  set status = 'pending', started_at = null, updated_at = now()
  where status = 'processing' and updated_at < now() - interval '8 minutes';

  if (select count(*) from public.handwriting_scan_requests where status = 'processing') >= 3 then
    return null;
  end if;

  select * into v_job
  from public.handwriting_scan_requests
  where status = 'pending' and attempts < 4
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.handwriting_scan_requests
  set status = 'processing', attempts = attempts + 1,
      started_at = now(), updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return to_jsonb(v_job);
end;
$$;

revoke all on function public.claim_next_handwriting_scan() from public, anon, authenticated;
grant execute on function public.claim_next_handwriting_scan() to service_role;

-- Ask PostgREST to refresh its schema cache after these objects are installed.
notify pgrst, 'reload schema';
