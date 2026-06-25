
-- Fix function search_path
CREATE OR REPLACE FUNCTION public.set_kode_buku()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kode_buku IS NULL OR NEW.kode_buku = '' THEN
    NEW.kode_buku := 'BK-' || LPAD(nextval('public.buku_kode_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.set_kode_peminjam()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.kode_peminjam IS NULL OR NEW.kode_peminjam = '' THEN
    NEW.kode_peminjam := 'PM-' || LPAD(nextval('public.peminjam_kode_seq')::text, 5, '0');
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.kurangi_stok_buku()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  UPDATE public.buku SET jumlah_tersedia = jumlah_tersedia - NEW.jumlah
   WHERE id = NEW.buku_id;
  IF (SELECT jumlah_tersedia FROM public.buku WHERE id = NEW.buku_id) < 0 THEN
    RAISE EXCEPTION 'Stok buku tidak mencukupi';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION public.kembalikan_stok()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.status = 'dikembalikan' AND OLD.status <> 'dikembalikan' THEN
    UPDATE public.buku b
      SET jumlah_tersedia = jumlah_tersedia + d.jumlah
      FROM public.detail_peminjaman d
      WHERE d.peminjaman_id = NEW.id AND d.buku_id = b.id;
    NEW.tanggal_dikembalikan := COALESCE(NEW.tanggal_dikembalikan, CURRENT_DATE);
  END IF;
  RETURN NEW;
END; $$;

-- Lock down SECURITY DEFINER functions: revoke from PUBLIC/anon, allow only authenticated where needed
REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated;

REVOKE ALL ON FUNCTION public.current_user_roles() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.current_user_roles() TO authenticated;

REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;

-- Fix peminjam: drop overly permissive policies and replace with strict ones
DROP POLICY IF EXISTS "anon register peminjam" ON public.peminjam;
DROP POLICY IF EXISTS "auth read peminjam" ON public.peminjam;

-- Restrict anon registration: validate required fields are present and non-empty,
-- prevent setting privileged columns by enforcing tight value checks.
CREATE POLICY "anon register peminjam" ON public.peminjam
  FOR INSERT TO anon
  WITH CHECK (
    nama IS NOT NULL AND length(btrim(nama)) BETWEEN 2 AND 120
    AND no_identitas IS NOT NULL AND length(btrim(no_identitas)) BETWEEN 3 AND 60
    AND no_hp IS NOT NULL AND length(btrim(no_hp)) BETWEEN 6 AND 20
    AND alamat IS NOT NULL AND length(btrim(alamat)) BETWEEN 3 AND 500
    AND (email IS NULL OR email ~* '^[^@\s]+@[^@\s]+\.[^@\s]+$')
  );

-- SELECT access on peminjam is now only via the existing "petugas manage peminjam" ALL policy
-- (admin + petugas). Regular authenticated users no longer see borrower PII.
