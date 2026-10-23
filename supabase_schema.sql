-- ==============================================================================
-- ROCKCRAF (ExamCraft) PRODUCTION SUPABASE SQL MIGRATION
-- Multi-Tenant Examination Paper Generator for Nigerian Secondary Schools
-- ==============================================================================

-- 1. EXTENSIONS
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ==============================================================================
-- 2. TABLES DEFINITION
-- ==============================================================================

-- 2.1 SCHOOLS (Multi-Tenant Root)
CREATE TABLE IF NOT EXISTS public.schools (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    admin_name TEXT NOT NULL,
    email TEXT NOT NULL UNIQUE,
    phone TEXT NOT NULL,
    state TEXT NOT NULL,
    lga TEXT NOT NULL,
    institution_type TEXT NOT NULL DEFAULT 'Secondary' 
        CHECK (institution_type IN ('Secondary', 'Comprehensive', 'College', 'International', 'Technical', 'Primary & Secondary')),
    logo_url TEXT,
    motto TEXT,
    address TEXT,
    subscription_status TEXT NOT NULL DEFAULT 'trial' 
        CHECK (subscription_status IN ('trial', 'active', 'expired')),
    subscription_expires_at TIMESTAMPTZ,
    ai_exams_used INTEGER NOT NULL DEFAULT 0,
    manual_exams_used INTEGER NOT NULL DEFAULT 0,
    max_trial_ai_exams INTEGER NOT NULL DEFAULT 3,
    max_trial_manual_exams INTEGER NOT NULL DEFAULT 5,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.2 PROFILES (Associated with auth.users)
CREATE TABLE IF NOT EXISTS public.profiles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
    full_name TEXT NOT NULL,
    email TEXT NOT NULL,
    phone TEXT,
    school_id UUID REFERENCES public.schools(id) ON DELETE SET NULL,
    avatar_url TEXT,
    is_profile_completed BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.3 USER ROLES (Strict Multi-Tenancy: Roles live in user_roles, NEVER on profiles)
CREATE TABLE IF NOT EXISTS public.user_roles (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    role TEXT NOT NULL CHECK (role IN ('school_admin', 'teacher', 'platform_admin')),
    school_id UUID REFERENCES public.schools(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    UNIQUE(user_id, role, school_id)
);

-- 2.4 SCHOOL CLASSES (JSS 1, SSS 3, etc.)
CREATE TABLE IF NOT EXISTS public.school_classes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    name TEXT NOT NULL, -- e.g. "SSS 3", "JSS 1"
    level TEXT NOT NULL CHECK (level IN ('Junior', 'Senior')),
    arms TEXT[] DEFAULT ARRAY[]::TEXT[], -- e.g. ["Gold", "Silver"] or ["Science", "Arts", "Commercial"]
    display_order INTEGER NOT NULL DEFAULT 1,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.5 TEACHER INVITATION TOKENS (/join/:token)
CREATE TABLE IF NOT EXISTS public.school_invitations (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    token TEXT NOT NULL UNIQUE, -- 6-character uppercase token e.g. "KC2026"
    role TEXT NOT NULL DEFAULT 'teacher' CHECK (role IN ('teacher', 'school_admin')),
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    is_active BOOLEAN NOT NULL DEFAULT true,
    expires_at TIMESTAMPTZ DEFAULT (timezone('utc'::text, now()) + interval '30 days'),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.6 EXAMINATIONS
CREATE TABLE IF NOT EXISTS public.exams (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    created_by_name TEXT,
    exam_code TEXT NOT NULL UNIQUE, -- e.g. "RC-2026-MATH-01"
    title TEXT NOT NULL,
    subject TEXT NOT NULL,
    class_id UUID REFERENCES public.school_classes(id) ON DELETE SET NULL,
    class_name TEXT NOT NULL,
    term TEXT NOT NULL CHECK (term IN ('First Term', 'Second Term', 'Third Term')),
    session TEXT NOT NULL DEFAULT '2025/2026',
    duration_minutes INTEGER NOT NULL DEFAULT 90,
    instructions TEXT NOT NULL,
    total_marks INTEGER NOT NULL DEFAULT 100,
    section_a_marks INTEGER NOT NULL DEFAULT 40,
    section_b_marks INTEGER NOT NULL DEFAULT 60,
    status TEXT NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published')),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.7 QUESTIONS (Section A Objectives & Section B Theory)
CREATE TABLE IF NOT EXISTS public.questions (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    exam_id UUID NOT NULL REFERENCES public.exams(id) ON DELETE CASCADE,
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    section TEXT NOT NULL CHECK (section IN ('A', 'B')),
    question_number INTEGER NOT NULL,
    question_text TEXT NOT NULL,
    marks NUMERIC NOT NULL DEFAULT 1,
    image_url TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- 2.8 OBJECTIVE ANSWERS (Section A Options A/B/C/D)
CREATE TABLE IF NOT EXISTS public.objective_answers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE UNIQUE,
    option_a TEXT NOT NULL,
    option_b TEXT NOT NULL,
    option_c TEXT NOT NULL,
    option_d TEXT NOT NULL,
    correct_option TEXT NOT NULL CHECK (correct_option IN ('A', 'B', 'C', 'D')),
    explanation TEXT
);

-- 2.9 THEORY MARKING SCHEMES (Section B Confidential Model Answer & Rubric)
CREATE TABLE IF NOT EXISTS public.theory_marking_schemes (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    question_id UUID NOT NULL REFERENCES public.questions(id) ON DELETE CASCADE UNIQUE,
    model_answer TEXT NOT NULL,
    score_breakdown TEXT NOT NULL,
    max_score NUMERIC NOT NULL DEFAULT 15
);

-- 2.10 PAYMENTS (Paystack ₦11,000 per term)
CREATE TABLE IF NOT EXISTS public.payments (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    school_id UUID NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
    school_name TEXT NOT NULL,
    amount_ngn NUMERIC NOT NULL DEFAULT 11000,
    reference TEXT NOT NULL UNIQUE,
    status TEXT NOT NULL DEFAULT 'success' CHECK (status IN ('success', 'pending', 'failed')),
    term TEXT NOT NULL,
    session TEXT NOT NULL,
    channel TEXT DEFAULT 'paystack_inline',
    paid_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now()),
    created_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc'::text, now())
);

-- ==============================================================================
-- 3. SECURITY DEFINER HELPER FUNCTIONS
-- ==============================================================================

-- 3.1 Check if user is platform administrator (Hardcoded email or role)
CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    COALESCE(auth.jwt() ->> 'email', '') = 'peteroche32@gmail.com'
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'platform_admin'
    )
  );
$$;

-- 3.2 Get user's school ID
CREATE OR REPLACE FUNCTION public.get_user_school_id()
RETURNS UUID
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT school_id FROM public.profiles WHERE user_id = auth.uid() LIMIT 1;
$$;

-- 3.3 Check if user has specified role in their school
CREATE OR REPLACE FUNCTION public.has_role(required_role TEXT)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
AS $$
  SELECT (
    public.is_platform_admin()
    OR EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid()
        AND role = required_role
        AND (school_id = public.get_user_school_id() OR school_id IS NULL)
    )
  );
$$;

-- ==============================================================================
-- 4. ROW LEVEL SECURITY (RLS) POLICIES
-- ==============================================================================

ALTER TABLE public.schools ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_classes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.school_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.objective_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.theory_marking_schemes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- 4.1 SCHOOLS POLICIES
CREATE POLICY "Public or Authenticated can view schools"
    ON public.schools FOR SELECT
    USING (true);

CREATE POLICY "Platform admin and authenticated school admin can insert school"
    ON public.schools FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "School admin and platform admin can update their school"
    ON public.schools FOR UPDATE
    USING (
        id = public.get_user_school_id() 
        OR public.is_platform_admin()
    );

-- 4.2 PROFILES POLICIES
CREATE POLICY "Users can view own profile or same school profiles"
    ON public.profiles FOR SELECT
    USING (
        user_id = auth.uid() 
        OR school_id = public.get_user_school_id()
        OR public.is_platform_admin()
    );

CREATE POLICY "Users can insert own profile"
    ON public.profiles FOR INSERT
    WITH CHECK (user_id = auth.uid() OR public.is_platform_admin());

CREATE POLICY "Users can update own profile"
    ON public.profiles FOR UPDATE
    USING (user_id = auth.uid() OR public.is_platform_admin());

-- 4.3 USER ROLES POLICIES
CREATE POLICY "Users can view roles within their school"
    ON public.user_roles FOR SELECT
    USING (
        user_id = auth.uid()
        OR school_id = public.get_user_school_id()
        OR public.is_platform_admin()
    );

CREATE POLICY "School admins can manage roles"
    ON public.user_roles FOR ALL
    USING (
        public.has_role('school_admin')
        OR public.is_platform_admin()
    );

-- 4.4 CLASSES POLICIES
CREATE POLICY "Users can view classes in their school"
    ON public.school_classes FOR SELECT
    USING (
        school_id = public.get_user_school_id()
        OR public.is_platform_admin()
    );

CREATE POLICY "School admins can manage classes"
    ON public.school_classes FOR ALL
    USING (
        (public.has_role('school_admin') AND school_id = public.get_user_school_id())
        OR public.is_platform_admin()
    );

-- 4.5 INVITATIONS POLICIES
CREATE POLICY "Anyone can lookup invite token to join"
    ON public.school_invitations FOR SELECT
    USING (true);

CREATE POLICY "School admins can manage invitations"
    ON public.school_invitations FOR ALL
    USING (
        (public.has_role('school_admin') AND school_id = public.get_user_school_id())
        OR public.is_platform_admin()
    );

-- 4.6 EXAMS POLICIES
CREATE POLICY "School members can view school exams"
    ON public.exams FOR SELECT
    USING (
        school_id = public.get_user_school_id()
        OR public.is_platform_admin()
    );

CREATE POLICY "Teachers and admins can insert exams"
    ON public.exams FOR INSERT
    WITH CHECK (
        (school_id = public.get_user_school_id() AND auth.uid() IS NOT NULL)
        OR public.is_platform_admin()
    );

CREATE POLICY "Teachers and admins can update school exams"
    ON public.exams FOR UPDATE
    USING (
        (school_id = public.get_user_school_id() AND auth.uid() IS NOT NULL)
        OR public.is_platform_admin()
    );

CREATE POLICY "School admins can delete exams"
    ON public.exams FOR DELETE
    USING (
        (public.has_role('school_admin') AND school_id = public.get_user_school_id())
        OR public.is_platform_admin()
    );

-- 4.7 QUESTIONS POLICIES
CREATE POLICY "School members can view questions"
    ON public.questions FOR SELECT
    USING (
        school_id = public.get_user_school_id()
        OR public.is_platform_admin()
    );

CREATE POLICY "School members can insert questions"
    ON public.questions FOR INSERT
    WITH CHECK (
        (school_id = public.get_user_school_id() AND auth.uid() IS NOT NULL)
        OR public.is_platform_admin()
    );

CREATE POLICY "School members can update questions"
    ON public.questions FOR UPDATE
    USING (
        (school_id = public.get_user_school_id() AND auth.uid() IS NOT NULL)
        OR public.is_platform_admin()
    );

CREATE POLICY "School members can delete questions"
    ON public.questions FOR DELETE
    USING (
        (school_id = public.get_user_school_id() AND auth.uid() IS NOT NULL)
        OR public.is_platform_admin()
    );

-- 4.8 OBJECTIVE ANSWERS POLICIES
CREATE POLICY "School members can view objective answers"
    ON public.objective_answers FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            WHERE q.id = objective_answers.question_id
              AND (q.school_id = public.get_user_school_id() OR public.is_platform_admin())
        )
    );

CREATE POLICY "School members can manage objective answers"
    ON public.objective_answers FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            WHERE q.id = objective_answers.question_id
              AND (q.school_id = public.get_user_school_id() OR public.is_platform_admin())
        )
    );

-- 4.9 THEORY MARKING SCHEMES POLICIES (Confidential - only school members)
CREATE POLICY "School members can view marking schemes"
    ON public.theory_marking_schemes FOR SELECT
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            WHERE q.id = theory_marking_schemes.question_id
              AND (q.school_id = public.get_user_school_id() OR public.is_platform_admin())
        )
    );

CREATE POLICY "School members can manage marking schemes"
    ON public.theory_marking_schemes FOR ALL
    USING (
        EXISTS (
            SELECT 1 FROM public.questions q
            WHERE q.id = theory_marking_schemes.question_id
              AND (q.school_id = public.get_user_school_id() OR public.is_platform_admin())
        )
    );

-- 4.10 PAYMENTS POLICIES
CREATE POLICY "School admins can view school payments"
    ON public.payments FOR SELECT
    USING (
        school_id = public.get_user_school_id()
        OR public.is_platform_admin()
    );

CREATE POLICY "Authenticated users can record payments"
    ON public.payments FOR INSERT
    WITH CHECK (auth.uid() IS NOT NULL);

-- ==============================================================================
-- 5. AUTOMATED TRIGGERS & PROFILES CREATION
-- ==============================================================================

-- 5.1 Auto-create profile on auth.users sign-up
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
    assigned_school_id UUID;
    user_full_name TEXT;
    target_role TEXT;
BEGIN
    user_full_name := COALESCE(new.raw_user_meta_data->>'full_name', split_part(new.email, '@', 1));
    target_role := COALESCE(new.raw_user_meta_data->>'role', 'school_admin');
    
    -- Check if user is platform admin
    IF LOWER(new.email) = 'peteroche32@gmail.com' THEN
        target_role := 'platform_admin';
    END IF;

    -- Insert Profile
    INSERT INTO public.profiles (user_id, full_name, email, is_profile_completed)
    VALUES (new.id, user_full_name, new.email, false)
    ON CONFLICT (user_id) DO NOTHING;

    -- Insert Initial Role
    INSERT INTO public.user_roles (user_id, role)
    VALUES (new.id, target_role)
    ON CONFLICT DO NOTHING;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Drop trigger if exists and recreate
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
    AFTER INSERT ON auth.users
    FOR EACH ROW EXECUTE PROCEDURE public.handle_new_user();

-- 5.2 Updated at auto-timestamp trigger
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = timezone('utc'::text, now());
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS set_schools_updated_at ON public.schools;
CREATE TRIGGER set_schools_updated_at
    BEFORE UPDATE ON public.schools
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

DROP TRIGGER IF EXISTS set_exams_updated_at ON public.exams;
CREATE TRIGGER set_exams_updated_at
    BEFORE UPDATE ON public.exams
    FOR EACH ROW EXECUTE PROCEDURE public.handle_updated_at();

-- ==============================================================================
-- 6. STORAGE BUCKETS SETUP (School Logos & Exam Assets)
-- ==============================================================================

INSERT INTO storage.buckets (id, name, public)
VALUES ('school-logos', 'school-logos', true)
ON CONFLICT (id) DO NOTHING;

INSERT INTO storage.buckets (id, name, public)
VALUES ('exam-assets', 'exam-assets', true)
ON CONFLICT (id) DO NOTHING;

-- Storage RLS: Public Read for logos
CREATE POLICY "Public Read for School Logos"
    ON storage.objects FOR SELECT
    USING (bucket_id = 'school-logos' OR bucket_id = 'exam-assets');

-- Storage RLS: Authenticated Upload
CREATE POLICY "Authenticated Users Upload Logos"
    ON storage.objects FOR INSERT
    WITH CHECK ((bucket_id = 'school-logos' OR bucket_id = 'exam-assets') AND auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated Users Update Logos"
    ON storage.objects FOR UPDATE
    USING ((bucket_id = 'school-logos' OR bucket_id = 'exam-assets') AND auth.uid() IS NOT NULL);

-- ==============================================================================
-- 7. INITIAL SEED DATA (King's College Lagos & Standard Nigerian Classes)
-- ==============================================================================

DO $$
DECLARE
    sample_school_id UUID := '11111111-1111-1111-1111-111111111111'::UUID;
BEGIN
    -- Seed Default School
    INSERT INTO public.schools (
        id, name, admin_name, email, phone, state, lga, institution_type, 
        motto, address, subscription_status, ai_exams_used, manual_exams_used
    ) VALUES (
        sample_school_id,
        'King''s College Lagos',
        'Dr. Babatunde Alabi',
        'principal@kingscollege.edu.ng',
        '08031234567',
        'Lagos',
        'Lagos Island',
        'College',
        'Floreat Collegium (Let the College Flourish)',
        '3 Catholic Mission Street, Lagos Island, Lagos State',
        'trial',
        1,
        1
    ) ON CONFLICT (id) DO NOTHING;

    -- Seed Standard Nigerian Secondary Classes
    INSERT INTO public.school_classes (school_id, name, level, arms, display_order)
    VALUES
        (sample_school_id, 'JSS 1', 'Junior', ARRAY['Gold', 'Silver'], 1),
        (sample_school_id, 'JSS 2', 'Junior', ARRAY['Gold', 'Silver'], 2),
        (sample_school_id, 'JSS 3', 'Junior', ARRAY['Gold', 'Silver'], 3),
        (sample_school_id, 'SSS 1', 'Senior', ARRAY['Science', 'Arts', 'Commercial'], 4),
        (sample_school_id, 'SSS 2', 'Senior', ARRAY['Science', 'Arts', 'Commercial'], 5),
        (sample_school_id, 'SSS 3', 'Senior', ARRAY['Science', 'Arts', 'Commercial'], 6)
    ON CONFLICT DO NOTHING;

    -- Seed Active Teacher Invite Link Token: KC2026
    INSERT INTO public.school_invitations (school_id, token, role, is_active)
    VALUES (sample_school_id, 'KC2026', 'teacher', true)
    ON CONFLICT (token) DO NOTHING;
END $$;
