import React, { useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
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
  Image as ImageIcon
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

  // Wizard Step: 1 = Metadata, 2 = Method, 3 = Questions (Manual or AI prompt), 4 = Review & Edit, 5 = Submitting
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
  const [aiNumObj, setAiNumObj] = useState(10); // Default 10 (max 25 on trial)
  const [aiNumTheory, setAiNumTheory] = useState(3);
  const [aiDifficulty, setAiDifficulty] = useState<'Standard WAEC/JAMB' | 'Foundational / Basic' | 'Advanced / Rigorous'>('Standard WAEC/JAMB');
  const [isGeneratingAI, setIsGeneratingAI] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  // Questions State (Manual authoring or loaded from AI)
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
    setMethod(selected);
    setCurrentStep(3);
  };

  // Step 3b AI Generation Handler
  const handleGenerateAI = async () => {
    if (!school) return;
    setIsGeneratingAI(true);
    setAiError(null);

    // Enforce trial limit
    if (school.subscription_status !== 'active' && school.ai_exams_used >= school.max_trial_ai_exams) {
      setAiError(
        `Trial limit reached (${school.max_trial_ai_exams}/${school.max_trial_ai_exams} AI exams used). Please upgrade to unlimited school subscription for ₦11,000/term.`
      );
      setIsGeneratingAI(false);
      return;
    }

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

      const json = await response.json();
      if (json.success && json.data) {
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
              option_a: item.option_a || 'A',
              option_b: item.option_b || 'B',
              option_c: item.option_c || 'C',
              option_d: item.option_d || 'D',
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
              score_breakdown: item.score_breakdown || 'Formula: 2 mks, Steps: 8 mks, Conclusion: 5 mks.',
              max_score: item.max_score || 15,
            },
          });
        });

        setQuestions(parsedQuestions);
        setCurrentStep(4); // Advance directly to live preview & inline editing!
      } else {
        setAiError(json.error || 'AI generation failed. You can switch to manual authoring or try again.');
      }
    } catch (e: any) {
      setAiError(e?.message || 'Network error while contacting AI engine. Retrying or switch to manual input.');
    } finally {
      setIsGeneratingAI(false);
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
    setQuestions(
      questions.map((q) => (q.id === id ? { ...q, ...updates } : q))
    );
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
    alert('Exam draft safely stored in offline storage!');
  };

  // Step 5: Final Submission & Trial Deduction
  const handleSubmitExam = async () => {
    if (!school) return;
    setIsSubmitting(true);

    const trialRes = db.consumeTrial(school.id, method === 'ai');
    if (!trialRes.success) {
      alert(trialRes.message || 'Trial quota exhausted');
      setIsSubmitting(false);
      onOpenPaystack();
      return;
    }

    const examCode = `EC-${session.slice(0, 4)}-${subject.slice(0, 3).toUpperCase()}-${className.replace(/\s+/g, '')}`;
    const sectionAMarks = questions.filter((q) => q.section === 'A').reduce((acc, q) => acc + q.marks, 0);
    const sectionBMarks = questions.filter((q) => q.section === 'B').reduce((acc, q) => acc + q.marks, 0);

    const newExam = db.saveExam(
      {
        school_id: school.id,
        created_by: user?.id || 'admin',
        created_by_name: user?.full_name || 'Staff',
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

    // Trigger celebration confetti
    try {
      confetti({
        particleCount: 80,
        spread: 60,
        origin: { y: 0.6 },
      });
    } catch {
      // Ignored if confetti fails
    }

    setIsSubmitting(false);
    onSuccessExam(newExam);
  };

  const sectionAQuestions = questions.filter((q) => q.section === 'A');
  const sectionBQuestions = questions.filter((q) => q.section === 'B');

  return (
    <div className="max-w-4xl mx-auto space-y-6 text-left pb-16">
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
                      ? 'bg-purple-700 text-white shadow-sm ring-4 ring-purple-100'
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
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-slate-700 mb-1">General Instructions *</label>
            <textarea
              rows={3}
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
            />
          </div>

          <div className="pt-4 flex justify-end">
            <button
              onClick={handleStep1Next}
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all"
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

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Option A: AI Question Generator */}
            <div
              onClick={() => handleSelectMethod('ai')}
              className="p-5 rounded-3xl border-2 border-purple-200 hover:border-purple-600 bg-gradient-to-br from-purple-50/50 to-white hover:shadow-md transition-all cursor-pointer text-left group"
            >
              <div className="w-12 h-12 rounded-2xl bg-purple-700 text-white flex items-center justify-center mb-4 shadow-sm shadow-purple-600/30 group-hover:scale-105 transition-transform">
                <Sparkles className="w-6 h-6" />
              </div>
              <div className="flex items-center gap-2">
                <h4 className="text-base font-bold text-purple-950">AI Question Generator</h4>
                <span className="text-[10px] bg-purple-200 text-purple-900 font-bold px-2 py-0.5 rounded-full">
                  Recommended
                </span>
              </div>
              <p className="text-xs text-slate-600 mt-1.5 leading-relaxed">
                Generate authentic WAEC-standard multiple choice questions, essay problems, and confidential scoring rubrics in seconds from Nigerian curriculum topics.
              </p>
              <div className="mt-4 text-xs font-bold text-purple-700 flex items-center gap-1">
                <span>Configure AI Generator</span>
                <ArrowRight className="w-3.5 h-3.5" />
              </div>
            </div>

            {/* Option B: Manual Authoring */}
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
                Specifying topics for <strong className="text-purple-700">{subject}</strong> ({className} · {term})
              </p>
            </div>
            <button
              onClick={() => setMethod('manual')}
              className="text-xs font-semibold text-purple-700 hover:underline"
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
              className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Objectives (Max 25 on Trial)
              </label>
              <input
                type="number"
                min={5}
                max={25}
                value={aiNumObj}
                onChange={(e) => setAiNumObj(Number(e.target.value))}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                Standard & Rigor
              </label>
              <select
                value={aiDifficulty}
                onChange={(e) => setAiDifficulty(e.target.value as any)}
                className="w-full text-xs rounded-xl border border-slate-300 p-2.5 focus:border-purple-600 focus:ring-1 focus:ring-purple-600 bg-white"
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
              onClick={handleGenerateAI}
              disabled={isGeneratingAI}
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-75 text-white font-semibold text-xs flex items-center gap-2 shadow-md shadow-purple-700/20 transition-all"
            >
              {isGeneratingAI ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>AI Drafting Questions & Marking Scheme...</span>
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
                  ? 'bg-purple-700 text-white shadow-xs'
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
                  ? 'bg-purple-700 text-white shadow-xs'
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
                  <span className="text-xs font-bold text-purple-900">
                    Question {idx + 1} ({q.marks} Mark{q.marks > 1 ? 's' : ''})
                  </span>
                  <button
                    onClick={() => handleRemoveQuestion(q.id)}
                    className="p-1 text-slate-400 hover:text-rose-600 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
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
                    className="w-full text-xs rounded-xl border border-slate-300 p-2.5 bg-white focus:border-purple-600 focus:ring-1 focus:ring-purple-600"
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

            <button
              onClick={() => handleAddQuestion(activeManualSection)}
              className="w-full py-3 rounded-2xl border-2 border-dashed border-purple-300 hover:border-purple-600 text-purple-700 font-semibold text-xs flex items-center justify-center gap-1.5 transition-colors bg-purple-50/40"
            >
              <Plus className="w-4 h-4" />
              <span>Add Another Question to Section {activeManualSection}</span>
            </button>
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
              className="px-6 py-2.5 rounded-xl bg-purple-700 hover:bg-purple-800 text-white font-semibold text-xs flex items-center gap-2 shadow-xs transition-all"
            >
              <span>Live Paper Preview & Verification</span>
              <ArrowRight className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* ============================================================== */}
      {/* STEP 4: LIVE DOCX-STYLE PREVIEW + INLINE EDITING */}
      {/* ============================================================== */}
      {currentStep === 4 && (
        <div className="space-y-4 animate-in fade-in">
          {/* Header Bar */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white p-4 rounded-2xl border border-slate-200">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Step 4: Live Official WAEC/JAMB Paper Preview</h3>
              <p className="text-xs text-slate-500">
                Review your paper in authentic 12pt Times New Roman style. Click any text to edit inline!
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentStep(3)}
                className="px-3 py-1.5 rounded-xl border border-slate-300 text-slate-700 text-xs font-semibold hover:bg-slate-50"
              >
                Back to Questions
              </button>
              <button
                onClick={handleSubmitExam}
                disabled={isSubmitting}
                className="px-5 py-2 rounded-xl bg-purple-700 hover:bg-purple-800 disabled:opacity-75 text-white font-semibold text-xs flex items-center gap-2 shadow-sm"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    <span>Publishing Exam...</span>
                  </>
                ) : (
                  <>
                    <CheckCircle2 className="w-4 h-4" />
                    <span>Finalize & Publish Exam</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* Authentic Document Paper Sheet */}
          <div className="bg-white p-8 sm:p-12 rounded-3xl border border-slate-300 shadow-lg font-serif text-slate-900 leading-relaxed max-w-3xl mx-auto space-y-6">
            {/* Header */}
            <div className="text-center space-y-1 pb-4 border-b-2 border-slate-800">
              <h2 className="text-xl sm:text-2xl font-bold uppercase tracking-tight">
                {school?.name || "KING'S COLLEGE LAGOS"}
              </h2>
              {school?.motto && (
                <p className="text-xs italic text-slate-600">"{school.motto}"</p>
              )}
              <p className="text-xs text-slate-600">
                {school?.address || `${school?.lga || 'Lagos Island'}, ${school?.state || 'Lagos'} State`}
              </p>
              <h3 className="text-base font-bold uppercase underline mt-2">
                {term.toUpperCase()} EXAMINATION — {session} ACADEMIC SESSION
              </h3>

              <div className="grid grid-cols-2 text-xs font-bold pt-3 text-left">
                <div>
                  <p>SUBJECT: <span className="font-normal uppercase">{subject}</span></p>
                  <p>CLASS: <span className="font-normal">{className}</span></p>
                </div>
                <div className="text-right">
                  <p>TIME ALLOWED: <span className="font-normal">{durationMinutes} MINUTES</span></p>
                  <p>TOTAL MARKS: <span className="font-normal">{totalMarks} MARKS</span></p>
                </div>
              </div>

              <div className="text-xs font-bold text-left pt-3">
                CANDIDATE NAME: _________________________________________  CLASS/ARM: ___________
              </div>

              <div className="text-xs italic text-left pt-2 text-slate-700">
                <strong>GENERAL INSTRUCTIONS:</strong> {instructions}
              </div>
            </div>

            {/* Section A: Objectives */}
            {sectionAQuestions.length > 0 && (
              <div className="space-y-4">
                <div className="text-center">
                  <h4 className="text-sm font-bold uppercase underline">
                    SECTION A: OBJECTIVE QUESTIONS [{questions.filter((q) => q.section === 'A').length} MARKS]
                  </h4>
                  <p className="text-xs italic text-slate-600">
                    Choose the correct option lettered A to D for each question.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {sectionAQuestions.map((q, idx) => (
                    <div key={q.id} className="space-y-1">
                      <div className="flex gap-2">
                        <span className="font-bold">{idx + 1}.</span>
                        <input
                          type="text"
                          value={q.question_text}
                          onChange={(e) => handleUpdateQuestion(q.id, { question_text: e.target.value })}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-600 outline-none font-serif text-xs font-medium"
                        />
                      </div>
                      {q.objective_data && (
                        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pl-6 text-slate-800">
                          <span className={q.objective_data.correct_option === 'A' ? 'font-bold text-emerald-800' : ''}>
                            [A] {q.objective_data.option_a}
                          </span>
                          <span className={q.objective_data.correct_option === 'B' ? 'font-bold text-emerald-800' : ''}>
                            [B] {q.objective_data.option_b}
                          </span>
                          <span className={q.objective_data.correct_option === 'C' ? 'font-bold text-emerald-800' : ''}>
                            [C] {q.objective_data.option_c}
                          </span>
                          <span className={q.objective_data.correct_option === 'D' ? 'font-bold text-emerald-800' : ''}>
                            [D] {q.objective_data.option_d}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Section B: Theory */}
            {sectionBQuestions.length > 0 && (
              <div className="space-y-4 pt-4 border-t border-slate-300">
                <div className="text-center">
                  <h4 className="text-sm font-bold uppercase underline">
                    SECTION B: ESSAY / THEORY
                  </h4>
                  <p className="text-xs italic text-slate-600">
                    Answer questions in this section clearly. All working must be shown.
                  </p>
                </div>

                <div className="space-y-4 text-xs">
                  {sectionBQuestions.map((q, idx) => (
                    <div key={q.id} className="space-y-1">
                      <div className="flex items-start justify-between gap-2">
                        <span className="font-bold">{idx + 1}.</span>
                        <textarea
                          rows={2}
                          value={q.question_text}
                          onChange={(e) => handleUpdateQuestion(q.id, { question_text: e.target.value })}
                          className="w-full bg-transparent border-b border-transparent hover:border-slate-300 focus:border-purple-600 outline-none font-serif text-xs"
                        />
                        <span className="font-bold italic text-slate-600 shrink-0">
                          [{q.marks} Marks]
                        </span>
                      </div>
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
