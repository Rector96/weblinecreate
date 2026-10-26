export type UserRole = 'school_admin' | 'teacher' | 'platform_admin' | 'customer_care';

export type InstitutionType = 'Secondary' | 'Comprehensive' | 'College' | 'International' | 'Technical' | 'Primary & Secondary';

export interface School {
  id: string;
  name: string;
  admin_name: string;
  email: string;
  phone: string;
  state: string;
  lga: string;
  institution_type: InstitutionType;
  logo_url?: string;
  motto?: string;
  address?: string;
  subscription_status: 'trial' | 'active' | 'expired';
  subscription_expires_at?: string;
  ai_exams_used: number;
  manual_exams_used: number;
  max_trial_ai_exams: number;
  max_trial_manual_exams: number;
  created_at: string;
  // Available only on a validated passwordless school-invite response.
  classes?: Array<{ id?: string; name: string; level?: string; display_order?: number }>;
  subjects?: string[];
}

export interface UserProfile {
  id: string;
  user_id: string;
  full_name: string;
  email: string;
  school_id: string | null;
  phone?: string;
  avatar_url?: string;
  is_profile_completed: boolean;
  role: UserRole;
  created_at: string;
}

export interface SchoolClass {
  id: string;
  school_id: string;
  name: string; // e.g. "SSS 2", "JSS 1"
  level: 'Junior' | 'Senior';
  arms?: string[]; // e.g. ["A", "B", "Gold", "Diamond"]
  display_order: number;
  created_at: string;
}

export interface InviteLink {
  id: string;
  school_id: string;
  token: string; // 6-character uppercase
  role: UserRole;
  created_by: string;
  is_active: boolean;
  expires_at?: string;
  created_at: string;
}

export type ExamTerm = 'First Term' | 'Second Term' | 'Third Term';

export interface Exam {
  id: string;
  school_id: string;
  created_by: string;
  created_by_name?: string;
  exam_code: string; // e.g. "EC-2026-MATH-01"
  title: string; // e.g. "First Term Promotional Examination"
  subject: string; // e.g. "Mathematics", "English Language"
  class_id?: string;
  class_name: string; // e.g. "SSS 3"
  term: ExamTerm;
  session: string; // e.g. "2025/2026"
  duration_minutes: number; // e.g. 90
  instructions: string; // e.g. "Answer all questions in Section A and any four questions in Section B."
  total_marks: number;
  section_a_marks: number;
  section_b_marks: number;
  status: 'draft' | 'published';
  is_offline_draft?: boolean;
  created_at: string;
  questions?: Question[];
}

export interface ObjectiveAnswer {
  id?: string;
  question_id?: string;
  option_a: string;
  option_b: string;
  option_c: string;
  option_d: string;
  correct_option: 'A' | 'B' | 'C' | 'D';
}

export interface TheoryMarkingScheme {
  id?: string;
  question_id?: string;
  model_answer: string;
  score_breakdown: string; // e.g. "Formula: 1 mk, Substitution: 2 mks, Correct Answer: 1 mk"
  max_score: number;
}

export interface Question {
  id: string;
  exam_id?: string;
  section: 'A' | 'B'; // A = Objective, B = Theory
  question_number: number;
  question_text: string;
  marks: number;
  image_url?: string;
  objective_data?: ObjectiveAnswer;
  theory_data?: TheoryMarkingScheme;
  created_at?: string;
}

export interface AIGenerationParams {
  subject: string;
  class_name: string;
  term: ExamTerm;
  topics: string;
  num_objectives: number; // max 25 on trial
  num_theories: number;
  difficulty: 'Standard WAEC/JAMB' | 'Foundational / Basic' | 'Advanced / Rigorous';
  instructions?: string;
}

export interface PaymentTransaction {
  id: string;
  school_id: string;
  school_name: string;
  amount_ngn: number;
  reference: string;
  status: 'success' | 'pending' | 'failed';
  term: ExamTerm;
  session: string;
  paid_at: string;
  channel?: string;
}
