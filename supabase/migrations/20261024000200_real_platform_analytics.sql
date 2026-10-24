begin;

create table if not exists public.platform_activity_sessions (
  session_id text primary key,
  visitor_id text not null,
  user_id uuid references auth.users(id) on delete set null,
  school_id uuid references public.schools(id) on delete set null,
  page_path text,
  first_seen_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

create index if not exists platform_activity_sessions_last_seen_idx
  on public.platform_activity_sessions(last_seen_at desc);
create index if not exists platform_activity_sessions_user_idx
  on public.platform_activity_sessions(user_id, last_seen_at desc);
create index if not exists platform_activity_sessions_visitor_idx
  on public.platform_activity_sessions(visitor_id, first_seen_at desc);

alter table public.platform_activity_sessions enable row level security;
revoke all on table public.platform_activity_sessions from public, anon, authenticated;
grant select on public.platform_activity_sessions to service_role;
grant insert, update, delete on public.platform_activity_sessions to service_role;

create or replace function public.record_platform_activity(
  p_session_id text,
  p_visitor_id text,
  p_user_id uuid default null,
  p_school_id uuid default null,
  p_page_path text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if p_session_id is null or length(trim(p_session_id)) < 16 or length(p_session_id) > 100 then
    raise exception 'Invalid activity session ID.';
  end if;
  if p_visitor_id is null or length(trim(p_visitor_id)) < 16 or length(p_visitor_id) > 100 then
    raise exception 'Invalid visitor ID.';
  end if;

  insert into public.platform_activity_sessions(
    session_id, visitor_id, user_id, school_id, page_path, first_seen_at, last_seen_at
  ) values (
    p_session_id, p_visitor_id, p_user_id, p_school_id,
    left(coalesce(p_page_path, '/'), 240), now(), now()
  )
  on conflict (session_id) do update set
    visitor_id = excluded.visitor_id,
    user_id = coalesce(excluded.user_id, public.platform_activity_sessions.user_id),
    school_id = coalesce(excluded.school_id, public.platform_activity_sessions.school_id),
    page_path = excluded.page_path,
    last_seen_at = now();

  return jsonb_build_object('recorded', true);
end;
$$;

revoke all on function public.record_platform_activity(text, text, uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.record_platform_activity(text, text, uuid, uuid, text) to service_role;

create or replace function public.get_platform_analytics()
returns jsonb
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  v_registered_users integer;
  v_registered_profiles integer;
  v_trend jsonb;
  v_school_activity jsonb;
begin
  if not public.is_platform_admin() then
    raise exception 'Platform administrator access required.';
  end if;

  select count(*) into v_registered_profiles from public.profiles;
  select count(*) into v_registered_users from auth.users;

  select coalesce(jsonb_agg(row_to_json(t) order by t.day), '[]'::jsonb)
  into v_trend
  from (
    select
      d.day::date as day,
      count(distinct s.visitor_id) filter (
        where s.first_seen_at < d.day + interval '1 day'
          and s.last_seen_at >= d.day
      ) as visitors,
      count(*) filter (
        where s.first_seen_at < d.day + interval '1 day'
          and s.last_seen_at >= d.day
      ) as sessions
    from generate_series(current_date - interval '6 days', current_date, interval '1 day') as d(day)
    left join public.platform_activity_sessions s
      on s.last_seen_at >= d.day
      and s.first_seen_at < d.day + interval '1 day'
    group by d.day::date
  ) t;

  select coalesce(jsonb_agg(row_to_json(t) order by t.active_visitors desc, t.school_name asc), '[]'::jsonb)
  into v_school_activity
  from (
    select
      sch.id as school_id,
      sch.name as school_name,
      count(distinct s.visitor_id) filter (where s.last_seen_at >= now() - interval '15 minutes') as active_visitors,
      count(distinct s.user_id) filter (where s.last_seen_at >= now() - interval '15 minutes') as active_users,
      count(distinct s.visitor_id) filter (where s.first_seen_at >= now() - interval '24 hours') as visitors_24h
    from public.schools sch
    left join public.platform_activity_sessions s on s.school_id = sch.id
    group by sch.id, sch.name
    having count(s.session_id) filter (where s.last_seen_at >= now() - interval '24 hours') > 0
  ) t;

  return jsonb_build_object(
    'registered_users', v_registered_users,
    'registered_profiles', v_registered_profiles,
    'active_users', (
      select count(distinct user_id)
      from public.platform_activity_sessions
      where user_id is not null and last_seen_at >= now() - interval '15 minutes'
    ),
    'active_visitors', (
      select count(distinct session_id)
      from public.platform_activity_sessions
      where last_seen_at >= now() - interval '15 minutes'
    ),
    'today_sessions', (
      select count(*) from public.platform_activity_sessions
      where first_seen_at >= date_trunc('day', now())
    ),
    'today_visitors', (
      select count(distinct visitor_id) from public.platform_activity_sessions
      where first_seen_at >= date_trunc('day', now())
    ),
    'visitors_24h', (
      select count(distinct visitor_id) from public.platform_activity_sessions
      where first_seen_at >= now() - interval '24 hours'
    ),
    'sessions_7d', (
      select count(*) from public.platform_activity_sessions
      where first_seen_at >= now() - interval '7 days'
    ),
    'users_7d', (
      select count(distinct user_id) from public.platform_activity_sessions
      where user_id is not null and last_seen_at >= now() - interval '7 days'
    ),
    'trend', v_trend,
    'school_activity', v_school_activity,
    'captured_at', now()
  );
end;
$$;

revoke all on function public.get_platform_analytics() from public, anon;
grant execute on function public.get_platform_analytics() to authenticated;

commit;
