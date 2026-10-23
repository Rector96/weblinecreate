import React from 'react';
import { LayoutDashboard, FileText, Plus, BookOpen, School as SchoolIcon } from 'lucide-react';

interface BottomNavProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentRoute, navigate }) => {
  return (
    <nav className="mobile-bottom-nav md:hidden fixed bottom-0 left-0 right-0 z-40 px-3 pb-safe pt-2">
      <div className="bg-white/90 backdrop-blur-2xl border border-slate-200/80 shadow-[0_-6px_30px_rgba(15,23,42,0.06)] rounded-[1.4rem] px-1.5 py-1.5 flex items-center justify-around max-w-xl mx-auto">
        {/* 1. Dashboard */}
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] px-2 py-1 rounded-xl transition-all duration-200 ${
            currentRoute === 'dashboard'
              ? 'bg-blue-50 text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <LayoutDashboard className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Home</span>
        </button>

        {/* 2. Exams */}
        <button
          onClick={() => navigate('exams')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 rounded-xl transition-all ${
            currentRoute === 'exams'
              ? 'bg-blue-50 text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <FileText className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Exams</span>
        </button>

        {/* 3. Center Prominent Action: Create Exam */}
        <button
          onClick={() => navigate('create-exam')}
          className="flex flex-col items-center justify-center -mt-5 min-w-[52px] group"
        >
          <div className={`w-12 h-12 rounded-2xl text-white flex items-center justify-center shadow-md transition-transform duration-150 group-active:scale-95 ${currentRoute === 'create-exam' ? 'bg-slate-900 shadow-slate-900/20' : 'bg-gradient-to-tr from-blue-700 to-blue-500 shadow-blue-600/30'}`}>
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className={`text-[10px] font-bold tracking-tight mt-1 ${currentRoute === 'create-exam' ? 'text-slate-900' : 'text-blue-600'}`}>Create</span>
        </button>

        {/* 4. Classes */}
        <button
          onClick={() => navigate('classes')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 rounded-xl transition-all ${
            currentRoute === 'classes'
              ? 'bg-blue-50 text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <BookOpen className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">Classes</span>
        </button>

        {/* 5. Profile */}
        <button
          onClick={() => navigate('profile')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 rounded-xl transition-all ${
            currentRoute === 'profile'
              ? 'bg-blue-50 text-blue-700 font-bold'
              : 'text-slate-500 hover:text-slate-800'
          }`}
        >
          <SchoolIcon className="w-5 h-5" />
          <span className="text-[10px] font-medium tracking-tight mt-0.5">School</span>
        </button>
      </div>
    </nav>
  );
};
