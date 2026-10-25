import React, { useCallback, useEffect, useState } from 'react';
import { RefreshCw, MessageSquareText, Loader2, AlertCircle, ChevronDown, ChevronUp } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type FeedbackRow = {
  id: string; subject: string; message: string; created_at: string;
  user_name: string | null; user_email: string | null; school_name: string | null;
  school_id: string | null; page_path: string | null; browser_info: string | null;
  account_image_url: string | null; status: string;
};
const formatDate = (value: string) => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

export const FeedbackAdminPanel: React.FC = () => {
  const [rows, setRows] = useState<FeedbackRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) { setError('Supabase is not configured.'); setLoading(false); return; }
    setLoading(true); setError('');
    const { data, error: queryError } = await supabase.from('user_feedback').select('*').order('created_at', { ascending: false }).limit(200);
    if (queryError) { setError(queryError.message.includes('user_feedback') ? 'Feedback table is not set up yet. Apply the new Supabase migration in the repository.' : queryError.message); setRows([]); }
    else setRows((data || []) as FeedbackRow[]);
    setLoading(false);
  }, []);
  useEffect(() => { void load(); }, [load]);
  return <section className="bg-white border border-slate-200 rounded-3xl p-4 sm:p-6 space-y-4 shadow-sm">
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
      <div className="flex items-center gap-3"><span className="p-3 rounded-2xl bg-blue-50 text-blue-700"><MessageSquareText className="w-5 h-5" /></span><div><h3 className="text-lg font-black text-slate-900">User feedback</h3><p className="text-xs text-slate-500 mt-1">Messages, account details, school, page and browser context.</p></div></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800 disabled:opacity-50"><RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} /> Refresh feedback</button>
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertCircle className="w-4 h-4 shrink-0" />{error}</div>}
    {loading ? <div className="py-8 flex items-center justify-center gap-2 text-sm text-slate-500"><Loader2 className="w-4 h-4 animate-spin" />Loading feedback…</div>
      : rows.length === 0 ? <div className="rounded-2xl bg-slate-50 p-8 text-center"><MessageSquareText className="w-8 h-8 mx-auto text-slate-300" /><p className="mt-2 text-sm font-semibold text-slate-700">No feedback received yet</p><p className="mt-1 text-xs text-slate-500">Submitted messages will appear here.</p></div>
      : <div className="space-y-3">{rows.map(row => <article key={row.id} className="rounded-2xl border border-slate-200 overflow-hidden">
        <button type="button" onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="w-full flex items-start gap-3 p-3 sm:p-4 text-left hover:bg-slate-50">
          <div className="w-10 h-10 rounded-xl bg-slate-100 overflow-hidden shrink-0 flex items-center justify-center">{row.account_image_url ? <img src={row.account_image_url} alt="" className="w-full h-full object-cover" /> : <MessageSquareText className="w-4 h-4 text-slate-400" />}</div>
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-2"><strong className="text-sm text-slate-900">{row.subject}</strong><span className="rounded-full bg-blue-50 px-2 py-0.5 text-[10px] font-bold text-blue-800">{row.status || 'new'}</span></div><p className="mt-1 text-xs text-slate-600 line-clamp-2">{row.message}</p><p className="mt-2 text-[10px] text-slate-400">{row.user_name || 'Visitor'} · {row.school_name || 'No school linked'} · {formatDate(row.created_at)}</p></div>
          {expanded === row.id ? <ChevronUp className="w-4 h-4 shrink-0 text-slate-400" /> : <ChevronDown className="w-4 h-4 shrink-0 text-slate-400" />}
        </button>
        {expanded === row.id && <div className="border-t border-slate-100 bg-slate-50/70 p-4 space-y-3 text-xs">
          <div><strong className="text-slate-700">Full message</strong><p className="mt-1 whitespace-pre-wrap break-words text-slate-700">{row.message}</p></div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3"><div><strong className="text-slate-500">Submitted by</strong><p className="mt-1 text-slate-800">{row.user_name || 'Anonymous visitor'}</p><p className="text-slate-600 break-all">{row.user_email || 'No email provided'}</p></div><div><strong className="text-slate-500">School / ID</strong><p className="mt-1 text-slate-800">{row.school_name || 'Not linked'}</p><p className="text-slate-500 break-all">{row.school_id || '—'}</p></div><div><strong className="text-slate-500">Page where submitted</strong><p className="mt-1 break-all text-slate-800">{row.page_path || '—'}</p></div><div><strong className="text-slate-500">Date and time</strong><p className="mt-1 text-slate-800">{formatDate(row.created_at)}</p></div></div>
          {row.browser_info && <div><strong className="text-slate-500">Device / browser</strong><p className="mt-1 break-all text-slate-600">{row.browser_info}</p></div>}
          {row.user_email && <a href={`mailto:${encodeURIComponent(row.user_email)}?subject=${encodeURIComponent('Re: ROCKCRAFT feedback - ' + row.subject)}`} className="inline-flex rounded-xl bg-blue-700 px-3 py-2 text-xs font-bold text-white">Reply by email</a>}
        </div>}
      </article>)}</div>}
  </section>;
};
