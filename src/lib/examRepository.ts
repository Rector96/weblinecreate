import { Exam, Question, ObjectiveAnswer, TheoryMarkingScheme } from '../types';
import { isSupabaseConfigured, supabase } from './supabase';

type ExamRow = {
  id: string;
  school_id: string;
  created_by: string | null;
  created_by_name: string | null;
  exam_code: string;
  title: string;
  subject: string;
  class_id: string | null;
  class_name: string;
  term: Exam['term'];
  session: string;
  duration_minutes: number;
  instructions: string;
  total_marks: number;
  section_a_marks: number;
  section_b_marks: number;
  status: Exam['status'];
  created_at: string;
};

const ensureConfigured = () => {
  if (!isSupabaseConfigured()) {
    throw new Error('Supabase is not configured. Exam data was not saved locally.');
  }
};

export async function listSchoolExams(schoolId: string): Promise<Exam[]> {
  ensureConfigured();
  const { data: examRows, error: examError } = await supabase
    .from('exams')
    .select('*')
    .eq('school_id', schoolId)
    .order('created_at', { ascending: false });
  if (examError) throw examError;
  if (!examRows?.length) return [];

  const examIds = examRows.map((row) => row.id);
  const { data: questionRows, error: questionError } = await supabase
    .from('questions')
    .select('*')
    .in('exam_id', examIds)
    .order('question_number', { ascending: true });
  if (questionError) throw questionError;

  const questions = questionRows || [];
  const questionIds = questions.map((row) => row.id);
  let objectiveRows: any[] = [];
  let theoryRows: any[] = [];

  if (questionIds.length) {
    const [objectives, theories] = await Promise.all([
      supabase.from('objective_answers').select('*').in('question_id', questionIds),
      supabase.from('theory_marking_schemes').select('*').in('question_id', questionIds),
    ]);
    if (objectives.error) throw objectives.error;
    if (theories.error) throw theories.error;
    objectiveRows = objectives.data || [];
    theoryRows = theories.data || [];
  }

  return (examRows as ExamRow[]).map((row) => ({
    id: row.id,
    school_id: row.school_id,
    created_by: row.created_by || '',
    created_by_name: row.created_by_name || 'Staff',
    exam_code: row.exam_code,
    title: row.title,
    subject: row.subject,
    class_id: row.class_id || undefined,
    class_name: row.class_name,
    term: row.term,
    session: row.session,
    duration_minutes: row.duration_minutes,
    instructions: row.instructions,
    total_marks: row.total_marks,
    section_a_marks: row.section_a_marks,
    section_b_marks: row.section_b_marks,
    status: row.status,
    created_at: row.created_at,
    questions: questions
      .filter((question) => question.exam_id === row.id)
      .map((question) => {
        const objective = objectiveRows.find((item) => item.question_id === question.id);
        const theory = theoryRows.find((item) => item.question_id === question.id);
        const objectiveData: ObjectiveAnswer | undefined = objective ? {
          id: objective.id,
          question_id: objective.question_id,
          option_a: objective.option_a,
          option_b: objective.option_b,
          option_c: objective.option_c,
          option_d: objective.option_d,
          correct_option: objective.correct_option,
        } : undefined;
        const theoryData: TheoryMarkingScheme | undefined = theory ? {
          id: theory.id,
          question_id: theory.question_id,
          model_answer: theory.model_answer,
          score_breakdown: theory.score_breakdown,
          max_score: Number(theory.max_score),
        } : undefined;
        return {
          id: question.id,
          exam_id: question.exam_id,
          section: question.section,
          question_number: question.question_number,
          question_text: question.question_text,
          marks: Number(question.marks),
          image_url: question.image_url || undefined,
          created_at: question.created_at,
          objective_data: objectiveData,
          theory_data: theoryData,
        } as Question;
      }),
  }));
}

export async function saveExamToSupabase(
  examData: Omit<Exam, 'id' | 'created_at'> & { id?: string },
  questions: Question[],
): Promise<Exam> {
  ensureConfigured();
  const examInsert = {
    school_id: examData.school_id,
    created_by: examData.created_by || null,
    created_by_name: examData.created_by_name || null,
    exam_code: examData.exam_code,
    title: examData.title,
    subject: examData.subject,
    class_id: examData.class_id || null,
    class_name: examData.class_name,
    term: examData.term,
    session: examData.session,
    duration_minutes: examData.duration_minutes,
    instructions: examData.instructions,
    total_marks: examData.total_marks,
    section_a_marks: examData.section_a_marks,
    section_b_marks: examData.section_b_marks,
    status: examData.status,
  };

  const { data: savedRow, error: saveError } = await supabase
    .from('exams')
    .insert(examInsert)
    .select('*')
    .single();
  if (saveError || !savedRow) throw saveError || new Error('Supabase did not return the saved exam.');

  try {
    const questionInserts = questions.map((question, index) => ({
      exam_id: savedRow.id,
      school_id: examData.school_id,
      section: question.section,
      question_number: index + 1,
      question_text: question.question_text,
      marks: question.marks,
      image_url: question.image_url || null,
    }));

    let savedQuestions: any[] = [];
    if (questionInserts.length) {
      const { data, error } = await supabase.from('questions').insert(questionInserts).select('*');
      if (error) throw error;
      savedQuestions = data || [];
      if (savedQuestions.length !== questionInserts.length) {
        throw new Error('Not all exam questions were saved. Please retry.');
      }
    }

    const objectiveInserts: any[] = [];
    const theoryInserts: any[] = [];
    savedQuestions.forEach((savedQuestion, index) => {
      const source = questions[index];
      if (source.section === 'A' && source.objective_data) {
        objectiveInserts.push({
          question_id: savedQuestion.id,
          option_a: source.objective_data.option_a,
          option_b: source.objective_data.option_b,
          option_c: source.objective_data.option_c,
          option_d: source.objective_data.option_d,
          correct_option: source.objective_data.correct_option,
        });
      }
      if (source.section === 'B' && source.theory_data) {
        theoryInserts.push({
          question_id: savedQuestion.id,
          model_answer: source.theory_data.model_answer,
          score_breakdown: source.theory_data.score_breakdown,
          max_score: source.theory_data.max_score,
        });
      }
    });

    if (objectiveInserts.length) {
      const { error } = await supabase.from('objective_answers').insert(objectiveInserts);
      if (error) throw error;
    }
    if (theoryInserts.length) {
      const { error } = await supabase.from('theory_marking_schemes').insert(theoryInserts);
      if (error) throw error;
    }

    return {
      ...examData,
      id: savedRow.id,
      created_at: savedRow.created_at,
      questions: savedQuestions.map((savedQuestion, index) => ({
        ...questions[index],
        id: savedQuestion.id,
        exam_id: savedRow.id,
        question_number: savedQuestion.question_number,
        created_at: savedQuestion.created_at,
      })),
    };
  } catch (error) {
    // Keep partial exams out of the repository if a child record fails to save.
    await supabase.from('exams').delete().eq('id', savedRow.id).eq('school_id', examData.school_id);
    throw error;
  }
}

export async function deleteExamFromSupabase(examId: string, schoolId: string): Promise<void> {
  ensureConfigured();
  const { error } = await supabase
    .from('exams')
    .delete()
    .eq('id', examId)
    .eq('school_id', schoolId);
  if (error) throw error;
}


export type PublishExamResult =
  | { success: true; exam: Exam }
  | { success: false; code?: string; message: string };

export async function publishExamWithQuota(
  examData: Omit<Exam, 'id' | 'created_at'> & { id?: string },
  questions: Question[],
  isAI: boolean,
): Promise<PublishExamResult> {
  ensureConfigured();

  const examPayload = {
    school_id: examData.school_id,
    created_by_name: examData.created_by_name || null,
    exam_code: examData.exam_code,
    title: examData.title,
    subject: examData.subject,
    class_id: examData.class_id || null,
    class_name: examData.class_name,
    term: examData.term,
    session: examData.session,
    duration_minutes: examData.duration_minutes,
    instructions: examData.instructions,
    total_marks: examData.total_marks,
    section_a_marks: examData.section_a_marks,
    section_b_marks: examData.section_b_marks,
  };
  const questionPayload = questions.map((question, index) => ({
    section: question.section,
    question_number: question.question_number || index + 1,
    question_text: question.question_text,
    marks: question.marks,
    image_url: question.image_url || null,
    objective_data: question.objective_data || null,
    theory_data: question.theory_data || null,
  }));

  const { data, error } = await supabase.rpc('publish_exam_with_quota', {
    p_exam: examPayload,
    p_questions: questionPayload,
    p_is_ai: isAI,
  });
  if (error) {
    console.error('Atomic exam publication failed', error);
    if (error.message?.toLowerCase().includes('already has an exam for this subject')) {
      throw new Error(error.message);
    }
    const diagnostic = [error.message, (error as { code?: string }).code ? `Code: ${(error as { code?: string }).code}` : ''].filter(Boolean).join(' — ');
    throw new Error(`Exam publication failed: ${diagnostic || 'The database rejected the request.'}`);
  }

  const result = data as {
    success?: boolean;
    code?: string;
    message?: string;
    exam?: ExamRow;
    questions?: Question[];
  } | null;

  if (!result?.success) {
    return {
      success: false,
      code: result?.code,
      message: result?.message || 'The exam could not be published.',
    };
  }
  if (!result.exam || !Array.isArray(result.questions)) {
    throw new Error('The database did not return the saved exam details.');
  }

  const row = result.exam;
  return {
    success: true,
    exam: {
      id: row.id,
      school_id: row.school_id,
      created_by: row.created_by || '',
      created_by_name: row.created_by_name || 'Staff',
      exam_code: row.exam_code,
      title: row.title,
      subject: row.subject,
      class_id: row.class_id || undefined,
      class_name: row.class_name,
      term: row.term,
      session: row.session,
      duration_minutes: row.duration_minutes,
      instructions: row.instructions,
      total_marks: row.total_marks,
      section_a_marks: row.section_a_marks,
      section_b_marks: row.section_b_marks,
      status: row.status,
      created_at: row.created_at,
      questions: result.questions.map((question) => ({
        ...question,
        marks: Number(question.marks),
        objective_data: question.objective_data ? {
          ...question.objective_data,
          question_id: question.id,
        } : undefined,
        theory_data: question.theory_data ? {
          ...question.theory_data,
          max_score: Number(question.theory_data.max_score),
          question_id: question.id,
        } : undefined,
      })),
    },
  };
}
