create table if not exists public.ai_generation_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now()
);
create index if not exists ai_generation_events_user_created_idx on public.ai_generation_events(user_id, created_at desc);
create index if not exists ai_generation_events_school_created_idx on public.ai_generation_events(school_id, created_at desc);
alter table public.ai_generation_events enable row level security;
revoke all on public.ai_generation_events from anon, authenticated, public;

create or replace function public.consume_ai_generation_slot(p_user_id uuid, p_school_id uuid)
returns jsonb language plpgsql security definer set search_path = public, pg_temp as $$
declare v_user_count integer; v_school_count integer; v_member boolean;
begin
  select exists(select 1 from public.profiles p where p.user_id=p_user_id and p.school_id=p_school_id)
    or exists(select 1 from public.user_roles r where r.user_id=p_user_id and r.role='platform_admin')
    into v_member;
  if not v_member then return jsonb_build_object('allowed',false,'reason','membership'); end if;
  perform pg_advisory_xact_lock(hashtextextended(p_user_id::text,0));
  select count(*) into v_user_count from public.ai_generation_events where user_id=p_user_id and created_at > now()-interval '1 minute';
  select count(*) into v_school_count from public.ai_generation_events where school_id=p_school_id and created_at > now()-interval '1 minute';
  if v_user_count >= 5 then return jsonb_build_object('allowed',false,'reason','user_rate'); end if;
  if v_school_count >= 20 then return jsonb_build_object('allowed',false,'reason','school_rate'); end if;
  insert into public.ai_generation_events(user_id,school_id) values(p_user_id,p_school_id);
  return jsonb_build_object('allowed',true);
end; $$;
revoke all on function public.consume_ai_generation_slot(uuid,uuid) from public, anon, authenticated;
grant execute on function public.consume_ai_generation_slot(uuid,uuid) to service_role;
