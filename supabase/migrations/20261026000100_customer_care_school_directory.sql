-- Customer-care staff can view registration contact details for all schools, but cannot edit them.
-- Provision the customer_care role manually for verified staff; public signup never grants it.
BEGIN;

ALTER TABLE public.user_roles DROP CONSTRAINT IF EXISTS user_roles_role_check;
ALTER TABLE public.user_roles
  ADD CONSTRAINT user_roles_role_check
  CHECK (role IN ('school_admin', 'teacher', 'platform_admin', 'customer_care'));

DROP POLICY IF EXISTS schools_select_member_or_platform ON public.schools;
CREATE POLICY schools_select_member_or_platform
ON public.schools FOR SELECT TO authenticated
USING (
  id = public.get_user_school_id()
  OR public.is_platform_admin()
  OR EXISTS (
    SELECT 1 FROM public.user_roles r
    WHERE r.user_id = auth.uid()
      AND r.role = 'customer_care'
      AND r.school_id IS NULL
  )
);

COMMIT;
