import React, { useEffect, useState } from 'react';
import confetti from 'canvas-confetti';
import { useAuth } from '../../lib/auth';
import { db } from '../../lib/db';
import { isSupabaseConfigured, supabase } from '../../lib/supabase';
import { publishExamWithQuota } from '../../lib/examRepository';
import {
  Exam,
  Question,
  ExamTerm,
  ObjectiveAnswer,
  TheoryMarkingScheme,
  School
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
  guestInviteToken?: string;
  guestSchool?: School;
}

export const CreateExamWizard: React.FC<CreateExamWizardProps> = ({
  navigate,
  onOpenPaystack,
  onSuccessExam,
  guestInviteToken,
  guestSchool,
}) => {
  const { school: authenticatedSchool, user, role } = useAuth();
  const school = guestSchool || authenticatedSchool;
  const isGuestTeacher = Boolean(guestInviteToken);

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
  const [generationStage, setGenerationStage] = useState<'working' | 'finishing' | null>(null);
  const [motivationIndex, setMotivationIndex] = useState(0);
  const [schoolClasses, setSchoolClasses] = useState<Array<{ name: string; level?: string }>>([]);
  const [schoolSubjects, setSchoolSubjects] = useState<string[]>([]);
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

  const motivationQuotes = [
    { quote: 'Great things are done by a series of small things brought together.', author: 'Vincent van Gogh' },
    { quote: 'Education is the most powerful weapon which you can use to change the world.', author: 'Nelson Mandela' },
    { quote: 'A good teacher can inspire hope, ignite the imagination, and instil a love of learning.', author: 'Brad Henry' },
    { quote: 'The beautiful thing about learning is that nobody can take it away from you.', author: 'B. B. King' },
    { quote: 'Success is the sum of small efforts, repeated day in and day out.', author: 'Robert Collier' },
    { quote: 'Every question you prepare is another opportunity for a learner to grow.', author: 'ROCKCRAFT' },
  ];

  useEffect(() => {
    if (!isGeneratingAI || generationStage !== 'working') return;
    const timer = window.setInterval(() => setMotivationIndex((index) => (index + 1) % motivationQuotes.length), 3200);
    return () => window.clearInterval(timer);
  }, [isGeneratingAI, generationStage]);

  useEffect(() => {
    if (guestSchool) {
      const classes = guestSchool.classes || [];
      const subjects = guestSchool.subjects || [];
      setSchoolClasses(classes.length ? classes : STANDARD_NIGERIAN_CLASSES.map((item) => ({ name: item.name, level: item.level })));
      setSchoolSubjects(subjects.length ? subjects : ALL_NIGERIAN_SUBJECTS);
      if (classes.length && !classes.some((item) => item.name === className)) setClassName(classes[0].name);
      if (subjects.length && !subjects.includes(subject)) setSubject(subjects[0]);
      return;
    }
    if (!school?.id || !isSupabaseConfigured()) {
      setSchoolClasses(STANDARD_NIGERIAN_CLASSES.map((item) => ({ name: item.name, level: item.level })));
      setSchoolSubjects(ALL_NIGERIAN_SUBJECTS);
      return;
    }
    let cancelled = false;
    const loadCurriculum = async () => {
      const [classResult, subjectResult] = await Promise.all([
        supabase.from('school_classes').select('name, level').eq('school_id', school.id).order('display_order', { ascending: true }),
        supabase.from('school_subjects').select('name').eq('school_id', school.id).eq('is_active', true).order('name', { ascending: true }),
      ]);
      if (cancelled) return;
      const classes = (classResult.data || []).map((item) => ({ name: item.name, level: item.level }));
      const subjects = (subjectResult.data || []).map((item) => item.name);
      const nextClasses = classes.length ? classes : STANDARD_NIGERIAN_CLASSES.map((item) => ({ name: item.name, level: item.level }));
      const nextSubjects = subjects.length ? subjects : ALL_NIGERIAN_SUBJECTS;
      setSchoolClasses(nextClasses);
      setSchoolSubjects(nextSubjects);
      if (!nextClasses.some((item) => item.name === className)) setClassName(nextClasses[0]?.name || '');
      if (!nextSubjects.includes(subject)) setSubject(nextSubjects[0] || '');
    };
    void loadCurriculum();
    return () => { cancelled = true; };
  }, [school?.id, guestSchool?.id]);

  const getAiAuthHeaders = async () => {
    if (!school?.id) throw new Error('A valid school account is required for AI question generation.');
    if (isGuestTeacher && guestInviteToken) {
      return {
        'Content-Type': 'application/json',
        'X-School-Invite-Token': guestInviteToken,
      };
    }
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token) throw new Error('Please sign in again before using AI question generation.');
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${session.access_token}`,
    };
  };

  const showNotification = (msg: string) => {
    setNotification(msg);
    setTimeout(() => setNotification(null), 3500);
  };

  // Step 1 Validation
  const handleStep1Next = async () => {
    if (!title.trim() || !subject.trim() || !className.trim() || !instructions.trim()) {
      setStepError('Complete the required exam details before continuing.'); return;
    }
    if (durationMinutes < 30 || durationMinutes > 240 || !Number.isFinite(durationMinutes)) {
      setStepError('Choose an exam duration between 30 and 240 minutes.'); return;
    }
    if (!session.trim()) { setStepError('Choose the academic session for this exam.'); return; }
    if (!school?.id) { setStepError('The school details could not be verified. Refresh the page or ask the school admin for a new link.'); return; }
    setStepError(null);
    try {
      if (isGuestTeacher && guestInviteToken) {
        const params = new URLSearchParams({ token: guestInviteToken, class_name: className, subject, term, session });
        const response = await fetch('/api/check-exam-conflict?' + params.toString());
        const result = await response.json();
        if (response.status === 409 || result.conflict) { setStepError(result.error || (className + ' already has a ' + subject + ' exam for ' + term + ', ' + session + '.')); return; }
        if (!response.ok) throw new Error(result.error || 'Could not check the class subject schedule.');
      } else if (isSupabaseConfigured()) {
        const { data, error } = await supabase.from('exams').select('id').eq('school_id', school.id).eq('status', 'published')
          .ilike('class_name', className).ilike('subject', subject).eq('term', term).eq('session', session).limit(1);
        if (error) throw error;
        if (data?.length) { setStepError(className + ' already has a ' + subject + ' exam for ' + term + ', ' + session + '. Choose a different subject, term or session.'); return; }
      }
      setCurrentStep(2);
    } catch (error) { setStepError(error instanceof Error ? error.message : 'Could not validate these exam details. Please try again.'); }
  };

  // Step 2 Choice
  const handleSelectMethod = (selected: 'ai' | 'manual') => {
    // The database is authoritative for quota checks at publication time.
    setMethod(selected);
    setCurrentStep(3);
  };

  // Step 3b AI Generation Handler
  const handleGenerateAI = async () => {
    if (!school) return;

    // Do not trust cached browser subscription counters here. The secure database
    // checks the current subscription and quota when the exam is published.

    setIsGeneratingAI(true);
    setGenerationStage('working');
    setMotivationIndex(0);
    setAiError(null);

    try {
      const response = await fetch('/api/generate-questions', {
        method: 'POST',
        headers: await getAiAuthHeaders(),
        body: JSON.stringify({
          school_id: school.id,
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

        if (parsedQuestions.length === 0) {
          throw new Error('The AI returned no usable questions. Please try again or use manual entry.');
        }
        setGenerationStage('finishing');
        await new Promise((resolve) => window.setTimeout(resolve, 1400));
        setQuestions(parsedQuestions);
        setCurrentStep(4);
        showNotification(`AI drafted ${parsedQuestions.length} questions with marking schemes.`);
      } else {
        setAiError(json.error || 'AI generation failed. You can switch to manual authoring or try again.');
      }
    } catch (e: any) {
      setAiError(e?.message || 'Network error while contacting AI engine. Try again or switch to manual.');
    } finally {
      setIsGeneratingAI(false);
      setGenerationStage(null);
    }
  };

  // REGENERATE A SINGLE QUESTION (Replaces only that question without touching the rest!)
  const handleRegenerateQuestion = async (targetQuestion: Question) => {
    setRegeneratingId(targetQuestion.id);
    try {
      const response = await fetch('/api/regenerate-single-question', {
        method: 'POST',
        headers: await getAiAuthHeaders(),
        body: JSON.stringify({
          school_id: school?.id,
          subject,
          class_name: className,
          section: targetQuestion.section,
          question_number: targetQuestion.question_number,
          topics: aiTopics,
        }),
      });

      const res = await response.json();
      if (!response.ok || !res.success) throw new Error(res.error || 'AI regeneration failed. Please try again.');
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

        setQuestions((current) => current.map((q) => (q.id === targetQuestion.id ? updatedQuestion : q)));
        showNotification(`Question ${targetQuestion.question_number} regenerated with AI!`);
      }
    } catch (error: any) {
      showNotification(error?.message || 'AI regeneration failed. Please try again.');
    } finally {
      setRegeneratingId(null);
    }
  };

  // Generate only the requested missing questions. The API accepts at most 20 per call,
  // so larger gaps are filled in small batches without replacing questions already accepted.
  const handleGenerateMoreQuestions = async (section: 'A' | 'B', countToAdd: number = 5) => {
    const requestedCount = Math.max(0, Math.floor(countToAdd));
    if (requestedCount === 0) {
      showNotification('You already have the requested number of questions.');
      return;
    }

    setIsAddingMore(true);
    let totalAdded = 0;
    let remaining = requestedCount;
    let attempts = 0;

    try {
      while (remaining > 0 && attempts < 5) {
        attempts += 1;
        const batchCount = Math.min(remaining, 20);
        const currentMaxNumber = questions
          .filter((q) => q.section === section)
          .reduce((max, q) => Math.max(max, q.question_number || 0), 0);
        // Each response is committed to state immediately so a later failed batch
        // never discards questions already generated (or wastes their tokens).
        const startNumber = currentMaxNumber + totalAdded + 1;
        const response = await fetch('/api/generate-more-questions', {
          method: 'POST',
          headers: await getAiAuthHeaders(),
          body: JSON.stringify({
            school_id: school?.id,
            subject,
            class_name: className,
            section,
            count: batchCount,
            start_number: startNumber,
            topics: aiTopics,
            difficulty: aiDifficulty,
            instructions,
            term,
          }),
        });

        const res = await response.json();
        if (!response.ok || !res.success || !Array.isArray(res.data)) {
          throw new Error(res.error || 'AI question generation failed. Please try again.');
        }

        const items = res.data.slice(0, batchCount);
        if (items.length === 0) {
          throw new Error('The AI returned no questions. Your existing questions have been kept; please try again.');
        }

        const newQs: Question[] = items.map((item: any, idx: number) => ({
          id: `q_more_${Date.now()}_${attempts}_${idx}`,
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

        setQuestions((current) => [...current, ...newQs]);
        totalAdded += newQs.length;
        remaining -= newQs.length;
      }

      if (remaining > 0) {
        showNotification(`Generated ${totalAdded} of ${requestedCount} requested questions. Your new questions are saved in the preview; use Generate Missing again to finish.`);
      } else {
        showNotification(`Added ${totalAdded} new ${section === 'A' ? 'objective' : 'theory'} questions.`);
      }
    } catch (error: any) {
      showNotification(`${error?.message || 'AI generation failed. Please try again.'}${totalAdded ? ` ${totalAdded} generated question(s) were kept.` : ''}`);
    } finally {
      setIsAddingMore(false);
    }
  };

  const handleGenerateToTarget = (section: 'A' | 'B') => {
    const target = section === 'A' ? aiNumObj : aiNumTheory;
    const existingCount = questions.filter((q) => q.section === section).length;
    if (target <= existingCount) {
      showNotification(`You already have ${existingCount} ${section === 'A' ? 'objective' : 'theory'} questions. Lowering the target will not delete existing questions.`);
      return;
    }
    void handleGenerateMoreQuestions(section, target - existingCount);
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
    setQuestions((current) => {
      const remaining = current.filter((q) => q.id !== id);
      // Keep section numbering contiguous after a teacher removes a question.
      return (['A', 'B'] as const).flatMap((section) =>
        remaining
          .filter((q) => q.section === section)
          .map((q, index) => ({ ...q, question_number: index + 1 })),
      );
    });
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
    if (!school || (!user?.id && !isGuestTeacher)) {
      alert('A valid school invitation or school account is required before publishing an exam.');
      return;
    }
    if (isSubmitting) return;
    setIsSubmitting(true);

    try {
      if (!isGuestTeacher && !isSupabaseConfigured()) {
        throw new Error('Secure publishing is unavailable because Supabase is not configured.');
      }

      // Exam rows, answers, marking schemes, and quota usage are committed together
      // by one PostgreSQL function. Any failed insert rolls back the entire publication.
      const examCode = `EC-${session.slice(0, 4)}-${subject.slice(0, 3).toUpperCase()}-${className.replace(/\\s+/g, '')}-${Date.now().toString().slice(-5)}`;
      const sectionAMarks = questions.filter((q) => q.section === 'A').reduce((acc, q) => acc + q.marks, 0);
      const sectionBMarks = questions.filter((q) => q.section === 'B').reduce((acc, q) => acc + q.marks, 0);

      const examPayload = {
        school_id: school.id,
        created_by: user?.id || '',
        created_by_name: user?.full_name || 'Teacher',
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
        status: 'published' as const,
      };

      let publishResult: Awaited<ReturnType<typeof publishExamWithQuota>>;
      if (isGuestTeacher && guestInviteToken) {
        const response = await fetch('/api/publish-exam', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-School-Invite-Token': guestInviteToken,
          },
          body: JSON.stringify({
            exam: examPayload,
            questions: questions.map((question, index) => ({
              section: question.section,
              question_number: question.question_number || index + 1,
              question_text: question.question_text,
              marks: question.marks,
              image_url: question.image_url || null,
              objective_data: question.objective_data || null,
              theory_data: question.theory_data || null,
            })),
            is_ai: method === 'ai',
          }),
        });
        const guestResult = await response.json();
        if (!response.ok || !guestResult?.success || !guestResult?.exam) {
          publishResult = {
            success: false,
            code: guestResult?.code,
            message: guestResult?.error || 'The exam could not be published. Please try again.',
          };
        } else {
          publishResult = { success: true, exam: guestResult.exam as Exam };
        }
      } else {
        publishResult = await publishExamWithQuota(examPayload, questions, method === 'ai');
      }

      if (!publishResult.success) {
        alert(publishResult.message || 'Your exam could not be published.');
        if (publishResult.code === 'quota_exceeded') {
          if (role === 'teacher') showNotification('The school exam limit has been reached. Please ask your school admin to upgrade the plan.');
          else onOpenPaystack();
        }
        return;
      }

      const newExam = publishResult.exam;

      // Start both downloads from the publish action; avoid a delayed second download
      // that mobile browsers may block.
      try {
        await exportExamToDocx(newExam, school);
        await exportMarkingSchemeToDocx(newExam, school);
      } catch (error) {
        console.warn('Automatic exam or marking scheme download failed', error);
        showNotification('Exam saved. If a download was blocked, use the success screen to download it again.');
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

  if (isGeneratingAI) {
    const quote = motivationQuotes[motivationIndex];
    const finishing = generationStage === 'finishing';
    return (
      <div className="fixed inset-0 z-[100] flex min-h-[100dvh] items-center justify-center overflow-hidden bg-[#07152f] px-5 text-center text-white">
        <div className="absolute -left-24 -top-24 h-72 w-72 rounded-full bg-blue-500/20 blur-3xl" />
        <div className="absolute -bottom-28 -right-20 h-80 w-80 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="relative mx-auto flex w-full max-w-xl flex-col items-center">
          <div className="mb-10 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-white/10 ring-1 ring-white/15"><BookOpen className="h-5 w-5 text-blue-200" /></div>
            <span className="text-2xl font-black tracking-tight sm:text-3xl">ROCKCRAFT</span>
          </div>
          <div className="mb-7 flex h-20 w-20 items-center justify-center rounded-full border border-white/15 bg-white/5">
            {finishing ? <CheckCircle2 className="h-10 w-10 text-emerald-300" /> : <Loader2 className="h-10 w-10 animate-spin text-blue-200" />}
          </div>
          <p className="text-[11px] font-bold uppercase tracking-[0.28em] text-blue-200">{finishing ? 'Almost ready' : 'Preparing your examination'}</p>
          <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-5xl">{finishing ? "It's well." : 'Good things take preparation.'}</h1>
          <div className="mt-6 min-h-28 max-w-lg">
            <p key={finishing ? 'finish' : motivationIndex} className="text-lg leading-8 text-slate-100 sm:text-xl animate-in fade-in">
              {finishing ? 'Your questions and marking scheme are ready. Let’s review your paper.' : '“' + quote.quote + '”'}
            </p>
            {!finishing && <p className="mt-3 text-xs font-semibold uppercase tracking-widest text-blue-200">{quote.author}</p>}
          </div>
          <div className="mt-10 h-1.5 w-56 overflow-hidden rounded-full bg-white/10"><div className={'h-full rounded-full bg-gradient-to-r from-sky-300 to-indigo-300 ' + (finishing ? 'w-full' : 'w-2/3 animate-pulse')} /></div>
          <p className="mt-4 text-xs text-slate-300">{finishing ? 'Opening your preview…' : 'Creating thoughtful questions and marking guidance. Please keep this page open.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4 text-left pb-8">
      {/* Toast Notification */}
      {notification && (
        <div className="fixed top-16 left-1/2 -translate-x-1/2 z-50 bg-slate-900 text-white text-xs font-semibold px-4 py-2.5 rounded-2xl shadow-xl flex items-center gap-2 animate-in fade-in slide-in-from-top-4">
          <CheckCircle2 className="w-4 h-4 text-emerald-400" />
          <span>{notification}</span>
        </div>
      )}

      {/* Wizard Progress Stepper */}
      <div className="bg-white rounded-2xl p-3 sm:p-4 border border-slate-200/80 shadow-xs">
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
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in">
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
                {schoolSubjects.map((sub) => (
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
                {schoolClasses.map((cls) => (
                  <option key={cls.name} value={cls.name}>
                    {cls.name}
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
        <div className="bg-white rounded-2xl p-4 sm:p-5 border border-slate-200/80 shadow-xs space-y-4 animate-in fade-in">
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
                  if (role === 'teacher') showNotification('The school exam limit has been reached. Please ask your school admin to upgrade the plan.');
                  else onOpenPaystack();
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
              onClick={() => {
                const missing = questions.find((question) => !question.question_text.trim());
                if (questions.length === 0 || missing) {
                  setStepError('Add at least one question and complete every question text before previewing.');
                  return;
                }
                setStepError(null);
                setCurrentStep(4);
              }}
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

          {/* Target counts let teachers fill only the missing questions without discarding accepted work. */}
          <div className="p-4 rounded-2xl bg-gradient-to-r from-blue-50 via-indigo-50/40 to-slate-50 border border-blue-200/70 space-y-3">
            <div className="flex items-start gap-2">
              <div className="w-7 h-7 shrink-0 rounded-lg bg-blue-600 text-white flex items-center justify-center text-xs font-bold">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <p className="text-xs font-bold text-blue-950">Adjust question totals</p>
                <p className="text-xs text-slate-600 mt-1">Choose the total number you want. We generate only the missing questions and keep the ones you have already reviewed. Regenerating one question never replaces the rest.</p>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="bg-white/80 border border-blue-100 rounded-xl p-3 space-y-2">
                <label htmlFor="target-objectives" className="block text-xs font-semibold text-slate-700">Objective questions (Section A)</label>
                <div className="flex items-center gap-2">
                  <input
                    id="target-objectives"
                    type="number"
                    min={5}
                    max={50}
                    value={aiNumObj}
                    onChange={(event) => setAiNumObj(Math.min(50, Math.max(5, Number(event.target.value) || 5)))}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    aria-label="Target total objective questions"
                  />
                  <span className="text-xs text-slate-500">{questions.filter((q) => q.section === 'A').length} currently in preview</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateToTarget('A')}
                  disabled={isAddingMore || aiNumObj <= questions.filter((q) => q.section === 'A').length}
                  className="w-full px-3 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white font-semibold text-xs disabled:opacity-50"
                >
                  {isAddingMore ? 'Generating questions...' : `Generate ${Math.max(0, aiNumObj - questions.filter((q) => q.section === 'A').length)} missing objective(s)`}
                </button>
              </div>

              <div className="bg-white/80 border border-indigo-100 rounded-xl p-3 space-y-2">
                <label htmlFor="target-theory" className="block text-xs font-semibold text-slate-700">Theory questions (Section B)</label>
                <div className="flex items-center gap-2">
                  <input
                    id="target-theory"
                    type="number"
                    min={1}
                    max={6}
                    value={aiNumTheory}
                    onChange={(event) => setAiNumTheory(Math.min(6, Math.max(1, Number(event.target.value) || 1)))}
                    className="w-24 rounded-lg border border-slate-300 px-3 py-2 text-sm"
                    aria-label="Target total theory questions"
                  />
                  <span className="text-xs text-slate-500">{questions.filter((q) => q.section === 'B').length} currently in preview</span>
                </div>
                <button
                  type="button"
                  onClick={() => handleGenerateToTarget('B')}
                  disabled={isAddingMore || aiNumTheory <= questions.filter((q) => q.section === 'B').length}
                  className="w-full px-3 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs disabled:opacity-50"
                >
                  {isAddingMore ? 'Generating questions...' : `Generate ${Math.max(0, aiNumTheory - questions.filter((q) => q.section === 'B').length)} missing theory question(s)`}
                </button>
              </div>
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
