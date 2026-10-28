import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { FeedbackAdminPanel } from './FeedbackAdminPanel';
import { AiIssuesAdminPanel } from './AiIssuesAdminPanel';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { School, PaymentTransaction } from '../../types';
import {
  ShieldAlert, CreditCard, RefreshCw, Search, AlertCircle, Loader2,
  RotateCcw, CheckCircle2, Ban, Building2, FileText, Users, TrendingUp,
  CalendarDays, ShieldCheck, Power, Download, Activity, Globe2,
} from 'lucide-react';

const requestRockcraftConfirmation = (message: string) => new Promise<boolean>((resolve) => {
  window.dispatchEvent(new CustomEvent('rockcraft:confirm', { detail: { message, resolve } }));
});

type AdminSchool = School & {
  account_status: 'active' | 'suspended';
  generation_enabled: boolean;
  total_exams: number;
  published_exams: number;
  draft_exams: number;
  owner_registered_at?: string;
};

function mapSchool(row: any): AdminSchool {
  return {
    id: row.id, name: row.name || '', admin_name: row.admin_name || '',
    email: row.email || '', phone: row.phone || '', state: row.state || '',
    lga: row.lga || '', institution_type: row.institution_type || 'Secondary',
    logo_url: row.logo_url || '', motto: row.motto || '', address: row.address || '',
    subscription_status: row.subscription_status || 'trial',
    subscription_expires_at: row.subscription_expires_at || undefined,
    ai_exams_used: Number(row.ai_exams_used || 0),
    manual_exams_used: Number(row.manual_exams_used || 0),
    max_trial_ai_exams: Number(row.max_trial_ai_exams ?? 4),
    max_trial_manual_exams: Number(row.max_trial_manual_exams ?? 5),
    created_at: row.created_at || '',
    account_status: row.account_status === 'suspended' ? 'suspended' : 'active',
    generation_enabled: row.generation_enabled !== false,
    total_exams: 0, published_exams: 0, draft_exams: 0,
  };
}

function mapPayment(row: any): PaymentTransaction {
  return {
    id: row.id, school_id: row.school_id, school_name: row.school_name || 'School',
    amount_ngn: Number(row.amount_ngn || 0), reference: row.reference || '',
    status: row.status || 'pending', term: row.term || 'First Term',
    session: row.session || '', paid_at: row.paid_at || row.created_at || '',
    channel: row.channel || undefined,
  };
}

const money = (amount: number) => '₦' + amount.toLocaleString('en-NG');
const date = (value?: string) => value ? new Date(value).toLocaleDateString('en-NG', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

export const PlatformAdminPage: React.FC = () => {
  const { user, isPlatformAdmin } = useAuth();
  const [schools, setSchools] = useState<AdminSchool[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [isLoading, setIsLoading] = useState(true);
  const [busySchoolId, setBusySchoolId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [analytics, setAnalytics] = useState<any | null>(null);

  const loadData = useCallback(async () => {
    if (!isPlatformAdmin) { setIsLoading(false); return; }
    if (!isSupabaseConfigured()) {
      setErrorMessage('Supabase is not configured. Check the deployment environment variables.');
      setIsLoading(false); return;
    }
    setIsLoading(true); setErrorMessage(null);
    const [schoolResult, paymentResult, examResult, profileResult, analyticsResult] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('created_at', { ascending: false }),
      supabase.from('exams').select('id,school_id,status,created_at'),
      supabase.from('profiles').select('school_id,created_at,full_name,email').order('created_at', { ascending: true }),
      supabase.rpc('get_platform_analytics'),
    ]);
    const failed = schoolResult.error || paymentResult.error || examResult.error || profileResult.error || analyticsResult.error;
    if (failed) {
      console.error('Unable to load platform admin data', failed);
      setErrorMessage(failed.message || 'Unable to load platform data. Check your Supabase policies and try again.');
      setIsLoading(false); return;
    }
    const examRows = examResult.data || [];
    const profiles = profileResult.data || [];
    const examCounts = new Map<string, { total: number; published: number; drafts: number }>();
    for (const exam of examRows) {
      if (!exam.school_id) continue;
      const count = examCounts.get(exam.school_id) || { total: 0, published: 0, drafts: 0 };
      count.total += 1;
      if (exam.status === 'published') count.published += 1;
      else count.drafts += 1;
      examCounts.set(exam.school_id, count);
    }
    const ownerBySchool = new Map<string, string>();
    for (const profile of profiles) {
      if (profile.school_id && !ownerBySchool.has(profile.school_id)) ownerBySchool.set(profile.school_id, profile.created_at);
    }
    setSchools((schoolResult.data || []).map((row: any) => {
      const school = mapSchool(row);
      const counts = examCounts.get(school.id) || { total: 0, published: 0, drafts: 0 };
      return { ...school, total_exams: counts.total, published_exams: counts.published, draft_exams: counts.drafts, owner_registered_at: ownerBySchool.get(school.id) };
    }));
    setPayments((paymentResult.data || []).map(mapPayment));
    setAnalytics(analyticsResult.data || null);
    setIsLoading(false);
  }, [isPlatformAdmin]);

  useEffect(() => {
    void loadData();
    const timer = window.setInterval(() => void loadData(), 30000);
    return () => window.clearInterval(timer);
  }, [loadData]);

  const updateSchool = async (school: AdminSchool, updates: Record<string, unknown>, confirmation: string, successMessage: string) => {
    if (!(await requestRockcraftConfirmation(confirmation))) return;
    setBusySchoolId(school.id); setErrorMessage(null); setNotice(null);
    const { error } = await supabase.from('schools').update(updates).eq('id', school.id);
    setBusySchoolId(null);
    if (error) { setErrorMessage(error.message); return; }
    setNotice(successMessage);
    await loadData();
  };

  const handleAccountToggle = (school: AdminSchool) => {
    const suspended = school.account_status !== 'suspended';
    void updateSchool(
      school,
      { account_status: suspended ? 'suspended' : 'active' },
      suspended
        ? 'Suspend ' + school.name + '? School admins and teacher links will no longer be able to generate or publish exams.'
        : 'Reactivate ' + school.name + '? Exam generation will follow the separate generation permission and subscription/trial limits.',
      school.name + (suspended ? ' has been suspended.' : ' has been reactivated.')
    );
  };

  const handleGenerationToggle = (school: AdminSchool) => {
    const enabled = !school.generation_enabled;
    void updateSchool(
      school, { generation_enabled: enabled },
      (enabled ? 'Allow' : 'Block') + ' exam generation for ' + school.name + '?',
      'Exam generation ' + (enabled ? 'enabled' : 'blocked') + ' for ' + school.name + '.'
    );
  };

  const handleSubscriptionToggle = (school: AdminSchool) => {
    const active = school.subscription_status !== 'active' ||
      (school.subscription_expires_at && new Date(school.subscription_expires_at).getTime() <= Date.now());
    void updateSchool(
      school,
      { subscription_status: active ? 'active' : 'trial' },
      (active ? 'Manually activate paid access for ' : 'Return ') + school.name + (active ? '?' : ' to trial access?'),
      'Subscription updated for ' + school.name + '.'
    );
  };

  const handleResetTrials = (school: AdminSchool) => {
    void updateSchool(
      school, { ai_exams_used: 0, manual_exams_used: 0 },
      'Reset trial AI and manual exam counters for ' + school.name + '?',
      'Trial counters reset for ' + school.name + '.'
    );
  };

  const totalRevenue = payments.filter(p => p.status === 'success').reduce((sum, p) => sum + p.amount_ngn, 0);
  const paidSchools = schools.filter(s => s.subscription_status === 'active' && (!s.subscription_expires_at || new Date(s.subscription_expires_at).getTime() > Date.now())).length;
  const suspendedSchools = schools.filter(s => s.account_status === 'suspended').length;
  const totalExams = schools.reduce((sum, s) => sum + s.total_exams, 0);
  const totalAi = schools.reduce((sum, s) => sum + s.ai_exams_used, 0);
  const totalManual = schools.reduce((sum, s) => sum + s.manual_exams_used, 0);
  const filteredSchools = useMemo(() => schools.filter(s => {
    const text = [s.name, s.email, s.admin_name, s.phone, s.state, s.lga].join(' ').toLowerCase();
    const matchesSearch = text.includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all'
      || (statusFilter === 'paid' && s.subscription_status === 'active' && (!s.subscription_expires_at || new Date(s.subscription_expires_at).getTime() > Date.now()))
      || (statusFilter === 'unpaid' && !(s.subscription_status === 'active' && (!s.subscription_expires_at || new Date(s.subscription_expires_at).getTime() > Date.now())))
      || (statusFilter === 'suspended' && s.account_status === 'suspended')
      || (statusFilter === 'generation-blocked' && !s.generation_enabled);
    return matchesSearch && matchesStatus;
  }), [schools, search, statusFilter]);

  const exportSchools = () => {
    const headers = ['School','Admin','Email','Phone','State','LGA','Registered','Account status','Generation enabled','Subscription','Subscription expires','Total exams','Published exams','Draft exams','AI trial used','Manual trial used'];
    const rows = filteredSchools.map(s => [s.name,s.admin_name,s.email,s.phone,s.state,s.lga,s.created_at,s.account_status,String(s.generation_enabled),s.subscription_status,s.subscription_expires_at || '',s.total_exams,s.published_exams,s.draft_exams,s.ai_exams_used,s.manual_exams_used]);
    const csv = [headers, ...rows].map(row => row.map(v => '"' + String(v ?? '').replace(/"/g, '""') + '"').join(',')).join('\r\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = 'rockcraf-schools-report.csv'; link.click(); URL.revokeObjectURL(url);
  };

  if (!isPlatformAdmin) {
    return <div className="p-8 text-center bg-white rounded-3xl border border-slate-200"><ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" /><h3 className="text-base font-bold text-slate-900">Restricted Platform Access</h3><p className="text-xs text-slate-500 mt-1">This console is strictly reserved for authorized ROCKCRAF platform administrators.</p></div>;
  }

  const statCards = [
    { label: 'Registered schools', value: schools.length, detail: 'All school accounts', icon: Building2, color: 'text-blue-700 bg-blue-50' },
    { label: 'Paid / active', value: paidSchools, detail: 'Subscription currently active', icon: CheckCircle2, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Total exams', value: totalExams, detail: 'Published + drafts', icon: FileText, color: 'text-violet-700 bg-violet-50' },
    { label: 'Verified revenue', value: money(totalRevenue), detail: 'Successful payments only', icon: TrendingUp, color: 'text-emerald-700 bg-emerald-50' },
    { label: 'Suspended', value: suspendedSchools, detail: 'Account access blocked', icon: Ban, color: 'text-rose-700 bg-rose-50' },
    { label: 'Trial usage', value: totalAi + totalManual, detail: totalAi + ' AI · ' + totalManual + ' manual', icon: Users, color: 'text-amber-700 bg-amber-50' },
    { label: 'Active now', value: analytics?.active_users ?? 0, detail: (analytics?.active_visitors ?? 0) + ' active visitors · 15 min', icon: Activity, color: 'text-blue-700 bg-blue-50' },
    { label: 'Visitors today', value: analytics?.today_visitors ?? 0, detail: (analytics?.today_sessions ?? 0) + ' sessions recorded', icon: Globe2, color: 'text-cyan-700 bg-cyan-50' },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-5 text-left pb-8">
      <section className="rounded-3xl bg-slate-950 text-white p-5 sm:p-7 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <div className="inline-flex items-center gap-2 rounded-full bg-blue-500/15 text-blue-300 px-3 py-1 text-[10px] font-bold uppercase tracking-widest"><ShieldCheck className="w-3.5 h-3.5" /> ROCKCRAF Control Centre</div>
            <h2 className="text-2xl sm:text-3xl font-black mt-3">Platform administration</h2>
            <p className="text-xs text-slate-400 mt-1">Signed in as {user?.email || 'authorized administrator'} · Live Supabase records</p>
          </div>
          <div className="flex gap-2">
            <button onClick={exportSchools} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-xs font-bold"><Download className="w-4 h-4" /> Export schools</button>
            <button onClick={() => void loadData()} disabled={isLoading} className="inline-flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-xs font-bold disabled:opacity-50"><RefreshCw className={'w-4 h-4 ' + (isLoading ? 'animate-spin' : '')} /> Refresh</button>
          </div>
        </div>
      </section>

      {errorMessage && <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2"><AlertCircle className="w-4 h-4 mt-0.5 shrink-0" /><span>{errorMessage}</span></div>}
      {notice && <div role="status" className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">{notice}</div>}

      <AiIssuesAdminPanel />
      <FeedbackAdminPanel />

      <section className="grid grid-cols-2 xl:grid-cols-3 gap-3">
        {statCards.map(({label,value,detail,icon:Icon,color}) => <div key={label} className="bg-white border border-slate-200 rounded-2xl p-4 shadow-sm min-w-0"><div className="flex items-center justify-between gap-2"><span className="text-[11px] text-slate-500 font-semibold">{label}</span><span className={'p-2 rounded-xl ' + color}><Icon className="w-4 h-4" /></span></div><div className="text-xl sm:text-2xl font-black text-slate-900 mt-2 truncate">{value}</div><p className="text-[10px] text-slate-400 mt-1">{detail}</p></div>)}
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div><h3 className="text-lg font-black text-slate-900">School accounts</h3><p className="text-xs text-slate-500 mt-1">Registration, subscription, generation permissions and exam activity per school.</p></div>
          <span className="text-xs text-slate-500">{filteredSchools.length} of {schools.length} schools</span>
        </div>
        <div className="flex flex-col md:flex-row gap-2">
          <div className="relative flex-1"><Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" /><input type="search" aria-label="Search school accounts" placeholder="Search school, admin, email, phone or location..." value={search} onChange={e => setSearch(e.target.value)} className="w-full text-sm pl-9 pr-3 py-3 rounded-xl border border-slate-200 outline-none focus:border-blue-500" /></div>
          <select value={statusFilter} onChange={e => setStatusFilter(e.target.value)} aria-label="Filter schools" className="text-sm p-3 rounded-xl border border-slate-200 bg-white">
            <option value="all">All schools</option><option value="paid">Paid / active</option><option value="unpaid">Trial / unpaid / expired</option><option value="suspended">Suspended accounts</option><option value="generation-blocked">Generation blocked</option>
          </select>
        </div>
        {isLoading ? <div className="py-12 flex justify-center items-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" /> Loading school, payment and exam records…</div>
          : filteredSchools.length === 0 ? <p className="py-10 text-center text-sm text-slate-500">No school accounts match this search or filter.</p>
          : <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-xs min-w-[1080px]">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200"><tr>
              <th className="py-3 px-3">School / registered</th><th className="py-3 px-3">Admin contact</th><th className="py-3 px-3">Location</th><th className="py-3 px-3">Exam activity</th><th className="py-3 px-3">Payment status</th><th className="py-3 px-3">Account / generation</th><th className="py-3 px-3">Admin actions</th>
            </tr></thead>
            <tbody className="divide-y divide-slate-100">{filteredSchools.map(s => {
              const paid = s.subscription_status === 'active' && (!s.subscription_expires_at || new Date(s.subscription_expires_at).getTime() > Date.now());
              const busy = busySchoolId === s.id;
              return <tr key={s.id} className="align-top hover:bg-slate-50/70">
                <td className="py-3 px-3"><strong className="block text-slate-900">{s.name}</strong><span className="block text-slate-400 mt-1">{s.institution_type}</span><span className="block text-[10px] text-slate-500 mt-1"><CalendarDays className="inline w-3 h-3 mr-1" />School: {date(s.created_at)}</span></td>
                <td className="py-3 px-3"><span className="font-semibold text-slate-800">{s.admin_name || '—'}</span><span className="block text-slate-500 mt-1">{s.email}</span><span className="block text-slate-500">{s.phone}</span></td>
                <td className="py-3 px-3">{[s.lga,s.state].filter(Boolean).join(', ') || '—'}</td>
                <td className="py-3 px-3"><strong className="text-slate-900">{s.total_exams} total</strong><span className="block text-emerald-700 mt-1">{s.published_exams} published</span><span className="block text-slate-500 mt-1">{s.draft_exams} drafts</span><span className="block text-[10px] text-slate-400 mt-2">Trial counters: AI {s.ai_exams_used}/{s.max_trial_ai_exams} · Manual {s.manual_exams_used}/{s.max_trial_manual_exams}</span></td>
                <td className="py-3 px-3"><span className={'inline-flex px-2 py-1 rounded-full font-bold text-[10px] uppercase ' + (paid ? 'bg-emerald-100 text-emerald-800' : 'bg-amber-100 text-amber-800')}>{paid ? 'Paid / active' : s.subscription_status === 'expired' ? 'Expired' : 'Trial / unpaid'}</span><span className="block text-slate-500 mt-2">Expires: {date(s.subscription_expires_at)}</span><button disabled={busy} onClick={() => handleSubscriptionToggle(s)} className="mt-2 text-[10px] font-bold text-blue-700 hover:underline disabled:opacity-50">{paid ? 'Move to trial' : 'Manually activate'}</button></td>
                <td className="py-3 px-3"><span className={'inline-flex px-2 py-1 rounded-full font-bold text-[10px] uppercase ' + (s.account_status === 'suspended' ? 'bg-rose-100 text-rose-800' : 'bg-emerald-100 text-emerald-800')}>{s.account_status}</span><span className={'block mt-2 text-[10px] font-semibold ' + (s.generation_enabled ? 'text-emerald-700' : 'text-rose-700')}>Generation {s.generation_enabled ? 'allowed' : 'blocked'}</span></td>
                <td className="py-3 px-3"><div className="flex flex-col items-start gap-2">
                  <button disabled={busy} onClick={() => handleAccountToggle(s)} className={'inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-[10px] font-bold disabled:opacity-50 ' + (s.account_status === 'suspended' ? 'bg-emerald-50 text-emerald-800' : 'bg-rose-50 text-rose-800')}>{busy ? <Loader2 className="w-3 h-3 animate-spin" /> : s.account_status === 'suspended' ? <CheckCircle2 className="w-3 h-3" /> : <Ban className="w-3 h-3" />}{s.account_status === 'suspended' ? 'Reactivate account' : 'Suspend account'}</button>
                  <button disabled={busy || s.account_status === 'suspended'} onClick={() => handleGenerationToggle(s)} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg bg-slate-100 text-slate-700 text-[10px] font-bold disabled:opacity-40"><Power className="w-3 h-3" />{s.generation_enabled ? 'Block generation' : 'Allow generation'}</button>
                  <button disabled={busy} onClick={() => handleResetTrials(s)} className="inline-flex items-center gap-1.5 px-2.5 py-2 rounded-lg text-slate-500 hover:bg-slate-100 text-[10px] font-semibold disabled:opacity-50"><RotateCcw className="w-3 h-3" />Reset trial counters</button>
                </div></td>
              </tr>;
            })}</tbody>
          </table></div>}
        <p className="text-[10px] leading-relaxed text-slate-400">Paid status is based on the subscription fields. Manual activation changes access status only; it does not create a payment transaction or alter recorded revenue.</p>
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3"><div><h3 className="text-lg font-black text-slate-900">Live platform activity</h3><p className="text-xs text-slate-500 mt-1">Real browser sessions and authenticated usage from Supabase.</p></div><span className="text-[10px] text-slate-400">Updated every 30 seconds</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-semibold text-slate-500">Registered users</p><p className="mt-1 text-xl font-black text-slate-900">{analytics?.registered_users ?? 0}</p></div>
          <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-semibold text-slate-500">Active users</p><p className="mt-1 text-xl font-black text-slate-900">{analytics?.active_users ?? 0}</p></div>
          <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-semibold text-slate-500">Visitors · 24 hours</p><p className="mt-1 text-xl font-black text-slate-900">{analytics?.visitors_24h ?? 0}</p></div>
          <div className="rounded-2xl border border-slate-200 p-3"><p className="text-[10px] font-semibold text-slate-500">Users · 7 days</p><p className="mt-1 text-xl font-black text-slate-900">{analytics?.users_7d ?? 0}</p></div>
        </div>
        {Array.isArray(analytics?.school_activity) && analytics.school_activity.length > 0 && <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-xs"><thead className="bg-slate-50 text-slate-500"><tr><th className="py-3 px-3">School</th><th className="py-3 px-3">Active visitors</th><th className="py-3 px-3">Active users</th><th className="py-3 px-3">Visitors · 24h</th></tr></thead><tbody className="divide-y divide-slate-100">{analytics.school_activity.map((row: any) => <tr key={row.school_id}><td className="py-3 px-3 font-semibold text-slate-900">{row.school_name}</td><td className="py-3 px-3">{row.active_visitors}</td><td className="py-3 px-3">{row.active_users}</td><td className="py-3 px-3">{row.visitors_24h}</td></tr>)}</tbody></table></div>}
      </section>

      <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
        <div className="flex items-center gap-2"><CreditCard className="w-5 h-5 text-blue-600" /><div><h3 className="text-lg font-black text-slate-900">Payment ledger</h3><p className="text-xs text-slate-500 mt-1">Transaction history and successful payment revenue.</p></div></div>
        <div className="flex flex-wrap gap-3 text-xs"><span className="rounded-xl bg-emerald-50 text-emerald-800 px-3 py-2 font-bold">Successful: {payments.filter(p => p.status === 'success').length}</span><span className="rounded-xl bg-amber-50 text-amber-800 px-3 py-2 font-bold">Pending: {payments.filter(p => p.status === 'pending').length}</span><span className="rounded-xl bg-rose-50 text-rose-800 px-3 py-2 font-bold">Failed: {payments.filter(p => p.status === 'failed').length}</span><span className="rounded-xl bg-slate-100 text-slate-800 px-3 py-2 font-bold">Revenue: {money(totalRevenue)}</span></div>
        {isLoading ? <p className="py-6 text-sm text-slate-500">Loading payments…</p> : payments.length === 0 ? <p className="py-8 text-center text-sm text-slate-500">No payment transactions have been recorded yet.</p> : <div className="overflow-x-auto rounded-xl border border-slate-100"><table className="w-full text-left text-xs min-w-[760px]"><thead className="bg-slate-50 text-slate-500"><tr><th className="py-3 px-3">School</th><th className="py-3 px-3">Amount</th><th className="py-3 px-3">Reference</th><th className="py-3 px-3">Term / session</th><th className="py-3 px-3">Date</th><th className="py-3 px-3">Channel</th><th className="py-3 px-3">Status</th></tr></thead><tbody className="divide-y divide-slate-100">{payments.map(p => <tr key={p.id}><td className="py-3 px-3 font-semibold text-slate-900">{p.school_name}</td><td className="py-3 px-3 font-bold">{money(p.amount_ngn)}</td><td className="py-3 px-3 text-slate-500">{p.reference || '—'}</td><td className="py-3 px-3">{p.term} ({p.session || '—'})</td><td className="py-3 px-3 text-slate-500">{date(p.paid_at)}</td><td className="py-3 px-3">{p.channel || '—'}</td><td className="py-3 px-3"><span className={'px-2 py-1 rounded-full font-bold text-[10px] uppercase ' + (p.status === 'success' ? 'bg-emerald-100 text-emerald-800' : p.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800')}>{p.status}</span></td></tr>)}</tbody></table></div>}
      </section>
    </div>
  );
};
