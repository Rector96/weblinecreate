-- Publish an exam and enforce its quota in one PostgreSQL transaction.
-- If any question/answer insert fails, the exam and quota increment both roll back.
CREATE OR REPLACE FUNCTION public.publish_exam_with_quota(
  p_exam jsonb,
  p_questions jsonb,
  p_is_ai boolean
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
  v_is_platform_admin boolean;
  v_is_school_member boolean;
  v_is_paid boolean;
  v_used integer;
  v_max integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'unauthenticated', 'message', 'Please sign in again before publishing an exam.');
  END IF;

  IF p_exam IS NULL OR jsonb_typeof(p_exam) <> 'object'
     OR p_questions IS NULL OR jsonb_typeof(p_questions) <> 'array'
     OR jsonb_array_length(p_questions) = 0 THEN
    RETURN jsonb_build_object('success', false, 'code', 'invalid_payload', 'message', 'Exam details and at least one question are required.');
  END IF;

  v_school_id := (p_exam->>'school_id')::uuid;

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

  IF NOT v_is_platform_admin AND NOT v_is_school_member THEN
    RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'message', 'You are not authorized to publish exams for this school.');
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

REVOKE ALL ON FUNCTION public.publish_exam_with_quota(jsonb, jsonb, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.publish_exam_with_quota(jsonb, jsonb, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.publish_exam_with_quota(jsonb, jsonb, boolean) TO authenticated;
