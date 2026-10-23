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
import { Exam } from './types';

function AppContent() {
  const { isAuthenticated, school, isLoading } = useAuth();
  const [currentRoute, setCurrentRoute] = useState<string>('dashboard');
  const [routeParam, setRouteParam] = useState<string | null>(null);

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

  const navigate = (route: string, param?: string) => {
    setCurrentRoute(route);
    setRouteParam(param || null);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  // If unauthenticated: only render auth screens (no public marketing landing)
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen bg-[#f0f4f9]">
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
    <div className="min-h-screen bg-[#f0f4f9] flex flex-col md:flex-row text-slate-900 font-sans antialiased">
      <OfflineBanner />

      {/* Desktop/Tablet Left Sidebar */}
      <Sidebar
        currentRoute={currentRoute}
        navigate={navigate}
        onOpenPaystack={() => setIsPaystackOpen(true)}
      />

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0 min-h-screen">
        {/* Top Header */}
        <Header
          currentRoute={currentRoute}
          navigate={navigate}
          onOpenPaystack={() => setIsPaystackOpen(true)}
        />

        {/* PWA In-App Install Banner */}
        <PWAInstallBanner />

        {/* Profile Completion Gate Warning */}
        {isProfileIncomplete && currentRoute !== 'profile' && (
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
        <main className="flex-1 p-4 sm:p-6 lg:p-8 pb-24 md:pb-8">
          {currentRoute === 'dashboard' && (
            <DashboardPage
              navigate={navigate}
              onOpenPaystack={() => setIsPaystackOpen(true)}
              onPreviewExam={(ex) => setPreviewExam(ex)}
            />
          )}

          {currentRoute === 'create-exam' && (
            <CreateExamWizard
              navigate={navigate}
              onOpenPaystack={() => setIsPaystackOpen(true)}
              onSuccessExam={(savedExam) => {
                setLastCreatedExam(savedExam);
                navigate('exam-success', savedExam.exam_code);
              }}
            />
          )}

          {currentRoute === 'exam-success' && lastCreatedExam && (
            <ExamSuccessPage
              exam={lastCreatedExam}
              navigate={navigate}
              onPreview={(ex) => setPreviewExam(ex)}
            />
          )}

          {currentRoute === 'exams' && (
            <ExamsListPage
              navigate={navigate}
              onPreviewExam={(ex) => setPreviewExam(ex)}
            />
          )}

          {currentRoute === 'classes' && <ClassesPage />}

          {currentRoute === 'profile' && (
            <ProfilePage onOpenPaystack={() => setIsPaystackOpen(true)} />
          )}

          {currentRoute === 'admin' && <PlatformAdminPage />}
        </main>

        {/* Mobile Floating Bottom Dock */}
        <BottomNav currentRoute={currentRoute} navigate={navigate} />

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

      <WelcomeModal
        onStartExam={() => navigate('create-exam')}
      />
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
