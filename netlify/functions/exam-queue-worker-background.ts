import { generateExamDraft } from './_shared/examGeneration';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const SUPABASE_ADMIN_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY;
const USE_SECRET_API_KEY = !SUPABASE_SERVICE_ROLE_KEY && Boolean(SUPABASE_SECRET_KEY);

async function adminRequest(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !SUPABASE_ADMIN_KEY) throw new Error('Server database configuration is missing.');
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...init,
    headers: {
      apikey: SUPABASE_ADMIN_KEY,
      ...(USE_SECRET_API_KEY ? {} : { Authorization: 'Bearer ' + SUPABASE_ADMIN_KEY }),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) throw new Error('Database queue operation failed with status ' + response.status);
  return data;
}

async function wakeNextWorker(origin: string) {
  try {
    await fetch(origin + '/.netlify/functions/exam-queue-worker-background', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ wake: true }),
    });
  } catch (error) {
    console.error('Could not wake the next exam queue worker', error);
  }
}

export default async function examQueueWorker(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });

  const origin = new URL(req.url).origin;
  try {
    const claimed = await adminRequest('rpc/claim_next_exam_request', {
      method: 'POST',
      body: JSON.stringify({}),
    }) as any;
    const job = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!job?.id) return new Response('No pending exam requests', { status: 202 });

    try {
      const result = await generateExamDraft(job.request_payload || {});
      await adminRequest('exam_requests?id=eq.' + job.id, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'completed',
          generated_data: result.data,
          error_message: null,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }),
      });
    } catch (error: any) {
      const rawMessage = error instanceof Error ? error.message : String(error || '');
      const rateLimited = Number(error?.status || error?.code) === 429 || /rate.?limit|too many requests|tokens per minute/i.test(rawMessage);
      const safeMessage = rateLimited
        ? 'The AI service is busy. Your request could not be completed this time; please try generating again shortly.'
        : /quota|billing|api.?key|permission/i.test(rawMessage)
          ? 'AI service configuration or quota needs attention. Please contact your school administrator.'
          : 'We could not complete this exam draft. Please try again.';
      console.error('Exam queue job failed', job.id, rawMessage.slice(0, 240));
      await adminRequest('exam_requests?id=eq.' + job.id, {
        method: 'PATCH',
        body: JSON.stringify({
          status: 'failed',
          error_message: safeMessage,
          updated_at: new Date().toISOString(),
          completed_at: new Date().toISOString(),
        }),
      });
    }

    // Trigger one follow-up invocation after this job finishes. The database claim
    // function guarantees that only one request is processing at a time.
    await wakeNextWorker(origin);
    return new Response('Exam request processed', { status: 202 });
  } catch (error) {
    console.error('Exam queue worker failed', error);
    return new Response('Exam queue worker could not process a request', { status: 500 });
  }
}
