import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { NIGERIAN_STATES, NIGERIAN_STATES_LGAS } from '../../data/nigeriaStatesLgas';
import { InstitutionType } from '../../types';
import {
  School,
  Lock,
  Mail,
  User,
  Phone,
  MapPin,
  Building,
  KeyRound,
  ArrowRight,
  AlertCircle,
  Loader2
} from 'lucide-react';

interface AuthPageProps {
  initialInviteToken?: string;
  onSuccess: () => void;
}

export const AuthPage: React.FC<AuthPageProps> = ({ initialInviteToken, onSuccess }) => {
  const { login, resetPassword, registerSchoolAndAdmin, joinSchoolAsTeacher } = useAuth();

  const [mode, setMode] = useState<'login' | 'register' | 'join'>(
    initialInviteToken ? 'join' : 'login'
  );

  // Login form state
  const [loginEmail, setLoginEmail] = useState('');
  const [loginPassword, setLoginPassword] = useState('');

  // Register form state
  const [schoolName, setSchoolName] = useState('');
  const [adminName, setAdminName] = useState('');
  const [regEmail, setRegEmail] = useState('');
  const [regPhone, setRegPhone] = useState('');
  const [regState, setRegState] = useState('Lagos');
  const [regLga, setRegLga] = useState('Lagos Island');
  const [institutionType, setInstitutionType] = useState<InstitutionType>('Secondary');
  const [regPassword, setRegPassword] = useState('');

  // Join form state
  const [inviteToken, setInviteToken] = useState(initialInviteToken || '');
  const [inviteSchoolName, setInviteSchoolName] = useState<string | null>(null);
  const [inviteLookupError, setInviteLookupError] = useState<string | null>(null);
  const [teacherName, setTeacherName] = useState('');
  const [teacherEmail, setTeacherEmail] = useState('');
  const [teacherPassword, setTeacherPassword] = useState('');

  // UI state
  const [isLoading, setIsLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!initialInviteToken) return;
    let cancelled = false;
    fetch(`/api/school-invite?token=${encodeURIComponent(initialInviteToken)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success) throw new Error(data.error || 'This school link is invalid or expired.');
        if (!cancelled) setInviteSchoolName(data.school_name);
      })
      .catch((error) => {
        if (!cancelled) setInviteLookupError(error instanceof Error ? error.message : 'Could not verify this school link.');
      });
    return () => { cancelled = true; };
  }, [initialInviteToken]);

  // Update LGA list when State changes
  useEffect(() => {
    const lgas = NIGERIAN_STATES_LGAS[regState] || [];
    if (lgas.length > 0 && !lgas.includes(regLga)) {
      setRegLga(lgas[0]);
    }
  }, [regState]);

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

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!schoolName || !adminName || !regEmail || !regPhone || !regState || !regLga) {
      setErrorMessage('Please fill in all mandatory school registration details.');
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

  const handleJoinSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inviteToken.trim() || !teacherName.trim() || !teacherEmail.trim()) {
      setErrorMessage('Please enter the 6-character token, your name, and email.');
      return;
    }
    setErrorMessage(null);
    setIsLoading(true);

    const res = await joinSchoolAsTeacher(inviteToken.trim().toUpperCase(), teacherName, teacherEmail, teacherPassword);
    setIsLoading(false);
    if (res.success) {
      onSuccess();
    } else {
      setErrorMessage(res.error || 'Failed to join school.');
    }
  };

  return (
    <div className={`${mode === "login" ? "h-[100dvh] max-h-[100dvh] overflow-hidden py-3" : "min-h-[100dvh] py-6"} bg-gradient-to-b from-[#e8f1fb] via-[#f0f5fc] to-[#f8fafc] flex flex-col justify-center items-center px-4`}>
      {/* Brand Header */}
      <div className="text-center mb-4 max-w-sm shrink-0">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center font-black text-2xl mx-auto shadow-lg shadow-blue-600/25 mb-3">
          RC
        </div>
        <h1 className="text-2xl font-black text-slate-900 tracking-tight">ROCKCRAF</h1>
        <p className="text-xs text-slate-600 mt-1 font-medium">
          WAEC, NECO & JAMB Exam Builder for Nigerian Secondary Schools
        </p>
      </div>

      {/* Main Auth Card */}
      <div className={`w-full max-w-md bg-white rounded-3xl shadow-xl shadow-blue-950/5 border border-slate-200/80 ${mode === "login" ? "p-5 sm:p-6" : "p-6 sm:p-8"} text-left`}>
        {/* Navigation Mode Switcher */}
        <div className="grid grid-cols-3 gap-1 p-1 bg-slate-100 rounded-2xl mb-4">
          <button
            type="button"
            onClick={() => {
              setMode('login');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === 'login'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Sign In
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('register');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === 'register'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            New School
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('join');
              setErrorMessage(null);
            }}
            className={`py-2 text-xs font-semibold rounded-xl transition-all ${
              mode === 'join'
                ? 'bg-white text-blue-900 shadow-xs'
                : 'text-slate-600 hover:text-slate-900'
            }`}
          >
            Join School
          </button>
        </div>

        {/* Error notification */}
        {errorMessage && (
          <div className="mb-4 p-3 rounded-2xl bg-rose-50 border border-rose-200 text-xs text-rose-700 flex items-start gap-2 animate-in fade-in">
            <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* 1. SIGN IN FLOW */}
        {mode === 'login' && (
          <form onSubmit={handleLoginSubmit} className="space-y-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official Email Address
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="principal@school.edu.ng"
                  value={loginEmail}
                  onChange={(e) => setLoginEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="text-xs font-semibold text-slate-700">Password</label>
                <button
                  type="button"
                  onClick={async () => {
                    const result = await resetPassword(loginEmail);
                    if (result.success) alert('Password reset email sent. Check your inbox.');
                    else setErrorMessage(result.error || 'Unable to send password reset email.');
                  }}
                  className="text-[11px] text-blue-600 hover:underline"
                >
                  Forgot?
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  placeholder="Enter your password"
                  value={loginPassword}
                  onChange={(e) => setLoginPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Signing in...</span>
                </>
              ) : (
                <>
                  <span>Sign In to School Portal</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        )}

        {/* 2. REGISTER NEW SCHOOL FLOW */}
        {mode === 'register' && (
          <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Official School Name *
              </label>
              <div className="relative">
                <Building className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Grace Model College"
                  value={schoolName}
                  onChange={(e) => setSchoolName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Principal / Admin Full Name *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Mrs. Ngozi Okonkwo"
                  value={adminName}
                  onChange={(e) => setAdminName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Official Email *
                </label>
                <input
                  type="email"
                  required
                  placeholder="admin@school.com"
                  value={regEmail}
                  onChange={(e) => setRegEmail(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Phone Number *
                </label>
                <input
                  type="tel"
                  required
                  placeholder="08012345678"
                  value={regPhone}
                  onChange={(e) => setRegPhone(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            {/* Nigerian State and LGA Cascading Dropdowns */}
            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">State *</label>
                <select
                  value={regState}
                  onChange={(e) => setRegState(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  {NIGERIAN_STATES.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">L.G.A *</label>
                <select
                  value={regLga}
                  onChange={(e) => setRegLga(e.target.value)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                >
                  {(NIGERIAN_STATES_LGAS[regState] || []).map((l) => (
                    <option key={l} value={l}>
                      {l}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2.5">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Institution Type *
                </label>
                <select
                  value={institutionType}
                  onChange={(e) => setInstitutionType(e.target.value as any)}
                  className="w-full px-2.5 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
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
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  Create Password *
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={regPassword}
                  onChange={(e) => setRegPassword(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all mt-4"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Registering School...</span>
                </>
              ) : (
                <>
                  <span>Complete School Registration</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>
          </form>
        )}

        {/* 3. JOIN SCHOOL AS TEACHER VIA TOKEN */}
        {mode === 'join' && (
          <form onSubmit={handleJoinSubmit} className="space-y-4">
            <div className="p-3 bg-blue-50/80 border border-blue-100 rounded-2xl text-xs text-blue-900">
              <span className="font-bold">Joining your school team?</span> Enter the 6-character code from your school admin.
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                6-Character School Token *
              </label>
              <div className="relative">
                <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  maxLength={6}
                  placeholder="e.g. KC2026"
                  value={inviteToken}
                  onChange={(e) => setInviteToken(e.target.value.toUpperCase())}
                  className="w-full pl-10 pr-3.5 py-2.5 text-sm font-mono tracking-widest uppercase rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Full Name (Teacher) *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="text"
                  required
                  placeholder="e.g. Mr. Chinedu Eze"
                  value={teacherName}
                  onChange={(e) => setTeacherName(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Your Email Address *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="email"
                  required
                  placeholder="chinedu@school.edu.ng"
                  value={teacherEmail}
                  onChange={(e) => setTeacherEmail(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Create Password (minimum 8 characters) *
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                <input
                  type="password"
                  required
                  minLength={8}
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={teacherPassword}
                  onChange={(e) => setTeacherPassword(e.target.value)}
                  className="w-full pl-10 pr-3.5 py-2.5 text-xs rounded-xl border border-slate-300 focus:outline-none focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={isLoading}
              className="w-full py-3 rounded-2xl bg-blue-600 hover:bg-blue-700 disabled:opacity-75 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/20 active:scale-[0.99] transition-all"
            >
              {isLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>Verifying Token...</span>
                </>
              ) : (
                <>
                  <span>Join School Staff</span>
                  <ArrowRight className="w-4 h-4" />
                </>
              )}
            </button>

          </form>
        )}
      </div>
    </div>
  );
};
