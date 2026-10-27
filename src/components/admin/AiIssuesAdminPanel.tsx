import React, { useCallback, useEffect, useState } from 'react';
import { Activity, RefreshCw, Loader2, AlertTriangle, CheckCircle2, ChevronDown, ChevronUp, Search } from 'lucide-react';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';

type Issue = {
  id: string; created_at: string; request_id: string; operation: string; stage: string;
  severity: string; status: string; school_id: string | null; provider: string; model: string | null;
  http_status: number | null; error_code: string | null; error_message: string;
  attempt_count: number; duration_ms: number | null; metadata: Record<string, unknown>;
  resolution_notes: string | null; ai_analysis?: string | null; ai_recommendation?: string | null; repair_status?: string; repair_metadata?: Record<string, unknown>;
};
const fmt = (value: string) => new Date(value).toLocaleString('en-NG', { dateStyle: 'medium', timeStyle: 'short' });

export const AiIssuesAdminPanel: React.FC = () => {
  const [rows, setRows] = useState<Issue[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<'open' | 'all' | 'resolved'>('open');
  const [search, setSearch] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);
  const [saving, setSaving] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!isSupabaseConfigured()) { setError('Supabase is not configured.'); setLoading(false); return; }
    setLoading(true); setError('');
    let query = supabase.from('ai_operation_issues').select('*').order('created_at', { ascending: false }).limit(250);
    if (filter !== 'all') query = query.eq('status', filter);
    const { data, error: queryError } = await query;
    if (queryError) {
      setError(queryError.message.includes('ai_operation_issues')
        ? 'AI issue tracking is not installed yet. Apply the latest Supabase migration, then refresh.'
        : 'Could not load AI issues. Check your platform-admin permissions and Supabase connection.');
      setRows([]);
    } else setRows((data || []) as Issue[]);
    setLoading(false);
  }, [filter]);

  useEffect(() => { void load(); }, [load]);

  const resolve = async (row: Issue) => {
    setSaving(row.id); setError('');
    const nextStatus = row.status === 'resolved' ? 'open' : 'resolved';
    const { error: updateError } = await supabase.from('ai_operation_issues').update({
      status: nextStatus, resolved_at: nextStatus === 'resolved' ? new Date().toISOString() : null,
      resolution_notes: nextStatus === 'resolved' ? 'Reviewed in platform admin console' : null,
    }).eq('id', row.id);
    setSaving(null);
    if (updateError) { setError('Could not update this issue. Verify platform-admin database permissions.'); return; }
    await load();
  };

  const visible = rows.filter(row => [row.error_message, row.school_id || '', row.stage, row.request_id, row.error_code || ''].join(' ').toLowerCase().includes(search.toLowerCase()));

  return <section className="space-y-4 rounded-3xl border border-slate-200 bg-white p-4 shadow-sm sm:p-6">
    <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="flex items-center gap-3"><span className="rounded-2xl bg-rose-50 p-3 text-rose-700"><Activity className="h-5 w-5" /></span><div><h3 className="text-lg font-black text-slate-900">AI operations & system issues</h3><p className="mt-1 text-xs text-slate-500">Sanitized failure reports from handwriting scans; no prompts, photos or API secrets are stored.</p></div></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex items-center justify-center gap-2 rounded-xl bg-blue-50 px-3 py-2.5 text-xs font-bold text-blue-800 disabled:opacity-50"><RefreshCw className={'h-4 w-4 ' + (loading ? 'animate-spin' : '')} /> Refresh issues</button>
    </div>
    <div className="flex flex-col gap-2 sm:flex-row">
      <div className="relative min-w-0 flex-1"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" /><input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search error, school ID or request ID…" className="w-full rounded-xl border border-slate-200 py-3 pl-9 pr-3 text-sm outline-none focus:border-blue-500" /></div>
      <select aria-label="Filter AI issues" value={filter} onChange={e => setFilter(e.target.value as typeof filter)} className="rounded-xl border border-slate-200 bg-white p-3 text-sm"><option value="open">Open issues</option><option value="all">All issues</option><option value="resolved">Resolved issues</option></select>
    </div>
    {error && <div role="alert" className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900"><AlertTriangle className="h-4 w-4 shrink-0" />{error}</div>}
    {loading ? <div className="flex items-center justify-center gap-2 py-8 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin" />Loading AI issues…</div>
      : visible.length === 0 ? <div className="rounded-2xl bg-slate-50 p-8 text-center"><CheckCircle2 className="mx-auto h-8 w-8 text-emerald-500" /><p className="mt-2 text-sm font-semibold text-slate-700">No issues in this view</p><p className="mt-1 text-xs text-slate-500">New scanner failures will be recorded here automatically.</p></div>
      : <div className="space-y-3">{visible.map(row => <article key={row.id} className="overflow-hidden rounded-2xl border border-slate-200">
        <button type="button" onClick={() => setExpanded(expanded === row.id ? null : row.id)} className="flex w-full items-start gap-3 p-3 text-left hover:bg-slate-50 sm:p-4">
          <span className={'mt-0.5 rounded-full px-2 py-1 text-[10px] font-bold uppercase ' + (row.status === 'resolved' ? 'bg-emerald-100 text-emerald-800' : row.severity === 'critical' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800')}>{row.status}</span>
          <div className="min-w-0 flex-1"><strong className="block break-words text-sm text-slate-900">{row.error_code || row.stage}</strong><p className="mt-1 line-clamp-2 break-words text-xs text-slate-600">{row.error_message}</p><p className="mt-2 text-[10px] text-slate-400">{fmt(row.created_at)} · {row.provider}{row.model ? ' / ' + row.model : ''} · {row.http_status || 'no HTTP status'}</p></div>
          {expanded === row.id ? <ChevronUp className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" />}
        </button>
        {expanded === row.id && <div className="space-y-3 border-t border-slate-100 bg-slate-50/70 p-4 text-xs">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2"><div><strong className="text-slate-500">School ID</strong><p className="mt-1 break-all text-slate-800">{row.school_id || 'Not available'}</p></div><div><strong className="text-slate-500">Request ID</strong><p className="mt-1 break-all text-slate-800">{row.request_id}</p></div><div><strong className="text-slate-500">Operation / stage</strong><p className="mt-1 text-slate-800">{row.operation} / {row.stage}</p></div><div><strong className="text-slate-500">Timing / attempts</strong><p className="mt-1 text-slate-800">{row.duration_ms == null ? 'Unknown duration' : row.duration_ms + ' ms'} · {row.attempt_count} attempt(s)</p></div><div><strong className="text-slate-500">Provider response</strong><p className="mt-1 text-slate-800">HTTP {row.http_status || 'unknown'} · {row.error_code || 'unclassified'}</p></div><div><strong className="text-slate-500">Safe metadata</strong><pre className="mt-1 whitespace-pre-wrap break-words text-slate-600">{JSON.stringify(row.metadata || {}, null, 2)}</pre></div></div>
          <div className="rounded-xl border border-blue-100 bg-blue-50/70 p-3">
            <strong className="text-xs text-blue-950">AI incident analysis</strong>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{row.ai_analysis || 'No AI analysis was recorded for this issue. Check the provider logs and retry history.'}</p>
            <strong className="mt-3 block text-xs text-blue-950">Recommended next step</strong>
            <p className="mt-1 whitespace-pre-wrap break-words text-xs leading-5 text-slate-700">{row.ai_recommendation || 'Inspect the error category and verify provider quota/configuration.'}</p>
            <p className="mt-2 text-[10px] font-semibold uppercase tracking-wide text-blue-700">Repair status: {row.repair_status || 'not_run'}</p>
          </div>
          <button type="button" disabled={saving === row.id} onClick={() => void resolve(row)} className="inline-flex items-center gap-2 rounded-xl bg-slate-900 px-3 py-2.5 text-xs font-bold text-white disabled:opacity-50">{saving === row.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5" />}{row.status === 'resolved' ? 'Reopen issue' : 'Mark resolved'}</button>
        </div>}
      </article>)}</div>}
    <p className="text-[10px] leading-relaxed text-slate-400">This panel reports detected scanner failures. It does not guarantee that every infrastructure outage can be recorded if the database or network itself is unavailable.</p>
  </section>;
};
