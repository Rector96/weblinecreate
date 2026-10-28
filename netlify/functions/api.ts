import { GoogleGenAI } from '@google/genai';
import { generateExamDraft } from './_shared/examGeneration';

const groqApiKey = (process.env.GROQ_API_KEY || '').trim();
const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
const geminiAi = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const ai: any = groqApiKey
  ? {
      models: {
        generateContent: async ({ contents, config }: { contents: string; config?: { temperature?: number; responseMimeType?: string } }) => {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: { Authorization: `Bearer ${groqApiKey}`, 'Content-Type': 'application/json' },
            body: JSON.stringify({
              model: 'openai/gpt-oss-120b',
              messages: [
                { role: 'system', content: 'You generate high-quality Nigerian secondary school examination questions. Follow the user instructions exactly. When JSON is requested, return valid JSON only, without markdown fences.' },
                { role: 'user', content: contents },
              ],
              temperature: config?.temperature ?? 0.3,
              ...(config?.responseMimeType === 'application/json' ? { response_format: { type: 'json_object' } } : {}),
            }),
          });
          const result = await response.json() as any;
          if (!response.ok) {
            const error = new Error(result?.error?.message || `Groq API request failed with status ${response.status}`);
            (error as any).status = response.status;
            throw error;
          }
          return { text: result?.choices?.[0]?.message?.content || '' };
        },
      },
    }
  : geminiAi;

const MODELS = groqApiKey ? ['openai/gpt-oss-120b'] : ['gemini-2.0-flash', 'gemini-2.5-flash', 'gemini-flash-latest'];
const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const SUPABASE_ADMIN_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY;
const SUPABASE_ADMIN_USES_SECRET_API_KEY = !SUPABASE_SERVICE_ROLE_KEY && Boolean(SUPABASE_SECRET_KEY);
const SUPABASE_ANON_KEY = (process.env.SUPABASE_ANON_KEY || process.env.VITE_SUPABASE_ANON_KEY || '').trim();

function missingSupabaseServerConfig() {
  const missing: string[] = [];
  if (!SUPABASE_URL) missing.push('SUPABASE_URL (or VITE_SUPABASE_URL)');
  if (!SUPABASE_ADMIN_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY (or SUPABASE_SECRET_KEY)');
  return missing;
}
const PAYSTACK_SECRET_KEY = process.env.PAYSTACK_SECRET_KEY;
const SUBSCRIPTION_AMOUNT_KOBO = 1100000;
const ALLOWED_TERMS = new Set(['First Term', 'Second Term', 'Third Term']);

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}) {
  return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', ...headers } });
}

function getSiteUrl(req: Request) {
  const configured = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;
  return (configured || new URL(req.url).origin).replace(/\/$/, '');
}

async function supabaseAdminRequest(path: string, init: RequestInit = {}) {
  const missing = missingSupabaseServerConfig();
  if (missing.length) throw new Error(`Server Supabase configuration is missing: ${missing.join(', ')}.`);
  const response = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
    ...init,
    headers: {
      apikey: SUPABASE_ADMIN_KEY,
      ...(SUPABASE_ADMIN_USES_SECRET_API_KEY ? {} : { Authorization: `Bearer ${SUPABASE_ADMIN_KEY}` }),
      'Content-Type': 'application/json',
      ...(init.headers || {}),
    },
  });
  const raw = await response.text();
  const data = raw ? JSON.parse(raw) : null;
  if (!response.ok) {
    console.error('Supabase server request failed', { status: response.status, endpoint: path.split('?')[0].slice(0, 120), message: typeof data?.message === 'string' ? data.message.slice(0, 240) : 'Unknown' });
    if (data?.code === '23505' && typeof data?.message === 'string' && data.message.toLowerCase().includes('already has an exam for this subject')) throw new Error(data.message);
    throw new Error('Unable to complete the secure database operation.');
  }
  return data;
}

async function getAuthenticatedUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const authApiKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !SUPABASE_URL || !authApiKey) return null;
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, { headers: { apikey: authApiKey, Authorization: `Bearer ${token}` } });
    if (!response.ok) return null;
    const user = await response.json() as { id?: string; email?: string };
    return typeof user.id === 'string' ? { id: user.id, email: user.email } : null;
  } catch { return null; }
}

async function authorizeAiRequest(req: Request, schoolId: unknown) {
  const missingConfig = missingSupabaseServerConfig();
  if (missingConfig.length) return { ok: false as const, response: jsonResponse({ success: false, error: `AI authorization is not configured on the server. Missing: ${missingConfig.join(', ')}.` }, 503) };
  if (typeof schoolId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(schoolId)) {
    return { ok: false as const, response: jsonResponse({ success: false, error: 'A valid school account is required.' }, 400) };
  }
  const inviteToken = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
  if (inviteToken) {
    const result = await supabaseAdminRequest('rpc/consume_school_invite_ai_slot', { method: 'POST', body: JSON.stringify({ p_school_id: schoolId, p_invite_token: inviteToken }) }) as { allowed?: boolean; reason?: string };
    if (result?.allowed !== true) {
      if (result?.reason === 'rate_limit') return { ok: false as const, response: jsonResponse({ success: false, error: 'AI request limit reached. Please wait one minute and try again.' }, 429) };
      return { ok: false as const, response: jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 403) };
    }
    return { ok: true as const, userId: null };
  }
  const user = await getAuthenticatedUser(req);
  if (!user?.id) return { ok: false as const, response: jsonResponse({ success: false, error: 'Please sign in before using AI question generation.' }, 401) };
  const result = await supabaseAdminRequest('rpc/consume_ai_generation_slot', { method: 'POST', body: JSON.stringify({ p_user_id: user.id, p_school_id: schoolId }) }) as { allowed?: boolean; reason?: string };
  if (result?.allowed !== true) {
    if (result?.reason === 'user_rate' || result?.reason === 'school_rate') return { ok: false as const, response: jsonResponse({ success: false, error: 'AI request limit reached. Please wait one minute and try again.' }, 429) };
    return { ok: false as const, response: jsonResponse({ success: false, error: 'You are not authorized to use AI for this school.' }, 403) };
  }
  return { ok: true as const, userId: user.id };
}

export default async function handler(req: Request) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-School-Invite-Token, X-School-Id',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  };
  if (req.method === 'OPTIONS') return new Response(null, { status: 204, headers: corsHeaders });

  const url = new URL(req.url);
  let pathname = url.pathname;
  if (pathname.startsWith('/.netlify/functions/api')) pathname = pathname.replace('/.netlify/functions/api', '/api') || '/api';

  try {
    // Handwriting scan enqueue
    if (pathname.endsWith('/scan-handwritten-questions') && req.method === 'POST') {
      const requestId = crypto.randomUUID();
      const startedAt = Date.now();
      let schoolId: string | null = null;
      let pageCount = 0;
      try {
        const rawLength = Number(req.headers.get('content-length') || 0);
        if (rawLength > 7_000_000) return jsonResponse({ success: false, error: 'These photos are too large to queue safely. Scan fewer pages at a time.' }, 413, corsHeaders);
        const body = await req.json() as any;
        schoolId = typeof body?.school_id === 'string' ? body.school_id : null;
        const authorization = await authorizeAiRequest(req, schoolId);
        if (!authorization.ok) return authorization.response;
        if (!Array.isArray(body.pages) || body.pages.length < 1 || body.pages.length > 8) return jsonResponse({ success: false, error: 'Upload between 1 and 8 page photos per scan.' }, 400, corsHeaders);
        pageCount = body.pages.length;
        const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
        let totalBytes = 0;
        for (let i = 0; i < body.pages.length; i++) {
          const page = body.pages[i];
          if (!page || !allowedMime.has(page.mimeType) || typeof page.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(page.data)) {
            return jsonResponse({ success: false, error: 'Page ' + (i + 1) + ' is not a valid JPG, PNG, or WebP image.' }, 400, corsHeaders);
          }
          const bytes = Math.floor(page.data.length * 3 / 4);
          if (bytes > 2 * 1024 * 1024) return jsonResponse({ success: false, error: 'Each compressed page must be 2 MB or smaller.' }, 413, corsHeaders);
          totalBytes += bytes;
        }
        if (totalBytes > 4_500_000) return jsonResponse({ success: false, error: 'Combined compressed images exceed the queue limit. Scan 3–4 pages at a time.' }, 413, corsHeaders);
        const inviteToken = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
        let requesterTokenHash: string | null = null;
        if (inviteToken) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inviteToken));
          requesterTokenHash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        const inserted = await supabaseAdminRequest('handwriting_scan_requests', {
          method: 'POST', headers: { Prefer: 'return=representation' },
          body: JSON.stringify({
            id: requestId, school_id: schoolId, teacher_id: authorization.userId, requester_token_hash: requesterTokenHash,
            request_payload: { pages: body.pages }, status: 'pending',
          }),
        }) as any[];
        if (!inserted?.[0]?.id) throw new Error('Could not persist handwriting scan job.');
        try {
          const wake = await fetch(getSiteUrl(req) + '/.netlify/functions/handwriting-queue-worker-background', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: requestId }),
          });
          console.log('Handwriting worker wake', { requestId, status: wake.status, pageCount });
          if (!wake.ok) console.warn('Handwriting worker wake returned', wake.status, requestId);
        } catch (wakeError) {
          console.warn('Handwriting worker wake failed; job remains queued', requestId, wakeError);
        }
        return jsonResponse({ success: true, queued: true, request_id: requestId, status: 'pending' }, 202, corsHeaders);
      } catch (error: any) {
        console.error('Could not enqueue handwriting scan', { requestId, schoolId, message: String(error?.message || '').slice(0, 240) });
        return jsonResponse({ success: false, error: 'We could not add your scan to the queue. Please try again shortly.' }, 503, corsHeaders);
      }
    }

    if (pathname.endsWith('/scan-handwritten-questions') && req.method === 'GET') {
      const requestId = new URL(req.url).searchParams.get('id') || '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        return jsonResponse({ success: false, error: 'A valid scan request ID is required.' }, 400, corsHeaders);
      }
      try {
        const rows = await supabaseAdminRequest('handwriting_scan_requests?id=eq.' + requestId + '&select=id,school_id,teacher_id,requester_token_hash,status,result_data,error_message,updated_at&limit=1') as any[];
        const job = rows?.[0];
        if (!job) return jsonResponse({ success: false, error: 'Scan request not found.' }, 404, corsHeaders);
        const schoolId = (req.headers.get('x-school-id') || '').trim();
        if (!schoolId || schoolId !== job.school_id) return jsonResponse({ success: false, error: 'You are not allowed to view this scan.' }, 403, corsHeaders);
        let permitted = false;
        const inviteToken = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
        if (inviteToken && job.requester_token_hash) {
          const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inviteToken));
          const hash = Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
          permitted = hash === job.requester_token_hash;
        } else {
          const user = await getAuthenticatedUser(req);
          permitted = Boolean(user?.id && job.teacher_id && user.id === job.teacher_id);
        }
        if (!permitted) return jsonResponse({ success: false, error: 'You are not allowed to view this scan.' }, 403, corsHeaders);
        if (job.status === 'pending' || (job.status === 'processing' && Date.now() - Date.parse(job.updated_at || '') > 2 * 60 * 1000)) {
          void fetch(getSiteUrl(req) + '/.netlify/functions/handwriting-queue-worker-background', {
            method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ job_id: requestId }),
          }).catch(() => {});
        }
        return jsonResponse({
          success: true, request_id: job.id, status: job.status,
          data: job.status === 'completed' ? (job.result_data?.questions || []) : null,
          diagram_regions: job.status === 'completed' ? (job.result_data?.diagram_regions || []) : [],
          page_notes: job.status === 'completed' ? (job.result_data?.page_notes || []) : [],
          error: job.status === 'failed' ? job.error_message : null,
        }, 200, corsHeaders);
      } catch (error) {
        console.error('Could not read handwriting scan status', error);
        return jsonResponse({ success: false, error: 'Could not check scan progress. Please try again.' }, 503, corsHeaders);
      }
    }

    // Keep other routes available via generateExamDraft import side-effects path for exam queue
    if (pathname.endsWith('/generate-questions') && req.method === 'POST') {
      return jsonResponse({ success: false, error: 'API core was partially restored. Redeploy latest main after full api.ts restore if other routes fail. Handwriting scan endpoints are active.' }, 503, corsHeaders);
    }

    return jsonResponse({ success: false, error: 'Not found' }, 404, corsHeaders);
  } catch (error) {
    console.error('API handler error', error);
    return jsonResponse({ success: false, error: 'Unexpected server error' }, 500, corsHeaders);
  }
}

export const config = {
  path: ['/api/scan-handwritten-questions', '/api/generate-questions'],
};
