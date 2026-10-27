import { GoogleGenAI } from '@google/genai';

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SERVICE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const ADMIN_KEY = SERVICE_KEY || SECRET_KEY;
const USE_SECRET = !SERVICE_KEY && Boolean(SECRET_KEY);
const GEMINI_KEY = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();

async function db(path: string, init: RequestInit = {}) {
  if (!SUPABASE_URL || !ADMIN_KEY) throw new Error('Server database configuration is missing.');
  const response = await fetch(SUPABASE_URL + '/rest/v1/' + path, {
    ...init, headers: { apikey: ADMIN_KEY, ...(USE_SECRET ? {} : { Authorization: 'Bearer ' + ADMIN_KEY }), 'Content-Type': 'application/json', ...(init.headers || {}) },
  });
  const raw = await response.text();
  let data: any = null;
  try { data = raw ? JSON.parse(raw) : null; } catch { data = null; }
  if (!response.ok) throw new Error('Queue database request failed with HTTP ' + response.status);
  return data;
}
async function analyzeIncident(message: string, status: number, attempts: number) {
  const key = (process.env.GROQ_API_KEY || '').trim();
  if (!key) return { analysis: null, recommendation: 'Check provider quota, API credentials, Netlify function logs, and Supabase queue status.', repairStatus: 'needs_admin', action: 'admin_review' };
  try {
    const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST', headers: { Authorization: 'Bearer ' + key, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: 'openai/gpt-oss-120b',
        messages: [
          { role: 'system', content: 'You are a production incident triage assistant for ROCKCRAFT. Analyze sanitized error metadata only. Never request or reveal secrets. You cannot edit source code or database schema. Recommend safe operational actions only: retry transient errors, use an already configured fallback model, inspect provider quota/configuration, or escalate to a human. Return strict JSON with analysis (max 500 chars), recommendation (max 500 chars), and safe_action exactly one of retry, fallback_model, admin_review, none.' },
          { role: 'user', content: JSON.stringify({ component: 'handwriting_scan_worker', http_status: status || null, attempts, error: message.slice(0, 800) }) },
        ], temperature: 0.1, response_format: { type: 'json_object' } }),
    });
    const data: any = await response.json();
    if (!response.ok) throw new Error('Incident analysis provider returned ' + response.status);
    const parsed = JSON.parse(data?.choices?.[0]?.message?.content || '{}');
    const action = ['retry','fallback_model','admin_review','none'].includes(parsed.safe_action) ? parsed.safe_action : 'admin_review';
    return { analysis: String(parsed.analysis || 'Automated analysis returned no details.').slice(0,500), recommendation: String(parsed.recommendation || 'Review provider and queue diagnostics.').slice(0,500), repairStatus: action === 'none' ? 'analyzed' : action === 'retry' ? 'auto_retried' : 'needs_admin', action };
  } catch (error) {
    console.error('Incident AI analysis unavailable', error);
    return { analysis: 'Automated incident analysis was unavailable.', recommendation: 'Review the sanitized error, provider quota and Netlify logs manually.', repairStatus: 'needs_admin', action: 'admin_review' };
  }
}

async function wakeNext(origin: string) {
  try { await fetch(origin + '/.netlify/functions/handwriting-queue-worker-background', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{}' }); }
  catch (error) { console.error('Could not wake next handwriting scan worker', error); }
}
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default async function handwritingQueueWorker(req: Request) {
  if (req.method !== 'POST') return new Response('Method not allowed', { status: 405 });
  const origin = new URL(req.url).origin;
  let job: any = null;
  try {
    const claimed = await db('rpc/claim_next_handwriting_scan', { method: 'POST', body: '{}' });
    job = Array.isArray(claimed) ? claimed[0] : claimed;
    if (!job?.id) return new Response('No pending handwriting scans', { status: 202 });
    if (!GEMINI_KEY) throw Object.assign(new Error('Gemini vision service is not configured.'), { status: 503 });
    const pages = job.request_payload?.pages;
    if (!Array.isArray(pages) || pages.length < 1 || pages.length > 8) throw new Error('Queued scan payload is invalid.');
    const ai = new GoogleGenAI({ apiKey: GEMINI_KEY });
    const imageParts = pages.map((page: any) => ({ inlineData: { mimeType: page.mimeType, data: page.data } }));
    const prompt = `Read every attached handwritten examination page in exact order. Preserve every visible word, subpart, option, formula, unit, table and diagram label. Never invent missing text or answers. Do not solve questions. Classify multiple choice as section A and theory as section B. For every diagram, include a concise description in question_text as [Diagram: description] AND return a diagram_regions entry with page_index (zero-based) and normalized bounding box x,y,width,height between 0 and 1, enclosing only the diagram and its labels. Bounding boxes must be based on the original page image, not a guessed position; if uncertain, omit the region and add a review note. Return JSON only:
{"questions":[{"section":"A","question_number":1,"question_text":"...","option_a":"","option_b":"","option_c":"","option_d":"","marks":1,"confidence":"medium","review_notes":[]}],"diagram_regions":[{"question_number":1,"page_index":0,"x":0.1,"y":0.2,"width":0.4,"height":0.3,"description":"labelled circuit"}],"page_notes":[]}
Keep source order; do not infer correct_option unless explicitly marked in source. If no diagram is present, return an empty diagram_regions array.`;
    let response: any = null;
    let lastError: any = null;
    const models = ['gemini-3.8-flash', 'gemini-3.5-flash-lite', 'gemini-flash-latest'];
    for (const model of models) {
      for (let attempt = 1; attempt <= 2; attempt++) {
        try {
          response = await ai.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
            config: { responseMimeType: 'application/json', temperature: 0.1 },
          });
          if (response?.text) break;
          lastError = new Error('AI returned an empty response.');
        } catch (error: any) {
          lastError = error;
          const status = Number(error?.status || error?.code || 0);
          const message = String(error?.message || '');
          if ((status === 429 || status >= 500 || /timeout|temporarily unavailable|rate.?limit|resource_exhausted/i.test(message)) && attempt === 1) {
            await sleep(status === 429 ? 1500 : 500); continue;
          }
          if (status === 401 || status === 403 || /API key|authentication|permission denied/i.test(message)) throw error;
        }
      }
      if (response?.text) break;
    }
    if (!response?.text) throw lastError || new Error('AI returned no structured output.');
    let parsed: any;
    try { parsed = JSON.parse(response.text); } catch { throw new Error('AI returned invalid structured output.'); }
    const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).filter((q: any) =>
      q && typeof q.question_text === 'string' && q.question_text.trim() && ['A','B'].includes(q.section)
    ).slice(0, 100).map((q: any, i: number) => ({
      section: q.section,
      question_number: Number.isInteger(Number(q.question_number)) && Number(q.question_number) > 0 ? Number(q.question_number) : i + 1,
      question_text: String(q.question_text).slice(0, 5000),
      ...(q.section === 'A' ? { option_a: String(q.option_a || '').slice(0,2000), option_b: String(q.option_b || '').slice(0,2000), option_c: String(q.option_c || '').slice(0,2000), option_d: String(q.option_d || '').slice(0,2000) } : {}),
      marks: Number.isFinite(Number(q.marks)) && Number(q.marks) > 0 ? Math.min(100, Number(q.marks)) : (q.section === 'A' ? 1 : 10),
      confidence: ['high','medium','low'].includes(q.confidence) ? q.confidence : 'medium',
      review_notes: Array.isArray(q.review_notes) ? q.review_notes.filter((n: any) => typeof n === 'string').slice(0,8).map((n: string) => n.slice(0,300)) : [],
    }));
    if (!questions.length) throw new Error('No questions could be confidently extracted from these pages.');
    const diagrams = (Array.isArray(parsed.diagram_regions) ? parsed.diagram_regions : []).filter((d: any) =>
      Number.isInteger(d.page_index) && d.page_index >= 0 && d.page_index < pages.length &&
      Number.isFinite(d.x) && Number.isFinite(d.y) && Number.isFinite(d.width) && Number.isFinite(d.height) &&
      d.x >= 0 && d.y >= 0 && d.width > 0 && d.height > 0 && d.x + d.width <= 1.001 && d.y + d.height <= 1.001
    ).slice(0,30);
    await db('handwriting_scan_requests?id=eq.' + job.id, { method: 'PATCH', body: JSON.stringify({
      status: 'completed', result_data: { questions, diagram_regions: diagrams, page_notes: Array.isArray(parsed.page_notes) ? parsed.page_notes.slice(0,8) : [] },
      request_payload: { pages: [] }, error_message: null, updated_at: new Date().toISOString(), completed_at: new Date().toISOString(),
    }) });
  } catch (error: any) {
    const message = String(error?.message || 'Unknown handwriting scan error');
    const status = Number(error?.status || error?.code || 0);
    const retryable = status === 429 || status >= 500 || status === 0 || /timeout|temporarily unavailable|rate.?limit|resource_exhausted/i.test(message);
    if (job?.id) {
      const attempts = Number(job.attempts || 1);
      const willRetry = retryable && attempts < 3;
      const safe = /quota|rate.?limit|resource_exhausted/i.test(message)
        ? 'The handwriting service is busy. Your scan will be retried automatically.'
        : /api key|authentication|permission/i.test(message)
          ? 'Handwriting scanning is temporarily unavailable. The platform team has been notified.'
          : 'We could not read these pages on this attempt. The platform will retry if possible.';
      try {
        await db('handwriting_scan_requests?id=eq.' + job.id, { method: 'PATCH', body: JSON.stringify({
          status: willRetry ? 'pending' : 'failed', error_message: willRetry ? null : safe,
          request_payload: willRetry ? job.request_payload : { pages: [] },
          updated_at: new Date().toISOString(), ...(willRetry ? {} : { completed_at: new Date().toISOString() }),
        }) });
      } catch (dbError) { console.error('Could not persist handwriting scan failure', dbError); }
      try {
        const safeMessage = message.replace(/(?:Bearer\s+)[A-Za-z0-9._-]+/gi, 'Bearer [redacted]').replace(/(?:api[_ -]?key|authorization)\s*[:=]\s*[^\s,;]+/gi, '[credential redacted]').slice(0,1000);
        const triage = await analyzeIncident(safeMessage, status, attempts);
        await db('ai_operation_issues', { method: 'POST', headers: { Prefer: 'return=minimal' }, body: JSON.stringify({
          request_id: job.id, school_id: job.school_id, operation: 'handwriting_scan', stage: retryable ? 'queue_retry' : 'queue_worker',
          provider: 'gemini', model: null, http_status: status || null, error_code: retryable ? 'retryable_provider_failure' : 'handwriting_scan_failed',
          error_message: safeMessage, attempt_count: attempts, duration_ms: null,
          metadata: { page_count: Array.isArray(job.request_payload?.pages) ? job.request_payload.pages.length : null, retryable, will_retry: willRetry },
          ai_analysis: triage.analysis, ai_recommendation: triage.recommendation,
          repair_status: willRetry ? 'auto_retried' : triage.repairStatus,
          repair_attempted_at: new Date().toISOString(),
          repair_metadata: { executed_action: willRetry ? 'retry' : 'admin_review', ai_suggested_action: triage.action },
        }) });
      } catch (logError) { console.error('Could not log handwriting scan issue', logError); }
    }
    console.error('Handwriting queue worker failed', { jobId: job?.id, status: status || null, retryable, message: message.slice(0,240) });
  } finally {
    await wakeNext(origin);
  }
  return new Response('Handwriting scan worker finished', { status: 202 });
}
