import { processHandwritingPages } from './_shared/handwritingProcess';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const ADMIN_KEY = SERVICE_KEY || SECRET_KEY;
const USE_SECRET = !SERVICE_KEY && Boolean(SECRET_KEY);
const GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

async function db(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !ADMIN_KEY) throw new Error('Server database configuration is missing. Set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY on Netlify.');
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: ADMIN_KEY,
      ...(USE_SECRET ? {} : { Authorization: 'Bearer ' + ADMIN_KEY }),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) {
    const detail = typeof data?.message === 'string' ? data.message : raw.slice(0, 200);
    throw new Error('Queue database request failed with HTTP ' + response.status + (detail ? ': ' + detail : ''));
  }
  return data;
}

async function wakeNext(origin: string, jobId?: string) {
  try {
    await fetch(origin + '/.netlify/functions/handwriting-queue-worker-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(jobId ? { job_id: jobId } : { wake: true }),
    });
  } catch (error) {
    console.error('Could not wake next handwriting scan worker', error);
  }
}

async function claimSpecificJob(jobId: string) {
  const rows = await db(
    'handwriting_scan_requests?id=eq.' + encodeURIComponent(jobId) + '&select=*&limit=1',
  ) as any[];
  const row = rows?.[0];
  if (!row?.id) return null;
  if (row.status === 'completed' || row.status === 'failed') return null;
  // Take ownership if still pending, or recover if stuck in processing.
  const stuck =
    row.status === 'processing' &&
    row.updated_at &&
    Date.now() - Date.parse(row.updated_at) > 8 * 60 * 1000;
  if (row.status !== 'pending' && !stuck) return null;
  const updated = await db('handwriting_scan_requests?id=eq.' + encodeURIComponent(jobId), {
    method: 'PATCH',
    headers: { Prefer: 'return=representation' },
    body: JSON.stringify({
      status: 'processing',
      attempts: Number(row.attempts || 0) + 1,
      started_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
      error_message: null,
    }),
  }) as any[];
  return Array.isArray(updated) ? updated[0] : updated;
}

async function claimNextJob() {
  try {
    const claimed = await db('rpc/claim_next_handwriting_scan', { method: 'POST', body: '{}' });
    return Array.isArray(claimed) ? claimed[0] : claimed;
  } catch (error: any) {
    const message = String(error?.message || '');
    console.error('claim_next_handwriting_scan failed', message.slice(0, 300));
    // Migration not applied yet — fall back to oldest pending row.
    if (/404|does not exist|PGRST|Could not find the function/i.test(message)) {
      const rows = await db(
        'handwriting_scan_requests?status=eq.pending&order=created_at.asc&limit=1&select=*',
      ) as any[];
      const row = rows?.[0];
      if (!row?.id) return null;
      return claimSpecificJob(row.id);
    }
    throw error;
  }
}

export default async function handwritingQueueWorker(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const origin = new URL(req.url).origin;
  let job: any = null;
  let body: any = {};
  try {
    try { body = await req.json(); } catch { body = {}; }
    const requestedId = typeof body?.job_id === 'string' ? body.job_id.trim() : '';

    console.log('Handwriting worker started', {
      hasGemini: Boolean(GEMINI_KEY),
      hasDb: Boolean(SUPABASE_URL && ADMIN_KEY),
      jobId: requestedId || null,
    });

    job = requestedId ? await claimSpecificJob(requestedId) : await claimNextJob();
    if (!job?.id) {
      console.log('Handwriting worker: nothing to process');
      return new Response('No pending handwriting scans', { status: 202 });
    }

    if (!GEMINI_KEY) {
      throw Object.assign(
        new Error('Gemini vision service is not configured. Set GEMINI_API_KEY (or GOOGLE_API_KEY) in Netlify → Site settings → Environment variables, then redeploy.'),
        { status: 503 },
      );
    }

    const pages = job.request_payload?.pages;
    if (!Array.isArray(pages) || pages.length < 1) {
      throw new Error('Queued scan has no page images. Please upload the photos again and retry.');
    }

    const result = await processHandwritingPages(pages, GEMINI_KEY);
    await db('handwriting_scan_requests?id=eq.' + job.id, {
      method: 'PATCH',
      body: JSON.stringify({
        status: 'completed',
        result_data: {
          questions: result.questions,
          diagram_regions: result.diagram_regions,
          page_notes: result.page_notes,
          model: result.model,
        },
        request_payload: { pages: [] },
        error_message: null,
        updated_at: new Date().toISOString(),
        completed_at: new Date().toISOString(),
      }),
    });
    console.log('Handwriting worker completed', { jobId: job.id, questions: result.questions.length, model: result.model });
  } catch (error: any) {
    const message = String(error?.message || 'Unknown handwriting scan error');
    const status = Number(error?.status || error?.code || 0);
    const retryable =
      status === 429 ||
      status >= 500 ||
      status === 0 ||
      /timeout|temporarily unavailable|rate.?limit|resource_exhausted/i.test(message);
    console.error('Handwriting queue worker failed', {
      jobId: job?.id || null,
      status: status || null,
      retryable,
      message: message.slice(0, 400),
    });
    if (job?.id) {
      const attempts = Number(job.attempts || 1);
      const willRetry = retryable && attempts < 3 && !/not configured|API key|authentication|permission denied/i.test(message);
      const safe = /not configured|API key|authentication|permission denied/i.test(message)
        ? 'Handwriting scanning is not configured on the server. Ask the platform admin to set GEMINI_API_KEY in Netlify and redeploy.'
        : /quota|rate.?limit|resource_exhausted/i.test(message)
          ? 'The handwriting service is busy. Your scan will be retried automatically.'
          : willRetry
            ? null
            : 'We could not read these pages. Try clearer photos (1–3 pages) and scan again.';
      try {
        await db('handwriting_scan_requests?id=eq.' + job.id, {
          method: 'PATCH',
          body: JSON.stringify({
            status: willRetry ? 'pending' : 'failed',
            error_message: willRetry ? null : safe,
            request_payload: willRetry ? job.request_payload : { pages: [] },
            updated_at: new Date().toISOString(),
            ...(willRetry ? {} : { completed_at: new Date().toISOString() }),
          }),
        });
      } catch (dbError) {
        console.error('Could not persist handwriting scan failure', dbError);
      }
    }
  } finally {
    await wakeNext(origin);
  }
  return new Response('Handwriting scan worker finished', { status: 202 });
}
