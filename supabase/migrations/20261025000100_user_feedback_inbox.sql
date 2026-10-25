-- ROCKCRAFT feedback inbox: durable feedback submissions and platform-admin-only reads.
create table if not exists public.user_feedback (
  id uuid primary key default gen_random_uuid(),
  subject text not null check (char_length(trim(subject)) between 1 and 160),
  message text not null check (char_length(trim(message)) between 8 and 4000),
  user_id uuid references auth.users(id) on delete set null,
  user_name text,
  user_email text,
  school_id uuid references public.schools(id) on delete set null,
  school_name text,
  page_path text,
  browser_info text,
  account_image_url text,
  status text not null default 'new' check (status in ('new', 'reviewed', 'resolved')),
  created_at timestamptz not null default now()
);

create index if not exists user_feedback_created_at_idx
  on public.user_feedback (created_at desc);
create index if not exists user_feedback_school_id_idx
  on public.user_feedback (school_id);

alter table public.user_feedback enable row level security;

drop policy if exists "Visitors can submit feedback" on public.user_feedback;
create policy "Visitors can submit feedback"
  on public.user_feedback
  for insert
  to anon, authenticated
  with check (
    user_id is null
    or user_id = auth.uid()
  );

drop policy if exists "Platform admins can read feedback" on public.user_feedback;
create policy "Platform admins can read feedback"
  on public.user_feedback
  for select
  to authenticated
  using (
    public.is_platform_admin()
  );

comment on table public.user_feedback is
  'User-submitted ROCKCRAFT feedback. Only authorized platform administrators can read submissions.';
