import React, { useCallback, useEffect, useState } from 'react';
import { useAuth } from '../../lib/auth';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { School, PaymentTransaction } from '../../types';
import {
  ShieldAlert,
  CreditCard,
  RefreshCw,
  Search,
  AlertCircle,
  Loader2,
  RotateCcw,
} from 'lucide-react';

function mapSchool(row: any): School {
  return {
    id: row.id,
    name: row.name || '',
    admin_name: row.admin_name || '',
    email: row.email || '',
    phone: row.phone || '',
    state: row.state || '',
    lga: row.lga || '',
    institution_type: row.institution_type || 'Secondary',
    logo_url: row.logo_url || '',
    motto: row.motto || '',
    address: row.address || '',
    subscription_status: row.subscription_status || 'trial',
    subscription_expires_at: row.subscription_expires_at || undefined,
    ai_exams_used: Number(row.ai_exams_used || 0),
    manual_exams_used: Number(row.manual_exams_used || 0),
    max_trial_ai_exams: Number(row.max_trial_ai_exams ?? 4),
    max_trial_manual_exams: Number(row.max_trial_manual_exams ?? 5),
    created_at: row.created_at || '',
  };
}

function mapPayment(row: any): PaymentTransaction {
  return {
    id: row.id,
    school_id: row.school_id,
    school_name: row.school_name || 'School',
    amount_ngn: Number(row.amount_ngn || 0),
    reference: row.reference || '',
    status: row.status || 'pending',
    term: row.term || 'First Term',
    session: row.session || '',
    paid_at: row.paid_at || row.created_at || '',
    channel: row.channel || undefined,
  };
}

export const PlatformAdminPage: React.FC = () => {
  const { user, isPlatformAdmin } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [search, setSearch] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [busySchoolId, setBusySchoolId] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    if (!isPlatformAdmin) {
      setIsLoading(false);
      return;
    }
    if (!isSupabaseConfigured()) {
      setErrorMessage('Supabase is not configured. Check the deployment environment variables.');
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    setErrorMessage(null);
    const [schoolResult, paymentResult] = await Promise.all([
      supabase.from('schools').select('*').order('created_at', { ascending: false }),
      supabase.from('payments').select('*').order('paid_at', { ascending: false }),
    ]);

    if (schoolResult.error || paymentResult.error) {
      console.error('Unable to load platform admin data', schoolResult.error || paymentResult.error);
      setErrorMessage(
        schoolResult.error?.message ||
        paymentResult.error?.message ||
        'Unable to load platform data. Check your Supabase policies and try again.'
      );
      setIsLoading(false);
      return;
    }

    setSchools((schoolResult.data || []).map(mapSchool));
    setPayments((paymentResult.data || []).map(mapPayment));
    setIsLoading(false);
  }, [isPlatformAdmin]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Restricted Platform Access</h3>
        <p className="text-xs text-slate-500 mt-1">
          This console is strictly reserved for authorized ROCKCRAF platform administrators.
        </p>
      </div>
    );
  }

  const handleResetTrials = async (school: School) => {
    if (!confirm(`Reset trial usage counters for "${school.name}"?`)) return;
    setBusySchoolId(school.id);
    setErrorMessage(null);
    setNotice(null);
    const { error } = await supabase
      .from('schools')
      .update({ ai_exams_used: 0, manual_exams_used: 0 })
      .eq('id', school.id);
    setBusySchoolId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNotice(`Trial counters reset for ${school.name}.`);
    await loadData();
  };

  const handleToggleSub = async (school: School) => {
    const next = school.subscription_status === 'active' ? 'trial' : 'active';
    const action = next === 'active' ? 'activate' : 'move back to trial';
    if (!confirm(`Are you sure you want to ${action} the subscription for "${school.name}"?`)) return;
    setBusySchoolId(school.id);
    setErrorMessage(null);
    setNotice(null);
    const { error } = await supabase
      .from('schools')
      .update({ subscription_status: next })
      .eq('id', school.id);
    setBusySchoolId(null);
    if (error) {
      setErrorMessage(error.message);
      return;
    }
    setNotice(`Subscription status updated for ${school.name}.`);
    await loadData();
  };

  const totalRevenue = payments
    .filter((payment) => payment.status === 'success')
    .reduce((total, payment) => total + payment.amount_ngn, 0);

  const filteredSchools = schools.filter((school) =>
    [school.name, school.email, school.state, school.lga]
      .some((value) => value.toLowerCase().includes(search.toLowerCase()))
  );

  return (
    <div className="space-y-6 text-left max-w-6xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2 text-xs text-blue-400 font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Platform Administrator</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1">Platform Overview</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Signed in as: <strong className="text-slate-200">{user?.email}</strong>
          </p>
          <p className="text-[11px] text-slate-400 mt-1">Live records loaded from Supabase.</p>
        </div>
        <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-2xl">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Verified Revenue</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">₦{totalRevenue.toLocaleString()}</span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Registered Schools</span>
            <span className="text-lg font-bold text-white font-mono">{schools.length}</span>
          </div>
        </div>
      </div>

      {errorMessage && (
        <div role="alert" className="p-3 rounded-2xl bg-rose-50 border border-rose-200 text-sm text-rose-800 flex items-start gap-2">
          <AlertCircle className="w-4 h-4 mt-0.5 shrink-0" />
          <span>{errorMessage}</span>
        </div>
      )}
      {notice && (
        <div role="status" className="p-3 rounded-2xl bg-emerald-50 border border-emerald-200 text-sm text-emerald-800">
          {notice}
        </div>
      )}

      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <h3 className="text-base font-bold text-slate-900">Registered Schools</h3>
          <div className="flex gap-2">
            <div className="w-full sm:w-72">
              <input
                type="search"
                aria-label="Search schools"
                placeholder="Search name, email or location..."
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                className="w-full text-xs p-2.5 rounded-xl border border-slate-200 outline-none focus:border-blue-500"
              />
            </div>
            <button onClick={() => void loadData()} disabled={isLoading} className="px-3 rounded-xl border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50" title="Refresh data">
              {isLoading ? <Loader2 className="w-4 h-4 animate-spin" /> : <RefreshCw className="w-4 h-4" />}
            </button>
          </div>
        </div>

        {isLoading ? (
          <div className="py-10 flex items-center justify-center gap-2 text-sm text-slate-500">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading live school records...
          </div>
        ) : filteredSchools.length === 0 ? (
          <p className="py-8 text-center text-sm text-slate-500">
            {schools.length === 0 ? 'No school records were found in Supabase yet.' : 'No schools match your search.'}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2.5 px-3 font-semibold">School</th>
                  <th className="py-2.5 px-3 font-semibold">Location</th>
                  <th className="py-2.5 px-3 font-semibold">School Contact</th>
                  <th className="py-2.5 px-3 font-semibold">Trial Usage</th>
                  <th className="py-2.5 px-3 font-semibold">Subscription</th>
                  <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredSchools.map((school) => (
                  <tr key={school.id} className="hover:bg-slate-50">
                    <td className="py-3 px-3">
                      <strong className="text-slate-900">{school.name}</strong>
                      <span className="block text-[11px] text-slate-400">{school.institution_type}</span>
                    </td>
                    <td className="py-3 px-3">{school.lga}, {school.state}</td>
                    <td className="py-3 px-3">
                      <span className="font-medium text-slate-800">{school.admin_name}</span>
                      <span className="block text-[11px] text-slate-500">{school.email}</span>
                    </td>
                    <td className="py-3 px-3 tabular-nums font-mono">
                      AI: {school.ai_exams_used}/{school.max_trial_ai_exams}
                      <br />
                      Manual: {school.manual_exams_used}/{school.max_trial_manual_exams}
                    </td>
                    <td className="py-3 px-3">
                      <span className={`px-2 py-1 rounded-full font-bold uppercase text-[10px] ${school.subscription_status === 'active' ? 'bg-emerald-100 text-emerald-800' : school.subscription_status === 'expired' ? 'bg-rose-100 text-rose-800' : 'bg-amber-100 text-amber-800'}`}>
                        {school.subscription_status}
                      </span>
                    </td>
                    <td className="py-3 px-3 text-right whitespace-nowrap">
                      <button
                        onClick={() => void handleResetTrials(school)}
                        disabled={busySchoolId === school.id}
                        className="p-2 text-slate-500 hover:text-blue-600 rounded-md disabled:opacity-50"
                        title="Reset trial counters"
                      >
                        {busySchoolId === school.id ? <Loader2 className="w-4 h-4 animate-spin" /> : <RotateCcw className="w-4 h-4" />}
                      </button>
                      <button
                        onClick={() => void handleToggleSub(school)}
                        disabled={busySchoolId === school.id}
                        className="px-2 py-1.5 text-[10px] font-bold text-blue-700 hover:bg-blue-50 rounded-md disabled:opacity-50"
                        title="Change subscription status"
                      >
                        Change status
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center gap-2">
          <CreditCard className="w-5 h-5 text-blue-600" />
          <h3 className="text-base font-bold text-slate-900">Payment Transactions</h3>
        </div>
        <p className="text-xs text-slate-500">Only successful transactions count toward verified revenue. Payment records are read from Supabase.</p>
        {isLoading ? (
          <p className="py-6 text-sm text-slate-500">Loading payment records...</p>
        ) : payments.length === 0 ? (
          <p className="py-6 text-sm text-slate-500">No payment transactions are recorded in Supabase yet. Demo payment rows are not displayed.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-xs">
              <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
                <tr>
                  <th className="py-2 px-3 font-semibold">School</th>
                  <th className="py-2 px-3 font-semibold">Amount</th>
                  <th className="py-2 px-3 font-semibold">Reference</th>
                  <th className="py-2 px-3 font-semibold">Term / Session</th>
                  <th className="py-2 px-3 font-semibold">Date</th>
                  <th className="py-2 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td className="py-2.5 px-3 font-medium text-slate-900">{payment.school_name}</td>
                    <td className="py-2.5 px-3 text-slate-700 font-bold">₦{payment.amount_ngn.toLocaleString()}</td>
                    <td className="py-2.5 px-3 text-slate-600">{payment.reference}</td>
                    <td className="py-2.5 px-3">{payment.term} ({payment.session})</td>
                    <td className="py-2.5 px-3 text-slate-500">{payment.paid_at ? new Date(payment.paid_at).toLocaleDateString() : '—'}</td>
                    <td className="py-2.5 px-3">
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full ${payment.status === 'success' ? 'bg-emerald-100 text-emerald-800' : payment.status === 'pending' ? 'bg-amber-100 text-amber-800' : 'bg-rose-100 text-rose-800'}`}>
                        {payment.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
