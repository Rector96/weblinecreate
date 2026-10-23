import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { saveExamToSupabase } from '../../lib/examRepository';
import {
  Exam,
  Question,
  ExamTerm,
  ObjectiveAnswer,
  TheoryMarkingScheme
} from '../../types';
import {
  ALL_NIGERIAN_SUBJECTS,
  STANDARD_NIGERIAN_CLASSES,
  EXAM_TERMS,
  ACADEMIC_SESSIONS,
  DEFAULT_WAEC_INSTRUCTIONS
} from '../../data/nigerianCurriculum';
import { ScientificSymbolPicker } from '../common/ScientificSymbolPicker';
import { VoiceInputButton } from '../common/VoiceInputButton';
import { exportExamToDocx, exportMarkingSchemeToDocx } from '../../utils/docxExport';
import {
  Sparkles,
  PenTool,
  ArrowRight,
  ArrowLeft,
  CheckCircle2,
  AlertCircle,
  Plus,
  Trash2,
  FileText,
  Clock,
  BookOpen,
  Loader2,
  Save,
  HelpCircle,
  RefreshCw,
  Download,
  Check,
  Edit3,
  CreditCard
} from 'lucide-react';

interface CreateExamWizardProps {
  navigate: (route: string, param?: string) => void;
  onOpenPaystack: () => void;
  onSuccessExam: (exam: Exam) => void;
}

export const CreateExamWizard: React.FC<CreateExamWizardProps> = ({
  navigate,
  onOpenPaystack,
  onSuccessExam,
}) => {
  const { school, user } = useAuth();

  // Wizard Step: 1 = Metadata, 2 = Method, 3 = Questions (Manual or AI prompt), 4 = Review & Edit
  const [currentStep, setCurrentStep] = useState<number>(1);
  const [method, setMethod] = useState<'ai' | 'manual'>('ai');

  // Step 1: Metadata
  const [title, setTitle] = useState('First Term Mock Examination');
  const [subject, setSubject] = useState('Mathematics');
  const [className, setClassName] = useState('SSS 3');
  const [term, setTerm] = useState<ExamTerm>('First Term');
  const [session, setSession] = useState('2025/2026');
  const [durationMinutes, setDurationMinutes] = useState(90);
  const [instructions, setInstructions] = useState(DEFAULT_WAEC_INSTRUCTIONS);
  const [totalMarks, setTotalMarks] = useState(100);

  // Step 3b: AI Generator Configuration
  const [aiTopics, setAiTopics] = useState('Logarithms, Quadratic Equations, Trigonometry & Mensuration');
  const [aiNumObj, setAiNumObj] = useState(10);
  const [aiNumTheory, setAiNumTheory] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<'Standard WAEC/JAMB' | 'Foundational / Basic' | 'Advanced / Rigorous'>('Standard WAEC/JAMB');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Dynamic regeneration and adding states
  const [regeneratingId, setRegeneratingId] = useState<string | null>(null);
  const [isAddingMore, setIsAddingMore] = useState<boolean>(false);
  const [notification, setNotification] = useState<string | null>(null);

  // Questions State
  const [questions, setQuestions] = useState<Question[]>([
    {
      id: 'q_init_1',
      section: 'A',
      question_number: 1,
      question_text: 'Simplify 3² × 3⁴ ÷ 3³.',
      marks: 1,
      objective_data: {
        option_a: '3',
        option_b: '9',
        option_c: '27',
        option_d: '81',
        correct_option: 'C',
      },
    },
    {
      id: 'q_init_theory_1',
      section: 'B',
      question_number: 1,
      question_text: '(a) Solve the simultaneous equations: 2x + 3y = 12 and x - y = 1.\n(b) If x represents the cost of an exercise book and y represents the cost of a pen, calculate the total cost of 5 exercise books and 2 pens.',
      marks: 15,
      theory_data: {
        model_answer: '(a) From eq 2: x = y + 1. Substituting in eq 1: 2(y + 1) + 3y = 12 => 5y + 2 = 12 => 5y = 10 => y = 2. Then x = 2 + 1 = 3. So x = 3, y = 2.\n(b) Total Cost = 5x + 2y = 5(3) + 2(2) = 15 + 4 = 19 (₦19.00).',
        score_breakdown: 'Substitution step: 3 mks; Correct value for y = 2: 3 mks; Correct value for x = 3: 3 mks; Cost equation: 2 mks; Final evaluation ₦19: 4 mks.',
        max_score: 15,
      },
    },
  ]);

  const [activeManualSection, setActiveManualSection] = useState<'A' | 'B'>('A');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [stepError, setStepError] = useState<string | null>(null);

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Step 1 Validation
  const handleStep1Next = () => {
    if (!title.trim() || !subject.trim() || !className.trim() || !instructions.trim()) {
      setStepError('All exam metadata fields are mandatory according to WAEC standards.');
      return;
    }
    setStepError(null);
    setCurrentStep(2);
  };

  // Step 2 Choice
  const handleSelectMethod = (selected: 'ai' | 'manual') => {
    if (selected === 'ai' && school && school.subscription_status !== 'active' && school.ai_exams_used >= 4) {
      setAiError('You have used all 4 free trial exams. On your 5th generation, please complete payment for full term access.');
      onOpenPaystack();
      return;
    }
    setMethod(selected);
    setCurrentStep(3);
  };

  // Step 3b AI Generation Handler
  const handleGenerateAI = async () => {
    if (!school) return;

    // Enforce 4 free trial limit: 5th attempt triggers Paystack payment popup immediately
    if (school.subscription_status !== 'active' && school.ai_exams_used >= 4) {
      setAiError(
        'Trial limit reached (4 of 4 free exams used). Please pay ₦11,000 for full term access to generate your 5th exam.'
      );
      setIsGeneratingAI(false);
      onOpenPaystack();
      return;
    }

    setIsGeneratingAI(true);
    setAiError(null);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          class_name: className,
          term,
          topics: aiTopics,
          num_objectives: aiNumObj,
          num_theories: aiNumTheory,
          difficulty: aiDifficulty,
          instructions,
        }),
      });

      const text = await response.text();
      let json: any = null;
      try {
        json = JSON.parse(text);
      } catch {
        throw new Error('Received invalid response from server. Check that your GEMINI_API_KEY is configured in Netlify environment variables.');
      }

      if (json && json.success && json.data) {
        const rawA = json.data.section_a || [];
        const rawB = json.data.section_b || [];

        const parsedQuestions: Question[] = [];

        // Objectives
        rawA.forEach((item: any, idx: number) => {
          parsedQuestions.push({
            id: `q_ai_obj_${Date.now()}_${idx}`,
            section: 'A',
            question_number: idx + 1,
            question_text: item.question_text || `Question ${idx + 1}`,
            marks: item.marks || 1,
            objective_data: {
              option_a: item.option_a || 'Option A',
              option_b: item.option_b || 'Option B',
              option_c: item.option_c || 'Option C',
              option_d: item.option_d || 'Option D',
              correct_option: (item.correct_option as any) || 'A',
            },
          });
        });

        // Theories
        rawB.forEach((item: any, idx: number) => {
          parsedQuestions.push({
            id: `q_ai_theo_${Date.now()}_${idx}`,
            section: 'B',
            question_number: idx + 1,
            question_text: item.question_text || `Theory Question ${idx + 1}`,
            marks: item.marks || 15,
            theory_data: {
              model_answer: item.model_answer || 'Complete step-by-step solution.',
              score_breakdown: item.score_breakdown || 'Part (a): 5 mks, Part (b): 10 mks.',
              max_score: item.max_score || 15,
            },
          });
        });

        setQuestions(parsedQuestions);
        setCurrentStep(4);
        showNotification(`AI drafted ${parsedQuestions.length} standard questions with marking schemes.`);
      } else {
        setAiError(json.error || 'AI generation failed. You can switch to manual authoring or try again.');
      }
    } catch (e: any) {
      setAiError(e?.message || 'Network error while contacting AI engine. Try again or switch to manual.');
    } finally {
      setIsGeneratingAI(false);
    }
  };

  // REGENERATE A SINGLE QUESTION (Replaces only that question without touching the rest!)
  const handleRegenerateQuestion = async (targetQuestion: Question) => {
    setRegeneratingId(targetQuestion.id);
    try {
      const response = await fetch('/api/regenerate-single-question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          class_name: className,
          section: targetQuestion.section,
          question_number: targetQuestion.question_number,
          topics: aiTopics,
        }),
      });

      const res = await response.json();
      if (res.success && res.data) {
        const d = res.data;
        const updatedQuestion: Question = {
          ...targetQuestion,
          question_text: d.question_text || targetQuestion.question_text,
          marks: d.marks || targetQuestion.marks,
          objective_data:
            targetQuestion.section === 'A'
              ? {
                  option_a: d.option_a || 'Option A',
                  option_b: d.option_b || 'Option B',
                  option_c: d.option_c || 'Option C',
                  option_d: d.option_d || 'Option D',
                  correct_option: d.correct_option || 'A',
                }
              : undefined,
          theory_data:
            targetQuestion.section === 'B'
              ? {
                  model_answer: d.model_answer || 'Updated model answer',
                  score_breakdown: d.score_breakdown || 'Formula: 5 mks, Calculation: 10 mks',
                  max_score: d.max_score || 15,
                }
              : undefined,
        };

        setQuestions(questions.map((q) => (q.id === targetQuestion.id ? updatedQuestion : q)));
        showNotification(`Question ${targetQuestion.question_number} regenerated with AI!`);
      }
    } catch {
      // Client-side instant fallback swap
      if (targetQuestion.section === 'A') {
        const replacementObj: Question = {
          ...targetQuestion,
          question_text: `[${subject}] Evaluate the alternative WAEC condition for ${aiTopics || 'the topic'} in ${className}:`,
          objective_data: {
            option_a: 'Standard constant value',
            option_b: 'Inverse relationship under standard pressure',
            option_c: 'Empirical equivalent metric',
            option_d: 'Linear coefficient',
            correct_option: 'B',
          },
        };
        setQuestions(questions.map((q) => (q.id === targetQuestion.id ? replacementObj : q)));
      }
    } finally {
      setRegeneratingId(null);
    }
  };

  // GENERATE MORE QUESTIONS (e.g. +5 objectives or +1 theory)
  const handleGenerateMoreQuestions = async (section: 'A' | 'B', countToAdd: number = 5) => {
    setIsAddingMore(true);
    const currentSectionCount = questions.filter((q) => q.section === section).length;
    const startNumber = currentSectionCount + 1;

    try {
      const response = await fetch('/api/generate-more-questions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subject,
          class_name: className,
          section,
          count: countToAdd,
          start_number: startNumber,
          topics: aiTopics,
        }),
      });

      const res = await response.json();
      if (res.success && Array.isArray(res.data)) {
        const newQs: Question[] = res.data.map((item: any, idx: number) => ({
          id: `q_more_${Date.now()}_${idx}`,
          section,
          question_number: startNumber + idx,
          question_text: item.question_text || `Additional Question ${startNumber + idx}`,
          marks: item.marks || (section === 'A' ? 1 : 15),
          objective_data:
            section === 'A'
              ? {
                  option_a: item.option_a || 'Option A',
                  option_b: item.option_b || 'Option B',
                  option_c: item.option_c || 'Option C',
                  option_d: item.option_d || 'Option D',
                  correct_option: item.correct_option || 'A',
                }
              : undefined,
          theory_data:
            section === 'B'
              ? {
                  model_answer: item.model_answer || 'Model answer and step-by-step scoring rubric.',
                  score_breakdown: item.score_breakdown || 'Formula: 3 mks, Working: 7 mks, Final: 5 mks.',
                  max_score: item.max_score || 15,
                }
              : undefined,
        }));

        setQuestions([...questions, ...newQs]);
        showNotification(`Added ${newQs.length} new ${section === 'A' ? 'objective' : 'theory'} questions!`);
      }
    } catch {
      // Fallback batch
      const newQs: Question[] = [];
      for (let i = 0; i < countToAdd; i++) {
        const qNum = startNumber + i;
        newQs.push({
          id: `q_more_fb_${Date.now()}_${i}`,
          section,
          question_number: qNum,
          question_text: `[${subject} Q${qNum}] Which of the following best represents standard WAEC principle ${qNum}?`,
          marks: section === 'A' ? 1 : 15,
          objective_data:
            section === 'A'
              ? {
                  option_a: 'Standard property A',
                  option_b: 'Derived formula B',
                  option_c: 'Empirical condition C',
                  option_d: 'Universal constant D',
                  correct_option: 'A',
                }
              : undefined,
        });
      }
      setQuestions([...questions, ...newQs]);
      showNotification(`Added ${countToAdd} questions!`);
    } finally {
      setIsAddingMore(false);
    }
  };

  // Add Question Manually
  const handleAddQuestion = (section: 'A' | 'B') => {
    const sectionCount = questions.filter((q) => q.section === section).length;
    const newQ: Question = {
      id: `q_${Date.now()}_${Math.random().toString(36).substring(2, 5)}`,
      section,
      question_number: sectionCount + 1,
      question_text: section === 'A' ? 'Enter objective question stem here...' : '(a) State the definition...\n(b) Solve the equation...',
      marks: section === 'A' ? 1 : 15,
      objective_data:
        section === 'A'
          ? {
              option_a: 'Option A text',
              option_b: 'Option B text',
              option_c: 'Option C text',
              option_d: 'Option D text',
              correct_option: 'A',
            }
          : undefined,
      theory_data:
        section === 'B'
          ? {
              model_answer: 'Full model answer and calculation steps...',
              score_breakdown: 'Part (a): 5 mks; Part (b): 10 mks.',
              max_score: 15,
            }
          : undefined,
    };

    setQuestions([...questions, newQ]);
  };

  const handleRemoveQuestion = (id: string) => {
    setQuestions(questions.filter((q) => q.id !== id));
  };

  const handleUpdateQuestion = (id: string, updates: Partial<Question>) => {
    setQuestions(questions.map((q) => (q.id === id ? { ...q, ...updates } : q)));
  };

  // Save Offline Draft
  const handleSaveDraft = () => {
    if (!school) return;
    const draftExam: Exam = {
      id: `draft_${Date.now()}`,
      school_id: school.id,
      created_by: user?.id || 'admin',
      created_by_name: user?.full_name || 'Staff',
      exam_code: `DRAFT-${subject.slice(0, 3).toUpperCase()}`,
      title,
      subject,
      class_name: className,
      term,
      session,
      duration_minutes: durationMinutes,
      instructions,
      total_marks: totalMarks,
      section_a_marks: questions.filter((q) => q.section === 'A').length,
      section_b_marks: questions.filter((q) => q.section === 'B').reduce((a, b) => a + b.marks, 0),
      status: 'draft',
      created_at: new Date().toISOString(),
      questions,
    };
    db.saveOfflineDraft(draftExam);
    showNotification('Exam draft safely stored in offline storage!');
  };

  // Step 5: Save the exam and all related questions to Supabase.
  const handleSubmitExam = async () => {
    if (!school || !user?.id) {
      alert('Please sign in with a valid school account before publishing an exam.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (!isSupabaseConfigured()) {
        throw new Error('Secure publishing is unavailable because Supabase is not configured.');
      }

      // The quota is checked and incremented atomically in PostgreSQL. Never trust
      // browser localStorage for subscription state or trial limits.
      const { data: quotaResult, error: quotaError } = await supabase.rpc('consume_exam_quota', {
        p_school_id: school.id,
        p_is_ai: method === 'ai',
      });

      if (quotaError) {
        console.error('Secure exam quota check failed', quotaError);
        throw new Error('Could not verify your school subscription or trial quota. Please try again.');
      }

      const quota = quotaResult as { success?: boolean; code?: string; message?: string } | null;
      if (!quota?.success) {
        alert(quota?.message || 'Your exam trial quota could not be confirmed.');
        if (quota?.code === 'quota_exceeded') onOpenPaystack();
        return;
      }

      const examCode = `EC-${session.slice(0, 4)}-${subject.slice(0, 3).toUpperCase()}-${className.replace(/\\s+/g, '')}-${Date.now().toString().slice(-5)}`;
      const sectionAMarks = questions.filter((q) => q.section === 'A').reduce((acc, q) => acc + q.marks, 0);
      const sectionBMarks = questions.filter((q) => q.section === 'B').reduce((acc, q) => acc + q.marks, 0);

      const newExam = await saveExamToSupabase(
        {
          school_id: school.id,
          created_by: user.id,
          created_by_name: user.full_name || 'Staff',
          exam_code: examCode,
          title,
          subject,
          class_name: className,
          term,
          session,
          duration_minutes: durationMinutes,
          instructions,
          total_marks: sectionAMarks + sectionBMarks || totalMarks,
          section_a_marks: sectionAMarks,
          section_b_marks: sectionBMarks,
          status: 'published',
        },
        questions
      );

      // Download the paper and confidential marking scheme only after all records are saved.
      try {
        await exportExamToDocx(newExam, school);
        setTimeout(async () => {
          try {
            await exportMarkingSchemeToDocx(newExam, school);
          } catch (error) {
            console.warn('Marking scheme download failed', error);
          }
        }, 600);
      } catch (error) {
        console.warn('Automatic exam download failed', error);
      }

      try {
        confetti({ particleCount: 80, spread: 60, origin: { y: 0.6 } });
      } catch {
        // Confetti is decorative and must not block a saved exam.
      }

      onSuccessExam(newExam);
    } catch (error) {
      console.error('Exam publication failed', error);
      const message = error instanceof Error ? error.message : 'Unexpected error while saving the exam.';
      alert(`The exam was not published: ${message}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const sectionAQuestions = questions.filter((q) => q.section === 'A');
  const sectionBQuestions = questions.filter((q) => q.section === 'B');

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left pb-16">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Wizard Progress Stepper */}
      <div className="bg-white rounded-3xl p-4 sm:p-6 border border-slate-200/80 shadow-xs">
        <div className="flex items-center justify-between max-w-xl mx-auto text-xs">
          {[
            { step: 1, label: 'Metadata' },
            { step: 2, label: 'Method' },
            { step: 3, label: 'Questions' },
            { step: 4, label: 'Review Paper' },
          ].map((item, idx) => (
            <React.Fragment key={item.step}>
              <div className="flex flex-col items-center">
                <div
                  className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs transition-all ${
                    currentStep === item.step
                      ? 'bg-blue-600 text-white shadow-sm ring-4 ring-blue-100'
                      : currentStep > item.step
                      ? 'bg-emerald-600 text-white'
                      : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {currentStep > item.step ? <CheckCircle2 className="w-4 h-4" /> : item.step}
                </div>
                <span className="text-[11px] font-semibold text-slate-700 mt-1 whitespace-nowrap">
                  {item.label}
                </span>
              </div>
              {idx < 3 && (
                <div
                  className={`flex-1 h-0.5 mx-2 rounded-full transition-colors ${
                    currentStep > item.step ? 'bg-emerald-500' : 'bg-slate-200'
                  }`}
                />
              )}
            </React.Fragment>
          ))}
        </div>
      </div>

      {/* ============================================================== */}
      {/* STEP 1: EXAM METADATA (MANDATORY FIELDS) */}
      {/* ============================================================== */}
      {currentStep === 1 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Step 1: Exam Details & Header</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Specify subject, class, and examination parameters for official WAEC formatting.
            </p>
          </div>

          {stepError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{stepError}</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Subject *</label>
              <select
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              >
                {ALL_NIGERIAN_SUBJECTS.map((sub) => (
                  <option key={sub} value={sub}>
                    {sub}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Class Level *</label>
              <select
                value={className}
                onChange={(e) => setClassName(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              >
                {STANDARD_NIGERIAN_CLASSES.map((cls) => (
                  <option key={cls.name} value={cls.name}>
                    {cls.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Term *</label>
              <select
                value={term}
                onChange={(e) => setTerm(e.target.value as ExamTerm)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              >
                {EXAM_TERMS.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Academic Session *</label>
              <select
                value={session}
                onChange={(e) => setSession(e.target.value)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              >
                {ACADEMIC_SESSIONS.map((ses) => (
                  <option key={ses} value={ses}>
                    {ses}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">Duration (Minutes) *</label>
              <input
                type="number"
                min={30}
                max={240}
                value={durationMinutes}
                onChange={(e) => setDurationMinutes(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">Exam Title *</label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="e.g. First Term Mock Examination"
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">General Instructions *</label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleStep1Next}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-800 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Continue to Question Method</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 2: METHOD SELECTION (AI vs MANUAL) */}
      {/* ============================================================== */}
      {currentStep === 2 && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in">
          <div>
            <h3 className="text-lg font-bold text-slate-900 tracking-tight">Step 2: How would you like to craft this exam?</h3>
            <p className="text-xs text-slate-500 mt-0.5">
              Select between instant AI generation or manual question authoring.
            </p>
          </div>

          {/* Subscription Banner */}
          {school && school.subscription_status === 'active' ? (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-2xl flex items-center justify-between text-xs text-emerald-900 font-medium">
              <div className="flex items-center gap-2">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>
                  <strong>PAID · FULL TERM ACTIVE:</strong> Unlimited AI & Manual Exam Generations Unlocked
                </span>
              </div>
              <span className="bg-emerald-600 text-white font-bold px-2 py-0.5 rounded-full text-[10px]">
                PAID
              </span>
            </div>
          ) : school && school.ai_exams_used >= 4 ? (
            <div className="p-3.5 bg-amber-50 border border-amber-200 rounded-2xl text-xs text-amber-950 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <span className="font-bold text-amber-900 block">
                  4 of 4 Free Trial Exams Completed!
                </span>
                <span>
                  To generate your <strong>5th exam</strong>, please complete payment for full term access.
                </span>
              </div>
              <button
                onClick={onOpenPaystack}
                className="px-3.5 py-1.5 rounded-xl bg-blue-600 hover:bg-blue-700 text-white font-bold text-xs shrink-0 flex items-center gap-1.5 shadow-sm active:scale-95 transition-all"
              >
                <CreditCard className="w-3.5 h-3.5" />
                <span>Pay ₦11,000 via Paystack</span>
              </button>
            </div>
          ) : (
            <div className="p-2.5 bg-blue-50/70 border border-blue-100 rounded-2xl text-xs text-blue-900 flex items-center justify-between">
              <span>Free Trial Active: <strong>{4 - (school?.ai_exams_used || 0)} of 4</strong> free AI generations remaining</span>
              <span className="text-[10px] text-blue-600 font-semibold">Attempt 5 requires payment</span>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div
              onClick={() => handleSelectMethod('ai')}
              className={`p-5 rounded-3xl border-2 transition-all cursor-pointer text-left group ${
                school?.subscription_status !== 'active' && (school?.ai_exams_used || 0) >= 4
                  ? 'border-amber-300 bg-amber-50/30 hover:border-amber-500'
                  : 'border-blue-200 hover:border-blue-600 bg-gradient-to-br from-blue-50/50 to-white hover:shadow-md'
              }`}
            >
              <div className="w-12 h-12 rounded-2xl bg-blue-600 text-white flex items-center justify-center mb-4 shadow-sm shadow-blue-600/30 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-blue-950">AI Question Generator</h4>
                {school?.subscription_status === 'active' ? (
                  <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-2 py-0.5 rounded-full">
                    Unlimited
                  </span>
                ) : (school?.ai_exams_used || 0) >= 4 ? (
                  <span className="text-[10px] bg-amber-200 text-amber-900 font-bold px-2 py-0.5 rounded-full">
                    5th Attempt Paywall
                  </span>
                ) : (
                  <span className="text-[10px] bg-blue-200 text-blue-900 font-bold px-2 py-0.5 rounded-full">
                    Recommended
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Generate authentic WAEC-standard multiple choice questions, essay problems, and confidential scoring rubrics in seconds from Nigerian curriculum topics.
              </p>
              <div className="mt-4 text-xs font-bold text-blue-600 flex items-center gap-1">
                <span>
                  {school?.subscription_status !== 'active' && (school?.ai_exams_used || 0) >= 4
                    ? 'Unlock 5th Exam (₦11,000)'
                    : 'Configure AI Generator'}
                </span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            <div
              onClick={() => handleSelectMethod('manual')}
              className="p-5 rounded-3xl border border-slate-200 hover:border-slate-400 bg-white hover:shadow-md transition-all cursor-pointer text-left group"
            >
              <div className="w-12 h-12 rounded-2xl bg-slate-900 text-white flex items-center justify-center mb-4 group-hover:scale-105 transition-transform">
                <PenTool className="w-6 h-6" />
              </div>
              <h4 className="text-base font-bold text-slate-900">Manual Authoring</h4>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Type or dictate your own past exam questions. Includes full scientific symbol picker, voice dictation, and custom marking schemes.
              </p>
              <div className="mt-4 text-xs font-bold text-slate-700 flex items-center gap-1">
                <span>Start Manual Input</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>
          </div>

          <div className="pt-2 flex justify-between items-center">
            <button
              onClick={() => setCurrentStep(1)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back to Details</span>
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 3A: AI QUESTION GENERATION CONFIG */}
      {/* ============================================================== */}
      {currentStep === 3 && method === 'ai' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-5 animate-in fade-in">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Step 3: AI Generator Parameters</h3>
              <p className="text-xs text-slate-500 mt-0.5">
                Specifying topics for <strong className="text-blue-600">{subject}</strong> ({className} · {term})
              </p>
            </div>
            <button
              onClick={() => setMethod('manual')}
              className="text-xs font-semibold text-blue-600 hover:underline"
            >
              Switch to Manual Input
            </button>
          </div>

          {aiError && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-2xl text-xs text-rose-700 flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{aiError}</span>
            </div>
          )}

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">
              Syllabus Topics to Cover *
            </label>
            <input
              type="text"
              value={aiTopics}
              onChange={(e) => setAiTopics(e.target.value)}
              placeholder="e.g. Quadratic Equations, Indices, Circle Theorems, Commercial Arithmetic"
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Objectives (e.g. 10 to 25)
              </label>
              <input
                type="number"
                min={5}
                max={50}
                value={aiNumObj}
                onChange={(e) => setAiNumObj(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Theory / Essay Questions
              </label>
              <input
                type="number"
                min={1}
                max={6}
                value={aiNumTheory}
                onChange={(e) => setAiNumTheory(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Standard & Rigor
              </label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-blue-600 focus:ring-1 focus:ring-blue-600 bg-white"
              >
                <option value="Standard WAEC/JAMB">Standard WAEC / JAMB</option>
                <option value="Foundational / Basic">Foundational / Basic</option>
                <option value="Advanced / Rigorous">Advanced / Rigorous</option>
              </select>
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={() => {
                if (school && school.subscription_status !== 'active' && school.ai_exams_used >= 4) {
                  onOpenPaystack();
                  return;
                }
                handleGenerateAI();
              }}
              disabled={isGeneratingAI}
              className={`px-6 py-2.5 rounded-xl text-white font-semibold text-xs flex items-center gap-2 shadow-md transition-all active:scale-95 ${
                school?.subscription_status !== 'active' && (school?.ai_exams_used || 0) >= 4
                  ? 'bg-amber-600 hover:bg-amber-700 shadow-amber-600/25'
                  : 'bg-blue-600 hover:bg-blue-800 shadow-blue-600/20 disabled:opacity-75'
              }`}
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Drafting Questions & Marking Scheme...</span>
                </>
              ) : school?.subscription_status !== 'active' && (school?.ai_exams_used || 0) >= 4 ? (
                <>
                  <CreditCard className="w-4 h-4" />
                  <span>Unlock 5th Exam (Pay ₦11,000 via Paystack)</span>
                </>
              ) : (
                <>
                  <Sparkles className="w-4 h-4" />
                  <span>Generate Examination Paper</span>
                </>
              )}
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 3B: MANUAL QUESTION AUTHORING */}
      {/* ============================================================== */}
      {currentStep === 3 && method === 'manual' && (
        <div className="bg-white rounded-3xl p-6 sm:p-8 border border-slate-200/80 shadow-xs space-y-6 animate-in fade-in">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-bold text-slate-900 tracking-tight">Step 3: Manual Authoring</h3>
              <p className="text-xs text-slate-500">
                Craft questions with scientific symbols and voice speech-to-text.
              </p>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSaveDraft}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 hover:bg-slate-50 text-xs font-semibold flex items-center gap-1.5"
              >
                <Save className="w-3.5 h-3.5" />
                <span>Save Draft</span>
              </button>
            </div>
          </div>

          {/* Section A vs Section B Switcher */}
          <div className="flex items-center gap-2 border-b border-slate-100 pb-2">
            <button
              type="button"
              onClick={() => setActiveManualSection('A')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeManualSection === 'A'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Section A: Objectives ({sectionAQuestions.length})
            </button>
            <button
              type="button"
              onClick={() => setActiveManualSection('B')}
              className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                activeManualSection === 'B'
                  ? 'bg-blue-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              Section B: Theory / Essay ({sectionBQuestions.length})
            </button>
          </div>

          {/* Questions List for Active Section */}
          <div className="space-y-4">
            {(activeManualSection === 'A' ? sectionAQuestions : sectionBQuestions).map((q, idx) => (
              <div
                key={q.id}
                className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-3"
              >
                <div className="flex items-center justify-between">
                  <span className="text-xs font-bold text-blue-900">
                    Question {idx + 1} ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                  </span>
                  <div className="flex items-center gap-1.5">
                    <button
                      type="button"
                      onClick={() => handleRegenerateQuestion(q)}
                      disabled={regeneratingId === q.id}
                      className="px-2 py-1 text-[11px] font-semibold text-blue-600 hover:bg-blue-100 rounded-lg flex items-center gap-1 border border-blue-200 bg-white"
                      title="Regenerate this question with AI"
                    >
                      <RefreshCw className={`w-3 h-3 ${regeneratingId === q.id ? 'animate-spin' : ''}`} />
                      <span>{regeneratingId === q.id ? 'Regenerating...' : 'Regenerate'}</span>
                    </button>
                    <button
                      onClick={() => handleRemoveQuestion(q.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>

                {/* Question Text with Symbol & Voice Toolbar */}
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label className="text-[11px] font-semibold text-slate-600">Question Stem</label>
                    <div className="flex items-center gap-1">
                      <ScientificSymbolPicker
                        onInsert={(sym) =>
                          handleUpdateQuestion(q.id, {
                            question_text: (q.question_text || '') + sym,
                          })
                        }
                      />
                      <VoiceInputButton
                        onTranscript={(text) =>
                          handleUpdateQuestion(q.id, {
                            question_text: (q.question_text || '') + ' ' + text,
                          })
                        }
                      />
                    </div>
                  </div>
                  <textarea
                    rows={2}
                    value={q.question_text}
                    onChange={(e) => handleUpdateQuestion(q.id, { question_text: e.target.value })}
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:border-blue-600 focus:ring-1 focus:ring-blue-600"
                  />
                </div>

                {/* Section A: Options A, B, C, D */}
                {q.section === 'A' && q.objective_data && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1">
                    {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                      const optKey = `option_${opt.toLowerCase()}` as keyof ObjectiveAnswer;
                      const isCorrect = q.objective_data?.correct_option === opt;
                      return (
                        <div key={opt} className="flex items-center gap-2 bg-white p-2 rounded-xl border border-slate-200">
                          <button
                            type="button"
                            onClick={() =>
                              handleUpdateQuestion(q.id, {
                                objective_data: {
                                  ...q.objective_data!,
                                  correct_option: opt,
                                },
                              })
                            }
                            className={`w-6 h-6 rounded-full text-xs font-bold flex items-center justify-center shrink-0 transition-colors ${
                              isCorrect
                                ? 'bg-emerald-600 text-white'
                                : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
                            }`}
                            title="Mark as correct answer"
                          >
                            {opt}
                          </button>
                          <input
                            type="text"
                            value={q.objective_data?.[optKey] || ''}
                            onChange={(e) =>
                              handleUpdateQuestion(q.id, {
                                objective_data: {
                                  ...q.objective_data!,
                                  [optKey]: e.target.value,
                                },
                              })
                            }
                            placeholder={`Option ${opt}`}
                            className="w-full text-xs outline-none bg-transparent"
                          />
                        </div>
                      );
                    })}
                  </div>
                )}

                {/* Section B: Model Answer & Scoring Rubric */}
                {q.section === 'B' && q.theory_data && (
                  <div className="space-y-2 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Model Answer (Confidential)
                      </label>
                      <textarea
                        rows={2}
                        value={q.theory_data.model_answer}
                        onChange={(e) =>
                          handleUpdateQuestion(q.id, {
                            theory_data: {
                              ...q.theory_data!,
                              model_answer: e.target.value,
                            },
                          })
                        }
                        className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
                      />
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold text-slate-600 mb-1">
                        Score Breakdown / Rubric
                      </label>
                      <input
                        type="text"
                        value={q.theory_data.score_breakdown}
                        onChange={(e) =>
                          handleUpdateQuestion(q.id, {
                            theory_data: {
                              ...q.theory_data!,
                              score_breakdown: e.target.value,
                            },
                          })
                        }
                        placeholder="e.g. Formula: 2 mks, Correct unit: 1 mk"
                        className="w-full text-xs rounded-xl border border-slate-300 p-2 bg-white"
                      />
                    </div>
                  </div>
                )}
              </div>
            ))}

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <button
                onClick={() => handleAddQuestion(activeManualSection)}
                className="py-2.5 px-3 rounded-2xl border-2 border-dashed border-blue-300 hover:border-blue-600 text-blue-600 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors bg-blue-50/40"
              >
                <Plus className="w-4 h-4" />
                <span>Add Blank Question</span>
              </button>

              <button
                onClick={() => handleGenerateMoreQuestions(activeManualSection, activeManualSection === 'A' ? 5 : 2)}
                disabled={isAddingMore}
                className="py-2.5 px-3 rounded-2xl bg-blue-100 hover:bg-blue-200 text-blue-900 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors"
              >
                <Sparkles className="w-4 h-4 text-blue-600" />
                <span>
                  {isAddingMore
                    ? 'AI Adding Questions...'
                    : `+${activeManualSection === 'A' ? '5 More Objectives' : '2 More Theories'} (AI)`}
                </span>
              </button>
            </div>
          </div>

          <div className="pt-4 flex justify-between items-center border-t border-slate-100">
            <button
              onClick={() => setCurrentStep(2)}
              className="px-4 py-2 text-xs font-semibold text-slate-600 hover:text-slate-900 flex items-center gap-1.5"
            >
              <ArrowLeft className="w-4 h-4" />
              <span>Back</span>
            </button>

            <button
              onClick={() => setCurrentStep(4)}
              className="px-6 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-800 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Live Paper Preview & Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 4: LIVE DOCX-STYLE PREVIEW + INLINE EDITING + REGENERATE */}
      {/* ============================================================== */}
      {currentStep === 4 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Top Control Bar */}
          <div className="bg-white p-4 sm:p-5 rounded-3xl border border-slate-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div>
              <div className="flex items-center gap-2">
                <span className="text-[11px] font-bold text-blue-600 bg-blue-50 px-2 py-0.5 rounded-md uppercase tracking-wider">
                  Official WAEC/JAMB Preview
                </span>
                <span className="text-xs text-slate-400">·</span>
                <span className="text-xs text-slate-600 font-medium">{subject} ({className})</span>
              </div>
              <h3 className="text-base font-bold text-slate-900 mt-0.5">
                Review & Edit Examination Paper
              </h3>
              <p className="text-xs text-slate-500">
                Click any question to edit text or options. Regenerate questions or add more objectives below.
              </p>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-3.5 py-2 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50 transition-colors"
              >
                Back
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="px-5 py-2.5 rounded-xl bg-blue-600 hover:bg-blue-800 disabled:opacity-75 text-white font-bold text-xs flex items-center gap-2 shadow-md shadow-blue-600/25 active:scale-95 transition-all"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Auto-Downloading & Syncing...</span>
                  </>
                ) : (
                  <>
                    <Download className="w-4 h-4" />
                    <span>Publish & Auto-Download DOCX</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Quick AI Addition Toolbar: Add more objectives or theories */}
          <div className="p-3.5 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border border-blue-200/70 flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <span className="text-xs font-bold text-blue-950">
                Want to add more questions?
              </span>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => handleGenerateMoreQuestions('A', 5)}
                disabled={isAddingMore}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-semibold text-xs border border-blue-200 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>+5 Objectives</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateMoreQuestions('A', 1)}
                disabled={isAddingMore}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-semibold text-xs border border-blue-200 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>+1 Objective</span>
              </button>
              <button
                type="button"
                onClick={() => handleGenerateMoreQuestions('B', 1)}
                disabled={isAddingMore}
                className="px-3 py-1.5 rounded-xl bg-white hover:bg-blue-50 text-blue-900 font-semibold text-xs border border-blue-200 shadow-xs flex items-center gap-1.5 transition-colors disabled:opacity-50"
              >
                <Plus className="w-3.5 h-3.5 text-blue-600" />
                <span>+1 Theory Question</span>
              </button>
            </div>
          </div>

          {/* Authentic Document Paper Sheet (A4 Simulation with Times New Roman & Inline Options) */}
          <div className="bg-white p-6 sm:p-10 rounded-3xl border border-slate-300 shadow-xl font-serif text-slate-900 leading-snug max-w-3xl mx-auto space-y-5">
            {/* Header */}
            <div className="text-center space-y-1 pb-3 border-b-2 border-slate-800">
              <h2 className="text-lg sm:text-xl font-bold uppercase tracking-tight">
                {school?.name || "KING'S COLLEGE LAGOS"}
              </h2>
              {school?.motto && (
                <p className="text-[11px] italic text-slate-600">"{school.motto}"</p>
              )}
              <p className="text-[11px] text-slate-600">
                {school?.address || `${school?.lga || 'Lagos Island'}, ${school?.state || 'Lagos'} State`}
              </p>
              <h3 className="text-xs sm:text-sm font-bold uppercase underline mt-2">
                {term.toUpperCase()} EXAMINATION — {session} ACADEMIC SESSION
              </h3>

              <div className="grid grid-cols-2 text-[11px] font-bold pt-2 text-left">
                <div>
                  <p>SUBJECT: <span className="font-normal uppercase">{subject}</span></p>
                  <p>CLASS: <span className="font-normal">{className}</span></p>
                </div>
                <div className="text-right">
                  <p>TIME ALLOWED: <span className="font-normal">{durationMinutes} MINUTES</span></p>
                  <p>TOTAL MARKS: <span className="font-normal">{totalMarks} MARKS</span></p>
                </div>
              </div>

              <div className="text-[11px] font-bold text-left pt-2">
                CANDIDATE NAME: _________________________________________  CLASS/ARM: ___________
              </div>

              <div className="text-[11px] italic text-left pt-1 text-slate-700">
                <strong>GENERAL INSTRUCTIONS:</strong> {instructions}
              </div>
            </div>

            {/* Section A: Objectives */}
            {sectionAQuestions.length > 0 && (
              <div className="space-y-3">
                <div className="text-center">
                  <h4 className="text-xs sm:text-sm font-bold uppercase underline">
                    SECTION A: OBJECTIVE QUESTIONS [{sectionAQuestions.length} MARKS]
                  </h4>
                  <p className="text-[11px] italic text-slate-600">
                    Choose the correct option lettered A to D for each question.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  {sectionAQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 flex gap-1.5 items-baseline">
                          <span className="font-bold shrink-0">{idx + 1}.</span>
                          <input
                            type="text"
                            value={q.question_text}
                            onChange={(e) => handleUpdateQuestion(q.id, { question_text: e.target.value })}
                            className="w-full bg-transparent border-b border-transparent hover:border-blue-300 focus:border-blue-600 outline-none font-serif text-xs font-medium"
                          />
                        </div>
                        {/* Regenerate Question Action */}
                        <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            type="button"
                            onClick={() => handleRegenerateQuestion(q)}
                            disabled={regeneratingId === q.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 font-sans font-semibold flex items-center gap-1"
                            title="Regenerate with AI"
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${regeneratingId === q.id ? 'animate-spin' : ''}`} />
                            <span>{regeneratingId === q.id ? 'Regen...' : 'Regen'}</span>
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveQuestion(q.id)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded"
                            title="Delete"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                      </div>

                      {/* Options Inline (A4 Single-Line Layout) */}
                      {q.objective_data && (
                        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 pl-4 pt-1 text-slate-800 text-[11px]">
                          {(['A', 'B', 'C', 'D'] as const).map((opt) => {
                            const optKey = `option_${opt.toLowerCase()}` as keyof ObjectiveAnswer;
                            const isCorrect = q.objective_data?.correct_option === opt;
                            return (
                              <div key={opt} className="flex items-center gap-1">
                                <button
                                  type="button"
                                  onClick={() =>
                                    handleUpdateQuestion(q.id, {
                                      objective_data: {
                                        ...q.objective_data!,
                                        correct_option: opt,
                                      },
                                    })
                                  }
                                  className={`font-bold px-1 rounded transition-colors ${
                                    isCorrect ? 'bg-emerald-100 text-emerald-800 font-bold' : 'text-slate-700 hover:bg-slate-200'
                                  }`}
                                  title="Click to toggle correct key"
                                >
                                  [{opt}]
                                </button>
                                <input
                                  type="text"
                                  value={q.objective_data?.[optKey] || ''}
                                  onChange={(e) =>
                                    handleUpdateQuestion(q.id, {
                                      objective_data: {
                                        ...q.objective_data!,
                                        [optKey]: e.target.value,
                                      },
                                    })
                                  }
                                  className="bg-transparent border-b border-transparent hover:border-slate-300 focus:border-blue-600 outline-none w-24 sm:w-32"
                                />
                              </div>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section B: Theory */}
            {sectionBQuestions.length > 0 && (
              <div className="space-y-3 pt-3 border-t border-slate-300">
                <div className="text-center">
                  <h4 className="text-xs sm:text-sm font-bold uppercase underline">
                    SECTION B: ESSAY / THEORY
                  </h4>
                  <p className="text-[11px] italic text-slate-600">
                    Answer questions in this section in your booklet. Show all working clearly.
                  </p>
                </div>

                <div className="space-y-3 text-xs">
                  {sectionBQuestions.map((q, idx) => (
                    <div
                      key={q.id}
                      className="p-2 rounded-xl hover:bg-slate-50 transition-colors border border-transparent hover:border-slate-200 group space-y-1"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div className="flex-1 flex gap-1.5 items-start">
                          <span className="font-bold shrink-0">{idx + 1}.</span>
                          <textarea
                            rows={2}
                            value={q.question_text}
                            onChange={(e) => handleUpdateQuestion(q.id, { question_text: e.target.value })}
                            className="w-full bg-transparent border-b border-transparent hover:border-blue-300 focus:border-blue-600 outline-none font-serif text-xs"
                          />
                        </div>
                        <div className="flex items-center gap-1.5 shrink-0">
                          <span className="font-bold italic text-slate-600">[{q.marks} Mks]</span>
                          <button
                            type="button"
                            onClick={() => handleRegenerateQuestion(q)}
                            disabled={regeneratingId === q.id}
                            className="px-1.5 py-0.5 rounded text-[10px] bg-blue-50 text-blue-600 hover:bg-blue-100 font-sans font-semibold flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity"
                            title="Regenerate with AI"
                          >
                            <RefreshCw className={`w-2.5 h-2.5 ${regeneratingId === q.id ? 'animate-spin' : ''}`} />
                            <span>Regen</span>
                          </button>
                        </div>
                      </div>

                      {/* Model Answer Preview */}
                      {q.theory_data && (
                        <div className="pl-4 text-[10px] text-slate-500 font-sans bg-slate-50/70 p-2 rounded-lg border border-slate-200/60 space-y-0.5">
                          <p>
                            <strong className="text-blue-900">Model Answer: </strong>
                            <span>{q.theory_data.model_answer}</span>
                          </p>
                          <p>
                            <strong className="text-emerald-800">Scoring Rubric: </strong>
                            <span>{q.theory_data.score_breakdown}</span>
                          </p>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};
