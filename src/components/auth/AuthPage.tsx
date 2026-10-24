import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { NIGERIAN_STATES, NIGERIAN_STATES_LGAS } from '../../data/nigeriaStatesLgas';
import { InstitutionType } from '../../types';
import {
  Lock,
  Mail,
  User,
  Phone,
  Building,
  ArrowRight,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  FileText,
  GraduationCap,
  Sparkles,
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20';

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, resetPassword, registerSchoolAndAdmin } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<1 | 2>(1);

  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [showLoginPassword, setShowLoginPassword] = useState(false);

  const [schoolName, setSchoolName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regState, setRegState] = useState('Lagos');
  const [regLga, setRegLga] = useState('Lagos Island');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('Secondary');
  const [regPassword, setRegPassword] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const lgas = NIGERIAN_STATES_LGAS[regState] || [];
    if (lgas.length > 0 && !lgas.includes(regLga)) {
      setRegLga(lgas[0]);
    }
  }, [regState]);

  const switchMode = (next: 'login' | 'register') => {
    setMode(next);
    setRegStep(1);
    setErrorMessage(null);
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginEmail.trim()) {
      setErrorMessage('Please enter your school email address.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    const res = await login(loginEmail, loginPassword);
    setIsLoading(false);
    if (res.success) {
      onSuccess();
    } else {
      setErrorMessage(res.error || 'Invalid credentials.');
    }
  };

  const handleRegisterStep1 = (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName.trim() || !adminName.trim() || !regEmail.trim() || !regPhone.trim()) {
      setErrorMessage('Please fill in school name, admin name, email, and phone.');
      return;
    }
    setErrorMessage(null);
    setRegStep(2);
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName || !adminName || !regEmail || !regPhone || !regState || !regLga || !regPassword) {
      setErrorMessage('Please complete all registration details.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    const res = await registerSchoolAndAdmin({
      schoolName,
      adminName,
      email: regEmail,
      phone: regPhone,
      state: regState,
      lga: regLga,
      institutionType,
      password: regPassword,
    });

    setIsLoading(false);
    if (res.success) {
      onSuccess();
    } else {
      setErrorMessage(res.error || 'Registration failed.');
    }
  };

  const heroTitle =
    mode === 'login'
      ? 'Sign in to stay on top of your exam papers'
      : 'Create your school workspace in minutes';

  const heroSubtitle =
    mode === 'login'
      ? 'Generate WAEC-style papers, export DOCX, and invite teachers — all in one place.'
      : 'Set up your school portal, invite teachers, and start creating exams with AI.';

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#eef4fb]">
      {/* Top brand / illustration band */}
      <div className="relative shrink-0 overflow-hidden bg-gradient-to-br from-blue-700 via-blue-600 to-indigo-600 px-5 pb-16 pt-[max(1.25rem,env(safe-area-inset-top))] text-white">
        <div className="pointer-events-none absolute -right-10 -top-8 h-40 w-40 rounded-full bg-white/10 blur-2xl" />
        <div className="pointer-events-none absolute -bottom-16 left-1/4 h-36 w-36 rounded-full bg-indigo-400/30 blur-2xl" />
        <div className="pointer-events-none absolute right-6 top-10 opacity-[0.12]">
          <FileText className="h-24 w-24" strokeWidth={1} />
        </div>
        <div className="pointer-events-none absolute bottom-8 left-4 opacity-[0.1]">
          <GraduationCap className="h-16 w-16" strokeWidth={1} />
        </div>

        <div className="relative mx-auto w-full max-w-md">
          <div className="flex items-center gap-2.5">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-white/15 text-sm font-black tracking-tight shadow-sm ring-1 ring-white/25 backdrop-blur-sm">
              RC
            </div>
            <span className="text-base font-extrabold tracking-tight">ROCKCRAFT</span>
          </div>

          <h1 className="mt-5 max-w-[18rem] text-[1.35rem] font-extrabold leading-snug tracking-tight sm:text-2xl">
            {heroTitle}
          </h1>
          <p className="mt-2 max-w-sm text-xs leading-relaxed text-blue-100 sm:text-[13px]">
            {heroSubtitle}
          </p>

          {/* Decorative cards row — app feel without external images */}
          <div className="mt-5 flex items-end gap-2 opacity-90">
            <div className="h-14 w-20 rounded-xl border border-white/20 bg-white/10 p-2 backdrop-blur-sm">
              <div className="mb-1 h-1.5 w-10 rounded bg-white/50" />
              <div className="h-1.5 w-14 rounded bg-white/30" />
              <div className="mt-2 flex gap-1">
                <Sparkles className="h-3.5 w-3.5 text-white/70" />
              </div>
            </div>
            <div className="h-20 w-24 rounded-xl border border-white/25 bg-white/15 p-2 shadow-lg shadow-blue-950/10 backdrop-blur-sm">
              <div className="mb-1.5 h-1.5 w-12 rounded bg-white/60" />
              <div className="space-y-1">
                <div className="h-1.5 w-full rounded bg-white/25" />
                <div className="h-1.5 w-4/5 rounded bg-white/20" />
                <div className="h-1.5 w-3/5 rounded bg-white/15" />
              </div>
            </div>
            <div className="h-12 w-16 rounded-xl border border-white/15 bg-white/10 p-2 backdrop-blur-sm">
              <div className="h-1.5 w-8 rounded bg-white/40" />
            </div>
          </div>
        </div>
      </div>

      {/* Bottom sheet form — fixed height remainder, no page scroll */}
      <div className="relative z-10 -mt-10 flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200/60 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.08)]">
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
            {/* Mode switch */}
            <div className="mb-4 grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-xl py-2.5 text-xs font-bold transition ${
                  mode === 'login'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`rounded-xl py-2.5 text-xs font-bold transition ${
                  mode === 'register'
                    ? 'bg-white text-blue-700 shadow-sm'
                    : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                New School
              </button>
            </div>

            <div className="mb-3 shrink-0">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                {mode === 'login' ? 'Welcome back' : regStep === 1 ? 'Register your school' : 'Finish setup'}
              </h2>
              <p className="mt-0.5 text-xs text-slate-500">
                {mode === 'login' ? (
                  <>
                    Don't have an account?{' '}
                    <button type="button" onClick={() => switchMode('register')} className="font-semibold text-blue-600">
                      Sign up
                    </button>
                  </>
                ) : (
                  <>
                    Already registered?{' '}
                    <button type="button" onClick={() => switchMode('login')} className="font-semibold text-blue-600">
                      Login
                    </button>
                    {regStep === 2 && <span className="text-slate-400"> · Step 2 of 2</span>}
                  </>
                )}
              </p>
            </div>

            {errorMessage && (
              <div className="mb-3 flex shrink-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            {/* Forms fill remaining space without outer page scroll */}
            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {mode === 'login' && (
                <form onSubmit={handleLoginSubmit} className="flex h-full flex-col">
                  <div className="space-y-3.5">
                    <div>
                      <label className="mb-1.5 block text-xs font-semibold text-slate-600">Email address</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="principal@school.edu.ng"
                          value={loginEmail}
                          onChange={(e) => setLoginEmail(e.target.value)}
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>

                    <div>
                      <div className="mb-1.5 flex items-center justify-between">
                        <label className="text-xs font-semibold text-slate-600">Password</label>
                        <button
                          type="button"
                          onClick={async () => {
                            const result = await resetPassword(loginEmail);
                            if (result.success) alert('Password reset email sent. Check your inbox.');
                            else setErrorMessage(result.error || 'Unable to send password reset email.');
                          }}
                          className="text-[11px] font-semibold text-blue-600 hover:text-blue-700"
                        >
                          Forgot password?
                        </button>
                      </div>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showLoginPassword ? 'text' : 'password'}
                          required
                          autoComplete="current-password"
                          placeholder="Enter your password"
                          value={loginPassword}
                          onChange={(e) => setLoginPassword(e.target.value)}
                          className={`${inputClass} pl-10 pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowLoginPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showLoginPassword ? 'Hide password' : 'Show password'}
                        >
                          {showLoginPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-5">
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Signing in…
                        </>
                      ) : (
                        <>
                          Login
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                    <p className="mt-3 text-center text-[11px] text-slate-400">
                      Teachers join via invite link — no account needed.
                    </p>
                  </div>
                </form>
              )}

              {mode === 'register' && regStep === 1 && (
                <form onSubmit={handleRegisterStep1} className="flex h-full flex-col">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">School name *</label>
                      <div className="relative">
                        <Building className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Grace Model College"
                          value={schoolName}
                          onChange={(e) => setSchoolName(e.target.value)}
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Admin full name *</label>
                      <div className="relative">
                        <User className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="text"
                          required
                          placeholder="e.g. Mrs. Ngozi Okonkwo"
                          value={adminName}
                          onChange={(e) => setAdminName(e.target.value)}
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Email *</label>
                        <div className="relative">
                          <Mail className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="email"
                            required
                            placeholder="admin@school.com"
                            value={regEmail}
                            onChange={(e) => setRegEmail(e.target.value)}
                            className={`${inputClass} pl-9 text-[13px]`}
                          />
                        </div>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">Phone *</label>
                        <div className="relative">
                          <Phone className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <input
                            type="tel"
                            required
                            placeholder="0801…"
                            value={regPhone}
                            onChange={(e) => setRegPhone(e.target.value)}
                            className={`${inputClass} pl-9 text-[13px]`}
                          />
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto pt-4">
                    <button
                      type="submit"
                      className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {mode === 'register' && regStep === 2 && (
                <form onSubmit={handleRegisterSubmit} className="flex h-full flex-col">
                  <div className="space-y-3">
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">State *</label>
                        <select
                          value={regState}
                          onChange={(e) => setRegState(e.target.value)}
                          className={inputClass}
                        >
                          {NIGERIAN_STATES.map((s) => (
                            <option key={s} value={s}>
                              {s}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">L.G.A *</label>
                        <select
                          value={regLga}
                          onChange={(e) => setRegLga(e.target.value)}
                          className={inputClass}
                        >
                          {(NIGERIAN_STATES_LGAS[regState] || []).map((l) => (
                            <option key={l} value={l}>
                              {l}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Institution type *</label>
                      <select
                        value={institutionType}
                        onChange={(e) => setInstitutionType(e.target.value as InstitutionType)}
                        className={inputClass}
                      >
                        <option value="Secondary">Secondary School</option>
                        <option value="College">College</option>
                        <option value="Comprehensive">Comprehensive</option>
                        <option value="International">International</option>
                        <option value="Technical">Technical College</option>
                        <option value="Primary & Secondary">Primary & Secondary</option>
                      </select>
                    </div>

                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Create password *</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          autoComplete="new-password"
                          placeholder="••••••••"
                          value={regPassword}
                          onChange={(e) => setRegPassword(e.target.value)}
                          className={`${inputClass} pl-10 pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPassword((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showRegPassword ? 'Hide password' : 'Show password'}
                        >
                          {showRegPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="mt-auto flex gap-2.5 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setRegStep(1);
                        setErrorMessage(null);
                      }}
                      className="rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      Back
                    </button>
                    <button
                      type="submit"
                      disabled={isLoading}
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99] disabled:opacity-70"
                    >
                      {isLoading ? (
                        <>
                          <Loader2 className="h-4 w-4 animate-spin" />
                          Creating…
                        </>
                      ) : (
                        <>
                          Create account
                          <ArrowRight className="h-4 w-4" />
                        </>
                      )}
                    </button>
                  </div>
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
