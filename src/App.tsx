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
import { Exam } from './types';

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
  const [initialJoinToken, setInitialJoinToken] = useState<string | undefined>(() => {
    const path = window.location.pathname;
    if (path.startsWith('/join/')) {
      return path.split('/join/')[1]?.toUpperCase();
    }
    const params = new URLSearchParams(window.location.search);
    return params.get('token')?.toUpperCase() || undefined;
  });

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsInitialLoading(false);
    }, 700);
    return () => clearTimeout(timer);
  }, []);

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

  // Smooth PageLoader on app launch / auth resolution
  if (isLoading || isInitialLoading) {
    return (
      <PageLoader
        message="Loading ROCKCRAF Examination Workspace..."
        minDurationMs={650}
        onFinish={() => setIsInitialLoading(false)}
      />
    );
  }

  // If unauthenticated: only render auth screens (no public marketing landing)
  if (!isAuthenticated) {
    return (
      <div className="h-[100dvh] max-h-[100dvh] overflow-hidden bg-[#f0f4f9]">
        <OfflineBanner />
        <AuthPage
          initialInviteToken={initialJoinToken}
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
