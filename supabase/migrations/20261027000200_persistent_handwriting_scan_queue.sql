-- Durable handwriting queue with bounded parallel workers and lease-based recovery.
create table if not exists public.handwriting_scan_requests (
  id uuid primary key default gen_random_uuid(),
  school_id uuid not null references public.schools(id) on delete cascade,
  teacher_id uuid references auth.users(id) on delete set null,
  requester_token_hash text,
  request_payload jsonb not null,
  status text not null default 'pending' check (status in ('pending','processing','completed','failed')),
  result_data jsonb,
  error_message text,
  attempts integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  started_at timestamptz,
  completed_at timestamptz
);
create index if not exists handwriting_scan_queue_idx on public.handwriting_scan_requests(status, created_at asc);
create index if not exists handwriting_scan_school_idx on public.handwriting_scan_requests(school_id, created_at desc);
alter table public.handwriting_scan_requests enable row level security;
revoke all on public.handwriting_scan_requests from anon, authenticated, public;
grant select, insert, update, delete on public.handwriting_scan_requests to service_role;

create or replace function public.claim_next_handwriting_scan()
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_job public.handwriting_scan_requests%rowtype;
begin
  perform pg_advisory_xact_lock(hashtext('rockcraft_handwriting_scan_queue'));
  update public.handwriting_scan_requests
    set status = 'pending', started_at = null, updated_at = now()
    where status = 'processing' and updated_at < now() - interval '8 minutes';
  if (select count(*) from public.handwriting_scan_requests where status = 'processing') >= 3 then
    return null;
  end if;
  select * into v_job from public.handwriting_scan_requests
    where status = 'pending' and attempts < 4
    order by created_at asc for update skip locked limit 1;
  if not found then return null; end if;
  update public.handwriting_scan_requests set status = 'processing', attempts = attempts + 1,
    started_at = now(), updated_at = now() where id = v_job.id returning * into v_job;
  return to_jsonb(v_job);
end;
$$;
revoke all on function public.claim_next_handwriting_scan() from public, anon, authenticated;
grant execute on function public.claim_next_handwriting_scan() to service_role;
