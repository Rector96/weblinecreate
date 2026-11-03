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
  ArrowLeft,
  AlertCircle,
  Loader2,
  Eye,
  EyeOff,
  MapPin,
} from 'lucide-react';

interface AuthPageProps {
  onSuccess: () => void;
}

const inputClass =
  'w-full rounded-xl border border-slate-200 bg-slate-50/80 px-3.5 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition focus:border-blue-500 focus:bg-white focus:ring-2 focus:ring-blue-500/20';

const REG_STEPS = [
  { id: 1, label: 'School' },
  { id: 2, label: 'Admin' },
  { id: 3, label: 'Password' },
] as const;

type RegStep = 1 | 2 | 3;

export const AuthPage: React.FC<AuthPageProps> = ({ onSuccess }) => {
  const { login, resetPassword, registerSchoolAndAdmin } = useAuth();

  const [mode, setMode] = useState<'login' | 'register'>('login');
  const [regStep, setRegStep] = useState<RegStep>(1);

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
  const [regPasswordConfirm, setRegPasswordConfirm] = useState('');
  const [showRegPassword, setShowRegPassword] = useState(false);
  const [showRegPasswordConfirm, setShowRegPasswordConfirm] = useState(false);

  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const lgas = NIGERIAN_STATES_LGAS[regState] || [];
    if (lgas.length > 0 && !lgas.includes(regLga)) {
      setRegLga(lgas[0]);
    }
  }, [regState, regLga]);

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
    if (res.success) onSuccess();
    else setErrorMessage(res.error || 'Invalid credentials.');
  };

  const goRegNext = (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage(null);

    if (regStep === 1) {
      if (!schoolName.trim() || !regState || !regLga) {
        setErrorMessage('Enter school name, state, and L.G.A to continue.');
        return;
      }
      setRegStep(2);
      return;
    }

    if (regStep === 2) {
      if (!adminName.trim() || !regEmail.trim() || !regPhone.trim()) {
        setErrorMessage('Enter admin name, email, and phone to continue.');
        return;
      }
      setRegStep(3);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!regPassword || regPassword.length < 6) {
      setErrorMessage('Password must be at least 6 characters.');
      return;
    }
    if (regPassword !== regPasswordConfirm) {
      setErrorMessage('Passwords do not match.');
      return;
    }
    if (!schoolName || !adminName || !regEmail || !regPhone || !regState || !regLga) {
      setErrorMessage('Please complete all registration details.');
      setRegStep(1);
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
    if (res.success) onSuccess();
    else setErrorMessage(res.error || 'Registration failed.');
  };

  const heroImages = [
    { src: 'https://images.unsplash.com/photo-1509062522246-3755977927d7?auto=format&fit=crop&w=1800&q=85', alt: 'Students learning in a classroom' },
    { src: 'https://images.unsplash.com/photo-1427504494785-3a9ca7044f45?auto=format&fit=crop&w=1800&q=85', alt: 'Teacher supporting students in class' },
    { src: 'https://images.unsplash.com/photo-1503676260728-1c00da094a0b?auto=format&fit=crop&w=1800&q=85', alt: 'Students studying together' },
    { src: 'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?auto=format&fit=crop&w=1800&q=85', alt: 'Students celebrating academic success' },
  ];
  const [activeHeroImage, setActiveHeroImage] = useState(0);
  const touchStartX = React.useRef<number | null>(null);

  useEffect(() => {
    const timer = window.setInterval(() => {
      setActiveHeroImage((current) => (current + 1) % heroImages.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <div className="relative flex h-[100dvh] max-h-[100dvh] flex-col overflow-hidden bg-[#eef4fb]">
      {/* Full-width, text-free photo carousel. Auth forms below remain unchanged. */}
      <section
        className="relative h-[34dvh] min-h-[220px] max-h-[360px] w-full shrink-0 overflow-hidden bg-slate-900 sm:h-[38dvh] sm:max-h-[420px]"
        aria-label="ROCKCRAFT photo carousel"
        onTouchStart={(event) => { touchStartX.current = event.touches[0]?.clientX ?? null; }}
        onTouchEnd={(event) => {
          if (touchStartX.current === null) return;
          const delta = event.changedTouches[0].clientX - touchStartX.current;
          if (Math.abs(delta) > 45) {
            setActiveHeroImage((current) => (current + (delta < 0 ? 1 : -1) + heroImages.length) % heroImages.length);
          }
          touchStartX.current = null;
        }}
      >
        {heroImages.map((image, index) => (
          <img
            key={image.src}
            src={image.src}
            alt={image.alt}
            aria-hidden={index !== activeHeroImage}
            draggable={false}
            loading={index === 0 ? 'eager' : 'lazy'}
            className={`absolute inset-0 h-full w-full select-none object-cover object-center transition-opacity duration-1000 ease-in-out ${index === activeHeroImage ? 'z-[1] opacity-100' : 'z-0 opacity-0'}`}
          />
        ))}
        <div className="pointer-events-none absolute inset-x-0 bottom-0 z-[2] h-20 bg-gradient-to-t from-slate-950/35 to-transparent" />
        <div className="absolute bottom-4 left-1/2 z-[3] flex -translate-x-1/2 items-center gap-2.5" aria-label={`Slide ${activeHeroImage + 1} of ${heroImages.length}`}>
          {heroImages.map((image, index) => (
            <button
              key={image.src}
              type="button"
              onClick={() => setActiveHeroImage(index)}
              aria-label={`Show picture ${index + 1}`}
              aria-current={index === activeHeroImage ? 'true' : undefined}
              className={`h-2.5 rounded-full transition-all duration-300 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white ${index === activeHeroImage ? 'w-7 bg-white' : 'w-2.5 bg-white/55 hover:bg-white/85'}`}
            />
          ))}
        </div>
      </section>

      {/* Bottom sheet */}
      <div className="relative z-10 -mt-5 flex min-h-0 flex-1 flex-col">
        <div className="mx-auto flex h-full w-full max-w-md flex-col overflow-hidden rounded-t-[1.75rem] border border-slate-200/60 bg-white shadow-[0_-8px_40px_rgba(15,23,42,0.08)]">
          <div className="flex min-h-0 flex-1 flex-col px-5 pb-[max(1rem,env(safe-area-inset-bottom))] pt-5">
            {/* Mode switch */}
            <div className="mb-3 grid shrink-0 grid-cols-2 gap-1 rounded-2xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => switchMode('login')}
                className={`rounded-xl py-2.5 text-xs font-bold transition ${
                  mode === 'login' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                Login
              </button>
              <button
                type="button"
                onClick={() => switchMode('register')}
                className={`rounded-xl py-2.5 text-xs font-bold transition ${
                  mode === 'register' ? 'bg-white text-blue-700 shadow-sm' : 'text-slate-500 hover:text-slate-800'
                }`}
              >
                New School
              </button>
            </div>

            {/* Dynamic step progress — register only */}
            {mode === 'register' && (
              <div className="mb-3 shrink-0">
                <div className="flex items-center justify-between gap-1">
                  {REG_STEPS.map((step, index) => {
                    const active = regStep === step.id;
                    const done = regStep > step.id;
                    return (
                      <React.Fragment key={step.id}>
                        <button
                          type="button"
                          onClick={() => {
                            if (done || active) {
                              setErrorMessage(null);
                              setRegStep(step.id);
                            }
                          }}
                          className="flex min-w-0 flex-1 flex-col items-center gap-1"
                          aria-current={active ? 'step' : undefined}
                        >
                          <span
                            className={`flex h-7 w-7 items-center justify-center rounded-full text-[11px] font-bold transition ${
                              active
                                ? 'bg-blue-600 text-white shadow-sm shadow-blue-600/30'
                                : done
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-slate-100 text-slate-400'
                            }`}
                          >
                            {done ? '✓' : step.id}
                          </span>
                          <span
                            className={`truncate text-[10px] font-semibold ${
                              active ? 'text-blue-700' : done ? 'text-blue-600' : 'text-slate-400'
                            }`}
                          >
                            {step.label}
                          </span>
                        </button>
                        {index < REG_STEPS.length - 1 && (
                          <div
                            className={`mb-4 h-0.5 w-6 shrink-0 rounded-full sm:w-10 ${
                              regStep > step.id ? 'bg-blue-400' : 'bg-slate-200'
                            }`}
                          />
                        )}
                      </React.Fragment>
                    );
                  })}
                </div>
              </div>
            )}

            <div className="mb-2.5 shrink-0">
              <h2 className="text-lg font-extrabold tracking-tight text-slate-900">
                {mode === 'login'
                  ? 'Welcome back'
                  : regStep === 1
                  ? 'School details'
                  : regStep === 2
                  ? 'Admin contact'
                  : 'Create password'}
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
                    <span className="text-slate-400"> · Step {regStep} of 3</span>
                  </>
                )}
              </p>
            </div>

            {errorMessage && (
              <div className="mb-2.5 flex shrink-0 items-start gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-700">
                <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
              {/* LOGIN */}
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
                            if (result.success) window.dispatchEvent(new CustomEvent('rockcraft:notify', { detail: { message: 'Password reset email sent. Check your inbox.', kind: 'success' } }));
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

              {/* REGISTER STEP 1 — School */}
              {mode === 'register' && regStep === 1 && (
                <form onSubmit={goRegNext} className="flex h-full flex-col">
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
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="mb-1 block text-xs font-semibold text-slate-600">State *</label>
                        <div className="relative">
                          <MapPin className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
                          <select
                            value={regState}
                            onChange={(e) => setRegState(e.target.value)}
                            className={`${inputClass} pl-9`}
                          >
                            {NIGERIAN_STATES.map((s) => (
                              <option key={s} value={s}>
                                {s}
                              </option>
                            ))}
                          </select>
                        </div>
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

              {/* REGISTER STEP 2 — Admin */}
              {mode === 'register' && regStep === 2 && (
                <form onSubmit={goRegNext} className="flex h-full flex-col">
                  <div className="space-y-3">
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
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Official email *</label>
                      <div className="relative">
                        <Mail className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="email"
                          required
                          autoComplete="email"
                          placeholder="admin@school.edu.ng"
                          value={regEmail}
                          onChange={(e) => setRegEmail(e.target.value)}
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Phone number *</label>
                      <div className="relative">
                        <Phone className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type="tel"
                          required
                          placeholder="08012345678"
                          value={regPhone}
                          onChange={(e) => setRegPhone(e.target.value)}
                          className={`${inputClass} pl-10`}
                        />
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2.5 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setRegStep(1);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
                      Back
                    </button>
                    <button
                      type="submit"
                      className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-blue-600 py-3.5 text-sm font-bold text-white shadow-md shadow-blue-600/25 transition hover:bg-blue-700 active:scale-[0.99]"
                    >
                      Continue
                      <ArrowRight className="h-4 w-4" />
                    </button>
                  </div>
                </form>
              )}

              {/* REGISTER STEP 3 — Password (was missing from a clear step) */}
              {mode === 'register' && regStep === 3 && (
                <form onSubmit={handleRegisterSubmit} className="flex h-full flex-col">
                  <div className="space-y-3">
                    <div className="rounded-xl border border-blue-100 bg-blue-50/70 px-3 py-2.5 text-[11px] leading-relaxed text-blue-800">
                      You'll sign in with <span className="font-bold">{regEmail || 'your email'}</span> and this
                      password.
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Create password *</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showRegPassword ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          placeholder="At least 6 characters"
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
                    <div>
                      <label className="mb-1 block text-xs font-semibold text-slate-600">Confirm password *</label>
                      <div className="relative">
                        <Lock className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                        <input
                          type={showRegPasswordConfirm ? 'text' : 'password'}
                          required
                          minLength={6}
                          autoComplete="new-password"
                          placeholder="Re-enter password"
                          value={regPasswordConfirm}
                          onChange={(e) => setRegPasswordConfirm(e.target.value)}
                          className={`${inputClass} pl-10 pr-11`}
                        />
                        <button
                          type="button"
                          onClick={() => setShowRegPasswordConfirm((v) => !v)}
                          className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
                          aria-label={showRegPasswordConfirm ? 'Hide password' : 'Show password'}
                        >
                          {showRegPasswordConfirm ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                        </button>
                      </div>
                    </div>
                  </div>
                  <div className="mt-auto flex gap-2.5 pt-4">
                    <button
                      type="button"
                      onClick={() => {
                        setErrorMessage(null);
                        setRegStep(2);
                      }}
                      className="inline-flex items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-bold text-slate-700 transition hover:bg-slate-50"
                    >
                      <ArrowLeft className="h-4 w-4" />
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
