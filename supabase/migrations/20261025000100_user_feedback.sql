-- ROCKCRAFT feedback inbox. Apply in Supabase SQL Editor after existing migrations.
begin;
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(subject) between 1 and 120),
  message text not null check (char_length(message) between 8 and 4000),
  user_id uuid,
  user_name text,
  user_email text,
  school_id uuid references public.schools(id) on delete set null,
  school_name text,
  page_path text,
  browser_info text,
  account_image_url text,
  status text not null default 'new' check (status in ('new','reviewing','resolved')),
  created_at timestamptz not null default now()
);
create index if not exists user_feedback_created_at_idx on public.user_feedback(created_at desc);
alter table public.user_feedback enable row level security;
drop policy if exists "Anyone can submit feedback" on public.user_feedback;
drop policy if exists "Platform admins can view feedback" on public.user_feedback;
create policy "Anyone can submit feedback" on public.user_feedback
  for insert to anon, authenticated
  with check (
    char_length(subject) between 1 and 120
    and char_length(message) between 8 and 4000
    and (user_id is null or user_id = auth.uid())
  );
create policy "Platform admins can view feedback" on public.user_feedback
  for select to authenticated
  using (public.is_platform_admin());
grant insert on public.user_feedback to anon, authenticated;
grant select on public.user_feedback to authenticated;
commit;
