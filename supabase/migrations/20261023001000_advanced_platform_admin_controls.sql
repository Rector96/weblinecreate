-- Advanced platform administration controls for ROCKCRAF.
-- Apply in Supabase SQL Editor after migrations 001-009.
-- Existing schools remain active and generation-enabled; no payment history is changed.

BEGIN;

ALTER TABLE public.schools
  ADD COLUMN IF NOT EXISTS account_status text NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS generation_enabled boolean NOT NULL DEFAULT true;

ALTER TABLE public.schools
  DROP CONSTRAINT IF EXISTS schools_account_status_check;
ALTER TABLE public.schools
  ADD CONSTRAINT schools_account_status_check
  CHECK (account_status IN ('active', 'suspended'));

COMMENT ON COLUMN public.schools.account_status IS 'Platform-level account access control; separate from payment/subscription status.';
COMMENT ON COLUMN public.schools.generation_enabled IS 'Platform administrator switch controlling whether this school can generate or publish exams.';

-- Enforce the controls inside PostgreSQL too, not only in the admin UI.
CREATE OR REPLACE FUNCTION public.guard_exam_generation_for_school()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text;
  v_enabled boolean;
BEGIN
  SELECT account_status, generation_enabled
    INTO v_status, v_enabled
  FROM public.schools
  WHERE id = NEW.school_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'School account was not found.';
  END IF;

  IF v_status = 'suspended' THEN
    RAISE EXCEPTION 'This school account is suspended. Contact ROCKCRAF support.';
  END IF;

  IF v_enabled IS DISTINCT FROM true THEN
    RAISE EXCEPTION 'Exam generation has been disabled for this school by the platform administrator.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_exam_generation_for_school ON public.exams;
CREATE TRIGGER guard_exam_generation_for_school
BEFORE INSERT ON public.exams
FOR EACH ROW EXECUTE FUNCTION public.guard_exam_generation_for_school();

-- AI generation is rate-limited server-side. Add account and permission checks
-- before consuming a rate-limit slot.
CREATE OR REPLACE FUNCTION public.consume_ai_generation_slot(p_user_id uuid, p_school_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_count integer;
  v_school_count integer;
  v_member boolean;
  v_status text;
  v_enabled boolean;
BEGIN
  SELECT account_status, generation_enabled
    INTO v_status, v_enabled
  FROM public.schools
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'school_not_found');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'school_suspended');
  END IF;
  IF v_enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'generation_disabled');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.user_id = p_user_id AND p.school_id = p_school_id
  ) OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = p_user_id AND r.role = 'platform_admin'
  ) INTO v_member;

  IF NOT v_member THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'membership');
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text, 0));
  DELETE FROM public.ai_generation_events WHERE created_at < now() - interval '1 day';

  SELECT count(*) INTO v_user_count
  FROM public.ai_generation_events
  WHERE user_id = p_user_id AND created_at > now() - interval '1 minute';

  SELECT count(*) INTO v_school_count
  FROM public.ai_generation_events
  WHERE school_id = p_school_id AND created_at > now() - interval '1 minute';

  IF v_user_count >= 5 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'user_rate');
  END IF;
  IF v_school_count >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'school_rate');
  END IF;

  INSERT INTO public.ai_generation_events(user_id, school_id) VALUES (p_user_id, p_school_id);
  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_ai_generation_slot(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_ai_generation_slot(uuid, uuid) TO service_role;

-- Passwordless teacher invite links use a separate AI quota function.
CREATE OR REPLACE FUNCTION public.consume_school_invite_ai_slot(p_school_id uuid, p_invite_token text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_invitation public.school_invitations%ROWTYPE;
  v_invite_count integer;
  v_school_count integer;
  v_status text;
  v_enabled boolean;
BEGIN
  SELECT account_status, generation_enabled
    INTO v_status, v_enabled
  FROM public.schools
  WHERE id = p_school_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'school_not_found');
  END IF;
  IF v_status = 'suspended' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'school_suspended');
  END IF;
  IF v_enabled IS DISTINCT FROM true THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'generation_disabled');
  END IF;

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

  SELECT count(*) INTO v_invite_count
  FROM public.school_invite_ai_events
  WHERE invitation_id = v_invitation.id AND created_at > now() - interval '1 minute';

  SELECT count(*) INTO v_school_count
  FROM public.school_invite_ai_events
  WHERE school_id = p_school_id AND created_at > now() - interval '1 minute';

  IF v_invite_count >= 8 OR v_school_count >= 20 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'rate_limit');
  END IF;

  INSERT INTO public.school_invite_ai_events(invitation_id, school_id)
  VALUES (v_invitation.id, p_school_id);
  RETURN jsonb_build_object('allowed', true);
END;
$$;

REVOKE ALL ON FUNCTION public.consume_school_invite_ai_slot(uuid, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.consume_school_invite_ai_slot(uuid, text) TO service_role;

COMMIT;
