import React from 'react';
import { LayoutDashboard, FileText, Plus, BookOpen, School as SchoolIcon, ShieldCheck } from 'lucide-react';
import { useAuth } from '../../lib/auth';

interface BottomNavProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentRoute, navigate }) => {
  const { isPlatformAdmin } = useAuth();

  const itemClass = (route: string) =>
    `flex flex-col items-center justify-center min-w-[42px] min-h-[48px] px-1 py-1 rounded-xl transition-all ${currentRoute === route ? 'bg-blue-50 text-blue-700 font-bold' : 'text-slate-500 hover:text-slate-800'}`;

  return (
    <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 px-2 pb-safe pt-2">
      <div className="bg-white/90 backdrop-blur-2xl border border-slate-200/80 shadow-[0_-6px_30px_rgba(15,23,42,0.06)] rounded-[1.4rem] px-1 py-1.5 flex items-center justify-around max-w-xl mx-auto">
        <button onClick={() => navigate('dashboard')} className={itemClass('dashboard')}>
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Home</span>
        </button>
        <button onClick={() => navigate('exams')} className={itemClass('exams')}>
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Exams</span>
        </button>
        <button onClick={() => navigate('create-exam')} className="flex flex-col items-center justify-center -mt-4 min-w-[42px] group">
          <div className={`w-11 h-11 rounded-2xl text-white flex items-center justify-center shadow-md transition-transform group-active:scale-95 ${currentRoute === 'create-exam' ? 'bg-slate-900' : 'bg-gradient-to-tr from-blue-700 to-blue-500 shadow-blue-600/30'}`}>
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className={`text-[10px] font-bold tracking-tight mt-1 ${currentRoute === 'create-exam' ? 'text-slate-900' : 'text-blue-600'}`}>Create</span>
        </button>
        <button onClick={() => navigate('classes')} className={itemClass('classes')}>
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Classes</span>
        </button>
        <button onClick={() => navigate('profile')} className={itemClass('profile')}>
          <SchoolIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">School</span>
        </button>
        {isPlatformAdmin && (
          <button onClick={() => navigate('admin')} className={itemClass('admin')} aria-label="Platform Admin">
            <ShieldCheck className="w-5 h-5" />
            <span className="text-[10px] font-medium tracking-tight mt-0.5">Admin</span>
          </button>
        )}
      </div>
    </nav>
  );
};
