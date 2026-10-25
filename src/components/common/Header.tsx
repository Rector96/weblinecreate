import React from 'react';
import { useAuth } from '../../lib/auth';
import { LogOut, CreditCard, Check } from 'lucide-react';

interface HeaderProps {
  currentRoute: string;
  navigate: (route: string) => void;
  onOpenPaystack?: () => void;
}

export const Header: React.FC<HeaderProps> = ({ navigate, onOpenPaystack }) => {
  const { user, school, logout } = useAuth();

  return (
    <header className="sticky top-0 z-30 bg-white/90 backdrop-blur-xl border-b border-slate-200/70 px-3 sm:px-6 py-3 flex items-center justify-between gap-3">
      {/* Zone 1: Single Brand Wordmark ROCKCRAFT */}
      <div className="flex items-center gap-3 shrink-0">
        <button
          onClick={() => navigate('dashboard')}
          className="flex items-center gap-2.5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-600 rounded-lg group"
        >
          <img src="/rockcraft-rc.svg?v=3" alt="ROCKCRAFT" className="w-10 h-10 object-contain shrink-0 group-hover:scale-105 transition-transform duration-150" />
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
                <span>Active</span>
              </>
            ) : (
              <>
                <CreditCard className="w-3.5 h-3.5" />
                <span>
                  {school.ai_exams_used >= 4
                    ? 'Upgrade · ₦11,000'
                    : `${Math.max(0, 4 - school.ai_exams_used)} trials left`}
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
