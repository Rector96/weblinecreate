import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Exam } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import {
  X,
  Download,
  Printer,
  ShieldCheck,
  FileText,
  Lock,
  Clock,
  Sparkles
} from 'lucide-react';

interface ExamPreviewModalProps {
  exam: Exam | null;
  onClose: () => void;
}

export const ExamPreviewModal: React.FC<ExamPreviewModalProps> = ({ exam, onClose }) => {
  const { school } = useAuth();
  const [activeTab, setActiveTab] = useState<'paper' | 'scheme'>('paper');

  if (!exam) return null;

  const sectionAQuestions = (exam.questions || []).filter((q) => q.section === 'A');
  const sectionBQuestions = (exam.questions || []).filter((q) => q.section === 'B');

  const handlePrint = () => {
    window.print();
  };

  return (
    <div className="exam-preview-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className="w-full max-w-4xl max-h-[95vh] bg-slate-100 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left border border-slate-300">
        {/* Top Control Toolbar */}
        <div className="exam-preview-toolbar bg-white px-5 py-3.5 border-b border-slate-200 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={() => setActiveTab('paper')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all ${
                activeTab === 'paper'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Question Paper
            </button>
            <button
              onClick={() => setActiveTab('scheme')}
              className={`px-3.5 py-1.5 rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 ${
                activeTab === 'scheme'
                  ? 'bg-slate-900 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              <Lock className="w-3 h-3" />
              <span>Marking Scheme</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={handlePrint}
              className="p-2 text-slate-600 hover:bg-slate-100 rounded-xl"
              title="Print Examination Paper"
            >
              <Printer className="w-4 h-4" />
            </button>

            <button
              onClick={() =>
                activeTab === 'paper'
                  ? exportExamToDocx(exam, school)
                  : exportMarkingSchemeToDocx(exam, school)
              }
              className="px-3 py-1.5 rounded-xl bg-blue-50 hover:bg-blue-100 text-blue-800 text-xs font-semibold flex items-center gap-1.5 transition-colors"
            >
              <Download className="w-3.5 h-3.5 text-blue-600" />
              <span>Export DOCX</span>
            </button>

            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-slate-700 hover:bg-slate-100 rounded-xl"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Paper Container (Scrollable) */}
        <div className="exam-preview-scroll flex-1 overflow-y-auto p-4 sm:p-8">
          <div className="exam-paper-print bg-white max-w-3xl mx-auto p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 font-serif text-slate-900 leading-relaxed text-left">
            {activeTab === 'paper' ? (
              <div className="space-y-6">
                {/* Official Header */}
                <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
                  <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">
                    {school?.name || "KING'S COLLEGE LAGOS"}
                  </h1>
                  {school?.motto && (
                    <p className="text-xs italic text-slate-600">"{school.motto}"</p>
                  )}
                  <p className="text-xs text-slate-600">
                    {school?.address || `${school?.lga || 'Lagos Island'}, ${school?.state || 'Lagos'} State`}
                  </p>
                  <h2 className="text-sm sm:text-base font-bold uppercase underline mt-3">
                    {exam.term.toUpperCase()} EXAMINATION — {exam.session} ACADEMIC SESSION
                  </h2>

                  <div className="grid grid-cols-2 text-xs font-bold pt-3 text-left">
                    <div>
                      <p>CLASS: <span className="font-normal">{exam.class_name}</span></p>
                      <p>SUBJECT: <span className="font-normal uppercase">{exam.subject}</span></p>
                    </div>
                    <div className="text-right">
                      <p>TIME ALLOWED: <span className="font-normal">{exam.duration_minutes} MINUTES</span></p>
                      <p>TOTAL MARKS: <span className="font-normal">{exam.total_marks} MARKS</span></p>
                    </div>
                  </div>

                  <div className="text-xs italic text-left pt-2 text-slate-700">
                    <strong>GENERAL INSTRUCTIONS:</strong> {exam.instructions}
                  </div>
                </div>

                {/* Section A: Objectives */}
                {sectionAQuestions.length > 0 && (
                  <div className="space-y-4">
                    <div className="text-center">
                      <h3 className="text-sm font-bold uppercase underline">
                        SECTION A: OBJECTIVE QUESTIONS [{sectionAQuestions.length} MARKS]
                      </h3>
                      <p className="text-xs italic text-slate-600">
                        Choose the correct option lettered A to D for each question.
                      </p>
                    </div>

                    <div className="exam-objective-list space-y-2 text-xs">
                      {sectionAQuestions.map((q, idx) => (
                        <div key={q.id} className="space-y-1">
                          <p className="font-medium">
                            <strong className="font-bold">{idx + 1}.</strong> {q.question_text}
                          </p>
                          {q.objective_data && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 text-slate-800">
                              <span>[A] {q.objective_data.option_a}</span>
                              <span>[B] {q.objective_data.option_b}</span>
                              <span>[C] {q.objective_data.option_c}</span>
                              <span>[D] {q.objective_data.option_d}</span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section B: Theory */}
                {sectionBQuestions.length > 0 && (
                  <div className="exam-theory-section space-y-3 pt-3 border-t border-slate-300">
                    <div className="text-center">
                      <h3 className="text-sm font-bold uppercase underline">
                        SECTION B: ESSAY / THEORY
                      </h3>
                      <p className="text-xs italic text-slate-600">
                        Answer questions in this section in your booklet. Show all steps clearly.
                      </p>
                    </div>

                    <div className="space-y-2 text-xs">
                      {sectionBQuestions.map((q, idx) => (
                        <div key={q.id} className="space-y-1">
                          <div className="flex items-start justify-between gap-2">
                            <p className="whitespace-pre-line">
                              <strong className="font-bold">{idx + 1}.</strong> {q.question_text}
                            </p>
                            <span className="font-bold italic text-slate-700 shrink-0">
                              [{q.marks} Marks]
                            </span>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
                {/* Confidential Marking Scheme Header */}
                <div className="text-center space-y-1 pb-4 border-b-2 border-rose-800 text-rose-900">
                  <span className="text-xs font-bold uppercase tracking-widest bg-rose-50 text-rose-700 px-3 py-1 rounded-full border border-rose-200">
                    Strictly Confidential · Teachers Only
                  </span>
                  <h1 className="text-xl sm:text-2xl font-bold uppercase mt-2">
                    {school?.name || "KING'S COLLEGE LAGOS"}
                  </h1>
                  <h2 className="text-sm sm:text-base font-bold uppercase underline text-slate-900">
                    OFFICIAL MARKING SCHEME & SCORING RUBRIC
                  </h2>
                  <p className="text-xs font-medium text-slate-600">
                    {exam.subject} · {exam.class_name} · {exam.term} ({exam.session})
                  </p>
                </div>

                {/* Section A Key */}
                {sectionAQuestions.length > 0 && (
                  <div className="space-y-3 font-sans">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Section A: Objective Key
                    </h3>
                    <div className="grid grid-cols-5 sm:grid-cols-10 gap-2 text-center text-xs">
                      {sectionAQuestions.map((q, idx) => (
                        <div key={q.id} className="p-2 rounded-xl bg-slate-50 border border-slate-200">
                          <span className="block text-[10px] text-slate-500 font-bold">Q{idx + 1}</span>
                          <span className="font-bold text-emerald-700 font-mono text-sm">
                            {q.objective_data?.correct_option || '-'}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Section B Detailed Rubrics */}
                {sectionBQuestions.length > 0 && (
                  <div className="space-y-5 pt-4 border-t border-slate-200 font-sans">
                    <h3 className="text-xs font-bold text-slate-900 uppercase tracking-wider">
                      Section B: Theory Model Answers & Rubrics
                    </h3>

                    {sectionBQuestions.map((q, idx) => (
                      <div key={q.id} className="p-4 rounded-2xl bg-slate-50 border border-slate-200 space-y-2 text-xs">
                        <div className="flex items-center justify-between font-bold text-slate-900">
                          <span>Question {idx + 1}</span>
                          <span className="text-blue-600">{q.marks} Marks Total</span>
                        </div>
                        <p className="text-slate-700 italic font-serif">{q.question_text}</p>
                        {q.theory_data?.model_answer && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                            <span className="font-bold text-blue-900 block mb-0.5">Model Solution:</span>
                            <p className="text-slate-800 whitespace-pre-line">{q.theory_data.model_answer}</p>
                          </div>
                        )}
                        {q.theory_data?.score_breakdown && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900">
                            <span className="font-bold block mb-0.5">Scoring Breakdown:</span>
                            <p>{q.theory_data.score_breakdown}</p>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
