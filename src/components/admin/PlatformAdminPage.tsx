import React, { useState, useEffect } from 'react';
import { useAuth, PLATFORM_ADMIN_EMAIL } from '../../lib/auth';
import { db, dbEvents } from '../../lib/db';
import { School, PaymentTransaction } from '../../types';
import {
  ShieldAlert,
  Building,
  CreditCard,
  Trash2,
  CheckCircle2,
  RefreshCw,
  Search,
  DollarSign,
  Users
} from 'lucide-react';

export const PlatformAdminPage: React.FC = () => {
  const { user, isPlatformAdmin } = useAuth();
  const [schools, setSchools] = useState<School[]>([]);
  const [payments, setPayments] = useState<PaymentTransaction[]>([]);
  const [search, setSearch] = useState('');

  const loadData = () => {
    setSchools(db.getSchools());
    setPayments(db.getPayments());
  };

  useEffect(() => {
    loadData();
    const unsubSchools = dbEvents.subscribe('schools', loadData);
    const unsubPayments = dbEvents.subscribe('payments', loadData);
    return () => {
      unsubSchools();
      unsubPayments();
    };
  }, []);

  if (!isPlatformAdmin) {
    return (
      <div className="p-8 text-center bg-white rounded-3xl border border-slate-200">
        <ShieldAlert className="w-12 h-12 text-rose-500 mx-auto mb-3" />
        <h3 className="text-base font-bold text-slate-900">Restricted Platform Access</h3>
        <p className="text-xs text-slate-500 mt-1">
          This console is strictly reserved for the ExamCraft platform administrator ({PLATFORM_ADMIN_EMAIL}).
        </p>
      </div>
    );
  }

  const handleDeleteSchool = (id: string, name: string) => {
    if (confirm(`Platform Admin: Are you sure you want to delete school "${name}"? This removes all associated exams and teachers.`)) {
      db.deleteSchool(id);
    }
  };

  const handleResetTrials = (id: string) => {
    db.updateSchool(id, {
      ai_exams_used: 0,
      manual_exams_used: 0,
    });
    alert('Trials reset for this school.');
  };

  const handleToggleSub = (id: string, current: string) => {
    const next = current === 'active' ? 'trial' : 'active';
    db.updateSchool(id, {
      subscription_status: next as any,
    });
  };

  const totalRevenue = payments.reduce((acc, p) => acc + (p.amount_ngn || 0), 0);
  const filteredSchools = schools.filter(
    (s) =>
      s.name.toLowerCase().includes(search.toLowerCase()) ||
      s.email.toLowerCase().includes(search.toLowerCase()) ||
      s.state.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <div className="space-y-6 text-left max-w-5xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-slate-900 text-white p-6 rounded-3xl">
        <div>
          <div className="flex items-center gap-2 text-xs text-purple-400 font-bold uppercase tracking-wider">
            <ShieldAlert className="w-4 h-4" />
            <span>Super Administrator Console</span>
          </div>
          <h2 className="text-xl sm:text-2xl font-black mt-1">Platform Multi-Tenant Oversight</h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Signed in as Platform Owner: <strong className="text-slate-200">{user?.email}</strong>
          </p>
        </div>

        <div className="flex items-center gap-4 bg-slate-800 p-3 rounded-2xl">
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Total Revenue</span>
            <span className="text-lg font-bold text-emerald-400 font-mono">
              ₦{totalRevenue.toLocaleString()}
            </span>
          </div>
          <div>
            <span className="text-[10px] text-slate-400 block uppercase">Total Schools</span>
            <span className="text-lg font-bold text-white font-mono">{schools.length}</span>
          </div>
        </div>
      </div>

      {/* Schools Directory */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <div className="flex items-center justify-between gap-4">
          <h3 className="text-base font-bold text-slate-900">Registered Nigerian Schools</h3>
          <div className="w-64">
            <input
              type="text"
              placeholder="Search schools..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full text-xs p-2 rounded-xl border border-slate-200 outline-none"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-50 text-slate-500 border-b border-slate-200">
              <tr>
                <th className="py-2.5 px-3 font-semibold">School Name</th>
                <th className="py-2.5 px-3 font-semibold">Location</th>
                <th className="py-2.5 px-3 font-semibold">Admin / Email</th>
                <th className="py-2.5 px-3 font-semibold">Trial Usage</th>
                <th className="py-2.5 px-3 font-semibold">Status</th>
                <th className="py-2.5 px-3 font-semibold text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredSchools.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50">
                  <td className="py-3 px-3">
                    <strong className="text-slate-900">{s.name}</strong>
                    <span className="block text-[11px] text-slate-400">{s.institution_type}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span>{s.lga}, {s.state}</span>
                  </td>
                  <td className="py-3 px-3">
                    <span className="font-medium text-slate-800">{s.admin_name}</span>
                    <span className="block text-[11px] text-slate-500">{s.email}</span>
                  </td>
                  <td className="py-3 px-3 tabular-nums font-mono">
                    AI: {s.ai_exams_used}/{s.max_trial_ai_exams} <br />
                    Manual: {s.manual_exams_used}/{s.max_trial_manual_exams}
                  </td>
                  <td className="py-3 px-3">
                    <button
                      onClick={() => handleToggleSub(s.id, s.subscription_status)}
                      className={`px-2 py-0.5 rounded-full font-bold uppercase text-[10px] ${
                        s.subscription_status === 'active'
                          ? 'bg-emerald-100 text-emerald-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {s.subscription_status}
                    </button>
                  </td>
                  <td className="py-3 px-3 text-right space-x-1.5 whitespace-nowrap">
                    <button
                      onClick={() => handleResetTrials(s.id)}
                      className="p-1 text-slate-400 hover:text-purple-700 rounded-md"
                      title="Reset trial counters"
                    >
                      <RefreshCw className="w-3.5 h-3.5" />
                    </button>
                    <button
                      onClick={() => handleDeleteSchool(s.id, s.name)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-md"
                      title="Delete School"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Paystack Payment Transactions */}
      <div className="bg-white p-6 rounded-3xl border border-slate-200/90 shadow-xs space-y-4">
        <h3 className="text-base font-bold text-slate-900">Paystack Transaction Records (₦11,000 / Term)</h3>
        {payments.length === 0 ? (
          <p className="text-xs text-slate-500">No payment transactions recorded yet.</p>
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
              <tbody className="divide-y divide-slate-100 font-mono">
                {payments.map((p) => (
                  <tr key={p.id}>
                    <td className="py-2.5 px-3 font-sans font-medium text-slate-900">
                      {p.school_name}
                    </td>
                    <td className="py-2.5 px-3 text-emerald-700 font-bold">
                      ₦{p.amount_ngn.toLocaleString()}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">{p.reference}</td>
                    <td className="py-2.5 px-3 font-sans">{p.term} ({p.session})</td>
                    <td className="py-2.5 px-3 text-slate-500 text-[11px]">
                      {new Date(p.paid_at).toLocaleDateString()}
                    </td>
                    <td className="py-2.5 px-3 font-sans">
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                        {p.status}
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
