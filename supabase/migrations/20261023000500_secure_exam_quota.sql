-- Secure, atomic exam quota enforcement. Client-side localStorage counters are not authoritative.
CREATE OR REPLACE FUNCTION public.consume_exam_quota(p_school_id uuid, p_is_ai boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_id uuid := auth.uid();
  v_school public.schools%ROWTYPE;
  v_is_platform_admin boolean;
  v_is_school_member boolean;
  v_is_paid boolean;
  v_used integer;
  v_max integer;
  v_updated integer;
BEGIN
  IF v_user_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'code', 'unauthenticated', 'message', 'Please sign in again before publishing an exam.');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.user_roles ur
    WHERE ur.user_id = v_user_id AND ur.role = 'platform_admin'
  ) INTO v_is_platform_admin;

  SELECT EXISTS (
    SELECT 1
    FROM public.profiles p
    JOIN public.user_roles ur ON ur.user_id = p.user_id
    WHERE p.user_id = v_user_id
      AND p.school_id = p_school_id
      AND ur.school_id = p_school_id
      AND ur.role IN ('school_admin', 'teacher')
  ) INTO v_is_school_member;

  IF NOT v_is_platform_admin AND NOT v_is_school_member THEN
    RETURN jsonb_build_object('success', false, 'code', 'forbidden', 'message', 'You are not authorized to publish exams for this school.');
  END IF;

  SELECT * INTO v_school
  FROM public.schools
  WHERE id = p_school_id
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

  IF p_is_ai THEN
    UPDATE public.schools
      SET ai_exams_used = ai_exams_used + 1
      WHERE id = p_school_id;
  ELSE
    UPDATE public.schools
      SET manual_exams_used = manual_exams_used + 1
      WHERE id = p_school_id;
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'used', v_used + 1,
    'max', CASE WHEN v_is_paid THEN 2147483647 ELSE v_max END,
    'is_paid', v_is_paid
  );
END;
$$;

REVOKE ALL ON FUNCTION public.consume_exam_quota(uuid, boolean) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_exam_quota(uuid, boolean) FROM anon;
GRANT EXECUTE ON FUNCTION public.consume_exam_quota(uuid, boolean) TO authenticated;
