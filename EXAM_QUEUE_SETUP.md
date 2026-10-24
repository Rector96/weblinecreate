# ROCKCRAFT exam request queue rollout

The database-backed queue is protected by a feature flag so existing exam generation keeps working while the database migration is being applied.

## Rollout order

1. Apply `supabase/migrations/20261024000100_database_backed_exam_queue.sql` to the same Supabase project used by the production site.
2. Deploy this code to Netlify and confirm the `exam-queue-worker-background` function is listed in the deployed functions.
3. In Netlify site environment variables, set `EXAM_QUEUE_ENABLED=true` for the Functions runtime and trigger a fresh production deploy.
4. Test one teacher request, then test two requests close together. The queue claim function allows only one job to be in `processing` at a time.
5. Confirm a completed request returns to the teacher review screen and a failed request shows a clear message instead of a blank screen.

## Required server environment

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`
- `GROQ_API_KEY` (preferred) or `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `EXAM_QUEUE_ENABLED=true` only after step 1 has succeeded
- Optional `GROQ_BATCH_DELAY_MS` to override the default 40-second pause between queued Groq batches (set only if your provider limits justify it)

Keep the service-role/secret key and AI provider key in server-side Netlify environment variables only. Never add them to a `VITE_*` variable.

## How it works

The request endpoint validates the teacher and school invite, stores a pending job, and returns a tracking ID. The teacher screen polls status every three seconds while keeping the motivation quotes and progress messages visible. A Netlify background function claims one queued job, generates objective and theory sections in sequential batches (with a configurable 40-second Groq batch pause by default), saves the finished JSON, and wakes the next worker. The status endpoint checks that the requester is the original signed-in teacher or holds the matching school invite token.

If the queue migration has not been applied or the flag is not enabled, the app uses the existing synchronous path with the same batched generation helper; this prevents an unapplied migration from breaking exam generation.
