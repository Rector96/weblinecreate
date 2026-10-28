# CRITICAL: Restore netlify/functions/api.ts

A partial overwrite temporarily broke the full API. Handwriting worker fixes are already on main.

## Fix in 1 minute (local machine)

```bash
cd weblinecreate
git fetch origin
git checkout 94550ffa8c144c1b7ecc5df8a702627b88a593ac -- netlify/functions/api.ts
```

Then open `netlify/functions/api.ts` and replace **both** worker wake bodies:

**Find** (appears twice-ish):
```js
body: '{}',
```
used when calling `handwriting-queue-worker-background`

**Replace with:**
```js
body: JSON.stringify({ job_id: requestId }),
```

Also change the stuck-processing threshold from `8 * 60 * 1000` to `2 * 60 * 1000` if present.

Then:

```bash
git add netlify/functions/api.ts
git commit -m "Restore full api.ts and wake handwriting worker by job_id"
git push origin main
```

## Why scans hung

Netlify **API** logs showed only ~250ms polls. The real OCR runs in **`handwriting-queue-worker-background`**, not `api`.

Check **Functions → handwriting-queue-worker-background** logs for:
- `hasGemini: false` → set `GEMINI_API_KEY` on Netlify and redeploy
- claim/RPC errors → run the handwriting queue SQL migration in Supabase
- model errors → worker now tries gemini-2.0-flash, 2.5-flash, flash-latest, 1.5-flash

## Netlify env checklist

- `GEMINI_API_KEY` or `GOOGLE_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- Redeploy after setting keys
