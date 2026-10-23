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
  Share2
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
  const { school } = useAuth();
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
    <div className="max-w-xl mx-auto py-8 px-4 text-center space-y-6">
      {/* Celebration Icon */}
      <div className="w-16 h-16 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto shadow-md shadow-emerald-600/10 animate-in zoom-in-75 duration-200">
        <CheckCircle2 className="w-10 h-10" />
      </div>

      <div className="space-y-1">
        <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-3 py-1 rounded-full border border-emerald-200">
          Official WAEC/JAMB Paper Ready
        </span>
        <h2 className="text-2xl font-extrabold text-slate-900 tracking-tight mt-2">
          Exam Successfully Published!
        </h2>
        <p className="text-xs text-slate-500">
          Your examination paper has been formatted, scored, and archived under{' '}
          <strong className="text-purple-700">{school?.name}</strong>.
        </p>
      </div>

      {/* Exam Summary Details Card */}
      <div className="bg-white rounded-3xl p-5 border border-slate-200/90 shadow-sm text-left space-y-3 font-sans">
        <div className="flex items-center justify-between pb-3 border-b border-slate-100">
          <div>
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Exam Code</span>
            <div className="font-mono text-sm font-bold text-slate-900">{exam.exam_code}</div>
          </div>
          <div className="text-right">
            <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Session & Term</span>
            <div className="text-xs font-bold text-purple-700">{exam.term} · {exam.session}</div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-2 text-xs py-1">
          <div>
            <span className="text-slate-500 block text-[11px]">Subject</span>
            <strong className="text-slate-900">{exam.subject}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Class</span>
            <strong className="text-slate-900">{exam.class_name}</strong>
          </div>
          <div>
            <span className="text-slate-500 block text-[11px]">Questions</span>
            <strong className="text-slate-900">{exam.questions?.length || 0} Total</strong>
          </div>
        </div>
      </div>

      {/* Primary Action Buttons */}
      <div className="space-y-2.5">
        <button
          onClick={handleDownloadPaper}
          disabled={downloadingDocx}
          className="w-full py-3.5 px-4 rounded-2xl bg-purple-700 hover:bg-purple-800 disabled:opacity-75 text-white font-bold text-xs flex items-center justify-center gap-2 shadow-md shadow-purple-700/25 active:scale-[0.99] transition-all"
        >
          <Download className="w-4 h-4" />
          <span>{downloadingDocx ? 'Exporting DOCX...' : 'Download Official Exam DOCX (12pt Times New Roman)'}</span>
        </button>

        <button
          onClick={handleDownloadScheme}
          disabled={downloadingScheme}
          className="w-full py-3 px-4 rounded-2xl bg-slate-900 hover:bg-slate-800 disabled:opacity-75 text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-xs transition-all"
        >
          <ShieldCheck className="w-4 h-4 text-emerald-400" />
          <span>{downloadingScheme ? 'Exporting...' : 'Download Confidential Marking Scheme (DOCX)'}</span>
        </button>

        <div className="grid grid-cols-2 gap-2 pt-2">
          <button
            onClick={() => onPreview(exam)}
            className="py-2.5 px-3 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <Eye className="w-4 h-4" />
            <span>View Full Paper</span>
          </button>
          <button
            onClick={() => navigate('create-exam')}
            className="py-2.5 px-3 rounded-xl border border-purple-200 text-purple-700 bg-purple-50/50 hover:bg-purple-100 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
          >
            <PlusCircle className="w-4 h-4" />
            <span>Create Another</span>
          </button>
        </div>
      </div>

      <div>
        <button
          onClick={() => navigate('dashboard')}
          className="text-xs text-slate-500 hover:text-slate-800 font-medium"
        >
          ← Return to Dashboard
        </button>
      </div>
    </div>
  );
};
