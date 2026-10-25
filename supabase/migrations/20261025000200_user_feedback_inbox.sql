-- ROCKCRAFT feedback inbox repair. Safe to run even if an earlier feedback migration created the table.
begin;

create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  subject text not null default 'Feedback',
  message text not null,
  user_id uuid,
  user_name text,
  user_email text,
  school_id uuid references public.schools(id) on delete set null,
  school_name text,
  page_path text,
  browser_info text,
  account_image_url text,
  status text not null default 'new',
  created_at timestamptz not null default now()
);

-- Earlier versions may have created only part of this schema. Add missing fields safely.
alter table public.user_feedback add column if not exists subject text;
alter table public.user_feedback add column if not exists message text;
alter table public.user_feedback add column if not exists user_id uuid;
alter table public.user_feedback add column if not exists user_name text;
alter table public.user_feedback add column if not exists user_email text;
alter table public.user_feedback add column if not exists school_id uuid references public.schools(id) on delete set null;
alter table public.user_feedback add column if not exists school_name text;
alter table public.user_feedback add column if not exists page_path text;
alter table public.user_feedback add column if not exists browser_info text;
alter table public.user_feedback add column if not exists account_image_url text;
alter table public.user_feedback add column if not exists status text not null default 'new';
alter table public.user_feedback add column if not exists created_at timestamptz not null default now();

-- Normalize legacy constraint variants so current submissions are accepted.
do $$
declare c record;
begin
  for c in
    select conname from pg_constraint
    where conrelid = 'public.user_feedback'::regclass
      and contype = 'c'
      and (pg_get_constraintdef(oid) ilike '%subject%'
        or pg_get_constraintdef(oid) ilike '%message%'
        or pg_get_constraintdef(oid) ilike '%status%')
  loop
    execute format('alter table public.user_feedback drop constraint %I', c.conname);
  end loop;
end $$;

alter table public.user_feedback
  add constraint user_feedback_subject_length_check
    check (char_length(trim(subject)) between 1 and 160),
  add constraint user_feedback_message_length_check
    check (char_length(trim(message)) between 8 and 4000),
  add constraint user_feedback_status_check
    check (status in ('new', 'reviewed', 'resolved'));

create index if not exists user_feedback_created_at_idx
  on public.user_feedback (created_at desc);
create index if not exists user_feedback_school_id_idx
  on public.user_feedback (school_id);

alter table public.user_feedback enable row level security;

-- Remove all old policies on this table, then install one clear policy per action.
do $$
declare p record;
begin
  for p in
    select policyname from pg_policies
    where schemaname = 'public' and tablename = 'user_feedback'
  loop
    execute format('drop policy if exists %I on public.user_feedback', p.policyname);
  end loop;
end $$;

grant insert on public.user_feedback to anon, authenticated;
grant select on public.user_feedback to authenticated;

create policy user_feedback_submit
  on public.user_feedback for insert to anon, authenticated
  with check (user_id is null or user_id = auth.uid());

create policy user_feedback_admin_read
  on public.user_feedback for select to authenticated
  using (public.is_platform_admin());

commit;
