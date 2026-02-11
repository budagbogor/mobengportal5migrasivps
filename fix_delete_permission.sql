-- FIX: Enable DELETE permission for Submissions table
-- Saat ini table 'submissions' hanya punya policy untuk INSERT & SELECT.
-- Kita perlu menambahkan policy untuk DELETE.

-- 1. Policy untuk menghapus data (Disamakan dengan policy select/insert yang sudah ada)
CREATE POLICY "Enable delete for anon" ON public.submissions FOR DELETE USING (true);

-- 2. Policy untuk menghapus used_tokens (jika perlu reset token)
CREATE POLICY "Enable delete for anon tokens" ON public.used_tokens FOR DELETE USING (true);

-- 3. Policy untuk menghapus invitations (jika perlu hapus undangan)
CREATE POLICY "Enable delete for anon invitations" ON public.invitations FOR DELETE USING (true);

-- Notifikasi sukses (Opsional, hanya komentar)
-- "Policy DELETE berhasil ditambahkan. Silakan coba hapus data lagi di aplikasi."
