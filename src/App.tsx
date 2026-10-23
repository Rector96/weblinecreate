/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect } from 'react';
import { AuthProvider, useAuth } from './lib/auth';
import { Header } from './components/common/Header';
import { Sidebar } from './components/common/Sidebar';
import { BottomNav } from './components/common/BottomNav';
import { OfflineBanner } from './components/common/OfflineBanner';
import { PWAInstallBanner } from './components/common/PWAInstallBanner';
import { WhatsAppButton } from './components/common/WhatsAppButton';
import { PaystackModal } from './components/common/PaystackModal';
import { WelcomeModal } from './components/common/WelcomeModal';
import { AuthPage } from './components/auth/AuthPage';
import { DashboardPage } from './components/dashboard/DashboardPage';
import { CreateExamWizard } from './components/create-exam/CreateExamWizard';
import { ExamSuccessPage } from './components/create-exam/ExamSuccessPage';
import { ExamsListPage } from './components/exams/ExamsListPage';
import { ClassesPage } from './components/classes/ClassesPage';
import { ProfilePage } from './components/profile/ProfilePage';
import { PlatformAdminPage } from './components/admin/PlatformAdminPage';
import { ExamPreviewModal } from './components/exams/ExamPreviewModal';
import { PageLoader } from './components/common/PageLoader';
import { Exam, School } from './types';

function AppContent() {
  const { isAuthenticated, school, role, isLoading } = useAuth();
  const isTeacher = role === 'teacher';
  const teacherAllowedRoutes = ['create-exam', 'exam-success', 'teacher-finished'];
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [routeParam, setRouteParam] = useState<string | null>(null);
  const visibleRoute = isTeacher && !teacherAllowedRoutes.includes(currentRoute) ? 'create-exam' : currentRoute;
  const [isInitialLoading, setIsInitialLoading] = useState(true);

  useEffect(() => {
    if (isAuthenticated && role === 'teacher' && !['create-exam', 'exam-success', 'teacher-finished'].includes(currentRoute)) {
      setCurrentRoute('create-exam');
      setRouteParam(null);
    }
  }, [isAuthenticated, role, currentRoute]);

  // Modals state
  const [isPaystackOpen, setIsPaystackOpen] = useState(false);
  const [previewExam, setPreviewExam] = useState<Exam | null>(null);
  const [lastCreatedExam, setLastCreatedExam] = useState<Exam | null>(null);

  // Check URL pathname for /join/:token on mount
  const [initialJoinToken] = useState<string | undefined>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/join/')) {
      return path.split('/join/')[1]?.toUpperCase();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('token')?.toUpperCase() || undefined;
  });

  // A school invitation is a limited, passwordless capability for exam creation only.
  const [guestInviteSchool, setGuestInviteSchool] = useState<School | null>(null);
  const [guestInviteLoading, setGuestInviteLoading] = useState(Boolean(initialJoinToken));
  const [guestInviteError, setGuestInviteError] = useState<string | null>(null);
  const [guestRoute, setGuestRoute] = useState<'welcome' | 'create-exam' | 'exam-success' | 'teacher-finished'>('welcome');
  const [guestLastCreatedExam, setGuestLastCreatedExam] = useState<Exam | null>(null);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (!initialJoinToken || isAuthenticated) {
      setGuestInviteLoading(false);
      return;
    }
    let cancelled = false;
    setGuestInviteLoading(true);
    fetch(`/api/school-invite?token=${encodeURIComponent(initialJoinToken)}`)
      .then(async (response) => {
        const data = await response.json();
        if (!response.ok || !data.success || !data.school?.id) {
          throw new Error(data.error || 'This school link is invalid or expired.');
        }
        if (!cancelled) setGuestInviteSchool(data.school as School);
      })
      .catch((error) => {
        if (!cancelled) setGuestInviteError(error instanceof Error ? error.message : 'Could not verify this school link.');
      })
      .finally(() => {
        if (!cancelled) setGuestInviteLoading(false);
      });
    return () => { cancelled = true; };
  }, [initialJoinToken, isAuthenticated]);

  useEffect(() => {
    const paymentStatus = new URLSearchParams(window.location.search).get('payment');
    if (paymentStatus === 'success' || paymentStatus === 'failed') {
      setIsPaystackOpen(true);
    }
  }, []);


  const navigate = (route: string, param?: string) => {
    setCurrentRoute(route);
    setRouteParam(param || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // One shared loader covers startup, authentication, and invitation validation.
  if (isLoading || isInitialLoading || (Boolean(initialJoinToken) && !isAuthenticated && guestInviteLoading)) {
    return <PageLoader />;
  }

  // Passwordless teacher links never show the account creation or sign-in forms.
  if (!isAuthenticated && initialJoinToken) {
    if (!guestInviteSchool) {
      return (
        <div className="min-h-[100dvh] bg-[#f4f7fc] flex items-center justify-center px-5">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-7 text-center shadow-xl">
            <h1 className="text-3xl font-black tracking-tight text-slate-950">ROCKCRAFT</h1>
            <h2 className="mt-5 text-lg font-bold text-slate-900">School link unavailable</h2>
            <p className="mt-2 text-sm text-slate-600">{guestInviteError || 'This school link is invalid or expired. Please ask your school admin for a new link.'}</p>
          </div>
        </div>
      );
    }
    const guestNavigate = (route: string) => {
      if (route === 'create-exam' || route === 'exam-success' || route === 'teacher-finished') setGuestRoute(route);
      else setGuestRoute('welcome');
    };
    if (guestRoute === 'create-exam') {
      return (
        <div className="h-[100dvh] max-h-[100dvh] overflow-y-auto bg-[#f5f7fb]">
          <div className="mx-auto max-w-5xl px-3 py-3 sm:px-5 sm:py-4">
            <div className="mb-3 flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <div className="min-w-0"><p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">ROCKCRAFT</p><h1 className="truncate text-sm font-bold text-slate-900">{guestInviteSchool.name}</h1></div>
              <button onClick={() => setGuestRoute('welcome')} className="shrink-0 text-xs font-semibold text-slate-500 hover:text-slate-900">Exit</button>
            </div>
            <CreateExamWizard
              navigate={guestNavigate}
              onOpenPaystack={() => {}}
              guestInviteToken={initialJoinToken}
              guestSchool={guestInviteSchool}
              onSuccessExam={(exam) => { setGuestLastCreatedExam(exam); setGuestRoute('exam-success'); }}
            />
          </div>
        </div>
      );
    }
    if (guestRoute === 'exam-success' && guestLastCreatedExam) {
      return <ExamSuccessPage exam={guestLastCreatedExam} navigate={guestNavigate} onPreview={(exam) => setPreviewExam(exam)} schoolOverride={guestInviteSchool} />;
    }
    if (guestRoute === 'teacher-finished') {
      return (
        <div className="min-h-[100dvh] bg-[#f4f7fc] flex items-center justify-center px-5">
          <div className="w-full max-w-md rounded-3xl bg-white border border-slate-200 p-7 text-center shadow-xl">
            <h1 className="text-3xl font-black tracking-tight text-slate-950">ROCKCRAFT</h1>
            <div className="mx-auto mt-6 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-2xl text-emerald-700">✓</div>
            <h2 className="mt-4 text-lg font-bold text-slate-900">Thank you for creating your exam.</h2>
            <p className="mt-2 text-sm text-slate-600">Your marking scheme should have downloaded automatically. Please contact your school admin if you need another copy.</p>
            <button onClick={() => setGuestRoute('create-exam')} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Create another exam</button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-[100dvh] bg-gradient-to-b from-[#eaf2ff] via-[#f5f8fd] to-white flex items-center justify-center px-5 py-8">
        <div className="w-full max-w-md rounded-[2rem] border border-white bg-white/95 p-7 sm:p-9 text-center shadow-2xl shadow-blue-950/10">
          <h1 className="text-3xl sm:text-4xl font-black tracking-tight text-slate-950">ROCKCRAFT</h1>
          <div className="mx-auto mt-5 h-1 w-14 rounded-full bg-blue-600" />
          <p className="mt-5 text-xs font-semibold uppercase tracking-widest text-blue-700">Teacher exam workspace</p>
          <h2 className="mt-2 text-xl font-extrabold text-slate-900">Welcome to {guestInviteSchool.name}</h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">Create your school examination paper and marking scheme in a few guided steps. No teacher account or password is needed.</p>
          <button onClick={() => setGuestRoute('create-exam')} className="mt-7 w-full rounded-2xl bg-blue-700 px-5 py-3.5 text-sm font-bold text-white shadow-lg shadow-blue-700/20 transition hover:bg-blue-800">Start Creating Exam <span aria-hidden="true">→</span></button>
          <p className="mt-4 text-[11px] text-slate-500">This link only grants access to exam creation for this school.</p>
        </div>
      </div>
    );
  }

  // If unauthenticated: only render auth screens (no public marketing landing)
  if (!isAuthenticated) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#f0f4f9]">
        <OfflineBanner />
        <AuthPage
          onSuccess={() => navigate('dashboard')}
        />
        <WhatsAppButton />
      </div>
    );
  }

  // Profile gate: if authenticated user has no school associated, enforce profile completion
  const isProfileIncomplete = !school?.id;

  return (
    <div className="app-shell min-h-screen bg-[#f5f7fb] flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      <OfflineBanner />

      {/* Desktop/Tablet Left Sidebar */}
      {!isTeacher && <Sidebar currentRoute={visibleRoute} navigate={navigate} onOpenPaystack={() => setIsPaystackOpen(true)} />}

      {/* Main Content Area */}
      <div className="app-main flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        {!isTeacher && <Header currentRoute={visibleRoute} navigate={navigate} onOpenPaystack={() => setIsPaystackOpen(true)} />}

        {/* PWA In-App Install Banner */}
        {!isTeacher && <PWAInstallBanner />}

        {/* Profile Completion Gate Warning */}
        {!isTeacher && isProfileIncomplete && currentRoute !== 'profile' && (
          <div className="mx-4 sm:mx-8 mt-4 p-4 rounded-2xl bg-amber-50 border border-amber-200 text-amber-900 text-xs flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <span>
              <strong>Action Required:</strong> Please complete your Nigerian school details to unlock full exam generation.
            </span>
            <button
              onClick={() => navigate('profile')}
              className="px-3 py-1.5 rounded-xl bg-amber-600 text-white font-semibold text-xs hover:bg-amber-700 w-fit"
            >
              Set Up School Profile
            </button>
          </div>
        )}

        {/* Viewport Content */}
        <main className={isTeacher ? 'flex-1 min-h-0 overflow-y-auto px-3 py-3 sm:px-5 sm:py-4' : 'flex-1 px-3 py-4 sm:px-5 sm:py-5 lg:px-7 lg:py-6 pb-safe-nav'}>
          {isTeacher && <div className="mb-3 rounded-2xl bg-white border border-slate-200 px-4 py-3 flex items-center gap-3 shadow-sm"><div className="w-10 h-10 rounded-xl bg-blue-600 text-white flex items-center justify-center font-black">RC</div><div className="min-w-0"><p className="text-[11px] text-slate-500">Welcome to</p><h1 className="font-bold text-slate-900 text-sm truncate">{school?.name || 'your school'}</h1></div></div>}
          <div key={visibleRoute} className="route-screen animate-page-enter">
            {!isTeacher && visibleRoute === 'dashboard' && (
              <DashboardPage
                navigate={navigate}
                onOpenPaystack={() => setIsPaystackOpen(true)}
                onPreviewExam={(ex) => setPreviewExam(ex)}
              />
            )}

            {visibleRoute === 'create-exam' && (
              <CreateExamWizard
                navigate={navigate}
                onOpenPaystack={() => setIsPaystackOpen(true)}
                onSuccessExam={(savedExam) => {
                  setLastCreatedExam(savedExam);
                  navigate('exam-success', savedExam.exam_code);
                }}
              />
            )}

            {visibleRoute === 'exam-success' && lastCreatedExam && (
              <ExamSuccessPage
                exam={lastCreatedExam}
                navigate={navigate}
                onPreview={(ex) => setPreviewExam(ex)}
              />
            )}

            {!isTeacher && visibleRoute === 'exams' && (
              <ExamsListPage
                navigate={navigate}
                onPreviewExam={(ex) => setPreviewExam(ex)}
              />
            )}

            {!isTeacher && visibleRoute === 'classes' && <ClassesPage />}

            {!isTeacher && visibleRoute === 'profile' && (
              <ProfilePage onOpenPaystack={() => setIsPaystackOpen(true)} />
            )}

            {!isTeacher && visibleRoute === 'admin' && <PlatformAdminPage />}
            {visibleRoute === 'teacher-finished' && isTeacher && <div className="max-w-md mx-auto mt-10 bg-white rounded-3xl border border-slate-200 p-6 text-center shadow-sm"><div className="mx-auto mb-3 w-12 h-12 rounded-2xl bg-emerald-100 text-emerald-700 flex items-center justify-center text-2xl">✓</div><h2 className="text-lg font-bold text-slate-900">Thank you for creating your exam.</h2><p className="text-sm text-slate-600 mt-2">Your marking scheme has been downloaded. Ask your school admin if you need another copy.</p><button onClick={() => navigate('create-exam')} className="mt-5 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white">Create another exam</button></div>}
          </div>
        </main>

        {/* Mobile Floating Bottom Dock */}
        {!isTeacher && <BottomNav currentRoute={visibleRoute} navigate={navigate} />}

        {/* WhatsApp Customer Support Float */}
        <WhatsAppButton />
      </div>

      {/* Global Modals */}
      <PaystackModal
        isOpen={isPaystackOpen}
        onClose={() => setIsPaystackOpen(false)}
      />

      <ExamPreviewModal
        exam={previewExam}
        onClose={() => setPreviewExam(null)}
      />

      {!isTeacher && <WelcomeModal onStartExam={() => navigate('create-exam')} />}
    </div>
  );
}

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
