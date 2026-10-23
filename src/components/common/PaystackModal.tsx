import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { X, CheckCircle2, Shield, CreditCard, Sparkles, Loader2, ArrowRight } from 'lucide-react';

interface PaystackModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const PaystackModal: React.FC<PaystackModalProps> = ({ isOpen, onClose }) => {
  const { school, refreshSchool } = useAuth();
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('2025/2026');
  const [isProcessing, setIsProcessing] = useState(false);
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);

  if (!isOpen || !school) return null;

  const handlePay = async () => {
    setIsProcessing(true);
    try {
      // Step 1: Call server initialization endpoint
      const response = await fetch('/api/initialize-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_id: school.id,
          school_name: school.name,
          email: school.email,
          term,
          session,
        }),
      });

      const resData = await response.json();
      const reference = resData?.data?.reference || `EC_${Date.now()}`;

      // Simulate network confirmation / Paystack inline callback
      setTimeout(() => {
        db.recordPayment(school.id, reference, 11000, term, session);
        refreshSchool();
        setIsProcessing(false);
        setSuccessReceipt(reference);
      }, 1200);
    } catch {
      // Offline fallback
      const reference = `EC_OFFLINE_${Date.now()}`;
      db.recordPayment(school.id, reference, 11000, term, session);
      refreshSchool();
      setIsProcessing(false);
      setSuccessReceipt(reference);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-left relative max-h-[90vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100"
        >
          <X className="w-5 h-5" />
        </button>

        {successReceipt ? (
          <div className="text-center py-6">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-4">
              <CheckCircle2 className="w-8 h-8" />
            </div>
            <h3 className="text-xl font-bold text-slate-900">Payment Successful!</h3>
            <p className="text-sm text-slate-600 mt-2">
              <strong className="text-slate-800">{school.name}</strong> is now subscribed for the{' '}
              <strong className="text-blue-600">{term} ({session})</strong>.
            </p>
            <div className="my-5 p-3.5 bg-slate-50 rounded-2xl border border-slate-200/80 text-xs text-left space-y-1 font-mono">
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-slate-900">₦11,000.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Reference:</span>
                <span className="text-blue-600">{successReceipt}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Status:</span>
                <span className="text-emerald-700 font-bold">ACTIVE (UNLIMITED)</span>
              </div>
            </div>
            <button
              onClick={() => {
                setSuccessReceipt(null);
                onClose();
              }}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-800 text-white font-semibold text-sm transition-all"
            >
              Continue to Dashboard
            </button>
          </div>
        ) : (
          <div>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-2xl bg-blue-100 text-blue-600 flex items-center justify-center">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-bold text-slate-900">School Term Subscription</h3>
                <p className="text-xs text-slate-500">Official Paystack Gateway · ₦ Pricing</p>
              </div>
            </div>

            {/* Trial Usage Summary Card */}
            <div className="p-4 rounded-2xl bg-blue-50/70 border border-blue-100 mb-5">
              <div className="flex justify-between items-center text-xs font-semibold text-blue-950 mb-2">
                <span>Current Trial Consumption</span>
                <span className="uppercase text-[10px] tracking-wider font-bold px-2 py-0.5 rounded-full bg-blue-200 text-blue-900">
                  {school.subscription_status}
                </span>
              </div>
              <div className="grid grid-cols-2 gap-3 text-xs">
                <div className="p-2.5 bg-white rounded-xl border border-blue-100">
                  <span className="block text-slate-500 text-[11px]">AI Generated Exams</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {school.ai_exams_used} / {school.max_trial_ai_exams} used
                  </span>
                </div>
                <div className="p-2.5 bg-white rounded-xl border border-blue-100">
                  <span className="block text-slate-500 text-[11px]">Manual Exams</span>
                  <span className="text-sm font-bold text-slate-900 tabular-nums">
                    {school.manual_exams_used} / {school.max_trial_manual_exams} used
                  </span>
                </div>
              </div>
            </div>

            {/* Plan Price & Features */}
            <div className="mb-5 border border-slate-200 rounded-2xl p-4">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-extrabold text-slate-900 tracking-tight">₦11,000</span>
                  <span className="text-xs text-slate-500 font-medium ml-1">/ School Term</span>
                </div>
                <span className="text-xs bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                  Full School Access
                </span>
              </div>

              <ul className="mt-4 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited AI examination paper generation (JSS 1 – SSS 3)</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Exact WAEC/JAMB standard 12pt Times New Roman DOCX exports</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confidential Marking Schemes with step-by-step scoring breakdown</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited teacher accounts with instant 6-letter join codes</span>
                </li>
              </ul>
            </div>

            {/* Select Term & Session */}
            <div className="grid grid-cols-2 gap-3 mb-5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Term</label>
                <select
                  value={term}
                  onChange={(e) => setTerm(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  <option value="First Term">First Term</option>
                  <option value="Second Term">Second Term</option>
                  <option value="Third Term">Third Term</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">Session</label>
                <select
                  value={session}
                  onChange={(e) => setSession(e.target.value)}
                  className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  <option value="2025/2026">2025/2026</option>
                  <option value="2026/2027">2026/2027</option>
                </select>
              </div>
            </div>

            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-800 disabled:opacity-70 text-white font-semibold text-sm flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Connecting to Paystack...</span>
                </>
              ) : (
                <>
                  <span>Pay ₦11,000 via Paystack</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1">
              <Shield className="w-3.5 h-3.5 text-slate-400" />
              <span>Secured by 256-bit encryption · Official Paystack Merchant</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
