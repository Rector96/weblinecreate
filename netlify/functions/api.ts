import { GoogleGenAI } from '@google/genai';

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

  // 1. GENERATE FULL EXAM QUESTIONS
  if (pathname.endsWith('/generate-questions') && req.method === 'POST') {
    try {
      if (Number(req.headers.get('content-length') || 0) > 16000) return jsonResponse({ success: false, error: 'AI request is too large.' }, 413);
      const body = await req.json() as any;
      if (!validAiInputs(body)) return jsonResponse({ success: false, error: 'Invalid or oversized AI request fields.' }, 400);
      const authorization = await authorizeAiRequest(req, body.school_id || req.headers.get('x-school-id'));
      if (!authorization.ok) return authorization.response;
      const {
        subject = 'General Mathematics',
        class_name = 'SSS 3',
        term = 'First Term',
        topics = 'Standard Nigerian secondary curriculum',
        num_objectives = 10,
        num_theories = 3,
        difficulty = 'Standard',
        instructions = '',
      } = body;

      const safeObjCount = Math.min(Math.max(Number(num_objectives) || 10, 5), 50);
      const safeTheoryCount = Math.min(Math.max(Number(num_theories) || 3, 1), 6);

      const sharedContext = `
You are an experienced Nigerian secondary-school examination setter with strong knowledge of the Nigerian NERDC curriculum and West African examination standards.

CURRICULUM AND LANGUAGE:
- Match the supplied class level and topics; do not introduce topics above the class level.
- Use Nigerian and West African contexts where they make sense and use British English spelling.
- Avoid inventing official curriculum claims. Prioritise the teacher's supplied topics and instructions.

STEM FORMATTING:
- For Mathematics, Further Mathematics, Physics, and Chemistry, write mathematical expressions and scientific notation with standard LaTeX delimiters: inline \\( ... \\) and display \\[ ... \\].
- Use LaTeX for fractions, powers, subscripts, variables, units, and chemical formulae, for example \\(\\frac{3}{4}x^2\\), \\(v = u + at\\), and \\(H_2SO_4\\).
- Keep ordinary prose readable. Do not wrap an entire question in math delimiters unless it is all mathematics.

QUALITY:
- Produce clear, age-appropriate, unambiguous questions.
- Objective options must be plausible, mutually distinct, and the correct option must match the actual solution.
- Theory questions must keep the question text separate from the model answer and marking breakdown.
- Return valid JSON only, without Markdown fences or introductory text.
`;

      const objectivePrompt = `
${sharedContext}

Generate EXACTLY ${safeObjCount} Section A objective multiple-choice questions for:
- Subject: ${subject}
- Class level: ${class_name}
- Academic term: ${term}
- Topics covered: ${topics}
- Difficulty: ${difficulty}
- Teacher instructions: ${instructions || 'Follow the school curriculum and the supplied topics.'}

Each question must have four options, one correct option, and 1 mark. Return only this JSON shape:
{
  "section_a": [
    {
      "question_number": 1,
      "question_text": "Question text only",
      "option_a": "Option A",
      "option_b": "Option B",
      "option_c": "Option C",
      "option_d": "Option D",
      "correct_option": "A",
      "marks": 1
    }
  ]
}
`;

      const theoryPrompt = `
${sharedContext}

Generate EXACTLY ${safeTheoryCount} Section B theory/essay questions for:
- Subject: ${subject}
- Class level: ${class_name}
- Academic term: ${term}
- Topics covered: ${topics}
- Difficulty: ${difficulty}
- Teacher instructions: ${instructions || 'Follow the school curriculum and the supplied topics.'}

Give each question clear marks, a thorough model answer, and a useful step-by-step marking breakdown. Keep answers out of question_text. Return only this JSON shape:
{
  "section_b": [
    {
      "question_number": 1,
      "question_text": "Question prompt only",
      "marks": 15,
      "model_answer": "Complete worked answer or structured marking guide",
      "score_breakdown": "Marks allocated to each required step or point",
      "max_score": 15
    }
  ]
}
`;

      if (!ai) {
        console.error('AI generation unavailable: configure GROQ_API_KEY or GEMINI_API_KEY/GOOGLE_API_KEY in the Netlify Function runtime.');
        return new Response(
          JSON.stringify({ success: false, error: 'AI generation is not configured on the server. Add GROQ_API_KEY (recommended) or GEMINI_API_KEY/GOOGLE_API_KEY in Netlify Environment variables with Functions scope, then redeploy.' }),
          { status: 503, headers: corsHeaders }
        );
      }

      const generateSection = async (prompt: string, sectionName: 'objectives' | 'theory') => {
        let lastModelError: unknown = null;
        for (const model of MODELS) {
          try {
            const response = await ai.models.generateContent({
              model,
              contents: prompt,
              config: { responseMimeType: 'application/json', temperature: 0.3 },
            });
            const rawJson = response.text || '';
            const parsed = JSON.parse(rawJson);
            if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
              throw new Error(`The AI returned an invalid ${sectionName} response.`);
            }
            return { model, data: parsed };
          } catch (modelErr: any) {
            lastModelError = modelErr;
            console.error(`AI ${sectionName} generation failed (${model})`, modelErr?.status || modelErr?.code || 'unknown status', modelErr?.message || 'No error message');
          }
        }
        throw lastModelError instanceof Error ? lastModelError : new Error(`AI ${sectionName} generation failed.`);
      };

      // Batch long sections so large papers do not exceed the model response-token ceiling.
      // Every batch runs sequentially; never launch parallel bursts against a free-tier API.
      const sectionA: any[] = [];
      const sectionB: any[] = [];
      let selectedProvider = MODELS[0];

      for (let offset = 0; offset < safeObjCount; offset += 10) {
        const batchCount = Math.min(10, safeObjCount - offset);
        const batchPrompt = objectivePrompt.replace(
          'Generate EXACTLY ' + safeObjCount + ' Section A objective multiple-choice questions',
          'Generate EXACTLY ' + batchCount + ' Section A objective multiple-choice questions',
        );
        const result = await generateSection(batchPrompt, 'objectives');
        selectedProvider = result.model;
        const batch = Array.isArray(result.data.section_a) ? result.data.section_a : [];
        if (batch.length !== batchCount) {
          return jsonResponse({ success: false, error: 'The AI returned ' + batch.length + ' of ' + batchCount + ' objective questions in one batch. Please try again; no incomplete exam was loaded.' }, 502, corsHeaders);
        }
        sectionA.push(...batch.map((item: any, index: number) => ({ ...item, question_number: offset + index + 1 })));
      }

      for (let offset = 0; offset < safeTheoryCount; offset += 2) {
        const batchCount = Math.min(2, safeTheoryCount - offset);
        const batchPrompt = theoryPrompt.replace(
          'Generate EXACTLY ' + safeTheoryCount + ' Section B theory/essay questions',
          'Generate EXACTLY ' + batchCount + ' Section B theory/essay questions',
        );
        const result = await generateSection(batchPrompt, 'theory');
        selectedProvider = result.model;
        const batch = Array.isArray(result.data.section_b) ? result.data.section_b : [];
        if (batch.length !== batchCount) {
          return jsonResponse({ success: false, error: 'The AI returned ' + batch.length + ' of ' + batchCount + ' theory questions in one batch. Please try again; no incomplete exam was loaded.' }, 502, corsHeaders);
        }
        sectionB.push(...batch.map((item: any, index: number) => ({ ...item, question_number: offset + index + 1 })));
      }

      return jsonResponse({
        success: true,
        provider: selectedProvider,
        data: { section_a: sectionA, section_b: sectionB },
      }, 200, corsHeaders);
    } catch (e: any) {
      const statusCode = Number(e?.status || e?.code || 0);
      const errorText = e instanceof Error ? e.message : String(e || '');
      const rateLimited = statusCode === 429 || /rate.?limit|too many requests|tokens per minute/i.test(errorText);
      const incomplete = /json|unexpected end|unterminated|incomplete/i.test(errorText);
      const message = rateLimited
        ? 'The AI question-setting desk is busy right now. Please wait a little and try again.'
        : incomplete
          ? 'The AI returned an incomplete response. No incomplete exam was loaded; please try again.'
          : 'We could not finish generating this exam. Please try again in a moment. If it continues, contact your school administrator.';
      console.error('Exam generation failed safely', statusCode || 'unknown status', errorText.slice(0, 240));
      return jsonResponse({ success: false, error: message }, rateLimited ? 429 : 503, corsHeaders);
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
  path: ['/api/generate-questions', '/api/regenerate-single-question', '/api/generate-more-questions', '/api/initialize-payment', '/api/verify-payment', '/api/school-invite', '/api/check-exam-conflict', '/api/publish-exam'],
};
