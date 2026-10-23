import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Exam } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import {
  CheckCircle2,
  Download,
  Eye,
  PlusCircle,
  FileText,
  ShieldCheck,
  ArrowRight,
  School as SchoolIcon,
  BookOpen
} from 'lucide-react';

interface ExamSuccessPageProps {
  exam: Exam;
  navigate: (route: string) => void;
  onPreview: (exam: Exam) => void;
}

export const ExamSuccessPage: React.FC<ExamSuccessPageProps> = ({
  exam,
  navigate,
  onPreview,
}) => {
  const { school, user } = useAuth();
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingScheme, setDownloadingScheme] = useState(false);

  const handleDownloadPaper = async () => {
    setDownloadingDocx(true);
    try {
      await exportExamToDocx(exam, school);
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleDownloadScheme = async () => {
    setDownloadingScheme(true);
    try {
      await exportMarkingSchemeToDocx(exam, school);
    } finally {
      setDownloadingScheme(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto py-8 px-4 text-center space-y-6 animate-in fade-in">
      {/* Celebration Icon */}
      <div className="w-16 h-16 rounded-3xl bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-1">
        <div className="inline-flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          <CheckCircle2 className="w-3.5 h-3.5" />
          <span>DOCX Paper & Marking Scheme Auto-Downloaded</span>
        </div>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
          Exam Published & Synced to School Dashboard
        </h2>
        <p className="text-xs text-slate-500 max-w-md mx-auto">
          Your examination paper has been filed for <strong className="text-blue-600">{school?.name}</strong> under{' '}
          <strong className="text-slate-800">{exam.class_name}</strong>. The principal and subject teachers can view it on the school dashboard.
        </p>
      </div>

      {/* Summary Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm text-left space-y-3 font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Exam Code</span>
            <div className="font-mono text-sm font-bold text-slate-900">{exam.exam_code}</div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Session & Term</span>
            <div className="text-xs font-bold text-blue-600">{exam.term} · {exam.session}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs py-1">
          <div>
            <span className="text-slate-500 block text-[11px]">Subject</span>
            <strong className="text-slate-900">{exam.subject}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Assigned Class</span>
            <strong className="text-slate-900">{exam.class_name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Total Questions</span>
            <strong className="text-slate-900">{exam.questions?.length || 0} Questions</strong>
          </div>
        </div>
      </div>

      {/* Primary Actions */}
      <div className="space-y-2.5">
        <button
          onClick={() => navigate('create-exam')}
          className="w-full py-3.5 px-4 rounded-2xl bg-blue-600 hover:bg-blue-800 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-blue-600/25 active:scale-[0.99] transition-all"
        >
          <PlusCircle className="w-4 h-4" />
          <span>Generate Another Exam for this School</span>
        </button>

        <div className="grid grid-cols-2 gap-2">
          <button
            onClick={handleDownloadPaper}
            disabled={downloadingDocx}
            className="py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            <span>Re-download Paper</span>
          </button>

          <button
            onClick={handleDownloadScheme}
            disabled={downloadingScheme}
            className="py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
            <span>Marking Scheme</span>
          </button>
        </div>

        <div className="pt-2">
          <button
            onClick={() => onPreview(exam)}
            className="text-xs font-semibold text-blue-600 hover:underline inline-flex items-center gap-1"
          >
            <Eye className="w-3.5 h-3.5" />
            <span>View Live Paper Preview</span>
          </button>
        </div>
      </div>

      <div>
        <button
          onClick={() => navigate('dashboard')}
          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
        >
          ← Return to School Dashboard
        </button>
      </div>
    </div>
  );
};
