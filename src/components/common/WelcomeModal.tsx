import React, { useState, useEffect } from 'react';
import { useAuth } from '../../lib/auth';
import { Sparkles, CheckCircle2, ArrowRight, BookOpen, Users, FileCheck } from 'lucide-react';

interface WelcomeModalProps {
  onStartExam: () => void;
}

const WELCOME_SEEN_KEY = 'examcraft_welcome_dismissed';

export const WelcomeModal: React.FC<WelcomeModalProps> = ({ onStartExam }) => {
  const { school, user } = useAuth();
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const hasSeen = localStorage.getItem(WELCOME_SEEN_KEY);
    if (!hasSeen) {
      setIsOpen(true);
    }
  }, []);

  const handleClose = () => {
    localStorage.setItem(WELCOME_SEEN_KEY, 'true');
    setIsOpen(false);
  };

  const handleCreateNow = () => {
    handleClose();
    onStartExam();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-4 animate-in fade-in">
      <div className="w-full max-w-md bg-white rounded-3xl p-6 shadow-2xl border border-slate-100 text-left">
        <div className="w-12 h-12 rounded-2xl bg-gradient-to-tr from-purple-700 to-violet-500 text-white flex items-center justify-center mb-4 shadow-md shadow-purple-600/30">
          <Sparkles className="w-6 h-6" />
        </div>

        <h3 className="text-xl font-extrabold text-slate-900 tracking-tight">
          Welcome to ExamCraft
        </h3>
        <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
          The all-in-one WAEC & JAMB exam authoring platform built specifically for Nigerian secondary schools.
        </p>

        <div className="my-5 space-y-3">
          <div className="flex items-start gap-3 p-3 rounded-2xl bg-purple-50/60 border border-purple-100/80">
            <div className="p-2 rounded-xl bg-purple-100 text-purple-700 mt-0.5">
              <FileCheck className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Standard WAEC & JAMB Formatting</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Exact 12pt Times New Roman, official headers, Section A Objective grid, Section B Essay rubrics.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="p-2 rounded-xl bg-slate-200 text-slate-700 mt-0.5">
              <Sparkles className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">AI Exam Generator</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Select your class and subject. AI drafts questions, options, and confidential marking schemes instantly.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3 p-3 rounded-2xl bg-slate-50 border border-slate-200/70">
            <div className="p-2 rounded-xl bg-slate-200 text-slate-700 mt-0.5">
              <Users className="w-4 h-4" />
            </div>
            <div>
              <h4 className="text-xs font-bold text-slate-900">Teacher Collaboration</h4>
              <p className="text-[11px] text-slate-600 mt-0.5">
                Share a 6-character code with your subject teachers to author exams simultaneously under your school.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col gap-2 mt-6">
          <button
            onClick={handleCreateNow}
            className="w-full py-3 rounded-2xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm transition-all"
          >
            <span>Create Your First Exam</span>
            <ArrowRight className="w-4 h-4" />
          </button>
          <button
            onClick={handleClose}
            className="w-full py-2.5 rounded-2xl text-slate-500 hover:text-slate-800 text-xs font-medium transition-colors"
          >
            Explore Dashboard First
          </button>
        </div>
      </div>
    </div>
  );
};
