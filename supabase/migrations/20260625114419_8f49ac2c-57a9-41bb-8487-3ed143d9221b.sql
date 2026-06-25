
-- 1) Revoke EXECUTE on SECURITY DEFINER helper not required by RLS policies
REVOKE EXECUTE ON FUNCTION public.current_user_roles() FROM authenticated, anon, PUBLIC;

-- 2) Scope petugas access to peminjam: only records linked to their own peminjaman
DROP POLICY IF EXISTS "petugas manage peminjam" ON public.peminjam;

CREATE POLICY "admin full access peminjam"
  ON public.peminjam
  FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "petugas insert peminjam"
  ON public.peminjam
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'petugas'::app_role));

CREATE POLICY "petugas select own peminjam"
  ON public.peminjam
  FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'petugas'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.peminjaman p
      WHERE p.peminjam_id = peminjam.id
        AND p.petugas_id = auth.uid()
    )
  );

CREATE POLICY "petugas update own peminjam"
  ON public.peminjam
  FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'petugas'::app_role)
    AND EXISTS (
      SELECT 1 FROM public.peminjaman p
      WHERE p.peminjam_id = peminjam.id
        AND p.petugas_id = auth.uid()
    )
  );

-- 3) Explicit write protection on user_roles: only admins may write
CREATE POLICY "only admin insert user_roles"
  ON public.user_roles
  FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "only admin update user_roles"
  ON public.user_roles
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "only admin delete user_roles"
  ON public.user_roles
  FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role));
