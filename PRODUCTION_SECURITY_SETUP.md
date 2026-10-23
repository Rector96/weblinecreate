# Production security setup (Supabase + Netlify)

## 1. Apply the SQL hardening migration

1. Open the Supabase project used by this app.
2. Go to **SQL Editor** → **New query**.
3. Open [the hardening migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000100_production_security_hardening.sql).
4. Copy the entire SQL file, paste it into the editor, and click **Run**.
5. Confirm the query completes successfully.
6. Repeat with the [secure signup provisioning migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000200_secure_signup_provisioning.sql).

The first migration tightens row-level security and prevents client-side payment inserts. The second provisions school and teacher profiles through a trusted database trigger and blocks users from changing their own school membership or granting platform-admin access.

**Important:** your existing database already has the required tables. Do not rerun `supabase_schema.sql` on it: that original setup file contains older permissive policies. Apply migrations in order, and confirm each succeeds.

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

The login flow now uses Supabase Auth and no longer offers instant demo sign-in. School membership and invitation-based teacher signup are provisioned by the new database trigger. Paystack initialization and server-side verification endpoints are implemented and require the server environment variables above.

However, `src/lib/db.ts` still stores exam, question, and class data in browser localStorage. Those records are not yet fully migrated to Supabase tables, so this is **not yet production-ready for multi-user school data**. Test registration, email confirmation, role permissions, AI generation, and a Paystack test-mode transaction before taking live payments. Do not bypass RLS or re-enable public SELECT/INSERT policies as a workaround.

## 4. Changes in this branch

- Removed public read access to school rows and invitation tokens.
- Scoped database reads/writes to the signed-in user's school and roles.
- Removed direct client inserts into the payments table.
- Replaced demo sign-in with Supabase Auth and real password reset requests.
- Added secure school/teacher signup provisioning and role-escalation guards.
- Added server-side Paystack initialization and transaction verification; subscriptions activate only after verified successful payment.
- Removed placeholder/fake questions returned as successful AI output.
