import React from 'react';
import { LayoutDashboard, FileText, Plus, BookOpen, School as SchoolIcon } from 'lucide-react';

interface BottomNavProps {
  currentRoute: string;
  navigate: (route: string) => void;
}

export const BottomNav: React.FC<BottomNavProps> = ({ currentRoute, navigate }) => {
  return (
    <nav className="md:hidden fixed bottom-3 left-4 right-4 z-40">
      <div className="bg-white/95 backdrop-blur-xl border border-slate-200/90 shadow-lg shadow-blue-950/5 rounded-2xl px-2 py-1.5 flex items-center justify-around">
        {/* 1. Dashboard */}
        <button
          onClick={() => navigate('dashboard')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 rounded-xl transition-all ${
            currentRoute === 'dashboard'
              ? 'text-blue-600 font-bold'
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
              ? 'text-blue-600 font-bold'
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
          <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-blue-700 to-blue-500 text-white flex items-center justify-center shadow-md shadow-blue-600/30 group-active:scale-95 transition-transform duration-150">
            <Plus className="w-6 h-6 stroke-[2.5]" />
          </div>
          <span className="text-[10px] font-bold text-blue-600 tracking-tight mt-1">Create</span>
        </button>

        {/* 4. Classes */}
        <button
          onClick={() => navigate('classes')}
          className={`flex flex-col items-center justify-center min-w-[52px] min-h-[48px] py-1 rounded-xl transition-all ${
            currentRoute === 'classes'
              ? 'text-blue-600 font-bold'
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
              ? 'text-blue-600 font-bold'
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
