import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Exam, School } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import { CheckCircle2, Download, ShieldCheck } from 'lucide-react';

interface ExamSuccessPageProps {
  exam: Exam;
  navigate: (route: string) => void;
  onPreview: (exam: Exam) => void;
  schoolOverride?: School;
}

export const ExamSuccessPage: React.FC<ExamSuccessPageProps> = ({
  exam,
  navigate,
  onPreview,
  schoolOverride,
}) => {
  const { school: authenticatedSchool, role } = useAuth();
  const school = schoolOverride || authenticatedSchool;
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
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-950/45 backdrop-blur-sm px-4 py-5">
      <section role="dialog" aria-modal="true" aria-labelledby="exam-created-title" className="w-full max-w-md rounded-3xl bg-white p-5 sm:p-6 shadow-2xl border border-white/70 animate-in fade-in zoom-in-95">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700">
          <CheckCircle2 className="h-7 w-7" />
        </div>
        <p className="text-center text-[11px] font-bold uppercase tracking-wider text-emerald-700">Successful</p>
        <h2 id="exam-created-title" className="mt-1 text-center text-xl font-extrabold tracking-tight text-slate-900">Exam created successfully</h2>
        <p className="mt-2 text-center text-sm leading-relaxed text-slate-600">
          {exam.subject} · {exam.class_name}<br />
          <span className="text-xs text-slate-500">{school?.name || 'Your school'} · {exam.term} · {exam.session}</span>
        </p>
        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3 text-center">
          <p className="text-xs font-semibold text-slate-800">Your exam paper and marking scheme have been sent to download.</p>
          <p className="mt-1 text-[11px] text-slate-500">If a download was blocked, you can download either file again below.</p>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <button onClick={handleDownloadPaper} disabled={downloadingDocx} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <Download className="h-3.5 w-3.5" /> {downloadingDocx ? 'Downloading…' : 'Exam paper'}
          </button>
          <button onClick={handleDownloadScheme} disabled={downloadingScheme} className="flex items-center justify-center gap-1.5 rounded-xl border border-slate-200 px-3 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60">
            <ShieldCheck className="h-3.5 w-3.5 text-emerald-600" /> {downloadingScheme ? 'Downloading…' : 'Marking scheme'}
          </button>
        </div>
        <div className="mt-4 grid grid-cols-2 gap-2">
          <button onClick={() => navigate('create-exam')} className="rounded-xl bg-blue-600 px-4 py-3 text-sm font-bold text-white shadow-sm hover:bg-blue-700">
            Continue creating
          </button>
          <button onClick={() => navigate(role === 'teacher' ? 'teacher-finished' : 'dashboard')} className="rounded-xl border border-slate-200 px-4 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50">
            Cancel
          </button>
        </div>
      </section>
    </div>
  );
};
