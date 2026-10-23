import React from 'react';
import { useAuth } from '../../lib/auth';
import { School, User, Sparkles, LogOut, ShieldCheck, CreditCard, Check } from 'lucide-react';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
  onOpenPaystack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ currentRoute, navigate, onOpenPaystack }) => {
  const { user, school, role, logout, isPlatformAdmin } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/95 backdrop-blur-md border-b border-slate-200/80 px-4 sm:px-8 py-3.5 flex items-center justify-between gap-8">
      {/* Zone 1: Single Brand Wordmark ROCKCRAF */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg group"
        >
          <div className="w-9 h-9 rounded-xl bg-gradient-to-tr from-blue-700 to-blue-500 flex items-center justify-center text-white shadow-sm shadow-blue-600/20 group-hover:scale-105 transition-transform duration-150">
            <span className="font-extrabold text-sm tracking-tighter">RC</span>
          </div>
          <div className="flex flex-col">
            <span className="text-base font-extrabold tracking-tight text-slate-900 group-hover:text-blue-600 transition-colors">
              ROCKCRAF
            </span>
            {school?.name && (
              <span className="text-[11px] font-medium text-slate-500 truncate max-w-[150px] sm:max-w-[220px]">
                {school.name}
              </span>
            )}
          </div>
        </button>
      </div>

      {/* Zone 2: Concise Nav Links (Desktop) */}
      <nav className="hidden md:flex items-center gap-7 text-sm font-medium text-slate-600">
        <button
          onClick={() => navigate('dashboard')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            currentRoute === 'dashboard' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
          }`}
        >
          Dashboard
        </button>
        <button
          onClick={() => navigate('exams')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            currentRoute === 'exams' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
          }`}
        >
          Exams
        </button>
        <button
          onClick={() => navigate('create-exam')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            currentRoute === 'create-exam' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
          }`}
        >
          Create Exam
        </button>
        <button
          onClick={() => navigate('classes')}
          className={`whitespace-nowrap shrink-0 transition-colors ${
            currentRoute === 'classes' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
          }`}
        >
          Classes
        </button>
        {isPlatformAdmin && (
          <button
            onClick={() => navigate('admin')}
            className={`whitespace-nowrap shrink-0 transition-colors ${
              currentRoute === 'admin' ? 'text-blue-600 font-semibold' : 'hover:text-slate-900'
            }`}
          >
            Platform Admin
          </button>
        )}
      </nav>

      {/* Zone 3: Primary Action & Profile Info */}
      <div className="flex items-center gap-2.5 shrink-0">
        {school && (
          <button
            onClick={onOpenPaystack}
            className={`hidden sm:flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-all ${
              school.subscription_status === 'active'
                ? 'bg-emerald-50 text-emerald-800 border border-emerald-300 font-bold shadow-xs'
                : school.ai_exams_used >= 4
                ? 'bg-amber-50 text-amber-900 border border-amber-300 hover:bg-amber-100 font-bold animate-pulse'
                : 'bg-blue-50 text-blue-700 border border-blue-200 hover:bg-blue-100'
            }`}
            title="Manage School Subscription"
          >
            {school.subscription_status === 'active' ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-600" />
                <span>PAID · FULL TERM ACTIVE</span>
              </>
            ) : (
              <>
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {school.ai_exams_used >= 4
                    ? '4/4 Used · Pay ₦11,000'
                    : `Trial: ${Math.max(0, 4 - school.ai_exams_used)} AI left`}
                </span>
              </>
            )}
          </button>
        )}

        <button
          onClick={() => navigate('profile')}
          className="flex items-center gap-2 p-1.5 rounded-xl hover:bg-slate-100 transition-colors text-slate-700"
          title="School & User Profile"
        >
          <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-800 flex items-center justify-center font-bold text-xs ring-1 ring-blue-300">
            {user?.full_name?.charAt(0) || 'U'}
          </div>
          <span className="hidden lg:inline text-xs font-medium text-slate-700 max-w-[120px] truncate">
            {user?.full_name?.split(' ')[0] || 'User'}
          </span>
        </button>

        <button
          onClick={logout}
          className="p-2 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-lg transition-colors"
          title="Sign out"
        >
          <LogOut className="w-4 h-4" />
        </button>
      </div>
    </header>
  );
};
