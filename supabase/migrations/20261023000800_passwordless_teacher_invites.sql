-- Publish an exam and enforce its quota in one PostgreSQL transaction.
-- If any question/answer insert fails, the exam and quota increment both roll back.
CREATE OR REPLACE FUNCTION public.publish_exam_with_invite(
  p_exam jsonb,
  p_questions jsonb,
  p_is_ai boolean,
  p_invite_token text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school_id uuid;
  v_school public.schools%ROWTYPE;
  v_exam public.exams%ROWTYPE;
  v_question public.questions%ROWTYPE;
  v_question_json jsonb;
  v_saved_questions jsonb := '[]'::jsonb;
  v_question_count integer := 0;
  v_is_platform_admin boolean := false;
  v_is_school_member boolean := false;
  v_is_paid boolean;
  v_used integer;
  v_max integer;
BEGIN
  IF p_exam IS NULL OR jsonb_typeof(p_exam) <> 'object'
     OR p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array'
     OR jsonb_array_length(p_questions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_payload', 'message', 'Exam details and at least one question are required.');
  END IF;

  v_school_id := (p_exam->>'school_id')::uuid;

  IF v_user_id IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM public.user_roles ur
      WHERE ur.user_id = v_user_id AND ur.role = 'platform_admin'
    ) INTO v_is_platform_admin;

    SELECT EXISTS (
      SELECT 1
      FROM public.profiles p
      JOIN public.user_roles ur ON ur.user_id = p.user_id
      WHERE p.user_id = v_user_id
        AND p.school_id = v_school_id
        AND ur.school_id = v_school_id
        AND ur.role IN ('school_admin', 'teacher')
    ) INTO v_is_school_member;
  ELSE
    SELECT EXISTS (
      SELECT 1
      FROM public.school_invitations si
      WHERE si.token = upper(trim(p_invite_token))
        AND si.school_id = v_school_id
        AND si.role = 'teacher'
        AND si.is_active = true
        AND (si.expires_at IS NULL OR si.expires_at > now())
    ) INTO v_is_school_member;
  END IF;

  IF NOT v_is_platform_admin AND NOT v_is_school_member THEN
    RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'message', 'This school link is invalid or expired.');
  END IF;

  SELECT * INTO v_school
  FROM public.schools
  WHERE id = v_school_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'code', 'school_not_found', 'message', 'School was not found.');
  END IF;

  v_is_paid := v_school.subscription_status = 'active'
    AND (v_school.subscription_expires_at IS NULL OR v_school.subscription_expires_at > now());
  v_used := CASE WHEN p_is_ai THEN v_school.ai_exams_used ELSE v_school.manual_exams_used END;
  v_max := CASE WHEN p_is_ai THEN v_school.max_trial_ai_exams ELSE v_school.max_trial_manual_exams END;

  IF NOT v_is_paid AND v_used >= v_max THEN
    RETURN jsonb_build_object(
      'success', false,
      'code', 'quota_exceeded',
      'message', CASE WHEN p_is_ai
        THEN format('Trial limit reached (%s/%s AI exams used). Please pay for full term access to generate more exams.', v_used, v_max)
        ELSE format('Trial limit reached (%s/%s manual exams used). Please upgrade to continue.', v_used, v_max)
      END,
      'used', v_used,
      'max', v_max,
      'is_paid', false
    );
  END IF;

  INSERT INTO public.exams (
    school_id, created_by, created_by_name, exam_code, title, subject, class_id,
    class_name, term, session, duration_minutes, instructions, total_marks,
    section_a_marks, section_b_marks, status
  ) VALUES (
    v_school_id, v_user_id, NULLIF(p_exam->>'created_by_name', ''),
    p_exam->>'exam_code', p_exam->>'title', p_exam->>'subject',
    NULLIF(p_exam->>'class_id', '')::uuid, p_exam->>'class_name',
    p_exam->>'term', p_exam->>'session',
    COALESCE(NULLIF(p_exam->>'duration_minutes', '')::integer, 90),
    COALESCE(p_exam->>'instructions', ''),
    COALESCE(NULLIF(p_exam->>'total_marks', '')::integer, 100),
    COALESCE(NULLIF(p_exam->>'section_a_marks', '')::integer, 0),
    COALESCE(NULLIF(p_exam->>'section_b_marks', '')::integer, 0),
    'published'
  ) RETURNING * INTO v_exam;

  FOR v_question_json IN SELECT value FROM jsonb_array_elements(p_questions)
  LOOP
    IF COALESCE(v_question_json->>'section', '') NOT IN ('A', 'B')
       OR COALESCE(NULLIF(v_question_json->>'question_text', ''), '') = '' THEN
      RAISE EXCEPTION 'Each question must have a section A/B and non-empty question text.';
    END IF;

    INSERT INTO public.questions (
      exam_id, school_id, section, question_number, question_text, marks, image_url
    ) VALUES (
      v_exam.id,
      v_school_id,
      v_question_json->>'section',
      COALESCE(NULLIF(v_question_json->>'question_number', '')::integer, v_question_count + 1),
      v_question_json->>'question_text',
      COALESCE(NULLIF(v_question_json->>'marks', '')::numeric, 1),
      NULLIF(v_question_json->>'image_url', '')
    ) RETURNING * INTO v_question;

    IF v_question.section = 'A' AND jsonb_typeof(v_question_json->'objective_data') = 'object' THEN
      INSERT INTO public.objective_answers (
        question_id, option_a, option_b, option_c, option_d, correct_option
      ) VALUES (
        v_question.id,
        COALESCE(v_question_json->'objective_data'->>'option_a', ''),
        COALESCE(v_question_json->'objective_data'->>'option_b', ''),
        COALESCE(v_question_json->'objective_data'->>'option_c', ''),
        COALESCE(v_question_json->'objective_data'->>'option_d', ''),
        COALESCE(v_question_json->'objective_data'->>'correct_option', 'A')
      );
    ELSIF v_question.section = 'B' AND jsonb_typeof(v_question_json->'theory_data') = 'object' THEN
      INSERT INTO public.theory_marking_schemes (
        question_id, model_answer, score_breakdown, max_score
      ) VALUES (
        v_question.id,
        COALESCE(v_question_json->'theory_data'->>'model_answer', ''),
        COALESCE(v_question_json->'theory_data'->>'score_breakdown', ''),
        COALESCE(NULLIF(v_question_json->'theory_data'->>'max_score', '')::numeric, v_question.marks)
      );
    END IF;

    v_saved_questions := v_saved_questions || jsonb_build_array(
      jsonb_build_object(
        'id', v_question.id,
        'exam_id', v_question.exam_id,
        'section', v_question.section,
        'question_number', v_question.question_number,
        'question_text', v_question.question_text,
        'marks', v_question.marks,
        'image_url', v_question.image_url,
        'created_at', v_question.created_at,
        'objective_data', CASE WHEN v_question.section = 'A' AND jsonb_typeof(v_question_json->'objective_data') = 'object'
          THEN v_question_json->'objective_data' ELSE NULL END,
        'theory_data', CASE WHEN v_question.section = 'B' AND jsonb_typeof(v_question_json->'theory_data') = 'object'
          THEN v_question_json->'theory_data' ELSE NULL END
      )
    );
    v_question_count := v_question_count + 1;
  END LOOP;

  IF p_is_ai THEN
    UPDATE public.schools SET ai_exams_used = ai_exams_used + 1 WHERE id = v_school_id;
  ELSE
    UPDATE public.schools SET manual_exams_used = manual_exams_used + 1 WHERE id = v_school_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'exam', to_jsonb(v_exam),
    'questions', v_saved_questions,
    'quota', jsonb_build_object(
      'used', v_used + 1,
      'max', CASE WHEN v_is_paid THEN 2147483647 ELSE v_max END,
      'is_paid', v_is_paid
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.publish_exam_with_invite(jsonb, jsonb, boolean, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.publish_exam_with_invite(jsonb, jsonb, boolean, text) TO service_role;


-- Public teacher links are scoped to a single active school invitation and never create auth users.
CREATE TABLE IF NOT EXISTS public.school_invite_ai_events (
  id bigint generated always as identity primary key,
  invitation_id uuid not null references public.school_invitations(id) on delete cascade,
  school_id uuid not null references public.schools(id) on delete cascade,
  created_at timestamptz not null default now()
);
CREATE INDEX IF NOT EXISTS school_invite_ai_events_invite_created_idx ON public.school_invite_ai_events(invitation_id, created_at desc);
CREATE INDEX IF NOT EXISTS school_invite_ai_events_school_created_idx ON public.school_invite_ai_events(school_id, created_at desc);
ALTER TABLE public.school_invite_ai_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.school_invite_ai_events FROM public, anon, authenticated;

CREATE OR REPLACE FUNCTION public.consume_school_invite_ai_slot(p_school_id uuid, p_invite_token text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_invitation public.school_invitations%ROWTYPE;
  v_invite_count integer;
  v_school_count integer;
BEGIN
  SELECT * INTO v_invitation
  FROM public.school_invitations si
  WHERE si.token = upper(trim(p_invite_token))
    AND si.school_id = p_school_id
    AND si.role = 'teacher'
    AND si.is_active = true
    AND (si.expires_at IS NULL OR si.expires_at > now())
  LIMIT 1;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'invalid_invite');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_invitation.id::text, 0));
  DELETE FROM public.school_invite_ai_events WHERE created_at < now() - interval '1 day';
  SELECT count(*) INTO v_invite_count FROM public.school_invite_ai_events
    WHERE invitation_id = v_invitation.id AND created_at > now() - interval '1 minute';
  SELECT count(*) INTO v_school_count FROM public.school_invite_ai_events
    WHERE school_id = p_school_id AND created_at > now() - interval '1 minute';
  IF v_invite_count >= 8 OR v_school_count >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limit');
  END IF;
  INSERT INTO public.school_invite_ai_events(invitation_id, school_id) VALUES(v_invitation.id, p_school_id);
  RETURN jsonb_build_object('allowed', true);
END;
$$;
REVOKE ALL ON FUNCTION public.consume_school_invite_ai_slot(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_school_invite_ai_slot(uuid, text) TO service_role;


-- Disable new teacher account creation: teacher links are passwordless capabilities only.
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  requested_type TEXT;
  assigned_role TEXT := 'school_admin';
  assigned_school_id UUID := NULL;
  user_full_name TEXT;
  school_email TEXT;
  school_name TEXT;
  school_phone TEXT;
  school_state TEXT;
  school_lga TEXT;
  school_type TEXT;
  school_address TEXT;
BEGIN
  requested_type := COALESCE(NEW.raw_user_meta_data->>'registration_type', '');

  user_full_name := COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''), split_part(NEW.email, '@', 1));

  IF requested_type = 'school' THEN
    school_name := NULLIF(trim(NEW.raw_user_meta_data->>'school_name'), '');
    school_email := lower(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'school_email'), ''), NEW.email));
    school_phone := NULLIF(trim(NEW.raw_user_meta_data->>'school_phone'), '');
    school_state := NULLIF(trim(NEW.raw_user_meta_data->>'school_state'), '');
    school_lga := NULLIF(trim(NEW.raw_user_meta_data->>'school_lga'), '');
    school_type := COALESCE(NULLIF(NEW.raw_user_meta_data->>'institution_type', ''), 'Secondary');
    school_address := NULLIF(trim(NEW.raw_user_meta_data->>'school_address'), '');

    IF school_name IS NULL OR school_phone IS NULL OR school_state IS NULL OR school_lga IS NULL THEN
      RAISE EXCEPTION 'School registration details are incomplete';
    END IF;

    IF school_type NOT IN ('Secondary', 'Comprehensive', 'College', 'International', 'Technical', 'Primary & Secondary') THEN
      school_type := 'Secondary';
    END IF;

    INSERT INTO public.schools (
      name, admin_name, email, phone, state, lga, institution_type, address,
      subscription_status, max_trial_ai_exams, max_trial_manual_exams
    ) VALUES (
      school_name, user_full_name, school_email, school_phone, school_state, school_lga,
      school_type, school_address, 'trial', 4, 5
    ) RETURNING id INTO assigned_school_id;

  ELSE
    RAISE EXCEPTION 'Unsupported registration flow';
  END IF;

  -- Platform administrator privileges are never granted by public signup.
  -- Provision them manually from the Supabase SQL Editor after verifying the account.

  INSERT INTO public.profiles (user_id, full_name, email, phone, school_id, is_profile_completed)
  VALUES (
    NEW.id, user_full_name, lower(NEW.email),
    NULLIF(trim(NEW.raw_user_meta_data->>'phone'), ''),
    assigned_school_id, assigned_school_id IS NOT NULL
  )
  ON CONFLICT (user_id) DO UPDATE SET
    full_name = EXCLUDED.full_name,
    email = EXCLUDED.email,
    phone = EXCLUDED.phone,
    school_id = EXCLUDED.school_id,
    is_profile_completed = EXCLUDED.is_profile_completed;

  INSERT INTO public.user_roles (user_id, role, school_id)
  VALUES (NEW.id, assigned_role, CASE WHEN assigned_role = 'platform_admin' THEN NULL ELSE assigned_school_id END)
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

