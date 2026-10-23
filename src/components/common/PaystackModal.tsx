import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../lib/auth';
import { supabase } from '../../lib/supabase';
import {
  X,
  CheckCircle2,
  Shield,
  CreditCard,
  Sparkles,
  Loader2,
  ArrowRight,
  Zap,
  Check
} from 'lucide-react';

interface PaystackModalProps {
  isOpen: boolean;
  onClose: () => void;
  onPaidSuccess?: () => void;
}

export const PaystackModal: React.FC<PaystackModalProps> = ({
  isOpen,
  onClose,
  onPaidSuccess,
}) => {
  const { school, refreshSchool } = useAuth();
  const [term, setTerm] = useState('First Term');
  const [session, setSession] = useState('2025/2026');
  const [isProcessing, setIsProcessing] = useState(false);
  const [paymentStep, setPaymentStep] = useState<'idle' | 'authorizing' | 'success'>('idle');
  const [successReceipt, setSuccessReceipt] = useState<string | null>(null);
  const [paymentError, setPaymentError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const paymentStatus = params.get('payment');
    const reference = params.get('reference');
    if (!paymentStatus) return;

    if (paymentStatus === 'success' && reference) {
      setSuccessReceipt(reference);
      setPaymentStep('success');
      refreshSchool();
    } else if (paymentStatus === 'failed') {
      setPaymentError('Payment was not verified. Your subscription has not been activated. If you were charged, contact support with your payment reference.');
      setPaymentStep('idle');
    }

    params.delete('payment');
    params.delete('reference');
    const query = params.toString();
    window.history.replaceState({}, '', `${window.location.pathname}${query ? `?${query}` : ''}${window.location.hash}`);
  }, [refreshSchool]);

  if (!isOpen || !school) return null;

  const isAlreadyPaid = school.subscription_status === 'active';
  const trialUsed = school.ai_exams_used;
  const isLimitReached = trialUsed >= 4 && !isAlreadyPaid;

  const triggerCelebration = () => {
    try {
      confetti({
        particleCount: 80,
        spread: 70,
        origin: { y: 0.6 },
        colors: ['#1d4ed8', '#10b981', '#f59e0b', '#3b82f6'],
      });
      setTimeout(() => {
        confetti({
          particleCount: 50,
          angle: 60,
          spread: 55,
          origin: { x: 0 },
        });
        confetti({
          particleCount: 50,
          angle: 120,
          spread: 55,
          origin: { x: 1 },
        });
      }, 250);
    } catch {
      // Ignore if canvas not supported
    }
  };

  const handlePay = async () => {
    setIsProcessing(true);
    setPaymentError(null);
    setPaymentStep('authorizing');

    try {
      // Never activate a subscription based on a timer or a client-generated reference.
      // This app currently has no verified payment endpoint wired to this modal.
      const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
      if (sessionError || !sessionData.session?.access_token) {
        throw new Error('Your secure session has expired. Please sign in again before paying.');
      }

      const response = await fetch('/api/initialize-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${sessionData.session.access_token}`,
        },
        body: JSON.stringify({
          school_id: school.id,
          term,
          session,
        }),
      });

      const result = await response.json().catch(() => ({}));
      if (!response.ok || typeof result.authorization_url !== 'string') {
        throw new Error(
          typeof result.error === 'string'
            ? result.error
            : 'Secure Paystack checkout is not configured yet. No payment has been taken.'
        );
      }

      window.location.assign(result.authorization_url);
    } catch (error) {
      setPaymentStep('idle');
      setPaymentError(error instanceof Error ? error.message : 'Unable to start secure payment. No payment has been taken.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in duration-200">
      <div className="w-full max-w-lg bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-left relative max-h-[92vh] overflow-y-auto">
        <button
          onClick={onClose}
          className="absolute top-5 right-5 p-1.5 text-slate-400 hover:text-slate-700 rounded-full hover:bg-slate-100 transition-colors"
          title="Close dialog"
        >
          <X className="w-5 h-5" />
        </button>

        {paymentStep === 'success' || successReceipt ? (
          <div className="text-center py-4 space-y-4">
            <div className="w-16 h-16 bg-emerald-100 text-emerald-600 rounded-3xl flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 className="w-9 h-9" />
            </div>

            <div>
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 text-emerald-800 border border-emerald-200 text-xs font-bold tracking-wider uppercase mb-2">
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>PAID · FULL TERM ACTIVE</span>
              </div>
              <h3 className="text-xl font-black text-slate-900">Payment Detected & Verified!</h3>
              <p className="text-xs text-slate-600 mt-1 max-w-sm mx-auto">
                Full unlimited access granted to <strong className="text-slate-900">{school.name}</strong>. Your 5th exam and all subsequent examinations are 100% unlocked!
              </p>
            </div>

            <div className="p-4 bg-slate-50 rounded-2xl border border-slate-200 text-xs space-y-2 font-mono text-left">
              <div className="flex justify-between items-center pb-2 border-b border-slate-200/80">
                <span className="text-slate-500">Subscription Status:</span>
                <span className="font-bold text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded-md">
                  PAID (ACTIVE)
                </span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Amount Paid:</span>
                <span className="font-bold text-slate-900">₦11,000.00</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Term & Session:</span>
                <span className="text-slate-800">{term} ({session})</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Payment Gateway:</span>
                <span className="text-blue-600">Paystack Verified</span>
              </div>
              <div className="flex justify-between truncate">
                <span className="text-slate-500">Ref:</span>
                <span className="text-slate-700 text-[11px] truncate max-w-[200px]">{successReceipt}</span>
              </div>
            </div>

            <div className="p-3 bg-emerald-50/70 border border-emerald-100 rounded-xl text-left text-xs text-emerald-900 flex items-start gap-2">
              <Sparkles className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
              <span>
                <strong>Unlimited Access Active:</strong> You can now author and generate unlimited AI questions, download formatted single-page A4 papers, and generate marking schemes without limits.
              </span>
            </div>

            <button
              onClick={() => {
                setPaymentStep('idle');
                setSuccessReceipt(null);
                onClose();
              }}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-sm shadow-md shadow-blue-600/20 active:scale-98 transition-all flex items-center justify-center gap-2"
            >
              <span>Continue with Exam Creation</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        ) : (
          <div>
            {/* Header */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 text-blue-700 flex items-center justify-center font-black shadow-xs">
                <CreditCard className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-lg font-black text-slate-900">School Term Subscription</h3>
                <p className="text-xs text-slate-500">Official Paystack Gateway · ₦11,000 / Term</p>
              </div>
            </div>

            {/* Paywall trigger notification if limit reached */}
            {isLimitReached ? (
              <div className="p-3.5 rounded-2xl bg-amber-50 border border-amber-200 mb-4 text-xs text-amber-950 flex items-start gap-2.5">
                <Zap className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                <div>
                  <span className="font-bold text-amber-900 block">
                    4 of 4 Free Trial Generations Completed!
                  </span>
                  <span>
                    You have reached the free limit (4 exams). To generate your <strong>5th exam</strong> and unlock unlimited exams for your entire school this term, complete payment below.
                  </span>
                </div>
              </div>
            ) : isAlreadyPaid ? (
              <div className="p-3.5 rounded-2xl bg-emerald-50 border border-emerald-200 mb-4 text-xs text-emerald-950 flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span className="font-bold">Your school is already marked as PAID & ACTIVE!</span>
                </div>
                <span className="px-2 py-0.5 bg-emerald-200 text-emerald-900 font-bold rounded-md text-[10px]">
                  ACTIVE
                </span>
              </div>
            ) : (
              <div className="p-3.5 rounded-2xl bg-blue-50/70 border border-blue-100 mb-4 text-xs text-blue-950">
                <div className="flex justify-between items-center mb-1">
                  <span className="font-semibold">Free Trial Progress</span>
                  <span className="font-bold text-blue-700">{trialUsed} / 4 Used</span>
                </div>
                <div className="w-full bg-blue-200/60 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-blue-600 h-full rounded-full transition-all duration-300"
                    style={{ width: `${Math.min(100, (trialUsed / 4) * 100)}%` }}
                  />
                </div>
                <p className="text-[11px] text-slate-500 mt-1.5">
                  The first 4 exams are free. Attempting the 5th exam requires term access.
                </p>
              </div>
            )}

            {/* Plan Card */}
            <div className="mb-4 border border-slate-200 rounded-2xl p-4 bg-slate-50/50">
              <div className="flex items-baseline justify-between">
                <div>
                  <span className="text-2xl font-black text-slate-900">₦11,000</span>
                  <span className="text-xs text-slate-500 font-medium ml-1">/ School Term</span>
                </div>
                <span className="text-[11px] bg-emerald-50 text-emerald-700 font-bold px-2.5 py-1 rounded-full border border-emerald-200">
                  Full School Unlimited
                </span>
              </div>

              <ul className="mt-3.5 space-y-2 text-xs text-slate-600">
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited AI examination generation across JSS 1 – SSS 3</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>One-click downloadable DOCX with single-page A4 optimization</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Confidential Marking Schemes & Scoring guides automatically generated</span>
                </li>
                <li className="flex items-center gap-2">
                  <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                  <span>Unlimited teacher collaboration with school join tokens</span>
                </li>
              </ul>
            </div>

            {/* Term & Session select */}
            <div className="grid grid-cols-2 gap-3 mb-4">
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

            {/* Pay Button */}
            {paymentError && (
              <div role="alert" className="mb-3 rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800">
                {paymentError}
              </div>
            )}
            <button
              onClick={handlePay}
              disabled={isProcessing}
              className="w-full py-3.5 rounded-2xl bg-blue-600 hover:bg-blue-700 active:scale-98 disabled:opacity-70 text-white font-bold text-sm flex items-center justify-center gap-2 shadow-lg shadow-blue-600/25 transition-all"
            >
              {isProcessing ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Detecting & Verifying Paystack Payment...</span>
                </>
              ) : (
                <>
                  <span>Pay ₦11,000 via Paystack</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

            <p className="text-[11px] text-center text-slate-400 mt-3 flex items-center justify-center gap-1.5">
              <Shield className="w-3.5 h-3.5 text-emerald-600" />
              <span>Secured 256-bit SSL · Instant Automatic System Activation</span>
            </p>
          </div>
        )}
      </div>
    </div>
  );
};
