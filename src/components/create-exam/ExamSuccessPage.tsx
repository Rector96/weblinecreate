import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Exam, School } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import { CheckCircle2, Download, ShieldCheck, ArrowLeft, BookOpen, FileCheck2 } from 'lucide-react';

interface ExamSuccessPageProps {
  exam: Exam;
  navigate: (route: string) => void;
  onPreview: (exam: Exam) => void;
  schoolOverride?: School;
}

export const ExamSuccessPage: React.FC<ExamSuccessPageProps> = ({ exam, navigate, onPreview, schoolOverride }) => {
  const { school: authenticatedSchool, role } = useAuth();
  const school = schoolOverride || authenticatedSchool;
  const [downloadingDocx, setDownloadingDocx] = useState(false);
  const [downloadingScheme, setDownloadingScheme] = useState(false);
  const [downloadError, setDownloadError] = useState<string | null>(null);

  const handleDownloadPaper = async () => {
    setDownloadingDocx(true);
    setDownloadError(null);
    try {
      await exportExamToDocx(exam, school);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not download the exam paper. Please try again.');
    } finally {
      setDownloadingDocx(false);
    }
  };

  const handleDownloadScheme = async () => {
    setDownloadingScheme(true);
    setDownloadError(null);
    try {
      await exportMarkingSchemeToDocx(exam, school);
    } catch (error) {
      setDownloadError(error instanceof Error ? error.message : 'Could not download the marking scheme. Please try again.');
    } finally {
      setDownloadingScheme(false);
    }
  };

  return (
    <main className="animate-in fade-in duration-500 min-h-[100dvh] bg-slate-50 px-3 py-4 pb-[max(1rem,env(safe-area-inset-bottom))] sm:px-6 sm:py-8">
      <div className="mx-auto flex min-h-[calc(100dvh-2rem)] w-full max-w-3xl flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl shadow-slate-900/5">
        <header className="bg-gradient-to-br from-emerald-50 via-white to-blue-50 px-5 py-8 text-center sm:px-10 sm:py-10">
          <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-100 text-emerald-700 ring-8 ring-emerald-50">
            <CheckCircle2 className="h-9 w-9" />
          </div>
          <p className="mt-6 text-xs font-extrabold uppercase tracking-[0.18em] text-emerald-700">Published successfully</p>
          <h1 className="mt-2 text-2xl font-black tracking-tight text-slate-950 sm:text-3xl">Your exam is ready</h1>
          <p className="mx-auto mt-2 max-w-lg text-sm leading-6 text-slate-600">Your exam has been saved. Download the exam paper and marking scheme below, or start preparing another subject.</p>
        </header>

        <section className="flex-1 px-4 py-5 sm:px-8 sm:py-7">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4 sm:p-5">
            <div className="flex items-start gap-3">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700">
                <BookOpen className="h-5 w-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="break-words text-lg font-extrabold text-slate-900">{exam.subject} <span className="font-semibold text-slate-500">· {exam.class_name}</span></p>
                <p className="mt-1 text-sm text-slate-600">{school?.name || 'Your school'}</p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-slate-600">
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{exam.term}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{exam.session}</span>
                  <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5">{exam.total_marks} marks</span>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-1 gap-3 sm:grid-cols-2">
            <button type="button" onClick={handleDownloadPaper} disabled={downloadingDocx} className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-blue-300 hover:bg-blue-50/50 active:scale-[0.99] disabled:opacity-60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-blue-100 text-blue-700"><Download className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{downloadingDocx ? 'Preparing download…' : 'Download exam paper'}</span><span className="mt-0.5 block text-xs text-slate-500">Editable Word document (.docx)</span></span>
            </button>
            <button type="button" onClick={handleDownloadScheme} disabled={downloadingScheme} className="flex min-h-14 items-center gap-3 rounded-2xl border border-slate-200 bg-white p-4 text-left transition hover:border-emerald-300 hover:bg-emerald-50/50 active:scale-[0.99] disabled:opacity-60">
              <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-emerald-100 text-emerald-700"><ShieldCheck className="h-5 w-5" /></span>
              <span className="min-w-0 flex-1"><span className="block text-sm font-bold text-slate-900">{downloadingScheme ? 'Preparing download…' : 'Download marking scheme'}</span><span className="mt-0.5 block text-xs text-slate-500">Answers and scoring guide (.docx)</span></span>
            </button>
          </div>
          {downloadError && <p role="alert" className="mt-3 rounded-xl border border-rose-200 bg-rose-50 p-3 text-sm text-rose-700">{downloadError}</p>}
          <div className="mt-5 flex items-start gap-2 rounded-xl border border-blue-100 bg-blue-50 p-3 text-xs leading-5 text-blue-900">
            <FileCheck2 className="mt-0.5 h-4 w-4 shrink-0" />
            <p>Keep a copy of both files before sharing the exam with students. If your phone blocks a download, tap the relevant download option again.</p>
          </div>
        </section>

        <footer className="sticky bottom-0 mt-auto border-t border-slate-200 bg-white/95 p-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur sm:px-8 sm:py-4">
          <div className="mx-auto grid w-full max-w-2xl grid-cols-1 gap-2 sm:grid-cols-2">
            <button type="button" onClick={() => onPreview(exam)} className="flex min-h-12 items-center justify-center gap-2 rounded-xl border border-slate-300 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 active:scale-[0.99]">
              <ArrowLeft className="h-4 w-4" /> View exam details
            </button>
            <button type="button" onClick={() => navigate('create-exam')} className="flex min-h-12 items-center justify-center gap-2 rounded-xl bg-blue-700 px-4 py-3 text-sm font-bold text-white shadow-md shadow-blue-700/20 transition hover:bg-blue-800 active:scale-[0.99]">
              <BookOpen className="h-4 w-4" /> Create another subject
            </button>
          </div>
          {role === 'teacher' && <p className="mt-2 text-center text-[11px] text-slate-500">You can create another subject exam from here.</p>}
        </footer>
      </div>
    </main>
  );
};
