-- ROCKCRAFT school curriculum and duplicate class/subject protection.
-- Safe to run in Supabase SQL Editor. Existing exams are preserved.

BEGIN;

CREATE TABLE IF NOT EXISTS public.school_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  school_id uuid NOT NULL REFERENCES public.schools(id) ON DELETE CASCADE,
  name text NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS school_subjects_school_name_unique
  ON public.school_subjects (school_id, lower(btrim(name)));

ALTER TABLE public.school_subjects ENABLE ROW LEVEL SECURITY;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.school_subjects TO authenticated;

DROP POLICY IF EXISTS school_subjects_select_member ON public.school_subjects;
CREATE POLICY school_subjects_select_member
  ON public.school_subjects FOR SELECT TO authenticated
  USING (public.is_school_member(school_id));

DROP POLICY IF EXISTS school_subjects_manage_admin ON public.school_subjects;
CREATE POLICY school_subjects_manage_admin
  ON public.school_subjects FOR ALL TO authenticated
  USING (
    (school_id = public.get_user_school_id() AND public.has_role('school_admin'))
    OR public.is_platform_admin()
  )
  WITH CHECK (
    (school_id = public.get_user_school_id() AND public.has_role('school_admin'))
    OR public.is_platform_admin()
  );

-- Give existing schools a useful starting list. Admins can add school-specific subjects.
INSERT INTO public.school_subjects (school_id, name)
SELECT s.id, subjects.name
FROM public.schools s
CROSS JOIN (VALUES
  ('Mathematics'), ('English Language'), ('Civic Education'),
  ('Physics'), ('Chemistry'), ('Biology'), ('Further Mathematics'),
  ('Agricultural Science'), ('Computer Studies'), ('Data Processing'),
  ('Technical Drawing'), ('Animal Husbandry'), ('Fisheries'),
  ('Economics'), ('Financial Accounting'), ('Commerce'), ('Marketing'),
  ('Store Management'), ('Book Keeping'), ('Office Practice'), ('Insurance'),
  ('Government'), ('Literature-in-English'), ('History'),
  ('Christian Religious Studies (CRS)'), ('Islamic Religious Studies (IRS)'),
  ('Visual Arts'), ('Music'), ('French'), ('Yoruba'), ('Igbo'), ('Hausa'),
  ('Basic Science'), ('Basic Technology'), ('Social Studies'), ('Business Studies'),
  ('Physical & Health Education (PHE)'), ('Home Economics'),
  ('Cultural & Creative Arts (CCA)'), ('Christian Religious Knowledge (CRK)'),
  ('Islamic Studies (JSS)'), ('Computer Studies (Junior)')
) AS subjects(name)
ON CONFLICT DO NOTHING;

-- Prevent two published exams for the same school, class, subject, term and session.
-- A transaction-scoped advisory lock prevents simultaneous requests bypassing the check.
CREATE OR REPLACE FUNCTION public.prevent_duplicate_class_subject_exam()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lock_key text;
BEGIN
  IF NEW.status <> 'published' THEN
    RETURN NEW;
  END IF;

  v_lock_key := concat_ws('|',
    NEW.school_id::text,
    lower(btrim(NEW.class_name)),
    lower(btrim(NEW.subject)),
    lower(btrim(NEW.term)),
    lower(btrim(NEW.session))
  );

  PERFORM pg_advisory_xact_lock(hashtextextended(v_lock_key, 0));

  IF EXISTS (
    SELECT 1
    FROM public.exams e
    WHERE e.school_id = NEW.school_id
      AND lower(btrim(e.class_name)) = lower(btrim(NEW.class_name))
      AND lower(btrim(e.subject)) = lower(btrim(NEW.subject))
      AND lower(btrim(e.term)) = lower(btrim(NEW.term))
      AND lower(btrim(e.session)) = lower(btrim(NEW.session))
      AND e.status = 'published'
      AND e.id IS DISTINCT FROM NEW.id
  ) THEN
    RAISE EXCEPTION USING
      ERRCODE = '23505',
      MESSAGE = 'This class already has an exam for this subject, term and academic session.',
      DETAIL = 'Choose another subject, term or academic session, or ask the school admin to review the existing exam.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS exams_prevent_duplicate_class_subject ON public.exams;
CREATE TRIGGER exams_prevent_duplicate_class_subject
BEFORE INSERT OR UPDATE
ON public.exams
FOR EACH ROW
EXECUTE FUNCTION public.prevent_duplicate_class_subject_exam();


-- New schools receive the standard curriculum automatically; school admins can customize it.
CREATE OR REPLACE FUNCTION public.seed_default_school_subjects()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $seed_subjects$
BEGIN
  INSERT INTO public.school_subjects (school_id, name)
  SELECT NEW.id, subjects.name
  FROM (VALUES
    ('Mathematics'), ('English Language'), ('Civic Education'),
    ('Physics'), ('Chemistry'), ('Biology'), ('Further Mathematics'),
    ('Agricultural Science'), ('Computer Studies'), ('Data Processing'),
    ('Technical Drawing'), ('Animal Husbandry'), ('Fisheries'),
    ('Economics'), ('Financial Accounting'), ('Commerce'), ('Marketing'),
    ('Store Management'), ('Book Keeping'), ('Office Practice'), ('Insurance'),
    ('Government'), ('Literature-in-English'), ('History'),
    ('Christian Religious Studies (CRS)'), ('Islamic Religious Studies (IRS)'),
    ('Visual Arts'), ('Music'), ('French'), ('Yoruba'), ('Igbo'), ('Hausa'),
    ('Basic Science'), ('Basic Technology'), ('Social Studies'), ('Business Studies'),
    ('Physical & Health Education (PHE)'), ('Home Economics'),
    ('Cultural & Creative Arts (CCA)'), ('Christian Religious Knowledge (CRK)'),
    ('Islamic Studies (JSS)'), ('Computer Studies (Junior)')
  ) AS subjects(name)
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$seed_subjects$;

DROP TRIGGER IF EXISTS schools_seed_default_subjects ON public.schools;
CREATE TRIGGER schools_seed_default_subjects
AFTER INSERT ON public.schools
FOR EACH ROW
EXECUTE FUNCTION public.seed_default_school_subjects();

COMMIT;
