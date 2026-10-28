import React, { useState } from 'react';
import { useAuth } from '../../lib/auth';
import { Exam } from '../../types';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import { FormattedExamText } from '../common/FormattedExamText';
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
  const estimatedObjectiveLength = sectionAQuestions.reduce((total, q) => {
    const options = q.objective_data
      ? [q.objective_data.option_a, q.objective_data.option_b, q.objective_data.option_c, q.objective_data.option_d].join(' ')
      : '';
    return total + (q.question_text || '').length + options.length + 35;
  }, 0);
  const shouldStartTheoryOnNewPage =
    sectionBQuestions.length > 0 &&
    sectionAQuestions.length >= 8 &&
    estimatedObjectiveLength < 1900;
  const useTwoObjectiveColumns = sectionAQuestions.length >= 20 && estimatedObjectiveLength / Math.max(sectionAQuestions.length, 1) < 180;

  const handlePrint = () => {
    const paper = document.querySelector<HTMLElement>('.exam-paper-print');
    if (!paper) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) {
      window.alert('Please allow pop-ups for this site, then choose Print / Save PDF again.');
      return;
    }

    const stylesheetLinks = Array.from(document.querySelectorAll<HTMLLinkElement>('link[rel="stylesheet"]'))
      .map((link) => link.href)
      .filter(Boolean)
      .map((href) => `<link rel="stylesheet" href="${href}">`)
      .join('');
    const inlineStyles = Array.from(document.querySelectorAll<HTMLStyleElement>('style'))
      .map((style) => style.outerHTML)
      .join('');
    const paperHtml = paper.outerHTML;

    printWindow.document.open();
    printWindow.document.write(`<!doctype html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${school?.name || 'School'} - ${exam.subject} Examination</title>
  ${stylesheetLinks}
  ${inlineStyles}
  <style>
    @page { size: A4 portrait; margin: 10mm 12mm 12mm; }
    html, body { margin:0!important; padding:0!important; width:100%!important; min-height:0!important; height:auto!important; background:#fff!important; }
    body { color:#111827!important; font-family:"Times New Roman",Georgia,serif!important; }
    .exam-paper-print { position:relative!important; display:block!important; width:100%!important; max-width:none!important; height:auto!important; min-height:0!important; margin:0!important; padding:0!important; overflow:visible!important; border:0!important; border-radius:0!important; box-shadow:none!important; background:#fff!important; color:#111827!important; font-size:9.5pt!important; line-height:1.25!important; }
    .exam-paper-print::before { content:attr(data-watermark); position:absolute!important; z-index:0!important; top:260px!important; left:0!important; width:100%!important; transform:rotate(-32deg)!important; transform-origin:center!important; text-align:center!important; font-family:Arial,sans-serif!important; font-size:38pt!important; font-weight:800!important; letter-spacing:.04em!important; line-height:1.1!important; color:rgba(30,58,95,.065)!important; pointer-events:none!important; }
    .exam-paper-print > * { position:relative; z-index:1; }
    .exam-paper-print .space-y-6 > :not([hidden]) ~ :not([hidden]) { margin-top:.65rem!important; }
    .exam-paper-print .space-y-3 > :not([hidden]) ~ :not([hidden]) { margin-top:.45rem!important; }
    .exam-paper-print .space-y-2 > :not([hidden]) ~ :not([hidden]) { margin-top:.3rem!important; }
    .exam-paper-print h1 { font-size:17pt!important; line-height:1.15!important; }
    .exam-paper-print h2 { font-size:11pt!important; line-height:1.2!important; }
    .exam-paper-print h3 { font-size:10pt!important; line-height:1.2!important; }
    .exam-paper-print img.school-logo { max-height:68px!important; width:auto!important; }
    .exam-paper-print .exam-diagram { display:block!important; margin:.35rem 0 .55rem 1.1rem!important; max-width:72%!important; max-height:2.6in!important; width:auto!important; height:auto!important; object-fit:contain!important; border:1px solid #e2e8f0!important; border-radius:4px!important; page-break-inside:avoid!important; break-inside:avoid!important; }
    .exam-paper-print .exam-diagram-caption { margin:0 0 .45rem 1.1rem!important; font-size:8.5pt!important; font-style:italic!important; color:#64748b!important; }
    .exam-theory-new-page { break-before:auto!important; page-break-before:auto!important; }
    .exam-objective-list > div, .exam-theory-section > div > div, .exam-paper-print table, .exam-paper-print .exam-diagram { break-inside:avoid!important; page-break-inside:avoid!important; }
    .exam-objective-list, .exam-theory-section { break-inside:auto!important; page-break-inside:auto!important; }
    h1,h2,h3 { break-after:avoid!important; page-break-after:avoid!important; }
    * { -webkit-print-color-adjust:exact!important; print-color-adjust:exact!important; }
  </style>
</head>
<body>
  <div class="exam-preview-overlay"><div class="exam-preview-dialog">${paperHtml}</div></div>
  <script>
    window.addEventListener('load', function () {
      setTimeout(function () { window.focus(); window.print(); }, 500);
    });
  </script>
</body>
</html>`);
    printWindow.document.close();
  };

  return (
    <div className="exam-preview-overlay fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-xs p-2 sm:p-4 animate-in fade-in">
      <div className="exam-preview-dialog w-full max-w-4xl max-h-[95vh] bg-slate-100 rounded-3xl shadow-2xl flex flex-col overflow-hidden text-left border border-slate-300">
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
              className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold flex items-center gap-1.5"
              title="Print or save the formatted examination as PDF"
            >
              <Printer className="w-3.5 h-3.5" />
              <span>Print / Save PDF</span>
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

        <div className="exam-preview-scroll flex-1 overflow-y-auto p-4 sm:p-8">
          <div data-watermark={school?.name || "SCHOOL NAME"} className="exam-paper-print bg-white max-w-3xl mx-auto p-6 sm:p-10 rounded-2xl shadow-sm border border-slate-200 font-serif text-slate-900 leading-relaxed text-left">
            {activeTab === 'paper' ? (
              <div className="space-y-6">
                <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
                  <div className="flex items-center justify-start gap-3 text-left">
                    {school?.logo_url && (
                      <img src={school.logo_url} alt={`${school.name || 'School'} logo`} className="school-logo h-16 w-16 shrink-0 object-contain" />
                    )}
                    <div className="min-w-0 flex-1">
                      <h1 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">{school?.name || 'SCHOOL NAME'}</h1>
                      {school?.motto && <p className="text-xs italic text-slate-600">"{school.motto}"</p>}
                      {(school?.address || school?.lga || school?.state) && <p className="text-xs text-slate-600">{school.address || [school.lga, school.state].filter(Boolean).join(', ')}</p>}
                      {(school?.phone || school?.email) && <p className="text-[11px] text-slate-600">{[school.phone, school.email].filter(Boolean).join('  •  ')}</p>}
                    </div>
                  </div>
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

                    <div className={`exam-objective-list space-y-2 text-xs ${useTwoObjectiveColumns ? "exam-objective-two-columns" : ""}`}>
                      {sectionAQuestions.map((q, idx) => (
                        <div key={q.id} className="space-y-1">
                          <p className="font-medium">
                            <strong className="font-bold">{idx + 1}.</strong> <FormattedExamText text={q.question_text} />
                          </p>
                          {q.image_url && (
                            <figure className="pl-3">
                              <img src={q.image_url} alt={`Diagram for objective ${idx + 1}`} className="exam-diagram max-h-56 max-w-[85%] rounded border border-slate-200 object-contain" />
                              <figcaption className="exam-diagram-caption text-[11px] italic text-slate-500">Diagram</figcaption>
                            </figure>
                          )}
                          {q.objective_data && (
                            <div className="flex flex-wrap gap-x-4 gap-y-1 pl-4 text-slate-800">
                              <span>[A] <FormattedExamText text={q.objective_data.option_a} /></span>
                              <span>[B] <FormattedExamText text={q.objective_data.option_b} /></span>
                              <span>[C] <FormattedExamText text={q.objective_data.option_c} /></span>
                              <span>[D] <FormattedExamText text={q.objective_data.option_d} /></span>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {sectionBQuestions.length > 0 && (
                  <div className={`exam-theory-section space-y-3 pt-3 border-t border-slate-300 ${shouldStartTheoryOnNewPage ? "exam-theory-new-page" : ""}`}>
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
                              <strong className="font-bold">{idx + 1}.</strong> <FormattedExamText text={q.question_text} />
                            </p>
                          </div>
                          {q.image_url && (
                            <figure className="pl-3">
                              <img src={q.image_url} alt={`Diagram for theory ${idx + 1}`} className="exam-diagram max-h-56 max-w-[85%] rounded border border-slate-200 object-contain" />
                              <figcaption className="exam-diagram-caption text-[11px] italic text-slate-500">Diagram</figcaption>
                            </figure>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <div className="space-y-6">
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
                        <p className="text-slate-700 italic font-serif"><FormattedExamText text={q.question_text} /></p>
                        {q.theory_data?.model_answer && (
                          <div className="p-2.5 rounded-xl bg-white border border-slate-200/80">
                            <span className="font-bold text-blue-900 block mb-0.5">Model Solution:</span>
                            <p className="text-slate-800 whitespace-pre-line"><FormattedExamText text={q.theory_data.model_answer} /></p>
                          </div>
                        )}
                        {q.theory_data?.score_breakdown && (
                          <div className="p-2.5 rounded-xl bg-emerald-50 border border-emerald-200/80 text-emerald-900">
                            <span className="font-bold block mb-0.5">Scoring Breakdown:</span>
                            <p><FormattedExamText text={q.theory_data.score_breakdown} /></p>
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
