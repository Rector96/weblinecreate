import React, { useEffect, useMemo, useState } from 'react';
import { Search, Building2, Phone, Mail, MapPin, RefreshCw, Loader2, AlertCircle, Copy, Check } from 'lucide-react';
import { supabase, isSupabaseConfigured } from '../../lib/supabase';

type SchoolContact = {
  id: string; name: string; admin_name: string; email: string; phone: string;
  state: string; lga: string; address: string; institution_type: string; created_at: string;
};

export const CustomerCarePage: React.FC = () => {
  const [schools, setSchools] = useState<SchoolContact[]>([]);
  const [search, setSearch] = useState('');
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState('');

  const load = async () => {
    setLoading(true); setError('');
    if (!isSupabaseConfigured()) { setError('School directory is unavailable because Supabase is not configured.'); setLoading(false); return; }
    const { data, error: queryError } = await supabase.from('schools')
      .select('id,name,admin_name,email,phone,state,lga,address,institution_type,created_at')
      .order('name', { ascending: true });
    if (queryError) { setError('Could not load school contacts. Confirm the customer-care database migration is applied and this account has the customer_care role.'); setSchools([]); }
    else {
      const rows = (data || []) as SchoolContact[];
      setSchools(rows);
      setSelectedId(current => rows.some(row => row.id === current) ? current : (rows[0]?.id || ''));
    }
    setLoading(false);
  };

  useEffect(() => { void load(); }, []);
  const filtered = useMemo(() => schools.filter(s => [s.name,s.admin_name,s.email,s.phone,s.state,s.lga,s.address].join(' ').toLowerCase().includes(search.toLowerCase())), [schools,search]);
  const selected = filtered.find(s => s.id === selectedId) || filtered[0] || null;
  const copy = async (label: string, value: string) => {
    if (!value) return;
    try { await navigator.clipboard.writeText(value); setCopied(label); window.setTimeout(() => setCopied(''), 1500); }
    catch { setError('Copy is not available in this browser. Select the contact text and copy it manually.'); }
  };

  return <div className="mx-auto max-w-6xl space-y-5 p-1 sm:p-2">
    <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div><p className="text-xs font-bold uppercase tracking-widest text-blue-700">ROCKCRAFT · Support workspace</p><h1 className="mt-1 text-2xl font-black text-slate-950">School contact directory</h1><p className="mt-1 text-sm text-slate-500">Search registered schools and view their registration contact details. This workspace is read-only.</p></div>
      <button onClick={() => void load()} disabled={loading} className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 disabled:opacity-50"><RefreshCw className={'h-4 w-4 '+(loading?'animate-spin':'')} /> Refresh</button>
    </header>
    <div className="grid gap-4 lg:grid-cols-[minmax(260px,0.85fr)_minmax(0,1.4fr)]">
      <section className="overflow-hidden rounded-2xl border border-slate-200 bg-white">
        <div className="border-b border-slate-100 p-3"><label className="relative block"><Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400"/><input value={search} onChange={e=>setSearch(e.target.value)} placeholder="Search school, email, phone or location" className="min-h-11 w-full rounded-xl border border-slate-200 py-2 pl-9 pr-3 text-sm outline-none focus:border-blue-500"/></label><p className="mt-2 text-xs text-slate-500">{filtered.length} school{filtered.length===1?'':'s'} found</p></div>
        <div className="max-h-[60vh] overflow-y-auto p-2">
          {loading ? <div className="flex items-center gap-2 p-5 text-sm text-slate-500"><Loader2 className="h-4 w-4 animate-spin"/>Loading school contacts…</div> : filtered.length===0 ? <p className="p-5 text-sm text-slate-500">No matching schools.</p> : filtered.map(s=><button key={s.id} onClick={()=>setSelectedId(s.id)} className={'mb-1 w-full rounded-xl border p-3 text-left transition '+((selected?.id===s.id)?'border-blue-300 bg-blue-50':'border-transparent hover:bg-slate-50')}><span className="block truncate text-sm font-bold text-slate-900">{s.name}</span><span className="mt-1 block truncate text-xs text-slate-500">{s.admin_name||'Contact person not provided'}</span><span className="mt-1 block truncate text-xs text-slate-500">{[s.lga,s.state].filter(Boolean).join(', ')||'Location not provided'}</span></button>)}
        </div>
      </section>
      <section className="min-h-64 rounded-2xl border border-slate-200 bg-white p-4 sm:p-6">
        {error && <p role="alert" className="mb-4 flex items-start gap-2 rounded-xl bg-amber-50 p-3 text-sm text-amber-900"><AlertCircle className="mt-0.5 h-4 w-4 shrink-0"/>{error}</p>}
        {!selected ? <div className="flex min-h-48 flex-col items-center justify-center text-center text-slate-400"><Building2 className="h-9 w-9"/><p className="mt-3 text-sm">Select a school to view its contact details.</p></div> : <div className="space-y-5">
          <div className="flex items-start gap-3"><div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-blue-50 text-blue-700"><Building2 className="h-6 w-6"/></div><div className="min-w-0"><h2 className="break-words text-xl font-black text-slate-950">{selected.name}</h2><p className="mt-1 text-sm text-slate-500">{selected.institution_type||'Institution type not provided'}</p></div></div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">School administrator</p><p className="mt-2 break-words text-sm font-semibold text-slate-900">{selected.admin_name||'Not provided'}</p></div>
            <div className="rounded-xl border border-slate-100 p-3"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Registered</p><p className="mt-2 text-sm font-semibold text-slate-900">{selected.created_at?new Date(selected.created_at).toLocaleDateString('en-NG',{day:'numeric',month:'short',year:'numeric'}):'Unknown'}</p></div>
            <div className="rounded-xl border border-slate-100 p-3 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Email address</p><div className="mt-2 flex items-center gap-2"><Mail className="h-4 w-4 shrink-0 text-slate-400"/><a className="min-w-0 flex-1 break-all text-sm font-semibold text-blue-700" href={selected.email?'mailto:'+selected.email:undefined}>{selected.email||'Not provided'}</a><button onClick={()=>void copy('email',selected.email)} aria-label="Copy email" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{copied==='email'?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}</button></div></div>
            <div className="rounded-xl border border-slate-100 p-3 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Phone number</p><div className="mt-2 flex items-center gap-2"><Phone className="h-4 w-4 shrink-0 text-slate-400"/><a className="min-w-0 flex-1 break-words text-sm font-semibold text-blue-700" href={selected.phone?'tel:'+selected.phone:undefined}>{selected.phone||'Not provided'}</a><button onClick={()=>void copy('phone',selected.phone)} aria-label="Copy phone number" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{copied==='phone'?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}</button></div></div>
            <div className="rounded-xl border border-slate-100 p-3 sm:col-span-2"><p className="text-xs font-semibold uppercase tracking-wide text-slate-400">Location</p><div className="mt-2 flex items-start gap-2"><MapPin className="mt-0.5 h-4 w-4 shrink-0 text-slate-400"/><p className="flex-1 break-words text-sm text-slate-800">{[selected.address,selected.lga,selected.state].filter(Boolean).join(', ')||'Location not provided during registration'}</p><button onClick={()=>void copy('location',[selected.address,selected.lga,selected.state].filter(Boolean).join(', '))} aria-label="Copy location" className="rounded-lg p-2 text-slate-500 hover:bg-slate-100">{copied==='location'?<Check className="h-4 w-4"/>:<Copy className="h-4 w-4"/>}</button></div></div>
          </div>
          <p className="text-xs leading-5 text-slate-400">Only registration contact information is shown. This account cannot edit school records, access exams, or change billing and subscription settings.</p>
        </div>}
      </section>
    </div>
  </div>;
};
