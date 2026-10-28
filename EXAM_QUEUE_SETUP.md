# ROCKCRAFT exam request queue rollout

The database-backed queue is protected by a feature flag so existing exam generation keeps working while the database migration is being applied.

## Rollout order

1. Apply `supabase/migrations/20261024000100_database_backed_exam_queue.sql` to the same Supabase project used by the production site.
2. Apply later queue migrations in order, including `20261028000100_raise_queue_concurrency.sql` (exam concurrency 3, handwriting concurrency 5).
3. Deploy this code to Netlify and confirm the `exam-queue-worker-background` and `handwriting-queue-worker-background` functions are listed.
4. In Netlify site environment variables, set `EXAM_QUEUE_ENABLED=true` for the Functions runtime and trigger a fresh production deploy.
5. Test one teacher request, then test several requests close together. The exam claim function allows up to **3** jobs in `processing` at a time. Handwriting allows up to **5**.
6. Confirm a completed request returns to the teacher review screen and a failed request shows a clear message instead of a blank screen.

## Required server environment

- `SUPABASE_URL` (or `VITE_SUPABASE_URL`)
- `SUPABASE_SERVICE_ROLE_KEY` or `SUPABASE_SECRET_KEY`
- `GROQ_API_KEY` (preferred) or `GEMINI_API_KEY` / `GOOGLE_API_KEY`
- `EXAM_QUEUE_ENABLED=true` only after the exam queue migration has succeeded
- Optional `GROQ_BATCH_DELAY_MS` — pause between queued Groq batches (default **15000** ms when queue is enabled; set `0` only if your quota can handle continuous calls)

Keep the service-role/secret key and AI provider key in server-side Netlify environment variables only. Never add them to a `VITE_*` variable.

## How it works

The request endpoint validates the teacher and school invite, stores a pending job, and returns a tracking ID. The teacher screen polls status while keeping progress messaging visible. A Netlify background function claims a queued job (up to the concurrency limits above), generates objective and theory sections in sequential batches (with the configurable batch pause), saves the finished JSON, and wakes the next worker. The status endpoint checks that the requester is the original signed-in teacher or holds the matching school invite token.

If the queue migration has not been applied or the flag is not enabled, the app uses the existing synchronous path with the same batched generation helper; this prevents an unapplied migration from breaking exam generation.

## Handwriting scans

- Up to **8** page photos per scan (client + API limit for payload safety).
- Up to **5** scans processing at once across the platform.
- Gemini vision models: `gemini-2.5-flash` → `gemini-flash-latest` → `gemini-2.0-flash`.
- Diagram regions are returned with normalized boxes; the browser crops and attaches them to the matching question for review and DOCX export.
