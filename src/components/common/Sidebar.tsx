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
  UserCheck,
  Users,
  Sparkles
} from 'lucide-react';

interface SidebarProps {
  currentRoute: string;
  navigate: (route: string) => void;
  onOpenPaystack?: () => void;
}

export const Sidebar: React.FC<SidebarProps> = ({ currentRoute, navigate, onOpenPaystack }) => {
  const { user, school, role, isPlatformAdmin, switchDemoUser } = useAuth();

  const navItems = [
    { id: 'dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { id: 'exams', label: 'Exams Repository', icon: FileText },
    { id: 'create-exam', label: 'Create New Exam', icon: PlusCircle, isPrimary: true },
    { id: 'classes', label: 'Manage Classes', icon: BookOpen },
    { id: 'profile', label: 'School Settings', icon: SchoolIcon },
  ];

  if (isPlatformAdmin) {
    navItems.push({ id: 'admin', label: 'Platform Admin', icon: ShieldCheck });
  }

  return (
    <aside className="hidden md:flex flex-col w-64 lg:w-72 bg-white border-r border-slate-200/90 h-screen sticky top-0 shrink-0 p-5 overflow-y-auto">
      {/* Brand Header */}
      <div className="flex items-center gap-3 pb-6 border-b border-slate-100">
        <div className="w-10 h-10 rounded-2xl bg-gradient-to-tr from-purple-700 to-violet-500 flex items-center justify-center text-white shadow-md shadow-purple-600/20 font-black text-lg">
          EC
        </div>
        <div className="flex flex-col min-w-0">
          <span className="text-base font-bold text-slate-900 tracking-tight">ExamCraft</span>
          <span className="text-xs text-slate-500 font-medium truncate">
            {school?.name || 'WAEC Paper Engine'}
          </span>
        </div>
      </div>

      {/* Demo Role Switcher (Convenient for evaluators & teachers) */}
      <div className="mt-4 p-2.5 rounded-xl bg-slate-50 border border-slate-200/60 text-xs">
        <span className="block text-[11px] font-bold text-slate-500 mb-1.5 uppercase tracking-wider">
          Active Role: {role.replace('_', ' ')}
        </span>
        <div className="grid grid-cols-3 gap-1">
          <button
            onClick={() => switchDemoUser('admin')}
            className={`py-1 px-1.5 rounded-md font-medium text-center transition-colors ${
              role === 'school_admin'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/70'
            }`}
          >
            Admin
          </button>
          <button
            onClick={() => switchDemoUser('teacher')}
            className={`py-1 px-1.5 rounded-md font-medium text-center transition-colors ${
              role === 'teacher'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/70'
            }`}
          >
            Teacher
          </button>
          <button
            onClick={() => switchDemoUser('platform')}
            className={`py-1 px-1.5 rounded-md font-medium text-center transition-colors ${
              role === 'platform_admin'
                ? 'bg-purple-700 text-white shadow-xs'
                : 'bg-white text-slate-600 hover:text-slate-900 border border-slate-200/70'
            }`}
          >
            Platform
          </button>
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
                    ? 'bg-purple-700 text-white shadow-md shadow-purple-700/25'
                    : 'bg-purple-50 text-purple-700 hover:bg-purple-100'
                }`}
              >
                <Icon className="w-5 h-5 shrink-0" />
                <span className="truncate">{item.label}</span>
                <span className="ml-auto text-[10px] bg-white/20 text-current px-1.5 py-0.5 rounded-md font-bold">
                  AI + Manual
                </span>
              </button>
            );
          }

          return (
            <button
              key={item.id}
              onClick={() => navigate(item.id)}
              className={`w-full flex items-center gap-3 px-3.5 py-2.5 rounded-xl text-sm font-medium transition-colors ${
                isActive
                  ? 'bg-slate-100 text-purple-900 font-semibold'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
              }`}
            >
              <Icon className="w-5 h-5 shrink-0 text-slate-400 group-hover:text-purple-600" />
              <span className="truncate">{item.label}</span>
            </button>
          );
        })}
      </nav>

      {/* Subscription Card */}
      {school && (
        <div className="mt-auto pt-4 border-t border-slate-100">
          <div className="p-3.5 rounded-2xl bg-gradient-to-br from-purple-50 via-violet-50/50 to-slate-50 border border-purple-100 text-left">
            <div className="flex items-center justify-between text-xs font-bold text-purple-900 mb-1">
              <span>Subscription</span>
              <span className="capitalize px-2 py-0.5 rounded-full bg-purple-200/60 text-purple-800 text-[10px]">
                {school.subscription_status}
              </span>
            </div>
            <p className="text-xs text-slate-600 mt-1">
              {school.subscription_status === 'active' ? (
                'Unlimited AI & Manual exams for this term.'
              ) : (
                <>
                  <span className="font-semibold text-purple-900">
                    {Math.max(0, school.max_trial_ai_exams - school.ai_exams_used)}
                  </span>{' '}
                  AI &{' '}
                  <span className="font-semibold text-purple-900">
                    {Math.max(0, school.max_trial_manual_exams - school.manual_exams_used)}
                  </span>{' '}
                  manual trial exams remaining.
                </>
              )}
            </p>
            {school.subscription_status !== 'active' && (
              <button
                onClick={onOpenPaystack}
                className="mt-3 w-full py-2 px-3 rounded-xl bg-purple-700 hover:bg-purple-800 text-white text-xs font-semibold shadow-sm transition-all"
              >
                Upgrade (₦11,000/Term)
              </button>
            )}
          </div>
        </div>
      )}
    </aside>
  );
};
