import { ExamTerm } from '../types';

export interface SubjectCategory {
  category: string;
  subjects: string[];
}

export const NIGERIAN_CURRICULUM_SUBJECTS: SubjectCategory[] = [
  {
    category: 'Core General Subjects',
    subjects: ['Mathematics', 'English Language', 'Civic Education']
  },
  {
    category: 'Science & Technology',
    subjects: [
      'Physics',
      'Chemistry',
      'Biology',
      'Further Mathematics',
      'Agricultural Science',
      'Computer Studies',
      'Data Processing',
      'Technical Drawing',
      'Animal Husbandry',
      'Fisheries'
    ]
  },
  {
    category: 'Commercial & Business Studies',
    subjects: [
      'Economics',
      'Financial Accounting',
      'Commerce',
      'Marketing',
      'Store Management',
      'Book Keeping',
      'Office Practice',
      'Insurance'
    ]
  },
  {
    category: 'Arts & Humanities',
    subjects: [
      'Government',
      'Literature-in-English',
      'History',
      'Christian Religious Studies (CRS)',
      'Islamic Religious Studies (IRS)',
      'Visual Arts',
      'Music',
      'French',
      'Yoruba',
      'Igbo',
      'Hausa'
    ]
  },
  {
    category: 'Junior Secondary (BECE/JSS)',
    subjects: [
      'Basic Science',
      'Basic Technology',
      'Social Studies',
      'Business Studies',
      'Physical & Health Education (PHE)',
      'Home Economics',
      'Cultural & Creative Arts (CCA)',
      'Agricultural Science (Junior)',
      'Christian Religious Knowledge (CRK)',
      'Islamic Studies (JSS)',
      'Computer Studies (Junior)'
    ]
  }
];

export const ALL_NIGERIAN_SUBJECTS = Array.from(
  new Set(NIGERIAN_CURRICULUM_SUBJECTS.flatMap((c) => c.subjects))
).sort();

export const STANDARD_NIGERIAN_CLASSES = [
  { name: 'JSS 1', level: 'Junior' as const, label: 'Junior Secondary 1 (JSS 1 / Grade 7)' },
  { name: 'JSS 2', level: 'Junior' as const, label: 'Junior Secondary 2 (JSS 2 / Grade 8)' },
  { name: 'JSS 3', level: 'Junior' as const, label: 'Junior Secondary 3 (JSS 3 / BECE)' },
  { name: 'SSS 1', level: 'Senior' as const, label: 'Senior Secondary 1 (SSS 1 / Grade 10)' },
  { name: 'SSS 2', level: 'Senior' as const, label: 'Senior Secondary 2 (SSS 2 / Grade 11)' },
  { name: 'SSS 3', level: 'Senior' as const, label: 'Senior Secondary 3 (SSS 3)' },
];

export function normalizeClassName(raw: string): string {
  const cleaned = raw.trim().toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (/^J(SS|S)?1$/.test(cleaned) || cleaned === 'JS1' || cleaned === 'GRADE7') return 'JSS 1';
  if (/^J(SS|S)?2$/.test(cleaned) || cleaned === 'JS2' || cleaned === 'GRADE8') return 'JSS 2';
  if (/^J(SS|S)?3$/.test(cleaned) || cleaned === 'JS3' || cleaned === 'GRADE9') return 'JSS 3';
  if (/^S(SS|S)?1$/.test(cleaned) || cleaned === 'SS1' || cleaned === 'GRADE10') return 'SSS 1';
  if (/^S(SS|S)?2$/.test(cleaned) || cleaned === 'SS2' || cleaned === 'GRADE11') return 'SSS 2';
  if (/^S(SS|S)?3$/.test(cleaned) || cleaned === 'SS3' || cleaned === 'GRADE12') return 'SSS 3';
  return raw.trim();
}

export const EXAM_TERMS: ExamTerm[] = ['First Term', 'Second Term', 'Third Term'];

export const ACADEMIC_SESSIONS = [
  '2025/2026',
  '2026/2027',
  '2024/2025'
];

export const DEFAULT_EXAM_INSTRUCTIONS = 
  'SECTION A: Answer all questions in this section by selecting the correct option (A - D).\n' +
  'SECTION B: Answer any FOUR (4) questions in this section. All questions carry equal marks. Write legibly and show all working clearly.';
