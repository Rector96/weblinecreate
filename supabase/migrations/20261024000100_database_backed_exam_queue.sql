create table if not exists public.exam_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete set null,
  requester_token_hash text,
  request_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending', 'processing', 'completed', 'failed')),
  generated_data jsonb,
  error_message text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);

create index if not exists exam_requests_queue_idx
  on public.exam_requests(status, created_at asc);
create index if not exists exam_requests_school_created_idx
  on public.exam_requests(school_id, created_at desc);

alter table public.exam_requests enable row level security;
revoke all on public.exam_requests from anon, authenticated, public;

create or replace function public.claim_next_exam_request()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.exam_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('rockcraft_exam_request_queue'));

  if exists (select 1 from public.exam_requests where status = 'processing') then
    return null;
  end if;

  select * into v_job
  from public.exam_requests
  where status = 'pending'
  order by created_at asc
  for update skip locked
  limit 1;

  if not found then
    return null;
  end if;

  update public.exam_requests
  set status = 'processing',
      attempts = attempts + 1,
      started_at = now(),
      updated_at = now()
  where id = v_job.id
  returning * into v_job;

  return to_jsonb(v_job);
end;
$$;

revoke all on function public.claim_next_exam_request() from public, anon, authenticated;
grant execute on function public.claim_next_exam_request() to service_role;
