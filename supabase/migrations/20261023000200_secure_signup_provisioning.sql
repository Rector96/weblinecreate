-- Secure signup provisioning for ROCKCRAF.
-- Apply this migration AFTER the existing security hardening migration.
-- It replaces the auth.users trigger function so school and teacher signup metadata
-- is validated and provisioned server-side; browser-supplied role values are ignored.

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
  invite_row public.school_invitations%ROWTYPE;
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

  ELSIF requested_type = 'teacher_invite' THEN
    SELECT * INTO invite_row
    FROM public.school_invitations
    WHERE token = upper(COALESCE(NEW.raw_user_meta_data->>'invitation_token', ''))
      AND is_active = true
      AND (expires_at IS NULL OR expires_at > now())
      AND role = 'teacher'
    LIMIT 1;

    IF invite_row.id IS NULL THEN
      RAISE EXCEPTION 'Invitation token is invalid or expired';
    END IF;

    assigned_school_id := invite_row.school_id;
    assigned_role := 'teacher';
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


-- Prevent authenticated users from moving their profile into another school.
-- Profile updates are allowed for names/phone/avatar, but school membership is
-- assigned only by trusted signup provisioning or a platform administrator.
CREATE OR REPLACE FUNCTION public.guard_profile_membership_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.is_platform_admin() THEN
    NEW.user_id := OLD.user_id;
    NEW.school_id := OLD.school_id;
    NEW.email := OLD.email;
    NEW.id := OLD.id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_profile_membership_changes ON public.profiles;
CREATE TRIGGER guard_profile_membership_changes
BEFORE UPDATE ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.guard_profile_membership_changes();

-- A school administrator may manage school roles, but cannot grant platform
-- administrator privileges. Only the trusted signup trigger/platform admin can.
CREATE OR REPLACE FUNCTION public.guard_platform_role_assignment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF auth.uid() IS NOT NULL
     AND NOT public.is_platform_admin()
     AND NEW.role = 'platform_admin' THEN
    RAISE EXCEPTION 'Only an existing platform administrator can assign platform administrator access';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_platform_role_assignment ON public.user_roles;
CREATE TRIGGER guard_platform_role_assignment
BEFORE INSERT OR UPDATE ON public.user_roles
FOR EACH ROW EXECUTE FUNCTION public.guard_platform_role_assignment();
