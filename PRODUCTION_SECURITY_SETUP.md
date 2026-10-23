# Production security setup (Supabase + Netlify)

## 1. Apply the SQL hardening migration

1. Open the Supabase project used by this app.
2. Go to **SQL Editor** → **New query**.
3. Open [the hardening migration](https://github.com/Rector96/weblinecreate/blob/fix/production-readiness/supabase/migrations/20261023000100_production_security_hardening.sql).
4. Copy the entire SQL file, paste it into the editor, and click **Run**.
5. Confirm the query completes successfully before deploying the application changes.

This migration does not delete your existing data. It removes the old permissive RLS policies and replaces them with school-scoped policies. It also prevents client-side inserts into the payments table, because payment records must only be written by a trusted server after Paystack verification.

**Important:** apply the original schema first if the project has not been initialized. This migration is for an existing database created from `supabase_schema.sql`.

## 2. Configure server environment variables

In Netlify → **Site configuration** → **Environment variables**, configure:

- `GEMINI_API_KEY`: Gemini API key, server-side only (do not use a `VITE_` prefix).
- `VITE_SUPABASE_URL`: Supabase project URL.
- `VITE_SUPABASE_ANON_KEY`: Supabase anon/publishable key.

Do not put Supabase `service_role` keys or Paystack secret keys in any `VITE_*` variable or in source control. The Paystack modal has been changed to refuse fake success; a trusted initialization/verification endpoint still needs to be connected before real payments can be accepted.

## 3. Important production-readiness limitation

The current app's login and database layer in `src/lib/auth.tsx` and `src/lib/db.ts` use demo users and browser localStorage. They do not establish a real Supabase Auth session. Therefore the database migration alone does **not** turn the existing demo login into secure production authentication, and the current client cannot yet safely access school data under these policies.

Before opening this app to real schools, replace demo authentication/storage with Supabase Auth and tenant-scoped database operations. Then implement server-side Paystack initialization and verification (using `PAYSTACK_SECRET_KEY` only in Netlify server environment variables) and a secure invitation-token validation endpoint. Do not bypass RLS or re-enable public SELECT/INSERT policies as a workaround.

## 4. Changes in this branch

- Removed public read access to school rows and invitation tokens.
- Scoped database reads/writes to the signed-in user's school and roles.
- Removed direct client inserts into the payments table.
- Stopped trusting signup metadata to assign the `platform_admin` role.
- Removed placeholder/fake questions returned as successful AI output.
- Removed the payment modal's timer-based fake success and local subscription activation.
