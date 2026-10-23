-- ==============================================================================
-- ExamCraft - Multi-tenant Database Schema for Nigerian Secondary Schools
-- Compatible with Supabase PostgreSQL (Auth, RLS, Security Definer Functions)
-- ==============================================================================

-- 1. Enable UUID Extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- 2. ENUMS
DO $$ BEGIN
  CREATE TYPE user_role_enum AS ENUM ('school_admin', 'teacher', 'platform_admin');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE exam_term_enum AS ENUM ('First Term', 'Second Term', 'Third Term');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE exam_status_enum AS ENUM ('draft', 'published');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

DO $$ BEGIN
  CREATE TYPE question_section_enum AS ENUM ('A', 'B');
EXCEPTION
  WHEN duplicate_object THEN null;
END $$;

-- 3. SCHOOLS TABLE
CREATE TABLE IF NOT EXISTS public.schools (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  admin_name TEXT NOT NULL,
  email TEXT NOT NULL UNIQUE,
  phone TEXT NOT NULL,
  state TEXT NOT NULL,
  lga TEXT NOT NULL,
  institution_type TEXT NOT NULL DEFAULT 'Secondary',
  logo_url TEXT,
  motto TEXT,
  address TEXT,
  subscription_status TEXT NOT NULL DEFAULT 'trial' CHECK (subscription_status IN ('trial', 'active', 'expired')),
  subscription_expires_at TIMESTAMPTZ,
  ai_exams_used INT NOT NULL DEFAULT 0,
  manual_exams_used INT NOT NULL DEFAULT 0,
  max_trial_ai_exams INT NOT NULL DEFAULT 3,
  max_trial_manual_exams INT NOT NULL DEFAULT 5,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 4. PROFILES TABLE
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name TEXT NOT NULL,
  email TEXT NOT NULL,
  school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
  phone TEXT,
  avatar_url TEXT,
  is_profile_completed BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 5. USER_ROLES TABLE (Crucial: Roles separated from profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role user_role_enum NOT NULL DEFAULT 'teacher',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  UNIQUE(user_id, role)
);

-- 6. SCHOOL_CLASSES TABLE
CREATE TABLE IF NOT EXISTS public.school_classes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name TEXT NOT NULL, -- e.g. "SSS 2", "JSS 1"
  level TEXT NOT NULL CHECK (level IN ('Junior', 'Senior')),
  arms JSONB DEFAULT '[]'::jsonb,
  display_order INT NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 7. INVITE_LINKS TABLE
CREATE TABLE IF NOT EXISTS public.invite_links (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  token VARCHAR(6) NOT NULL UNIQUE,
  role user_role_enum NOT NULL DEFAULT 'teacher',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  expires_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 8. EXAMS TABLE
CREATE TABLE IF NOT EXISTS public.exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  created_by UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  exam_code VARCHAR(32) NOT NULL,
  title TEXT NOT NULL,
  subject TEXT NOT NULL,
  class_id UUID REFERENCES public.school_classes(id) ON DELETE SET NULL,
  class_name TEXT NOT NULL,
  term exam_term_enum NOT NULL DEFAULT 'First Term',
  session VARCHAR(16) NOT NULL DEFAULT '2025/2026',
  duration_minutes INT NOT NULL DEFAULT 90,
  instructions TEXT NOT NULL,
  total_marks INT NOT NULL DEFAULT 100,
  section_a_marks INT NOT NULL DEFAULT 40,
  section_b_marks INT NOT NULL DEFAULT 60,
  status exam_status_enum NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 9. QUESTIONS TABLE
CREATE TABLE IF NOT EXISTS public.questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
  section question_section_enum NOT NULL DEFAULT 'A',
  question_number INT NOT NULL,
  question_text TEXT NOT NULL,
  marks INT NOT NULL DEFAULT 1,
  image_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 10. OBJECTIVE_ANSWERS TABLE
CREATE TABLE IF NOT EXISTS public.objective_answers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  option_a TEXT NOT NULL,
  option_b TEXT NOT NULL,
  option_c TEXT NOT NULL,
  option_d TEXT NOT NULL,
  correct_option VARCHAR(1) NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 11. THEORY_MARKING_SCHEMES TABLE
CREATE TABLE IF NOT EXISTS public.theory_marking_schemes (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  question_id UUID NOT NULL UNIQUE REFERENCES public.questions(id) ON DELETE CASCADE,
  model_answer TEXT NOT NULL,
  score_breakdown TEXT NOT NULL,
  max_score INT NOT NULL DEFAULT 10,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 12. SCHOOL_RESULT_SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.school_result_settings (
  school_id UUID PRIMARY KEY REFERENCES public.schools(id) ON DELETE CASCADE,
  grading_scale JSONB DEFAULT '{"A1": 75, "B2": 70, "B3": 65, "C4": 60, "C5": 55, "C6": 50, "D7": 45, "E8": 40, "F9": 0}'::jsonb,
  stamp_url TEXT,
  principal_signature_url TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 13. TRANSACTIONS TABLE (Paystack)
CREATE TABLE IF NOT EXISTS public.payment_transactions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  amount_ngn NUMERIC(12, 2) NOT NULL DEFAULT 11000.00,
  reference TEXT NOT NULL UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending',
  term exam_term_enum NOT NULL DEFAULT 'First Term',
  session VARCHAR(16) NOT NULL DEFAULT '2025/2026',
  channel TEXT DEFAULT 'card',
  paid_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- SECURITY-DEFINER HELPER FUNCTIONS
-- ==============================================================================

-- Check if current user is platform_admin (or hardcoded platform email)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM auth.users u
    JOIN public.user_roles ur ON ur.user_id = u.id
    WHERE u.id = auth.uid() AND (ur.role = 'platform_admin' OR u.email = 'peteroche32@gmail.com')
  );
$$;

-- Get school_id of current user
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM public.profiles
  WHERE user_id = auth.uid()
  LIMIT 1;
$$;

-- Check if current user has specific role
CREATE OR REPLACE FUNCTION public.has_role(required_role user_role_enum)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = auth.uid() AND role = required_role
  ) OR public.is_platform_admin();
$$;

-- ==============================================================================
-- ROW-LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_links ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_marking_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_result_settings ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payment_transactions ENABLE ROW LEVEL SECURITY;

-- Schools: Admin or teacher can read their own school. Admin can update. Platform admin has full access.
CREATE POLICY "Users can view their school"
  ON public.schools FOR SELECT
  USING (id = public.get_user_school_id() OR public.is_platform_admin());

CREATE POLICY "Admins can update their school"
  ON public.schools FOR UPDATE
  USING ((id = public.get_user_school_id() AND public.has_role('school_admin')) OR public.is_platform_admin());

-- Exams: Read and write within same school
CREATE POLICY "Users can view school exams"
  ON public.exams FOR SELECT
  USING (school_id = public.get_user_school_id() OR public.is_platform_admin());

CREATE POLICY "Users can insert exams for their school"
  ON public.exams FOR INSERT
  WITH CHECK (school_id = public.get_user_school_id() OR public.is_platform_admin());

CREATE POLICY "Users can update exams in their school"
  ON public.exams FOR UPDATE
  USING (school_id = public.get_user_school_id() OR public.is_platform_admin());

CREATE POLICY "Admins or creator can delete exams"
  ON public.exams FOR DELETE
  USING ((school_id = public.get_user_school_id() AND (created_by = auth.uid() OR public.has_role('school_admin'))) OR public.is_platform_admin());

-- Marking Schemes: Only school_admin, exam creator, or platform_admin can view confidential scheme
CREATE POLICY "Authorized users can view marking schemes"
  ON public.theory_marking_schemes FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.questions q
      JOIN public.exams e ON e.id = q.exam_id
      WHERE q.id = theory_marking_schemes.question_id
      AND (
        e.school_id = public.get_user_school_id() 
        AND (e.created_by = auth.uid() OR public.has_role('school_admin'))
        OR public.is_platform_admin()
      )
    )
  );
