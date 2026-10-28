-- Raise safe platform concurrency for exam generation and handwriting scans.
-- Idempotent: only replaces claim functions. Does not alter table shapes.

create or replace function public.claim_next_exam_request()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.exam_requests%rowtype;
  v_limit integer := 3;
begin
  perform pg_advisory_xact_lock(hashtext('rockcraft_exam_request_queue'));

  -- Recover stuck jobs (worker crash / timeout).
  update public.exam_requests
  set status = 'pending', started_at = null, updated_at = now()
  where status = 'processing' and updated_at < now() - interval '20 minutes';

  -- Allow a small number of parallel exam jobs so multiple schools are not blocked
  -- behind a single long generation, while still protecting provider rate limits.
  if (select count(*) from public.exam_requests where status = 'processing') >= v_limit then
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

create or replace function public.claim_next_handwriting_scan()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_job public.handwriting_scan_requests%rowtype;
  v_limit integer := 5;
begin
  perform pg_advisory_xact_lock(hashtext('rockcraft_handwriting_scan_queue'));

  update public.handwriting_scan_requests
  set status = 'pending', started_at = null, updated_at = now()
  where status = 'processing' and updated_at < now() - interval '8 minutes';

  -- Bounded parallelism: more schools can scan together without exhausting Gemini quota.
  if (select count(*) from public.handwriting_scan_requests where status = 'processing') >= v_limit then
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

notify pgrst, 'reload schema';
