import { GoogleGenAI } from '@google/genai';
import { generateExamDraft } from './_shared/examGeneration';

// Prefer Groq when configured; fall back to Gemini when no Groq key is available.
// Both keys stay exclusively in the server-side Netlify Function runtime.
const groqApiKey = (process.env.GROQ_API_KEY || '').trim();
const geminiApiKey = (process.env.GEMINI_API_KEY || process.env.GOOGLE_API_KEY || '').trim();
const geminiAi = geminiApiKey ? new GoogleGenAI({ apiKey: geminiApiKey }) : null;
const ai: any = groqApiKey
  ? {
      models: {
        generateContent: async ({ contents, config }: { contents: string; config?: { temperature?: number; responseMimeType?: string } }) => {
          const response = await fetch('https://api.groq.com/openai/v1/chat/completions', {
            method: 'POST',
            headers: {
              Authorization: `Bearer ${groqApiKey}`,
              'Content-Type': 'application/json',
            },
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

// Groq uses one configured model; Gemini retains its model fallback list.
const MODELS = groqApiKey
  ? ['openai/gpt-oss-120b']
  : ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];

const SUPABASE_URL = (process.env.SUPABASE_URL || process.env.VITE_SUPABASE_URL || '').trim().replace(/\/$/, '');
// Prefer the legacy service-role JWT when configured. Supabase's newer sb_secret_
// API keys are also supported; they must be sent as apikey, not as a JWT bearer.
const SUPABASE_SERVICE_ROLE_KEY = (process.env.SUPABASE_SERVICE_ROLE_KEY || '').trim();
const SUPABASE_SECRET_KEY = (process.env.SUPABASE_SECRET_KEY || '').trim();
const SUPABASE_ADMIN_KEY = SUPABASE_SERVICE_ROLE_KEY || SUPABASE_SECRET_KEY;
const SUPABASE_ADMIN_USES_SECRET_API_KEY = !SUPABASE_SERVICE_ROLE_KEY && Boolean(SUPABASE_SECRET_KEY);
// Supabase Auth's apikey header should use the project publishable/anon key;
// the user's access token remains the Authorization bearer token.
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
  return new Response(JSON.stringify(body), {
    status,
    headers: { 'Content-Type': 'application/json', ...headers },
  });
}

function getSiteUrl(req: Request) {
  const configured = process.env.SITE_URL || process.env.URL || process.env.DEPLOY_PRIME_URL;
  return (configured || new URL(req.url).origin).replace(/\/$/, '');
}

async function supabaseAdminRequest(path: string, init: RequestInit = {}) {
  const missing = missingSupabaseServerConfig();
  if (missing.length) {
    console.error('Supabase server configuration is missing:', missing.join(', '));
    throw new Error(`Server Supabase configuration is missing: ${missing.join(', ')}.`);
  }
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
    console.error('Supabase server request failed', response.status, data);
    if (data?.code === '23505' && typeof data?.message === 'string' && data.message.toLowerCase().includes('already has an exam for this subject')) {
      throw new Error(data.message);
    }
    throw new Error('Unable to complete the secure database operation.');
  }
  return data;
}

async function getAuthenticatedUser(req: Request) {
  const token = req.headers.get('authorization')?.replace(/^Bearer\s+/i, '').trim();
  const authApiKey = SUPABASE_ANON_KEY || SUPABASE_SERVICE_ROLE_KEY;
  if (!token || !SUPABASE_URL || !authApiKey) return null;
  try {
    const response = await fetch(`${SUPABASE_URL.replace(/\/$/, '')}/auth/v1/user`, {
      headers: {
        apikey: authApiKey,
        Authorization: `Bearer ${token}`,
      },
    });
    if (!response.ok) {
      console.warn('Supabase access-token validation failed with status', response.status);
      return null;
    }
    const user = await response.json() as { id?: string; email?: string };
    return typeof user.id === 'string' ? { id: user.id, email: user.email } : null;
  } catch (error) {
    console.error('Could not validate Supabase access token', error);
    return null;
  }
}


async function authorizeAiRequest(req: Request, schoolId: unknown) {
  const missingConfig = missingSupabaseServerConfig();
  if (missingConfig.length) {
    console.error('AI authorization is unavailable; missing server config:', missingConfig.join(', '));
    return { ok: false as const, response: jsonResponse({ success: false, error: `AI authorization is not configured on the server. Missing Netlify Function variable(s): ${missingConfig.join(', ')}. Set them in Netlify environment variables with Functions scope, then redeploy.` }, 503) };
  }
  if (typeof schoolId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(schoolId)) {
    return { ok: false as const, response: jsonResponse({ success: false, error: 'A valid school account is required.' }, 400) };
  }
  const inviteToken = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
  if (inviteToken) {
    const result = await supabaseAdminRequest('rpc/consume_school_invite_ai_slot', {
      method: 'POST',
      body: JSON.stringify({ p_school_id: schoolId, p_invite_token: inviteToken }),
    }) as { allowed?: boolean; reason?: string };
    if (result?.allowed !== true) {
      if (result?.reason === 'rate_limit') return { ok: false as const, response: jsonResponse({ success: false, error: 'AI request limit reached. Please wait one minute and try again.' }, 429) };
      return { ok: false as const, response: jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 403) };
    }
    return { ok: true as const, userId: null };
  }
  const user = await getAuthenticatedUser(req);
  if (!user?.id) return { ok: false as const, response: jsonResponse({ success: false, error: 'Please sign in before using AI question generation.' }, 401) };
  const result = await supabaseAdminRequest('rpc/consume_ai_generation_slot', {
    method: 'POST',
    body: JSON.stringify({ p_user_id: user.id, p_school_id: schoolId }),
  }) as { allowed?: boolean; reason?: string };
  if (result?.allowed !== true) {
    if (result?.reason === 'user_rate' || result?.reason === 'school_rate') {
      return { ok: false as const, response: jsonResponse({ success: false, error: 'AI request limit reached. Please wait one minute and try again.' }, 429) };
    }
    if (result?.reason === 'school_suspended') {
      return { ok: false as const, response: jsonResponse({ success: false, error: 'This school account is suspended. Contact ROCKCRAF support.' }, 403) };
    }
    if (result?.reason === 'generation_disabled') {
      return { ok: false as const, response: jsonResponse({ success: false, error: 'Exam generation has been disabled for this school by the platform administrator.' }, 403) };
    }
    return { ok: false as const, response: jsonResponse({ success: false, error: 'You are not authorized to use AI for this school.' }, 403) };
  }
  return { ok: true as const, userId: user.id };
}

function validAiInputs(body: any) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) return false;
  const fields = ['subject', 'class_name', 'term', 'topics', 'difficulty', 'instructions'];
  for (const key of fields) {
    if (body[key] !== undefined && (typeof body[key] !== 'string' || body[key].length > (key === 'instructions' || key === 'topics' ? 3000 : 120))) return false;
  }
  if (body.subject !== undefined && !body.subject.trim()) return false;
  if (body.class_name !== undefined && !body.class_name.trim()) return false;
  if (body.num_objectives !== undefined && (!Number.isInteger(Number(body.num_objectives)) || Number(body.num_objectives) < 5 || Number(body.num_objectives) > 50)) return false;
  if (body.num_theories !== undefined && (!Number.isInteger(Number(body.num_theories)) || Number(body.num_theories) < 1 || Number(body.num_theories) > 6)) return false;
  if (body.count !== undefined && (!Number.isInteger(Number(body.count)) || Number(body.count) < 1 || Number(body.count) > 20)) return false;
  if (body.section !== undefined && !['A', 'B'].includes(body.section)) return false;
  for (const key of ['question_number', 'start_number']) {
    if (body[key] !== undefined && (!Number.isInteger(Number(body[key])) || Number(body[key]) < 1 || Number(body[key]) > 200)) return false;
  }
  return true;
}

async function initializePaystackPayment(req: Request) {
  if (!PAYSTACK_SECRET_KEY || missingSupabaseServerConfig().length) {
    return jsonResponse({ error: 'Secure payments are not configured. No payment has been taken.' }, 503);
  }
  const user = await getAuthenticatedUser(req);
  if (!user?.id || !user.email) return jsonResponse({ error: 'Please sign in again before making a payment.' }, 401);

  const body = await req.json() as { school_id?: string; term?: string; session?: string };
  const schoolId = body.school_id?.trim();
  const term = body.term?.trim();
  const session = body.session?.trim();
  if (!schoolId || !term || !ALLOWED_TERMS.has(term) || !session || !/^[0-9]{4}\/[0-9]{4}$/.test(session)) {
    return jsonResponse({ error: 'Invalid school, term, or academic session.' }, 400);
  }

  const userId = encodeURIComponent(user.id);
  const [profiles, roles] = await Promise.all([
    supabaseAdminRequest(`profiles?user_id=eq.${userId}&select=user_id,school_id,full_name,email`),
    supabaseAdminRequest(`user_roles?user_id=eq.${userId}&select=role,school_id`),
  ]) as [Array<{ user_id: string; school_id: string | null; full_name: string; email: string }>, Array<{ role: string; school_id: string | null }>];

  const profile = profiles[0];
  const isPlatformAdmin = roles.some((row) => row.role === 'platform_admin');
  const isSchoolAdmin = roles.some((row) => row.role === 'school_admin' && row.school_id === schoolId);
  if (!profile || (!isPlatformAdmin && (profile.school_id !== schoolId || !isSchoolAdmin))) {
    return jsonResponse({ error: 'You are not authorized to purchase a subscription for this school.' }, 403);
  }

  const schools = await supabaseAdminRequest(`schools?id=eq.${encodeURIComponent(schoolId)}&select=id,name,email,subscription_status`) as Array<{ id: string; name: string; email: string; subscription_status: string }>;
  const school = schools[0];
  if (!school) return jsonResponse({ error: 'School was not found.' }, 404);

  const reference = `ROCKCRAF-${crypto.randomUUID()}`;
  await supabaseAdminRequest('payments', {
    method: 'POST',
    headers: { Prefer: 'return=minimal' },
    body: JSON.stringify({
      school_id: school.id,
      school_name: school.name,
      amount_ngn: 11000,
      reference,
      status: 'pending',
      term,
      session,
      channel: 'paystack',
    }),
  });

  const siteUrl = getSiteUrl(req);
  const callbackUrl = new URL('/api/verify-payment', siteUrl);
  const paystackResponse = await fetch('https://api.paystack.co/transaction/initialize', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${PAYSTACK_SECRET_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      email: user.email,
      amount: SUBSCRIPTION_AMOUNT_KOBO,
      reference,
      callback_url: callbackUrl.toString(),
      metadata: { school_id: school.id, term, session, user_id: user.id },
    }),
  });
  const paystackResult = await paystackResponse.json() as {
    status?: boolean;
    message?: string;
    data?: { authorization_url?: string };
  };

  if (!paystackResponse.ok || !paystackResult.status || !paystackResult.data?.authorization_url) {
    await supabaseAdminRequest(`payments?reference=eq.${encodeURIComponent(reference)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'failed' }),
    });
    console.error('Paystack initialization failed', paystackResult.message || paystackResponse.status);
    return jsonResponse({ error: 'Paystack could not start checkout. No payment has been taken.' }, 502);
  }

  return jsonResponse({ authorization_url: paystackResult.data.authorization_url, reference });
}

async function verifyPaystackPayment(req: Request) {
  const url = new URL(req.url);
  const reference = url.searchParams.get('reference')?.trim();
  const siteUrl = getSiteUrl(req);
  const resultUrl = (status: 'success' | 'failed') => {
    const destination = new URL('/', siteUrl);
    destination.searchParams.set('payment', status);
    if (reference) destination.searchParams.set('reference', reference);
    return Response.redirect(destination.toString(), 303);
  };

  if (!reference || !PAYSTACK_SECRET_KEY || missingSupabaseServerConfig().length) {
    return resultUrl('failed');
  }

  try {
    const rows = await supabaseAdminRequest(`payments?reference=eq.${encodeURIComponent(reference)}&select=id,school_id,amount_ngn,status,term,session`) as Array<{
      id: string; school_id: string; amount_ngn: number; status: string; term: string; session: string;
    }>;
    const payment = rows[0];
    if (!payment) return resultUrl('failed');
    if (payment.status === 'success') return resultUrl('success');

    const verifyResponse = await fetch(`https://api.paystack.co/transaction/verify/${encodeURIComponent(reference)}`, {
      headers: { Authorization: `Bearer ${PAYSTACK_SECRET_KEY}` },
    });
    const verified = await verifyResponse.json() as {
      status?: boolean;
      data?: { status?: string; reference?: string; amount?: number; currency?: string; channel?: string };
    };
    if (
      !verifyResponse.ok || !verified.status ||
      verified.data?.status !== 'success' ||
      verified.data.reference !== reference ||
      verified.data.amount !== SUBSCRIPTION_AMOUNT_KOBO ||
      verified.data.currency !== 'NGN'
    ) {
      await supabaseAdminRequest(`payments?reference=eq.${encodeURIComponent(reference)}`, {
        method: 'PATCH',
        headers: { Prefer: 'return=minimal' },
        body: JSON.stringify({ status: 'failed' }),
      });
      return resultUrl('failed');
    }

    const paidAt = new Date().toISOString();
    const expiry = new Date(Date.now() + 120 * 24 * 60 * 60 * 1000).toISOString();
    await supabaseAdminRequest(`payments?reference=eq.${encodeURIComponent(reference)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ status: 'success', paid_at: paidAt, channel: verified.data.channel || 'paystack' }),
    });
    await supabaseAdminRequest(`schools?id=eq.${encodeURIComponent(payment.school_id)}`, {
      method: 'PATCH',
      headers: { Prefer: 'return=minimal' },
      body: JSON.stringify({ subscription_status: 'active', subscription_expires_at: expiry }),
    });
    return resultUrl('success');
  } catch (error) {
    console.error('Paystack verification failed', error);
    return resultUrl('failed');
  }
}

export default async (req: Request) => {
  const url = new URL(req.url);
  const pathname = url.pathname;

  // Set CORS headers
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-School-Invite-Token',
    'Content-Type': 'application/json',
  };

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (pathname.endsWith('/sitemap.xml') && req.method === 'GET') {
    const origin = getSiteUrl(req).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    const xml = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n  <url><loc>${origin}/</loc><changefreq>daily</changefreq><priority>1.0</priority></url>\n</urlset>`;
    return new Response(xml, { status: 200, headers: { 'Content-Type': 'application/xml; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }

  // Privacy-conscious platform activity heartbeat. The browser sends only random
  // anonymous IDs, optional authenticated identity, school ID, and current route.
  if (pathname.endsWith('/platform-activity') && req.method === 'POST') {
    try {
      if (Number(req.headers.get('content-length') || 0) > 4096) {
        return jsonResponse({ success: false, error: 'Activity payload is too large.' }, 413, { 'Cache-Control': 'no-store' });
      }
      const body = await req.json() as { session_id?: unknown; visitor_id?: unknown; school_id?: unknown; page_path?: unknown };
      const sessionId = typeof body.session_id === 'string' ? body.session_id.trim() : '';
      const visitorId = typeof body.visitor_id === 'string' ? body.visitor_id.trim() : '';
      if (sessionId.length < 16 || sessionId.length > 100 || visitorId.length < 16 || visitorId.length > 100) {
        return jsonResponse({ success: false, error: 'Invalid activity IDs.' }, 400, { 'Cache-Control': 'no-store' });
      }
      const user = await getAuthenticatedUser(req);
      const schoolId = typeof body.school_id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.school_id.trim())
        ? body.school_id.trim()
        : null;
      const pagePath = typeof body.page_path === 'string' ? body.page_path.slice(0, 240) : '/';
      await supabaseAdminRequest('rpc/record_platform_activity', {
        method: 'POST',
        body: JSON.stringify({ p_session_id: sessionId, p_visitor_id: visitorId, p_user_id: user?.id || null, p_school_id: schoolId, p_page_path: pagePath }),
      });
      return jsonResponse({ success: true }, 200, { 'Cache-Control': 'no-store' });
    } catch (error) {
      console.error('Platform activity heartbeat failed', error);
      return jsonResponse({ success: false, error: 'Activity could not be recorded.' }, 503, { 'Cache-Control': 'no-store' });
    }
  }

  // Public invite preview: reveal school branding and curriculum options for a valid, active share link.
  if (pathname.endsWith('/school-invite') && req.method === 'GET') {
    try {
      const token = (url.searchParams.get('token') || '').trim().toUpperCase();
      if (!/^[A-Z2-9]{6}$/.test(token)) return jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 404, { 'Cache-Control': 'no-store' });
      const invitations = await supabaseAdminRequest(`school_invitations?token=eq.${encodeURIComponent(token)}&role=eq.teacher&is_active=eq.true&select=school_id,expires_at&limit=1`) as Array<{ school_id: string; expires_at: string | null }>;
      if (!invitations[0]?.school_id || (invitations[0].expires_at && new Date(invitations[0].expires_at).getTime() <= Date.now())) {
        return jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 404, { 'Cache-Control': 'no-store' });
      }
      const schools = await supabaseAdminRequest(`schools?id=eq.${encodeURIComponent(invitations[0].school_id)}&select=id,name,logo_url,motto,address,institution_type,subscription_status,subscription_expires_at&limit=1`) as Array<{ id: string; name: string; logo_url?: string; motto?: string; address?: string; institution_type?: string; subscription_status?: string; subscription_expires_at?: string | null }>;
      const school = schools[0];
      if (!school?.name) return jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 404, { 'Cache-Control': 'no-store' });
      const classes = await supabaseAdminRequest(`school_classes?school_id=eq.${encodeURIComponent(school.id)}&select=id,name,level,display_order&order=display_order.asc`) as Array<{ id: string; name: string; level: string; display_order: number }>;
      const subjects = await supabaseAdminRequest(`school_subjects?school_id=eq.${encodeURIComponent(school.id)}&is_active=eq.true&select=name&order=name.asc`) as Array<{ name: string }>;
      return jsonResponse({
        success: true,
        school_name: school.name,
        school: {
          id: school.id, name: school.name, logo_url: school.logo_url || '', motto: school.motto || '',
          address: school.address || '', institution_type: school.institution_type || 'Secondary',
          subscription_status: school.subscription_status || 'trial',
          subscription_expires_at: school.subscription_expires_at || undefined,
          ai_exams_used: 0, manual_exams_used: 0, max_trial_ai_exams: 4, max_trial_manual_exams: 5,
          admin_name: '', email: '', phone: '', state: '', lga: '', created_at: new Date().toISOString(),
          classes: classes.map((item) => ({ id: item.id, name: item.name, level: item.level, display_order: item.display_order })),
          subjects: subjects.map((item) => item.name)
        }
      }, 200, { 'Cache-Control': 'no-store' });
    } catch (error) {
      console.error('School invite preview failed', error);
      const missingConfig = missingSupabaseServerConfig();
      if (missingConfig.length) {
        return jsonResponse({ success: false, error: `School link verification is not configured on the server. Missing Netlify Function variable(s): ${missingConfig.join(', ')}. Set them with Functions scope, then redeploy.` }, 503, { 'Cache-Control': 'no-store' });
      }
      return jsonResponse({ success: false, error: 'Unable to verify this school link right now. Check the Netlify Function logs for the Supabase request error.' }, 503, { 'Cache-Control': 'no-store' });
    }
  }

  // Check a class/subject slot before the teacher starts generating an exam.
  if (pathname.endsWith('/check-exam-conflict') && req.method === 'GET') {
    try {
      const token = (url.searchParams.get('token') || '').trim().toUpperCase();
      const className = (url.searchParams.get('class_name') || '').trim();
      const subject = (url.searchParams.get('subject') || '').trim();
      const term = (url.searchParams.get('term') || '').trim();
      const session = (url.searchParams.get('session') || '').trim();
      if (!/^[A-Z2-9]{6}$/.test(token) || !className || !subject || !term || !session || [className, subject, term, session].some((value) => value.length > 120)) {
        return jsonResponse({ success: false, error: 'Please choose a valid class, subject, term and session.' }, 400, { 'Cache-Control': 'no-store' });
      }
      const invites = await supabaseAdminRequest('school_invitations?token=eq.' + encodeURIComponent(token) + '&role=eq.teacher&is_active=eq.true&select=school_id,expires_at&limit=1') as Array<{ school_id: string; expires_at: string | null }>;
      const invite = invites[0];
      if (!invite?.school_id || (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now())) {
        return jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 403, { 'Cache-Control': 'no-store' });
      }
      const matches = await supabaseAdminRequest(
        'exams?school_id=eq.' + encodeURIComponent(invite.school_id) + '&status=eq.published' +
        '&class_name=ilike.' + encodeURIComponent(className) + '&subject=ilike.' + encodeURIComponent(subject) +
        '&term=eq.' + encodeURIComponent(term) + '&session=eq.' + encodeURIComponent(session) + '&select=id&limit=1'
      ) as Array<{ id: string }>;
      if (matches.length) {
        return jsonResponse({ success: false, conflict: true, error: className + ' already has a ' + subject + ' exam for ' + term + ', ' + session + '. Choose another subject, term or session.' }, 409, { 'Cache-Control': 'no-store' });
      }
      return jsonResponse({ success: true, conflict: false }, 200, { 'Cache-Control': 'no-store' });
    } catch (error) {
      console.error('Exam class/subject conflict check failed', error);
      return jsonResponse({ success: false, error: 'Could not check the class subject schedule. Please try again.' }, 503, { 'Cache-Control': 'no-store' });
    }
  }

  // Passwordless teachers publish only through a valid school invitation capability.
  if (pathname.endsWith('/publish-exam') && req.method === 'POST') {
    try {
      if (Number(req.headers.get('content-length') || 0) > 500000) return jsonResponse({ success: false, error: 'Exam payload is too large.' }, 413);
      const token = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
      if (!token || !/^[A-Z2-9]{6}$/.test(token)) return jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 403);
      const body = await req.json() as any;
      if (!body || typeof body !== 'object' || !body.exam || typeof body.exam !== 'object' || !Array.isArray(body.questions) || body.questions.length < 1 || body.questions.length > 100 || typeof body.is_ai !== 'boolean') {
        return jsonResponse({ success: false, error: 'Exam details and valid questions are required.' }, 400);
      }
      if (typeof body.exam.school_id !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(body.exam.school_id)) {
        return jsonResponse({ success: false, error: 'A valid school account is required.' }, 400);
      }
      // Resolve the share token to its issuing school before accepting the exam payload.
      const inviteRows = await supabaseAdminRequest(
        'school_invitations?token=eq.' + encodeURIComponent(token) + '&role=eq.teacher&is_active=eq.true&select=school_id,expires_at&limit=1'
      ) as Array<{ school_id: string; expires_at: string | null }>;
      const invite = inviteRows[0];
      if (!invite?.school_id || (invite.expires_at && new Date(invite.expires_at).getTime() <= Date.now())) {
        return jsonResponse({ success: false, error: 'This school link is invalid or expired.' }, 403);
      }
      if (invite.school_id !== body.exam.school_id) {
        return jsonResponse({ success: false, error: 'This exam must be published to the school that issued this link.' }, 403);
      }
      const schoolControlRows = await supabaseAdminRequest(
        'schools?id=eq.' + encodeURIComponent(body.exam.school_id) + '&select=account_status,generation_enabled&limit=1'
      ) as Array<{ account_status?: string; generation_enabled?: boolean }>;
      const schoolControls = schoolControlRows[0];
      if (!schoolControls) return jsonResponse({ success: false, error: 'School account was not found.' }, 404);
      if (schoolControls.account_status === 'suspended') {
        return jsonResponse({ success: false, code: 'school_suspended', error: 'This school account is suspended. Contact ROCKCRAF support.' }, 403);
      }
      if (schoolControls.generation_enabled === false) {
        return jsonResponse({ success: false, code: 'generation_blocked', error: 'Exam generation has been disabled for this school by the platform administrator.' }, 403);
      }

      const publishResult = await supabaseAdminRequest('rpc/publish_exam_with_invite', {
        method: 'POST',
        body: JSON.stringify({
          p_exam: body.exam,
          p_questions: body.questions,
          p_is_ai: body.is_ai,
          p_invite_token: token,
        }),
      }) as any;
      if (!publishResult?.success) {
        const status = publishResult?.code === 'quota_exceeded' ? 409 : 403;
        return jsonResponse({ success: false, code: publishResult?.code, error: publishResult?.message || 'The exam could not be published.' }, status);
      }
      const row = publishResult.exam || {};
      const exam = {
        ...row,
        created_by: row.created_by || '',
        created_by_name: row.created_by_name || body.exam.created_by_name || 'Teacher',
        questions: Array.isArray(publishResult.questions) ? publishResult.questions : [],
      };
      return jsonResponse({ success: true, exam, quota: publishResult.quota });
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      if (detail.toLowerCase().includes('already has an exam for this subject')) {
        return jsonResponse({ success: false, code: 'duplicate_class_subject', error: detail }, 409);
      }
      if (detail.toLowerCase().includes('school account is suspended') || detail.toLowerCase().includes('exam generation has been disabled')) {
        return jsonResponse({ success: false, code: 'generation_blocked', error: detail }, 403);
      }
      console.error('Passwordless exam publication failed', error);
      return jsonResponse({ success: false, error: 'Unable to publish this exam securely. Please try again.' }, 500);
    }
  }

  if (pathname.endsWith('/initialize-payment') && req.method === 'POST') {
    try {
      return await initializePaystackPayment(req);
    } catch (error) {
      console.error('Payment initialization error', error);
      return jsonResponse({ error: 'Unable to initialize payment securely. No payment has been taken.' }, 500);
    }
  }

  if (pathname.endsWith('/verify-payment') && req.method === 'GET') {
    return await verifyPaystackPayment(req);
  }

  // Gemini scanner diagnostics: proves the configured key can actually call a model without exposing the key.
  if (pathname.endsWith('/gemini-scan-status') && req.method === 'POST') {
    try {
      const body = await req.json() as any;
      const schoolId = body?.school_id || req.headers.get('x-school-id');
      const authorization = await authorizeAiRequest(req, schoolId);
      if (!authorization.ok) return authorization.response;
      if (!geminiAi || !geminiApiKey) {
        return jsonResponse({ success: false, configured: false, provider: 'Gemini', message: 'Gemini is not configured on this deployment. Add GEMINI_API_KEY to Netlify Functions environment variables and redeploy.' }, 503, corsHeaders);
      }
      const candidates = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
      const failures: string[] = [];
      for (const model of candidates) {
        try {
          const result = await geminiAi.models.generateContent({
            model,
            contents: 'Reply with exactly: GEMINI_SCAN_READY',
            config: { temperature: 0, maxOutputTokens: 20 },
          });
          const reply = String(result.text || '').trim();
          if (!reply) throw new Error('Model returned an empty response.');
          return jsonResponse({ success: true, configured: true, provider: 'Gemini', model, message: 'Gemini connection test passed. The scanner can reach this model.', checked_at: new Date().toISOString() }, 200, corsHeaders);
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error);
          const status = Number(error?.status || error?.code) || 0;
          failures.push(model + ': ' + (status ? status + ' ' : '') + message.slice(0, 180));
          if (status === 401 || status === 403 || /API key not valid|invalid api key|permission denied|unauthorized/i.test(message)) break;
        }
      }
      console.error('Gemini scanner connection test failed:', failures);
      const authFailure = failures.some(item => /401|403|invalid api key|permission denied|unauthorized/i.test(item));
      return jsonResponse({ success: false, configured: true, provider: 'Gemini', message: authFailure
        ? 'Gemini key was rejected or lacks permission. Verify the key in Google AI Studio and Netlify Functions, then redeploy.'
        : 'Gemini is configured, but none of the tested models responded successfully. Check model availability, quota and billing in Google AI Studio.',
        diagnostics: failures, checked_at: new Date().toISOString() }, authFailure ? 401 : 503, corsHeaders);
    } catch (error: any) {
      console.error('Gemini scanner status check failed:', String(error?.message || error).slice(0, 300));
      return jsonResponse({ success: false, message: 'Could not complete the Gemini connection test. Check deployment logs.' }, 500, corsHeaders);
    }
  }

  // Vision-based extraction of handwritten exam pages. Uses Gemini independently of the text-generation provider.
  if (pathname.endsWith('/scan-handwritten-questions') && req.method === 'POST') {
    try {
      const rawLength = Number(req.headers.get('content-length') || 0);
      if (rawLength > 38_000_000) return jsonResponse({ success: false, error: 'Images are too large. Upload fewer or smaller page photos.' }, 413, corsHeaders);
      if (!geminiAi || !geminiApiKey) return jsonResponse({ success: false, error: 'Handwriting scanning needs GEMINI_API_KEY in Netlify Functions environment. Add it and redeploy.' }, 503, corsHeaders);
      const body = await req.json() as any;
      const schoolId = body?.school_id || req.headers.get('x-school-id');
      const authorization = await authorizeAiRequest(req, schoolId);
      if (!authorization.ok) return authorization.response;
      if (!Array.isArray(body.pages) || body.pages.length < 1 || body.pages.length > 8) {
        return jsonResponse({ success: false, error: 'Upload between 1 and 8 page photos per scan.' }, 400, corsHeaders);
      }
      const allowedMime = new Set(['image/jpeg', 'image/png', 'image/webp']);
      let totalBytes = 0;
      const imageParts = body.pages.map((page: any, index: number) => {
        if (!page || !allowedMime.has(page.mimeType) || typeof page.data !== 'string' || !/^[A-Za-z0-9+/]+={0,2}$/.test(page.data)) {
          throw new Error('Page ' + (index + 1) + ' is not a valid JPG, PNG, or WebP image.');
        }
        const estimatedBytes = Math.floor(page.data.length * 3 / 4);
        totalBytes += estimatedBytes;
        if (estimatedBytes > 8 * 1024 * 1024) throw new Error('Each page photo must be 8 MB or smaller.');
        return { inlineData: { mimeType: page.mimeType, data: page.data } };
      });
      if (totalBytes > 28 * 1024 * 1024) return jsonResponse({ success: false, error: 'Combined image size is too large. Scan fewer pages at a time.' }, 413, corsHeaders);
      const prompt = `You are a meticulous document-reading assistant helping a teacher digitize handwritten examination papers. Analyze EVERY attached page in the exact order provided; do not skip page edges, continuation lines, question subparts, answer choices, formulas, units, tables, or diagram labels. Extract only what is actually present; never invent missing text, options, correct answers, marks, or answer keys. Join a question continued across pages into one question. Preserve mathematical notation as readable plain text/LaTeX where appropriate. Classify multiple-choice questions as section A and theory/essay questions as section B. If the page contains a diagram, describe it briefly in question_text using [Diagram: ...] and preserve every legible label. If handwriting or a symbol is uncertain, choose the most plausible reading only when context strongly supports it and add a review_notes entry explaining the uncertainty. Set confidence to low/medium/high based on legibility. Do not solve questions and do not infer correct_option unless the source explicitly marks an answer key. For objective questions extract all four options where present; if an option is absent or unreadable, leave it as an empty string and flag it. Return JSON only with this exact shape:
{"questions":[{"section":"A","question_number":1,"question_text":"...","option_a":"...","option_b":"...","option_c":"...","option_d":"...","correct_option":"","marks":1,"confidence":"medium","review_notes":["..."]},{"section":"B","question_number":1,"question_text":"...","marks":10,"confidence":"high","review_notes":[]}],"page_notes":["..."]}
Keep source order and question numbering where readable; renumber only when numbering is absent. Exclude page headers, names, school addresses and unrelated notes unless they form part of a question.`;
      const candidates = ['gemini-2.5-flash', 'gemini-flash-latest', 'gemini-2.5-flash-lite'];
      let response: any = null;
      let activeModel = '';
      const modelFailures: string[] = [];
      for (const model of candidates) {
        try {
          response = await geminiAi.models.generateContent({
            model,
            contents: [{ role: 'user', parts: [{ text: prompt }, ...imageParts] }],
            config: { responseMimeType: 'application/json', temperature: 0.1 },
          });
          if (!String(response?.text || '').trim()) throw new Error('Model returned an empty response.');
          activeModel = model;
          break;
        } catch (modelError: any) {
          const detail = modelError instanceof Error ? modelError.message : String(modelError);
          const modelStatus = Number(modelError?.status || modelError?.code) || 0;
          modelFailures.push(model + ': ' + (modelStatus ? modelStatus + ' ' : '') + detail.slice(0, 180));
          if (modelStatus === 401 || modelStatus === 403 || /invalid api key|permission denied|unauthorized/i.test(detail)) throw modelError;
          if (modelStatus === 429 || /quota|rate.?limit/i.test(detail)) throw modelError;
        }
      }
      if (!response) {
        const modelError = new Error('Gemini could not process this scan with the available models. ' + modelFailures.join(' | '));
        (modelError as any).modelFailures = modelFailures;
        throw modelError;
      }
      let parsed: any;
      try { parsed = JSON.parse(response.text || '{}'); }
      catch { throw new Error('Gemini responded, but its question data was not valid JSON. Please retry the scan.'); }
      const questions = (Array.isArray(parsed.questions) ? parsed.questions : []).filter((q: any) =>
        q && typeof q.question_text === 'string' && q.question_text.trim() &&
        (q.section === 'A' || q.section === 'B')
      ).slice(0, 100).map((q: any, i: number) => ({
        section: q.section,
        question_number: Number.isInteger(Number(q.question_number)) && Number(q.question_number) > 0 ? Number(q.question_number) : i + 1,
        question_text: String(q.question_text).slice(0, 5000),
        ...(q.section === 'A' ? {
          option_a: typeof q.option_a === 'string' ? q.option_a.slice(0, 2000) : '',
          option_b: typeof q.option_b === 'string' ? q.option_b.slice(0, 2000) : '',
          option_c: typeof q.option_c === 'string' ? q.option_c.slice(0, 2000) : '',
          option_d: typeof q.option_d === 'string' ? q.option_d.slice(0, 2000) : '',
          ...(typeof q.correct_option === 'string' && ['A','B','C','D'].includes(q.correct_option.toUpperCase()) ? { correct_option: q.correct_option.toUpperCase() } : {}),
        } : {}),
        marks: Number.isFinite(Number(q.marks)) && Number(q.marks) > 0 ? Math.min(100, Number(q.marks)) : (q.section === 'A' ? 1 : 10),
        confidence: ['high','medium','low'].includes(q.confidence) ? q.confidence : 'medium',
        review_notes: Array.isArray(q.review_notes) ? q.review_notes.filter((n: any) => typeof n === 'string').slice(0, 8).map((n: string) => n.slice(0, 300)) : [],
      }));
      if (!questions.length) return jsonResponse({ success: false, error: 'No questions could be confidently extracted. Try brighter, sharper photos with the full page visible.' }, 422, corsHeaders);
      return jsonResponse({ success: true, provider: 'Gemini', model: activeModel, data: questions, page_notes: Array.isArray(parsed.page_notes) ? parsed.page_notes.slice(0, 8) : [] }, 200, corsHeaders);
    } catch (error: any) {
      const message = error instanceof Error ? error.message : 'Image analysis failed.';
      console.error('Handwritten question scan failed:', message.slice(0, 500));
      const status = Number(error?.status || error?.code) || 0;
      const modelFailures = Array.isArray(error?.modelFailures) ? error.modelFailures : undefined;
      const userMessage = /API key|authentication|unauthorized|invalid api key|permission denied/i.test(message)
        ? 'Gemini authentication failed. Check GEMINI_API_KEY in Netlify Functions and redeploy.'
        : /quota|rate.?limit|429/i.test(message) || status === 429
          ? 'Gemini quota or rate limit reached. Wait for the quota to reset, check Google AI Studio, or use a smaller scan.'
          : /404|not found|model.*unavailable/i.test(message)
            ? 'The configured Gemini model is unavailable for this API key. The scanner tried its fallback models; check model access in Google AI Studio.'
            : /Page |Each page|Combined image size|Upload between/i.test(message)
              ? message
              : /valid JSON/i.test(message)
                ? message
                : 'Gemini could not finish analysing these images. Check the Gemini connection test below; if it passes, retry with fewer pages or clearer photos.';
      return jsonResponse({ success: false, provider: 'Gemini', error: userMessage, diagnostics: modelFailures }, status === 429 ? 429 : status === 401 || status === 403 ? status : 503, corsHeaders);
    }
  }

  // 1. ENQUEUE EXAM GENERATION; a background worker performs the slower AI work.
  if (pathname.endsWith('/generate-questions') && req.method === 'POST') {
    try {
      if (Number(req.headers.get('content-length') || 0) > 16000) return jsonResponse({ success: false, error: 'AI request is too large.' }, 413, corsHeaders);
      const body = await req.json() as any;
      if (!validAiInputs(body)) return jsonResponse({ success: false, error: 'Invalid or oversized AI request fields.' }, 400, corsHeaders);
      const schoolId = body.school_id || req.headers.get('x-school-id');
      const authorization = await authorizeAiRequest(req, schoolId);
      if (!authorization.ok) return authorization.response;

      // Safe rollout: keep the current synchronous flow until the SQL migration is applied
      // and EXAM_QUEUE_ENABLED=true is configured in the Netlify Functions environment.
      if (process.env.EXAM_QUEUE_ENABLED !== 'true') {
        try {
          const result = await generateExamDraft(body);
          return jsonResponse({ success: true, provider: result.provider, data: result.data }, 200, corsHeaders);
        } catch (error: any) {
          const message = error instanceof Error ? error.message : String(error || 'Unknown Groq generation error');
          const status = Number(error?.status || error?.code) || 0;
          const limited = status === 429 || /rate.?limit|too many requests|tokens per minute/i.test(message);
          // Keep the detailed provider error in server logs so failures can be diagnosed
          // without exposing credentials or internal stack traces to teachers.
          console.error('Synchronous Groq exam generation failed', { status: status || 'unknown', message: message.slice(0, 500) });
          let userMessage = 'Groq could not complete this exam draft. Please try again shortly.';
          if (limited) {
            userMessage = 'Groq is temporarily rate-limited. Please wait 30–60 seconds before trying again.';
          } else if (status === 401 || /invalid api key|authentication|unauthorized/i.test(message)) {
            userMessage = 'Groq authentication failed. Please ask the administrator to check the GROQ_API_KEY in Netlify.';
          } else if (status === 402 || /insufficient_quota|billing|credits exhausted|payment required/i.test(message)) {
            userMessage = 'Groq API quota or billing limit has been reached. The administrator needs to check the Groq account.';
          } else if (status === 403 || /model.*(not allowed|blocked|permission)/i.test(message)) {
            userMessage = 'The configured Groq model is not enabled for this API key. Please ask the administrator to check Groq model permissions.';
          }
          return jsonResponse({ success: false, error: userMessage }, limited ? 429 : 503, corsHeaders);
        }
      }
      if (!ai) return jsonResponse({ success: false, error: 'AI generation is not configured on the server. Please contact the school administrator.' }, 503, corsHeaders);

      const inviteToken = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
      let requesterTokenHash: string | null = null;
      if (inviteToken) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inviteToken));
        requesterTokenHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
      }
      const payload = {
        school_id: schoolId,
        subject: body.subject || 'Mathematics',
        class_name: body.class_name || 'SSS 3',
        term: body.term || 'First Term',
        topics: body.topics || 'Topics supplied by the teacher',
        num_objectives: Number(body.num_objectives) || 10,
        num_theories: Number(body.num_theories) || 3,
        difficulty: body.difficulty || 'Standard',
        instructions: body.instructions || '',
      };
      const inserted = await supabaseAdminRequest('exam_requests', {
        method: 'POST',
        headers: { Prefer: 'return=representation' },
        body: JSON.stringify({
          school_id: schoolId,
          teacher_id: authorization.userId,
          requester_token_hash: requesterTokenHash,
          request_payload: payload,
          status: 'pending',
        }),
      }) as any[];
      const requestId = inserted?.[0]?.id;
      if (!requestId) throw new Error('The exam request could not be added to the queue.');

      try {
        const wakeResponse = await fetch(getSiteUrl(req) + '/.netlify/functions/exam-queue-worker-background', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ wake: true }),
        });
        if (!wakeResponse.ok) throw new Error('Background worker returned status ' + wakeResponse.status);
      } catch (wakeError) {
        await supabaseAdminRequest('exam_requests?id=eq.' + requestId, {
          method: 'PATCH',
          body: JSON.stringify({ status: 'failed', error_message: 'The background worker could not be started. Please try again.', updated_at: new Date().toISOString(), completed_at: new Date().toISOString() }),
        });
        console.error('Could not start exam queue worker', wakeError);
        return jsonResponse({ success: false, error: 'Your exam could not be started right now. Please try again in a moment.' }, 503, corsHeaders);
      }
      return jsonResponse({ success: true, queued: true, request_id: requestId, status: 'pending' }, 202, corsHeaders);
    } catch (error: any) {
      console.error('Could not enqueue exam generation', error?.message || error);
      return jsonResponse({ success: false, error: 'We could not add your exam to the queue. Please try again.' }, 503, corsHeaders);
    }
  }

  // Polling endpoint: only the requesting teacher or the matching school invite can read a job.
  if (pathname.endsWith('/exam-request-status') && req.method === 'GET') {
    try {
      const requestId = new URL(req.url).searchParams.get('id') || '';
      if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(requestId)) {
        return jsonResponse({ success: false, error: 'A valid exam request ID is required.' }, 400, corsHeaders);
      }
      const rows = await supabaseAdminRequest('exam_requests?id=eq.' + requestId + '&select=id,school_id,teacher_id,requester_token_hash,status,generated_data,error_message,updated_at&limit=1') as any[];
      const job = rows?.[0];
      if (!job) return jsonResponse({ success: false, error: 'Exam request not found.' }, 404, corsHeaders);
      const schoolId = (req.headers.get('x-school-id') || '').trim();
      if (!schoolId || schoolId !== job.school_id) return jsonResponse({ success: false, error: 'You are not allowed to view this exam request.' }, 403, corsHeaders);
      let permitted = false;
      const inviteToken = (req.headers.get('x-school-invite-token') || '').trim().toUpperCase();
      if (inviteToken && job.requester_token_hash) {
        const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(inviteToken));
        const tokenHash = Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('');
        permitted = tokenHash === job.requester_token_hash;
      } else {
        const user = await getAuthenticatedUser(req);
        permitted = Boolean(user?.id && job.teacher_id && user.id === job.teacher_id);
      }
      if (!permitted) return jsonResponse({ success: false, error: 'You are not allowed to view this exam request.' }, 403, corsHeaders);
      if (job.status === 'processing' && Date.now() - Date.parse(job.updated_at || '') > 20 * 60 * 1000) {
        // A status poll can restart recovery if a background invocation exceeded its runtime.
        void fetch(getSiteUrl(req) + '/.netlify/functions/exam-queue-worker-background', {
          method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ wake: true }),
        }).catch((error) => console.error('Could not restart stale exam queue work', error));
      }
      return jsonResponse({ success: true, request_id: job.id, status: job.status, data: job.status === 'completed' ? job.generated_data : null, error: job.status === 'failed' ? job.error_message : null }, 200, corsHeaders);
    } catch (error) {
      console.error('Could not read exam queue status', error);
      return jsonResponse({ success: false, error: 'Could not check the exam progress. Please try again.' }, 503, corsHeaders);
    }
  }
  // 2. REGENERATE SINGLE QUESTION
  if (pathname.endsWith('/regenerate-single-question') && req.method === 'POST') {
    try {
      if (Number(req.headers.get('content-length') || 0) > 16000) return jsonResponse({ success: false, error: 'AI request is too large.' }, 413);
      const body = await req.json() as any;
      if (!validAiInputs(body)) return jsonResponse({ success: false, error: 'Invalid or oversized AI request fields.' }, 400);
      const authorization = await authorizeAiRequest(req, body.school_id || req.headers.get('x-school-id'));
      if (!authorization.ok) return authorization.response;
      const { subject, class_name, section = 'A', question_number = 1, topics = '', previous_question = '', previous_options = null } = body;
      const isObjective = section === 'A';

      const promptText = `
You are an experienced Nigerian secondary-school examination setter. Generate a SINGLE FRESH ${isObjective ? 'Objective (Multiple Choice)' : 'Theory/Essay'} question for:
- Subject: ${subject}
- Class: ${class_name}
- Topics: ${topics || 'Standard Nigerian curriculum'}
- Previous question to avoid repeating: ${previous_question || 'None supplied'}
- Previous options to avoid reusing: ${previous_options ? JSON.stringify(previous_options) : 'None supplied'}
Create a genuinely different question and fresh answer options; do not paraphrase the previous question.

${
  isObjective
    ? `Format as JSON:
{
  "question_number": ${question_number},
  "question_text": "...",
  "option_a": "...",
  "option_b": "...",
  "option_c": "...",
  "option_d": "...",
  "correct_option": "A",
  "marks": 1
}`
    : `Format as JSON:
{
  "question_number": ${question_number},
  "question_text": "(a) ...\\n(b) ...",
  "marks": 15,
  "model_answer": "...",
  "score_breakdown": "Part (a): 5 mks, Part (b): 10 mks",
  "max_score": 15
}`
}
Return STRICT JSON ONLY.`;

      if (ai) {
        for (const model of MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
              config: { responseMimeType: 'application/json', temperature: 0.7 },
            });
            const parsed = JSON.parse(response.text || '{}');
            return new Response(JSON.stringify({ success: true, data: parsed }), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (err: any) {
            console.warn(`Netlify single regen model ${model} error:`, err?.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Question regeneration is unavailable. Configure GROQ_API_KEY or GEMINI_API_KEY on the server and check the Netlify Function logs.' }),
        { status: 503, headers: corsHeaders }
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  // 3. GENERATE MORE QUESTIONS
  if (pathname.endsWith('/generate-more-questions') && req.method === 'POST') {
    try {
      if (Number(req.headers.get('content-length') || 0) > 16000) return jsonResponse({ success: false, error: 'AI request is too large.' }, 413);
      const body = await req.json() as any;
      if (!validAiInputs(body)) return jsonResponse({ success: false, error: 'Invalid or oversized AI request fields.' }, 400);
      const authorization = await authorizeAiRequest(req, body.school_id || req.headers.get('x-school-id'));
      if (!authorization.ok) return authorization.response;
      const {
        subject,
        class_name,
        section = 'A',
        count = 5,
        start_number = 1,
        topics = '',
        difficulty = 'Standard',
        instructions = '',
        term = 'First Term',
      } = body;
      const safeCount = Math.min(Math.max(Number(count) || 5, 1), 20);
      const isObjective = section === 'A';

      const promptText = `
You are an experienced Nigerian secondary-school examination setter. Generate EXACTLY ${safeCount} NEW ${isObjective ? 'Objective Multiple Choice' : 'Theory'} questions for:
- Subject: ${subject}
- Class: ${class_name}
- Academic term: ${term}
- Section: ${section}
- Topics: ${topics || 'Nigerian secondary syllabus'}
- Difficulty: ${difficulty || 'Standard'}
- Exam instructions: ${instructions || 'Use clear, age-appropriate Nigerian secondary-school examination language.'}
- Starting Question Number: ${start_number}

Do not repeat questions already likely to appear in this section. Make each question complete and self-contained. For objectives, provide four plausible options and exactly one correct option. For theory, keep question_text as the question only; provide the answer and marking breakdown separately for the confidential marking scheme.

Respond strictly with a JSON object:
{
  "questions": [
    ${
      isObjective
        ? `{"question_number": ${start_number}, "question_text": "...", "option_a": "...", "option_b": "...", "option_c": "...", "option_d": "...", "correct_option": "A", "marks": 1}`
        : `{"question_number": ${start_number}, "question_text": "...", "marks": 15, "model_answer": "...", "score_breakdown": "...", "max_score": 15}`
    }
  ]
}`;

      if (ai) {
        for (const model of MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: promptText,
              config: { responseMimeType: 'application/json', temperature: 0.5 },
            });
            const parsed = JSON.parse(response.text || '{}');
            const validQuestions = (Array.isArray(parsed.questions) ? parsed.questions : [])
              .filter((question: any) => {
                if (!question || typeof question.question_text !== 'string' || !question.question_text.trim()) return false;
                if (isObjective) {
                  return ['option_a', 'option_b', 'option_c', 'option_d'].every(
                    (key) => typeof question[key] === 'string' && question[key].trim(),
                  ) && ['A', 'B', 'C', 'D'].includes(String(question.correct_option || '').toUpperCase());
                }
                return typeof question.model_answer === 'string' && question.model_answer.trim()
                  && typeof question.score_breakdown === 'string' && question.score_breakdown.trim();
              })
              .slice(0, safeCount);
            return new Response(JSON.stringify({ success: true, data: validQuestions }), {
              status: 200,
              headers: corsHeaders,
            });
          } catch (e: any) {
            console.warn(`Netlify more questions model ${model} error:`, e?.message);
          }
        }
      }

      return new Response(
        JSON.stringify({ success: false, error: 'Question generation is unavailable. Configure GROQ_API_KEY or GEMINI_API_KEY on the server and check the Netlify Function logs.' }),
        { status: 503, headers: corsHeaders }
      );
    } catch (e: any) {
      return new Response(JSON.stringify({ success: false, error: e?.message }), {
        status: 500,
        headers: corsHeaders,
      });
    }
  }

  return new Response(JSON.stringify({ error: 'Endpoint not found' }), {
    status: 404,
    headers: corsHeaders,
  });
};

export const config = {
  path: ['/api/generate-questions', '/api/exam-request-status', '/api/regenerate-single-question', '/api/generate-more-questions', '/api/initialize-payment', '/api/verify-payment', '/api/school-invite', '/api/check-exam-conflict', '/api/publish-exam', '/api/scan-handwritten-questions', '/api/gemini-scan-status'],
};
