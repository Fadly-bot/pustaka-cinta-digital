
-- Switch has_role to SECURITY INVOKER so signed-in users can no longer execute with elevated privileges.
-- RLS on user_roles must let authenticated users read their own rows for has_role to function as invoker.

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

-- Ensure authenticated users can read their own role rows (needed for invoker has_role).
DROP POLICY IF EXISTS "Users can read own roles" ON public.user_roles;
CREATE POLICY "Users can read own roles"
ON public.user_roles
FOR SELECT
TO authenticated
USING (user_id = auth.uid());
