-- Production security hardening for ExamCraft.
-- Apply AFTER the initial schema in Supabase SQL Editor.
-- This migration is intentionally idempotent and does not delete application data.

begin;

-- Remove all existing policies on application tables before installing the restrictive set.
do $$
declare p record;
begin
  for p in
    select schemaname, tablename, policyname
    from pg_policies
    where schemaname = 'public'
      and tablename in (
        'schools','profiles','user_roles','school_classes','school_invitations',
        'exams','questions','objective_answers','theory_marking_schemes','payments'
      )
  loop
    execute format('drop policy if exists %I on %I.%I', p.policyname, p.schemaname, p.tablename);
  end loop;
end $$;

alter table public.schools enable row level security;
alter table public.profiles enable row level security;
alter table public.user_roles enable row level security;
alter table public.school_classes enable row level security;
alter table public.school_invitations enable row level security;
alter table public.exams enable row level security;
alter table public.questions enable row level security;
alter table public.objective_answers enable row level security;
alter table public.theory_marking_schemes enable row level security;
alter table public.payments enable row level security;

create or replace function public.is_platform_admin()
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select
    exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid() and r.role = 'platform_admin'
    );
$$;

create or replace function public.get_user_school_id()
returns uuid
language sql
security definer
stable
set search_path = public, auth
as $$
  select p.school_id
  from public.profiles p
  where p.user_id = auth.uid()
  limit 1;
$$;

create or replace function public.has_role(required_role text)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select public.is_platform_admin() or exists (
    select 1
    from public.user_roles r
    where r.user_id = auth.uid()
      and r.role = required_role
      and (
        r.school_id = public.get_user_school_id()
        or (r.school_id is null and required_role = 'school_admin')
      )
  );
$$;

create or replace function public.is_school_member(target_school_id uuid)
returns boolean
language sql
security definer
stable
set search_path = public, auth
as $$
  select public.is_platform_admin() or (
    target_school_id is not null
    and exists (
      select 1 from public.profiles p
      where p.user_id = auth.uid() and p.school_id = target_school_id
    )
    and exists (
      select 1 from public.user_roles r
      where r.user_id = auth.uid()
        and r.role in ('school_admin','teacher')
        and (r.school_id = target_school_id or r.school_id is null)
    )
  );
$$;

-- Schools: no anonymous directory or cross-school data access.
create policy schools_select_member_or_platform
on public.schools for select to authenticated
using (id = public.get_user_school_id() or public.is_platform_admin());

-- Signup must be able to create a school; later edits are limited to that school.
create policy schools_insert_authenticated
on public.schools for insert to authenticated
with check (auth.uid() is not null);

create policy schools_update_admin
on public.schools for update to authenticated
using ((id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin())
with check ((id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin());

create policy profiles_select_same_school
on public.profiles for select to authenticated
using (user_id = auth.uid() or school_id = public.get_user_school_id() or public.is_platform_admin());

create policy profiles_insert_self
on public.profiles for insert to authenticated
with check (user_id = auth.uid());

create policy profiles_update_self
on public.profiles for update to authenticated
using (user_id = auth.uid() or public.is_platform_admin())
with check (user_id = auth.uid() or public.is_platform_admin());

create policy roles_select_scoped
on public.user_roles for select to authenticated
using (user_id = auth.uid() or school_id = public.get_user_school_id() or public.is_platform_admin());

create policy roles_manage_school_admin
on public.user_roles for all to authenticated
using (
  public.is_platform_admin()
  or (public.has_role('school_admin') and school_id = public.get_user_school_id())
)
with check (
  public.is_platform_admin()
  or (public.has_role('school_admin') and school_id = public.get_user_school_id())
);

create policy classes_select_member
on public.school_classes for select to authenticated
using (public.is_school_member(school_id));

create policy classes_manage_admin
on public.school_classes for all to authenticated
using ((school_id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin())
with check ((school_id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin());

-- Invite tokens are secrets: do not expose rows/tokens via direct table SELECT.
-- Joining by token must be implemented through a server-validated RPC/backend endpoint.
create policy invitations_manage_admin
on public.school_invitations for all to authenticated
using ((school_id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin())
with check ((school_id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin());

create policy exams_select_member
on public.exams for select to authenticated
using (public.is_school_member(school_id));

create policy exams_insert_member
on public.exams for insert to authenticated
with check (public.is_school_member(school_id));

create policy exams_update_member
on public.exams for update to authenticated
using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

create policy exams_delete_admin
on public.exams for delete to authenticated
using ((school_id = public.get_user_school_id() and public.has_role('school_admin')) or public.is_platform_admin());

create policy questions_select_member
on public.questions for select to authenticated
using (public.is_school_member(school_id));

create policy questions_insert_member
on public.questions for insert to authenticated
with check (
  public.is_school_member(school_id)
  and exists (select 1 from public.exams e where e.id = exam_id and e.school_id = school_id)
);

create policy questions_update_member
on public.questions for update to authenticated
using (public.is_school_member(school_id))
with check (public.is_school_member(school_id));

create policy questions_delete_member
on public.questions for delete to authenticated
using (public.is_school_member(school_id));

create policy objective_answers_select_member
on public.objective_answers for select to authenticated
using (exists (
  select 1 from public.questions q
  where q.id = question_id and public.is_school_member(q.school_id)
));

create policy objective_answers_manage_member
on public.objective_answers for all to authenticated
using (exists (
  select 1 from public.questions q
  where q.id = question_id and public.is_school_member(q.school_id)
))
with check (exists (
  select 1 from public.questions q
  where q.id = question_id and public.is_school_member(q.school_id)
));

create policy marking_schemes_select_member
on public.theory_marking_schemes for select to authenticated
using (exists (
  select 1 from public.questions q
  where q.id = question_id and public.is_school_member(q.school_id)
));

create policy marking_schemes_manage_member
on public.theory_marking_schemes for all to authenticated
using (exists (
  select 1 from public.questions q
  where q.id = question_id and public.is_school_member(q.school_id)
))
with check (exists (
  select 1 from public.questions q
  where q.id = question_id and public.is_school_member(q.school_id)
));

create policy payments_select_member
on public.payments for select to authenticated
using (public.is_school_member(school_id));

-- Deliberately no client INSERT/UPDATE/DELETE policy on payments.
-- A trusted server must verify Paystack using PAYSTACK_SECRET_KEY before writing payment rows.

-- Stop signup metadata from granting the platform_admin role.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
declare
  user_full_name text;
  target_role text;
begin
  user_full_name := coalesce(new.raw_user_meta_data->>'full_name', split_part(coalesce(new.email, ''), '@', 1));

  -- Never grant elevated privileges based on an email address or client metadata.
  target_role := 'school_admin';

  insert into public.profiles (user_id, full_name, email, is_profile_completed)
  values (new.id, user_full_name, coalesce(new.email, ''), false)
  on conflict (user_id) do nothing;

  insert into public.user_roles (user_id, role)
  values (new.id, target_role)
  on conflict do nothing;

  return new;
end;
$$;

-- Restrict helper function execution to signed-in application users.
revoke all on function public.is_school_member(uuid) from public, anon;
grant execute on function public.is_school_member(uuid) to authenticated;
revoke all on function public.get_user_school_id() from public, anon;
grant execute on function public.get_user_school_id() to authenticated;
revoke all on function public.has_role(text) from public, anon;
grant execute on function public.has_role(text) to authenticated;
revoke all on function public.is_platform_admin() from public, anon;
grant execute on function public.is_platform_admin() to authenticated;

commit;
