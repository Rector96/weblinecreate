import {
  School,
  UserProfile,
  SchoolClass,
  InviteLink,
  Exam,
  Question,
  PaymentTransaction,
  UserRole
} from '../types';

const STORAGE_KEYS = {
  SCHOOLS: 'examcraft_schools',
  PROFILES: 'examcraft_profiles',
  CLASSES: 'examcraft_classes',
  INVITES: 'examcraft_invites',
  EXAMS: 'examcraft_exams',
  QUESTIONS: 'examcraft_questions',
  PAYMENTS: 'examcraft_payments',
  OFFLINE_DRAFTS: 'examcraft_offline_drafts',
};

// Simple event emitter for DB changes
type Listener = () => void;
class DbEventEmitter {
  private listeners: Map<string, Listener[]> = new Map();

  subscribe(event: string, fn: Listener) {
    const list = this.listeners.get(event) || [];
    list.push(fn);
    this.listeners.set(event, list);
    return () => {
      const updated = (this.listeners.get(event) || []).filter((l) => l !== fn);
      this.listeners.set(event, updated);
    };
  }

  notify(event: string) {
    const list = this.listeners.get(event) || [];
    list.forEach((fn) => fn());
  }
}

export const dbEvents = new DbEventEmitter();

// Initial seed data
const DEFAULT_SCHOOL_ID = 'sch_kings_college_lagos';
const DEFAULT_ADMIN_ID = 'usr_admin_lagos';
const DEFAULT_TEACHER_ID = 'usr_teacher_adebayo';
const PLATFORM_ADMIN_EMAIL = 'peteroche32@gmail.com';

const INITIAL_SCHOOLS: School[] = [
  {
    id: DEFAULT_SCHOOL_ID,
    name: "King's College Lagos",
    admin_name: 'Dr. Babatunde Alabi',
    email: 'principal@kingscollege.edu.ng',
    phone: '08031234567',
    state: 'Lagos',
    lga: 'Lagos Island',
    institution_type: 'College',
    logo_url: '',
    motto: 'Floreat Collegium (Let the College Flourish)',
    address: '3 Catholic Mission Street, Lagos Island, Lagos',
    subscription_status: 'trial',
    ai_exams_used: 1,
    manual_exams_used: 1,
    max_trial_ai_exams: 3,
    max_trial_manual_exams: 5,
    created_at: new Date(Date.now() - 7 * 86400000).toISOString(),
  },
  {
    id: 'sch_queens_college_yaba',
    name: "Queen's College Yaba",
    admin_name: 'Mrs. Folake Adeyemi',
    email: 'admin@queenscollege.sch.ng',
    phone: '08029876543',
    state: 'Lagos',
    lga: 'Lagos Mainland',
    institution_type: 'College',
    motto: 'Pass on the Torch',
    address: 'Yaba, Lagos State',
    subscription_status: 'active',
    subscription_expires_at: new Date(Date.now() + 60 * 86400000).toISOString(),
    ai_exams_used: 8,
    manual_exams_used: 14,
    max_trial_ai_exams: 3,
    max_trial_manual_exams: 5,
    created_at: new Date(Date.now() - 30 * 86400000).toISOString(),
  }
];

const INITIAL_CLASSES: SchoolClass[] = [
  { id: 'cls_1', school_id: DEFAULT_SCHOOL_ID, name: 'JSS 1', level: 'Junior', arms: ['Gold', 'Silver'], display_order: 1, created_at: new Date().toISOString() },
  { id: 'cls_2', school_id: DEFAULT_SCHOOL_ID, name: 'JSS 2', level: 'Junior', arms: ['Gold', 'Silver'], display_order: 2, created_at: new Date().toISOString() },
  { id: 'cls_3', school_id: DEFAULT_SCHOOL_ID, name: 'JSS 3', level: 'Junior', arms: ['Gold', 'Silver'], display_order: 3, created_at: new Date().toISOString() },
  { id: 'cls_4', school_id: DEFAULT_SCHOOL_ID, name: 'SSS 1', level: 'Senior', arms: ['Science', 'Arts', 'Comm'], display_order: 4, created_at: new Date().toISOString() },
  { id: 'cls_5', school_id: DEFAULT_SCHOOL_ID, name: 'SSS 2', level: 'Senior', arms: ['Science', 'Arts', 'Comm'], display_order: 5, created_at: new Date().toISOString() },
  { id: 'cls_6', school_id: DEFAULT_SCHOOL_ID, name: 'SSS 3', level: 'Senior', arms: ['Science', 'Arts', 'Comm'], display_order: 6, created_at: new Date().toISOString() },
];

const INITIAL_EXAMS: Exam[] = [
  {
    id: 'ex_waec_math_2026',
    school_id: DEFAULT_SCHOOL_ID,
    created_by: DEFAULT_ADMIN_ID,
    created_by_name: 'Dr. Babatunde Alabi',
    exam_code: 'KC-2026-MTH-S3',
    title: 'First Term Mock WAEC Examination',
    subject: 'Mathematics',
    class_name: 'SSS 3',
    term: 'First Term',
    session: '2025/2026',
    duration_minutes: 120,
    instructions: 'SECTION A: Answer all questions. Each question carries 1 mark.\nSECTION B: Answer any FOUR questions. Show full working for each step.',
    total_marks: 100,
    section_a_marks: 40,
    section_b_marks: 60,
    status: 'published',
    created_at: new Date(Date.now() - 2 * 86400000).toISOString(),
  },
  {
    id: 'ex_basic_sci_jss2',
    school_id: DEFAULT_SCHOOL_ID,
    created_by: DEFAULT_TEACHER_ID,
    created_by_name: 'Mr. Adebayo Oladipo',
    exam_code: 'KC-2026-BSC-J2',
    title: 'Continuous Assessment & Examination',
    subject: 'Basic Science',
    class_name: 'JSS 2',
    term: 'First Term',
    session: '2025/2026',
    duration_minutes: 60,
    instructions: 'SECTION A: Answer all objective questions.\nSECTION B: Answer THREE questions only.',
    total_marks: 60,
    section_a_marks: 30,
    section_b_marks: 30,
    status: 'published',
    created_at: new Date(Date.now() - 4 * 86400000).toISOString(),
  }
];

const INITIAL_QUESTIONS: Question[] = [
  {
    id: 'q_mth_1',
    exam_id: 'ex_waec_math_2026',
    section: 'A',
    question_number: 1,
    question_text: 'If log₁₀ 2 = 0.3010 and log₁₀ 3 = 0.4771, evaluate log₁₀ 18 without using mathematical tables.',
    marks: 1,
    objective_data: {
      option_a: '1.2552',
      option_b: '0.7781',
      option_c: '1.1761',
      option_d: '0.9542',
      correct_option: 'A',
    }
  },
  {
    id: 'q_mth_2',
    exam_id: 'ex_waec_math_2026',
    section: 'A',
    question_number: 2,
    question_text: 'Solve for x in the quadratic equation 2x² - 5x - 3 = 0.',
    marks: 1,
    objective_data: {
      option_a: 'x = 3 or x = -1/2',
      option_b: 'x = -3 or x = 1/2',
      option_c: 'x = 2 or x = -3/2',
      option_d: 'x = 1 or x = 3',
      correct_option: 'A',
    }
  },
  {
    id: 'q_mth_3',
    exam_id: 'ex_waec_math_2026',
    section: 'A',
    question_number: 3,
    question_text: 'The angle of elevation of the top of a vertical tower from a point on the ground 30m away from its base is 45°. Find the height of the tower.',
    marks: 1,
    objective_data: {
      option_a: '15 m',
      option_b: '30 m',
      option_c: '42.4 m',
      option_d: '60 m',
      correct_option: 'B',
    }
  },
  {
    id: 'q_mth_theory_1',
    exam_id: 'ex_waec_math_2026',
    section: 'B',
    question_number: 1,
    question_text: '(a) A cylindrical water tank of radius 1.4m and height 3m is open at the top. Calculate to 2 decimal places:\n(i) the curved surface area of the tank [Take π = 22/7]\n(ii) the total capacity of the tank in litres.\n(b) If water is pumped into the tank at a rate of 250 litres per minute, how long will it take to fill the empty tank completely?',
    marks: 15,
    theory_data: {
      model_answer: '(a)(i) Curved Surface Area = 2πrh = 2 × (22/7) × 1.4 × 3 = 26.4 m².\n(ii) Volume = πr²h = (22/7) × 1.4 × 1.4 × 3 = 18.48 m³. Since 1 m³ = 1,000 litres, capacity = 18,480 litres.\n(b) Time taken = Total Volume / Rate = 18,480 / 250 = 73.92 minutes (approx 1 hour 14 minutes).',
      score_breakdown: 'Formula for CSA: 1 mk; Substitution & correct value 26.4m²: 3 mks; Volume formula: 1 mk; Capacity in litres (18,480 L): 4 mks; Time calculation formula: 2 mks; Correct final duration 73.92 mins: 4 mks.',
      max_score: 15
    }
  },
  {
    id: 'q_mth_theory_2',
    exam_id: 'ex_waec_math_2026',
    section: 'B',
    question_number: 2,
    question_text: '(a) Make t the subject of the relation: P = (3t + 4m) / (2t - k).\n(b) In an Arithmetic Progression (A.P.), the 4th term is 15 and the 9th term is 35. Find:\n(i) the first term and the common difference\n(ii) the sum of the first 20 terms.',
    marks: 15,
    theory_data: {
      model_answer: '(a) P(2t - k) = 3t + 4m => 2Pt - Pk = 3t + 4m => 2Pt - 3t = 4m + Pk => t(2P - 3) = 4m + Pk => t = (4m + Pk)/(2P - 3).\n(b)(i) a + 3d = 15; a + 8d = 35. Subtracting gives 5d = 20 => d = 4. a + 3(4) = 15 => a = 3.\n(ii) S₂₀ = 20/2 [2(3) + (19)(4)] = 10 [6 + 76] = 10 × 82 = 820.',
      score_breakdown: 'Cross multiplication & factorization: 3 mks; Correct expression for t: 2 mks; Simultaneous linear equations set-up: 2 mks; d = 4: 2 mks; a = 3: 1 mk; Sum formula: 2 mks; Final sum = 820: 3 mks.',
      max_score: 15
    }
  }
];

function readStorage<T>(key: string, defaultVal: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return defaultVal;
    return JSON.parse(raw);
  } catch {
    return defaultVal;
  }
}

function writeStorage<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.error('Storage write error', e);
  }
}

// Seed if not exists
export function initializeDatabase() {
  if (!localStorage.getItem(STORAGE_KEYS.SCHOOLS)) {
    writeStorage(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.CLASSES)) {
    writeStorage(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
  }
  if (!localStorage.getItem(STORAGE_KEYS.EXAMS)) {
    writeStorage(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.QUESTIONS)) {
    writeStorage(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS);
  }
  if (!localStorage.getItem(STORAGE_KEYS.INVITES)) {
    writeStorage(STORAGE_KEYS.INVITES, [
      {
        id: 'inv_1',
        school_id: DEFAULT_SCHOOL_ID,
        token: 'KC2026',
        role: 'teacher' as UserRole,
        created_by: DEFAULT_ADMIN_ID,
        is_active: true,
        created_at: new Date().toISOString(),
      }
    ]);
  }
}

// Ensure DB is seeded on module load
initializeDatabase();

export const db = {
  // SCHOOLS
  getSchools(): School[] {
    return readStorage<School[]>(STORAGE_KEYS.SCHOOLS, INITIAL_SCHOOLS);
  },

  getSchool(id: string): School | null {
    const schools = this.getSchools();
    return schools.find((s) => s.id === id) || null;
  },

  createSchool(schoolData: Omit<School, 'id' | 'created_at' | 'ai_exams_used' | 'manual_exams_used' | 'max_trial_ai_exams' | 'max_trial_manual_exams' | 'subscription_status'>): School {
    const schools = this.getSchools();
    const newSchool: School = {
      ...schoolData,
      id: `sch_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      subscription_status: 'trial',
      ai_exams_used: 0,
      manual_exams_used: 0,
      max_trial_ai_exams: 3,
      max_trial_manual_exams: 5,
      created_at: new Date().toISOString(),
    };
    schools.push(newSchool);
    writeStorage(STORAGE_KEYS.SCHOOLS, schools);

    // Seed default standard classes for this new school automatically!
    const classes = this.getClasses(newSchool.id);
    if (classes.length === 0) {
      const defaultClasses: SchoolClass[] = [
        { id: `cls_${Date.now()}_1`, school_id: newSchool.id, name: 'JSS 1', level: 'Junior', display_order: 1, created_at: new Date().toISOString() },
        { id: `cls_${Date.now()}_2`, school_id: newSchool.id, name: 'JSS 2', level: 'Junior', display_order: 2, created_at: new Date().toISOString() },
        { id: `cls_${Date.now()}_3`, school_id: newSchool.id, name: 'JSS 3', level: 'Junior', display_order: 3, created_at: new Date().toISOString() },
        { id: `cls_${Date.now()}_4`, school_id: newSchool.id, name: 'SSS 1', level: 'Senior', display_order: 4, created_at: new Date().toISOString() },
        { id: `cls_${Date.now()}_5`, school_id: newSchool.id, name: 'SSS 2', level: 'Senior', display_order: 5, created_at: new Date().toISOString() },
        { id: `cls_${Date.now()}_6`, school_id: newSchool.id, name: 'SSS 3', level: 'Senior', display_order: 6, created_at: new Date().toISOString() },
      ];
      const allCls = readStorage<SchoolClass[]>(STORAGE_KEYS.CLASSES, []);
      writeStorage(STORAGE_KEYS.CLASSES, [...allCls, ...defaultClasses]);
    }

    dbEvents.notify('schools');
    return newSchool;
  },

  updateSchool(id: string, updates: Partial<School>): School | null {
    const schools = this.getSchools();
    const idx = schools.findIndex((s) => s.id === id);
    if (idx === -1) return null;
    schools[idx] = { ...schools[idx], ...updates };
    writeStorage(STORAGE_KEYS.SCHOOLS, schools);
    dbEvents.notify('schools');
    return schools[idx];
  },

  deleteSchool(id: string): boolean {
    const schools = this.getSchools().filter((s) => s.id !== id);
    writeStorage(STORAGE_KEYS.SCHOOLS, schools);
    dbEvents.notify('schools');
    return true;
  },

  consumeTrial(schoolId: string, isAI: boolean): { success: boolean; message?: string } {
    const school = this.getSchool(schoolId);
    if (!school) return { success: false, message: 'School not found' };

    if (school.subscription_status === 'active') {
      // Unlimited for active paid subscribers!
      if (isAI) {
        this.updateSchool(schoolId, { ai_exams_used: school.ai_exams_used + 1 });
      } else {
        this.updateSchool(schoolId, { manual_exams_used: school.manual_exams_used + 1 });
      }
      return { success: true };
    }

    if (isAI) {
      if (school.ai_exams_used >= school.max_trial_ai_exams) {
        return {
          success: false,
          message: `Trial limit reached (${school.max_trial_ai_exams}/${school.max_trial_ai_exams} AI exams used). Please subscribe for ₦11,000/term to generate unlimited exams.`
        };
      }
      this.updateSchool(schoolId, { ai_exams_used: school.ai_exams_used + 1 });
    } else {
      if (school.manual_exams_used >= school.max_trial_manual_exams) {
        return {
          success: false,
          message: `Trial limit reached (${school.max_trial_manual_exams}/${school.max_trial_manual_exams} manual exams used). Please upgrade to continue.`
        };
      }
      this.updateSchool(schoolId, { manual_exams_used: school.manual_exams_used + 1 });
    }

    return { success: true };
  },

  // CLASSES
  getClasses(schoolId: string): SchoolClass[] {
    const all = readStorage<SchoolClass[]>(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
    return all.filter((c) => c.school_id === schoolId).sort((a, b) => a.display_order - b.display_order);
  },

  addClass(schoolId: string, name: string, level: 'Junior' | 'Senior', arms: string[] = []): SchoolClass {
    const all = readStorage<SchoolClass[]>(STORAGE_KEYS.CLASSES, INITIAL_CLASSES);
    const existing = all.filter((c) => c.school_id === schoolId);
    const newClass: SchoolClass = {
      id: `cls_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`,
      school_id: schoolId,
      name,
      level,
      arms,
      display_order: existing.length + 1,
      created_at: new Date().toISOString(),
    };
    all.push(newClass);
    writeStorage(STORAGE_KEYS.CLASSES, all);
    dbEvents.notify('classes');
    return newClass;
  },

  deleteClass(id: string): void {
    const all = readStorage<SchoolClass[]>(STORAGE_KEYS.CLASSES, INITIAL_CLASSES).filter((c) => c.id !== id);
    writeStorage(STORAGE_KEYS.CLASSES, all);
    dbEvents.notify('classes');
  },

  // INVITES
  getInvites(schoolId: string): InviteLink[] {
    const all = readStorage<InviteLink[]>(STORAGE_KEYS.INVITES, []);
    return all.filter((i) => i.school_id === schoolId);
  },

  createInvite(schoolId: string, createdBy: string, role: UserRole = 'teacher'): InviteLink {
    const all = readStorage<InviteLink[]>(STORAGE_KEYS.INVITES, []);
    // 6-character uppercase alphanumeric token
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let token = '';
    for (let i = 0; i < 6; i++) {
      token += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    const newInvite: InviteLink = {
      id: `inv_${Date.now()}`,
      school_id: schoolId,
      token,
      role,
      created_by: createdBy,
      is_active: true,
      created_at: new Date().toISOString(),
    };
    all.push(newInvite);
    writeStorage(STORAGE_KEYS.INVITES, all);
    dbEvents.notify('invites');
    return newInvite;
  },

  findInviteByToken(token: string): InviteLink | null {
    const all = readStorage<InviteLink[]>(STORAGE_KEYS.INVITES, []);
    return all.find((i) => i.token.toUpperCase() === token.trim().toUpperCase() && i.is_active) || null;
  },

  // EXAMS & QUESTIONS
  getExams(schoolId: string): Exam[] {
    const all = readStorage<Exam[]>(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
    const questions = readStorage<Question[]>(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS);

    return all
      .filter((e) => e.school_id === schoolId)
      .map((e) => {
        const examQuestions = questions.filter((q) => q.exam_id === e.id);
        return {
          ...e,
          questions: examQuestions.sort((a, b) => a.question_number - b.question_number),
        };
      })
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  },

  getExamById(id: string): Exam | null {
    const all = readStorage<Exam[]>(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
    const exam = all.find((e) => e.id === id);
    if (!exam) return null;
    const questions = readStorage<Question[]>(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS)
      .filter((q) => q.exam_id === id)
      .sort((a, b) => a.question_number - b.question_number);
    return { ...exam, questions };
  },

  saveExam(examData: Omit<Exam, 'id' | 'created_at'> & { id?: string }, questions: Question[]): Exam {
    const allExams = readStorage<Exam[]>(STORAGE_KEYS.EXAMS, INITIAL_EXAMS);
    const allQuestions = readStorage<Question[]>(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS);

    const examId = examData.id || `ex_${Date.now()}_${Math.random().toString(36).substring(2, 6)}`;
    const now = new Date().toISOString();

    const existingIdx = allExams.findIndex((e) => e.id === examId);
    const savedExam: Exam = {
      ...examData,
      id: examId,
      created_at: existingIdx >= 0 ? allExams[existingIdx].created_at : now,
    };

    if (existingIdx >= 0) {
      allExams[existingIdx] = savedExam;
    } else {
      allExams.unshift(savedExam);
    }
    writeStorage(STORAGE_KEYS.EXAMS, allExams);

    // Save questions
    const filteredQuestions = allQuestions.filter((q) => q.exam_id !== examId);
    const normalizedQuestions: Question[] = questions.map((q, idx) => ({
      ...q,
      id: q.id || `q_${Date.now()}_${idx}`,
      exam_id: examId,
      question_number: idx + 1,
    }));

    writeStorage(STORAGE_KEYS.QUESTIONS, [...filteredQuestions, ...normalizedQuestions]);

    dbEvents.notify('exams');
    return { ...savedExam, questions: normalizedQuestions };
  },

  deleteExam(id: string): boolean {
    const allExams = readStorage<Exam[]>(STORAGE_KEYS.EXAMS, INITIAL_EXAMS).filter((e) => e.id !== id);
    const allQuestions = readStorage<Question[]>(STORAGE_KEYS.QUESTIONS, INITIAL_QUESTIONS).filter((q) => q.exam_id !== id);
    writeStorage(STORAGE_KEYS.EXAMS, allExams);
    writeStorage(STORAGE_KEYS.QUESTIONS, allQuestions);
    dbEvents.notify('exams');
    return true;
  },

  // OFFLINE DRAFTS
  getOfflineDrafts(): Exam[] {
    return readStorage<Exam[]>(STORAGE_KEYS.OFFLINE_DRAFTS, []);
  },

  saveOfflineDraft(draft: Exam): void {
    const drafts = this.getOfflineDrafts().filter((d) => d.id !== draft.id);
    drafts.unshift({ ...draft, is_offline_draft: true, created_at: new Date().toISOString() });
    writeStorage(STORAGE_KEYS.OFFLINE_DRAFTS, drafts);
    dbEvents.notify('drafts');
  },

  removeOfflineDraft(id: string): void {
    const drafts = this.getOfflineDrafts().filter((d) => d.id !== id);
    writeStorage(STORAGE_KEYS.OFFLINE_DRAFTS, drafts);
    dbEvents.notify('drafts');
  },

  // PAYMENTS (Paystack ₦11,000 per term)
  getPayments(schoolId?: string): PaymentTransaction[] {
    const payments = readStorage<PaymentTransaction[]>(STORAGE_KEYS.PAYMENTS, [
      {
        id: 'pay_init_1',
        school_id: 'sch_queens_college_yaba',
        school_name: "Queen's College Yaba",
        amount_ngn: 11000,
        reference: 'EC_REF_2026_QC_01',
        status: 'success',
        term: 'First Term',
        session: '2025/2026',
        channel: 'card',
        paid_at: new Date(Date.now() - 30 * 86400000).toISOString(),
      }
    ]);
    if (schoolId) {
      return payments.filter((p) => p.school_id === schoolId);
    }
    return payments;
  },

  recordPayment(schoolId: string, reference: string, amount: number = 11000, term: string = 'First Term', session: string = '2025/2026'): PaymentTransaction {
    const payments = this.getPayments();
    const school = this.getSchool(schoolId);
    const tx: PaymentTransaction = {
      id: `pay_${Date.now()}`,
      school_id: schoolId,
      school_name: school?.name || 'School',
      amount_ngn: amount,
      reference,
      status: 'success',
      term: term as any,
      session,
      channel: 'paystack_inline',
      paid_at: new Date().toISOString(),
    };
    payments.unshift(tx);
    writeStorage(STORAGE_KEYS.PAYMENTS, payments);

    // Upgrade school to active
    if (school) {
      this.updateSchool(schoolId, {
        subscription_status: 'active',
        subscription_expires_at: new Date(Date.now() + 120 * 86400000).toISOString(), // 4 months (full term)
      });
    }

    dbEvents.notify('payments');
    return tx;
  }
};
