import React from 'react';
import { useAuth } from '../../lib/auth';
import {
  LayoutDashboard,
  FileText,
  PlusCircle,
  BookOpen,
  School as SchoolIcon,
  ShieldCheck,
  CreditCard,
  Check
} from 'lucide-react';

interface SidebarProps {
  currentRoute: string;
  navigate: (route: string) => void;
  onOpenPaystack?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, navigate, onOpenPaystack }) => {
  const { school, isPlatformAdmin } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'exams', label: 'Exams', icon: FileText },
    { id: 'create-exam', label: 'Create exam', icon: PlusCircle, isPrimary: true },
    { id: 'classes', label: 'Classes', icon: BookOpen },
    { id: 'profile', label: 'School', icon: SchoolIcon },
  ];

  if (isPlatformAdmin) {
    navItems.push({ id: 'admin', label: 'Platform Admin', icon: ShieldCheck });
  }

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200/90 h-screen sticky top-0 shrink-0 p-5 overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
        <img src="/rockcraft-logo.png?v=4" alt="ROCKCRAFT logo" className="w-10 h-10 object-contain shrink-0" />
        <div className="flex flex-col min-w-0">
          <span className="text-base font-extrabold text-slate-900 tracking-tight">ROCKCRAFT</span>
          <span className="text-xs text-slate-500 font-medium truncate">
            {school?.name || 'WAEC Paper Engine'}
          </span>
        </div>
      </div>

      {/* Navigation Links */}
      <nav className="mt-6 space-y-1.5 flex-1">
        {navItems.map((item) => {
          const Icon = item.icon;
          const isActive = currentRoute === item.id;

          if (item.isPrimary) {
            return (
              <button
                key={item.id}
                onClick={() => navigate(item.id)}
                className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-semibold transition-all my-2 ${
                  isActive
                    ? 'bg-blue-600 text-white shadow-md shadow-blue-600/25'
                    : 'bg-blue-50 text-blue-700 hover:bg-blue-100'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-blue-50 text-blue-800 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-blue-600" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Subscription Card */}
      {school && (
        <div className="mt-auto pt-4 border-t border-slate-100">
          {school.subscription_status === 'active' ? (
            <div className="p-3.5 rounded-2xl bg-emerald-50/90 border border-emerald-200 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-emerald-950 mb-1">
                <span>Plan</span>
                <span className="flex items-center gap-1 uppercase px-2 py-0.5 rounded-md bg-emerald-200 text-emerald-900 text-[10px] font-black">
                  <Check className="w-3 h-3" />
                  PAID
                </span>
              </div>
              <p className="text-xs text-emerald-800 font-medium mt-1 leading-relaxed">
                Unlimited access
              </p>
            </div>
          ) : (
            <div className="p-3.5 rounded-2xl bg-gradient-to-br from-blue-50 via-sky-50/50 to-slate-50 border border-blue-100 text-left">
              <div className="flex items-center justify-between text-xs font-bold text-blue-900 mb-1">
                <span>Free Trial</span>
                <span className={`capitalize px-2 py-0.5 rounded-full text-[10px] font-bold ${
                  school.ai_exams_used >= 4
                    ? 'bg-amber-200 text-amber-900'
                    : 'bg-blue-200/60 text-blue-800'
                }`}>
                  {school.ai_exams_used >= 4 ? 'Limit Reached' : `${school.ai_exams_used}/4 Used`}
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1">
                {school.ai_exams_used >= 4 ? (
                  <span className="text-amber-800 font-semibold">
                    Trial limit reached.
                  </span>
                ) : (
                  <>
                    <span className="font-semibold text-blue-900">
                      {Math.max(0, 4 - school.ai_exams_used)}
                    </span>{' '}
                    trials remaining.
                  </>
                )}
              </p>
              <button
                onClick={onOpenPaystack}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-blue-600 hover:bg-blue-700 active:scale-95 text-white text-xs font-bold shadow-xs transition-all flex items-center justify-center gap-1.5"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>{school.ai_exams_used >= 4 ? 'Upgrade · ₦11,000' : 'Upgrade · ₦11,000'}</span>
              </button>
            </div>
          )}
        </div>
      )}
    </aside>
  );
};
