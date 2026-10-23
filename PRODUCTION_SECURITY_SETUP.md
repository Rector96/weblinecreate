# Production security setup (Supabase + Netlify)

## 1. Apply the SQL hardening migration

1. Open the Supabase project used by this app.
2. Go to **SQL Editor** → **New query**.
3. Open [the hardening migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000100_production_security_hardening.sql).
4. Copy the entire SQL file, paste it into the editor, and click **Run**.
5. Confirm the query completes successfully.
6. Repeat with the [secure signup provisioning migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000200_secure_signup_provisioning.sql).
7. Then run the [email-based admin authorization removal migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000400_remove_email_based_platform_admin.sql), especially if the earlier hardening migrations have already been applied.
8. Run the [secure exam quota migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000500_secure_exam_quota.sql).
9. Run the [atomic exam publication migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000600_atomic_exam_publication.sql).
10. Run the [AI generation rate-limit migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000700_secure_ai_generation.sql).

The first migration tightens row-level security and prevents client-side payment inserts. The second provisions school and teacher profiles through a trusted database trigger and blocks users from changing their own school membership or granting platform-admin access. Platform-admin access is never assigned automatically from an email address; use the manual bootstrap instructions below.

**Important:** your existing database already has the required tables. Do not rerun `supabase_schema.sql` on it: that original setup file contains older permissive policies. Apply the migrations in numeric order, including 005, 006, and 007, and confirm each succeeds. Migrations 005 and 006 enforce trial quotas at the database and publish an exam with its questions and quota usage in one transaction. Migration 007 creates a private event table and a server-only database function for per-user and per-school AI rate limits. Migration 004 is a follow-up patch for databases where migration 001 or 002 was already applied before the email-based administrator shortcut was removed.

## 2. Configure server environment variables

In Netlify → **Site configuration** → **Environment variables**, configure:

- `GEMINI_API_KEY`: Gemini API key, server-side only (do not use a `VITE_` prefix).
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/publishable key for browser authentication.
- `SUPABASE_URL`: same Supabase project URL, for server-side Netlify functions.
- `SUPABASE_SERVICE_ROLE_KEY`: Supabase service-role key, server-side only.
- `PAYSTACK_SECRET_KEY`: Paystack secret key, server-side only.
- `SITE_URL`: canonical public site URL, e.g. `https://your-site.netlify.app`, used for the Paystack callback.

Never place `SUPABASE_SERVICE_ROLE_KEY` or `PAYSTACK_SECRET_KEY` in a `VITE_*` variable or commit either key to Git. After setting variables, trigger a fresh Netlify deploy.

## 3. Important production-readiness limitation

The login flow uses Supabase Auth and does not offer instant demo sign-in. School membership and invitation-based teacher signup are provisioned through the database trigger. Paystack initialization and server-side verification endpoints are implemented and require the server environment variables above.

Shared school records must be stored in Supabase. The current `src/lib/db.ts` is limited to optional device-local offline exam drafts; it is not the source of truth for published/shared exams, questions, classes, invitations, subscriptions, or payments. Offline drafts remain on the device until the app provides a supported sync/publish workflow, so do not assume they are backed up or visible to other users. This branch remains **unverified for production** until the migrations and real workflows below have been tested. Test registration, email confirmation, invitation joins, role permissions, AI generation and regeneration, class/exam persistence, and a Paystack test-mode transaction before taking live payments. Do not bypass RLS or re-enable public SELECT/INSERT policies as a workaround.

## 4. Changes in this branch

- Removed public read access to school rows and invitation tokens.
- Scoped database reads/writes to the signed-in user's school and roles.
- Removed direct client inserts into the payments table.
- Replaced demo sign-in with Supabase Auth and real password reset requests.
- Added secure school/teacher signup provisioning and role-escalation guards.
- Added server-side Paystack initialization and transaction verification; subscriptions activate only after verified successful payment.
- Removed placeholder/fake questions returned as successful AI output.
- Required a valid Supabase session and school membership for all AI generation endpoints.
- Added database-backed rate limits (up to 5 AI requests per user per minute and 20 per school per minute); expired rate-limit events are cleaned up as new requests arrive.
- Added request field/count validation and stopped the UI from inventing fallback questions when AI requests fail.


## 5. Bootstrap the first platform administrator

Do not grant platform-admin access based only on an email address in application code or signup metadata. First create and verify the intended administrator's Supabase Auth account using the normal signup flow. Then, from the Supabase SQL Editor (trusted project owner access), inspect the exact account and grant the role explicitly:

```sql
-- Verify the target account first; this query should return exactly one intended user.
select id, email, email_confirmed_at
from auth.users
where lower(email) = lower('YOUR_ADMIN_EMAIL');

-- Replace the UUID below with the verified auth.users.id returned above.
insert into public.user_roles (user_id, role, school_id)
values ('REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid, 'platform_admin', null)
on conflict do nothing;

-- Confirm the role assignment.
select user_id, role, school_id
from public.user_roles
where user_id = 'REPLACE_WITH_VERIFIED_AUTH_USER_UUID'::uuid;
```

Run the insert only after verifying the account belongs to the intended administrator. Keep SQL Editor/project-owner access restricted. The user's public signup flow must never be able to insert this role.
