
-- Move SECURITY DEFINER role-check helpers out of the public (API-exposed) schema
CREATE SCHEMA IF NOT EXISTS private;
GRANT USAGE ON SCHEMA private TO authenticated, anon, service_role;

CREATE OR REPLACE FUNCTION private.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

REVOKE ALL ON FUNCTION private.has_role(uuid, public.app_role) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION private.has_role(uuid, public.app_role) TO authenticated;

-- Recreate every policy that referenced public.has_role to use private.has_role
DROP POLICY IF EXISTS "admins read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "admins manage profiles" ON public.profiles;
CREATE POLICY "admins read all profiles" ON public.profiles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "admins manage profiles" ON public.profiles
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admins read all roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admin insert user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admin update user_roles" ON public.user_roles;
DROP POLICY IF EXISTS "only admin delete user_roles" ON public.user_roles;
CREATE POLICY "admins read all roles" ON public.user_roles
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "only admin insert user_roles" ON public.user_roles
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "only admin update user_roles" ON public.user_roles
  FOR UPDATE TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "only admin delete user_roles" ON public.user_roles
  FOR DELETE TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin manage kategori" ON public.kategori_buku;
CREATE POLICY "admin manage kategori" ON public.kategori_buku
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "petugas manage buku" ON public.buku;
CREATE POLICY "petugas manage buku" ON public.buku
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'petugas'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'petugas'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "petugas manage peminjaman" ON public.peminjaman;
CREATE POLICY "petugas manage peminjaman" ON public.peminjaman
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'petugas'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'petugas'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "petugas manage detail" ON public.detail_peminjaman;
CREATE POLICY "petugas manage detail" ON public.detail_peminjaman
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'petugas'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'petugas'::public.app_role) OR private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin read log" ON public.log_aktivitas;
CREATE POLICY "admin read log" ON public.log_aktivitas
  FOR SELECT TO authenticated USING (private.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS "admin full access peminjam" ON public.peminjam;
DROP POLICY IF EXISTS "petugas insert peminjam" ON public.peminjam;
DROP POLICY IF EXISTS "petugas select own peminjam" ON public.peminjam;
DROP POLICY IF EXISTS "petugas update own peminjam" ON public.peminjam;
CREATE POLICY "admin full access peminjam" ON public.peminjam
  FOR ALL TO authenticated
  USING (private.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (private.has_role(auth.uid(), 'admin'::public.app_role));
CREATE POLICY "petugas insert peminjam" ON public.peminjam
  FOR INSERT TO authenticated WITH CHECK (private.has_role(auth.uid(), 'petugas'::public.app_role));
CREATE POLICY "petugas select own peminjam" ON public.peminjam
  FOR SELECT TO authenticated USING (
    private.has_role(auth.uid(), 'petugas'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.peminjaman p WHERE p.peminjam_id = peminjam.id AND p.petugas_id = auth.uid())
  );
CREATE POLICY "petugas update own peminjam" ON public.peminjam
  FOR UPDATE TO authenticated USING (
    private.has_role(auth.uid(), 'petugas'::public.app_role)
    AND EXISTS (SELECT 1 FROM public.peminjaman p WHERE p.peminjam_id = peminjam.id AND p.petugas_id = auth.uid())
  );

-- Remove the public-exposed SECURITY DEFINER helpers
DROP FUNCTION IF EXISTS public.has_role(uuid, public.app_role);
REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
